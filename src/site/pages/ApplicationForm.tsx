// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FileText, Loader2, CheckCircle, Upload, X, LogOut } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';

export default function ApplicationForm() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [formData, setFormData] = useState({
    role: '',
    experience: '',
    availability: '',
    motivation: '',
  });

  useEffect(() => {
    console.log('📋 ApplicationForm: user=', !!user, 'profile=', profile);

    if (!user) {
      console.log('📋 No user, redirecting to login');
      navigate('/login');
      return;
    }

    if (profile && profile.status !== 'new_user') {
      console.log('📋 Status is not new_user, redirecting to dashboard');
      navigate('/dashboard');
      return;
    }

    const checkExistingApplication = async () => {
      if (!user) return;

      console.log('🔍 Checking for existing application...');
      const { data: existingApp } = await supabase
        .from('applications')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (existingApp) {
        console.log('✅ Application already exists, redirecting to dashboard');
        navigate('/dashboard');
      }
    };

    checkExistingApplication();
  }, [user, profile, navigate]);

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Seuls les fichiers PDF sont acceptés');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Le fichier ne doit pas dépasser 5 MB');
        return;
      }
      setCvFile(file);
      setError('');
    }
  };

  const removeCv = () => {
    setCvFile(null);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      console.log('📝 Début de la soumission du formulaire');

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (!existingProfile) {
        console.log('➕ Création du profil...');
        const { error: createError } = await supabase.from('profiles').insert({
          id: user.id,
          email: user.email!,
          status: 'new_user',
        });

        if (createError) throw createError;
      }

      let cvUrl = null;

      if (cvFile) {
        console.log('📤 Upload du CV...');
        setUploadingCv(true);
        const fileExt = 'pdf';
        const fileName = `${user.id}/cv_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('cvs')
          .upload(fileName, cvFile);

        if (uploadError) {
          console.error('❌ Erreur upload CV:', uploadError);
          setError(`Erreur lors de l'upload du CV: ${uploadError.message}`);
          setLoading(false);
          setUploadingCv(false);
          return;
        }

        cvUrl = fileName;
        setUploadingCv(false);
        console.log('✅ CV uploadé');
      }

      const roleMap: Record<string, 'fixer' | 'closer'> = {
        'fixer_formations': 'fixer',
        'closer_formations': 'closer',
        'closer_marche_public': 'closer',
        'fixer': 'fixer',
        'closer': 'closer',
      };

      console.log('🔄 Mise à jour du profil...');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: roleMap[formData.role] || 'fixer',
          experience: formData.experience,
          availability: formData.availability,
          motivation: formData.motivation,
          framework_accepted_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('❌ Erreur update profil:', updateError);
        throw updateError;
      }
      console.log('✅ Profil mis à jour');

      console.log('📋 Création de l\'application...');
      const { error: appError } = await supabase.from('applications').insert({
        profile_id: user.id,
        role_desired: roleMap[formData.role] || 'closer',
        experience: formData.experience,
        availability: formData.availability,
        motivation: formData.motivation,
        ethical_framework_accepted: true,
        cv_url: cvUrl,
        status: 'accepted',
      });

      if (appError) {
        console.error('❌ Erreur création application:', appError);
        throw appError;
      }
      console.log('✅ Application créée');

      console.log('🔄 Rafraîchissement du profil...');
      await refreshProfile();
      console.log('✅ Profil rafraîchi');

      console.log('🧭 Navigation vers le dashboard');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('💥 Erreur globale:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 relative">
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
              <FileText className="w-8 h-8 text-orange-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Formulaire de candidature
            </h1>
            <p className="text-slate-600">
              Complétez ce formulaire pour commencer votre parcours
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                Quel rôle souhaitez-vous ?
              </label>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'fixer_formations' })}
                  className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                    formData.role === 'fixer_formations'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900">Fixer Formations IA</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Prospection et qualification des leads pour les formations IA
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'closer_formations' })}
                  className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                    formData.role === 'closer_formations'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900">Closer Formations IA</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Vente et closing pour les formations IA
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'closer_marche_public' })}
                  className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                    formData.role === 'closer_marche_public'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold text-slate-900">Closer Le marché public.fr</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Prospection et closing pour Le marché public.fr
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="experience" className="block text-sm font-semibold text-slate-900 mb-2">
                Décrivez votre expérience
              </label>
              <textarea
                id="experience"
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                required
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Parlez-nous de votre expérience professionnelle..."
              />
            </div>

            <div>
              <label htmlFor="availability" className="block text-sm font-semibold text-slate-900 mb-2">
                Quelle est votre disponibilité ?
              </label>
              <select
                id="availability"
                value={formData.availability}
                onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">Sélectionnez...</option>
                <option value="full-time">Temps plein</option>
                <option value="part-time">Temps partiel</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>

            <div>
              <label htmlFor="motivation" className="block text-sm font-semibold text-slate-900 mb-2">
                Pourquoi voulez-vous nous rejoindre ?
              </label>
              <textarea
                id="motivation"
                value={formData.motivation}
                onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                required
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Expliquez votre motivation..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                CV (PDF uniquement, max 5 MB)
              </label>
              {!cvFile ? (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-sm text-slate-600 font-medium">
                      Cliquez pour uploader votre CV
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      PDF uniquement (max 5 MB)
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf"
                    onChange={handleCvChange}
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-300 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{cvFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(cvFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeCv}
                    className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || uploadingCv || !formData.role}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-6 py-4 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploadingCv ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Upload du CV en cours...
                </>
              ) : loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Soumettre ma candidature
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
