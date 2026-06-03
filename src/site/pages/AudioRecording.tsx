// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Mic, Square, Upload, Loader2, Play, Pause, CheckCircle, Clock, LogOut } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';

export default function AudioRecording() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playingExample, setPlayingExample] = useState(false);
  const [error, setError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const exampleAudioRef = useRef<HTMLAudioElement>(null);

  const exampleAudioUrl = 'https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/6966c3527fc451529df3548d.m4a';

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!profile) return;

    if (profile.is_admin) {
      return;
    }

    const checkExistingAudio = async () => {
      const { data: training } = await supabase
        .from('training_progress')
        .select('test_call_url')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (training?.test_call_url) {
        navigate('/dashboard');
      }
    };

    checkExistingAudio();
  }, [user, profile, navigate]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setError('');
    } catch (err) {
      setError('Impossible d\'accéder au microphone. Veuillez autoriser l\'accès.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const toggleExamplePlay = () => {
    if (exampleAudioRef.current) {
      if (playingExample) {
        exampleAudioRef.current.pause();
      } else {
        exampleAudioRef.current.play();
      }
      setPlayingExample(!playingExample);
    }
  };

  const handleUpload = async () => {
    if (!audioBlob || !user) return;

    setLoading(true);
    setError('');

    try {
      const fileName = `test-call-${user.id}-${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('recordings')
        .getPublicUrl(uploadData.path);

      await supabase
        .from('training_progress')
        .update({
          test_call_url: publicUrl,
          test_call_validated: false,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', user.id);

      await supabase
        .from('profiles')
        .update({
          status: 'pending_audio',
        })
        .eq('id', user.id);

      await refreshProfile();
      setUploadSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload');
    } finally {
      setLoading(false);
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (uploadSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center relative">
            <button
              onClick={signOut}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Aissociate Logo"
              className="h-16 w-auto object-contain mx-auto mb-6"
            />

            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              Enregistrement envoyé avec succès !
            </h1>

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-4">
                <Clock className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div className="text-left">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    Votre candidature est en cours d'examen
                  </h3>
                  <p className="text-slate-700 text-sm leading-relaxed">
                    Notre équipe va écouter attentivement votre enregistrement et évaluer votre prestation.
                    Vous recevrez un retour détaillé par email dans les prochaines 24 à 48 heures.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-slate-900 mb-3">Que se passe-t-il maintenant ?</h3>
              <div className="space-y-3 text-left">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    1
                  </div>
                  <p className="text-slate-700 text-sm">
                    Notre équipe analyse votre enregistrement et évalue votre maîtrise du script
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    2
                  </div>
                  <p className="text-slate-700 text-sm">
                    Vous recevez une notification par email avec notre décision et nos commentaires
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">
                    3
                  </div>
                  <p className="text-slate-700 text-sm">
                    Si validé, vous accédez immédiatement à votre espace de formation et pouvez commencer votre activité
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-800">
                <strong>Conseil :</strong> Gardez un œil sur votre boîte email (et vos spams) pour ne pas manquer notre retour !
              </p>
            </div>

            <button
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-8 py-3 rounded-lg font-semibold transition-all"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
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
              <Mic className="w-8 h-8 text-orange-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Enregistrement du script
            </h1>
            <p className="text-slate-600">
              Enregistrez-vous en train de lire le script de vente
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Play className="w-5 h-5 text-green-600" />
              Exemple de lecture du script
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Écoutez cet exemple avant de vous enregistrer pour comprendre le ton et le rythme attendus.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleExamplePlay}
                className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-full transition-all shadow-md hover:shadow-lg"
              >
                {playingExample ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
              </button>
              <audio
                ref={exampleAudioRef}
                src={exampleAudioUrl}
                onEnded={() => setPlayingExample(false)}
                className="hidden"
              />
              <div className="flex-1 h-2 bg-white rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-300"
                  style={{ width: playingExample ? '100%' : '0%' }}
                />
              </div>
              <span className="text-sm font-medium text-slate-700">
                {playingExample ? 'En lecture...' : 'Écouter l\'exemple'}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-8 mb-8 max-h-[600px] overflow-y-auto">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Script à lire :</h2>
            <div className="text-slate-700 space-y-4 text-base leading-loose">
              <div>
                <p className="font-medium">Bonjour, Alexandre ?</p>
                <p className="text-slate-500 italic ml-4">[Oui]</p>
              </div>

              <p>Parfait. Je vous appelle dans un cadre professionnel, c'est bien un appel commercial.</p>
              <p>Vous pouvez soit raccrocher maintenant, soit m'accorder 30 secondes pour que je vous explique pourquoi j'appelle.</p>
              <p className="text-slate-500 italic ml-4">[D'accord / Allez-y / 30 secondes]</p>

              <p className="font-medium">Merci.</p>
              <p>Les dirigeants réunionnais avec qui je travaille me disent tous la même chose :</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>l'intelligence artificielle est déjà utilisée dans leurs entreprises,</li>
                <li>mais sans cadre clair, sans règles, et sans vraie formation.</li>
              </ul>

              <p>Dites-moi, aujourd'hui chez vous, l'IA est plutôt encadrée ou utilisée dans l'ombre ?</p>
              <p className="text-slate-500 italic ml-4">[Plutôt dans l'ombre / Un peu les deux / Pas vraiment encadrée]</p>

              <p className="font-medium">D'accord.</p>
              <p>Donc si je résume :</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>l'IA est déjà utilisée,</li>
                <li>il n'y a pas de cadre précis,</li>
                <li>et les équipes n'ont pas été formées officiellement.</li>
              </ul>
              <p>Je suis bon ?</p>
              <p className="text-slate-500 italic ml-4">[Oui / Globalement oui]</p>

              <p className="font-medium">Parfait.</p>
              <p>On avait dit 30 secondes, elles sont presque écoulées.</p>
              <p>Est-ce que je peux vous poser une dernière question ?</p>
              <p className="text-slate-500 italic ml-4">[Oui / Allez-y]</p>

              <p>Selon vous, pour maîtriser l'IA dans une entreprise,</p>
              <ul className="list-disc ml-6 space-y-1">
                <li>il vaut mieux former les équipes en interne</li>
                <li>ou dépendre entièrement de prestataires externes ?</li>
              </ul>
              <p className="text-slate-500 italic ml-4">[Former en interne / Un mix des deux]</p>

              <p className="font-medium">Très clair.</p>
              <p>Est-ce que vous verriez un inconvénient réel</p>
              <p className="ml-4">à ce que vous et vos équipes soyez formés à l'IA ?</p>
              <p className="text-slate-500 italic ml-4">[Non / Pas spécialement]</p>

              <p className="font-medium">Voilà pourquoi je vous appelle.</p>
              <p>Nous sommes un organisme de formation labellisé Qualiopi,</p>
              <p className="ml-4">spécialisé uniquement en intelligence artificielle, basé à La Réunion.</p>
              <p>On a déjà formé plus de 300 personnes,</p>
              <p className="ml-4">et dans beaucoup de cas la formation est financée à 100 % via l'OPCO ou le CPF.</p>

              <p>Est-ce que ça vaudrait le coup d'y jeter un œil 30 minutes,</p>
              <p className="ml-4">simplement pour voir si c'est pertinent pour vous ?</p>
              <p className="text-slate-500 italic ml-4">[Oui, pourquoi pas / D'accord]</p>

              <p className="font-medium">Parfait.</p>
              <p>Vous êtes plutôt disponible en début ou en fin de semaine ?</p>
              <p className="text-slate-500 italic ml-4">[Plutôt fin de semaine]</p>

              <p>J'ai mercredi à 14h ou 16h,</p>
              <p className="ml-4">qu'est-ce qui vous convient le mieux ?</p>
              <p className="text-slate-500 italic ml-4">[16h]</p>

              <p className="font-medium">Dernière chose importante :</p>
              <p className="ml-4">si à la fin de l'échange vous estimez que ce n'est pas utile pour vous,</p>
              <p className="ml-4">vous serez à l'aise pour me le dire franchement ?</p>
              <p className="text-slate-500 italic ml-4">[Oui, bien sûr]</p>

              <p className="font-medium">Parfait.</p>
              <p>Vous recevrez un mail de confirmation avec le lien visio.</p>
              <p>Merci pour votre disponibilité, Alexandre.</p>
              <p className="ml-4">Bonne journée.</p>
            </div>
          </div>

          <div className="space-y-6">
            {!audioBlob && (
              <div className="text-center">
                {!recording ? (
                  <button
                    onClick={startRecording}
                    className="inline-flex items-center gap-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-8 py-4 rounded-lg font-semibold transition-all"
                  >
                    <Mic className="w-6 h-6" />
                    Commencer l'enregistrement
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="inline-flex items-center gap-3 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-8 py-4 rounded-lg font-semibold transition-all animate-pulse"
                  >
                    <Square className="w-6 h-6" />
                    Arrêter l'enregistrement
                  </button>
                )}
              </div>
            )}

            {audioUrl && (
              <div className="bg-slate-50 rounded-xl p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Votre enregistrement :</h3>
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={togglePlay}
                    className="flex items-center justify-center w-12 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-full transition-colors"
                  >
                    {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                  </button>
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setPlaying(false)}
                    className="hidden"
                  />
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500" style={{ width: playing ? '100%' : '0%' }} />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setAudioBlob(null);
                      setAudioUrl(null);
                      setPlaying(false);
                    }}
                    className="flex-1 px-4 py-2 border-2 border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg font-medium transition-colors"
                  >
                    Recommencer
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Envoyer
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 leading-relaxed">
              <strong>Important :</strong> Une fois l'enregistrement envoyé et votre candidature validée par notre équipe,
              vous aurez accès à votre espace de formation et pourrez démarrer votre activité de closer.
              Notre équipe évaluera votre prestation et vous communiquera sa décision dans les 24 à 48 heures par email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
