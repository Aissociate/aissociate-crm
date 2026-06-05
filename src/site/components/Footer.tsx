// @ts-nocheck
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, FileText, Shield, Accessibility, MessageSquare } from 'lucide-react';
import AdminLogo from './AdminLogo';

export default function Footer() {
  const links = [
    { icon: FileText, label: 'Mentions légales', to: '/mentions-legales' },
    { icon: Shield, label: 'Politique de confidentialité', to: '/confidentialite' },
    { icon: Accessibility, label: 'Accessibilité', to: '/accessibilite' },
    { icon: MessageSquare, label: 'Réclamations', to: '/reclamations' }
  ];

  return (
    <footer className="bg-slate-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <AdminLogo
                src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
                alt="AIssociate Logo"
                className="h-12 w-12 object-contain rounded-lg"
              />
              <h3 className="text-2xl font-bold">Aissociate</h3>
            </div>
            <div className="space-y-2 text-slate-300">
              <p>SARL – Capital 100 €</p>
              <div className="flex items-start gap-2">
                <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>36 chemin de l'État Major, 97417 Saint-Denis</p>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 flex-shrink-0" />
                <a href="tel:+262692246860" className="hover:text-orange-400 transition-colors">06 92 24 68 60</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 flex-shrink-0" />
                <a href="mailto:contact@aissociate.re" className="hover:text-orange-400 transition-colors">contact@aissociate.re</a>
              </div>
              <p>SIRET : 995 220 407 00010</p>
              <p>RCS Saint-Denis de La Réunion</p>
              <p>NDA : 04 97 37547 97</p>
              <p className="inline-flex items-center gap-2 mt-2">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                <span className="font-semibold text-orange-400">Actif</span>
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-bold mb-4">Navigation</h4>
            <ul className="space-y-3 text-slate-300">
              <li><Link to="/formations" className="hover:text-orange-400 transition-colors">Formations IA</Link></li>
              <li><Link to="/aides-formation" className="hover:text-orange-400 transition-colors">Financer ma formation (CPF, OPCO)</Link></li>
              <li><Link to="/assistance" className="hover:text-orange-400 transition-colors">Assistance &amp; chatbots IA</Link></li>
              <li><Link to="/developpement" className="hover:text-orange-400 transition-colors">Développement d'agents IA</Link></li>
              <li><Link to="/blog" className="hover:text-orange-400 transition-colors">Blog IA</Link></li>
              <li><Link to="/contact" className="hover:text-orange-400 transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-bold mb-4">Liens utiles</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {links.map((link, index) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={index}
                    to={link.to}
                    className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors group"
                  >
                    <Icon className="w-5 h-5 text-orange-400 group-hover:text-orange-300" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-8">
          <div className="flex flex-col items-center gap-6">
            <a
              href="https://certifopac.fr/qualiopi/certification/verification/?siren=995220407#webApp"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
              <img
                src="https://certifopac.fr/wp-content/uploads/2021/09/LogoQualiopi-300dpi-Avec-Marianne.png"
                alt="Certification Qualiopi - Vérifier le certificat"
                className="h-20 w-auto"
              />
            </a>
            <div className="text-center text-slate-400">
              <p>© {new Date().getFullYear()} Aissociate. Tous droits réservés.</p>
              <p className="mt-2 text-sm">Organisme de formation professionnelle</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
