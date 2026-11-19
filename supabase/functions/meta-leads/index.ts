// Fonction serveur — import direct des prospects des formulaires Meta (Lead Ads) dans le CRM.
//
// Lit les formulaires de la page Facebook (Graph API) et crée un contact « prospect » par
// prospect reçu, sans passer par un Google Sheet. Appelée toutes les 5 min par le cron
// (clé service) et à la demande depuis Paramètres › Publicité Meta (direction).
//
// - Déduplication : même clé que import-sheets (`pros:<email|téléphone|nom>`), donc un
//   prospect déjà importé par le Sheet n'est jamais recréé ; les contacts supprimés du CRM
//   (`import_exclusions`, source « contacts ») ne reviennent pas.
// - Retour d'un prospect existant (nouvelle soumission) : note « relead » + tag, comme le Sheet.
// - Formulaires : `leads_form_ids` s'il est renseigné, sinon tous ceux de la page, sauf
//   les formulaires de recrutement (candidatures), qui ne sont pas des prospects.
// - Jeton : `leads_page_token` (jeton de page avec leads_retrieval) ; à défaut, le jeton
//   de page est demandé à Meta avec le jeton du compte publicitaire (utilisateur système).
// - État (dernière synchro) dans `parametres.meta_leads_etat` ; journal dans `job_runs`.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PAGE_PAR_DEFAUT = "112479281807858"; // page Facebook « Aissociate »
const PREMIER_IMPORT_JOURS = 30;           // profondeur du tout premier import
const RECOUVREMENT_MS = 60 * 60 * 1000;    // relit la dernière heure (prospects arrivés en retard)
const FORMULAIRE_RECRUTEMENT = /candidat|recrut|sdr|charg[ée] de formation|emploi|job/i;

type Champ = { name: string; values?: string[] };
type Lead = {
  id: string; created_time: string; field_data?: Champ[];
  ad_name?: string; campaign_name?: string; platform?: string; is_organic?: boolean;
};
type Formulaire = { id: string; name: string; status?: string };

class ErreurMeta extends Error {}

async function graph<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new ErreurMeta(j.error?.message ?? `Meta HTTP ${r.status}`);
  return j as T;
}

/** Toutes les pages d'une liste Graph (`paging.next`), dans la limite de `max` éléments. */
async function toutLire<T>(url: string, max = 2000): Promise<T[]> {
  const out: T[] = [];
  let suivant: string | undefined = url;
  while (suivant && out.length < max) {
    const page: { data?: T[]; paging?: { next?: string } } = await graph(suivant);
    out.push(...(page.data ?? []));
    suivant = page.paging?.next;
  }
  return out;
}

const normaliser = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Champs standard Meta (et variantes françaises des questions personnalisées). */
function lireChamps(champs: Champ[]) {
  const v: Record<string, string> = {};
  const autres: string[] = [];
  for (const c of champs) {
    const val = (c.values ?? []).map((x) => String(x).trim()).filter(Boolean).join(", ");
    if (!val) continue;
    const k = normaliser(c.name);
    if (["full_name", "nom_complet", "nom_et_prenom", "prenom_et_nom"].includes(k)) v.full_name = val;
    else if (["first_name", "prenom"].includes(k)) v.first_name = val;
    else if (["last_name", "nom", "nom_de_famille"].includes(k)) v.last_name = val;
    else if (["email", "e_mail", "adresse_e_mail", "work_email"].includes(k)) v.email = val.toLowerCase();
    else if (["phone_number", "phone", "telephone", "numero_de_telephone", "work_phone_number"].includes(k)) v.phone = val;
    else if (["company_name", "entreprise", "societe", "nom_de_l_entreprise"].includes(k)) v.company = val;
    else if (["city", "ville"].includes(k)) v.city = val;
    else if (["job_title", "fonction", "poste"].includes(k)) v.job = val;
    else autres.push(`${c.name.replace(/_/g, " ").replace(/\?+/g, "?").trim()} : ${val}`);
  }
  return { v, autres };
}

