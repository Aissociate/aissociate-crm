// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Brain, Loader2, CheckCircle, XCircle, LogOut } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';

const questions = [
  {
    id: 1,
    question: 'Un prospect vous dit : "Ça m\'intéresse, mais c\'est vraiment pas le bon moment". Que faites-vous ?',
    options: [
      'Insister pour fixer un rendez-vous maintenant, le timing n\'est jamais parfait',
      'Creuser pour comprendre ce qui définit le "bon moment" et identifier les priorités actuelles',
      'Accepter sa réponse et passer au prospect suivant pour ne pas perdre de temps',
      'Proposer de rappeler dans 3 mois sans plus de précisions'
    ],
    correctAnswer: 1
  },
  {
    id: 2,
    question: 'Durant l\'appel, vous sentez que le prospect hésite mais ne verbalise pas pourquoi. Quelle approche adoptez-vous ?',
    options: [
      'Continuer votre argumentaire, les silences sont inconfortables',
      'Proposer une réduction immédiate pour débloquer la situation',
      'Marquer une pause et poser une question ouverte sur ses préoccupations',
      'Conclure rapidement en lui envoyant la documentation par email'
    ],
    correctAnswer: 2
  },
  {
    id: 3,
    question: 'Vous êtes en fin de journée avec 2 appels restants : un prospect qualifié mais difficile à joindre, et un nouveau lead non qualifié mais disponible maintenant. Que choisissez-vous ?',
    options: [
      'Le nouveau lead, un appel réalisé vaut mieux qu\'un appel raté',
      'Le prospect qualifié, quitte à essayer demain s\'il ne répond pas',
      'Appeler le nouveau lead puis réessayer le prospect qualifié',
      'Laisser les deux pour demain avec un meilleur état d\'esprit'
    ],
    correctAnswer: 2
  },
  {
    id: 4,
    question: 'Un prospect affirme : "Votre concurrent propose la même chose moins cher". Quelle est votre première réaction ?',
    options: [
      'Critiquer la qualité du concurrent pour valoriser votre offre',
      'Proposer un alignement de prix pour ne pas perdre l\'opportunité',
      'Demander ce qui l\'a amené à comparer et ce qui compte le plus pour lui au-delà du prix',
      'Expliquer en détail pourquoi votre prix est justifié'
    ],
    correctAnswer: 2
  },
  {
    id: 5,
    question: 'Après 5 tentatives, un prospect clé ne rappelle toujours pas. Que faites-vous ?',
    options: [
      'Continuer à appeler jusqu\'à obtenir une réponse, la persévérance paie toujours',
      'Envoyer un dernier message authentique reconnaissant que ce n\'est peut-être pas le bon moment',
      'Abandonner et retirer ce contact de votre liste',
      'Demander à votre manager de tenter sa chance à votre place'
    ],
    correctAnswer: 1
  },
  {
    id: 6,
    question: 'Vous avez atteint vos objectifs du mois le 20. Comment abordez-vous les 10 jours restants ?',
    options: [
      'Ralentir le rythme pour éviter de surperformer et augmenter les attentes',
      'Maintenir l\'effort pour préparer le mois prochain et consolider les résultats',
      'Aider vos collègues en difficulté en partageant vos leads restants',
      'Prendre des leads plus difficiles pour expérimenter sans pression'
    ],
    correctAnswer: 1
  },
  {
    id: 7,
    question: 'En plein appel, vous réalisez que le prospect ne correspond pas au profil cible. Que faites-vous ?',
    options: [
      'Terminer l\'appel rapidement et poliment pour optimiser votre temps',
      'Continuer normalement, on ne sait jamais ce qui peut ressortir',
      'Qualifier précisément pourquoi ce n\'est pas le bon profil, ces données sont précieuses',
      'Tenter quand même de vendre, chaque opportunité compte'
    ],
    correctAnswer: 2
  },
  {
    id: 8,
    question: 'Un prospect accepte un rendez-vous mais vous sentez qu\'il dit oui par politesse. Comment réagissez-vous ?',
    options: [
      'Valider l\'engagement et passer à la suite, un rendez-vous reste un rendez-vous',
      'Clarifier son niveau d\'intérêt réel et lui donner une porte de sortie honnête',
      'Surjouer l\'enthousiasme pour le convaincre que c\'est une bonne décision',
      'Raccourcir le rendez-vous proposé pour le rendre moins contraignant'
    ],
    correctAnswer: 1
  }
];

