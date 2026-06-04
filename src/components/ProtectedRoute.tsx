import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui';

function PendingApproval({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-app p-6">
      <div className="card max-w-md w-full p-8 text-center space-y-4">
        <div className="flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 text-2xl">⏳</span>
        </div>
        <h2 className="text-xl font-bold text-fg">Compte en attente d'approbation</h2>
        <p className="text-sm text-muted">
          Votre compte a bien été créé. Un administrateur ou directeur commercial doit valider votre accès avant que vous puissiez utiliser le back-office.
        </p>
        <p className="text-xs text-muted">
          Contactez <strong>contact@aissociate.re</strong> si vous avez besoin d'un accès urgent.
        </p>
        <button
          onClick={onSignOut}
          className="text-sm text-muted underline hover:text-fg transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

export default function ProtectedRoute({
  children, managerOnly, adminOnly,
}: { children: ReactNode; managerOnly?: boolean; adminOnly?: boolean }) {
  const { session, loading, isAdmin, isManager, approved, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (!approved) return <PendingApproval onSignOut={signOut} />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  if (managerOnly && !isManager) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
