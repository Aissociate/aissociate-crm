import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

/**
 * Cadre du site vitrine public : affiche la page OF telle quelle + un bouton
 * d'accès à l'espace Admin (CRM Aissociate) relié au login.
 */
export default function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
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
