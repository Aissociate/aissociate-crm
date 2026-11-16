// Studio › Connecteurs › connexions en un clic (Nango).
// Le client autorise lui-même ses applications ; chaque connexion est rattachée
// à SON espace par le serveur (jamais par le navigateur).
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, Link2, Loader2, Unplug, AlertTriangle, RefreshCw, UserRoundCog } from 'lucide-react';
import { useStudio } from './StudioApp';
import { appel } from './api';
import { Bouton, cx } from './composants';

export type Integration = { id: string; provider: string; nom: string; logo: string | null };
export type ConnexionNango = { integration_id: string; statut: string; erreur: string | null; connecte_par: string | null; updated_at: string };
export type EtatNango = { configure: boolean; integrations: Integration[]; connexions: ConnexionNango[] };

/** État et actions des connexions en un clic, partagés par toute la page Connecteurs. */
export function useNango() {
  const { gerer } = useStudio();
  const [etat, setEtat] = useState<EtatNango | null>(null);
  const [enCours, setEnCours] = useState('');
  const [invitation, setInvitation] = useState<{ id: string; url: string } | null>(null);
  const [erreur, setErreur] = useState('');
  const sonde = useRef<number | null>(null);

  const charger = useCallback(async (synchro = false) => {
    try { setEtat(await appel<EtatNango>(synchro ? 'nango_synchroniser' : 'nango_etat')); }
    catch (e) { setErreur(gerer(e)); setEtat({ configure: false, integrations: [], connexions: [] }); }
  }, [gerer]);
  useEffect(() => { charger(); return () => { if (sonde.current) window.clearInterval(sonde.current); }; }, [charger]);

  /** mode : « reconnecter » (ressaisir le même compte) ou « changer » (retirer puis connecter un autre compte). */
  const connecter = async (id: string, mode?: 'reconnecter' | 'changer') => {
    if (mode === 'changer' && !confirm("Changer de compte ? Le compte actuel sera retiré de l'espace, puis vous connecterez le nouveau.")) return;
    setErreur(''); setEnCours(id);
    // Fenêtre ouverte tout de suite (sinon bloquée comme pop-up), puis dirigée vers Nango.
    const fenetre = window.open('', 'nango-connexion', 'width=520,height=720');
    try {
      const { lien } = await appel<{ lien: string }>('nango_connecter', { integration_id: id, mode });
      if (fenetre) fenetre.location.href = lien; else window.location.href = lien;
      // À la fermeture de la fenêtre, on relit l'état chez Nango (filet de sécurité du webhook).
      if (sonde.current) window.clearInterval(sonde.current);
      sonde.current = window.setInterval(async () => {
        if (fenetre && !fenetre.closed) return;
        window.clearInterval(sonde.current!); sonde.current = null;
        await charger(true); setEnCours('');
      }, 1000);
    } catch (e) { fenetre?.close(); setErreur(gerer(e)); setEnCours(''); }
  };

  const deconnecter = async (id: string, nom: string) => {
    if (!confirm(`Déconnecter ${nom} ? Vos agents n'y auront plus accès.`)) return;
    setEnCours(id);
    try { setEtat(await appel<EtatNango>('nango_deconnecter', { integration_id: id })); }
    catch (e) { setErreur(gerer(e)); } finally { setEnCours(''); }
  };

  const inviter = async (id: string) => {
    setErreur('');
    try {
      const { url } = await appel<{ url: string }>('nango_invitation', { integration_id: id });
      setInvitation({ id, url });
      try { await navigator.clipboard.writeText(url); } catch { /* copie manuelle */ }
    } catch (e) { setErreur(gerer(e)); }
  };

  return { etat, enCours, invitation, erreur, charger, connecter, deconnecter, inviter };
}
export type Nango = ReturnType<typeof useNango>;

/** Une application connectable en un clic : état + Connecter / Déconnecter / Inviter. */
export function LigneIntegration({ nango, integration: i, libelle, compacte }: {
  nango: Nango; integration: Integration; libelle?: string; compacte?: boolean;
}) {
  const { me } = useStudio();
  const proprietaire = me.user.role === 'proprietaire';
  const c = nango.etat?.connexions.find((x) => x.integration_id === i.id);
  const ok = c?.statut === 'connecte';
  const nom = libelle ?? i.nom;
  return (
    <div className={cx(compacte ? 'rounded-xl bg-neutral-50 px-3 py-2' : '')}>
      <div className="flex items-center gap-2">
        {i.logo ? <img src={i.logo} alt="" className="h-6 w-6 shrink-0 rounded-md bg-white object-contain p-0.5" />
          : <span className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100"><Link2 className="h-3.5 w-3.5" /></span>}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{nom}</p>
          {c ? (
            <p className={cx('flex items-center gap-1 text-xs', ok ? 'text-emerald-700' : 'text-amber-700')}>
              {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              <span className="truncate">{ok ? `Connecté${c.connecte_par ? ` par ${c.connecte_par}` : ''}` : (c.erreur ?? 'À reconnecter')}</span>
            </p>
          ) : <p className="text-xs text-neutral-400">Non connecté</p>}
        </div>
        {proprietaire && (
          <div className="flex shrink-0 items-center gap-0.5">
            {c && <button onClick={() => nango.connecter(i.id, 'changer')} disabled={Boolean(nango.enCours)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label={`Changer de compte pour ${nom}`} title="Changer de compte"><UserRoundCog className="h-4 w-4" /></button>}
            {c && <button onClick={() => nango.deconnecter(i.id, nom)} className="rounded-lg p-1.5 text-neutral-400 hover:text-red-600" aria-label={`Déconnecter ${nom}`}><Unplug className="h-4 w-4" /></button>}
            <button onClick={() => nango.inviter(i.id)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label={`Inviter quelqu'un à connecter ${nom}`} title="Lien à envoyer à la personne qui gère ce compte (valable 7 jours)">
              <Copy className="h-4 w-4" />
            </button>
            <Bouton variante={ok ? 'clair' : 'noir'} className="px-3 py-1" disabled={Boolean(nango.enCours)}
              onClick={() => nango.connecter(i.id, c ? 'reconnecter' : undefined)}
              title={c ? 'Ressaisir le compte (mot de passe changé, accès retiré, droits à étendre)' : undefined}>
              {nango.enCours === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : c ? <RefreshCw className="h-3.5 w-3.5" /> : null}
              {c ? 'Reconnecter' : 'Connecter'}
            </Bouton>
          </div>
        )}
      </div>
      {c && !ok && proprietaire && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          Vos agents n'ont plus accès à ce compte. Cliquez sur « Reconnecter » et ressaisissez vos identifiants, ou changez de compte.
        </p>
      )}
      {nango.invitation?.id === i.id && (
        <p className="mt-2 break-all rounded-lg bg-white p-2 text-xs text-neutral-600">
          Lien copié, valable 7 jours, à envoyer à la personne qui gère ce compte :<br /><span className="select-all">{nango.invitation.url}</span>
        </p>
      )}
    </div>
  );
}
