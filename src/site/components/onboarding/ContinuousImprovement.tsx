// @ts-nocheck
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { MessageSquare, Send, CheckCircle2, Clock, Lightbulb } from 'lucide-react';
import AdminLogo from '../AdminLogo';

export default function ContinuousImprovement() {
  const { profile, adminMode } = useAuth();
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [newFeedback, setNewFeedback] = useState({
    type: 'objection' as 'objection' | 'script_improvement' | 'general',
    content: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFeedbacks();
  }, [profile, adminMode]);

  const loadFeedbacks = async () => {
    if (!profile && !adminMode) return;
    if (!profile) return;

    const { data } = await supabase
      .from('feedback')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });

    setFeedbacks(data || []);
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedback.content) return;
    if (!profile) {
      alert('Mode démo : le feedback ne sera pas sauvegardé');
      setNewFeedback({ type: 'objection', content: '' });
      return;
    }

    setLoading(true);
    try {
      await supabase.from('feedback').insert({
        profile_id: profile.id,
        feedback_type: newFeedback.type,
        content: newFeedback.content,
        status: 'new',
      });

      setNewFeedback({ type: 'objection', content: '' });
      await loadFeedbacks();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-700';
      case 'reviewed':
        return 'bg-orange-100 text-orange-700';
      case 'implemented':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Clock className="w-4 h-4" />;
      case 'reviewed':
        return <MessageSquare className="w-4 h-4" />;
      case 'implemented':
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new':
        return 'Nouveau';
      case 'reviewed':
        return 'En révision';
      case 'implemented':
        return 'Implémenté';
      default:
        return status;
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
            Amélioration Continue
          </h1>
          <p className="text-lg text-slate-600">
            Le terrain nourrit le système.
          </p>
        </div>

        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-xl p-8 text-white mb-8">
          <div className="flex items-start gap-4">
            <Lightbulb className="w-8 h-8 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-bold mb-2">Vos retours permettent :</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>D'améliorer les scripts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>D'ajuster les discours</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>D'augmenter la qualité globale</span>
                </li>
              </ul>
              <p className="mt-4 text-lg italic">
                Chez Aissociate, le système évolue. Pas l'improvisation.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Soumettre un feedback</h2>

          <form onSubmit={submitFeedback} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Type de feedback
              </label>
              <select
                value={newFeedback.type}
                onChange={(e) => setNewFeedback({ ...newFeedback, type: e.target.value as any })}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="objection">Objection récurrente</option>
                <option value="script_improvement">Amélioration de script</option>
                <option value="general">Feedback général</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Votre feedback
              </label>
              <textarea
                required
                value={newFeedback.content}
                onChange={(e) => setNewFeedback({ ...newFeedback, content: e.target.value })}
                rows={6}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                placeholder="Décrivez votre observation, suggestion ou objection rencontrée..."
              />
            </div>

            <button
              type="submit"
              disabled={loading || !newFeedback.content}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              <Send className="w-5 h-5" />
              {loading ? 'Envoi en cours...' : 'Envoyer le feedback'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Historique des feedbacks</h2>

          {feedbacks.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600">Aucun feedback soumis pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className="border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(feedback.status)}`}>
                        {getStatusIcon(feedback.status)}
                        {getStatusText(feedback.status)}
                      </span>
                      <span className="text-sm text-slate-500">
                        {feedback.feedback_type === 'objection' && 'Objection'}
                        {feedback.feedback_type === 'script_improvement' && 'Amélioration'}
                        {feedback.feedback_type === 'general' && 'Général'}
                      </span>
                    </div>
                    <span className="text-sm text-slate-500">
                      {new Date(feedback.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{feedback.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
