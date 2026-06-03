// @ts-nocheck
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireStatus?: string[];
}

export default function ProtectedRoute({ children, requireStatus }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  console.log('🛡️ ProtectedRoute: loading=', loading, 'user=', !!user, 'profile=', profile, 'requireStatus=', requireStatus);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-slate-700 text-lg">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('🛡️ No user, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (requireStatus && profile && !requireStatus.includes(profile.status) && !profile.is_admin) {
    console.log('🛡️ Status mismatch, redirecting to dashboard. Required:', requireStatus, 'Current:', profile.status);
    return <Navigate to="/dashboard" replace />;
  }

  console.log('🛡️ Access granted');
  return <>{children}</>;
}
