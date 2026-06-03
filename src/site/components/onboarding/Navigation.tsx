// @ts-nocheck
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart3, MessageSquare, LogOut, User } from 'lucide-react';
import AdminLogo from '../AdminLogo';

export default function Navigation() {
  const { user, profile, signOut, adminMode } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user || !profile) return null;

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <AdminLogo
                src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
                alt="Aissociate Logo"
                className="h-10 w-auto object-contain"
              />
            </Link>

            {profile.status === 'active' && (
              <div className="hidden md:flex items-center gap-4">
                <Link
                  to="/onboarding/dashboard"
                  className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:text-orange-600 transition-colors"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/onboarding/amelioration"
                  className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:text-orange-600 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Feedback</span>
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {adminMode && (
              <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">
                MODE ADMIN
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-700">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">{profile?.role === 'fixer' ? 'Fixer' : 'Closer'}</span>
              <span className="hidden sm:inline text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                {profile?.status || 'guest'}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
