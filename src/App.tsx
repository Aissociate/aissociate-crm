import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import SupabaseNotice from '@/components/SupabaseNotice';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Contacts from '@/pages/Contacts';
import Entreprises from '@/pages/Entreprises';
import Pipeline from '@/pages/Pipeline';
import Formations from '@/pages/Formations';
import PlansFormation from '@/pages/PlansFormation';
import Dossiers from '@/pages/Dossiers';
import DossierDetail from '@/pages/DossierDetail';
import Calendrier from '@/pages/Calendrier';
import Formateurs from '@/pages/Formateurs';
import Kanban from '@/pages/Kanban';
import Documents from '@/pages/Documents';
import Messagerie from '@/pages/Messagerie';
import Recrutement from '@/pages/Recrutement';
import Statistiques from '@/pages/Statistiques';
import ActionsAFaire from '@/pages/ActionsAFaire';
import Administration from '@/pages/Administration';
import Parametres from '@/pages/Parametres';
import Tickets from '@/pages/Tickets';

export default function App() {
  const { configured } = useAuth();
  if (!configured) return <SupabaseNotice />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/entreprises" element={<Entreprises />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/formations" element={<Formations />} />
        <Route path="/plans" element={<PlansFormation />} />
        <Route path="/dossiers" element={<Dossiers />} />
        <Route path="/dossiers/:id" element={<DossierDetail />} />
        <Route path="/calendrier" element={<Calendrier />} />
        <Route path="/formateurs" element={<Formateurs />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/messagerie" element={<Messagerie />} />
        <Route
          path="/recrutement"
          element={
            <ProtectedRoute managerOnly>
              <Recrutement />
            </ProtectedRoute>
          }
        />
        <Route path="/statistiques" element={<Statistiques />} />
        <Route path="/actions" element={<ActionsAFaire />} />
        <Route
          path="/administration"
          element={
            <ProtectedRoute adminOnly>
              <Administration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/parametres"
          element={
            <ProtectedRoute adminOnly>
              <Parametres />
            </ProtectedRoute>
          }
        />
        <Route path="/tickets" element={<Tickets />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
