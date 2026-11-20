// Guide de prise en main, en surimpression : affiché à la première connexion, puis seulement
// à la demande (bouton « Revoir le guide » en bas de la colonne de gauche).
// Chaque étape éclaire un élément réel de l'écran quand il est visible (attribut data-tuto) ;
// sinon (menu replié sur mobile, par exemple) la carte s'affiche au centre.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

export type EtapeTuto = { cible?: string; titre: string; texte: string };

export const ETAPES_TUTORIEL: EtapeTuto[] = [
  {
    titre: 'Bienvenue dans votre Studio',
    texte: "Voici votre équipe d'agents IA. Ce guide vous montre en une minute où trouver chaque chose. Vous pouvez le fermer à tout moment et le revoir plus tard.",
  },
  {
    cible: '/studio',
    titre: 'Vous gardez la main',
    texte: "« Aujourd'hui » rassemble ce qui attend votre accord : vous validez, modifiez ou refusez. Rien n'est envoyé ni publié sans vous. La pastille indique le nombre de décisions en attente.",
  },
  {
    cible: 'mission',
    titre: 'Demandez à Léa',
    texte: "Décrivez ce que vous voulez avec vos mots, ou dictez-le. Léa confie la demande au bon spécialiste : un e-mail, un post, un courrier, une synthèse.",
  },
  {
    cible: '/studio/equipe',
    titre: 'Votre équipe',
    texte: "Chaque agent a son métier et ses « super-pouvoirs » : des missions prêtes à lancer. Hors de son domaine, il passe la main au bon collègue.",
  },
  {
    cible: '/studio/routines',
    titre: 'Les routines',
    texte: "Les tâches planifiées font travailler vos agents seuls aux heures choisies. Vous y trouvez aussi la veille de votre secteur et les demandes par e-mail.",
  },
  {
    cible: '/studio/documents',
    titre: 'Vos documents',
    texte: 'Déposez votre plaquette, vos tarifs, votre charte : vos agents les consultent pour répondre avec vos vraies informations. Vos contenus gardés et vos contacts sont ici aussi.',
  },
  {
    cible: '/studio/reglages',
    titre: 'Réglages et connecteurs',
    texte: "Reliez votre messagerie, votre agenda et vos réseaux sociaux, présentez votre entreprise (la fiche lue par tous vos agents), et retrouvez votre consommation, votre abonnement et l'arrêt d'urgence.",
  },
  {
    cible: 'guide',
    titre: "C'est à vous",
    texte: 'Ce guide reste disponible ici, en bas de la colonne. Commencez par présenter votre entreprise, puis confiez une première demande à Léa.',
  },
];

type Rect = { top: number; left: number; width: number; height: number };

/** Premier élément visible portant data-tuto=cible (le menu existe en deux exemplaires : colonne et tiroir mobile). */
function rectCible(cible?: string): Rect | null {
  if (!cible) return null;
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tuto="${cible}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

const MARGE = 6;
const LARGEUR_CARTE = 340;

/** Position de la carte : à droite de la cible si la place existe, sinon dessous, sinon dessus ; centrée sans cible. */
export function placerCarte(r: Rect | null, vw: number, vh: number, hauteur = 230): { top: number; left: number } | null {
  if (!r) return null;
  const borne = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
  if (r.left + r.width + 16 + LARGEUR_CARTE <= vw) {
    return { left: r.left + r.width + 16, top: borne(r.top, 12, vh - hauteur - 12) };
  }
  const left = borne(r.left, 12, vw - LARGEUR_CARTE - 12);
  if (r.top + r.height + 12 + hauteur <= vh) return { left, top: r.top + r.height + 12 };
  if (r.top - hauteur - 12 >= 12) return { left, top: r.top - hauteur - 12 };
  // Ni dessous ni dessus : la carte se cale en bas de l'écran (elle peut alors recouvrir la cible).
  return { left, top: Math.max(12, vh - hauteur - 12) };
}

export default function Tutoriel({ onFermer }: { onFermer: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // Hauteur réelle de la carte (elle varie avec le texte) : sert à la garder dans l'écran.
  const carte = useRef<HTMLDivElement>(null);
  const [hauteur, setHauteur] = useState(260);
  const etape = ETAPES_TUTORIEL[i];
  const derniere = i === ETAPES_TUTORIEL.length - 1;

  const mesurer = useCallback(() => {
    const cible = document.querySelector<HTMLElement>(`[data-tuto="${etape.cible}"]`);
    cible?.scrollIntoView({ block: 'nearest' });
    setRect(rectCible(etape.cible));
  }, [etape.cible]);

  useLayoutEffect(() => { mesurer(); }, [mesurer]);
  useLayoutEffect(() => { if (carte.current) setHauteur(carte.current.offsetHeight); }, [i, rect]);
  useEffect(() => {
    window.addEventListener('resize', mesurer);
    window.addEventListener('scroll', mesurer, true);
    return () => { window.removeEventListener('resize', mesurer); window.removeEventListener('scroll', mesurer, true); };
  }, [mesurer]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
      if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, ETAPES_TUTORIEL.length - 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [onFermer]);

  const position = placerCarte(rect, window.innerWidth, window.innerHeight, hauteur);

  return (
    <div className="fixed inset-0 z-50 font-sans" role="dialog" aria-modal="true" aria-label="Guide de prise en main">
      {rect ? (
        // Le « trou » éclaire la cible ; l'ombre portée assombrit tout le reste.
        <div data-tuto-eclairage className="pointer-events-none absolute rounded-xl ring-2 ring-orange-400 transition-all duration-200"
          style={{ top: rect.top - MARGE, left: rect.left - MARGE, width: rect.width + 2 * MARGE, height: rect.height + 2 * MARGE, boxShadow: '0 0 0 9999px rgba(15,15,15,0.62)' }} />
      ) : <div className="absolute inset-0 bg-neutral-950/60" />}
      {/* Capte les clics hors de la carte : le guide ne se ferme que par ses boutons ou Échap. */}
      <div className="absolute inset-0" />
      <div ref={carte}
        className={position ? 'absolute rounded-2xl bg-white p-5 shadow-2xl' : 'absolute left-1/2 top-1/2 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl'}
        style={position ? { ...position, width: LARGEUR_CARTE, maxWidth: 'calc(100vw - 24px)' } : { maxWidth: 420 }}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-orange-600">Étape {i + 1} sur {ETAPES_TUTORIEL.length}</p>
          <button onClick={onFermer} aria-label="Fermer le guide" className="-mr-1 -mt-1 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><X className="h-4 w-4" /></button>
        </div>
        <h2 className="mt-1 text-lg font-semibold text-neutral-900">{etape.titre}</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{etape.texte}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          {derniere ? <span /> : <button onClick={onFermer} className="text-xs text-neutral-500 underline">Passer le guide</button>}
          <div className="flex gap-2">
            {i > 0 && (
              <button onClick={() => setI(i - 1)} className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:border-neutral-400">
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
            )}
            <button autoFocus onClick={() => (derniere ? onFermer() : setI(i + 1))}
              className="inline-flex items-center gap-1 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
              {derniere ? 'Commencer' : <>Suivant <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
