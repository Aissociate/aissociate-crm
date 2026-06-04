// @ts-nocheck
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { GraduationCap, Menu, X, Shield, Phone, Code, BookOpen, Euro } from 'lucide-react';
import AdminLogo from './AdminLogo';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      {isAdmin && (
        <div className="bg-slate-900 py-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-end">
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-4 py-1.5 rounded-lg font-semibold text-xs transition-all flex items-center gap-2"
            >
              <Shield className="w-3 h-3" />
              Admin
            </button>
          </div>
        </div>
      )}

      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-3 group">
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="AIssociate Logo"
              className="h-12 w-12 object-contain rounded-xl group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="text-xl font-bold text-slate-900">AIssociate</div>
              <div className="text-xs text-slate-600">Organisme de formation</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link
              to="/formations"
              className="flex items-center gap-2 text-slate-700 hover:text-orange-600 font-medium transition-colors"
            >
              <GraduationCap className="w-4 h-4" />
              Formations
            </Link>

            <Link
              to="/assistance"
              className="flex items-center gap-2 text-slate-700 hover:text-orange-600 font-medium transition-colors"
            >
              <Phone className="w-4 h-4" />
              Assistance
            </Link>

            <Link
              to="/developpement"
              className="flex items-center gap-2 text-slate-700 hover:text-orange-600 font-medium transition-colors"
            >
              <Code className="w-4 h-4" />
              Développement
            </Link>

            <Link
              to="/blog"
              className="flex items-center gap-2 text-slate-700 hover:text-orange-600 font-medium transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Blog
            </Link>

            <Link
              to="/aides-formation"
              className="flex items-center gap-2 text-emerald-700 hover:text-emerald-800 font-semibold transition-colors"
            >
              <Euro className="w-4 h-4" />
              Aides
            </Link>

            <Link
              to="/formulaire"
              className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-all"
            >
              Nous contacter
            </Link>
          </div>

          <button
            className="md:hidden text-slate-700"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden border-t border-slate-200 py-4 space-y-2">
            <Link
              to="/formations"
              className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-lg font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              <GraduationCap className="w-4 h-4" />
              Formations
            </Link>

            <Link
              to="/assistance"
              className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-lg font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              <Phone className="w-4 h-4" />
              Assistance
            </Link>

            <Link
              to="/developpement"
              className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-lg font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              <Code className="w-4 h-4" />
              Développement
            </Link>

            <Link
              to="/blog"
              className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-lg font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              <BookOpen className="w-4 h-4" />
              Blog
            </Link>

            <Link
              to="/aides-formation"
              className="flex items-center gap-2 px-4 py-2 text-emerald-700 hover:bg-emerald-50 rounded-lg font-semibold"
              onClick={() => setIsMenuOpen(false)}
            >
              <Euro className="w-4 h-4" />
              Aides à la formation
            </Link>

            <Link
              to="/formulaire"
              className="block mx-4 mt-4 text-center bg-gradient-to-r from-orange-500 to-amber-600 text-white px-6 py-2.5 rounded-lg font-semibold"
              onClick={() => setIsMenuOpen(false)}
            >
              Nous contacter
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
