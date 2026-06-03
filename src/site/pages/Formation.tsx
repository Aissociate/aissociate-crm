// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BookOpen, CheckCircle2, ArrowLeft, Video, FileText } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';

export default function Formation() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, [profile]);

  const loadProgress = async () => {
    if (!profile) return;

    const { data } = await supabase
      .from('training_progress')
      .select('*')
      .eq('profile_id', profile.id)
      .maybeSingle();

    setProgress(data);
    setLoading(false);
  };

  const handleBack = () => {
    if (profile?.role === 'fixer') {
      navigate('/onboarding/dashboard/fixer');
    } else if (profile?.role === 'closer') {
      navigate('/onboarding/dashboard/closer');
    } else if (profile?.role === 'admin') {
      navigate('/admin');
    } else if (profile?.role === 'manager') {
      navigate('/manager');
    } else {
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-xl text-slate-600">Chargement...</div>
      </div>
    );
  }

  const commonModules = [
    {
      title: 'Vision & Funnel Aissociate',
      description: 'Comprendre la vision globale et le parcours client',
      duration: '15 min',
      type: 'video',
      completed: progress?.module_common_completed,
      link: '/formation/vision-funnel',
    },
    {
      title: 'Cadre légal & Qualiopi',
      description: 'Formation sur les aspects légaux et la certification',
      duration: '20 min',
      type: 'document',
      completed: progress?.module_common_completed,
      link: '/formation/cadre-legal-qualiopi',
    },
    {
      title: 'Fonctionnement du CRM',
      description: 'Maîtriser l\'outil au cœur de notre activité',
      duration: '25 min',
      type: 'video',
      completed: progress?.module_common_completed,
      link: '/formation/fonctionnement-crm',
    },
    {
      title: 'Le Programme de Formation',
      description: 'Structure et organisation complète de la formation',
      duration: '20 min',
      type: 'document',
      completed: progress?.module_common_completed,
      link: '/formation/programme-formation',
    },
    {
      title: 'Objections Courantes',
      description: 'Guide complet des objections et réponses conformes pour Fixers et Closers',
      duration: '30 min',
      type: 'document',
      completed: progress?.module_common_completed,
      link: '/formation/objections-courantes',
    },
  ];

  const fixerModules: Array<{ title: string; description: string; duration: string; type: string; completed: any; link?: string }> = [
    {
      title: 'Script officiel Fixer',
      description: 'Le script à suivre pour vos appels',
      duration: '30 min',
      type: 'document',
      completed: progress?.module_role_completed,
    },
    {
      title: 'Ce qu\'il peut / ne peut pas dire',
      description: 'Limites légales et éthiques dans vos conversations',
      duration: '20 min',
      type: 'video',
      completed: progress?.module_role_completed,
    },
    {
      title: 'Gestion des objections',
      description: 'Techniques pour gérer les objections courantes',
      duration: '35 min',
      type: 'video',
      completed: progress?.module_role_completed,
    },
  ];

  const closerModules = [
    {
      title: 'Le Script et ses Explications',
      description: 'Comment structurer efficacement un appel de closing',
      duration: '40 min',
      type: 'document',
      completed: progress?.module_role_completed,
      link: '/formation/script-explications',
    },
    {
      title: 'Script Closer CPF',
      description: 'Script complet pour les demandes de renseignements Formation IA - CPF',
      duration: '45 min',
      type: 'document',
      completed: progress?.module_role_completed,
      link: '/formation/script-closer-cpf',
    },
    {
      title: 'Cadre CPF',
      description: 'Maîtriser le cadre réglementaire du CPF',
      duration: '30 min',
      type: 'document',
      completed: progress?.module_role_completed,
      link: '/formation/cadre-cpf',
    },
    {
      title: 'Les différents modes de financement',
      description: 'Comprendre toutes les options de financement',
      duration: '25 min',
      type: 'document',
      completed: progress?.module_role_completed,
      link: '/formation/modes-financement',
    },
  ];

  const roleModules = profile?.role === 'fixer' ? fixerModules : profile?.role === 'closer' ? closerModules : [];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="w-5 h-5 text-blue-600" />;
      case 'document':
        return <FileText className="w-5 h-5 text-green-600" />;
      default:
        return <FileText className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-slate-700" />
            </button>
            <AdminLogo />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Centre de Formation</h1>
              <p className="text-sm text-slate-600">Ressources et modules de formation</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 text-white mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <BookOpen className="w-12 h-12" />
            <h2 className="text-3xl font-bold">Formation Continue</h2>
          </div>
          <p className="text-xl text-center">
            Accédez à toutes les ressources de formation pour développer vos compétences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Modules Communs</h3>
                <p className="text-sm text-slate-600">Formation obligatoire pour tous</p>
              </div>
            </div>
            <div className="space-y-4">
              {commonModules.map((module, index) => (
                <div
                  key={index}
                  className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => module.link && navigate(module.link)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3 flex-1">
                      {getTypeIcon(module.type)}
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">{module.title}</h4>
                        <p className="text-sm text-slate-600 mt-1">{module.description}</p>
                      </div>
                    </div>
                    {module.completed && (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-500">{module.duration}</span>
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
                      Accéder
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {roleModules.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Modules {profile?.role === 'fixer' ? 'Fixer' : 'Closer'}
                  </h3>
                  <p className="text-sm text-slate-600">Formation spécifique à votre rôle</p>
                </div>
              </div>
              <div className="space-y-4">
                {roleModules.map((module, index) => (
                  <div
                    key={index}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => module.link && navigate(module.link)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-3 flex-1">
                        {getTypeIcon(module.type)}
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">{module.title}</h4>
                          <p className="text-sm text-slate-600 mt-1">{module.description}</p>
                        </div>
                      </div>
                      {module.completed && (
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                      <span className="text-xs text-slate-500">{module.duration}</span>
                      <button className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold">
                        Accéder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Ressources Complémentaires</h3>
              <p className="text-sm text-slate-600">Documents et outils pratiques</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
              <FileText className="w-8 h-8 text-blue-600 mb-3" />
              <h4 className="font-semibold text-slate-900 mb-2">Guide des meilleures pratiques</h4>
              <p className="text-sm text-slate-600 mb-3">
                Techniques et conseils pour optimiser vos performances
              </p>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-semibold">
                Télécharger
              </button>
            </div>
            <div className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
              <FileText className="w-8 h-8 text-green-600 mb-3" />
              <h4 className="font-semibold text-slate-900 mb-2">Contrats</h4>
              <p className="text-sm text-slate-600 mb-3">
                Modèles de contrats et documents juridiques validés
              </p>
              <button className="text-sm text-green-600 hover:text-green-700 font-semibold">
                Télécharger
              </button>
            </div>
            <div className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
              <FileText className="w-8 h-8 text-purple-600 mb-3" />
              <h4 className="font-semibold text-slate-900 mb-2">FAQ & Support</h4>
              <p className="text-sm text-slate-600 mb-3">
                Réponses aux questions fréquentes et support
              </p>
              <button className="text-sm text-purple-600 hover:text-purple-700 font-semibold">
                Consulter
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
