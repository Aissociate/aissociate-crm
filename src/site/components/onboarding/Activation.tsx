// @ts-nocheck
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, Calendar, FileText, TrendingUp, AlertTriangle } from 'lucide-react';
import AdminLogo from '../AdminLogo';

export default function Activation() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();

  useEffect(() => {
    activateProfile();
  }, [profile]);

  const activateProfile = async () => {
    if (profile && profile.status === 'validated') {
      await supabase
        .from('profiles')
        .update({
          status: 'active',
          activated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      await refreshProfile();
    }
  };

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
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mb-6">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Vous êtes maintenant activé
          </h1>
          <p className="text-lg text-slate-600">
            Vous avez accès aux outils, aux scripts et au process.
          </p>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl shadow-xl p-8 text-white mb-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 flex-shrink-0" />
            <div>
              <h3 className="text-2xl font-bold mb-2">Rappel Important</h3>
              <p className="text-xl">
                Vous n'êtes pas là pour improviser. Vous êtes là pour exécuter un système qui fonctionne.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-4">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Accès CRM</h2>
            <p className="text-slate-700 mb-4">
              Vous avez désormais accès en lecture au CRM pour consulter vos leads et suivre vos opportunités.
            </p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all">
              Accéder au CRM
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Calendrier</h2>
            <p className="text-slate-700 mb-4">
              Synchronisez votre calendrier avec Calendly pour gérer vos rendez-vous efficacement.
            </p>
            <button className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition-all">
              Configurer Calendly
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Scripts Officiels</h2>
              <p className="text-slate-700">
                Téléchargez et utilisez uniquement les scripts validés pour garantir la conformité.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <span className="font-medium text-slate-900">
                {profile?.role === 'fixer' ? 'Script de prospection' : 'Script de closing'}
              </span>
              <button className="text-orange-600 hover:text-orange-700 font-semibold">
                Télécharger
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <span className="font-medium text-slate-900">Guide de gestion des objections</span>
              <button className="text-orange-600 hover:text-orange-700 font-semibold">
                Télécharger
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <span className="font-medium text-slate-900">Process de remontée d'info</span>
              <button className="text-orange-600 hover:text-orange-700 font-semibold">
                Télécharger
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => navigate('/onboarding/dashboard')}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
          >
            Voir mon Dashboard KPI
          </button>
          <button
            onClick={() => navigate('/onboarding/amelioration')}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg"
          >
            Feedback & Amélioration
          </button>
        </div>
      </div>
    </div>
  );
}
