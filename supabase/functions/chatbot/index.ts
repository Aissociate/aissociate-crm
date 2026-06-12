// Supabase Edge Function — Assistant interne (chatbot) sur l'activité.
// - Identifie l'utilisateur et son rôle (JWT) côté serveur.
// - Choisit le PROMPT MAÎTRE selon le rôle (direction / conseiller).
// - Rassemble le CONTEXTE selon les DROITS configurés (base documentaire,
//   contacts, entreprises, pipeline, dossiers, devis, formations, agenda,
//   recrutement, leads du site, finances). Direction : tout le périmètre par
//   défaut ; conseiller : portée limitée à ses affectations sauf scope=all,
//   recrutement et leads exclus.
// - Appelle OpenRouter, renvoie la réponse + les SOURCES citées ([D#] =
//   documents de la base documentaire activés pour ce chat).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_DIR = "Tu es l'assistant interne de l'organisme de formation. Tu réponds à la direction sur l'activité. Cite tes sources entre crochets (ex. [D1]). En français, factuel.";
const DEFAULT_CONS = "Tu es l'assistant interne destiné aux conseillers. Tu réponds à partir de la documentation et des dossiers accessibles. Cite tes sources entre crochets (ex. [D1]). En français, factuel.";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type Droits = {
  documents?: boolean; contacts?: boolean; dossiers?: boolean; formations?: boolean;
  pipeline?: boolean; entreprises?: boolean; devis?: boolean; agenda?: boolean;
  recrutement?: boolean; leads?: boolean; finances?: boolean; scope?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { question, history } = await req.json();
    if (!question || typeof question !== "string") return json({ error: "Question manquante" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1) Authentifier l'utilisateur et lire son rôle (jamais fourni par le client).
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Non authentifié" }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE);
    const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const role = (profile?.role as string) ?? "conseiller";
    const isDirection = role === "admin" || role === "directeur_commercial";

    // 2) Config chatbot (prompts + droits) et IA (clé/modèle).
    const { data: cbRow } = await sb.from("parametres").select("valeur").eq("cle", "chatbot").maybeSingle();
    const cb = (cbRow?.valeur ?? {}) as Record<string, unknown>;
    const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
    const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
    const apiKey = Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key;
    const model = ai.model || "anthropic/claude-opus-4.8";
    if (!apiKey) return json({ error: "Clé OpenRouter absente (Paramètres > IA)" }, 400);

    const allDroits = (cb.droits ?? {}) as Record<string, Droits>;
    const d: Droits = isDirection ? (allDroits.direction ?? {}) : (allDroits.conseiller ?? {});
    const masterPrompt = isDirection
      ? ((cb.prompt_direction as string) || DEFAULT_DIR)
      : ((cb.prompt_conseiller as string) || DEFAULT_CONS);
    const scopeAll = isDirection || d.scope === "all";
    const finances = isDirection ? (d.finances !== false) : (d.finances === true);
    // Direction : TOUT le périmètre par défaut (chaque domaine reste désactivable).
    // Conseiller : données CRM courantes par défaut (portée limitée à ses
    // affectations sauf scope=all) ; recrutement et leads réservés direction.
    const allow = (key: keyof Droits, directionOnly = false): boolean => {
      if (directionOnly && !isDirection) return false;
      return d[key] !== false;
    };

    // 3) Rassembler le contexte selon les droits.
    const ctx: string[] = [];
    const docSources: { n: number; id: string; label: string; url: string | null }[] = [];

    if (allow("documents")) {
      // Seuls les documents EXPLICITEMENT activés pour CE chat (coche admin).
      const { data: rawDocs } = await sb.from("documents")
        .select("id, titre, categorie, description, tags, fichier_url, contenu_texte, dossier, version, parent_id")
        .eq(isDirection ? "chat_direction" : "chat_conseiller", true)
        .limit(200);
      // Ne garder que la dernière version de chaque lignée documentaire
      // (« Nouvelle version » duplique le document avec ses droits chat).
      const latest = new Map<string, Record<string, unknown>>();
      for (const x of (rawDocs ?? [])) {
        const key = (x.parent_id as string) ?? (x.id as string);
        const prev = latest.get(key);
        if (!prev || Number(x.version ?? 1) > Number(prev.version ?? 1)) latest.set(key, x);
      }
      const docs = [...latest.values()];
      if (docs?.length) {
        const lines = docs.map((x, i) => {
          docSources.push({ n: i + 1, id: x.id as string, label: (x.titre as string) ?? "Document", url: (x.fichier_url as string) ?? null });
          const tags = Array.isArray(x.tags) && x.tags.length ? ` — tags: ${(x.tags as string[]).join(", ")}` : "";
          const dossier = x.dossier ? ` — dossier: ${x.dossier}` : "";
          const body = [x.description, x.contenu_texte].filter(Boolean).join("\n");
          return `[D${i + 1}] « ${x.titre} » (${x.categorie ?? "—"})${dossier}${tags}\n${body}`.trim();
        });
        ctx.push("# Base documentaire\n" + lines.join("\n\n"));
      }
    }

    if (allow("contacts")) {
      let cq = sb.from("contacts")
        .select("nom, prenom, email, telephone, ville, statut_prospect, besoin_resume, formation_envisagee, financement_envisage, owner_id, responsable_id")
        .limit(300);
      if (!scopeAll) cq = cq.or(`owner_id.eq.${user.id},responsable_id.eq.${user.id}`);
      const { data: cs } = await cq;
      if (cs?.length) {
        ctx.push("# Contacts\n" + cs.map((c) =>
          `${c.prenom ?? ""} ${c.nom} <${c.email ?? "—"}> ${c.telephone ?? ""} — ville: ${c.ville ?? "—"}; statut: ${c.statut_prospect ?? "—"}; besoin: ${c.besoin_resume ?? "—"}; formation: ${c.formation_envisagee ?? "—"}${finances ? `; financement: ${c.financement_envisage ?? "—"}` : ""}`.trim()
        ).join("\n"));
      }
    }

    if (allow("dossiers")) {
      let dq = sb.from("dossiers").select("reference, intitule, statut, montant_demande, montant_accorde, owner_id").limit(300);
      if (!scopeAll) dq = dq.eq("owner_id", user.id);
      const { data: ds } = await dq;
      if (ds?.length) {
        ctx.push("# Dossiers\n" + ds.map((x) =>
          `${x.reference} — ${x.intitule} (statut: ${x.statut})${finances ? `; demandé: ${x.montant_demande ?? 0}€, accordé: ${x.montant_accorde ?? 0}€` : ""}`
        ).join("\n"));
      }
    }

    if (allow("formations")) {
      const { data: fs } = await sb.from("formations").select("*").limit(200);
      if (fs?.length) {
        ctx.push("# Catalogue formations\n" + fs.map((x: Record<string, unknown>) =>
          `${x.intitule} (${x.duree_heures ?? "?"}h${finances && x.prix ? `, ${x.prix}€` : ""})`
        ).join("\n"));
      }
    }

    if (allow("pipeline")) {
      let oq = sb.from("opportunites")
        .select("titre, stage, montant, probabilite, date_cloture_prev, owner_id")
        .order("created_at", { ascending: false }).limit(300);
      if (!scopeAll) oq = oq.eq("owner_id", user.id);
      const { data: os } = await oq;
      if (os?.length) {
        ctx.push("# Pipeline (opportunités)\n" + os.map((x) =>
          `${x.titre} — étape: ${x.stage}${finances ? `; montant: ${x.montant ?? 0}€` : ""}; probabilité: ${x.probabilite ?? "—"}%${x.date_cloture_prev ? `; clôture prévue: ${x.date_cloture_prev}` : ""}`
        ).join("\n"));
      }
    }

    if (allow("entreprises")) {
      let eq = sb.from("entreprises")
        .select("raison_sociale, siret, secteur, effectif, ville, owner_id").limit(300);
      if (!scopeAll) eq = eq.eq("owner_id", user.id);
      const { data: es } = await eq;
      if (es?.length) {
        ctx.push("# Entreprises\n" + es.map((x) =>
          `${x.raison_sociale}${x.ville ? ` (${x.ville})` : ""} — secteur: ${x.secteur ?? "—"}; effectif: ${x.effectif ?? "—"}${x.siret ? `; SIRET: ${x.siret}` : ""}`
        ).join("\n"));
      }
    }

    if (allow("devis")) {
      let vq = sb.from("devis")
        .select("numero, statut, date_emission, date_validite, objet, total_ttc, owner_id")
        .order("date_emission", { ascending: false }).limit(200);
      if (!scopeAll) vq = vq.eq("owner_id", user.id);
      const { data: vs } = await vq;
      if (vs?.length) {
        ctx.push("# Devis\n" + vs.map((x) =>
          `${x.numero} — statut: ${x.statut}; émis le ${x.date_emission}${x.date_validite ? ` (validité ${x.date_validite})` : ""}${finances ? `; total TTC: ${x.total_ttc ?? 0}€` : ""}${x.objet ? `; objet: ${x.objet}` : ""}`
        ).join("\n"));
      }
    }

    if (allow("agenda")) {
      const { data: ss } = await sb.from("sessions_formation")
        .select("titre, date_debut, date_fin, lieu, modalite, formateur")
        .order("date_debut", { ascending: false }).limit(150);
      if (ss?.length) {
        ctx.push("# Sessions de formation (calendrier)\n" + ss.map((x) =>
          `${x.titre} — du ${x.date_debut}${x.date_fin ? ` au ${x.date_fin}` : ""}; modalité: ${x.modalite ?? "—"}${x.lieu ? `; lieu: ${x.lieu}` : ""}${x.formateur ? `; formateur: ${x.formateur}` : ""}`
        ).join("\n"));
      }
      const { data: trs } = await sb.from("formateurs")
        .select("nom, prenom, specialites, statut").limit(100);
      if (trs?.length) {
        ctx.push("# Formateurs\n" + trs.map((x) =>
          `${x.prenom ?? ""} ${x.nom} — statut: ${x.statut ?? "—"}${x.specialites ? `; spécialités: ${x.specialites}` : ""}`.trim()
        ).join("\n"));
      }
    }

    if (allow("recrutement", true)) {
      const { data: ks } = await sb.from("candidats").select("*").limit(200);
      if (ks?.length) {
        ctx.push("# Recrutement (candidats)\n" + ks.map((x: Record<string, unknown>) =>
          `${x.prenom ?? ""} ${x.nom} — statut: ${x.statut ?? "—"}, score: ${x.score_total ?? "—"}`
        ).join("\n"));
      }
    }

    if (allow("leads", true)) {
      const { data: ls } = await sb.from("contact_requests")
        .select("first_name, last_name, email, request_type, status, source, created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (ls?.length) {
        ctx.push("# Leads du site (demandes de contact)\n" + ls.map((x) =>
          `${x.first_name ?? ""} ${x.last_name ?? ""} <${x.email ?? "—"}> — demande: ${x.request_type ?? "—"}; statut: ${x.status ?? "—"}; source: ${x.source ?? "—"}; reçu le ${String(x.created_at).slice(0, 10)}`.trim()
        ).join("\n"));
      }
    }

    const context = ctx.join("\n\n---\n\n").slice(0, 100000);

    // 4) Appel IA.
    const systemPrompt = masterPrompt +
      `\n\nDate du jour : ${new Date().toISOString().slice(0, 10)}.` +
      "\n\nUtilise UNIQUEMENT le contexte ci-dessous comme source de vérité. " +
      "Cite chaque source entre crochets (ex. [D1] pour un document, ou la référence du dossier / le nom du contact). " +
      "Si l'information ne s'y trouve pas, dis-le.\n\n=== CONTEXTE ===\n" +
      (context || "(aucune donnée accessible avec les droits actuels)");

    const hist = Array.isArray(history)
      ? history.slice(-8).map((h: { role?: string; content?: string }) => ({
          role: h.role === "assistant" ? "assistant" : "user",
          content: String(h.content ?? "").slice(0, 4000),
        }))
      : [];

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aissociate.crm",
        "X-Title": "CRM Formation AIssociate",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...hist, { role: "user", content: question.slice(0, 4000) }],
        temperature: 0.2,
      }),
    });
    if (!resp.ok) return json({ error: `OpenRouter ${resp.status}: ${(await resp.text()).slice(0, 300)}` }, 502);
    const data = await resp.json();
    const answer = (data?.choices?.[0]?.message?.content as string) ?? "";

    // 5) Sources = documents réellement cités [D#] dans la réponse.
    const sources = docSources.filter((s) => answer.includes(`[D${s.n}]`)).map((s) => ({ label: s.label, url: s.url }));

    return json({ ok: true, answer, role: isDirection ? "direction" : "conseiller", sources });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
