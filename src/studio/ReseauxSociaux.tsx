// Studio › Connecteurs › réseaux sociaux en un clic (Zernio) : Facebook, Instagram, LinkedIn, TikTok.
// Le serveur rattache chaque compte au profil Zernio de l'espace ; le navigateur ne voit jamais la clé.
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Plus, RefreshCw, Unplug } from 'lucide-react';
import { useStudio } from './StudioApp';
import { appel } from './api';
import { Bouton, cx } from './composants';

export type Reseau = 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'twitter' | 'threads' | 'pinterest' | 'googlebusiness';
export type CompteReseau = { id: string; reseau: Reseau; nom: string; identifiant: string; photo: string | null; lien: string | null; a_reconnecter: boolean };
type Etat = { configure: boolean; comptes: CompteReseau[] };

export const NOMS_RESEAUX: Record<Reseau, string> = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok',
  twitter: 'X', threads: 'Threads', pinterest: 'Pinterest', googlebusiness: 'Google Business',
};
const AIDE: Record<Reseau, string> = {
  facebook: 'Choisissez la page entreprise à relier pendant la connexion.',
  instagram: 'Compte professionnel (Business ou Créateur) requis.',
  linkedin: 'Profil personnel, ou page entreprise dont vous êtes administrateur.',
  tiktok: 'Les vidéos arrivent dans votre boîte TikTok, à finaliser dans l\'application.',
  twitter: 'Votre compte X (ex-Twitter). Publications de 280 caractères au plus.',
  threads: 'Le compte Threads relié à votre Instagram.',
  pinterest: 'Choisissez le tableau où publier pendant la connexion. Une image est requise.',
  googlebusiness: 'Choisissez votre établissement pendant la connexion.',
};

/** Message lisible au retour de la fenêtre d'autorisation (paramètres ajoutés par Zernio). */
function messageRetour(p: URLSearchParams): { ok: boolean; texte: string } | null {
  const reseau = p.get('reseau') as Reseau | null;
  if (!reseau || !(reseau in NOMS_RESEAUX)) return null;
  const nom = NOMS_RESEAUX[reseau];
  if (p.get('error')) {
    const e = p.get('error');
    const texte = e === 'oauth_denied' ? `Connexion ${nom} annulée.`
      : e === 'no_facebook_pages' ? 'Aucune page Facebook n\'a été autorisée : relancez la connexion et cochez la page de l\'entreprise.'
      : `Connexion ${nom} impossible : ${p.get('error_message') || e}.`;
    return { ok: false, texte };
  }
  if (p.get('connected') || p.get('accountId')) {
    const manque = p.get('missing_permissions');
    return { ok: !manque, texte: manque ? `${nom} connecté, mais certains droits n'ont pas été accordés (${manque}) : reconnectez-le en acceptant tout.` : `${nom} connecté${p.get('username') ? ` (${p.get('username')})` : ''}.` };
  }
  return null;
}

export function useReseaux() {
  const { gerer } = useStudio();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [enCours, setEnCours] = useState('');
  const [erreur, setErreur] = useState('');
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);

  const charger = useCallback(async () => {
    try { setEtat(await appel<Etat>('reseaux_etat')); }
    catch (e) { setErreur(gerer(e)); setEtat({ configure: false, comptes: [] }); }
  }, [gerer]);

  useEffect(() => {
    // Retour de la fenêtre d'autorisation : message, puis adresse nettoyée.
    const p = new URLSearchParams(window.location.search);
    const m = messageRetour(p);
    if (m) { setRetour(m); window.history.replaceState(null, '', window.location.pathname); }
    charger();
  }, [charger]);

  const connecter = async (reseau: Reseau, reconnecter?: string) => {
    setErreur(''); setEnCours(reconnecter ?? reseau);
    try {
      const { lien } = await appel<{ lien: string }>('reseaux_connecter', { reseau, reconnecter });
      window.location.href = lien;
    } catch (e) { setErreur(gerer(e)); setEnCours(''); }
  };

  const deconnecter = async (c: CompteReseau) => {
    if (!confirm(`Déconnecter ${NOMS_RESEAUX[c.reseau]} (${c.nom}) ? Vos agents ne pourront plus y publier.`)) return;
    setEnCours(c.id);
    try { setEtat(await appel<Etat>('reseaux_deconnecter', { compte_id: c.id })); }
    catch (e) { setErreur(gerer(e)); } finally { setEnCours(''); }
  };

  return { etat, enCours, erreur, retour, charger, connecter, deconnecter };
}
export type Reseaux = ReturnType<typeof useReseaux>;

/** Comptes d'un réseau connectés à l'espace, avec Connecter / Reconnecter / Déconnecter. */
export function ComptesReseau({ reseaux, reseau }: { reseaux: Reseaux; reseau: Reseau }) {
  const { me } = useStudio();
  const proprietaire = me.user.role === 'proprietaire';
  const comptes = (reseaux.etat?.comptes ?? []).filter((c) => c.reseau === reseau);
  const occupe = Boolean(reseaux.enCours);
  return (
    <div className="mt-3 space-y-2">
      {comptes.map((c) => (
        <div key={c.id} className="rounded-xl bg-neutral-50 px-3 py-2">
          <div className="flex items-center gap-2">
            {c.photo ? <img src={c.photo} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              : <span className="h-6 w-6 shrink-0 rounded-full bg-neutral-200" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.nom}</p>
              <p className={cx('flex items-center gap-1 text-xs', c.a_reconnecter ? 'text-amber-700' : 'text-emerald-700')}>
                {c.a_reconnecter ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                <span className="truncate">{c.a_reconnecter ? 'À reconnecter' : `Connecté${c.identifiant && c.identifiant !== c.nom ? ` · @${c.identifiant}` : ''}`}</span>
              </p>
            </div>
            {c.lien && <a href={c.lien} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700" aria-label={`Ouvrir ${c.nom}`}><ExternalLink className="h-4 w-4" /></a>}
            {proprietaire && (
              <>
                <button onClick={() => reseaux.connecter(reseau, c.id)} disabled={occupe} title="Reconnecter (ressaisir le compte)"
                  className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={`Reconnecter ${c.nom}`}>
                  {reseaux.enCours === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
                <button onClick={() => reseaux.deconnecter(c)} disabled={occupe} className="rounded-lg p-1.5 text-neutral-400 hover:text-red-600" aria-label={`Déconnecter ${c.nom}`}>
                  <Unplug className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          {c.a_reconnecter && proprietaire && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">Vos agents ne peuvent plus publier sur ce compte. Cliquez sur l'icône de reconnexion.</p>
          )}
        </div>
      ))}
      {comptes.length === 0 && <p className="text-xs text-neutral-500">{AIDE[reseau]}</p>}
      {proprietaire && (
        <Bouton variante={comptes.length ? 'clair' : 'noir'} className="px-3 py-1.5" disabled={occupe} onClick={() => reseaux.connecter(reseau)}>
          {reseaux.enCours === reseau ? <Loader2 className="h-4 w-4 animate-spin" /> : comptes.length ? <Plus className="h-4 w-4" /> : null}
          {comptes.length ? 'Ajouter un compte' : 'Connecter'}
        </Bouton>
      )}
    </div>
  );
}
