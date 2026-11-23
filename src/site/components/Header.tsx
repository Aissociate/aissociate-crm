import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowRight, Menu, MessageCircle, PhoneCall, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { trackClick } from '@/lib/track';

// Même langage visuel que la page /agents-ia : neutres, orange plein, angles doux.
const LIENS = [
  { to: '/formations', label: 'Formations' },
  { to: '/aides-formation', label: 'Financements' },
  { to: '/agents-ia', label: 'Agents IA', nouveau: true },
  { to: '/assistance', label: 'Assistance' },
  { to: '/developpement', label: 'Développement' },
  { to: '/blog', label: 'Blog' },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const fermer = () => setIsMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-white/90 font-sans backdrop-blur">
      {/* Lien d'évitement : premier élément focalisable, visible uniquement au clavier */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-xl focus:bg-neutral-950 focus:px-4 focus:py-2 focus:text-white"
      >
        Aller au contenu
      </a>
      <nav aria-label="Navigation principale" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex shrink-0 items-center" onClick={fermer} aria-label="Aissociate, accueil">
            <Logo size="sm" tagline fond="clair" />
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {LIENS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-600 hover:text-neutral-950'}`
                }
              >
                {l.label}
                {l.nouveau && <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-neutral-950">Gratuit</span>}
              </NavLink>
            ))}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <a
              href="tel:+262692246860"
              className="hidden items-center gap-2 whitespace-nowrap text-sm font-semibold text-neutral-700 transition-colors hover:text-orange-600 xl:flex"
              aria-label="Appeler Aissociate au 06 92 24 68 60"
              onClick={() => trackClick('tel')}
            >
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              0692 24 68 60
            </a>
            <Link
              to="/formulaire"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-orange-400"
            >
              Nous contacter <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <button
            className="rounded-lg p-2 text-neutral-700 hover:bg-neutral-100 lg:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={isMenuOpen}
            aria-controls="menu-mobile"
          >
            {isMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>

        {isMenuOpen && (
          <div id="menu-mobile" className="space-y-1 border-t border-neutral-200 py-4 lg:hidden">
            {LIENS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={fermer}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium ${isActive ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-700 hover:bg-neutral-50'}`
                }
              >
                {l.label}
                {l.nouveau && <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-neutral-950">Gratuit</span>}
              </NavLink>
            ))}
            <a
              href="tel:+262692246860"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-neutral-700 hover:bg-neutral-50"
              onClick={() => trackClick('tel')}
            >
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              Appeler : 0692 24 68 60
            </a>
            <a
              href="https://wa.me/262692246860?text=Bonjour%2C%20je%20souhaite%20des%20informations%20sur%20vos%20formations%20IA."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-emerald-700 hover:bg-emerald-50"
              onClick={() => trackClick('whatsapp')}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a>
            <Link
              to="/formulaire"
              className="mx-4 !mt-4 flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-neutral-950"
              onClick={fermer}
            >
              Nous contacter <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
