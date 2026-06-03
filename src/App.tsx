import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SupabaseNotice from '@/components/SupabaseNotice';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import SiteFrame from '@/components/SiteFrame';

// ── CRM (back-office, derrière /login) ──
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Contacts from '@/pages/Contacts';
import Entreprises from '@/pages/Entreprises';
import Pipeline from '@/pages/Pipeline';
import Formations from '@/pages/Formations';
import PlansFormation from '@/pages/PlansFormation';
import Devis from '@/pages/Devis';
import Dossiers from '@/pages/Dossiers';
import DossierDetail from '@/pages/DossierDetail';
import Calendrier from '@/pages/Calendrier';
import Formateurs from '@/pages/Formateurs';
import Kanban from '@/pages/Kanban';
import Documents from '@/pages/Documents';
import Messagerie from '@/pages/Messagerie';
import Assistant from '@/pages/Assistant';
import Recrutement from '@/pages/Recrutement';
import Statistiques from '@/pages/Statistiques';
import ActionsAFaire from '@/pages/ActionsAFaire';
import Administration from '@/pages/Administration';
import Parametres from '@/pages/Parametres';
import Tickets from '@/pages/Tickets';

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

export default function App() {
  const { configured } = useAuth();

  return (
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
      </Route>

      {/* ── CRM Aissociate (accès Admin) ── */}
      <Route path="/login" element={configured ? <Login /> : <SupabaseNotice />} />
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
        <Route path="/formateurs" element={<Formateurs />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/messagerie" element={<Messagerie />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route
          path="/recrutement"
          element={<ProtectedRoute managerOnly><Recrutement /></ProtectedRoute>}
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
