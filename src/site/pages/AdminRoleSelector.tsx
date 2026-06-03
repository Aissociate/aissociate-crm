// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Phone, Handshake, LogOut, ArrowRight } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';

const roles = [
  {
    id: 'admin' as const,
    title: 'Administration',
    description: 'Gestion des utilisateurs, KPIs, prospects et suivi global de la plateforme',
    icon: Shield,
    color: 'from-slate-700 to-slate-900',
    hoverColor: 'hover:border-slate-400',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    route: '/admin',
  },
  {
    id: 'fixer' as const,
    title: 'Fixer',
    description: 'Tester le parcours Fixer : prospection, appels sortants, prise de RDV et CRM',
    icon: Phone,
    color: 'from-blue-600 to-blue-800',
    hoverColor: 'hover:border-blue-400',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
    route: '/onboarding/dashboard/fixer',
  },
  {
    id: 'closer' as const,
    title: 'Closer',
    description: 'Tester le parcours Closer : closing des dossiers, suivi financement et CRM',
    icon: Handshake,
    color: 'from-emerald-600 to-emerald-800',
    hoverColor: 'hover:border-emerald-400',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    route: '/onboarding/dashboard/closer',
  },
];

export default function AdminRoleSelector() {
  const navigate = useNavigate();
  const { profile, signOut, setAdminViewRole } = useAuth();

  const handleSelectRole = (role: typeof roles[number]) => {
    setAdminViewRole(role.id);
    navigate(role.route, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="absolute top-6 right-6">
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 hover:bg-white/80 rounded-lg transition-all text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Deconnexion
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-16 pb-12">
        <div className="text-center mb-12">
          <AdminLogo
            src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
            alt="Aissociate Logo"
            className="h-14 w-auto object-contain mx-auto mb-8"
          />
          <h1 className="text-3xl font-bold text-slate-900 mb-3">
            Bonjour, {profile?.full_name || profile?.email?.split('@')[0]}
          </h1>
          <p className="text-lg text-slate-500 max-w-md mx-auto">
            Choisissez le mode dans lequel vous souhaitez travailler
          </p>
        </div>

        <div className="grid gap-5">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                onClick={() => handleSelectRole(role)}
                className={`group relative w-full bg-white border-2 border-slate-200 ${role.hoverColor} rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}
              >
                <div className="flex items-center gap-5">
                  <div className={`flex-shrink-0 w-14 h-14 ${role.iconBg} rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
                    <Icon className={`w-7 h-7 ${role.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-slate-900 mb-1">
                      {role.title}
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      {role.description}
                    </p>
                  </div>
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center transition-all duration-200 group-hover:bg-slate-900 group-hover:text-white">
                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-400 mt-10">
          Vous pourrez changer de mode a tout moment depuis votre dashboard
        </p>
      </div>
    </div>
  );
}
