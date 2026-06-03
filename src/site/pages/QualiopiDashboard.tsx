// @ts-nocheck
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  GraduationCap,
  Calendar,
  FileText,
  ClipboardCheck,
  Mail,
  Clock,
  Shield,
  Download,
  Activity,
  Key
} from 'lucide-react';
import { qualiopiClient } from '../lib/qualiopiClient';
import type { Tenant, UserQualiopi } from '../types/qualiopi';

export default function QualiopiDashboard() {
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [user, setUser] = useState<UserQualiopi | null>(null);
  const [stats, setStats] = useState({
    trainings: 0,
    sessions: 0,
    trainees: 0,
    pendingTasks: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [currentUser, currentTenant] = await Promise.all([
        qualiopiClient.getCurrentUser(),
        qualiopiClient.getCurrentTenant()
      ]);

      setUser(currentUser);
      setTenant(currentTenant);

      if (currentTenant) {
        const [trainings, sessions, trainees, tasks] = await Promise.all([
          qualiopiClient.getTrainings(),
          qualiopiClient.getSessions(),
          qualiopiClient.getTrainees(),
          qualiopiClient.getTasks('PENDING')
        ]);

        setStats({
          trainings: trainings.length,
          sessions: sessions.length,
          trainees: trainees.length,
          pendingTasks: tasks.length
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const modules = [
    {
      icon: GraduationCap,
      title: 'Formations',
      description: 'Gérer le catalogue de formations',
      color: 'from-blue-500 to-blue-600',
      path: '/qualiopi/trainings',
      stat: stats.trainings
    },
    {
      icon: Calendar,
      title: 'Sessions',
      description: 'Planifier et suivre les sessions',
      color: 'from-emerald-500 to-emerald-600',
      path: '/qualiopi/sessions',
      stat: stats.sessions
    },
    {
      icon: Users,
      title: 'Stagiaires',
      description: 'Gérer les apprenants',
      color: 'from-purple-500 to-purple-600',
      path: '/qualiopi/trainees',
      stat: stats.trainees
    },
    {
      icon: FileText,
      title: 'Templates',
      description: 'Documents et modèles',
      color: 'from-orange-500 to-orange-600',
      path: '/qualiopi/templates'
    },
    {
      icon: ClipboardCheck,
      title: 'Questionnaires',
      description: 'Évaluations à chaud et à froid',
      color: 'from-pink-500 to-pink-600',
      path: '/qualiopi/questionnaires'
    },
    {
      icon: Mail,
      title: 'Emails',
      description: 'Templates et logs d\'envoi',
      color: 'from-cyan-500 to-cyan-600',
      path: '/qualiopi/emails'
    },
    {
      icon: Clock,
      title: 'Tâches',
      description: 'Automatisations et relances',
      color: 'from-yellow-500 to-yellow-600',
      path: '/qualiopi/tasks',
      stat: stats.pendingTasks,
      badge: stats.pendingTasks > 0
    },
    {
      icon: Shield,
      title: 'Audit',
      description: 'Journal d\'activité',
      color: 'from-slate-500 to-slate-600',
      path: '/qualiopi/audit'
    },
    {
      icon: Download,
      title: 'Preuves',
      description: 'Exports et archives',
      color: 'from-teal-500 to-teal-600',
      path: '/qualiopi/proofs'
    },
    {
      icon: Activity,
      title: 'Logs',
      description: 'Logs des fonctions',
      color: 'from-gray-500 to-gray-600',
      path: '/qualiopi/logs'
    },
    {
      icon: Key,
      title: 'Configuration API',
      description: 'Vérifier les secrets Supabase',
      color: 'from-red-500 to-red-600',
      path: '/qualiopi/secrets-check'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center animate-in fade-in duration-500">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-6 text-slate-600 text-lg font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Suivi Administratif Qualiopi
              </h1>
              {tenant && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Building2 className="w-5 h-5" />
                  <span className="font-medium">{tenant.name}</span>
                  {tenant.siret && (
                    <span className="text-sm">• SIRET: {tenant.siret}</span>
                  )}
                </div>
              )}
            </div>
            {user && (
              <div className="text-right">
                <p className="text-sm text-slate-600">
                  {user.first_name} {user.last_name}
                </p>
                <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                  {user.role}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, index) => {
            const Icon = module.icon;
            return (
              <button
                key={module.path}
                onClick={() => navigate(module.path)}
                style={{ animationDelay: `${index * 50}ms` }}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-100 hover:border-slate-200 text-left relative group hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4"
              >
                {module.badge && module.stat && module.stat > 0 && (
                  <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                    {module.stat}
                  </span>
                )}
                <div className={`w-14 h-14 bg-gradient-to-br ${module.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{module.title}</h3>
                <p className="text-slate-600 text-sm">{module.description}</p>
                {module.stat !== undefined && !module.badge && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{module.stat}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {stats.pendingTasks > 0 && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4 animate-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-2 text-yellow-800">
              <Clock className="w-5 h-5 animate-pulse" />
              <p className="font-semibold">
                Vous avez {stats.pendingTasks} tâche{stats.pendingTasks > 1 ? 's' : ''} en attente
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
