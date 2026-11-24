// Point d'entrée du Studio IA (/studio/*). Seul point de contact avec le CRM :
// une route lazy dans src/App.tsx. Voir src/studio/README.md.
import {
  createContext, useCallback, useContext, useEffect, useState, lazy, Suspense,
} from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Bug, CircleHelp, Home, Users, FolderOpen, KeyRound, LogOut, Menu, X, Gauge, PauseCircle, AlarmClock, SlidersHorizontal, Workflow } from 'lucide-react';
import { BASE, nouvelleAdresse, ongletActif, REDIRECTIONS, sectionDe, SECTIONS, type Section } from './routes';
import { appel, jeton, majuscule, SessionExpiree, type Me } from './api';
import { Chargement, cx } from './composants';
import SignalerBug, { ouvrirSignalement } from './composants/SignalerBug';
import { Logo, LogoEmpile } from '@/components/Logo';

const Connexion = lazy(() => import('./pages/Connexion'));
const Aujourdhui = lazy(() => import('./pages/Aujourdhui'));
const Equipe = lazy(() => import('./pages/Equipe'));
const Specialiste = lazy(() => import('./pages/Specialiste'));
const AgentChat = lazy(() => import('./pages/AgentChat'));
const Ressources = lazy(() => import('./pages/Ressources'));
const Creations = lazy(() => import('./pages/Creations'));
const Entreprise = lazy(() => import('./pages/Entreprise'));
const Compte = lazy(() => import('./pages/Compte'));
const Responsables = lazy(() => import('./pages/Responsables'));
const Connecteurs = lazy(() => import('./pages/Connecteurs'));
const Rapport = lazy(() => import('./pages/Rapport'));
const ConnecterInvitation = lazy(() => import('./pages/ConnecterInvitation'));
const Questionnaire = lazy(() => import('./pages/Questionnaire'));
const Perimetre = lazy(() => import('./pages/Perimetre'));
const Contrat = lazy(() => import('./pages/Contrat'));
const Journal = lazy(() => import('./pages/Journal'));
const Livrables = lazy(() => import('./pages/Livrables'));
const ParEmail = lazy(() => import('./pages/ParEmail'));
const Routines = lazy(() => import('./pages/Routines'));
const Routine = lazy(() => import('./pages/Routine'));
const NouvelleRoutine = lazy(() => import('./pages/NouvelleRoutine'));
const Veille = lazy(() => import('./pages/Veille'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Desinscription = lazy(() => import('./pages/Desinscription'));
const AccepterCgv = lazy(() => import('./pages/AccepterCgv'));
const Reinitialiser = lazy(() => import('./pages/Reinitialiser'));
const Tutoriel = lazy(() => import('./Tutoriel'));

/** Repli local quand le serveur ne sait pas encore si le guide a été vu (colonne absente). */
const cleTuto = (id: string) => `studio.tutoriel.${id}`;
const tutoVuIci = (id: string) => { try { return localStorage.getItem(cleTuto(id)) === '1'; } catch { return true; } };

type Ctx = {
  me: Me | null;
  chargement: boolean;
  rafraichir: () => Promise<void>;
  connecte: (token: string, me: Me) => void;
  deconnexion: () => Promise<void>;
  /** Enveloppe d'appel : sur session expirée, retour à la connexion. */
  gerer: (e: unknown) => string;
};
const StudioContext = createContext<Ctx | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useStudio(): Ctx & { me: Me } {
  const c = useContext(StudioContext);
  if (!c || !c.me) throw new Error('useStudio hors session');
  return c as Ctx & { me: Me };
}

/** Une instance par agent : passer de Hugo à Sam (relais) repart d'un état vierge. */
function AgentChatParAgent() {
  const { agentId } = useParams();
  return <AgentChat key={agentId} />;
}

function Garde() {
  const c = useContext(StudioContext)!;
  if (c.chargement) return <div className="min-h-screen bg-[#F2ECE4]"><Chargement /></div>;
  if (!c.me) return <Navigate to="/studio/connexion" replace />;
  if (c.me.user.doit_changer) return <Compte premiereConnexion />;
  if (c.me.user.cgv_a_accepter) {
    return <Suspense fallback={<Chargement />}><AccepterCgv onAccepte={c.rafraichir} onDeconnexion={c.deconnexion} gerer={c.gerer} /></Suspense>;
  }
  return <Coquille />;
}

const ICONES: Record<Section['id'], typeof Home> = {
  aujourdhui: Home, equipe: Users, routines: Workflow, documents: FolderOpen, reglages: SlidersHorizontal,
};

/** Entrée du menu : active pour toute adresse de sa section (ses onglets compris). */
function Lien({ to, label, icon: Icon, actif, pastille, discret }: {
  to: string; label: string; icon: typeof Home; actif: boolean; pastille?: number; discret?: boolean;
}) {
  return (
    <Link
      to={to} data-tuto={to} aria-current={actif ? 'page' : undefined}
      className={cx(
        'flex min-h-[46px] items-center gap-3 rounded-xl px-3.5 text-base transition-colors',
        actif ? 'bg-[#F2ECE4] font-semibold text-[#17120E]' : cx(discret ? 'text-[#615850]' : 'text-[#17120E]', 'hover:bg-[#F2ECE4]'),
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden /> <span className="flex-1">{label}</span>
      {pastille ? (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#EA6A1E] px-1.5 text-[13px] font-bold text-[#17120E]"
          aria-label={`${pastille} décision${pastille > 1 ? 's' : ''} en attente`}>{pastille}</span>
      ) : null}
    </Link>
  );
}

/** Ancienne adresse du Studio : renvoie vers son onglet, paramètres et ancre conservés. */
function Redirection() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={nouvelleAdresse(pathname, search, hash) ?? BASE} replace />;
}

/** Onglets de la section courante (les pages regroupées sous une entrée du menu), puis la page. */
function SectionOnglets() {
  const { pathname } = useLocation();
  const section = sectionDe(pathname);
  const actif = section ? ongletActif(section, pathname) : null;
  return (
    <>
      {section && section.onglets.length > 1 && (
        <nav aria-label={`Rubriques de « ${section.label} »`} className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-[#E6DCD2] px-1">
          {section.onglets.map((o) => (
            <Link key={o.chemin} to={o.chemin} aria-current={o === actif ? 'page' : undefined}
              className={cx('-mb-px flex min-h-[44px] shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-[15px]',
                o === actif ? 'border-[#17120E] font-semibold text-[#17120E]' : 'border-transparent text-[#615850] hover:text-[#17120E]')}>
              {o.label}
            </Link>
          ))}
        </nav>
      )}
      <Outlet />
    </>
  );
}

function Coquille() {
  const { me, deconnexion } = useStudio();
  const navigate = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  // Guide de prise en main : tout seul à la première connexion, ensuite seulement à la demande.
  const [guide, setGuide] = useState(() => !me.essai?.termine
    && (me.user.tutoriel_vu === false || (me.user.tutoriel_vu == null && !tutoVuIci(me.user.id))));
  useEffect(() => { if (guide) navigate('/studio'); }, [guide, navigate]);
  const fermerGuide = useCallback(() => {
    setGuide(false);
    try { localStorage.setItem(cleTuto(me.user.id), '1'); } catch { /* stockage bloqué */ }
    appel('tutoriel_vu').catch(() => { /* sans gravité : le repli local suffit */ });
  }, [me.user.id]);
  // Essai terminé : seul l'abonnement (et le compte) reste accessible, le menu le dit.
  const essaiFini = Boolean(me.essai?.termine);
  const { pathname } = useLocation();
  const courante = sectionDe(pathname)?.id;
  const [reglages, ...principales] = [...SECTIONS].reverse();
  const nav = (
    <nav aria-label="Navigation principale" className="flex min-h-full flex-col gap-0.5 px-4 py-6" onClick={() => setOuvert(false)}>
      <div className="mb-7 px-3">
        <LogoEmpile branche="Studio IA" fond="clair" />
        <p className="mt-1 line-clamp-2 break-words text-[13px] text-[#615850]" title={me.workspace.nom}>{me.workspace.nom}</p>
      </div>
      {essaiFini ? (
        <>
          <Lien to={`${BASE}/reglages/perimetre`} label="Mon abonnement" icon={Gauge} actif={!pathname.endsWith('/compte')} />
          <Lien to={`${BASE}/reglages/compte`} label="Mon compte" icon={KeyRound} actif={pathname.endsWith('/compte')} />
          <p className="mt-4 px-3 text-xs text-neutral-500">Vos agents, ressources et contenus vous attendent : ils reviennent dès l'abonnement activé.</p>
        </>
      ) : principales.reverse().map((s) => (
        <Lien key={s.id} to={s.to} label={s.label} icon={ICONES[s.id]} actif={courante === s.id}
          pastille={s.id === 'aujourdhui' ? me.stats.livrables_a_valider : undefined} />
      ))}
      <div className="mt-auto pt-6">
        {!essaiFini && <Lien to={reglages.to} label={reglages.label} icon={ICONES[reglages.id]} actif={courante === reglages.id} discret />}
      </div>
      <div className="mt-2 border-t border-[#E6DCD2] pt-4">
        <p className="truncate px-3 text-sm font-medium text-neutral-800">{[majuscule(me.user.prenom), me.user.nom].filter(Boolean).join(' ') || me.user.email}</p>
        <p className="truncate px-3 text-xs text-neutral-500">{me.user.email}</p>
        <button onClick={deconnexion} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
          <LogOut className="h-4 w-4" /> Se déconnecter
        </button>
        {!essaiFini && (
          <button onClick={() => setGuide(true)} data-tuto="guide"
            className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <CircleHelp className="h-3.5 w-3.5" /> Revoir le guide
          </button>
        )}
        <button onClick={() => { setOuvert(false); ouvrirSignalement(); }} title="Capture la page et l'envoie à l'équipe Aissociate (Ctrl + Maj + B)"
          className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
          <Bug className="h-3.5 w-3.5" /> Signaler un problème
        </button>
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen bg-[#F2ECE4] font-sans text-neutral-900">
      <aside className="fixed inset-y-0 left-0 hidden w-60 overflow-y-auto border-r border-neutral-200 bg-white lg:block">{nav}</aside>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-[#F2ECE4]/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo size="xs" branche="Studio IA" fond="clair" />
        <button onClick={() => setOuvert(true)} aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></button>
      </header>
      {ouvert && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOuvert(false)}>
          <aside className="h-full w-64 overflow-y-auto bg-white" onClick={(e) => e.stopPropagation()}>
            <button className="absolute left-52 top-4" onClick={() => setOuvert(false)} aria-label="Fermer le menu"><X className="h-5 w-5" /></button>
            {nav}
          </aside>
        </div>
      )}
      {guide && <Suspense fallback={null}><Tutoriel onFermer={fermerGuide} /></Suspense>}
      <SignalerBug />
      <main className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          {me.essai && (me.essai.termine ? (
            <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm text-orange-900">
              <p className="font-semibold">Votre essai gratuit est terminé.</p>
              <p className="mt-1">Vos agents, ressources et contenus sont conservés. Activez votre abonnement ci-dessous pour les retrouver tout de suite.</p>
            </div>
          ) : (
            <NavLink to="/studio/reglages/perimetre" className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
              <AlarmClock className="h-5 w-5 shrink-0" />
              <span>Essai gratuit : {me.essai.jours_restants > 1 ? `${me.essai.jours_restants} jours restants` : 'dernier jour'} (jusqu'au {new Date(me.essai.fin).toLocaleDateString('fr-FR')}) · un outil connectable. <span className="underline">Choisir mon abonnement</span></span>
            </NavLink>
          ))}
          {me.workspace.suspendu && (
            <NavLink to="/studio/reglages/perimetre" className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <PauseCircle className="h-5 w-5 shrink-0" />
              <span>Vos agents sont suspendus : aucune mission n'est traitée. <span className="underline">Voir mon périmètre</span></span>
            </NavLink>
          )}
          <Suspense fallback={<Chargement />}>{essaiFini ? (pathname.endsWith('/compte') ? <Compte /> : pathname.endsWith('/contrat') ? <Contrat /> : <Perimetre />) : <SectionOnglets />}</Suspense>
        </div>
      </main>
    </div>
  );
}

export default function StudioApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [chargement, setChargement] = useState(true);
  const navigate = useNavigate();

  const rafraichir = useCallback(async () => {
    if (!jeton.lire()) { setMe(null); return; }
    try { setMe(await appel<Me>('me')); } catch (e) { if (e instanceof SessionExpiree) setMe(null); }
  }, []);

  useEffect(() => {
    document.title = 'Studio IA — Aissociate';
    void rafraichir().finally(() => setChargement(false));
  }, [rafraichir]);

  const connecte = useCallback((token: string, data: Me) => { jeton.ecrire(token); setMe(data); }, []);
  const deconnexion = useCallback(async () => {
    try { await appel('logout'); } catch { /* déjà expirée */ }
    jeton.ecrire(null); setMe(null); navigate('/studio/connexion');
  }, [navigate]);
  const gerer = useCallback((e: unknown) => {
    if (e instanceof SessionExpiree) { setMe(null); navigate('/studio/connexion'); }
    return e instanceof Error ? e.message : String(e);
  }, [navigate]);

  return (
    <StudioContext.Provider value={{ me, chargement, rafraichir, connecte, deconnexion, gerer }}>
      <Suspense fallback={<div className="min-h-screen bg-[#F2ECE4]"><Chargement /></div>}>
        <Routes>
          <Route path="connexion" element={<Connexion />} />
          <Route path="mot-de-passe/:jeton" element={<Reinitialiser />} />
          {/* Lien public d'invitation à connecter une application (sans session) */}
          <Route path="connecter/:jeton" element={<ConnecterInvitation />} />
          {/* Questionnaire d'onboarding public (nouveaux clients) */}
          <Route path="demarrer" element={<Questionnaire />} />
          <Route path="desinscription/:jeton" element={<Desinscription />} />
          <Route element={<Garde />}>
            {/* Cinq sections (routes.ts) ; les pages regroupées sont leurs onglets. */}
            <Route index element={<Aujourdhui />} />
            <Route path="aujourdhui" element={<Navigate to={BASE} replace />} />
            <Route path="aujourdhui/livrables" element={<Livrables />} />
            <Route path="aujourdhui/journal" element={<Journal />} />
            <Route path="equipe" element={<Equipe />} />
            <Route path="equipe/:agentId" element={<Specialiste />} />
            <Route path="assistants/:agentId" element={<AgentChatParAgent />} />
            <Route path="routines" element={<Routines />} />
            <Route path="routines/nouvelle" element={<NouvelleRoutine />} />
            <Route path="routines/:id" element={<Routine />} />
            <Route path="routines/veille" element={<Veille />} />
            <Route path="routines/par-email" element={<ParEmail />} />
            <Route path="documents" element={<Ressources />} />
            <Route path="documents/contenus" element={<Creations />} />
            <Route path="documents/contacts" element={<Contacts />} />
            <Route path="reglages" element={<Connecteurs />} />
            <Route path="reglages/entreprise" element={<Entreprise />} />
            <Route path="reglages/perimetre" element={<Perimetre />} />
            <Route path="reglages/perimetre/contrat" element={<Contrat />} />
            <Route path="reglages/responsables" element={<Responsables />} />
            <Route path="reglages/compte" element={<Compte />} />
            <Route path="reglages/rapport" element={<Rapport />} />
            {/* Anciennes adresses : toujours servies, par redirection. */}
            {Object.keys(REDIRECTIONS).map((ancienne) => <Route key={ancienne} path={ancienne} element={<Redirection />} />)}
          </Route>
          <Route path="*" element={<Navigate to="/studio" replace />} />
        </Routes>
      </Suspense>
    </StudioContext.Provider>
  );
}

// Contexte brut (page de connexion, hors session).
// eslint-disable-next-line react-refresh/only-export-components
export function useStudioBrut(): Ctx { return useContext(StudioContext)!; }