export default function Quiz() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Ne pas rediriger si le profile n'est pas encore chargé
    if (!profile) {
      return;
    }
  }, [user, profile, navigate]);

  const handleAnswer = (answerIndex: number) => {
    const newAnswers = [...answers, answerIndex];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      calculateScore(newAnswers);
    }
  };

  const calculateScore = async (finalAnswers: number[]) => {
    let correct = 0;
    questions.forEach((q, index) => {
      if (finalAnswers[index] === q.correctAnswer) {
        correct++;
      }
    });

    const percentage = Math.round((correct / questions.length) * 100);
    setScore(percentage);
    setShowResults(true);

    const passed = percentage >= 70;

    setLoading(true);
    try {
      const { data: existingProgress } = await supabase
        .from('training_progress')
        .select('id')
        .eq('profile_id', user!.id)
        .maybeSingle();

      if (existingProgress) {
        await supabase
          .from('training_progress')
          .update({
            module_common_completed: true,
            module_role_completed: true,
            quiz_score: percentage,
            quiz_passed: passed,
            updated_at: new Date().toISOString(),
          })
          .eq('profile_id', user!.id);
      } else {
        await supabase.from('training_progress').insert({
          profile_id: user!.id,
          module_common_completed: true,
          module_role_completed: true,
          quiz_score: percentage,
          quiz_passed: passed,
        });
      }

      if (passed) {
        await supabase
          .from('profiles')
          .update({
            training_completed_at: new Date().toISOString(),
          })
          .eq('id', user!.id);
      }

      await refreshProfile();
    } catch (err) {
      console.error('Error saving quiz results:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (score >= 70) {
      navigate('/dashboard');
    } else {
      setCurrentQuestion(0);
      setAnswers([]);
      setShowResults(false);
      setScore(0);
    }
  };

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (showResults) {
    const passed = score >= 70;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
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
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                passed ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {passed ? (
                  <CheckCircle className="w-10 h-10 text-green-600" />
                ) : (
                  <XCircle className="w-10 h-10 text-red-600" />
                )}
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                {passed ? 'Félicitations !' : 'Pas encore...'}
              </h1>
              <p className="text-slate-600 mb-6">
                {passed
                  ? 'Vous avez réussi le questionnaire !'
                  : 'Vous devez obtenir au moins 70% pour continuer'}
              </p>

              <div className="text-6xl font-bold mb-2" style={{
                color: passed ? '#10b981' : '#ef4444'
              }}>
                {score}%
              </div>
              <p className="text-slate-600">
                {answers.filter((a, i) => a === questions[i].correctAnswer).length} / {questions.length} bonnes réponses
              </p>
            </div>

            <button
              onClick={handleContinue}
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-6 py-4 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : passed ? (
                'Continuer vers l\'enregistrement'
              ) : (
                'Recommencer le questionnaire'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];

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
              <Brain className="w-8 h-8 text-orange-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Questionnaire de validation
            </h1>
            <p className="text-slate-600">
              Question {currentQuestion + 1} sur {questions.length}
            </p>
          </div>

          <div className="mb-8">
            <div className="w-full bg-slate-200 rounded-full h-2 mb-6">
              <div
                className="bg-gradient-to-r from-orange-500 to-amber-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              />
            </div>

            <h2 className="text-2xl font-semibold text-slate-900 mb-6">
              {question.question}
            </h2>

            <div className="space-y-3">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(index)}
                  className="w-full p-4 border-2 border-slate-200 rounded-lg text-left hover:border-orange-500 hover:bg-orange-50 transition-all"
                >
                  <span className="font-medium text-slate-900">{option}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
