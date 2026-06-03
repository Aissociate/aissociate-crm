// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, TrendingUp, DollarSign, Users, AlertCircle, Filter, BookOpen } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';
import DossierList from '../components/dossiers/DossierList';
import DossierForm from '../components/dossiers/DossierForm';
import { Dossier } from '../types/dossiers';
import { formatCurrency, formatPercent } from '../utils/kpiCalculations';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [filteredDossiers, setFilteredDossiers] = useState<Dossier[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDossier, setEditingDossier] = useState<Partial<Dossier> | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');

  useEffect(() => {
    if (!profile) return;

    if (!profile.is_admin) {
      navigate('/dashboard');
      return;
    }

    loadData();
  }, [profile, navigate]);

  useEffect(() => {
    let filtered = dossiers;

    if (filterStatus !== 'all') {
      if (filterStatus === 'disputed') {
        filtered = filtered.filter(d => d.dispute);
      } else if (filterStatus === 'stuck') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(d => new Date(d.last_activity) < weekAgo && !d.paid);
      } else {
        filtered = filtered.filter(d => d.status === filterStatus);
      }
    }

    if (filterUser !== 'all') {
      filtered = filtered.filter(d => d.fixer_id === filterUser || d.closer_id === filterUser);
    }

    setFilteredDossiers(filtered);
  }, [dossiers, filterStatus, filterUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dossiersRes, profilesRes] = await Promise.all([
        supabase
          .from('dossiers')
          .select('*')
          .order('last_activity', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('role', ['fixer', 'closer'])
      ]);

      if (dossiersRes.error) throw dossiersRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setDossiers(dossiersRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleEditDossier = (dossier: Dossier) => {
    setEditingDossier(dossier);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingDossier(null);
  };

  const handleSaveForm = () => {
    setShowForm(false);
    setEditingDossier(null);
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-xl text-slate-600">Chargement...</div>
      </div>
    );
  }

  const totalPaid = dossiers.filter(d => d.paid && !d.dispute).length;
  const totalRevenue = dossiers
    .filter(d => d.paid && !d.dispute)
    .reduce((sum, d) => sum + d.amount, 0);
  const totalDisputes = dossiers.filter(d => d.dispute).length;
  const avgShowUp = dossiers.filter(d => d.rdv_date).length > 0
    ? (dossiers.filter(d => d.show_up === true).length / dossiers.filter(d => d.rdv_date).length) * 100
    : 0;
  const stuckDossiers = dossiers.filter(d => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(d.last_activity) < weekAgo && !d.paid;
  }).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <AdminLogo />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard Manager</h1>
              <p className="text-sm text-slate-600">Vue globale de l'activité</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/formation')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold"
            >
              <BookOpen className="w-4 h-4" />
              Formation
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-8 h-8 text-emerald-500" />
              <div>
                <p className="text-sm text-slate-600">CA Encaissé</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">{totalPaid} clients encaissés</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-slate-600">Show-up moyen</p>
                <p className="text-2xl font-bold text-slate-900">{formatPercent(avgShowUp)}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {avgShowUp < 70 && <span className="text-amber-600">⚠ Objectif: 70%</span>}
              {avgShowUp >= 70 && <span className="text-emerald-600">✓ Objectif atteint</span>}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-sm text-slate-600">Litiges actifs</p>
                <p className="text-2xl font-bold text-slate-900">{totalDisputes}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Nécessitent une intervention</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-sm text-slate-600">Dossiers bloqués</p>
                <p className="text-2xl font-bold text-slate-900">{stuckDossiers}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Aucune activité depuis 7j</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Tous les dossiers</h2>
              <p className="text-slate-600 text-sm mt-1">
                {dossiers.length} dossier{dossiers.length > 1 ? 's' : ''} au total
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-6 flex-wrap items-center">
            <Filter className="w-5 h-5 text-slate-500" />
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filterStatus === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Tous ({dossiers.length})
            </button>
            <button
              onClick={() => setFilterStatus('disputed')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filterStatus === 'disputed'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              Litiges ({totalDisputes})
            </button>
            <button
              onClick={() => setFilterStatus('stuck')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filterStatus === 'stuck'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              }`}
            >
              Bloqués ({stuckDossiers})
            </button>
            <button
              onClick={() => setFilterStatus('attente_encaissement')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filterStatus === 'attente_encaissement'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
            >
              En attente encaissement
            </button>
            <button
              onClick={() => setFilterStatus('encaissé')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filterStatus === 'encaissé'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              }`}
            >
              Encaissés ({totalPaid})
            </button>

            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none font-semibold"
            >
              <option value="all">Tous les utilisateurs</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.role})
                </option>
              ))}
            </select>
          </div>

          <DossierList
            dossiers={filteredDossiers}
            onEdit={handleEditDossier}
            role="admin"
          />
        </div>
      </main>

      {showForm && (
        <DossierForm
          dossier={editingDossier}
          fixerId={editingDossier?.fixer_id || profile?.id || ''}
          onClose={handleCloseForm}
          onSave={handleSaveForm}
          role="admin"
        />
      )}
    </div>
  );
}
