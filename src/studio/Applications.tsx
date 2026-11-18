// Studio › Connecteurs › autres applications en un clic (Zernio) : vidéo, messageries instantanées,
// publicité, site et boutique, CRM, mesure et paiement. Le serveur rattache chaque compte au profil
// Zernio de l'espace ; le navigateur ne voit jamais la clé.
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { APPLICATIONS_UN_CLIC, logoConnecteur, RESEAUX_PUBLICATION, type AppUnClic } from '@/lib/tarifConnecteurs';
import { useStudio } from './StudioApp';
import { appel } from './api';
import { cx } from './composants';

export type CompteApp = { id: string; app: string; nom: string; a_reconnecter: boolean };
type Etat = { configure: boolean; comptes: CompteApp[] };

const TOUTES = APPLICATIONS_UN_CLIC.flatMap((g) => g.apps);
const nomDe = (slug: string) => TOUTES.find((a) => a.slug === slug)?.nom ?? slug;
/** Applications gérées ici (les réseaux où les agents publient ont leurs propres cartes). */
export const CATEGORIES_APPS = APPLICATIONS_UN_CLIC
  .map((g) => ({ ...g, apps: g.apps.filter((a) => !RESEAUX_PUBLICATION.includes(a.slug)) }))
  .filter((g) => g.apps.length);

/** Message lisible au retour de la fenêtre d'autorisation (paramètres ajoutés par Zernio). */
function messageRetour(p: URLSearchParams): { ok: boolean; texte: string } | null {
  const app = p.get('app');
  if (!app || !TOUTES.some((a) => a.slug === app)) return null;
  const nom = nomDe(app);
  if (p.get('error')) {
    const e = p.get('error');
    return { ok: false, texte: e === 'oauth_denied' ? `Connexion ${nom} annulée.` : `Connexion ${nom} impossible : ${p.get('error_message') || e}.` };
  }
  if (p.get('connected') || p.get('accountId')) return { ok: true, texte: `${nom} connecté${p.get('username') ? ` (${p.get('username')})` : ''}.` };
  return null;
}

export function useApplications() {
  const { gerer } = useStudio();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [enCours, setEnCours] = useState('');
  const [erreur, setErreur] = useState('');
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);

  const charger = useCallback(async () => {
    try { setEtat(await appel<Etat>('apps_etat')); }
    catch (e) { setErreur(gerer(e)); setEtat({ configure: false, comptes: [] }); }
  }, [gerer]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const m = messageRetour(p);
    if (m) { setRetour(m); window.history.replaceState(null, '', window.location.pathname); }
    charger();
  }, [charger]);

  const connecter = async (app: string, reconnecter?: string) => {
    let boutique: string | undefined;
    if (app === 'shopify' && !reconnecter) {
      boutique = window.prompt('Adresse de votre boutique Shopify (ex. ma-boutique.myshopify.com)')?.trim();
      if (!boutique) return;
    }
    setErreur(''); setEnCours(reconnecter ?? app);
    try {
      const { lien } = await appel<{ lien: string }>('apps_connecter', { app, reconnecter, boutique });
      window.location.href = lien;
    } catch (e) { setErreur(gerer(e)); setEnCours(''); }
  };

  const deconnecter = async (c: CompteApp) => {
    if (!confirm(`Déconnecter ${nomDe(c.app)} (${c.nom}) ?`)) return;
    setEnCours(c.id);
    try { setEtat(await appel<Etat>('apps_deconnecter', { compte_id: c.id })); }
    catch (e) { setErreur(gerer(e)); } finally { setEnCours(''); }
  };

  return { etat, enCours, erreur, retour, charger, connecter, deconnecter };
}
export type Applications = ReturnType<typeof useApplications>;

export function Logo({ slug, taille = 'h-10 w-10' }: { slug: string; taille?: string }) {
  return (
    <span className={cx('flex shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white', taille)}>
      <img src={logoConnecteur(slug)} alt="" loading="lazy" className="h-1/2 w-1/2" />
    </span>
  );
}

function Tuile({ app, apps }: { app: AppUnClic; apps: Applications }) {
  const { me } = useStudio();
  const proprietaire = me.user.role === 'proprietaire';
  const comptes = (apps.etat?.comptes ?? []).filter((c) => c.app === app.slug);
  const occupe = Boolean(apps.enCours);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <Logo slug={app.slug} taille="h-9 w-9" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{app.nom}</p>
        {proprietaire && (
          <button type="button" disabled={occupe || !apps.etat?.configure} onClick={() => apps.connecter(app.slug)}
            className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50',
              comptes.length ? 'border border-neutral-200 text-neutral-700 hover:border-neutral-400' : 'bg-neutral-900 text-white hover:bg-neutral-700')}>
            {apps.enCours === app.slug && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {comptes.length ? 'Ajouter' : 'Connecter'}
          </button>
        )}
      </div>
      {comptes.map((c) => (
        <div key={c.id} className="mt-2 flex items-center gap-2 rounded-xl bg-neutral-50 px-2.5 py-1.5">
          <p className={cx('flex min-w-0 flex-1 items-center gap-1 text-xs', c.a_reconnecter ? 'text-amber-700' : 'text-emerald-700')}>
            {c.a_reconnecter ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{c.a_reconnecter ? `À reconnecter · ${c.nom}` : c.nom}</span>
          </p>
          {proprietaire && (
            <>
              <button onClick={() => apps.connecter(app.slug, c.id)} disabled={occupe} title="Reconnecter" aria-label={`Reconnecter ${c.nom}`}
                className="rounded-lg p-1 text-neutral-400 hover:text-neutral-700">
                {apps.enCours === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => apps.deconnecter(c)} disabled={occupe} aria-label={`Déconnecter ${c.nom}`} className="rounded-lg p-1 text-neutral-400 hover:text-red-600">
                <Unplug className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/** Toutes les autres applications, par catégorie, chacune avec son bouton « Connecter ». */
export function GrilleApplications({ apps }: { apps: Applications }) {
  return (
    <div className="space-y-6">
      {CATEGORIES_APPS.map((g) => (
        <div key={g.categorie}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{g.categorie}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.apps.map((a) => <Tuile key={a.slug} app={a} apps={apps} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
