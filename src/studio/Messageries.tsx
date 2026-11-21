// Studio › Connecteurs › messagerie, agenda et fichiers en un clic (Zernio) :
// Google (Gmail, Agenda, Drive), Microsoft (Outlook, calendrier, OneDrive) ou toute
// autre messagerie (IMAP). Le serveur rattache chaque compte au profil Zernio de l'espace.
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, FolderOpen, Loader2, Plus, RefreshCw, Unplug } from 'lucide-react';
import { AgentsConnecteur, cleZernio } from './AccesAgents';
import { useStudio } from './StudioApp';
import { appel } from './api';
import { Bouton, cx } from './composants';

export type Fournisseur = 'google' | 'microsoft' | 'imap';
export type Quoi = 'google' | 'microsoft' | 'email';
type Zone = 'email' | 'calendar' | 'files';
export type Boite = { id: string; fournisseur: Fournisseur; adresse: string; nom: string; zones: Zone[]; photo: string | null; a_reconnecter: boolean };
type Etat = { configure: boolean; boites: Boite[] };

const NOMS: Record<Quoi, string> = { google: 'Google', microsoft: 'Microsoft', email: 'Votre messagerie' };
const ZONES: Record<Zone, string> = { email: 'E-mails', calendar: 'Agenda', files: 'Fichiers' };
const AIDE: Record<Quoi, string> = {
  google: 'Gmail ou Google Workspace : e-mails, agenda et Drive en une connexion.',
  microsoft: 'Outlook.com ou Microsoft 365 : e-mails, calendrier et OneDrive en une connexion.',
  email: 'OVH, Infomaniak, IONOS, iCloud… : saisissez votre adresse, la page vous guide (mot de passe d\'application).',
};
// eslint-disable-next-line react-refresh/only-export-components
export const fournisseurDe = (q: Quoi): Fournisseur => (q === 'email' ? 'imap' : q);
/** Action d'un compte connecté : icône et libellé visible (une icône seule ne se devine pas). */
// eslint-disable-next-line react-refresh/only-export-components
export const CL_ACTION = 'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50';

/** Message lisible au retour de la page de connexion (paramètres ajoutés par Zernio). */
function messageRetour(p: URLSearchParams): { ok: boolean; texte: string } | null {
  if (p.get('drive')) {
    if (p.get('status') === 'picked') {
      const n = (p.get('fileIds') ?? '').split(',').filter(Boolean).length;
      return { ok: true, texte: `${n} fichier${n > 1 ? 's' : ''} Drive accessible${n > 1 ? 's' : ''} à vos agents.` };
    }
    return p.get('status') === 'cancelled' ? { ok: false, texte: 'Aucun fichier choisi.' } : null;
  }
  const quoi = p.get('boite') as Quoi | null;
  if (!quoi || !(quoi in NOMS)) return null;
  const nom = quoi === 'email' ? 'Messagerie' : NOMS[quoi];
  const erreur = p.get('error') || (p.get('status') === 'error' ? 'erreur' : '');
  if (erreur) {
    const texte = erreur === 'oauth_denied' || erreur === 'access_denied' ? `Connexion ${nom} annulée.`
      : erreur === 'no_access_granted' ? 'Aucune autorisation accordée : relancez la connexion en laissant les cases cochées.'
      : `Connexion ${nom} impossible : ${p.get('error_message') || erreur}.`;
    return { ok: false, texte };
  }
  if (p.get('connected') || p.get('accountId') || p.get('status')) {
    const manque = p.get('missing_permissions');
    const qui = p.get('email') || p.get('username');
    return {
      ok: !manque,
      texte: manque ? `${nom} connecté, mais certains accès n'ont pas été accordés (${manque}) : reconnectez-le en cochant tout.`
        : p.get('mailboxNotice') === 'mailbox_not_available' ? `${nom} connecté, mais ce compte n'a pas de boîte e-mail Microsoft : seuls les fichiers sont accessibles.`
        : `${nom} connecté${qui ? ` (${qui})` : ''}.`,
    };
  }
  return null;
}

export function useMessageries() {
  const { gerer } = useStudio();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [enCours, setEnCours] = useState('');
  const [erreur, setErreur] = useState('');
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  const [invitation, setInvitation] = useState<{ quoi: Quoi; url: string } | null>(null);

  const charger = useCallback(async () => {
    try { setEtat(await appel<Etat>('bureau_etat')); }
    catch (e) { setErreur(gerer(e)); setEtat({ configure: false, boites: [] }); }
  }, [gerer]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const m = messageRetour(p);
    if (m) { setRetour(m); window.history.replaceState(null, '', window.location.pathname); }
    charger();
  }, [charger]);

  const aller = async (cle: string, action: string, corps: Record<string, unknown>) => {
    setErreur(''); setEnCours(cle);
    try { window.location.href = (await appel<{ lien: string }>(action, corps)).lien; }
    catch (e) { setErreur(gerer(e)); setEnCours(''); }
  };
  const connecter = (quoi: Quoi, reconnecter?: string) => aller(reconnecter ?? quoi, 'bureau_connecter', { quoi, reconnecter });
  const choisirFichiers = (b: Boite) => aller(`drive:${b.id}`, 'drive_choisir', { compte_id: b.id });

  const deconnecter = async (b: Boite) => {
    if (!confirm(`Déconnecter ${b.adresse || b.nom} ? Vos agents n'auront plus accès à ces e-mails, agenda et fichiers.`)) return;
    setEnCours(b.id);
    try { setEtat(await appel<Etat>('bureau_deconnecter', { compte_id: b.id })); }
    catch (e) { setErreur(gerer(e)); } finally { setEnCours(''); }
  };

  const inviter = async (quoi: Quoi) => {
    setErreur('');
    try {
      const { url } = await appel<{ url: string }>('connexion_invitation', { cible: quoi });
      setInvitation({ quoi, url });
      try { await navigator.clipboard.writeText(url); } catch { /* copie manuelle */ }
    } catch (e) { setErreur(gerer(e)); }
  };

  return { etat, enCours, erreur, retour, invitation, charger, connecter, deconnecter, choisirFichiers, inviter };
}
export type Messageries = ReturnType<typeof useMessageries>;

