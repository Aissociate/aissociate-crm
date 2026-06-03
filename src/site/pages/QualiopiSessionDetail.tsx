// @ts-nocheck
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Plus,
  FileText,
  Mail,
  ClipboardCheck,
  Download,
  Calendar,
  MapPin,
  Home
} from 'lucide-react';
import { qualiopiClient } from '../lib/qualiopiClient';
import type { Session, Trainee } from '../types/qualiopi';

export default function QualiopiSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionTrainees, setSessionTrainees] = useState<any[]>([]);
  const [allTrainees, setAllTrainees] = useState<Trainee[]>([]);
  const [showAddTrainee, setShowAddTrainee] = useState(false);
  const [selectedTraineeId, setSelectedTraineeId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      const [sessionData, traineesData, allTraineesData] = await Promise.all([
        qualiopiClient.getSession(id),
        qualiopiClient.getSessionTrainees(id),
        qualiopiClient.getTrainees()
      ]);

      setSession(sessionData);
      setSessionTrainees(traineesData);
      setAllTrainees(allTraineesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrainee = async () => {
    if (!id || !selectedTraineeId) return;

    try {
      await qualiopiClient.addTraineeToSession(id, selectedTraineeId);
      await loadData();
      setShowAddTrainee(false);
      setSelectedTraineeId('');
    } catch (error) {
      console.error('Error adding trainee:', error);
      alert('Erreur lors de l\'ajout du stagiaire');
    }
  };

  const handleRemoveTrainee = async (traineeId: string) => {
    if (!id) return;

    if (!confirm('Retirer ce stagiaire de la session ?')) return;

    try {
      await qualiopiClient.removeTraineeFromSession(id, traineeId);
      await loadData();
    } catch (error) {
      console.error('Error removing trainee:', error);
    }
  };

  const handleSendConvocations = async () => {
    alert('Fonctionnalité d\'envoi de convocations à implémenter avec Edge Function');
  };

  const handleSendHotQuestionnaire = async () => {
    alert('Fonctionnalité d\'envoi de questionnaire à chaud à implémenter avec Edge Function');
  };

  const handleExportProofs = async () => {
    alert('Fonctionnalité d\'export des preuves à implémenter');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const availableTrainees = allTrainees.filter(
    (t) => !sessionTrainees.some((st) => st.trainee_id === t.id)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center animate-in fade-in duration-500">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto"></div>
          <p className="mt-6 text-slate-600 text-lg font-medium">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Session non trouvée</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 text-sm text-slate-600 mb-6">
          <button
            onClick={() => navigate('/qualiopi')}
            className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
          >
            <Home className="w-4 h-4" />
            Tableau de bord
          </button>
          <span>/</span>
          <button
            onClick={() => navigate('/qualiopi/sessions')}
            className="hover:text-emerald-600 transition-colors"
          >
            Sessions
          </button>
          <span>/</span>
          <span className="text-slate-900 font-medium">Détail de la session</span>
        </div>

        <button
          onClick={() => navigate('/qualiopi/sessions')}
          className="group flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-all"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Retour aux sessions</span>
        </button>

        <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            {session.training?.title || 'Session'}
          </h1>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="w-5 h-5" />
              <span>
                {formatDate(session.start_date)} - {formatDate(session.end_date)}
              </span>
            </div>

            {session.location && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-5 h-5" />
                <span>{session.location}</span>
              </div>
            )}

            {session.trainer_name && (
              <div className="flex items-center gap-2 text-slate-600">
                <Users className="w-5 h-5" />
                <span>{session.trainer_name}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSendConvocations}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 hover:scale-105 transition-all text-sm shadow-md hover:shadow-lg"
            >
              <FileText className="w-4 h-4" />
              Envoyer convocations
            </button>

            <button
              onClick={handleSendHotQuestionnaire}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 hover:scale-105 transition-all text-sm shadow-md hover:shadow-lg"
            >
              <ClipboardCheck className="w-4 h-4" />
              Questionnaire à chaud
            </button>

            <button
              onClick={handleExportProofs}
              className="flex items-center gap-2 bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 hover:scale-105 transition-all text-sm shadow-md hover:shadow-lg"
            >
              <Download className="w-4 h-4" />
              Exporter preuves
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">
              Stagiaires ({sessionTrainees.length})
            </h2>
            <button
              onClick={() => setShowAddTrainee(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 hover:scale-105 transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Ajouter
            </button>
          </div>

          {showAddTrainee && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 animate-in slide-in-from-top-2 duration-300">
              <h3 className="font-semibold text-slate-900 mb-3">Ajouter un stagiaire</h3>
              <div className="flex gap-3">
                <select
                  value={selectedTraineeId}
                  onChange={(e) => setSelectedTraineeId(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sélectionner un stagiaire</option>
                  {availableTrainees.map((trainee) => (
                    <option key={trainee.id} value={trainee.id}>
                      {trainee.first_name} {trainee.last_name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddTrainee}
                  disabled={!selectedTraineeId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ajouter
                </button>
                <button
                  onClick={() => {
                    setShowAddTrainee(false);
                    setSelectedTraineeId('');
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {sessionTrainees.map((st) => (
              <div
                key={st.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {st.trainee.first_name} {st.trainee.last_name}
                  </p>
                  <p className="text-sm text-slate-600">{st.trainee.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => alert('Voir détails stagiaire')}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Mail className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleRemoveTrainee(st.trainee_id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            {sessionTrainees.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">Aucun stagiaire inscrit</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
