import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SupabaseNotice from '@/components/SupabaseNotice';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import SiteFrame from '@/components/SiteFrame';

// ── CRM (back-office, derrière /login) ──
// Chargé en lazy : le site vitrine public ne doit pas télécharger le bundle du CRM
// (Core Web Vitals / SEO). Chaque page devient son propre chunk à la build.
const Login = lazy(() => import('@/pages/Login'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Contacts = lazy(() => import('@/pages/Contacts'));
const Entreprises = lazy(() => import('@/pages/Entreprises'));
const Pipeline = lazy(() => import('@/pages/Pipeline'));
const Formations = lazy(() => import('@/pages/Formations'));
const PlansFormation = lazy(() => import('@/pages/PlansFormation'));
const Devis = lazy(() => import('@/pages/Devis'));
const Dossiers = lazy(() => import('@/pages/Dossiers'));
const DossierDetail = lazy(() => import('@/pages/DossierDetail'));
const Calendrier = lazy(() => import('@/pages/Calendrier'));
const Emargement = lazy(() => import('@/pages/Emargement'));
const Formateurs = lazy(() => import('@/pages/Formateurs'));
const Kanban = lazy(() => import('@/pages/Kanban'));
const Documents = lazy(() => import('@/pages/Documents'));
const Qualiopi = lazy(() => import('@/pages/Qualiopi'));
const Messagerie = lazy(() => import('@/pages/Messagerie'));
const Assistant = lazy(() => import('@/pages/Assistant'));
const BlogAdmin = lazy(() => import('@/pages/BlogAdmin'));
const Newsletter = lazy(() => import('@/pages/Newsletter'));
const Recrutement = lazy(() => import('@/pages/Recrutement'));
const Conseillers = lazy(() => import('@/pages/Conseillers'));
const Statistiques = lazy(() => import('@/pages/Statistiques'));
const ActionsAFaire = lazy(() => import('@/pages/ActionsAFaire'));
const Administration = lazy(() => import('@/pages/Administration'));
const Parametres = lazy(() => import('@/pages/Parametres'));
const Tickets = lazy(() => import('@/pages/Tickets'));
const CaptureMobile = lazy(() => import('@/pages/CaptureMobile'));

// ── Site vitrine public (vendorisé depuis Aissociate_OF, sous src/site) ──
import OrganismHome from '@/site/pages/OrganismHome';
import SiteFormationsList from '@/site/pages/FormationsList';
import SiteFormationDetail from '@/site/pages/FormationDetail';
import SiteFormationDetailPage from '@/site/pages/FormationDetailPage';
import SiteAssistance from '@/site/pages/Assistance';
import SiteDevelopment from '@/site/pages/Development';
import SiteBlog from '@/site/pages/Blog';
import SiteBlogArticle from '@/site/pages/BlogArticle';
import SiteAides from '@/site/pages/AidesFormation';
import SiteContact from '@/site/pages/Contact';
import SiteFormulaire from '@/site/pages/Formulaire';
import SiteMentionsLegales from '@/site/pages/MentionsLegales';
import SiteConfidentialite from '@/site/pages/Confidentialite';
import SiteAccessibilite from '@/site/pages/Accessibilite';
import SiteReclamations from '@/site/pages/Reclamations';
import SiteNotFound from '@/site/pages/NotFound';

// Pages publiques tokenisées (non indexées, usage ponctuel) : lazy également.
const SiteQuestionnaire = lazy(() => import('@/site/pages/Questionnaire'));
const SiteSignature = lazy(() => import('@/site/pages/Signature'));
const SiteEmargement = lazy(() => import('@/site/pages/Emargement'));

function LazyFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white" role="status" aria-label="Chargement">
      <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const { configured } = useAuth();

  return (
    <Suspense fallback={<LazyFallback />}>
    <Routes>
      {/* ── Site vitrine public (layout SiteFrame = AuthProvider du site + bouton Admin) ── */}
      <Route element={<SiteFrame />}>
        <Route path="/" element={<OrganismHome />} />
        <Route path="/formations" element={<SiteFormationsList />} />
        <Route path="/formations/closer-ia-cpf" element={<SiteFormationDetail />} />
        <Route path="/formations/:id" element={<SiteFormationDetailPage />} />
        <Route path="/assistance" element={<SiteAssistance />} />
        <Route path="/developpement" element={<SiteDevelopment />} />
        <Route path="/blog" element={<SiteBlog />} />
        <Route path="/blog/:slug" element={<SiteBlogArticle />} />
        <Route path="/aides-formation" element={<SiteAides />} />
        <Route path="/contact" element={<SiteContact />} />
        <Route path="/formulaire" element={<SiteFormulaire />} />
        <Route path="/mentions-legales" element={<SiteMentionsLegales />} />
        <Route path="/confidentialite" element={<SiteConfidentialite />} />
        <Route path="/accessibilite" element={<SiteAccessibilite />} />
        <Route path="/reclamations" element={<SiteReclamations />} />
        {/* Vraie page 404 (noindex) : pas de redirection silencieuse vers l'accueil (soft 404) */}
        <Route path="*" element={<SiteNotFound />} />
      </Route>

      {/* ── Pages publiques tokenisées (hors chrome du site, non indexées) ── */}
      <Route path="/q/:token" element={<SiteQuestionnaire />} />
      <Route path="/signature/:token" element={<SiteSignature />} />
      <Route path="/emargement/:token" element={<SiteEmargement />} />

      {/* ── CRM Aissociate (accès Admin) ── */}
      <Route path="/login" element={configured ? <Login /> : <SupabaseNotice />} />
      <Route path="/reset-password" element={configured ? <ResetPassword /> : <SupabaseNotice />} />
      <Route
        element={configured ? <ProtectedRoute><Layout /></ProtectedRoute> : <SupabaseNotice />}
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/entreprises" element={<Entreprises />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/catalogue" element={<Formations />} />
        <Route path="/plans" element={<PlansFormation />} />
        <Route path="/devis" element={<Devis />} />
        <Route path="/dossiers" element={<Dossiers />} />
        <Route path="/dossiers/:id" element={<DossierDetail />} />
        <Route path="/calendrier" element={<Calendrier />} />
        <Route path="/emargement" element={<Emargement />} />
        <Route path="/formateurs" element={<Formateurs />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/qualiopi" element={<Qualiopi />} />
        <Route path="/messagerie" element={<Messagerie />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/blog-admin" element={<ProtectedRoute managerOnly><BlogAdmin /></ProtectedRoute>} />
        <Route path="/newsletter" element={<ProtectedRoute managerOnly><Newsletter /></ProtectedRoute>} />
        <Route
          path="/recrutement"
          element={<ProtectedRoute managerOnly><Recrutement /></ProtectedRoute>}
        />
        <Route
          path="/conseillers"
          element={<ProtectedRoute managerOnly><Conseillers /></ProtectedRoute>}
        />
        <Route path="/statistiques" element={<Statistiques />} />
        <Route path="/actions" element={<ActionsAFaire />} />
        <Route
          path="/administration"
          element={<ProtectedRoute adminOnly><Administration /></ProtectedRoute>}
        />
        <Route
          path="/parametres"
          element={<ProtectedRoute adminOnly><Parametres /></ProtectedRoute>}
        />
        <Route path="/tickets" element={<Tickets />} />
      </Route>

      {/* ── Capture mobile (plein écran, hors Layout : usage sur téléphone) ── */}
      <Route
        path="/mobile"
        element={configured ? <ProtectedRoute><CaptureMobile /></ProtectedRoute> : <SupabaseNotice />}
      />

    </Routes>
    </Suspense>
  );
}
