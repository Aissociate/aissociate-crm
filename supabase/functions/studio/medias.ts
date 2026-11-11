// Génération d'images et de vidéos pour le Studio IA (super-pouvoirs "media").
//
// Images : meta/muse-image via POST /api/v1/images, exécutée en tâche de fond
//   (EdgeRuntime.waitUntil) : la requête HTTP rend la main tout de suite, la page
//   interroge `media_statut`. Un modèle d'image qui « réfléchit » peut dépasser
//   la limite de 150 s d'une requête synchrone.
// Vidéos : minimax/hailuo-3-max via POST /api/v1/videos (job asynchrone). Chaque
//   `media_statut` interroge le job ; une fois terminé, le fichier est rapatrié
//   dans le bucket privé `studio-medias`.
// ⚠ En-têtes HTTP sortants : ASCII uniquement (cf. agent).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

export const MODELE_IMAGE = "meta/muse-image";
export const MODELE_VIDEO = "minimax/hailuo-3-max";
const BUCKET = "studio-medias";
const OR = "https://openrouter.ai/api/v1";
const IMAGE_DELAI_MAX_MS = 6 * 60_000;   // au-delà, une image « en cours » est déclarée en échec
const VIDEO_DELAI_MAX_MS = 30 * 60_000;
const FORMATS_IMAGE = ["1:1", "4:5", "16:9", "9:16", "3:4", "4:3"];
const FORMATS_VIDEO = ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"];

type Ws = { id: string; quota_images_mois?: number | null; quota_videos_mois?: number | null };
export type Media = {
  id: string; type: "image" | "video"; statut: "en_cours" | "pret" | "echec";
  url?: string | null; erreur?: string | null; mime?: string | null;
};

function entetes(apiKey: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json",
    "HTTP-Referer": "https://aissociate.re", "X-Title": "Aissociate Studio IA",
  };
}