function decouperNom(complet: string): { prenom: string | null; nom: string } {
  const parts = complet.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { prenom: null, nom: complet.trim() || "—" };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

async function journaliser(sb: SupabaseClient, debut: string, ok: boolean, message: string, detail?: unknown) {
  try {
    await sb.from("job_runs").insert({
      fonction: "meta-leads", started_at: debut, finished_at: new Date().toISOString(), ok, message, detail: detail ?? null,
    });
  } catch { /* jamais bloquant */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const debut = new Date().toISOString();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE);

  // — Accès : cron (clé service) ou direction connectée —
  const authHeader = req.headers.get("Authorization") ?? "";
  const estCron = authHeader.replace(/^Bearer\s+/i, "") === SERVICE;
  if (!estCron) {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ud } = await userClient.auth.getUser();
    if (!ud.user) return json({ error: "Non authentifié" }, 401);
    const { data: profil } = await sb.from("profiles").select("role").eq("id", ud.user.id).maybeSingle();
    const role = (profil?.role as string) ?? "conseiller";
    if (role !== "admin" && role !== "directeur_commercial") return json({ error: "Accès réservé à la direction" }, 403);
  }

  const corps = (await req.json().catch(() => ({}))) as { jours?: number };

  try {
    // — Configuration (même ligne que les performances Meta) —
    const { data: cfgRow } = await sb.from("parametres").select("valeur").eq("cle", "meta_ads").maybeSingle();
    const cfg = (cfgRow?.valeur ?? {}) as Record<string, unknown>;
    const version = String(Deno.env.get("META_API_VERSION") || cfg.api_version || "v21.0");
    const base = `https://graph.facebook.com/${version}`;
    const pageId = String(Deno.env.get("META_LEADS_PAGE_ID") || cfg.leads_page_id || PAGE_PAR_DEFAUT).trim();
    const formIds = String(cfg.leads_form_ids ?? "").split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);

    let jeton = String(Deno.env.get("META_LEADS_PAGE_TOKEN") || cfg.leads_page_token || "").trim();
    if (!jeton) {
      const jetonCompte = String(Deno.env.get("META_ACCESS_TOKEN") || cfg.access_token || "").trim();
      if (!jetonCompte) {
        return json({ ok: false, configured: false, message: "Jeton Meta absent (Paramètres › Publicité Meta › Prospects des formulaires)." });
      }
      // Utilisateur système : il obtient le jeton de la page qui lui est attribuée.
      const p = await graph<{ access_token?: string }>(
        `${base}/${pageId}?fields=access_token&access_token=${encodeURIComponent(jetonCompte)}`,
      ).catch(() => ({} as { access_token?: string }));
      jeton = p.access_token ?? jetonCompte;
    }
    const tok = `access_token=${encodeURIComponent(jeton)}`;

    // — Période : depuis la dernière synchro (avec recouvrement), sinon N jours —
    const { data: etatRow } = await sb.from("parametres").select("valeur").eq("cle", "meta_leads_etat").maybeSingle();
    const etat = (etatRow?.valeur ?? {}) as { derniere_synchro?: string };
    const jours = Number(corps.jours) > 0 && !estCron ? Math.min(90, Number(corps.jours)) : null;
    const depuis = jours
      ? Date.now() - jours * 86_400_000
      : etat.derniere_synchro
        ? new Date(etat.derniere_synchro).getTime() - RECOUVREMENT_MS
        : Date.now() - PREMIER_IMPORT_JOURS * 86_400_000;
    const depuisSec = Math.floor(depuis / 1000);

    // — Formulaires à lire —
    let formulaires: Formulaire[];
    if (formIds.length) {
      formulaires = await Promise.all(
        formIds.map((id) => graph<Formulaire>(`${base}/${id}?fields=id,name,status&${tok}`)),
      );
    } else {
      const tous = await toutLire<Formulaire>(`${base}/${pageId}/leadgen_forms?fields=id,name,status&limit=100&${tok}`);
      formulaires = tous.filter((f) => !FORMULAIRE_RECRUTEMENT.test(f.name ?? ""));
    }

    // — Prospects reçus sur la période —
    const filtre = encodeURIComponent(JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: depuisSec }]));
    const leads: { lead: Lead; form: Formulaire }[] = [];
    for (const f of formulaires) {
      const ls = await toutLire<Lead>(
        `${base}/${f.id}/leads?fields=id,created_time,field_data,ad_name,campaign_name,platform,is_organic&filtering=${filtre}&limit=100&${tok}`,
      );
      for (const lead of ls) leads.push({ lead, form: f });
    }
    // Plus ancien d'abord : si un prospect a déposé deux fois, la fiche porte la première demande.
    leads.sort((a, b) => a.lead.created_time.localeCompare(b.lead.created_time));

    // — Conseillers actifs (répartition tour à tour, comme l'import du Sheet) —
    const { data: cons } = await sb.from("profiles").select("id").eq("role", "conseiller").eq("actif", true);
    const conseillers = (cons ?? []).map((c: { id: string }) => c.id);
    let rr = 0;

    const { data: excl } = await sb.from("import_exclusions").select("external_id").eq("source", "contacts");
    const exclus = new Set((excl ?? []).map((e: { external_id: string }) => e.external_id));

    let crees = 0, releads = 0, ignores = 0;
    const vus = new Set<string>();
    for (const { lead, form } of leads) {
      const { v, autres } = lireChamps(lead.field_data ?? []);
      const complet = v.full_name ?? [v.first_name, v.last_name].filter(Boolean).join(" ");
      const { prenom, nom } = v.first_name || v.last_name
        ? { prenom: v.first_name ?? null, nom: v.last_name ?? v.first_name ?? "—" }
        : decouperNom(complet);
      const telephone = v.phone ? v.phone.replace(/^p:\s*/i, "").trim() : null;
      const cle = (v.email || telephone || `${prenom ?? ""} ${nom}`).toLowerCase().trim();
      if (!cle || cle === "—" || /test lead|dummy data/i.test(JSON.stringify(lead.field_data))) { ignores++; continue; }
      const externalId = `pros:${cle}`;
      if (exclus.has(externalId)) { ignores++; continue; }

      const origine = [
        `Formulaire Meta : ${form.name}`,
        lead.campaign_name ? `Campagne : ${lead.campaign_name}` : (lead.is_organic ? "Origine : organique" : ""),
        lead.ad_name ? `Annonce : ${lead.ad_name}` : "",
        lead.platform ? `Plateforme : ${lead.platform === "ig" ? "Instagram" : lead.platform === "fb" ? "Facebook" : lead.platform}` : "",
      ].filter(Boolean).join("\n");
      const reponses = autres.length ? `Réponses :\n${autres.join("\n")}` : "";
      const tagFormulaire = `meta: ${form.name}`.slice(0, 60);

      const { data: existant } = await sb.from("contacts")
        .select("id, notes, created_at, statut_prospect, tags").eq("external_id", externalId).maybeSingle();

      if (!existant) {
        if (vus.has(externalId)) continue;
        const entete = [v.company ? `Entreprise : ${v.company}` : "", v.job ? `Fonction : ${v.job}` : ""].filter(Boolean).join("\n");
        const { error } = await sb.from("contacts").insert({
          external_id: externalId,
          type: "prospect",
          nom, prenom,
          email: v.email ?? null,
          telephone,
          ville: v.city ?? null,
          statut_prospect: "nouveau",
          notes: [entete, origine, reponses].filter(Boolean).join("\n") || null,
          tags: ["nouveau prospect", tagFormulaire],
          owner_id: conseillers.length ? conseillers[rr++ % conseillers.length] : null,
          metadata: { source: "meta-leads", lead_id: lead.id, form_id: form.id, form_name: form.name, created_time: lead.created_time, field_data: lead.field_data ?? [] },
        });
        if (error) {
          if (error.code === "23505") { vus.add(externalId); continue; } // créé entre-temps (autre import)
          throw new Error(`contact ${externalId} : ${error.message}`);
        }
        vus.add(externalId);
        crees++;
        continue;
      }

      // Prospect déjà connu : ne note que les soumissions postérieures à sa création.
      if (new Date(lead.created_time) <= new Date(existant.created_at as string)) continue;
      const marqueur = `[relead ${lead.created_time.slice(0, 10)} · l:${lead.id}]`;
      const notes = (existant.notes as string | null) ?? "";
      if (notes.includes(`l:${lead.id}`)) continue;
      const maj: Record<string, unknown> = {
        notes: [notes, [`${marqueur} Nouvelle demande déposée via le formulaire Meta.`, origine, reponses].filter(Boolean).join("\n")]
          .filter(Boolean).join("\n"),
      };
      if (["", "non assigné", "perdu", "sans suite"].includes(((existant.statut_prospect as string | null) ?? "").trim())) {
        maj.statut_prospect = "nouveau";
      }
      const tags = (existant.tags as string[] | null) ?? [];
      const ajout = ["nouveau prospect", tagFormulaire].filter((t) => !tags.includes(t));
      if (ajout.length) maj.tags = [...tags, ...ajout];
      const { error } = await sb.from("contacts").update(maj).eq("id", existant.id);
      if (error) throw new Error(`relead ${externalId} : ${error.message}`);
      releads++;
    }

    await sb.from("parametres").upsert(
      { cle: "meta_leads_etat", valeur: { derniere_synchro: debut, formulaires: formulaires.map((f) => ({ id: f.id, name: f.name })) } },
      { onConflict: "cle" },
    );

    const resultat = { formulaires: formulaires.length, lus: leads.length, crees, releads, ignores };
    // Le cron ne journalise que les passages utiles (toutes les 5 min, sinon le journal déborde).
    if (!estCron || crees || releads) {
      await journaliser(sb, debut, true, `${crees} prospect(s) créé(s), ${releads} relead(s)`, resultat);
    }
    return json({ ok: true, configured: true, ...resultat });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await journaliser(sb, debut, false, message);
    return json({ ok: false, configured: true, error: message, meta: err instanceof ErreurMeta }, err instanceof ErreurMeta ? 200 : 500);
  }
});
