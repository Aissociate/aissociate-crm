// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Eye,
  FileText,
  Mic,
  AlertCircle,
  LogOut,
  BookOpen,
  Search,
  Wallet,
  Send
} from 'lucide-react';
import AdminLogo from '../components/AdminLogo';
import CommercialPerformanceReport from '../components/CommercialPerformanceReport';
import ProspectsCSVUpload from '../components/ProspectsCSVUpload';
import FixerKPITargetsEditor from '../components/FixerKPITargetsEditor';
import CloserKPITargetsEditor from '../components/CloserKPITargetsEditor';

interface CommercialProfile {
  id: string;
  email: string;
  role: string;
  status: string;
  experience: string;
  availability: string;
  motivation: string;
  created_at: string;
  framework_accepted_at: string | null;
  training_completed_at: string | null;
  validated_at: string | null;
  activated_at: string | null;
}

interface Application {
  id: string;
  profile_id: string;
  role_desired: string;
  experience: string;
  availability: string;
  motivation: string;
  ethical_framework_accepted: boolean;
  cv_url: string | null;
  status: string;
  created_at: string;
}

interface TrainingProgress {
  id: string;
  profile_id: string;
  module_common_completed: boolean;
  module_role_completed: boolean;
  quiz_score: number;
  quiz_passed: boolean;
  test_call_url: string | null;
  test_call_validated: boolean;
  completed_at: string | null;
}

