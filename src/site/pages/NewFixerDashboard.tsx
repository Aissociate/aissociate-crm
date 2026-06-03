// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Filter, LogOut, Calendar, BookOpen, LayoutGrid, List, Search, Mail, X } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';
import DossierForm from '../components/dossiers/DossierForm';
import DossierList from '../components/dossiers/DossierList';
import FixerKPIWidget from '../components/dossiers/FixerKPIWidget';
import FixerConsolidatedKPIs from '../components/FixerConsolidatedKPIs';
import ProspectCardNavigator from '../components/dossiers/ProspectCardNavigator';
import EmailSection from '../components/emails/EmailSection';
import EmailComposer from '../components/emails/EmailComposer';
import { Dossier, Bonus } from '../types/dossiers';
import { calculateFixerKPIs, calculateBonusEstimate } from '../utils/kpiCalculations';

type TabKey = 'prospects' | 'dossiers' | 'emails' | 'kpis';

export default function NewFixerDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [filteredDossiers, setFilteredDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDossier, setEditingDossier] = useState<Partial<Dossier> | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'day' | 'week' | 'month'>('all');
  const [kpiPeriod, setKpiPeriod] = useState<'all' | 'day' | 'week' | 'month'>('all');
  const [filterNextAction, setFilterNextAction] = useState<'all' | 'today' | 'upcoming' | 'overdue'>('all');
  const [bonus, setBonus] = useState<Bonus | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('prospects');
  const [searchQuery, setSearchQuery] = useState('');
  const [emailTarget, setEmailTarget] = useState<Dossier | null>(null);

  const isAdminViewing = profile?.is_admin;

  useEffect(() => {
    if (!profile) return;

    if (!isAdminViewing) {
      if (profile.status !== 'active') {
        navigate('/dashboard');
        return;
      }

      if (profile.role !== 'fixer') {
        if (profile.role === 'closer') {
          navigate('/onboarding/dashboard/closer', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
        return;
      }
    }

    loadData();
  }, [profile, navigate]);

  const getDateFilter = (period?: 'all' | 'day' | 'week' | 'month') => {
    const targetPeriod = period || filterPeriod;
    const now = new Date();
    if (targetPeriod === 'day') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (targetPeriod === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      return startOfWeek;
    } else if (targetPeriod === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return null;
  };

  useEffect(() => {
    let filtered = dossiers;

    const dateFilter = getDateFilter();
    if (dateFilter) {
      filtered = filtered.filter(d => new Date(d.last_activity) >= dateFilter);
    }

    if (filterNextAction !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter(d => {
        if (!d.next_step_date) return false;
        const nextActionDate = new Date(d.next_step_date);
        nextActionDate.setHours(0, 0, 0, 0);
        if (filterNextAction === 'today') return nextActionDate.getTime() === today.getTime();
        if (filterNextAction === 'upcoming') return nextActionDate > today;
        if (filterNextAction === 'overdue') return nextActionDate < today;
        return true;
      });
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(d => d.status === filterStatus);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.contact_last_name.toLowerCase().includes(q) ||
        d.contact_first_name.toLowerCase().includes(q) ||
        d.company.toLowerCase().includes(q) ||
        (d.phone && d.phone.includes(q))
      );
    }

    setFilteredDossiers(filtered);
  }, [dossiers, filterStatus, filterPeriod, filterNextAction, searchQuery]);

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [dossiersRes, bonusRes] = await Promise.all([
        supabase
          .from('dossiers')
          .select('*')
          .eq('fixer_id', profile.id)
          .order('last_activity', { ascending: false }),
        supabase
          .from('bonuses')
          .select('*')
          .eq('profile_id', profile.id)
          .eq('active', true)
          .maybeSingle()
      ]);

      if (dossiersRes.error) throw dossiersRes.error;
      if (bonusRes.error) throw bonusRes.error;

      setDossiers(dossiersRes.data || []);
      setBonus(bonusRes.data || {
        id: '', profile_id: profile.id,
        tier_1_clients: 5, tier_1_amount: 200,
        tier_2_clients: 10, tier_2_amount: 500,
        tier_3_clients: 15, tier_3_amount: 1000,
        min_show_up_rate: 70, min_quality_score: 7,
        active: true, created_at: '', updated_at: ''
      });
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  const kpiDateFilter = getDateFilter(kpiPeriod);
  const dossiersForKPI = kpiDateFilter
    ? dossiers.filter(d => new Date(d.last_activity) >= kpiDateFilter)
    : dossiers;

  const kpis = calculateFixerKPIs(dossiersForKPI);
  const bonusEstimate = bonus ? calculateBonusEstimate(
    kpis.clientsPaid, kpis.showUpRate, kpis.avgQuality, bonus
  ) : { amount: 0, tier: 0, nextTier: null, clientsToNext: 0 };

  const dateFilter = getDateFilter();
  const dossiersForStatusCount = dateFilter
    ? dossiers.filter(d => new Date(d.last_activity) >= dateFilter)
    : dossiers;

  const statusCounts = dossiersForStatusCount.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'prospects', label: 'Prospects CRM' },
    { key: 'dossiers', label: 'Dossiers', count: dossiers.length },
    { key: 'emails', label: 'Emails' },
    { key: 'kpis', label: 'KPIs detailles' },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <AdminLogo />
              <div className="hidden sm:block">
                <h1 className="text-sm font-semibold text-slate-900 leading-tight">Fixer CRM</h1>
                <p className="text-[11px] text-slate-500">{profile?.full_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingDossier(null); setShowForm(true); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Nouveau dossier
              </button>
              <button
                onClick={() => navigate('/formation')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium rounded-md transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Formation</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs font-medium rounded-md transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <nav className="flex gap-0 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="mb-5">
          <FixerKPIWidget
            kpis={kpis}
            bonusEstimate={bonusEstimate}
            period={kpiPeriod}
            onPeriodChange={setKpiPeriod}
          />
        </div>

        {activeTab === 'prospects' && (
          <ProspectCardNavigator fixerId={profile?.id || ''} />
        )}

        {activeTab === 'emails' && (
          <EmailSection userId={profile?.id || ''} userRole={profile?.role || 'fixer'} />
        )}

        {activeTab === 'kpis' && (
          <FixerConsolidatedKPIs profileId={profile?.id || ''} />
        )}

        {activeTab === 'dossiers' && (
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Dossiers en cours</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {dossiers.length} au total -- {filteredDossiers.length} affiches
                  </p>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-md text-xs text-slate-700 w-56 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <FilterGroup label="Periode" icon={<Calendar className="w-3.5 h-3.5 text-slate-400" />}>
                  {(['all', 'day', 'week', 'month'] as const).map(p => (
                    <FilterPill
                      key={p}
                      active={filterPeriod === p}
                      onClick={() => setFilterPeriod(p)}
                      label={{ all: 'Toutes', day: "Aujourd'hui", week: 'Semaine', month: 'Mois' }[p]}
                    />
                  ))}
                </FilterGroup>

                <FilterGroup label="Action" icon={<Calendar className="w-3.5 h-3.5 text-slate-400" />}>
                  <FilterPill active={filterNextAction === 'all'} onClick={() => setFilterNextAction('all')} label="Toutes" />
                  <FilterPill active={filterNextAction === 'today'} onClick={() => setFilterNextAction('today')} label="Aujourd'hui" variant="blue" />
                  <FilterPill active={filterNextAction === 'overdue'} onClick={() => setFilterNextAction('overdue')} label="En retard" variant="red" />
                  <FilterPill active={filterNextAction === 'upcoming'} onClick={() => setFilterNextAction('upcoming')} label="A venir" variant="green" />
                </FilterGroup>

                <FilterGroup label="Statut" icon={<Filter className="w-3.5 h-3.5 text-slate-400" />}>
                  <FilterPill active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} label={`Tous (${dossiersForStatusCount.length})`} />
                  <FilterPill active={filterStatus === 'à_contacter'} onClick={() => setFilterStatus('à_contacter')} label={`A contacter (${statusCounts['à_contacter'] || 0})`} />
                  <FilterPill active={filterStatus === 'rdv_closer_planifié'} onClick={() => setFilterStatus('rdv_closer_planifié')} label={`RDV planifies (${statusCounts['rdv_closer_planifié'] || 0})`} variant="blue" />
                  <FilterPill active={filterStatus === 'encaissé'} onClick={() => setFilterStatus('encaissé')} label={`Encaisses (${statusCounts['encaissé'] || 0})`} variant="green" />
                </FilterGroup>
              </div>
            </div>

            <DossierList
              dossiers={filteredDossiers}
              onEdit={(dossier) => { setEditingDossier(dossier); setShowForm(true); }}
              onEmail={(dossier) => setEmailTarget(dossier)}
              role="fixer"
            />
          </div>
        )}
      </main>

      {showForm && (
        <DossierForm
          dossier={editingDossier}
          fixerId={profile?.id || ''}
          onClose={() => { setShowForm(false); setEditingDossier(null); }}
          onSave={() => { setShowForm(false); setEditingDossier(null); loadData(); }}
          role="fixer"
        />
      )}

      {emailTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <EmailComposer
              userId={profile?.id || ''}
              userRole={profile?.role || 'fixer'}
              prefillTo={emailTarget.email}
              prefillName={`${emailTarget.contact_first_name} ${emailTarget.contact_last_name}`.trim()}
              onSent={() => setEmailTarget(null)}
              onClose={() => setEmailTarget(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-[11px] font-medium text-slate-500">{label}:</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function FilterPill({ active, onClick, label, variant }: {
  active: boolean;
  onClick: () => void;
  label: string;
  variant?: 'blue' | 'red' | 'green';
}) {
  const getClasses = () => {
    if (active) {
      if (variant === 'blue') return 'bg-blue-600 text-white';
      if (variant === 'red') return 'bg-red-500 text-white';
      if (variant === 'green') return 'bg-emerald-600 text-white';
      return 'bg-slate-700 text-white';
    }
    if (variant === 'blue') return 'bg-blue-50 text-blue-700 hover:bg-blue-100';
    if (variant === 'red') return 'bg-red-50 text-red-600 hover:bg-red-100';
    if (variant === 'green') return 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
    return 'bg-slate-100 text-slate-600 hover:bg-slate-200';
  };

  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${getClasses()}`}
    >
      {label}
    </button>
  );
}
