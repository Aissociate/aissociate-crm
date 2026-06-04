import { Link, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

/**
 * Layout du site vitrine public : rend les pages publiques et ajoute un bouton
 * d'accès à l'espace Admin (CRM Aissociate) relié au login.
 *
 * L'auth est désormais gérée par l'unique AuthProvider du CRM (monté dans main.tsx) ;
 * la vitrine n'a plus son propre contexte d'auth.
 */
export default function SiteFrame() {
  return (
    <>
      <Outlet />
      <Link
        to="/login"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10 transition hover:bg-slate-800"
        title="Accès à l'espace Admin (CRM)"
      >
        <ShieldCheck className="h-4 w-4" /> Espace Admin
      </Link>
    </>
  );
}
