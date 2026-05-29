import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@/components/ui';

export default function ProtectedRoute({
  children, managerOnly, adminOnly,
}: { children: ReactNode; managerOnly?: boolean; adminOnly?: boolean }) {
  const { session, loading, isAdmin, isManager } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  if (managerOnly && !isManager) return <Navigate to="/" replace />;
  return <>{children}</>;
}
