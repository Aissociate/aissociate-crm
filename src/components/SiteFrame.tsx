import { Link, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
// AuthProvider du site OF : nécessaire car des composants vitrine (header, AdminLogo…)
// utilisent le useAuth du site. Monté une seule fois pour toutes les pages publiques.
import { AuthProvider as SiteAuthProvider } from '@/site/contexts/AuthContext';

/**
 * Layout du site vitrine public : fournit le contexte d'auth du site et ajoute
 * un bouton d'accès à l'espace Admin (CRM Aissociate) relié au login.
 */
export default function SiteFrame() {
  return (
    <SiteAuthProvider>
      <Outlet />
      <Link
        to="/login"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10 transition hover:bg-slate-800"
        title="Accès à l'espace Admin (CRM)"
      >
        <ShieldCheck className="h-4 w-4" /> Espace Admin
      </Link>
    </SiteAuthProvider>
  );
}
