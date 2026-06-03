// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Calendar, LogOut, BookOpen, ChevronLeft, ChevronRight,
  Phone, Mail, Users, Edit, CheckCircle,
  XCircle, Plus, Briefcase, MapPin
} from 'lucide-react';
import AdminLogo from '../components/AdminLogo';
import CloserDossierForm from '../components/dossiers/CloserDossierForm';
import CreateDossierForm from '../components/dossiers/CreateDossierForm';
import CloserKPIWidget from '../components/dossiers/CloserKPIWidget';
import EmailSection from '../components/emails/EmailSection';
import EmailComposer from '../components/emails/EmailComposer';
import { Dossier, Bonus, getStatusLabel, getStatusColor, getFullName } from '../types/dossiers';
import { calculateCloserKPIs, calculateBonusEstimate } from '../utils/kpiCalculations';

type TabKey = 'rdv' | 'dossiers' | 'emails';

export default function NewCloserDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [upcomingRDVs, setUpcomingRDVs] = useState<Dossier[]>([]);
  const [completedDossiers, setCompletedDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDossier, setEditingDossier] = useState<Dossier | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [kpiPeriod, setKpiPeriod] = useState<'all' | 'day' | 'week' | 'month'>('all');
  const [bonus, setBonus] = useState<Bonus | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('rdv');
  const [emailTarget, setEmailTarget] = useState<Dossier | null>(null);

  const isAdminViewing = profile?.is_admin;

  useEffect(() => {
    if (!profile) return;
    if (!isAdminViewing) {
      if (profile.status !== 'active') { navigate('/dashboard'); return; }
      if (profile.role !== 'closer') {
        if (profile.role === 'fixer') navigate('/onboarding/dashboard/fixer', { replace: true });
        else navigate('/dashboard', { replace: true });
        return;
      }
    }
    loadData();
  }, [profile, navigate]);

  const getDateFilter = () => {
    const now = new Date();
    if (kpiPeriod === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (kpiPeriod === 'week') {
      const s = new Date(now);
      s.setDate(now.getDate() - now.getDay() + 1);
      s.setHours(0, 0, 0, 0);
      return s;
    }
    if (kpiPeriod === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    return null;
  };

  useEffect(() => {
    const upcoming = dossiers.filter(d =>
      d.status === 'rdv_closer_planifié' || (d.status === 'rdv_closer_tenu' && !d.decision)
    ).sort((a, b) => {
      const dA = a.rdv_closer_date ? new Date(a.rdv_closer_date).getTime() : 0;
      const dB = b.rdv_closer_date ? new Date(b.rdv_closer_date).getTime() : 0;
      return dA - dB;
    });
    const completed = dossiers.filter(d =>
      ['décision_oui', 'décision_non', 'formation_planifiée', 'formation_réalisée', 'attente_encaissement', 'encaissé', 'litige'].includes(d.status)
    ).sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
    setUpcomingRDVs(upcoming);
    setCompletedDossiers(completed);
  }, [dossiers]);

  const loadData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [dossiersRes, bonusRes] = await Promise.all([
        supabase.from('dossiers').select('*').eq('closer_id', profile.id).order('last_activity', { ascending: false }),
        supabase.from('bonuses').select('*').eq('profile_id', profile.id).eq('active', true).maybeSingle()
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

  const handleLogout = async () => { await signOut(); navigate('/login'); };

  const formatDateFull = (d: string | null) => {
    if (!d) return 'Non definie';
    return new Date(d).toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDateShort = (d: string | null) => {
    if (!d) return '--';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  const dateFilter = getDateFilter();
  const dossiersForKPI = dateFilter ? dossiers.filter(d => new Date(d.last_activity) >= dateFilter) : dossiers;
  const kpis = calculateCloserKPIs(dossiersForKPI);
  const bonusEstimate = bonus ? calculateBonusEstimate(kpis.clientsPaid, 100, kpis.avgQuality, bonus) : { amount: 0, tier: 0, nextTier: null, clientsToNext: 0 };
  const currentRDV = upcomingRDVs[currentCardIndex];

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'rdv', label: 'RDV a venir', count: upcomingRDVs.length },
    { key: 'emails', label: 'Emails' },
    { key: 'dossiers', label: 'Dossiers traites', count: completedDossiers.length },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <AdminLogo />
              <div className="hidden sm:block">
                <h1 className="text-sm font-semibold text-slate-900 leading-tight">Closer CRM</h1>
                <p className="text-[11px] text-slate-500">{profile?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Nouveau dossier
              </button>
              <button onClick={() => navigate('/formation')} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium rounded-md transition-colors">
                <BookOpen className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Formation</span>
              </button>
              <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs font-medium rounded-md transition-colors">
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
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    activeTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="mb-5">
          <CloserKPIWidget kpis={kpis} bonusEstimate={bonusEstimate} period={kpiPeriod} onPeriodChange={setKpiPeriod} />
        </div>

        {activeTab === 'rdv' && (
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">RDV a venir</h2>
                  <p className="text-[11px] text-slate-500">{upcomingRDVs.length} en attente</p>
                </div>
              </div>
              {upcomingRDVs.length > 1 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))}
                    disabled={currentCardIndex === 0}
                    className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="text-xs text-slate-500 font-medium tabular-nums">
                    {currentCardIndex + 1} / {upcomingRDVs.length}
                  </span>
                  <button
                    onClick={() => setCurrentCardIndex(Math.min(upcomingRDVs.length - 1, currentCardIndex + 1))}
                    disabled={currentCardIndex === upcomingRDVs.length - 1}
                    className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              )}
            </div>

            {upcomingRDVs.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">Aucun RDV a venir</p>
                <p className="text-xs text-slate-500 mt-1">Les nouveaux RDV apparaitront ici</p>
              </div>
            ) : currentRDV && (
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-bold text-slate-900">{getFullName(currentRDV)}</h3>
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${getStatusColor(currentRDV.status)}`}>
                        {getStatusLabel(currentRDV.status)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">{currentRDV.company}</p>
                  </div>
                  <button
                    onClick={() => { setEditingDossier(currentRDV); setShowForm(true); }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Editer
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-5">
                  <InfoRow icon={<Calendar className="w-4 h-4 text-emerald-500" />} label="Date du RDV" value={formatDateFull(currentRDV.rdv_closer_date)} />
                  <InfoRow icon={<Phone className="w-4 h-4 text-blue-500" />} label="Telephone" value={currentRDV.phone} />
                  <InfoRow icon={<Mail className="w-4 h-4 text-slate-500" />} label="Email" value={currentRDV.email} />
                  <InfoRow icon={<Briefcase className="w-4 h-4 text-amber-500" />} label="Secteur" value={currentRDV.sector} />
                  <InfoRow icon={<Users className="w-4 h-4 text-teal-500" />} label="Taille" value={currentRDV.size} />
                  <InfoRow icon={<MapPin className="w-4 h-4 text-slate-400" />} label="Fonction" value={currentRDV.contact_function} />
                </div>

                {currentRDV.fixer_notes && (
                  <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-4 mb-3">
                    <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider mb-1.5">Notes du Fixer</p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{currentRDV.fixer_notes}</p>
                  </div>
                )}
                {currentRDV.closer_notes && (
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-4">
                    <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">Mes notes</p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{currentRDV.closer_notes}</p>
                  </div>
                )}

                {upcomingRDVs.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 mt-5 pt-4 border-t border-slate-100">
                    {upcomingRDVs.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentCardIndex(i)}
                        className={`rounded-full transition-all ${
                          i === currentCardIndex ? 'w-6 h-2 bg-emerald-500' : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'emails' && (
          <EmailSection userId={profile?.id || ''} userRole={profile?.role || 'closer'} />
        )}

        {activeTab === 'dossiers' && (
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Dossiers traites</h2>
                <p className="text-[11px] text-slate-500">{completedDossiers.length} dossier{completedDossiers.length > 1 ? 's' : ''}</p>
              </div>
            </div>

            {completedDossiers.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">Aucun dossier traite</p>
                <p className="text-xs text-slate-500 mt-1">Les dossiers termines apparaitront ici</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Entreprise</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Decision</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Qualite</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Montant</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Derniere activite</th>
                      <th className="px-4 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedDossiers.map(dossier => (
                      <tr
                        key={dossier.id}
                        className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors cursor-pointer group"
                        onClick={() => { setEditingDossier(dossier); setShowForm(true); }}
                      >
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-slate-900">{getFullName(dossier)}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{dossier.phone}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm text-slate-900">{dossier.company}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{dossier.sector}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-medium ${getStatusColor(dossier.status)}`}>
                            {getStatusLabel(dossier.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {dossier.decision ? (
                            <div className="flex items-center gap-1.5">
                              {dossier.decision === 'oui' ? (
                                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-red-500" />
                              )}
                              <span className="text-xs font-medium capitalize">{dossier.decision}</span>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-sm">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {dossier.lead_quality ? (
                            <span className={`text-sm font-semibold ${dossier.lead_quality >= 7 ? 'text-emerald-600' : dossier.lead_quality >= 5 ? 'text-amber-600' : 'text-red-500'}`}>
                              {dossier.lead_quality}/10
                            </span>
                          ) : (
                            <span className="text-slate-300 text-sm">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {dossier.amount > 0 ? (
                            <span className="text-sm font-semibold text-emerald-600">{dossier.amount} EUR</span>
                          ) : (
                            <span className="text-slate-300 text-sm">--</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-slate-500">{formatDateShort(dossier.last_activity)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {dossier.email && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEmailTarget(dossier); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title={`Envoyer un email a ${dossier.email}`}
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingDossier(dossier); setShowForm(true); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {showForm && editingDossier && (
        <CloserDossierForm
          dossier={editingDossier}
          onClose={() => { setShowForm(false); setEditingDossier(null); }}
          onSave={() => { setShowForm(false); setEditingDossier(null); loadData(); }}
        />
      )}

      {showCreateForm && profile && (
        <CreateDossierForm
          closerId={profile.id}
          onClose={() => setShowCreateForm(false)}
          onSuccess={() => { setShowCreateForm(false); loadData(); }}
        />
      )}

      {emailTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <EmailComposer
              userId={profile?.id || ''}
              userRole={profile?.role || 'closer'}
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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3 p-3.5 bg-slate-50/70 rounded-lg border border-slate-100">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-slate-500 font-medium">{label}</p>
        <p className="text-sm text-slate-900 font-medium truncate">{value || '--'}</p>
      </div>
    </div>
  );
}
