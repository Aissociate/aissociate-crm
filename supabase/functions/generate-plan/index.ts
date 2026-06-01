// Supabase Edge Function — génération IA d'un plan de formation (OpenRouter)
// La clé API est lue UNIQUEMENT côté serveur : secret Supabase OPENROUTER_API_KEY
// en priorité, sinon parametres.ai.openrouter_key (via service_role). Jamais
// exposée au navigateur.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_PROMPT =
  "Tu es un ingénieur pédagogique. À partir des données JSON d'un plan de formation, " +
  "rédige un plan structuré et professionnel à présenter à un partenaire/financeur. " +
  "Réponds UNIQUEMENT par un objet JSON valide " +
  '{"titre": string, "sections": [{"titre": string, "contenu": string}]}. En français.';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { plan } = await req.json();
    if (!plan) return json({ error: "Données du plan manquantes" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Config IA : parametres.ai (lue via service_role)
    const { data: aiRow } = await sb.from("parametres").select("valeur").eq("cle", "ai").maybeSingle();
    const ai = (aiRow?.valeur ?? {}) as Record<string, string>;
    const apiKey = Deno.env.get("OPENROUTER_API_KEY") || ai.openrouter_key;
    const model = ai.model || "anthropic/claude-opus-4.8";
    const systemPrompt = ai.plan_prompt || DEFAULT_PROMPT;

    if (!apiKey) {
      return json({ error: "Clé OpenRouter absente (secret OPENROUTER_API_KEY ou Paramètres > IA)" }, 400);
    }

    // Organisme (en-tête du document)
    const { data: orgRow } = await sb.from("parametres").select("valeur").eq("cle", "organisme").maybeSingle();
    const organisme = (orgRow?.valeur ?? {}) as Record<string, string>;

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
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Données du plan (JSON) :\n" + JSON.stringify(plan) },
        ],
        temperature: 0.4,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return json({ error: `OpenRouter ${resp.status}: ${t.slice(0, 300)}` }, 502);
    }
    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";

    return json({ content, organisme });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
