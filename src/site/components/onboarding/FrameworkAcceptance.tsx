// @ts-nocheck
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, Download, FileText, TrendingUp, Shield } from 'lucide-react';
import AdminLogo from '../AdminLogo';

export default function FrameworkAcceptance() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    if (!profile || !accepted) return;

    setLoading(true);
    try {
      await supabase.from('profiles').update({
        status: 'in_training',
        framework_accepted_at: new Date().toISOString(),
      }).eq('id', profile.id);

      await supabase.from('training_progress').insert({
        profile_id: profile.id,
      });

      await refreshProfile();
      navigate('/onboarding/formation');
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
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
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Avant d'aller plus loin, voici les règles du jeu
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Chez Aissociate, la performance repose sur la clarté.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-12 mb-8">
          <p className="text-lg text-slate-700 mb-8">
            Vous allez travailler dans un cadre précis :
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Un rôle défini</h3>
              <p className="text-slate-600 text-sm">Fixer ou Closer, chacun son expertise</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Un discours encadré</h3>
              <p className="text-slate-600 text-sm">Scripts validés et conformes</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Règles éthiques strictes</h3>
              <p className="text-slate-600 text-sm">CPF, conformité, transparence</p>
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
            <h3 className="font-bold text-xl text-slate-900 mb-4">Ce cadre protège :</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                <span className="text-slate-700">Les clients - garantie d'un service de qualité</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                <span className="text-slate-700">L'organisme - conformité Qualiopi et CPF</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                <span className="text-slate-700">Vous, en tant que professionnel - cadre clair et sécurisé</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl p-6 text-white mb-8">
            <h3 className="font-bold text-xl mb-4">Téléchargez votre fiche de rôle</h3>
            <p className="mb-4">Prenez le temps de lire attentivement les responsabilités et attentes de votre rôle.</p>
            <button className="bg-white text-orange-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all flex items-center gap-2">
              <Download className="w-5 h-5" />
              Télécharger la fiche {profile?.role === 'fixer' ? 'Fixer' : 'Closer'}
            </button>
          </div>

          <div className="border-t-2 border-slate-200 pt-8">
            <label className="flex items-start gap-4 cursor-pointer mb-8">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="w-6 h-6 text-orange-600 border-slate-300 rounded focus:ring-orange-500 mt-1"
              />
              <span className="text-lg text-slate-700 font-medium">
                J'ai lu et j'accepte le cadre Aissociate. Je comprends que je dois respecter les règles,
                les scripts et les procédures établies pour garantir la qualité et la conformité.
              </span>
            </label>

            <button
              onClick={handleAccept}
              disabled={!accepted || loading}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Chargement...' : 'Accéder à la formation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