interface CommercialData {
  profile: CommercialProfile;
  application: Application | null;
  training: TrainingProgress | null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [commercials, setCommercials] = useState<CommercialData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommercial, setSelectedCommercial] = useState<CommercialData | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [showFixerKPIEditor, setShowFixerKPIEditor] = useState(false);
  const [showCloserKPIEditor, setShowCloserKPIEditor] = useState(false);
  const [showCandidatesSection, setShowCandidatesSection] = useState(true);
  const [financingAlertsCount, setFinancingAlertsCount] = useState(0);

  useEffect(() => {
    console.log('🔍 AdminDashboard: profile=', profile, 'is_admin=', profile?.is_admin);

    if (!profile) return;

    if (!profile.is_admin) {
      console.log('⚠️ User is not admin, redirecting to dashboard');
      navigate('/dashboard');
      return;
    }

    console.log('✅ Admin access granted, loading commercials');
    loadCommercials();
    loadFinancingAlerts();
  }, [profile, navigate]);

  const loadFinancingAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('dossiers')
        .select('id, financing_mode, complementary_funding_type')
        .in('status', ['décision_oui', 'formation_planifiée', 'formation_réalisée', 'attente_encaissement']);

      if (error) throw error;

      const alertsCount = (data || []).filter(
        d => d.financing_mode && d.financing_mode !== 'cpf' && d.financing_mode !== ''
      ).length;

      setFinancingAlertsCount(alertsCount);
    } catch (error) {
      console.error('Error loading financing alerts:', error);
    }
  };

  const loadCommercials = async () => {
    setLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!profiles) {
        setCommercials([]);
        return;
      }

      // Fetch applications and training progress for all profiles
      const profileIds = profiles.map(p => p.id);

      const { data: applications } = await supabase
        .from('applications')
        .select('*')
        .in('profile_id', profileIds);

      const { data: trainings } = await supabase
        .from('training_progress')
        .select('*')
        .in('profile_id', profileIds);

      // Combine data
      const commercialData: CommercialData[] = profiles.map(profile => ({
        profile,
        application: applications?.find(a => a.profile_id === profile.id) || null,
        training: trainings?.find(t => t.profile_id === profile.id) || null,
      }));

      setCommercials(commercialData);
    } catch (error) {
      console.error('Error loading commercials:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfileStatus = async (profileId: string, status: string) => {
    try {
      await supabase
        .from('profiles')
        .update({ status })
        .eq('id', profileId);

      if (status === 'active') {
        await supabase
          .from('training_progress')
          .update({ test_call_validated: true })
          .eq('profile_id', profileId);
      }

      await loadCommercials();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const archiveProfile = async (profileId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir archiver ce candidat ?')) return;

    try {
      await supabase
        .from('profiles')
        .update({ status: 'archived' })
        .eq('id', profileId);

      await loadCommercials();
      setSelectedCommercial(null);
    } catch (error) {
      console.error('Error archiving profile:', error);
      alert('Erreur lors de l\'archivage du candidat');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string; icon: any }> = {
      new_user: { color: 'bg-gray-100 text-gray-700', label: 'Nouveau', icon: Clock },
      pending_quiz: { color: 'bg-blue-100 text-blue-700', label: 'Quiz en attente', icon: FileText },
      pending_audio: { color: 'bg-yellow-100 text-yellow-700', label: 'Audio en attente', icon: Clock },
      active: { color: 'bg-emerald-100 text-emerald-700', label: 'Validé', icon: CheckCircle2 },
      rejected: { color: 'bg-red-100 text-red-700', label: 'Rejeté', icon: XCircle },
      archived: { color: 'bg-slate-100 text-slate-700', label: 'Archivé', icon: XCircle },
    };

    const badge = badges[status] || badges.new_user;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    );
  };

  const downloadCV = async (cvUrl: string, profileEmail: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('cvs')
        .download(cvUrl);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CV_${profileEmail}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading CV:', error);
      alert('Erreur lors du téléchargement du CV');
    }
  };

  const filteredCommercials = filterStatus === 'all'
    ? commercials
    : commercials.filter(c => c.profile.status === filterStatus);

  const stats = {
    total: commercials.length,
    newUsers: commercials.filter(c => c.profile.status === 'new_user').length,
    active: commercials.filter(c => c.profile.status === 'active').length,
    archived: commercials.filter(c => c.profile.status === 'archived').length,
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Logout Button */}
        <div className="flex justify-end mb-4 gap-3">
          <button
            onClick={() => navigate('/formation')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold"
          >
            <BookOpen className="w-4 h-4" />
            Formation
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Aissociate Logo"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Tableau de Bord Admin</h1>
              <p className="text-slate-600">Gestion des commerciaux</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/admin/dispatch')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-semibold"
            >
              <Send className="w-4 h-4" />
              Dispatch Prospects
            </button>
            <button
              onClick={() => navigate('/admin/prospects')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
            >
              <Search className="w-4 h-4" />
              Recherche Prospects
            </button>
            <button
              onClick={() => navigate('/admin/financing')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg transition-colors font-semibold relative"
            >
              <Wallet className="w-4 h-4" />
              Suivi Financements
              {financingAlertsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {financingAlertsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('/admin/kpis')}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-lg transition-colors font-semibold"
            >
              Mon Espace
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
            >
              Retour
            </button>
          </div>
        </div>

        {financingAlertsCount > 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <p className="font-semibold text-amber-900">
                  {financingAlertsCount} dossier{financingAlertsCount > 1 ? 's' : ''} avec financement non-CPF nécessite{financingAlertsCount > 1 ? 'nt' : ''} un suivi
                </p>
              </div>
              <button
                onClick={() => navigate('/admin/financing')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-semibold text-sm"
              >
                Voir les dossiers
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm">Total</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-slate-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm">Nouveaux</p>
                <p className="text-2xl font-bold text-gray-700">{stats.newUsers}</p>
              </div>
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm">Validés</p>
                <p className="text-2xl font-bold text-emerald-700">{stats.active}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-sm">Archivés</p>
                <p className="text-2xl font-bold text-slate-700">{stats.archived}</p>
              </div>
              <XCircle className="w-8 h-8 text-slate-400" />
            </div>
          </div>
        </div>

        {/* CSV Upload Section */}
        <div className="mb-6">
          <button
            onClick={() => setShowCSVUpload(!showCSVUpload)}
            className={`w-full px-6 py-3 rounded-xl font-semibold transition-all ${
              showCSVUpload
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white'
                : 'bg-white text-slate-900 border-2 border-slate-200 hover:border-orange-500'
            }`}
          >
            {showCSVUpload ? 'Masquer' : 'Afficher'} l'import CSV de prospects
          </button>
          {showCSVUpload && (
            <div className="mt-4">
              <ProspectsCSVUpload onSuccess={() => {}} />
            </div>
          )}
        </div>

        {/* Fixer KPI Targets Editor */}
        <div className="mb-6">
          <button
            onClick={() => setShowFixerKPIEditor(!showFixerKPIEditor)}
            className={`w-full px-6 py-3 rounded-xl font-semibold transition-all ${
              showFixerKPIEditor
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white'
                : 'bg-white text-slate-900 border-2 border-slate-200 hover:border-orange-500'
            }`}
          >
            {showFixerKPIEditor ? 'Masquer' : 'Afficher'} les objectifs KPI Fixers
          </button>
          {showFixerKPIEditor && (
            <div className="mt-4">
              <FixerKPITargetsEditor />
            </div>
          )}
        </div>

        {/* Closer KPI Targets Editor */}
        <div className="mb-6">
          <button
            onClick={() => setShowCloserKPIEditor(!showCloserKPIEditor)}
            className={`w-full px-6 py-3 rounded-xl font-semibold transition-all ${
              showCloserKPIEditor
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white'
                : 'bg-white text-slate-900 border-2 border-slate-200 hover:border-orange-500'
            }`}
          >
            {showCloserKPIEditor ? 'Masquer' : 'Afficher'} les objectifs KPI Closers
          </button>
          {showCloserKPIEditor && (
            <div className="mt-4">
              <CloserKPITargetsEditor />
            </div>
          )}
        </div>

        {/* Candidatures Section with Accordion */}
        <div className="mb-6">
          <button
            onClick={() => setShowCandidatesSection(!showCandidatesSection)}
            className={`w-full px-6 py-4 rounded-t-xl font-bold text-xl transition-all ${
              showCandidatesSection
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white'
                : 'bg-white text-slate-900 border-2 border-slate-200 hover:border-orange-500 rounded-xl'
            }`}
          >
            {showCandidatesSection ? '▼' : '▶'} Candidatures
          </button>
          {showCandidatesSection && (
            <div className="bg-white rounded-b-xl shadow-md">
              {/* Filters */}
              <div className="p-4 border-b border-slate-200">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      filterStatus === 'all'
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Tous ({stats.total})
                  </button>
                  <button
                    onClick={() => setFilterStatus('new_user')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      filterStatus === 'new_user'
                        ? 'bg-gray-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Nouveaux ({stats.newUsers})
                  </button>
                  <button
                    onClick={() => setFilterStatus('active')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      filterStatus === 'active'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Validés ({stats.active})
                  </button>
                  <button
                    onClick={() => setFilterStatus('archived')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      filterStatus === 'archived'
                        ? 'bg-slate-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Archivés ({stats.archived})
                  </button>
                </div>
              </div>

              {/* Commercials List */}
              <div className="overflow-x-auto">
                <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Rôle</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Statut</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Quiz</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Enregistrement</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Créé le</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCommercials.map((commercial) => (
                  <tr key={commercial.profile.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-900">{commercial.profile.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {commercial.profile.role || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {getStatusBadge(commercial.profile.status)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {commercial.training?.quiz_passed ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          {commercial.training.quiz_score}%
                        </div>
                      ) : commercial.training?.quiz_score ? (
                        <div className="flex items-center gap-2 text-red-600">
                          <XCircle className="w-4 h-4" />
                          {commercial.training.quiz_score}%
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {commercial.training?.test_call_url ? (
                        <a
                          href={commercial.training.test_call_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700"
                        >
                          <Mic className="w-4 h-4" />
                          <Download className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(commercial.profile.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => setSelectedCommercial(commercial)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        Détails
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCommercials.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      Aucun commercial trouvé
                    </td>
                  </tr>
                )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Detail Modal */}
      {selectedCommercial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Détails du commercial</h2>
              <button
                onClick={() => setSelectedCommercial(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Profile Info */}
              <div className="bg-slate-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Informations du profil</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Email</p>
                    <p className="text-slate-900 font-medium">{selectedCommercial.profile.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Rôle</p>
                    <p className="text-slate-900 font-medium">{selectedCommercial.profile.role || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Statut</p>
                    <div className="mt-1">{getStatusBadge(selectedCommercial.profile.status)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Date de création</p>
                    <p className="text-slate-900 font-medium">
                      {new Date(selectedCommercial.profile.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Application */}
              {selectedCommercial.application && (
                <div className="bg-blue-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Candidature</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-600">Rôle souhaité</p>
                      <p className="text-slate-900">
                        {selectedCommercial.application.role_desired === 'fixer_formations' && 'Fixer Formations IA'}
                        {selectedCommercial.application.role_desired === 'closer_formations' && 'Closer Formations IA'}
                        {selectedCommercial.application.role_desired === 'closer_marche_public' && 'Closer Le marché public.fr - Prospection et Closing'}
                        {!['fixer_formations', 'closer_formations', 'closer_marche_public'].includes(selectedCommercial.application.role_desired) && selectedCommercial.application.role_desired}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Expérience</p>
                      <p className="text-slate-900">{selectedCommercial.application.experience}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Disponibilité</p>
                      <p className="text-slate-900">{selectedCommercial.application.availability}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Motivation</p>
                      <p className="text-slate-900">{selectedCommercial.application.motivation}</p>
                    </div>
                    {selectedCommercial.application.cv_url && (
                      <div>
                        <p className="text-sm text-slate-600 mb-2">CV</p>
                        <button
                          onClick={() => downloadCV(selectedCommercial.application!.cv_url!, selectedCommercial.profile.email)}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Télécharger le CV
                        </button>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-slate-600">Cadre éthique accepté</p>
                      <p className="text-slate-900">
                        {selectedCommercial.application.ethical_framework_accepted ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Oui
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            Non
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Training Progress */}
              {selectedCommercial.training && (
                <div className="bg-green-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Progression de la formation</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">Module commun</span>
                      {selectedCommercial.training.module_common_completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">Module rôle</span>
                      {selectedCommercial.training.module_role_completed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">Quiz</span>
                      <div className="flex items-center gap-2">
                        {selectedCommercial.training.quiz_passed ? (
                          <>
                            <span className="text-green-600 font-semibold">{selectedCommercial.training.quiz_score}%</span>
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          </>
                        ) : selectedCommercial.training.quiz_score > 0 ? (
                          <>
                            <span className="text-red-600 font-semibold">{selectedCommercial.training.quiz_score}%</span>
                            <XCircle className="w-5 h-5 text-red-600" />
                          </>
                        ) : (
                          <XCircle className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                    </div>
                    {selectedCommercial.training.test_call_url && (
                      <div className="pt-4 border-t border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-slate-600">Enregistrement du script</p>
                          {selectedCommercial.training.test_call_validated ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                              <CheckCircle2 className="w-4 h-4" />
                              Validé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">
                              <Clock className="w-4 h-4" />
                              En attente de validation
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <audio controls className="flex-1" src={selectedCommercial.training.test_call_url}>
                            Votre navigateur ne supporte pas la lecture audio.
                          </audio>
                          <a
                            href={selectedCommercial.training.test_call_url}
                            download
                            className="inline-flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Performance Report */}
              {selectedCommercial.profile.role && selectedCommercial.profile.status === 'active' && (
                <CommercialPerformanceReport
                  profileId={selectedCommercial.profile.id}
                  role={selectedCommercial.profile.role as 'fixer' | 'closer'}
                />
              )}

              {/* Actions */}
              <div className="bg-slate-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCommercial.profile.status === 'new_user' && (
                    <>
                      <button
                        onClick={() => {
                          updateProfileStatus(selectedCommercial.profile.id, 'active');
                          setSelectedCommercial(null);
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-semibold"
                      >
                        Valider le candidat
                      </button>
                      <button
                        onClick={() => archiveProfile(selectedCommercial.profile.id)}
                        className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      >
                        Archiver
                      </button>
                    </>
                  )}
                  {selectedCommercial.profile.status === 'pending_quiz' && (
                    <>
                      <button
                        onClick={() => {
                          updateProfileStatus(selectedCommercial.profile.id, 'active');
                          setSelectedCommercial(null);
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-semibold"
                      >
                        Valider le candidat
                      </button>
                      <button
                        onClick={() => archiveProfile(selectedCommercial.profile.id)}
                        className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      >
                        Archiver
                      </button>
                    </>
                  )}
                  {selectedCommercial.profile.status === 'pending_audio' && (
                    <>
                      <button
                        onClick={() => {
                          updateProfileStatus(selectedCommercial.profile.id, 'active');
                          setSelectedCommercial(null);
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-semibold"
                      >
                        Valider le candidat
                      </button>
                      <button
                        onClick={() => archiveProfile(selectedCommercial.profile.id)}
                        className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      >
                        Archiver
                      </button>
                    </>
                  )}
                  {selectedCommercial.profile.status === 'active' && (
                    <>
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium">Commercial validé</span>
                      </div>
                      <button
                        onClick={() => archiveProfile(selectedCommercial.profile.id)}
                        className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors ml-auto"
                      >
                        Archiver
                      </button>
                    </>
                  )}
                  {selectedCommercial.profile.status === 'archived' && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <XCircle className="w-5 h-5" />
                      <span className="font-medium">Candidat archivé</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
