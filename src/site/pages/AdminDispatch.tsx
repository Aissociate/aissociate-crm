// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Building2,
  Users,
  Send,
  CheckSquare,
  Square,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  Package,
  Search
} from 'lucide-react';

interface CompanyRow {
  id: string;
  raison_social: string;
  activite: string;
  city: string;
  postal_code: string;
  dispatch_status: string;
  assigned_to: string | null;
  assigned_at: string | null;
  created_at: string;
  contact_count: number;
  phone_count: number;
  assigned_fixer_email?: string;
}

interface FixerOption {
  id: string;
  email: string;
  full_name: string | null;
}

export default function AdminDispatch() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [fixers, setFixers] = useState<FixerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedFixer, setSelectedFixer] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unassigned' | 'assigned'>('unassigned');
  const [searchTerm, setSearchTerm] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.is_admin) {
      navigate('/dashboard');
      return;
    }
    loadData();
  }, [profile, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [companiesRes, fixersRes] = await Promise.all([
        supabase
          .from('crm_companies')
          .select('id, raison_social, activite, city, postal_code, dispatch_status, assigned_to, assigned_at, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, email, full_name')
          .eq('role', 'fixer')
          .eq('status', 'active')
          .order('email'),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (fixersRes.error) throw fixersRes.error;

      const companyIds = (companiesRes.data || []).map(c => c.id);

      let contactCounts: Record<string, number> = {};
      let phoneCounts: Record<string, number> = {};

      if (companyIds.length > 0) {
        const { data: contacts } = await supabase
          .from('crm_contacts')
          .select('id, company_id')
          .in('company_id', companyIds);

        if (contacts) {
          contactCounts = contacts.reduce((acc, c) => {
            acc[c.company_id] = (acc[c.company_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const contactIds = contacts.map(c => c.id);
          if (contactIds.length > 0) {
            const { data: phones } = await supabase
              .from('crm_phones')
              .select('id, contact_id')
              .in('contact_id', contactIds);

            if (phones) {
              const contactToCompany: Record<string, string> = {};
              contacts.forEach(c => { contactToCompany[c.id] = c.company_id; });

              phoneCounts = phones.reduce((acc, p) => {
                const companyId = contactToCompany[p.contact_id];
                if (companyId) acc[companyId] = (acc[companyId] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
            }
          }
        }
      }

      const fixerMap = new Map((fixersRes.data || []).map(f => [f.id, f.email]));

      const enriched: CompanyRow[] = (companiesRes.data || []).map(c => ({
        ...c,
        contact_count: contactCounts[c.id] || 0,
        phone_count: phoneCounts[c.id] || 0,
        assigned_fixer_email: c.assigned_to ? fixerMap.get(c.assigned_to) || '?' : undefined,
      }));

      setCompanies(enriched);
      setFixers(fixersRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = companies.filter(c => {
    if (filterStatus === 'unassigned' && c.dispatch_status !== 'unassigned') return false;
    if (filterStatus === 'assigned' && c.dispatch_status === 'unassigned') return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        c.raison_social.toLowerCase().includes(s) ||
        c.city.toLowerCase().includes(s) ||
        c.activite.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const handleDispatch = async () => {
    if (!selectedFixer || selectedIds.size === 0) return;

    setDispatching(true);
    setError(null);
    setSuccess(null);

    try {
      const ids = Array.from(selectedIds);

      const { error: updateError } = await supabase
        .from('crm_companies')
        .update({
          assigned_to: selectedFixer,
          dispatch_status: 'assigned',
          assigned_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (updateError) throw updateError;

      const fixer = fixers.find(f => f.id === selectedFixer);
      setSuccess(`${ids.length} entreprise(s) assignee(s) a ${fixer?.full_name || fixer?.email}`);
      setSelectedIds(new Set());
      setSelectedFixer('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDispatching(false);
    }
  };

  const stats = {
    total: companies.length,
    unassigned: companies.filter(c => c.dispatch_status === 'unassigned').length,
    assigned: companies.filter(c => c.dispatch_status !== 'unassigned').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <div className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Send className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">Dispatch Prospects</h1>
            <p className="text-[11px] text-slate-500">Assignation des entreprises aux fixers</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour
        </button>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-5">
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatCard
            icon={<Building2 className="w-4 h-4 text-blue-600" />}
            iconBg="bg-blue-50"
            value={stats.total}
            label="Total entreprises"
          />
          <StatCard
            icon={<Package className="w-4 h-4 text-amber-600" />}
            iconBg="bg-amber-50"
            value={stats.unassigned}
            label="Non assignees"
            valueColor="text-amber-700"
          />
          <StatCard
            icon={<UserCheck className="w-4 h-4 text-emerald-600" />}
            iconBg="bg-emerald-50"
            value={stats.assigned}
            label="Assignees"
            valueColor="text-emerald-700"
          />
        </div>

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-emerald-800 text-xs font-medium flex-1">{success}</p>
            <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-red-800 text-xs font-medium flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              {([
                { key: 'all' as const, label: `Tous (${stats.total})` },
                { key: 'unassigned' as const, label: `Non assignees (${stats.unassigned})` },
                { key: 'assigned' as const, label: `Assignees (${stats.assigned})` },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => { setFilterStatus(f.key); setSelectedIds(new Set()); }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    filterStatus === f.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, ville, activite..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-3 h-3" />
              Assigner {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} a :
            </span>
            <select
              value={selectedFixer}
              onChange={e => setSelectedFixer(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="">-- Choisir un fixer --</option>
              {fixers.map(f => (
                <option key={f.id} value={f.id}>
                  {f.full_name || f.email} ({f.email})
                </option>
              ))}
            </select>
            <button
              onClick={handleDispatch}
              disabled={!selectedFixer || selectedIds.size === 0 || dispatching}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {dispatching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Assigner
            </button>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left w-10">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-blue-600 transition-colors">
                      {selectedIds.size === filtered.length && filtered.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Raison sociale</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Activite</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ville</th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contacts</th>
                  <th className="px-4 py-2.5 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tels</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Assigne a</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors cursor-pointer ${
                      selectedIds.has(c.id) ? 'bg-blue-50/60' : ''
                    }`}
                    onClick={() => toggleSelect(c.id)}
                  >
                    <td className="px-4 py-3">
                      {selectedIds.has(c.id) ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-900">{c.raison_social}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600">{c.activite || '--'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600">
                        {c.city}{c.postal_code ? ` (${c.postal_code})` : ''}
                        {!c.city && '--'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium">
                        <Users className="w-3 h-3" />
                        {c.contact_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-[11px] text-slate-500">{c.phone_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.dispatch_status === 'unassigned' ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[11px] font-medium">
                          Non assigne
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-medium">
                          Assigne
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-slate-500">{c.assigned_fixer_email || '--'}</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-2">
                        <Building2 className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-xs text-slate-500">Aucune entreprise trouvee</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50/50">
            <span className="text-[11px] text-slate-500">
              {filtered.length} entreprise(s) affichee(s) &middot; {selectedIds.size} selectionnee(s)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, iconBg, value, label, valueColor }: {
  icon: React.ReactNode;
  iconBg: string;
  value: number;
  label: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <p className={`text-xl font-bold tracking-tight ${valueColor || 'text-slate-900'}`}>{value}</p>
        <p className="text-[11px] text-slate-500 font-medium">{label}</p>
      </div>
    </div>
  );
}
