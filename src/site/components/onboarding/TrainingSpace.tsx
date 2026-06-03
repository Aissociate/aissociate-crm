// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { BookOpen, CheckCircle2, Lock, Play } from 'lucide-react';
import AdminLogo from '../AdminLogo';

export default function TrainingSpace() {
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

  const completeModule = async (moduleType: 'common' | 'role') => {
    if (!profile) return;

    const field = moduleType === 'common' ? 'module_common_completed' : 'module_role_completed';

    await supabase
      .from('training_progress')
      .update({ [field]: true })
      .eq('profile_id', profile.id);

    await loadProgress();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Aissociate Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Formation Onboarding
          </h1>
          <p className="text-lg text-slate-600">
            Bienvenue dans l'onboarding Aissociate. Cette formation interne est obligatoire.
          </p>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 text-white mb-8">
          <p className="text-xl font-semibold text-center">
            Si vous suivez le cadre, le système fait le reste.
          </p>
        </div>

        <div className="space-y-6">
          <div className={`bg-white rounded-xl shadow-lg p-8 ${!progress?.module_common_completed ? 'border-2 border-orange-400' : ''}`}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-4 flex-1">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${progress?.module_common_completed ? 'bg-green-100' : 'bg-orange-100'}`}>
                  {progress?.module_common_completed ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <BookOpen className="w-6 h-6 text-orange-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    Module Commun
                  </h2>
                  <p className="text-slate-600 mb-4">
                    Formation obligatoire pour tous les commerciaux
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-slate-700">
                <Play className="w-5 h-5 text-blue-600" />
                <span>Vision & funnel Aissociate</span>
              </div>
              <div className="flex items-center gap-3 text-slate-700">
                <Play className="w-5 h-5 text-blue-600" />
                <span>Cadre légal & Qualiopi (commercial)</span>
              </div>
              <div className="flex items-center gap-3 text-slate-700">
                <Play className="w-5 h-5 text-blue-600" />
                <span>Éthique et conformité CPF</span>
              </div>
            </div>

            {!progress?.module_common_completed && (
              <button
                onClick={() => completeModule('common')}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Marquer comme terminé
              </button>
            )}
          </div>

          <div className={`bg-white rounded-xl shadow-lg p-8 ${progress?.module_common_completed && !progress?.module_role_completed ? 'border-2 border-orange-400' : 'opacity-60'}`}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-start gap-4 flex-1">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${progress?.module_role_completed ? 'bg-green-100' : progress?.module_common_completed ? 'bg-orange-100' : 'bg-slate-100'}`}>
                  {progress?.module_role_completed ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : progress?.module_common_completed ? (
                    <BookOpen className="w-6 h-6 text-orange-600" />
                  ) : (
                    <Lock className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">
                    Module {profile?.role === 'fixer' ? 'Fixer' : 'Closer'}
                  </h2>
                  <p className="text-slate-600 mb-4">
                    Formation spécifique à votre rôle
                  </p>
                </div>
              </div>
            </div>

            {profile?.role === 'fixer' ? (
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-slate-700">
                  <Play className="w-5 h-5 text-blue-600" />
                  <span>Script officiel</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Play className="w-5 h-5 text-blue-600" />
                  <span>Ce qu'il peut / ne peut pas dire</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Play className="w-5 h-5 text-blue-600" />
                  <span>Gestion des objections</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-slate-700">
                  <Play className="w-5 h-5 text-blue-600" />
                  <span>Structure de call</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Play className="w-5 h-5 text-blue-600" />
                  <span>Cadre CPF</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <Play className="w-5 h-5 text-blue-600" />
                  <span>Décision éclairée</span>
                </div>
              </div>
            )}

            {progress?.module_common_completed && !progress?.module_role_completed && (
              <button
                onClick={() => completeModule('role')}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
              >
                Marquer comme terminé
              </button>
            )}

            {!progress?.module_common_completed && (
              <div className="text-center text-slate-500 italic">
                Terminez d'abord le module commun
              </div>
            )}
          </div>
        </div>

        {progress?.module_common_completed && progress?.module_role_completed && (
          <div className="mt-8 text-center">
            <button
              onClick={() => navigate('/onboarding/validation')}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-12 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
            >
              Passer à la validation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
