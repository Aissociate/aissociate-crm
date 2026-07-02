import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { parse } from "npm:csv-parse@5.5.6/sync";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const DEFAULT_CANDIDATS = "1zTGPU-Z5B-zIPjXuIJRRB0z-dOx1lf-4eL1TyNba3cs";
const DEFAULT_PROSPECTS = "1lZTn8IU5xKtN0DjtH6XvfesK6a0s0zcnm_RA44SzpjA";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Row = Record<string, string>;

async function fetchSheet(id: string): Promise<Row[]> {
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Sheet ${id}: HTTP ${res.status}`);
  const text = await res.text();
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Row[];
}

function splitName(full: string): { prenom: string | null; nom: string } {
  const parts = (full ?? "").trim().split(/\s+/);
  if (parts.length <= 1) return { prenom: null, nom: full.trim() || "—" };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

function notesFrom(row: Row, skip: Set<string>): string {
  return Object.entries(row)
    .filter(([k, v]) => k && !skip.has(k) && v && v.trim())
    .map(([k, v]) => `${k.replace(/_/g, " ").replace(/\?+/g, "?").trim()} : ${v.trim()}`)
    .join("\n");
}

// — Détection des champs par contenu (insensible à l'ordre des colonnes) —
// Meta peut écrire les leads dans un ordre différent de la ligne d'en-tête du
// Google Sheet ; on retombe alors sur ces heuristiques pour ne pas « décaler »
// les valeurs (email = valeur avec @, tél = p:/+chiffres, nom = texte, etc.).
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v ?? "").trim());
const PHONE_PREFIX = /^p:\s*/i;
const normalizePhone = (v: string) => (v ?? "").replace(PHONE_PREFIX, "").trim();
function isPhone(v: string): boolean {
  const s = (v ?? "").trim();
  if (PHONE_PREFIX.test(s)) return true;
  const digits = s.replace(/[^\d]/g, "");
  return digits.length >= 8 && /^[+\d][\d\s().+-]+$/.test(s);
}
const isPrefixedId = (v: string) => /^[a-z]{1,3}:\d/i.test((v ?? "").trim()); // l:, ag:, as:, c:, f:
const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}t/i.test((v ?? "").trim());
function isMetaToken(v: string): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return s === "" || s === "true" || s === "false" || s === "fb" || s === "ig"
    || s === "facebook" || s === "instagram" || s === "created" || /^\d{9,}$/.test(s);
}
function looksLikeName(v: string): boolean {
  const s = (v ?? "").trim();
  if (!s) return false;
  if (isEmail(s) || isPhone(s) || isPrefixedId(s) || isIsoDate(s) || isMetaToken(s)) return false;
  return /\p{L}/u.test(s); // contient au moins une lettre
}

// Extrait nom/email/téléphone/société d'une ligne quel que soit l'ordre des colonnes.
function extractProspect(r: Row): {
  nom: string; prenom: string | null; email: string | null;
  telephone: string | null; company: string; ville: string; misaligned: boolean;
} {
  const vals = Object.values(r).map((v) => (v ?? "").toString());
  // Ligne « décalée » = l'en-tête ne décrit plus les valeurs de cette ligne.
  const misaligned = isPrefixedId(r.full_name ?? "") || !isEmail(r.email ?? "");

  const email = (isEmail(r.email ?? "") ? (r.email as string) : (vals.find(isEmail) ?? "")).trim();
  const phoneRaw = (r.phone && isPhone(r.phone)) ? r.phone : (vals.find(isPhone) ?? "");
  const telephone = normalizePhone(phoneRaw) || null;

  const emailIdx = vals.findIndex(isEmail);

  // Nom : priorité à l'en-tête s'il est valide, sinon détection autour de l'email.
  let fullName = "";
  if (looksLikeName(r.full_name ?? "")) {
    fullName = (r.full_name as string).trim();
  } else if (emailIdx >= 0) {
    const near: string[] = [];
    for (const j of [emailIdx + 1, emailIdx - 1, emailIdx + 2, emailIdx - 2]) {
      const v = vals[j];
      if (v && looksLikeName(v) && !isPhone(v)) near.push(v.trim());
    }
    fullName = near.find((v) => /\s/.test(v)) ?? near[0]
      ?? (vals.find((v) => looksLikeName(v) && /\s/.test(v.trim()))?.trim() ?? "");
  }

  // Société : en-tête si valide, sinon texte proche du bloc contact (≠ nom).
  let company = "";
  if (r.company_name && looksLikeName(r.company_name) && r.company_name.trim() !== fullName) {
    company = r.company_name.trim();
  } else if (emailIdx >= 0) {
    for (const j of [emailIdx + 3, emailIdx + 2, emailIdx - 3]) {
      const v = vals[j];
      if (v && looksLikeName(v) && !isPhone(v) && v.trim() !== fullName) { company = v.trim(); break; }
    }
  }

  const ville = (r.ville && looksLikeName(r.ville)) ? r.ville.trim() : "";
  const { prenom, nom } = splitName(fullName || (r.full_name ?? ""));
  return { nom, prenom, email: email || null, telephone, company, ville, misaligned };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const sb = createClient(SUPABASE_URL, SERVICE);

    // — Contrôle d'accès : cron interne (service_role) ou manager connecté —
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    if (bearer !== SERVICE) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: ud } = await userClient.auth.getUser();
      if (!ud.user) {
        return new Response(JSON.stringify({ error: "Non authentifié" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await sb.from("profiles").select("role").eq("id", ud.user.id).maybeSingle();
      const role = (profile?.role as string) ?? "conseiller";
      if (role !== "admin" && role !== "directeur_commercial") {
        return new Response(JSON.stringify({ error: "Accès réservé à la direction" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const source: string = body.source ?? "all";

    const isCron = bearer === SERVICE;
    // « force » = re-synchroniser depuis le Sheet des contacts DÉJÀ présents.
    // Réservé au déclenchement MANUEL : le cron n'écrase jamais les données du CRM
    // (modifications / réaffectations conservées). Les suppressions restent exclues
    // dans tous les cas — un contact supprimé ne réapparaît jamais.
    const force = body.force === true && !isCron;

    // external_id supprimés du CRM → jamais réimportés (cron comme manuel).
    async function excludedIds(src: string): Promise<Set<string>> {
      const { data } = await sb.from("import_exclusions").select("external_id").eq("source", src);
      return new Set((data ?? []).map((e: { external_id: string }) => e.external_id));
    }

    const result: Record<string, unknown> = {};

    if (source === "all" || source === "candidats") {
      const id = Deno.env.get("SHEET_CANDIDATS_ID") ?? DEFAULT_CANDIDATS;
      const rows = await fetchSheet(id);

      let { data: offre } = await sb
        .from("offres_recrutement")
        .select("id")
        .ilike("titre", "Chargé de formation%")
        .maybeSingle();
      if (!offre) {
        const ins = await sb
          .from("offres_recrutement")
          .insert({ titre: "Chargé de formation", statut: "ouverte" })
          .select("id")
          .single();
        offre = ins.data;
      }

      const skip = new Set([
        "id", "created_time", "ad_id", "ad_name", "adset_id", "adset_name",
        "campaign_id", "campaign_name", "form_id", "form_name", "is_organic",
        "platform", "email", "full_name", "phone_number", "lead_status",
      ]);

      const payloads = rows
        .filter(
          (r) =>
            r.id &&
            r.full_name &&
            !r.full_name.startsWith("<") &&
            !/test lead/i.test(JSON.stringify(r)),
        )
        .map((r) => {
          const { prenom, nom } = splitName(r.full_name);
          return {
            external_id: `meta:${r.id}`,
            offre_id: offre?.id ?? null,
            nom,
            prenom,
            email: r.email || null,
            telephone: r.phone_number || null,
            statut: "recu" as const,
            notes: notesFrom(r, skip) || null,
            metadata: r,
          };
        });

      const excl = await excludedIds("candidats");
      const kept = payloads.filter((p) => !excl.has(p.external_id));

      let imported = 0;
      if (kept.length) {
        const { data: ins, error } = await sb
          .from("candidats")
          .upsert(kept, { onConflict: "external_id", ignoreDuplicates: !force })
          .select("id");
        if (error) throw new Error(`candidats: ${error.message}`);
        imported = ins?.length ?? 0;
      }
      result.candidats = { lus: rows.length, importes: imported, exclus: payloads.length - kept.length };
    }

    if (source === "all" || source === "prospects") {
      const id = Deno.env.get("SHEET_PROSPECTS_ID") ?? DEFAULT_PROSPECTS;
      const rows = await fetchSheet(id);

      // Conseillers actifs pour la répartition round-robin
      const { data: cons } = await sb.from("profiles")
        .select("id").eq("role", "conseiller").eq("actif", true);
      const conseillers = (cons ?? []).map((c: { id: string }) => c.id);
      let rr = 0;

      // Colonnes techniques Meta ignorées dans les notes (lignes alignées).
      const skip = new Set([
        "full_name", "company_name", "phone", "", "email", "ville", "lead_status",
        "id", "created_time", "ad_id", "ad_name", "adset_id", "adset_name",
        "campaign_id", "campaign_name", "form_id", "form_name", "is_organic",
        "platform", "inbox_url",
      ]);

      const payloads = rows
        .filter((r) => {
          if (!r || typeof r !== "object") return false;
          if ((r.full_name ?? "").trim() === "full_name") return false; // ligne d'en-tête dupliquée
          if (/test lead/i.test(JSON.stringify(r))) return false;
          const vals = Object.values(r).map((v) => (v ?? "").toString());
          return vals.some(isEmail) || looksLikeName(r.full_name ?? "");
        })
        .map((r) => {
          const p = extractProspect(r);
          const entete: string[] = [];
          if (p.company) entete.push(`Entreprise : ${p.company}`);
          if (p.ville) entete.push(`Ville : ${p.ville}`);

          let commentaires: string;
          if (p.misaligned) {
            // En-tête non fiable pour cette ligne : on évite les libellés erronés
            // et on conserve les réponses lisibles sans étiquette.
            const used = new Set(
              [p.nom, p.prenom, p.email, p.telephone, p.company, p.ville]
                .map((x) => (x ?? "").toString().trim().toLowerCase())
                .filter(Boolean),
            );
            const answers = Object.values(r)
              .map((v) => (v ?? "").toString().trim())
              .filter((s) =>
                s && !isEmail(s) && !isPhone(s) && !isPrefixedId(s) &&
                !isIsoDate(s) && !isMetaToken(s) && !used.has(s.toLowerCase())
              );
            const uniq = [...new Set(answers)];
            commentaires = uniq.length ? `Réponses formulaire : ${uniq.join(" | ")}` : "";
          } else {
            commentaires = notesFrom(r, skip);
          }

          const notes = [entete.join("\n"), commentaires].filter(Boolean).join("\n");
          const key = (p.email || p.telephone || `${p.prenom ?? ""} ${p.nom}`).toLowerCase().trim();
          return {
            external_id: `pros:${key}`,
            type: "prospect" as const,
            nom: p.nom,
            prenom: p.prenom,
            email: p.email,
            telephone: p.telephone,
            notes: notes || null,
            // round-robin sur les conseillers ; sinon « non affecté » (admin)
            owner_id: conseillers.length ? conseillers[rr++ % conseillers.length] : null,
            metadata: r,
          };
        });

      const excl = await excludedIds("contacts");
      const kept = payloads.filter((p) => !excl.has(p.external_id));

      let imported = 0;
      if (kept.length) {
        const { data: ins, error } = await sb
          .from("contacts")
          .upsert(kept, { onConflict: "external_id", ignoreDuplicates: !force })
          .select("id");
        if (error) throw new Error(`contacts: ${error.message}`);
        imported = ins?.length ?? 0;
      }
      result.prospects = { lus: rows.length, importes: imported, exclus: payloads.length - kept.length };
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
