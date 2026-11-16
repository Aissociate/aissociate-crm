// Studio › Connecteurs › « Connexion en un clic » (Nango).
// Le client autorise lui-même ses applications ; chaque connexion est rattachée
// à SON espace par le serveur (jamais par le navigateur).
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, Link2, Loader2, RefreshCw, Unplug, AlertTriangle } from 'lucide-react';
import { useStudio } from './StudioApp';
import { appel } from './api';
import { Bouton, cx } from './composants';

type Integration = { id: string; provider: string; nom: string; logo: string | null };
type Connexion = { integration_id: string; statut: string; erreur: string | null; connecte_par: string | null; updated_at: string };
type Etat = { configure: boolean; integrations: Integration[]; connexions: Connexion[] };

export default function ConnexionsUnClic() {
  const { me, gerer } = useStudio();
  const proprietaire = me.user.role === 'proprietaire';
  const [etat, setEtat] = useState<Etat | null>(null);
  const [enCours, setEnCours] = useState('');
  const [invitation, setInvitation] = useState<{ id: string; url: string } | null>(null);
  const [erreur, setErreur] = useState('');
  const sonde = useRef<number | null>(null);

  const charger = useCallback(async (synchro = false) => {
    try { setEtat(await appel<Etat>(synchro ? 'nango_synchroniser' : 'nango_etat')); }
    catch (e) { setErreur(gerer(e)); setEtat({ configure: false, integrations: [], connexions: [] }); }
  }, [gerer]);
  useEffect(() => { charger(); return () => { if (sonde.current) window.clearInterval(sonde.current); }; }, [charger]);

  const connecter = async (id: string) => {
    setErreur(''); setEnCours(id);
    // Fenêtre ouverte tout de suite (sinon bloquée comme pop-up), puis dirigée vers Nango.
    const fenetre = window.open('', 'nango-connexion', 'width=520,height=720');
    try {
      const { lien } = await appel<{ lien: string }>('nango_connecter', { integration_id: id });
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
    try { setEtat(await appel<Etat>('nango_deconnecter', { integration_id: id })); }
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

  if (!etat) return <div className="mb-8 h-24 animate-pulse rounded-2xl bg-neutral-100" />;
  if (!etat.configure || etat.integrations.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Connexion en un clic</h2>
          <p className="text-sm text-neutral-500">Autorisez vous-même vos applications : la connexion est sécurisée et réservée à votre espace.</p>
        </div>
        <button onClick={() => charger(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100" aria-label="Actualiser">
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </div>
      {erreur && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {etat.integrations.map((i) => {
          const c = etat.connexions.find((x) => x.integration_id === i.id);
          const ok = c?.statut === 'connecte';
          return (
            <div key={i.id} className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center gap-3">
                {i.logo ? <img src={i.logo} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-neutral-100 bg-white object-contain p-1.5" />
                  : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100"><Link2 className="h-4 w-4" /></span>}
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.nom}</p>
                  {c ? (
                    <p className={cx('flex items-center gap-1 text-xs', ok ? 'text-emerald-700' : 'text-amber-700')}>
                      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {ok ? `Connecté${c.connecte_par ? ` par ${c.connecte_par}` : ''}` : (c.erreur ?? 'À reconnecter')}
                    </p>
                  ) : <p className="text-xs text-neutral-400">Non connecté</p>}
                </div>
              </div>
              {proprietaire && (
                <div className="mt-auto flex flex-wrap items-center gap-1 pt-4">
                  <Bouton variante={ok ? 'clair' : 'noir'} className="px-3 py-1.5" disabled={Boolean(enCours)} onClick={() => connecter(i.id)}>
                    {enCours === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {ok ? 'Reconnecter' : c ? 'Reconnecter' : 'Connecter'}
                  </Bouton>
                  {c && <button onClick={() => deconnecter(i.id, i.nom)} className="rounded-lg p-1.5 text-neutral-400 hover:text-red-600" aria-label={`Déconnecter ${i.nom}`}><Unplug className="h-4 w-4" /></button>}
                  <button onClick={() => inviter(i.id)} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
                    title="Lien à envoyer à la personne qui gère ce compte (valable 7 jours)">
                    <Copy className="h-3.5 w-3.5" /> Inviter
                  </button>
                </div>
              )}
              {invitation?.id === i.id && (
                <p className="mt-2 break-all rounded-lg bg-neutral-50 p-2 text-xs text-neutral-600">
                  Lien copié, valable 7 jours, à envoyer à la personne qui gère ce compte :<br /><span className="select-all">{invitation.url}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
