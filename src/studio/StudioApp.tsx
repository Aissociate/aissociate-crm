// Point d'entrée du Studio IA (/studio/*). Seul point de contact avec le CRM :
// une route lazy dans src/App.tsx. Voir src/studio/README.md.
import {
  createContext, useCallback, useContext, useEffect, useState, lazy, Suspense,
} from 'react';
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Home, Users, FolderOpen, Sparkles, Building2, KeyRound, LogOut, Menu, X, Plug, BarChart3, ShieldCheck, Gauge, ScrollText, PauseCircle, Mail, AlarmClock, Newspaper, Contact } from 'lucide-react';
import { appel, jeton, SessionExpiree, type Me } from './api';
import { Chargement, cx } from './composants';

const Connexion = lazy(() => import('./pages/Connexion'));
const Accueil = lazy(() => import('./pages/Accueil'));
const Assistants = lazy(() => import('./pages/Assistants'));
const AgentChat = lazy(() => import('./pages/AgentChat'));
const Ressources = lazy(() => import('./pages/Ressources'));
const Creations = lazy(() => import('./pages/Creations'));
const Entreprise = lazy(() => import('./pages/Entreprise'));
const Compte = lazy(() => import('./pages/Compte'));
const Connecteurs = lazy(() => import('./pages/Connecteurs'));
const Rapport = lazy(() => import('./pages/Rapport'));
const ConnecterInvitation = lazy(() => import('./pages/ConnecterInvitation'));
const Questionnaire = lazy(() => import('./pages/Questionnaire'));
const Perimetre = lazy(() => import('./pages/Perimetre'));
const Journal = lazy(() => import('./pages/Journal'));
const Livrables = lazy(() => import('./pages/Livrables'));
const ParEmail = lazy(() => import('./pages/ParEmail'));
const Taches = lazy(() => import('./pages/Taches'));
const Veille = lazy(() => import('./pages/Veille'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Desinscription = lazy(() => import('./pages/Desinscription'));
const AccepterCgv = lazy(() => import('./pages/AccepterCgv'));
const Reinitialiser = lazy(() => import('./pages/Reinitialiser'));

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
  if (c.chargement) return <div className="min-h-screen bg-[#f6f6f4]"><Chargement /></div>;
  if (!c.me) return <Navigate to="/studio/connexion" replace />;
  if (c.me.user.doit_changer) return <Compte premiereConnexion />;
  if (c.me.user.cgv_a_accepter) {
    return <Suspense fallback={<Chargement />}><AccepterCgv onAccepte={c.rafraichir} onDeconnexion={c.deconnexion} gerer={c.gerer} /></Suspense>;
  }
  return <Coquille />;
}

const MENU = [
  { to: '/studio', label: 'Accueil', icon: Home, end: true },
  { to: '/studio/assistants', label: 'Assistants', icon: Users },
  { to: '/studio/ressources', label: 'Ressources', icon: FolderOpen },
  { to: '/studio/connecteurs', label: 'Connecteurs', icon: Plug },
  { to: '/studio/par-email', label: 'Par e-mail', icon: Mail },
  { to: '/studio/taches', label: 'Tâches planifiées', icon: AlarmClock },
  { to: '/studio/veille', label: 'Veille', icon: Newspaper },
  { to: '/studio/contacts', label: 'Contacts', icon: Contact },
];
const MENU_CREATIONS = [
  { to: '/studio/creations', label: 'Contenus', icon: Sparkles },
  { to: '/studio/livrables', label: 'Livrables', icon: ShieldCheck },
];
const MENU_ESPACE = [
  { to: '/studio/perimetre', label: 'Mon périmètre', icon: Gauge },
  { to: '/studio/journal', label: 'Journal', icon: ScrollText },
  { to: '/studio/rapport', label: 'Rapport mensuel', icon: BarChart3 },
  { to: '/studio/entreprise', label: 'Mon entreprise', icon: Building2 },
  { to: '/studio/compte', label: 'Mon compte', icon: KeyRound },
];

function Lien({ to, label, icon: Icon, end, pastille }: { to: string; label: string; icon: typeof Home; end?: boolean; pastille?: number }) {
  return (
    <NavLink
      to={to} end={end}
      className={({ isActive }) => cx(
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
        isActive ? 'bg-neutral-200/70 font-medium text-neutral-900' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
      )}
    >
      <Icon className="h-4 w-4" /> {label}
      {pastille ? <span className="ml-auto rounded-full bg-orange-500 px-1.5 text-xs font-medium text-white">{pastille}</span> : null}
    </NavLink>
  );
}

function Coquille() {
  const { me, deconnexion } = useStudio();
  const [ouvert, setOuvert] = useState(false);
  // Essai terminé : seul l'abonnement (et le compte) reste accessible, le menu le dit.
  const essaiFini = Boolean(me.essai?.termine);
  const nav = (
    <nav className="flex h-full flex-col gap-1 p-4" onClick={() => setOuvert(false)}>
      <div className="mb-6 px-2">
        <p className="text-lg font-bold tracking-tight text-neutral-900">A(I)ssociate <span className="text-orange-500">Studio</span></p>
        <p className="truncate text-xs text-neutral-500">{me.workspace.nom}</p>
      </div>
      {essaiFini ? (
        <>
          <Lien to="/studio/perimetre" label="Mon abonnement" icon={Gauge} />
          <Lien to="/studio/compte" label="Mon compte" icon={KeyRound} />
          <p className="mt-4 px-3 text-xs text-neutral-500">Vos agents, ressources et contenus vous attendent : ils reviennent dès l'abonnement activé.</p>
        </>
      ) : (
        <>
          {MENU.map((m) => <Lien key={m.to} {...m} />)}
          <p className="mb-1 mt-6 px-3 text-xs text-neutral-400">Mes créations</p>
          {MENU_CREATIONS.map((m) => <Lien key={m.to} {...m} pastille={m.to === '/studio/livrables' ? me.stats.livrables_a_valider : undefined} />)}
          <p className="mb-1 mt-6 px-3 text-xs text-neutral-400">Mon espace</p>
          {MENU_ESPACE.map((m) => <Lien key={m.to} {...m} />)}
        </>
      )}
      <div className="mt-auto border-t border-neutral-200 pt-4">
        <p className="truncate px-3 text-sm font-medium text-neutral-800">{[me.user.prenom, me.user.nom].filter(Boolean).join(' ') || me.user.email}</p>
        <p className="truncate px-3 text-xs text-neutral-500">{me.user.email}</p>
        <button onClick={deconnexion} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
          <LogOut className="h-4 w-4" /> Se déconnecter
        </button>
      </div>
    </nav>
  );
  return (
    <div className="min-h-screen bg-[#f6f6f4] font-sans text-neutral-900">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-neutral-200 bg-[#f1f1ee] lg:block">{nav}</aside>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-[#f6f6f4]/90 px-4 py-3 backdrop-blur lg:hidden">
        <p className="font-bold">A(I)ssociate <span className="text-orange-500">Studio</span></p>
        <button onClick={() => setOuvert(true)} aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></button>
      </header>
      {ouvert && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOuvert(false)}>
          <aside className="h-full w-64 bg-[#f1f1ee]" onClick={(e) => e.stopPropagation()}>
            <button className="absolute left-52 top-4" onClick={() => setOuvert(false)} aria-label="Fermer le menu"><X className="h-5 w-5" /></button>
            {nav}
          </aside>
        </div>
      )}
      <main className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          {me.essai && (me.essai.termine ? (
            <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm text-orange-900">
              <p className="font-semibold">Votre essai gratuit est terminé.</p>
              <p className="mt-1">Vos agents, ressources et contenus sont conservés. Activez votre abonnement ci-dessous pour les retrouver tout de suite.</p>
            </div>
          ) : (
            <NavLink to="/studio/perimetre" className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
              <AlarmClock className="h-5 w-5 shrink-0" />
              <span>Essai gratuit : {me.essai.jours_restants > 1 ? `${me.essai.jours_restants} jours restants` : 'dernier jour'} (jusqu'au {new Date(me.essai.fin).toLocaleDateString('fr-FR')}) · un outil connectable. <span className="underline">Choisir mon abonnement</span></span>
            </NavLink>
          ))}
          {me.workspace.suspendu && (
            <NavLink to="/studio/perimetre" className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <PauseCircle className="h-5 w-5 shrink-0" />
              <span>Vos agents sont suspendus : aucune mission n'est traitée. <span className="underline">Voir mon périmètre</span></span>
            </NavLink>
          )}
          <Suspense fallback={<Chargement />}>{essaiFini ? (window.location.pathname.endsWith('/compte') ? <Compte /> : <Perimetre />) : <Outlet />}</Suspense>
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
    rafraichir().finally(() => setChargement(false));
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
      <Suspense fallback={<div className="min-h-screen bg-[#f6f6f4]"><Chargement /></div>}>
        <Routes>
          <Route path="connexion" element={<Connexion />} />
          <Route path="mot-de-passe/:jeton" element={<Reinitialiser />} />
          {/* Lien public d'invitation à connecter une application (sans session) */}
          <Route path="connecter/:jeton" element={<ConnecterInvitation />} />
          {/* Questionnaire d'onboarding public (nouveaux clients) */}
          <Route path="demarrer" element={<Questionnaire />} />
          <Route path="desinscription/:jeton" element={<Desinscription />} />
          <Route element={<Garde />}>
            <Route index element={<Accueil />} />
            <Route path="assistants" element={<Assistants />} />
            <Route path="assistants/:agentId" element={<AgentChatParAgent />} />
            <Route path="ressources" element={<Ressources />} />
            <Route path="connecteurs" element={<Connecteurs />} />
            <Route path="rapport" element={<Rapport />} />
            <Route path="perimetre" element={<Perimetre />} />
            <Route path="journal" element={<Journal />} />
            <Route path="livrables" element={<Livrables />} />
            <Route path="par-email" element={<ParEmail />} />
            <Route path="taches" element={<Taches />} />
            <Route path="veille" element={<Veille />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="creations" element={<Creations />} />
            <Route path="entreprise" element={<Entreprise />} />
            <Route path="compte" element={<Compte />} />
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
