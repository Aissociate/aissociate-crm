// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, AlertCircle, Mic, Square, Play, Loader2 } from 'lucide-react';
import AdminLogo from '../AdminLogo';

const quizQuestions = [
  {
    question: "Quel est le rôle principal d'un Fixer chez Aissociate ?",
    options: ["Closer les ventes", "Qualifier et prendre des RDV", "Former les clients", "Gérer la comptabilité"],
    correct: 1
  },
  {
    question: "Peut-on faire des promesses financières lors du démarchage CPF ?",
    options: ["Oui, sans limite", "Oui, mais avec modération", "Non, jamais", "Seulement pour les gros clients"],
    correct: 2
  },
  {
    question: "Qu'est-ce que le cadre Qualiopi garantit ?",
    options: ["Des prix bas", "La qualité de la formation", "Des ventes rapides", "L'absence de concurrence"],
    correct: 1
  },
  {
    question: "En tant que commercial Aissociate, je peux :",
    options: ["Modifier le script à ma guise", "Exécuter le système établi", "Ignorer les règles si ça marche", "Promettre des résultats garantis"],
    correct: 1
  },
  {
    question: "Que signifie 'décision éclairée' pour un Closer ?",
    options: ["Vendre à tout prix", "Aider le client à choisir en connaissance de cause", "Cacher certaines informations", "Forcer la vente rapidement"],
    correct: 1
  },
  {
    question: "Les KPI sont suivis pour :",
    options: ["Sanctionner les mauvais résultats", "Progresser et améliorer", "Comparer avec les concurrents", "Réduire les salaires"],
    correct: 1
  },
  {
    question: "Le système commercial Aissociate repose sur :",
    options: ["L'improvisation", "La pression", "Le cadre et la méthode", "La chance"],
    correct: 2
  },
  {
    question: "En cas d'objection client, je dois :",
    options: ["Insister jusqu'à ce qu'il cède", "Suivre le script de gestion des objections", "Raccrocher", "Proposer un rabais"],
    correct: 1
  },
  {
    question: "Le respect du RGPD et de la confidentialité est :",
    options: ["Optionnel", "Obligatoire", "Recommandé", "Inutile"],
    correct: 1
  },
  {
    question: "Mon rôle chez Aissociate est de :",
    options: ["Créer mon propre système", "Exécuter le système existant", "Faire ce que je veux", "Contourner les règles"],
    correct: 1
  }
];

const testScript = `Bonjour, Alexandre ?

[Oui]

Parfait. Je vous appelle dans un cadre professionnel, c'est bien un appel commercial.

Vous pouvez soit raccrocher maintenant, soit m'accorder 30 secondes pour que je vous explique pourquoi j'appelle.

[D'accord / Allez-y / 30 secondes]

Merci.

Les dirigeants réunionnais avec qui je travaille me disent tous la même chose :
l'intelligence artificielle est déjà utilisée dans leurs entreprises,
mais sans cadre clair, sans règles, et sans vraie formation.

Dites-moi, aujourd'hui chez vous, l'IA est plutôt encadrée ou utilisée dans l'ombre ?

[Plutôt dans l'ombre / Un peu les deux / Pas vraiment encadrée]

D'accord.

Donc si je résume :
l'IA est déjà utilisée,
il n'y a pas de cadre précis,
et les équipes n'ont pas été formées officiellement.

Je suis bon ?

[Oui / Globalement oui]

Parfait.

On avait dit 30 secondes, elles sont presque écoulées.

Est-ce que je peux vous poser une dernière question ?

[Oui / Allez-y]

Selon vous, pour maîtriser l'IA dans une entreprise,
il vaut mieux former les équipes en interne
ou dépendre entièrement de prestataires externes ?

[Former en interne / Un mix des deux]

Très clair.

Est-ce que vous verriez un inconvénient réel
à ce que vous et vos équipes soyez formés à l'IA ?

[Non / Pas spécialement]

Voilà pourquoi je vous appelle.

Nous sommes un organisme de formation labellisé Qualiopi,
spécialisé uniquement en intelligence artificielle, basé à La Réunion.

On a déjà formé plus de 300 personnes,
et dans beaucoup de cas la formation est financée à 100 % via l'OPCO ou le CPF.

Est-ce que ça vaudrait le coup d'y jeter un œil 30 minutes,
simplement pour voir si c'est pertinent pour vous ?

[Oui, pourquoi pas / D'accord]

Parfait.

Vous êtes plutôt disponible en début ou en fin de semaine ?

[Plutôt fin de semaine]

J'ai mercredi à 14h ou 16h,
qu'est-ce qui vous convient le mieux ?

[16h]

Dernière chose importante :
si à la fin de l'échange vous estimez que ce n'est pas utile pour vous,
vous serez à l'aise pour me le dire franchement ?

[Oui, bien sûr]

Parfait.

Vous recevrez un mail de confirmation avec le lien visio.

Merci pour votre disponibilité, Alexandre.
Bonne journée.`;

