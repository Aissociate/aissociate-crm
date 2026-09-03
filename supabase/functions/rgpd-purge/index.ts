// Edge Function — purge / archivage RGPD hebdomadaire (cron dimanche 02:00 UTC).
// Délais configurables dans parametres (cle='rgpd') :
//   mois_candidats   (déf. 24) : candidats « refuse » non modifiés depuis N mois
//                    → suppression des CV / documents (storage) puis des lignes.
//   mois_audio       (déf. 12) : conversations mobiles plus anciennes que N mois
//                    → suppression des segments audio (bucket conversations),
//                    la transcription et le compte-rendu sont conservés.
//   mois_page_views  (déf. 24) : lignes analytics plus anciennes que N mois.
// Journalise chaque exécution dans job_runs.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function logRun(sb: SupabaseClient, startedAt: string, ok: boolean, message: string, detail?: unknown) {
  try {
    await sb.from("job_runs").insert({
      fonction: "rgpd-purge", started_at: startedAt, finished_at: new Date().toISOString(),
      ok, message, detail: detail ?? null,
    });
  } catch { /* jamais bloquant */ }
}

const moisAvant = (mois: number) => new Date(Date.now() - mois * 30.44 * 86400_000).toISOString();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  const startedAt = new Date().toISOString();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: cfgRow } = await sb.from("parametres").select("valeur").eq("cle", "rgpd").maybeSingle();
    const cfg = (cfgRow?.valeur ?? {}) as Record<string, number>;
    const moisCandidats = Number(cfg.mois_candidats) || 24;
    const moisAudio = Number(cfg.mois_audio) || 12;
    const moisPageViews = Number(cfg.mois_page_views) || 24;

    // 1) Candidats refusés depuis plus de N mois : documents storage + lignes.
    const { data: candidats } = await sb.from("candidats")
      .select("id, cv_url, document_identite")
      .eq("statut", "refuse").lt("updated_at", moisAvant(moisCandidats));
    let candidatsPurges = 0;
    for (const c of candidats ?? []) {
      const { data: docs } = await sb.from("candidat_documents").select("fichier_url").eq("candidat_id", c.id);
      const fichiers = [
        ...((docs ?? []).map((d) => d.fichier_url)),
        c.cv_url, c.document_identite,
      ].filter((f): f is string => Boolean(f) && !/^https?:\/\//i.test(String(f)));
      if (fichiers.length) {
        // CV dans le bucket 'cv', autres documents dans 'recrutement'/'coffre' :
        // on tente les buckets connus (remove ignore les chemins inexistants).
        await sb.storage.from("cv").remove(fichiers);
        await sb.storage.from("recrutement").remove(fichiers);
        await sb.storage.from("coffre").remove(fichiers);
      }
      await sb.from("candidat_documents").delete().eq("candidat_id", c.id);
      const { error } = await sb.from("candidats").delete().eq("id", c.id);
      if (!error) candidatsPurges++;
    }

    // 2) Audio des conversations mobiles anciennes : on efface les segments du
    //    bucket, on garde transcription + compte-rendu (traçabilité métier).
    const { data: convs } = await sb.from("conversations")
      .select("id, segments").lt("created_at", moisAvant(moisAudio))
      .not("segments", "is", null);
    let audiosPurges = 0;
    for (const conv of convs ?? []) {
      const segments = (Array.isArray(conv.segments) ? conv.segments : []) as { path?: string }[];
      const paths = segments.map((s) => s.path).filter((p): p is string => Boolean(p));
      if (!paths.length) continue;
      const { error } = await sb.storage.from("conversations").remove(paths);
      if (!error) {
        await sb.from("conversations").update({ segments: [] }).eq("id", conv.id);
        audiosPurges++;
      }
    }

    // 3) Analytics : page_views au-delà du délai.
    const { count: pageViews } = await sb.from("page_views")
      .delete({ count: "exact" }).lt("created_at", moisAvant(moisPageViews));

    const message = `${candidatsPurges} candidat(s), ${audiosPurges} audio(s), ${pageViews ?? 0} page_view(s) purgés`;
    await logRun(sb, startedAt, true, message, {
      candidats: candidatsPurges, audios: audiosPurges, page_views: pageViews ?? 0,
      delais: { moisCandidats, moisAudio, moisPageViews },
    });
    return json({ ok: true, candidats: candidatsPurges, audios: audiosPurges, page_views: pageViews ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRun(sb, startedAt, false, message);
    return json({ error: message }, 500);
  }
});
