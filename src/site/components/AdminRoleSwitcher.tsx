// @ts-nocheck
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Phone, Handshake, ArrowLeftRight, X } from 'lucide-react';

const roleConfig = {
  admin: { label: 'Admin', icon: Shield, color: 'bg-slate-700', route: '/admin' },
  fixer: { label: 'Fixer', icon: Phone, color: 'bg-blue-600', route: '/onboarding/dashboard/fixer' },
  closer: { label: 'Closer', icon: Handshake, color: 'bg-emerald-600', route: '/onboarding/dashboard/closer' },
} as const;

export default function AdminRoleSwitcher() {
  const { profile, adminViewRole, setAdminViewRole } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!profile?.is_admin || !adminViewRole) return null;

  const current = roleConfig[adminViewRole];
  const CurrentIcon = current.icon;
  const otherRoles = Object.entries(roleConfig).filter(([key]) => key !== adminViewRole);

  const handleSwitch = (roleId: string) => {
    const role = roleConfig[roleId as keyof typeof roleConfig];
    setAdminViewRole(roleId as 'admin' | 'fixer' | 'closer');
    navigate(role.route, { replace: true });
    setOpen(false);
  };

  const handleBackToSelector = () => {
    setAdminViewRole(null);
    navigate('/admin/select-role', { replace: true });
    setOpen(false);
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {open && (
        <div className="absolute bottom-16 left-0 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 min-w-[220px] animate-in slide-in-from-bottom-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 pt-1 pb-2">
            Changer de vue
          </div>
          {otherRoles.map(([key, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={key}
                onClick={() => handleSwitch(key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
              >
                <div className={`w-8 h-8 ${config.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium text-slate-700 text-sm">{config.label}</span>
              </button>
            );
          })}
          <div className="border-t border-slate-100 mt-2 pt-2">
            <button
              onClick={handleBackToSelector}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
            >
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <ArrowLeftRight className="w-4 h-4 text-white" />
              </div>
              <span className="font-medium text-slate-700 text-sm">Page de selection</span>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className={`${current.color} text-white px-4 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2.5 group`}
      >
        {open ? (
          <X className="w-5 h-5" />
        ) : (
          <CurrentIcon className="w-5 h-5" />
        )}
        <span className="font-semibold text-sm">
          {open ? 'Fermer' : `Vue ${current.label}`}
        </span>
        {!open && (
          <ArrowLeftRight className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
        )}
      </button>
    </div>
  );
}
