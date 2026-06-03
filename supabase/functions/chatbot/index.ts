// Supabase Edge Function — Assistant interne (chatbot) sur l'activité.
// - Identifie l'utilisateur et son rôle (JWT) côté serveur.
// - Choisit le PROMPT MAÎTRE selon le rôle (direction / conseiller).
// - Rassemble le CONTEXTE selon les DROITS configurés (base documentaire,
//   contacts, dossiers, formations, recrutement, finances), avec portée
//   limitée aux données du conseiller le cas échéant.
// - Appelle OpenRouter, renvoie la réponse + les SOURCES citées.
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

type Droits = { documents?: boolean; contacts?: boolean; dossiers?: boolean; formations?: boolean; recrutement?: boolean; finances?: boolean; scope?: string };

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

    // 3) Rassembler le contexte selon les droits.
    const ctx: string[] = [];
    const docSources: { n: number; id: string; label: string; url: string | null }[] = [];

    if (d.documents !== false) {
      const { data: docs } = await sb.from("documents")
        .select("id, titre, categorie, description, tags, fichier_url, contenu_texte").limit(200);
      if (docs?.length) {
        const lines = docs.map((x, i) => {
          docSources.push({ n: i + 1, id: x.id as string, label: (x.titre as string) ?? "Document", url: (x.fichier_url as string) ?? null });
          const tags = Array.isArray(x.tags) && x.tags.length ? ` — tags: ${(x.tags as string[]).join(", ")}` : "";
          const body = [x.description, x.contenu_texte].filter(Boolean).join("\n");
          return `[D${i + 1}] « ${x.titre} » (${x.categorie ?? "—"})${tags}\n${body}`.trim();
        });
        ctx.push("# Base documentaire\n" + lines.join("\n\n"));
      }
    }

    if (d.contacts !== false) {
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

    if (d.dossiers !== false) {
      let dq = sb.from("dossiers").select("reference, intitule, statut, montant_demande, montant_accorde, owner_id").limit(300);
      if (!scopeAll) dq = dq.eq("owner_id", user.id);
      const { data: ds } = await dq;
      if (ds?.length) {
        ctx.push("# Dossiers\n" + ds.map((x) =>
          `${x.reference} — ${x.intitule} (statut: ${x.statut})${finances ? `; demandé: ${x.montant_demande ?? 0}€, accordé: ${x.montant_accorde ?? 0}€` : ""}`
        ).join("\n"));
      }
    }

    if (d.formations !== false) {
      const { data: fs } = await sb.from("formations").select("*").limit(200);
      if (fs?.length) {
        ctx.push("# Catalogue formations\n" + fs.map((x: Record<string, unknown>) =>
          `${x.intitule} (${x.duree_heures ?? "?"}h${finances && x.prix ? `, ${x.prix}€` : ""})`
        ).join("\n"));
      }
    }

    if (isDirection && d.recrutement) {
      const { data: ks } = await sb.from("candidats").select("*").limit(200);
      if (ks?.length) {
        ctx.push("# Recrutement (candidats)\n" + ks.map((x: Record<string, unknown>) =>
          `${x.prenom ?? ""} ${x.nom} — statut: ${x.statut ?? "—"}, score: ${x.score_total ?? "—"}`
        ).join("\n"));
      }
    }

    const context = ctx.join("\n\n---\n\n").slice(0, 60000);

    // 4) Appel IA.
    const systemPrompt = masterPrompt +
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
