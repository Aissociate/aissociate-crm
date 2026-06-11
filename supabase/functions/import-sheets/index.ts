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

      let imported = 0;
      if (payloads.length) {
        const { data: ins, error } = await sb
          .from("candidats")
          .upsert(payloads, { onConflict: "external_id", ignoreDuplicates: true })
          .select("id");
        if (error) throw new Error(`candidats: ${error.message}`);
        imported = ins?.length ?? 0;
      }
      result.candidats = { lus: rows.length, importes: imported };
    }

    if (source === "all" || source === "prospects") {
      const id = Deno.env.get("SHEET_PROSPECTS_ID") ?? DEFAULT_PROSPECTS;
      const rows = await fetchSheet(id);

      // Conseillers actifs pour la répartition round-robin
      const { data: cons } = await sb.from("profiles")
        .select("id").eq("role", "conseiller").eq("actif", true);
      const conseillers = (cons ?? []).map((c: { id: string }) => c.id);
      let rr = 0;

      const skip = new Set(["full_name", "company_name", "phone", "", "email", "ville", "lead_status"]);

      const payloads = rows
        .filter((r) => r.full_name && r.full_name.trim() && r.full_name.trim() !== "full_name")
        .map((r) => {
          const { prenom, nom } = splitName(r.full_name);
          const entete: string[] = [];
          if (r.company_name) entete.push(`Entreprise : ${r.company_name}`);
          if (r.ville) entete.push(`Ville : ${r.ville}`);
          const commentaires = notesFrom(r, skip);
          const notes = [entete.join("\n"), commentaires].filter(Boolean).join("\n");
          const key = (r.email || r.phone || r.full_name).toLowerCase().trim();
          return {
            external_id: `pros:${key}`,
            type: "prospect" as const,
            nom,
            prenom,
            email: r.email || null,
            telephone: r.phone || null,
            notes: notes || null,
            // round-robin sur les conseillers ; sinon « non affecté » (admin)
            owner_id: conseillers.length ? conseillers[rr++ % conseillers.length] : null,
            metadata: r,
          };
        });

      let imported = 0;
      if (payloads.length) {
        const { data: ins, error } = await sb
          .from("contacts")
          .upsert(payloads, { onConflict: "external_id", ignoreDuplicates: true })
          .select("id");
        if (error) throw new Error(`contacts: ${error.message}`);
        imported = ins?.length ?? 0;
      }
      result.prospects = { lus: rows.length, importes: imported };
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
