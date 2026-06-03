// @ts-nocheck
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Plus, Search, ArrowLeft, Home, Upload, FileText, Eye, X, Trash2 } from 'lucide-react';
import { qualiopiClient } from '../lib/qualiopiClient';
import { supabase } from '../lib/supabase';
import type { Training } from '../types/qualiopi';
import LogWidget from '../components/LogWidget';

export default function QualiopiTrainings() {
  const navigate = useNavigate();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [filteredTrainings, setFilteredTrainings] = useState<Training[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingTrainingId, setUploadingTrainingId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentTrainingForUpload, setCurrentTrainingForUpload] = useState<Training | null>(null);
  const [newTrainingPdfFile, setNewTrainingPdfFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<Array<{ id: string; timestamp: Date; message: string; type: 'info' | 'success' | 'error' | 'warning' }>>([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration_days: 1,
    version: '1.0'
  });

  useEffect(() => {
    loadTrainings();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredTrainings(
        trainings.filter((t) => t.title.toLowerCase().includes(query))
      );
    } else {
      setFilteredTrainings(trainings);
    }
  }, [searchQuery, trainings]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      timestamp: new Date(),
      message,
      type
    }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const loadTrainings = async () => {
    try {
      const data = await qualiopiClient.getTrainings();
      setTrainings(data);
      setFilteredTrainings(data);
    } catch (error) {
      console.error('Error loading trainings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      addLog('Création de la formation...', 'info');
      const tempTitle = newTrainingPdfFile
        ? newTrainingPdfFile.name.replace('.pdf', '')
        : 'Sans titre';
      const trainingData = {
        ...formData,
        title: formData.title || tempTitle,
        duration_days: formData.duration_days || 1,
        meta_json: {}
      };

      const newTraining = await qualiopiClient.createTraining(trainingData);
      addLog('Formation créée avec succès', 'success');

      if (newTrainingPdfFile) {
        addLog('Upload du PDF en cours...', 'info');

        const uploadFormData = new FormData();
        uploadFormData.append('file', newTrainingPdfFile);
        uploadFormData.append('trainingId', newTraining.id);

        addLog('Envoi du fichier vers le serveur...', 'info');

        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Vous devez être connecté pour uploader un document');
        }

        addLog('Session authentifiée', 'info');

        // Use fetch directly for better error handling
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-training-document`;

        const fetchResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: uploadFormData,
        });

        addLog(`Statut HTTP: ${fetchResponse.status}`, 'info');

        const responseText = await fetchResponse.text();
        addLog(`Réponse brute: ${responseText.substring(0, 500)}`, 'info');

        if (!fetchResponse.ok) {
          let errorMessage = 'Erreur serveur inconnue';
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            errorMessage = responseText || errorMessage;
          }
          addLog(`Erreur détaillée: ${errorMessage}`, 'error');
          throw new Error(errorMessage);
        }

        const response = JSON.parse(responseText);

        addLog('Réponse serveur reçue', 'info');

        if (response.success) {
          addLog('PDF uploadé et analysé avec succès', 'success');

          if (response.extractedMetadata) {
            addLog('=== Métadonnées extraites par IA ===', 'success');
            if (response.extractedMetadata.title) {
              addLog(`Titre: ${response.extractedMetadata.title}`, 'info');
            }
            if (response.extractedMetadata.duration_days) {
              addLog(`Durée: ${response.extractedMetadata.duration_days} jours`, 'info');
            }
            if (response.extractedMetadata.description) {
              addLog(`Description: ${response.extractedMetadata.description.substring(0, 150)}...`, 'info');
            }
            if (response.extractedMetadata.meta_json) {
              const meta = response.extractedMetadata.meta_json;
              if (meta.objectives && meta.objectives.length > 0) {
                addLog(`Objectifs: ${meta.objectives.length} objectifs identifiés`, 'info');
              }
              if (meta.target_audience) {
                addLog(`Public cible: ${meta.target_audience}`, 'info');
              }
            }
          } else {
            addLog('⚠️ Aucune métadonnée extraite', 'warning');
            addLog('→ L\'extraction IA n\'a pas pu extraire de métadonnées', 'info');
            addLog('→ Vérifiez la configuration sur /qualiopi/secrets-check', 'info');
          }

          addLog('Rechargement des données...', 'info');
          await loadTrainings();
        } else {
          addLog(`Erreur API: ${response.error || 'Réponse inattendue'}`, 'error');
          throw new Error(response.error || 'Upload failed');
        }
      }

      resetForm();
    } catch (error: any) {
      console.error('Error creating training:', error);
      addLog(`Erreur lors de la création: ${error?.message}`, 'error');
      alert('Erreur lors de la création');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      duration_days: 1,
      version: '1.0'
    });
    setNewTrainingPdfFile(null);
    setShowForm(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      alert('Veuillez sélectionner un fichier PDF');
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile || !currentTrainingForUpload) return;

    setUploadingTrainingId(currentTrainingForUpload.id);
    addLog(`Upload du PDF pour "${currentTrainingForUpload.title}"...`, 'info');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('trainingId', currentTrainingForUpload.id);

      addLog('Envoi du fichier...', 'info');

      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Vous devez être connecté pour uploader un document');
      }

      addLog('Session authentifiée', 'info');

      // Use fetch directly for better error handling
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-training-document`;

      const fetchResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: formData,
      });

      addLog(`Statut HTTP: ${fetchResponse.status}`, 'info');

      const responseText = await fetchResponse.text();
      addLog(`Réponse brute: ${responseText.substring(0, 500)}`, 'info');

      if (!fetchResponse.ok) {
        let errorMessage = 'Erreur serveur inconnue';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        addLog(`Erreur détaillée: ${errorMessage}`, 'error');
        throw new Error(errorMessage);
      }

      const response = JSON.parse(responseText);

      addLog('Réponse serveur reçue', 'info');

      if (!response.success) {
        addLog(`Erreur API: ${response.error || 'Réponse inattendue'}`, 'error');
        throw new Error(response.error || 'Upload failed');
      }

      addLog('PDF uploadé avec succès', 'success');

      if (response.extractedMetadata) {
        addLog('=== Métadonnées extraites par IA ===', 'success');
        if (response.extractedMetadata.title) {
          addLog(`Titre: ${response.extractedMetadata.title}`, 'info');
        }
        if (response.extractedMetadata.duration_days) {
          addLog(`Durée: ${response.extractedMetadata.duration_days} jours`, 'info');
        }
        if (response.extractedMetadata.description) {
          addLog(`Description: ${response.extractedMetadata.description.substring(0, 150)}...`, 'info');
        }
        if (response.extractedMetadata.meta_json) {
          const meta = response.extractedMetadata.meta_json;
          if (meta.objectives && meta.objectives.length > 0) {
            addLog(`Objectifs: ${meta.objectives.length} objectifs identifiés`, 'info');
          }
          if (meta.target_audience) {
            addLog(`Public cible: ${meta.target_audience}`, 'info');
          }
        }
        addLog('Analyse terminée - Titre et métadonnées extraits', 'success');
      } else {
        addLog('⚠️ Aucune métadonnée extraite', 'warning');
        addLog('→ L\'extraction IA n\'a pas pu extraire de métadonnées', 'info');
        addLog('→ Vérifiez la configuration sur /qualiopi/secrets-check', 'info');
      }

      addLog('Rechargement des données...', 'info');
      await loadTrainings();

      setShowUploadModal(false);
      setSelectedFile(null);
      setCurrentTrainingForUpload(null);
      if (response.extractedMetadata) {
        alert('Document uploadé avec succès ! Le titre et les métadonnées ont été extraits automatiquement par IA.');
      } else {
        alert('Document uploadé avec succès ! (Métadonnées non extraites - voir les logs pour plus de détails)');
      }
    } catch (error: any) {
      console.error('Error uploading document:', error);
      addLog(`Erreur: ${error?.message}`, 'error');
      alert('Erreur lors de l\'upload du document');
    } finally {
      setUploadingTrainingId(null);
    }
  };

  const openUploadModal = (training: Training) => {
    setCurrentTrainingForUpload(training);
    setShowUploadModal(true);
    setSelectedFile(null);
  };

  const handleDeleteTraining = async (training: Training) => {
    if (!confirm(`Voulez-vous vraiment supprimer la formation "${training.title}" ?`)) {
      return;
    }

    try {
      addLog(`Suppression de "${training.title}"...`, 'info');
      await qualiopiClient.deleteTraining(training.id);
      addLog('Formation supprimée avec succès', 'success');
      await loadTrainings();
    } catch (error: any) {
      console.error('Error deleting training:', error);
      addLog(`Erreur lors de la suppression: ${error?.message}`, 'error');
      alert('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center animate-in fade-in duration-500">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-6 text-slate-600 text-lg font-medium">Chargement des formations...</p>
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
            className="flex items-center gap-1 hover:text-blue-600 transition-colors"
          >
            <Home className="w-4 h-4" />
            Tableau de bord
          </button>
          <span>/</span>
          <span className="text-slate-900 font-medium">Formations</span>
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
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Catalogue de Formations</h1>
            <p className="text-slate-600">{trainings.length} formation{trainings.length > 1 ? 's' : ''} disponible{trainings.length > 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 hover:scale-105 transition-all shadow-lg hover:shadow-xl font-semibold"
          >
            <Plus className="w-5 h-5" />
            Nouvelle formation
          </button>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher une formation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">Nouvelle formation</h2>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Programme de formation (PDF) {newTrainingPdfFile && <span className="text-emerald-600">✓</span>}
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors bg-slate-50">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && file.type === 'application/pdf') {
                          setNewTrainingPdfFile(file);
                        } else if (file) {
                          alert('Veuillez sélectionner un fichier PDF');
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                      id="new-training-pdf"
                    />
                    <label
                      htmlFor="new-training-pdf"
                      className="cursor-pointer flex flex-col items-center"
                    >
                      <Upload className="w-10 h-10 text-slate-400 mb-2" />
                      {newTrainingPdfFile ? (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <FileText className="w-5 h-5" />
                          <span className="font-medium">{newTrainingPdfFile.name}</span>
                        </div>
                      ) : (
                        <>
                          <span className="text-blue-600 font-medium mb-1">
                            Cliquez pour sélectionner un fichier PDF
                          </span>
                          <span className="text-xs text-slate-500">
                            Le titre, description et durée seront extraits automatiquement
                          </span>
                        </>
                      )}
                    </label>
                  </div>
                  {newTrainingPdfFile && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800 font-medium">
                        L'IA analysera le PDF et remplira automatiquement les champs ci-dessous
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Titre {!newTrainingPdfFile && <span className="text-red-500">*</span>}
                    {newTrainingPdfFile && <span className="text-xs text-slate-500 ml-2">(sera rempli automatiquement)</span>}
                  </label>
                  <input
                    type="text"
                    required={!newTrainingPdfFile}
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={newTrainingPdfFile ? "Sera extrait du PDF..." : "Titre de la formation"}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                    {newTrainingPdfFile && <span className="text-xs text-slate-500 ml-2">(sera rempli automatiquement)</span>}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={newTrainingPdfFile ? "Sera extrait du PDF..." : "Description de la formation"}
                    rows={4}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Durée (jours) {!newTrainingPdfFile && <span className="text-red-500">*</span>}
                      {newTrainingPdfFile && <span className="text-xs text-slate-500 ml-2">(sera rempli automatiquement)</span>}
                    </label>
                    <input
                      type="number"
                      required={!newTrainingPdfFile}
                      min="1"
                      value={formData.duration_days}
                      onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) })}
                      placeholder={newTrainingPdfFile ? "Auto" : ""}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Version
                    </label>
                    <input
                      type="text"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
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
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Créer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {filteredTrainings.map((training) => {
            const meta = training.meta_json || {};
            const hasMetadata = meta.objectives || meta.target_audience || meta.prerequisites || meta.program_details;

            return (
              <div
                key={training.id}
                className="group bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 border border-slate-100 hover:border-blue-200 relative overflow-hidden"
              >
                <button
                  onClick={() => handleDeleteTraining(training)}
                  className="absolute top-3 right-3 p-2 bg-white rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 z-10"
                  title="Supprimer la formation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {training.program_document ? (
                  <div className="relative h-64 bg-slate-100 overflow-hidden">
                    <iframe
                      src={`${training.program_document.file_url}#view=FitH&toolbar=0&navpanes=0`}
                      className="w-full h-full pointer-events-none"
                      title="PDF Preview"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-full shadow-lg">
                      <FileText className="w-3 h-3" />
                      PDF Analysé
                    </span>
                  </div>
                ) : (
                  <div className="h-64 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                    <div className="text-center">
                      <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">Aucun programme PDF</p>
                    </div>
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">{training.title}</h3>

                  {training.description && (
                    <p className="text-slate-600 text-sm mb-4 line-clamp-2">{training.description}</p>
                  )}

                  <div className="flex items-center justify-between pt-3 pb-4 border-t border-slate-100">
                    <span className="text-sm text-slate-600 font-medium">
                      {training.duration_days} jour{training.duration_days > 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-slate-500">v{training.version}</span>
                  </div>

                  {hasMetadata && (
                    <div className="space-y-3 mb-4 pb-4 border-b border-slate-100">
                      {meta.target_audience && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Public cible</p>
                          <p className="text-sm text-slate-700">{meta.target_audience}</p>
                        </div>
                      )}

                      {meta.objectives && Array.isArray(meta.objectives) && meta.objectives.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Objectifs</p>
                          <ul className="text-sm text-slate-700 space-y-1">
                            {meta.objectives.slice(0, 3).map((obj: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-blue-500 mt-1">•</span>
                                <span className="line-clamp-1">{obj}</span>
                              </li>
                            ))}
                          </ul>
                          {meta.objectives.length > 3 && (
                            <p className="text-xs text-slate-500 mt-1">+{meta.objectives.length - 3} autres objectifs</p>
                          )}
                        </div>
                      )}

                      {meta.prerequisites && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Prérequis</p>
                          <p className="text-sm text-slate-700 line-clamp-2">{meta.prerequisites}</p>
                        </div>
                      )}

                      {meta.trainer && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Formateur</p>
                          <p className="text-sm text-slate-700">{meta.trainer}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {training.program_document ? (
                      <>
                        <a
                          href={training.program_document.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Eye className="w-4 h-4" />
                          Voir PDF complet
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openUploadModal(training);
                          }}
                          className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                          title="Remplacer le PDF"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openUploadModal(training);
                        }}
                        disabled={uploadingTrainingId === training.id}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" />
                        {uploadingTrainingId === training.id ? 'Upload...' : 'Ajouter PDF'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredTrainings.length === 0 && (
            <div className="col-span-full text-center py-12">
              <GraduationCap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 text-lg">Aucune formation trouvée</p>
            </div>
          )}
        </div>

        {showUploadModal && currentTrainingForUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-slate-900">
                  Ajouter un programme PDF
                </h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setCurrentTrainingForUpload(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <p className="text-slate-600 mb-6">
                Formation: <strong>{currentTrainingForUpload.title}</strong>
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Sélectionner le fichier PDF du programme
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <label
                    htmlFor="pdf-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <Upload className="w-12 h-12 text-slate-400 mb-3" />
                    {selectedFile ? (
                      <div className="flex items-center gap-2 text-emerald-600">
                        <FileText className="w-5 h-5" />
                        <span className="font-medium">{selectedFile.name}</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-blue-600 font-medium mb-1">
                          Cliquez pour sélectionner un fichier
                        </span>
                        <span className="text-sm text-slate-500">
                          Fichiers PDF uniquement
                        </span>
                      </>
                    )}
                  </label>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Le contenu du PDF sera extrait automatiquement par IA pour être utilisé dans les emails
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setCurrentTrainingForUpload(null);
                  }}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleUploadDocument}
                  disabled={!selectedFile || uploadingTrainingId !== null}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploadingTrainingId ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Upload en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Uploader
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <LogWidget logs={logs} onClear={clearLogs} />
      </div>
    </div>
  );
}
