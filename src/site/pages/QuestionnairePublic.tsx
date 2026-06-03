// @ts-nocheck
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ClipboardCheck, CheckCircle, AlertCircle } from 'lucide-react';
import { qualiopiClient } from '../lib/qualiopiClient';
import type { QuestionnaireSchema, QuestionnaireQuestion } from '../types/qualiopi';

export default function QuestionnairePublic() {
  const { token } = useParams<{ token: string }>();
  const [questionnaireData, setQuestionnaireData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      loadQuestionnaire();
    }
  }, [token]);

  const loadQuestionnaire = async () => {
    if (!token) return;

    try {
      const data = await qualiopiClient.getQuestionnaireByToken(token);

      if (!data) {
        setError('Questionnaire non trouvé ou expiré');
        return;
      }

      if (data.response) {
        setSubmitted(true);
      }

      setQuestionnaireData(data);
    } catch (error) {
      console.error('Error loading questionnaire:', error);
      setError('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!questionnaireData) return;

    try {
      await qualiopiClient.submitQuestionnaireResponse(
        questionnaireData.link.id,
        answers
      );
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting:', error);
      alert('Erreur lors de l\'envoi');
    }
  };

  const shouldShowQuestion = (question: QuestionnaireQuestion) => {
    if (!question.conditional) return true;

    const dependsOnAnswer = answers[question.conditional.dependsOn];
    const showIf = question.conditional.showIf;

    if (showIf === 'yes') {
      return dependsOnAnswer === true || dependsOnAnswer === 'yes';
    }
    if (showIf === 'no') {
      return dependsOnAnswer === false || dependsOnAnswer === 'no';
    }

    return dependsOnAnswer === showIf;
  };

  const renderQuestion = (question: QuestionnaireQuestion) => {
    if (!shouldShowQuestion(question)) return null;

    switch (question.type) {
      case 'likert':
        return (
          <div key={question.id} className="mb-6">
            <label className="block text-slate-900 font-medium mb-3">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="flex gap-2">
              {Array.from({ length: question.scale || 5 }, (_, i) => i + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAnswers({ ...answers, [question.id]: value })}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                    answers[question.id] === value
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Pas du tout d'accord</span>
              <span>Tout à fait d'accord</span>
            </div>
          </div>
        );

      case 'yesno':
        return (
          <div key={question.id} className="mb-6">
            <label className="block text-slate-900 font-medium mb-3">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setAnswers({ ...answers, [question.id]: 'yes' })}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                  answers[question.id] === 'yes'
                    ? 'bg-emerald-600 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Oui
              </button>
              <button
                type="button"
                onClick={() => setAnswers({ ...answers, [question.id]: 'no' })}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                  answers[question.id] === 'no'
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Non
              </button>
            </div>
          </div>
        );

      case 'text':
        return (
          <div key={question.id} className="mb-6">
            <label className="block text-slate-900 font-medium mb-3">
              {question.question}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.multiline ? (
              <textarea
                required={question.required}
                value={answers[question.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <input
                type="text"
                required={question.required}
                value={answers[question.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 shadow-lg max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Erreur</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 shadow-lg max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Merci !</h2>
          <p className="text-slate-600">Votre réponse a été enregistrée avec succès.</p>
        </div>
      </div>
    );
  }

  const schema: QuestionnaireSchema = questionnaireData?.link?.questionnaire_template?.schema_json;

  if (!schema) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Questionnaire invalide</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{schema.title}</h1>
              {schema.description && (
                <p className="text-slate-600 mt-1">{schema.description}</p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8">
            {schema.sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-8">
                <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                  {section.title}
                </h2>
                {section.questions.map((question) => renderQuestion(question))}
              </div>
            ))}

            <div className="mt-8 pt-6 border-t border-slate-200">
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg"
              >
                Envoyer mes réponses
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
