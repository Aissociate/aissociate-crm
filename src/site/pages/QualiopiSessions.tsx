// @ts-nocheck
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, Search, Users, MapPin, Clock, ArrowLeft, Home } from 'lucide-react';
import { qualiopiClient } from '../lib/qualiopiClient';
import type { Session, Training } from '../types/qualiopi';

export default function QualiopiSessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    training_id: '',
    start_date: '',
    end_date: '',
    modality: 'PRESENTIEL' as const,
    trainer_name: '',
    location: '',
    max_capacity: 12
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredSessions(
        sessions.filter(
          (s) =>
            s.training?.title.toLowerCase().includes(query) ||
            s.location?.toLowerCase().includes(query) ||
            s.trainer_name?.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredSessions(sessions);
    }
  }, [searchQuery, sessions]);

  const loadData = async () => {
    try {
      const [sessionsData, trainingsData] = await Promise.all([
        qualiopiClient.getSessions(),
        qualiopiClient.getTrainings()
      ]);
      setSessions(sessionsData);
      setTrainings(trainingsData);
      setFilteredSessions(sessionsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await qualiopiClient.createSession({
        ...formData,
        meta_json: {}
      });

      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Erreur lors de la création');
    }
  };

  const resetForm = () => {
    setFormData({
      training_id: '',
      start_date: '',
      end_date: '',
      modality: 'PRESENTIEL',
      trainer_name: '',
      location: '',
      max_capacity: 12
    });
    setShowForm(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getModalityColor = (modality: string) => {
    switch (modality) {
      case 'PRESENTIEL':
        return 'bg-blue-100 text-blue-800';
      case 'DISTANCIEL':
        return 'bg-green-100 text-green-800';
      case 'HYBRIDE':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center animate-in fade-in duration-500">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto"></div>
          <p className="mt-6 text-slate-600 text-lg font-medium">Chargement des sessions...</p>
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
          <span className="text-slate-900 font-medium">Sessions</span>
        </div>

        <button
          onClick={() => navigate('/qualiopi')}
          className="group flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-all"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Retour au tableau de bord</span>
        </button>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Gestion des Sessions</h1>
            <p className="text-slate-600">{sessions.length} session{sessions.length > 1 ? 's' : ''} planifiée{sessions.length > 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 hover:scale-105 transition-all shadow-lg hover:shadow-xl font-semibold"
          >
            <Plus className="w-5 h-5" />
            Nouvelle session
          </button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher une session..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Nouvelle session</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Formation *
                  </label>
                  <select
                    required
                    value={formData.training_id}
                    onChange={(e) => setFormData({ ...formData, training_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner une formation</option>
                    {trainings.map((training) => (
                      <option key={training.id} value={training.id}>
                        {training.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Date de début *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Date de fin *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Modalité *
                  </label>
                  <select
                    required
                    value={formData.modality}
                    onChange={(e) => setFormData({ ...formData, modality: e.target.value as any })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="PRESENTIEL">Présentiel</option>
                    <option value="DISTANCIEL">Distanciel</option>
                    <option value="HYBRIDE">Hybride</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Formateur
                  </label>
                  <input
                    type="text"
                    value={formData.trainer_name}
                    onChange={(e) => setFormData({ ...formData, trainer_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Lieu
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Lieu de formation communiqué dans la convocation"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Capacité maximale
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_capacity}
                    onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Créer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => navigate(`/qualiopi/sessions/${session.id}`)}
              className="bg-white rounded-lg p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-emerald-200 cursor-pointer hover:-translate-y-1"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {session.training?.title || 'Formation'}
                  </h3>
                  <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${getModalityColor(session.modality)}`}>
                    {session.modality}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {formatDate(session.start_date)} - {formatDate(session.end_date)}
                  </span>
                </div>

                {session.location && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="w-4 h-4" />
                    <span>{session.location}</span>
                  </div>
                )}

                {session.trainer_name && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Users className="w-4 h-4" />
                    <span>{session.trainer_name}</span>
                  </div>
                )}

                {session.max_capacity && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4" />
                    <span>Capacité: {session.max_capacity} places</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredSessions.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 text-lg">Aucune session trouvée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
