import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { trackPageView } from '@/lib/track';

/**
 * Layout du site vitrine public : rend les pages publiques et ajoute un bouton
 * d'accès à l'espace Admin (CRM Aissociate) relié au login.
 *
 * L'auth est désormais gérée par l'unique AuthProvider du CRM (monté dans main.tsx) ;
 * la vitrine n'a plus son propre contexte d'auth.
 *
 * Analytics 1st-party : chaque page publique consultée est enregistrée dans
 * `page_views` (visiteur anonyme), alimentant les KPI « visiteurs » du dashboard.
 */
export default function SiteFrame() {
  const { pathname } = useLocation();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return; // évite le double-comptage (StrictMode / re-render)
    lastTracked.current = pathname;
    void trackPageView(pathname);
  }, [pathname]);

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