/** Comptes d'un fournisseur connectés à l'espace, avec Connecter / Reconnecter / Déconnecter. */
export function ComptesMessagerie({ m, quoi }: { m: Messageries; quoi: Quoi }) {
  const { me } = useStudio();
  const proprietaire = me.user.role === 'proprietaire';
  const boites = (m.etat?.boites ?? []).filter((b) => b.fournisseur === fournisseurDe(quoi));
  const occupe = Boolean(m.enCours);
  return (
    <div className="mt-3 space-y-2">
      {boites.map((b) => (
        <div key={b.id} className="rounded-xl bg-neutral-50 px-3 py-2">
          <div className="flex items-center gap-2">
            {b.photo ? <img src={b.photo} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
              : <span className="h-6 w-6 shrink-0 rounded-full bg-neutral-200" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{b.adresse || b.nom}</p>
              <p className={cx('flex items-center gap-1 text-xs', b.a_reconnecter ? 'text-amber-700' : 'text-emerald-700')}>
                {b.a_reconnecter ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                <span className="truncate">{b.a_reconnecter ? 'À reconnecter' : b.zones.map((z) => ZONES[z]).join(' · ')}</span>
              </p>
            </div>
          </div>
          <AgentsConnecteur cle={cleZernio(b.id)} nom={b.adresse || b.nom} />
          {proprietaire && (
            <div className="mt-2 flex flex-wrap gap-1">
              <button onClick={() => m.connecter(quoi, b.id)} disabled={occupe} title="Ressaisir le compte ou étendre les accès"
                className={CL_ACTION} aria-label={`Reconnecter ${b.adresse}`}>
                {m.enCours === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Reconnecter
              </button>
              <button onClick={() => m.deconnecter(b)} disabled={occupe} className={cx(CL_ACTION, 'hover:text-red-600')} aria-label={`Déconnecter ${b.adresse}`}>
                <Unplug className="h-3.5 w-3.5" /> Déconnecter
              </button>
            </div>
          )}
          {b.fournisseur === 'google' && b.zones.includes('files') && proprietaire && !b.a_reconnecter && (
            <button onClick={() => m.choisirFichiers(b)} disabled={occupe}
              className="mt-2 flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-xs font-medium text-orange-600 hover:bg-orange-50">
              {m.enCours === `drive:${b.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
              Choisir des fichiers Drive
            </button>
          )}
          {b.a_reconnecter && proprietaire && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">Vos agents n'ont plus accès à ce compte. Cliquez sur « Reconnecter ».</p>
          )}
        </div>
      ))}
      {boites.length === 0 && <p className="text-xs text-neutral-500">{AIDE[quoi]}</p>}
      {quoi === 'email' && (
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer font-medium text-orange-700 hover:underline">Qu'est-ce qu'un mot de passe d'application ?</summary>
          <p className="mt-1">
            Certaines messageries refusent votre mot de passe habituel à un outil extérieur : elles demandent un mot de passe
            à part, créé dans les réglages de sécurité de votre compte et réservé à cet usage. Vous pouvez le supprimer quand
            vous voulez, sans changer votre mot de passe principal. Si votre messagerie n'en parle pas, votre mot de passe habituel suffit.
          </p>
          <p className="mt-1">
            Guides officiels : <a className="underline" href="https://support.google.com/accounts/answer/185833?hl=fr" target="_blank" rel="noreferrer">Gmail</a>
            {' · '}<a className="underline" href="https://support.apple.com/fr-fr/102654" target="_blank" rel="noreferrer">iCloud</a>.
            Pour une autre messagerie, cherchez « mot de passe d'application » dans l'aide de votre hébergeur.
          </p>
        </details>
      )}
      {boites.some((b) => b.fournisseur === 'google') && (
        <p className="text-xs text-neutral-500">Sur Google Drive, vos agents voient les documents qu'ils créent et ceux que vous choisissez.</p>
      )}
      {proprietaire && (
        <div className="flex items-center gap-1">
          <Bouton variante={boites.length ? 'clair' : 'noir'} className="px-3 py-1.5" disabled={occupe} onClick={() => m.connecter(quoi)}>
            {m.enCours === quoi ? <Loader2 className="h-4 w-4 animate-spin" /> : boites.length ? <Plus className="h-4 w-4" /> : null}
            {boites.length ? 'Ajouter un compte' : 'Connecter'}
          </Bouton>
          <button onClick={() => m.inviter(quoi)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Lien à envoyer à la personne qui gère ce compte" title="Lien à envoyer à la personne qui gère ce compte (valable 7 jours)">
            <Copy className="h-4 w-4" />
          </button>
        </div>
      )}
      {m.invitation?.quoi === quoi && (
        <p className="break-all rounded-lg bg-neutral-50 p-2 text-xs text-neutral-600">
          Lien copié, valable 7 jours, à envoyer à la personne qui gère ce compte :<br /><span className="select-all">{m.invitation.url}</span>
        </p>
      )}
    </div>
  );
}
