// État partagé de la conversation avec Sam (Edge Function `studio-demo`) : la démo intégrée à
// /agents-ia et la bulle présente sur toutes les pages affichent la même conversation.
// L'historique reste dans le navigateur (sessionStorage) : il suit le visiteur de page en page.
import { useSyncExternalStore } from 'react';

export type Msg = { role: 'user' | 'assistant'; content: string };
export type EtatSam = {
  conversation: string; messages: Msg[]; enregistre: boolean;
  /** Nombre de compléments ajoutés à la fiche CRM après l'accord. */
  complements: number; attente: boolean; erreur: string;
};

const URL_FN = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/studio-demo`;
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
const CLE = 'aissociate.sam-demo';

const ACCUEIL_STUDIO = "Bonjour, je suis Sam, l'agent commercial d'Aissociate — et un agent IA du Studio, vous êtes donc en pleine démonstration. Quelle est votre activité, et qu'est-ce qui vous prend le plus de temps en ce moment ?";
const ACCUEIL_SITE = "Bonjour, je suis Sam, l'agent IA d'Aissociate. Une question sur nos formations, nos agents IA ou un projet sur mesure ? Je vous réponds tout de suite, et je peux vous faire rappeler par un conseiller.";

/** Suggestions de départ, selon la page d'où écrit le visiteur. */
export function suggestions(page: string): string[] {
  if (page.startsWith('/agents-ia')) return ["Je suis artisan, je n'ai pas le temps pour mes réseaux", 'Combien coûtent deux agents ?', 'Puis-je essayer gratuitement ?'];
  if (page.startsWith('/formations') || page.startsWith('/aides')) return ['Comment financer une formation ?', 'Je veux être rappelé par un conseiller', "C'est quoi, vos agents IA ?"];
  return ['Que proposez-vous aux TPE ?', "C'est quoi, vos agents IA ?", 'Je veux être rappelé par un conseiller'];
}

const page = () => (typeof window === 'undefined' ? '/' : window.location.pathname);
const neuf = (): EtatSam => ({
  conversation: crypto.randomUUID(),
  messages: [{ role: 'assistant', content: page().startsWith('/agents-ia') ? ACCUEIL_STUDIO : ACCUEIL_SITE }],
  enregistre: false, complements: 0, attente: false, erreur: '',
});

function charger(): EtatSam {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLE) ?? 'null') as Partial<EtatSam> | null;
    if (s?.conversation && Array.isArray(s.messages)) {
      return { conversation: s.conversation, messages: s.messages, enregistre: !!s.enregistre, complements: s.complements ?? 0, attente: false, erreur: '' };
    }
  } catch { /* stockage indisponible */ }
  return neuf();
}

let etat: EtatSam | null = null;
const abonnes = new Set<() => void>();
const lire = () => (etat ??= charger());
function poser(e: EtatSam) {
  etat = e;
  try { sessionStorage.setItem(CLE, JSON.stringify({ conversation: e.conversation, messages: e.messages, enregistre: e.enregistre, complements: e.complements })); } catch { /* stockage indisponible */ }
  abonnes.forEach((f) => f());
}
const abonner = (f: () => void) => { abonnes.add(f); return () => { abonnes.delete(f); }; };

export function useSam(): EtatSam {
  return useSyncExternalStore(abonner, lire, lire);
}

export function recommencer() { poser(neuf()); }

export async function envoyer(texte: string) {
  const e = lire();
  const t = texte.trim();
  if (!t || e.attente) return;
  const messages: Msg[] = [...e.messages, { role: 'user', content: t.slice(0, 2000) }];
  poser({ ...e, messages, attente: true, erreur: '' });
  try {
    const r = await fetch(URL_FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}` },
      // Le message d'accueil est affiché par la page : il n'est pas renvoyé au modèle.
      body: JSON.stringify({ conversation: e.conversation, messages: messages.slice(1), page: page() }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.reponse) throw new Error(j.error ?? 'Sam ne répond pas pour le moment.');
    const c = lire();
    // La conversation a été recommencée pendant l'attente : la réponse n'a plus sa place.
    if (c.conversation !== e.conversation) return;
    poser({
      ...c, attente: false, messages: [...messages, { role: 'assistant', content: String(j.reponse) }],
      enregistre: c.enregistre || j.prospect_enregistre === true,
      complements: c.complements + (j.fiche_completee === true ? 1 : 0),
    });
  } catch (err) {
    const c = lire();
    if (c.conversation !== e.conversation) return;
    poser({ ...c, attente: false, erreur: err instanceof Error ? err.message : 'Erreur' });
  }
}

// ── Mise en forme des réponses : liens cliquables et gras ────────────────────
export type Bout = { t: 'texte'; v: string } | { t: 'gras'; v: string } | { t: 'lien'; v: string; href: string; interne: boolean };

const RE = /(\*\*[^*\n]+\*\*|https?:\/\/[^\s<>()[\]]+|(?:www\.)?aissociate\.re(?:\/[^\s<>()[\]]*)?|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|0\d(?:[ .]?\d{2}){4})/g;

/** Découpe une réponse de Sam en texte, gras et liens (URL, e-mail, téléphone). */
export function decouper(texte: string): Bout[] {
  const bouts: Bout[] = [];
  let i = 0;
  for (const m of texte.matchAll(RE)) {
    const brut = m[0];
    const debut = m.index ?? 0;
    if (debut > i) bouts.push({ t: 'texte', v: texte.slice(i, debut) });
    i = debut + brut.length;
    if (brut.startsWith('**')) { bouts.push({ t: 'gras', v: brut.slice(2, -2) }); continue; }
    if (brut.includes('@') && !brut.startsWith('http')) { bouts.push({ t: 'lien', v: brut, href: `mailto:${brut}`, interne: false }); continue; }
    if (/^0\d/.test(brut)) { bouts.push({ t: 'lien', v: brut, href: `tel:+262${brut.replace(/\D/g, '').slice(1)}`, interne: false }); continue; }
    // La ponctuation qui termine la phrase ne fait pas partie de l'adresse.
    const fin = brut.match(/[.,;:!?…»"']+$/)?.[0] ?? '';
    const url = fin ? brut.slice(0, -fin.length) : brut;
    const complet = url.startsWith('http') ? url : `https://${url}`;
    let interne = false; let href = complet;
    try {
      const u = new URL(complet);
      if (/^(www\.)?aissociate\.re$/.test(u.hostname)) { interne = true; href = `${u.pathname}${u.search}${u.hash}`; }
    } catch { /* adresse illisible : laissée telle quelle */ }
    bouts.push({ t: 'lien', v: url.replace(/^https?:\/\//, ''), href, interne });
    if (fin) bouts.push({ t: 'texte', v: fin });
  }
  if (i < texte.length) bouts.push({ t: 'texte', v: texte.slice(i) });
  return bouts;
}

/** Lien vers l'ouverture d'espace (stage gratuit) cité dans un message (affiché en bouton sous la bulle). */
export function lienEssai(texte: string): string | null {
  return /aissociate\.re\/studio\/demarrer/.test(texte) ? '/studio/demarrer?depuis=sam' : null;
}
