// @ts-nocheck
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { FileText, AlertCircle, Upload, X } from 'lucide-react';
import AdminLogo from '../AdminLogo';

export default function ApplicationForm() {
  const navigate = useNavigate();
  const { user, signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role_desired: 'fixer_formations' as 'fixer_formations' | 'closer_formations' | 'closer_marche_public',
    experience: '',
    availability: '',
    motivation: '',
    ethical_framework_accepted: false,
  });

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
      let userId = user?.id;

      if (!user) {
        const { error: signUpError } = await signUp(formData.email, formData.password);
        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        const { data: { user: newUser } } = await supabase.auth.getUser();
        userId = newUser?.id;
      }

      if (!userId) {
        setError('Erreur lors de la création du compte');
        setLoading(false);
        return;
      }

      let cvUrl = null;

      if (cvFile) {
        setUploadingCv(true);
        const fileExt = 'pdf';
        const fileName = `${userId}/cv_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('cvs')
          .upload(fileName, cvFile);

        if (uploadError) {
          setError(`Erreur lors de l'upload du CV: ${uploadError.message}`);
          setLoading(false);
          setUploadingCv(false);
          return;
        }

        cvUrl = fileName;
        setUploadingCv(false);
      }

      const roleMap: Record<string, 'fixer' | 'closer'> = {
        'fixer_formations': 'fixer',
        'closer_formations': 'closer',
        'closer_marche_public': 'closer',
      };

      const { error: applicationError } = await supabase.from('applications').insert({
        profile_id: userId,
        role_desired: formData.role_desired,
        experience: formData.experience,
        availability: formData.availability,
        motivation: formData.motivation,
        ethical_framework_accepted: formData.ethical_framework_accepted,
        cv_url: cvUrl,
        status: 'accepted',
      });

      if (applicationError) {
        setError(applicationError.message);
        setLoading(false);
        return;
      }

      await supabase.from('profiles').update({
        role: roleMap[formData.role_desired] || 'fixer',
        experience: formData.experience,
        availability: formData.availability,
        motivation: formData.motivation,
        status: 'framework_accepted',
      }).eq('id', userId);

      navigate('/onboarding/cadre');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Aissociate Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Candidature – Rejoindre Aissociate
          </h1>
          <p className="text-lg text-slate-600">
            Nous sélectionnons peu de profils.
            <br />
            Ce formulaire permet de vérifier l'alignement avec notre cadre.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-12">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!user && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="votre@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Rôle souhaité
              </label>
              <select
                value={formData.role_desired}
                onChange={(e) => setFormData({ ...formData, role_desired: e.target.value as 'fixer_formations' | 'closer_formations' | 'closer_marche_public' })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="fixer_formations">Fixer Formations IA</option>
                <option value="closer_formations">Closer Formations IA</option>
                <option value="closer_marche_public">Closer Le marché public.fr - Prospection et Closing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Expérience commerciale
              </label>
              <select
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">Sélectionnez...</option>
                <option value="none">Aucune expérience</option>
                <option value="beginner">Moins d'1 an</option>
                <option value="intermediate">1 à 3 ans</option>
                <option value="advanced">3 à 5 ans</option>
                <option value="expert">Plus de 5 ans</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Disponibilité hebdomadaire
              </label>
              <input
                type="text"
                value={formData.availability}
                onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ex: 20h par semaine, temps plein..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Motivation (question ouverte)
              </label>
              <textarea
                value={formData.motivation}
                onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                placeholder="Expliquez pourquoi vous souhaitez rejoindre Aissociate et ce que vous espérez apporter à l'équipe..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
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

            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <FileText className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-slate-900 mb-2">Cadre éthique</h3>
                  <p className="text-slate-700 mb-4">
                    En rejoignant Aissociate, je m'engage à respecter les règles éthiques strictes concernant le CPF,
                    la conformité Qualiopi et la transparence envers les clients. Je comprends que tout manquement
                    à ces règles entraînera une exclusion immédiate.
                  </p>
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.ethical_framework_accepted}
                  onChange={(e) => setFormData({ ...formData, ethical_framework_accepted: e.target.checked })}
                  className="w-5 h-5 text-orange-600 border-slate-300 rounded focus:ring-orange-500 mt-1"
                />
                <span className="text-slate-700 font-medium">
                  J'ai lu et j'accepte le cadre éthique d'Aissociate
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || uploadingCv}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {uploadingCv ? 'Upload du CV en cours...' : loading ? 'Envoi en cours...' : 'Envoyer ma candidature'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
