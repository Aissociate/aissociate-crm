// @ts-nocheck
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, LayoutDashboard } from 'lucide-react';

export default function AdminFloatingButton() {
  const { profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  if (!profile?.is_admin) {
    return null;
  }

  const handleNavigate = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <>
      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50">
        {menuOpen && (
          <div className="absolute bottom-20 right-0 bg-white rounded-lg shadow-xl border border-slate-200 py-2 w-64 mb-2">
            <button
              onClick={() => handleNavigate('/admin')}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3"
            >
              <LayoutDashboard className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="font-semibold text-slate-900">Dashboard Admin</div>
                <div className="text-xs text-slate-500">Vue principale</div>
              </div>
            </button>
          </div>
        )}

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600"
        >
          <Shield className="w-7 h-7 text-white" />
        </button>
      </div>
    </>
  );
}
