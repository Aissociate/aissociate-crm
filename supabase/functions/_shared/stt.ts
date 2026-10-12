// Transcription vocale (dictée de l'assistant, conversations enregistrées).
//
// Modèle par défaut : Gemini, appelé en chat/completions avec la pièce audio.
// Contrairement aux modèles de transcription « bruts » (whisper, gpt-4o-*-
// transcribe), on peut lui donner du CONTEXTE : vocabulaire du métier, noms
// des contacts et des formations, consigne de retirer les hésitations. C'est
// ce qui fait la différence sur les noms propres et les sigles (OPCO, AGEFICE…).
//
// Repli automatique sur un modèle de transcription classique si Gemini échoue
// ou si le format n'est pas accepté (le webm de Chrome, notamment : le
// navigateur convertit normalement en WAV avant l'envoi).
//
// `ai.model_stt` (Paramètres › IA) choisit le modèle : un id « whisper » ou
// « transcribe » passe par /audio/transcriptions, tout autre par le chat.

export const MODELE_STT_DEFAUT = "google/gemini-3.8-flash";
export const MODELE_STT_SECOURS = "openai/gpt-4o-mini-transcribe";

/** Formats audio acceptés en `input_audio` par le chat (doc OpenRouter). */
const FORMATS_CHAT = new Set(["wav", "mp3", "aiff", "aac", "ogg", "flac", "m4a"]);

/** Sigles et termes du métier, à orthographier tels quels. */
const VOCABULAIRE_METIER = [
  "AIssociate", "Qualiopi", "OPCO", "OPCO Atlas", "OPCO EP", "Akto", "Constructys", "Uniformation", "AFDAS",
  "AGEFICE", "FAF", "FAFCEA", "FIFPL", "CPF", "Mon Compte Formation", "France Travail", "PTP", "BPF",
  "La Réunion", "Saint-Denis", "Saint-Pierre", "Saint-Paul", "Le Port",
  "IA générative", "devis", "convention", "émargement", "positionnement", "Kanban", "pipeline",
];

export type ModeStt = "dictee" | "entretien";

const CONSIGNES: Record<ModeStt, string> = {
  dictee: [
    "Transcris fidèlement cette dictée en français : c'est une consigne donnée à l'assistant d'un CRM d'organisme de formation.",
    "Retire les hésitations (euh, hum, ben), les faux départs et les répétitions involontaires, mais ne reformule pas, ne résume pas et n'ajoute rien.",
    "Écris les nombres, dates et heures en chiffres (3 personnes, jeudi 9 h, 1 500 €).",
  ].join(" "),
  entretien: [
    "Transcris intégralement cet extrait d'entretien en français (appel ou rendez-vous entre un conseiller en formation et un client).",
    "Conserve tout le contenu ; retire seulement les hésitations (euh, hum). Va à la ligne à chaque changement d'interlocuteur, en commençant la ligne par « — ».",
    "Si un passage est inaudible, écris [inaudible] plutôt que de deviner.",
  ].join(" "),
};

export type DemandeStt = {
  apiKey: string;
  /** Audio en base64. */
  audio: string;
  /** wav, mp3, ogg, m4a, webm… */
  format: string;
  mode: ModeStt;
  /** `ai.model_stt` ; vide = défaut. */
  modele?: string | null;
  /** Noms propres propres au contexte (contacts, formations…). */
  vocabulaire?: string[];
  titre?: string;
};

export type ReponseStt = { ok: true; texte: string; modele: string } | { ok: false; erreur: string };

const estModeleTranscription = (m: string) => /whisper|transcribe/i.test(m);

function entetes(apiKey: string, titre: string): Record<string, string> {
  // Valeurs d'en-tête : ASCII uniquement (ByteString), sinon fetch lève avant l'envoi.
  return {
    "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json",
    "HTTP-Referer": "https://aissociate.crm", "X-Title": titre,
  };
}

async function viaTranscription(d: DemandeStt, modele: string): Promise<ReponseStt> {
  const resp = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST",
    headers: entetes(d.apiKey, d.titre ?? "CRM AIssociate"),
    body: JSON.stringify({ model: modele, language: "fr", input_audio: { data: d.audio, format: d.format } }),
  });
  if (!resp.ok) return { ok: false, erreur: `Transcription indisponible (${modele}, OpenRouter ${resp.status}).` };
  const out = await resp.json().catch(() => null);
  const texte = typeof out?.text === "string" ? out.text.trim() : "";
  return texte ? { ok: true, texte, modele } : { ok: false, erreur: "Transcription vide : audio inaudible." };
}

async function viaChat(d: DemandeStt, modele: string): Promise<ReponseStt> {
  const vocabulaire = [...new Set([...VOCABULAIRE_METIER, ...(d.vocabulaire ?? [])].map((v) => v.trim()).filter(Boolean))].slice(0, 400);
  const consigne = [
    CONSIGNES[d.mode],
    `Orthographie exactement ces noms et sigles s'ils sont prononcés : ${vocabulaire.join(", ")}.`,
    "Réponds UNIQUEMENT par le texte transcrit, sans guillemets, sans commentaire ni introduction.",
  ].join("\n");
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: entetes(d.apiKey, d.titre ?? "CRM AIssociate"),
    body: JSON.stringify({
      model: modele,
      temperature: 0,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: consigne },
          { type: "input_audio", input_audio: { data: d.audio, format: d.format } },
        ],
      }],
    }),
  });
  if (!resp.ok) return { ok: false, erreur: `Transcription indisponible (${modele}, OpenRouter ${resp.status}).` };
  const out = await resp.json().catch(() => null);
  const brut = out?.choices?.[0]?.message?.content;
  const texte = (typeof brut === "string" ? brut : "").trim().replace(/^["«]\s*|\s*["»]$/g, "");
  return texte ? { ok: true, texte, modele } : { ok: false, erreur: "Transcription vide : audio inaudible." };
}

/** Transcrit avec le modèle configuré, puis le modèle de secours si besoin. */
export async function transcrire(d: DemandeStt): Promise<ReponseStt> {
  const modele = (d.modele ?? "").trim() || MODELE_STT_DEFAUT;
  const format = d.format.toLowerCase();
  let premier: ReponseStt | null = null;

  if (estModeleTranscription(modele)) premier = await viaTranscription({ ...d, format }, modele);
  else if (FORMATS_CHAT.has(format)) premier = await viaChat({ ...d, format }, modele);
  if (premier?.ok) return premier;

  if (modele === MODELE_STT_SECOURS) return premier ?? { ok: false, erreur: "Transcription impossible." };
  const secours = await viaTranscription({ ...d, format }, MODELE_STT_SECOURS);
  if (secours.ok) return secours;
  return premier ?? secours;
}
