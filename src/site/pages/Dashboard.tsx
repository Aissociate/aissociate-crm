// @ts-nocheck
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader2, Clock, CheckCircle, LogOut } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();
  const [checkingApplication, setCheckingApplication] = useState(false);

  useEffect(() => {
    console.log('📍 Dashboard: loading=', loading, 'user=', !!user, 'profile=', profile);

    if (loading) return;

    if (!user) {
      console.log('➡️ No user, redirecting to login');
      navigate('/login');
      return;
    }

    if (!profile) {
      console.log('➡️ No profile, redirecting to onboarding form');
      navigate('/onboarding/formulaire', { replace: true });
      return;
    }

    if (profile?.is_admin) {
      console.log('➡️ Admin user, redirecting to role selector');
      navigate('/admin/select-role', { replace: true });
      return;
    }

    const checkApplicationAndRedirect = async () => {
      if (profile.status === 'new_user' || !profile.role) {
        console.log('🔍 Checking if user has an existing application...');
        setCheckingApplication(true);

        const { data: application } = await supabase
          .from('applications')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();

        setCheckingApplication(false);

        if (application) {
          console.log('✅ Application found, staying on dashboard');
          return;
        }

        console.log('➡️ No application found, redirecting to onboarding form');
        navigate('/onboarding/formulaire', { replace: true });
        return;
      }

      if (profile.status === 'pending_audio') {
        const { data: training } = await supabase
          .from('training_progress')
          .select('test_call_url')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (!training?.test_call_url) {
          console.log('➡️ Pending audio but no upload yet, redirecting to recording');
          navigate('/onboarding/enregistrement', { replace: true });
          return;
        }

        console.log('✅ Audio already uploaded, staying on dashboard (waiting validation)');
        return;
      }

      if (profile.status === 'active') {
        console.log('➡️ Active user, redirecting to role-specific dashboard');
        if (profile.role === 'fixer') {
          navigate('/onboarding/dashboard/fixer', { replace: true });
        } else if (profile.role === 'closer') {
          navigate('/onboarding/dashboard/closer', { replace: true });
        } else {
          console.log('⚠️ No role specified for active user');
          navigate('/onboarding/formulaire', { replace: true });
        }
        return;
      }

      if (profile.status === 'rejected') {
        console.log('➡️ Rejected user, redirecting to rejected page');
        navigate('/onboarding/rejected', { replace: true });
        return;
      }
    };

    checkApplicationAndRedirect();
  }, [user, profile, loading, navigate]);

  if (loading || checkingApplication) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (profile?.status === 'pending_audio') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full relative">
          <button
            onClick={signOut}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Se déconnecter"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <div className="text-center mb-8">
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Aissociate Logo"
              className="h-16 w-auto object-contain mx-auto mb-6"
            />
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Enregistrement soumis
            </h1>
            <p className="text-slate-600 mb-6">
              Votre enregistrement a été envoyé avec succès et est en cours de validation par notre équipe.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900">Enregistrement reçu</p>
                <p className="text-sm text-green-700">Votre audio a bien été enregistré dans notre système</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-yellow-900">En cours de validation</p>
                <p className="text-sm text-yellow-700">Notre équipe écoute votre enregistrement et vous fera un retour rapidement</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Prochaines étapes :</strong> Dès que votre enregistrement sera validé, vous recevrez une notification et vous pourrez accéder à votre espace commercial. Nous nous efforçons de traiter toutes les validations dans les 24 heures.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (profile?.status === 'new_user') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full relative">
          <button
            onClick={signOut}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Se déconnecter"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <div className="text-center mb-8">
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Aissociate Logo"
              className="h-16 w-auto object-contain mx-auto mb-6"
            />
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Parcours d'intégration
            </h1>
            <p className="text-slate-600 mb-6">
              Complétez les étapes suivantes pour finaliser votre candidature
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => navigate('/onboarding/questionnaire')}
              className="w-full p-6 border-2 border-slate-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
            >
              <h3 className="font-semibold text-slate-900 text-lg mb-2 group-hover:text-orange-600 transition-colors">
                1. Questionnaire de validation
              </h3>
              <p className="text-sm text-slate-600">
                Répondez à quelques questions pour valider vos connaissances
              </p>
            </button>

            <button
              onClick={() => navigate('/onboarding/enregistrement')}
              className="w-full p-6 border-2 border-slate-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
            >
              <h3 className="font-semibold text-slate-900 text-lg mb-2 group-hover:text-orange-600 transition-colors">
                2. Enregistrement audio
              </h3>
              <p className="text-sm text-slate-600">
                Enregistrez-vous en train de lire le script de vente
              </p>
            </button>
          </div>

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Important :</strong> Une fois l'enregistrement audio envoyé, votre candidature sera soumise pour validation. Notre équipe vous fera un retour dans les 24-48 heures.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full relative">
        <button
          onClick={signOut}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Se déconnecter"
        >
          <LogOut className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Tableau de bord</h1>
        <p className="text-slate-600">Bienvenue sur votre tableau de bord.</p>
        {profile && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">Email:</span> {profile.email}
            </p>
            <p className="text-sm text-slate-700 mt-2">
              <span className="font-semibold">Statut:</span> {profile.status}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
