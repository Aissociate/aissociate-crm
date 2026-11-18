import { Link } from 'react-router-dom';
import { ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import AdminLogo from './AdminLogo';

// Même langage visuel que la page /agents-ia : fond neutral-950, orange plein, angles doux.
const SERVICES = [
  { to: '/formations', label: 'Formations IA' },
  { to: '/aides-formation', label: 'Financer ma formation (CPF, OPCO)' },
  { to: '/agents-ia', label: 'Studio IA : votre équipe d\'agents IA' },
  { to: '/assistance', label: 'Assistance & chatbots IA' },
  { to: '/developpement', label: 'Développement d\'agents IA' },
  { to: '/blog', label: 'Blog IA' },
  { to: '/contact', label: 'Contact' },
];
const LEGAL = [
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/confidentialite', label: 'Politique de confidentialité' },
  { to: '/accessibilite', label: 'Accessibilité' },
  { to: '/reclamations', label: 'Réclamations' },
];

export default function Footer() {
  return (
    <footer className="bg-neutral-950 font-sans text-white">
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-14 sm:px-6 sm:pb-12 lg:px-8">
        <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xl font-semibold tracking-tight">Un projet, une question ?</p>
            <p className="mt-1 text-sm text-neutral-400">Un conseiller vous répond sous 24 h ouvrées. Essai gratuit de 7 jours pour le Studio IA.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/studio/demarrer?depuis=pied" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600">
              Essayer le Studio IA <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link to="/formulaire" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10">
              Nous contacter
            </Link>
          </div>
        </div>

        <div className="mt-12 grid gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <AdminLogo
                src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
                alt="AIssociate Logo"
                className="h-11 w-11 rounded-xl object-contain"
              />
              <p className="text-xl font-semibold tracking-tight">Aissociate</p>
            </div>
            <ul className="mt-5 space-y-2.5 text-sm text-neutral-300">
              <li className="flex items-start gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" aria-hidden="true" /> 36 chemin de l'État Major, 97417 Saint-Denis</li>
              <li className="flex items-center gap-2.5"><Phone className="h-4 w-4 shrink-0 text-orange-400" aria-hidden="true" /> <a href="tel:+262692246860" className="transition-colors hover:text-white">06 92 24 68 60</a></li>
              <li className="flex items-center gap-2.5"><Mail className="h-4 w-4 shrink-0 text-orange-400" aria-hidden="true" /> <a href="mailto:contact@aissociate.re" className="transition-colors hover:text-white">contact@aissociate.re</a></li>
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-neutral-500">
              SARL – Capital 100 € · SIRET : 995 220 407 00010<br />
              RCS Saint-Denis de La Réunion · NDA : 04 97 37547 97
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Navigation</p>
            <ul className="mt-4 space-y-2.5 text-sm text-neutral-300">
              {SERVICES.map((l) => <li key={l.to}><Link to={l.to} className="transition-colors hover:text-white">{l.label}</Link></li>)}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Liens utiles</p>
            <ul className="mt-4 space-y-2.5 text-sm text-neutral-300">
              {LEGAL.map((l) => <li key={l.to}><Link to={l.to} className="transition-colors hover:text-white">{l.label}</Link></li>)}
            </ul>
            <a
              href="https://certifopac.fr/qualiopi/certification/verification/?siren=995220407#webApp"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-block rounded-xl bg-white p-3"
            >
              <img
                src="https://certifopac.fr/wp-content/uploads/2021/09/LogoQualiopi-300dpi-Avec-Marianne.png"
                alt="Certification Qualiopi - Vérifier le certificat"
                className="h-16 w-auto"
                loading="lazy"
              />
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Aissociate. Tous droits réservés. Organisme de formation professionnelle.</p>
          <Link to="/login" className="transition-colors hover:text-neutral-300" title="Accès à l'espace Admin (CRM)">Espace Admin</Link>
        </div>
      </div>
    </footer>
  );
}