function debutMois(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

/** Quota mensuel par type (null = illimité). Les échecs ne comptent pas. */
export async function quotaMediaAtteint(sb: SupabaseClient, ws: Ws, type: "image" | "video"): Promise<string | null> {
  const { data: w } = await sb.from("studio_workspaces").select("quota_images_mois, quota_videos_mois").eq("id", ws.id).single();
  const quota = type === "image" ? w?.quota_images_mois : w?.quota_videos_mois;
  if (quota == null) return null;
  const { count } = await sb.from("studio_medias").select("id", { count: "exact", head: true })
    .eq("workspace_id", ws.id).eq("type", type).neq("statut", "echec").gte("created_at", debutMois());
  return (count ?? 0) >= quota
    ? `Quota mensuel atteint (${quota} ${type === "image" ? "visuels" : "vidéos"}). Contactez Aissociate pour l'augmenter.`
    : null;
}

async function finir(sb: SupabaseClient, id: string, maj: Record<string, unknown>) {
  await sb.from("studio_medias").update({ ...maj, termine_at: new Date().toISOString() }).eq("id", id);
}

/** Lance la génération et renvoie l'id du média (statut en_cours). */
export async function lancerMedia(sb: SupabaseClient, apiKey: string, p: {
  wsId: string; userId: string; agentId: string; conversationId: string;
  type: "image" | "video"; prompt: string; format?: string; duree?: string;
}): Promise<{ id: string } | { erreur: string }> {
  const parametres: Record<string, unknown> = {};
  if (p.type === "image") {
    parametres.aspect_ratio = FORMATS_IMAGE.includes(p.format ?? "") ? p.format : "1:1";
  } else {
    parametres.aspect_ratio = FORMATS_VIDEO.includes(p.format ?? "") ? p.format : "9:16";
    parametres.duration = Math.min(10, Math.max(5, Number(p.duree) || 6));
    parametres.resolution = "768p";
  }
  const modele = p.type === "image" ? MODELE_IMAGE : MODELE_VIDEO;
  const { data: m, error } = await sb.from("studio_medias").insert({
    workspace_id: p.wsId, user_id: p.userId, agent_id: p.agentId, conversation_id: p.conversationId,
    type: p.type, modele, prompt: p.prompt.slice(0, 4000), parametres,
  }).select("id").single();
  if (error) return { erreur: error.message };

  if (p.type === "video") {
    const r = await fetch(`${OR}/videos`, {
      method: "POST", headers: entetes(apiKey),
      body: JSON.stringify({ model: modele, prompt: p.prompt.slice(0, 2000), ...parametres }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) {
      const erreur = `Vidéo refusée par OpenRouter (${r.status}) ${String(j?.error?.message ?? "").slice(0, 200)}`;
      await finir(sb, m.id, { statut: "echec", erreur });
      return { erreur };
    }
    await sb.from("studio_medias").update({ job_id: String(j.id) }).eq("id", m.id);
    return { id: m.id };
  }

  // Image : en tâche de fond, la requête rend la main immédiatement.
  const tache = genererImage(sb, apiKey, m.id, p.wsId, modele, p.prompt, parametres);
  // @ts-ignore EdgeRuntime est fourni par le runtime Supabase
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(tache); else await tache;
  return { id: m.id };
}

async function genererImage(
  sb: SupabaseClient, apiKey: string, id: string, wsId: string, modele: string,
  prompt: string, parametres: Record<string, unknown>,
) {
  try {
    const r = await fetch(`${OR}/images`, {
      method: "POST", headers: entetes(apiKey),
      body: JSON.stringify({ model: modele, prompt: prompt.slice(0, 4000), ...parametres }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`OpenRouter ${r.status} ${String(j?.error?.message ?? "").slice(0, 200)}`);
    const img = j?.data?.[0] ?? {};
    let octets: Uint8Array;
    let mime = "image/png";
    if (img.b64_json) {
      octets = Uint8Array.from(atob(String(img.b64_json)), (c) => c.charCodeAt(0));
    } else if (img.url) {
      const dl = await fetch(String(img.url));
      if (!dl.ok) throw new Error(`Téléchargement de l'image impossible (${dl.status})`);
      mime = dl.headers.get("content-type") ?? mime;
      octets = new Uint8Array(await dl.arrayBuffer());
    } else {
      throw new Error("Réponse sans image");
    }
    if (octets[0] === 0xff && octets[1] === 0xd8) mime = "image/jpeg";
    else if (octets[0] === 0x52 && octets[1] === 0x49) mime = "image/webp";
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const chemin = `${wsId}/${id}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(chemin, octets, { contentType: mime, upsert: true });
    if (error) throw new Error(`Stockage : ${error.message}`);
    await finir(sb, id, { statut: "pret", chemin, mime, cout: j?.usage?.cost ?? null });
  } catch (e) {
    console.error("[studio] image:", e instanceof Error ? e.message : String(e));
    await finir(sb, id, { statut: "echec", erreur: e instanceof Error ? e.message : String(e) });
  }
}

/** Fait avancer un média (vidéo) puis renvoie son état, avec une URL signée s'il est prêt. */
export async function statutMedia(sb: SupabaseClient, apiKey: string, wsId: string, id: string): Promise<Media | null> {
  const { data: m } = await sb.from("studio_medias")
    .select("id, type, statut, job_id, chemin, mime, erreur, created_at").eq("id", id).eq("workspace_id", wsId).maybeSingle();
  if (!m) return null;

  if (m.statut === "en_cours") {
    const age = Date.now() - new Date(m.created_at).getTime();
    if (m.type === "image" && age > IMAGE_DELAI_MAX_MS) {
      await finir(sb, m.id, { statut: "echec", erreur: "Délai dépassé" });
      m.statut = "echec"; m.erreur = "Délai dépassé";
    } else if (m.type === "video" && m.job_id) {
      try {
        const r = await fetch(`${OR}/videos/${encodeURIComponent(m.job_id)}`, { headers: entetes(apiKey) });
        const j = await r.json().catch(() => ({}));
        if (j.status === "completed") {
          const source = (j.urls?.[0] as string | undefined) ?? (j.unsigned_urls?.[0] as string | undefined)
            ?? `${OR}/videos/${encodeURIComponent(m.job_id)}/content`;
          const dl = await fetch(source, j.urls?.[0] ? {} : { headers: entetes(apiKey) });
          if (!dl.ok) throw new Error(`Téléchargement de la vidéo impossible (${dl.status})`);
          const octets = new Uint8Array(await dl.arrayBuffer());
          const chemin = `${wsId}/${m.id}.mp4`;
          const { error } = await sb.storage.from(BUCKET).upload(chemin, octets, { contentType: "video/mp4", upsert: true });
          if (error) throw new Error(`Stockage : ${error.message}`);
          await finir(sb, m.id, { statut: "pret", chemin, mime: "video/mp4", cout: j.usage?.cost ?? null });
          Object.assign(m, { statut: "pret", chemin, mime: "video/mp4" });
        } else if (["failed", "cancelled", "expired"].includes(j.status) || age > VIDEO_DELAI_MAX_MS) {
          const erreur = String(j.error ?? (age > VIDEO_DELAI_MAX_MS ? "Délai dépassé" : j.status));
          await finir(sb, m.id, { statut: "echec", erreur });
          Object.assign(m, { statut: "echec", erreur });
        }
      } catch (e) {
        // Erreur passagère : on réessaiera au prochain passage.
        console.error("[studio] video:", e instanceof Error ? e.message : String(e));
      }
    }
  }
  return {
    id: m.id, type: m.type, statut: m.statut, mime: m.mime,
    erreur: m.statut === "echec" ? (m.erreur ?? "Échec de la génération") : null,
    url: m.statut === "pret" && m.chemin ? await urlSignee(sb, m.chemin) : null,
  };
}

export async function urlSignee(sb: SupabaseClient, chemin: string): Promise<string | null> {
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(chemin, 3600);
  return data?.signedUrl ?? null;
}