export default function Validation() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [_progress, setProgress] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [_loading, _setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
    if (data?.quiz_passed) {
      setQuizCompleted(true);
      setScore(data.quiz_score);
    }
  };

  const handleAnswer = (answerIndex: number) => {
    const newAnswers = [...answers, answerIndex];
    setAnswers(newAnswers);

    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      completeQuiz(newAnswers);
    }
  };

  const completeQuiz = async (finalAnswers: number[]) => {
    const correctCount = finalAnswers.filter((answer, index) => answer === quizQuestions[index].correct).length;
    const finalScore = Math.round((correctCount / quizQuestions.length) * 100);
    const passed = finalScore >= 70;

    setScore(finalScore);
    setQuizCompleted(true);

    if (profile) {
      await supabase
        .from('training_progress')
        .update({
          quiz_score: finalScore,
          quiz_passed: passed,
        })
        .eq('profile_id', profile.id);

      await loadProgress();
    }
  };

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
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Impossible d\'accéder au microphone. Veuillez autoriser l\'accès.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAndSubmit = async () => {
    if (!profile || !audioBlob) return;

    setUploadProgress(true);
    try {
      const fileName = `test-call-${profile.id}-${Date.now()}.webm`;
      const filePath = `test-calls/${fileName}`;

      // Try to create bucket if it doesn't exist
      const { data: buckets } = await supabase.storage.listBuckets();
      const recordingsBucket = buckets?.find(b => b.name === 'recordings');

      if (!recordingsBucket) {
        await supabase.storage.createBucket('recordings', {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        });
      }

      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(filePath, audioBlob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('recordings')
        .getPublicUrl(filePath);

      await supabase
        .from('training_progress')
        .update({
          test_call_url: urlData.publicUrl,
          test_call_validated: true,
          completed_at: new Date().toISOString(),
        })
        .eq('profile_id', profile.id);

      await supabase
        .from('profiles')
        .update({
          status: 'validated',
          validated_at: new Date().toISOString(),
          training_completed_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      await refreshProfile();
      navigate('/onboarding/activation');
    } catch (error) {
      console.error('Error:', error);
      alert('Erreur lors de l\'upload. Veuillez réessayer.');
    } finally {
      setUploadProgress(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Aissociate Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Validation avant activation
          </h1>
          <p className="text-lg text-slate-600">
            Ce n'est pas un examen. C'est un filtre de sérieux.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-12 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Quiz de Validation</h2>

          {!quizCompleted ? (
            <div>
              <div className="mb-6">
                <div className="flex justify-between text-sm text-slate-600 mb-2">
                  <span>Question {currentQuestion + 1} sur {quizQuestions.length}</span>
                  <span>{Math.round(((currentQuestion) / quizQuestions.length) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-amber-600 h-2 rounded-full transition-all"
                    style={{ width: `${((currentQuestion) / quizQuestions.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-6">
                  {quizQuestions[currentQuestion].question}
                </h3>
                <div className="space-y-3">
                  {quizQuestions[currentQuestion].options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswer(index)}
                      className="w-full text-left px-6 py-4 border-2 border-slate-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className={`rounded-xl p-6 mb-6 ${score >= 70 ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
                <div className="flex items-center gap-3 mb-2">
                  {score >= 70 ? (
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  )}
                  <h3 className="text-2xl font-bold text-slate-900">Score: {score}%</h3>
                </div>
                <p className={`text-lg ${score >= 70 ? 'text-green-700' : 'text-red-700'}`}>
                  {score >= 70
                    ? 'Félicitations ! Vous avez réussi le quiz.'
                    : 'Score insuffisant. Vous devez obtenir au moins 70% pour continuer.'}
                </p>
              </div>

              {score < 70 && (
                <button
                  onClick={() => {
                    setCurrentQuestion(0);
                    setAnswers([]);
                    setQuizCompleted(false);
                    setScore(0);
                  }}
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                >
                  Repasser le quiz
                </button>
              )}
            </div>
          )}
        </div>

        {quizCompleted && score >= 70 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 sm:p-12">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Enregistrement du Script Test
            </h2>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">
                Script à lire :
              </h3>
              <div className="text-slate-700 whitespace-pre-line leading-relaxed">
                {testScript}
              </div>
            </div>

            <div className="space-y-6">
              {!audioBlob && (
                <div className="text-center">
                  <p className="text-slate-600 mb-6">
                    Cliquez sur le bouton pour commencer l'enregistrement de votre lecture du script.
                  </p>
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-3 mx-auto"
                    >
                      <Mic className="w-6 h-6" />
                      Démarrer l'enregistrement
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-black text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-3 mx-auto animate-pulse"
                    >
                      <Square className="w-6 h-6" />
                      Arrêter l'enregistrement
                    </button>
                  )}
                </div>
              )}

              {audioBlob && audioUrl && (
                <div className="space-y-4">
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                      <h3 className="text-lg font-semibold text-slate-900">
                        Enregistrement terminé
                      </h3>
                    </div>
                    <audio controls className="w-full" src={audioUrl}>
                      Votre navigateur ne supporte pas la lecture audio.
                    </audio>
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setAudioBlob(null);
                        setAudioUrl(null);
                      }}
                      className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-6 py-3 rounded-lg font-semibold transition-all"
                    >
                      Réenregistrer
                    </button>
                    <button
                      onClick={uploadAndSubmit}
                      disabled={uploadProgress}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                    >
                      {uploadProgress ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Upload en cours...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          Suite
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
