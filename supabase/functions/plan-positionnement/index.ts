// Supabase Edge Function — plan de formation rédigé par l'IA à partir des
// réponses au test de positionnement d'un groupe.
//
// Entrée : formation du catalogue, positionnements retenus, entreprise,
// durée voulue. L'IA adapte objectifs et modules au niveau mesuré du groupe
// (score par domaine, synthèse, poste, attentes). Le résultat est enregistré
// comme plan de formation (créé, ou mis à jour si `planId` est fourni), et les
// positionnements sont liés au plan (`positionnements.plan_id`).
//
// La durée n'est pas négociable par l'IA : c'est une donnée contractuelle
// reprise dans la convention. Le code la fixe et répartit les heures des
// modules si le modèle s'en écarte.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const DOMAINES: Record<string, string> = {
  comprendre: "Compréhension de l'IA générative",
  formuler: "Formulation des demandes",
  cadre: "Cadre, données et responsabilité",
  avance: "Pratiques avancées",
};

type PlanIA = {
  nom?: string;
  objectifs?: string[];
  modules?: { titre?: string; contenu?: string; duree_heures?: number }[];
  justification?: string;
};

// Modèles à raisonnement : retirer les réflexions puis extraire le dernier
// objet JSON équilibré. Jamais de repli sur le texte brut.
function stripReasoning(s: string): string {
  return (s ?? "")
    .replace(/<(think|thinking|reasoning|analysis)>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(think|thinking|reasoning|analysis)>[\s\S]*$/i, "")
    .replace(/^[\s\S]*?<\/(think|thinking|reasoning|analysis)>/i, "")
    .replace(/```(?:json)?/gi, "")
    .trim();
}
function extractJson(raw: string): PlanIA | null {
  const s = stripReasoning(raw);
  const ok = (o: unknown): o is PlanIA => !!o && typeof o === "object" && Array.isArray((o as PlanIA).modules);
  const tryParse = (t: string) => { try { return JSON.parse(t); } catch { return null; } };
  const direct = tryParse(s);
  if (ok(direct)) return direct;
  const candidats: string[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "{") continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { candidats.push(s.slice(i, j + 1)); i = j; break; } }
    }
  }
  for (const c of candidats.reverse()) { const o = tryParse(c); if (ok(o)) return o; }
  return null;
}

/** Heures entières (ou demi-heures) des modules, ramenées exactement à `total`. */
function repartir(heures: number[], total: number): number[] {
  if (!heures.length || total <= 0) return heures.map(() => 0);
  const somme = heures.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const base = somme > 0 ? heures.map((h) => (h > 0 ? h : 0) * total / somme) : heures.map(() => total / heures.length);
  const arrondi = base.map((h) => Math.max(0.5, Math.round(h * 2) / 2));
  let ecart = Math.round((total - arrondi.reduce((a, b) => a + b, 0)) * 2) / 2;
  // Corrige l'écart d'arrondi sur les plus gros modules.
  const ordre = arrondi.map((h, i) => [h, i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  for (let k = 0; ecart !== 0 && k < 200; k++) {
    const i = ordre[k % ordre.length];
    const pas = ecart > 0 ? 0.5 : -0.5;
    if (arrondi[i] + pas >= 0.5) { arrondi[i] += pas; ecart -= pas; }
  }
  return arrondi;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json();
    const formationId: string | undefined = body.formationId;
    const positionnementIds: string[] = Array.isArray(body.positionnementIds) ? body.positionnementIds : [];
    if (!formationId) return json({ error: "Formation manquante" }, 400);
    if (!positionnementIds.length) return json({ error: "Aucune réponse au positionnement sélectionnée" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: formation } = await sb.from("formations").select("*").eq("id", formationId).maybeSingle();
    if (!formation) return json({ error: "Formation introuvable" }, 404);
    const { data: reponses } = await sb.from("positionnements")
      .select("id, nom, poste, secteur, organisation, niveau, pct, score, synthese, reponses")
      .in("id", positionnementIds);
    if (!reponses?.length) return json({ error: "Réponses au positionnement introuvables" }, 404);
    const entreprise = body.entrepriseId
      ? (await sb.from("entreprises").select("raison_sociale, secteur, effectif, naf").eq("id", body.entrepriseId).maybeSingle()).data
      : null;

    // Contact du plan : seulement un membre de l'entreprise (jamais un prospect
    // étranger, qui finirait « représentant » dans la convention).
    let contactId: string | null = body.contactId ?? null;
    if (contactId && body.entrepriseId) {
      const { data: ct } = await sb.from("contacts").select("entreprise_id").eq("id", contactId).maybeSingle();
      if (ct?.entreprise_id !== body.entrepriseId) contactId = null;
    }

    const dureeH = Number(body.dureeH) > 0 ? Number(body.dureeH) : Number(formation.duree_heures ?? 0);
    const nbJours = Number(body.nbJours) > 0 ? Number(body.nbJours) : (dureeH ? Math.ceil(dureeH / 7) : 0);

    const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
    const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
    const apiKey = (Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key || "").trim();
    if (!apiKey) return json({ error: "Clé OpenRouter absente (secret OPENROUTER_API_KEY ou Paramètres > IA)" }, 400);
    // Même modèle que les plans : rapide, non raisonnant (limite de 150 s).
    const model = ai.model_plan || ai.model || "anthropic/claude-sonnet-4.5";

    // Profil du groupe : ce que l'IA doit lire, sans les données inutiles.
    const groupe = reponses.map((r) => {
      const domaines = (r.score as { domaines?: Record<string, { pct?: number }> } | null)?.domaines ?? {};
      return {
        participant: r.nom, poste: r.poste, secteur: r.secteur,
        niveau: r.niveau, reussite_pct: r.pct,
        par_domaine: Object.fromEntries(Object.entries(domaines).map(([k, v]) => [DOMAINES[k] ?? k, `${v?.pct ?? 0} %`])),
        synthese: (r.synthese ?? "").slice(0, 1500),
        reponses_libres: JSON.stringify(r.reponses ?? {}).slice(0, 2500),
      };
    });

    const systeme = [
      "Tu es ingénieur pédagogique dans un organisme de formation certifié Qualiopi.",
      "À partir d'une formation du catalogue et des résultats du test de positionnement d'un groupe d'apprenants,",
      "tu rédiges un plan de formation adapté : objectifs opérationnels et modules ajustés au niveau mesuré",
      "(renforcer les domaines faibles, ne pas s'attarder sur les domaines maîtrisés, tenir compte des postes et des attentes).",
      `DURÉE IMPOSÉE : ${dureeH} heures${nbJours ? ` sur ${nbJours} jour(s)` : ""}. La somme des duree_heures des modules doit valoir exactement ${dureeH}.`,
      "Reste dans le périmètre de la formation du catalogue : même intitulé, même thème.",
      'Réponds UNIQUEMENT par un objet JSON : {"nom": string, "objectifs": string[], "modules": [{"titre": string, "contenu": string, "duree_heures": number}], "justification": string}.',
      "objectifs : 3 à 6 objectifs commençant par un verbe d'action à l'infinitif (Identifier, Utiliser, Rédiger…).",
      "modules : 3 à 8 modules ; contenu en une ou deux phrases, sans Markdown.",
      "justification : 2 à 4 phrases expliquant en quoi le plan répond au positionnement du groupe (preuve Qualiopi, indicateur 4).",
      "En français. Aucun préambule, aucune balise de réflexion, aucun bloc de code.",
    ].join(" ");
    const utilisateur = [
      "Formation du catalogue (JSON) :\n" + JSON.stringify({
        intitule: formation.intitule, objectifs: formation.objectifs, programme: formation.programme,
        prerequis: formation.prerequis, public_vise: formation.public_vise, duree_heures: formation.duree_heures,
      }),
      entreprise ? "Entreprise (JSON) :\n" + JSON.stringify(entreprise) : "",
      `Positionnement du groupe (${groupe.length} apprenant(s), JSON) :\n` + JSON.stringify(groupe),
      body.consignes ? `Consignes de l'organisme : ${String(body.consignes).slice(0, 1000)}` : "",
    ].filter(Boolean).join("\n\n");

    const appel = async (rappel: string) => {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json",
          "HTTP-Referer": "https://aissociate.crm", "X-Title": "CRM Formation AIssociate",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systeme + rappel }, { role: "user", content: utilisateur }],
          temperature: 0.4, reasoning: { exclude: true }, response_format: { type: "json_object" },
        }),
      });
      if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const d = await r.json();
      return String(d?.choices?.[0]?.message?.content ?? "");
    };
    let plan = extractJson(await appel(""));
    if (!plan) plan = extractJson(await appel(" RAPPEL : réponds par le seul objet JSON demandé, rien avant, rien après."));
    if (!plan) return json({ error: "La réponse de l'IA n'est pas exploitable. Relancez la génération." }, 502);

    const modules = (plan.modules ?? [])
      .map((m) => ({ titre: String(m?.titre ?? "").trim(), contenu: String(m?.contenu ?? "").trim(), h: Number(m?.duree_heures) || 0 }))
      .filter((m) => m.titre || m.contenu);
    if (!modules.length) return json({ error: "L'IA n'a proposé aucun module. Relancez la génération." }, 502);
    const heures = repartir(modules.map((m) => m.h), dureeH);
    const objectifs = (plan.objectifs ?? []).map((o) => String(o).trim().replace(/[.;]$/, "")).filter(Boolean);
    const fmtH = (h: number) => `${String(h).replace(".", ",")} h`;

    // Enregistrement au format des plans : une ligne « Titre (Nh) — contenu »
    // par module, objectifs séparés par « ; ».
    const ligne = {
      nom: String(plan.nom || `Plan — ${formation.intitule}`).slice(0, 200),
      formation_id: formationId,
      entreprise_id: body.entrepriseId ?? null,
      contact_id: contactId,
      objectifs: objectifs.join(" ; "),
      contenu: modules.map((m, i) => `${m.titre}${dureeH ? ` (${fmtH(heures[i])})` : ""} — ${m.contenu}`.trim()),
      duree_heures: dureeH,
      modalite: ["presentiel", "distanciel", "mixte", "e-learning"].includes(body.modalite) ? body.modalite : "presentiel",
      dates_session: body.datesSession ? String(body.datesSession) : null,
      owner_id: body.userId ?? null,
    };
    let planId: string | null = body.planId ?? null;
    if (planId) {
      const { error } = await sb.from("plans_formation").update(ligne).eq("id", planId);
      if (error) return json({ error: error.message }, 500);
    } else {
      const { data, error } = await sb.from("plans_formation")
        .insert({ ...ligne, statut: "brouillon", version: 1 }).select("id").single();
      if (error) return json({ error: error.message }, 500);
      planId = data.id;
    }

    // Lien réponses ↔ plan (preuve : le plan découle du positionnement).
    const { error: lienErr } = await sb.from("positionnements").update({ plan_id: planId }).in("id", positionnementIds);
    if (lienErr) console.error("lien positionnements", lienErr.message);

    return json({
      ok: true, planId, nom: ligne.nom, objectifs, duree_heures: dureeH, nbJours,
      modules: modules.map((m, i) => ({ titre: m.titre, contenu: m.contenu, duree_heures: heures[i] })),
      justification: String(plan.justification ?? ""),
      lie: !lienErr,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
