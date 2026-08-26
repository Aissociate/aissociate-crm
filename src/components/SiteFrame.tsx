import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ShieldCheck, MessageCircle } from 'lucide-react';
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
  const { pathname, hash } = useLocation();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return; // évite le double-comptage (StrictMode / re-render)
    lastTracked.current = pathname;
    void trackPageView(pathname);
  }, [pathname]);

  // Ancres inter-pages (ex. /contact -> /#faq) : le routeur SPA ne scrolle pas
  // nativement vers le hash après navigation. Saut instantané + une correction
  // différée (la position de la cible bouge pendant le chargement des images).
  useEffect(() => {
    if (!hash) return;
    const jump = () => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
    jump();
    const t = setTimeout(jump, 600);
    return () => clearTimeout(t);
  }, [pathname, hash]);

  return (
    <>
      <Outlet />
      {/* Canal de contact sans friction (très utilisé à La Réunion) */}
      <a
        href="https://wa.me/262692246860?text=Bonjour%2C%20je%20souhaite%20des%20informations%20sur%20vos%20formations%20IA."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Nous contacter sur WhatsApp"
        className="fixed bottom-5 left-5 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
      </a>
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
