// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Phone, Calendar, CheckCircle2, XCircle, DollarSign, Clock, BarChart3 } from 'lucide-react';

interface FixerKPI {
  date: string;
  contacts_per_day: number;
  appointments_booked: number;
  no_show_rate: number;
  qualified_appointments: number;
  daily_rank: number | null;
}

interface CloserKPI {
  date: string;
  conversion_rate: number;
  average_cart: number;
  closing_delay_days: number;
  satisfaction_score: number;
  daily_rank: number | null;
}

interface CommercialPerformanceReportProps {
  profileId: string;
  role: 'fixer' | 'closer';
}

export default function CommercialPerformanceReport({ profileId, role }: CommercialPerformanceReportProps) {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [fixerKPIs, setFixerKPIs] = useState<FixerKPI[]>([]);
  const [closerKPIs, setCloserKPIs] = useState<CloserKPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKPIs();
  }, [profileId, period]);

  const loadKPIs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from(role === 'fixer' ? 'kpis_fixer' : 'kpis_closer')
        .select('*')
        .eq('profile_id', profileId)
        .order('date', { ascending: false });

      if (period !== 'all') {
        const daysAgo = period === 'week' ? 7 : 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);
        query = query.gte('date', startDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (role === 'fixer') {
        setFixerKPIs(data || []);
      } else {
        setCloserKPIs(data || []);
      }
    } catch (error) {
      console.error('Error loading KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAverage = (data: any[], field: string): number => {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, item) => acc + (parseFloat(item[field]) || 0), 0);
    return parseFloat((sum / data.length).toFixed(2));
  };

  const calculateTotal = (data: any[], field: string): number => {
    return data.reduce((acc, item) => acc + (parseFloat(item[field]) || 0), 0);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-slate-200 rounded"></div>
            <div className="h-32 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const periodLabel = period === 'week' ? 'Semaine' : period === 'month' ? 'Mois' : 'Depuis toujours';

  return (
    <div className="bg-slate-50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-slate-900">Rapport de Performance</h3>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setPeriod('week')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
            period === 'week'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          Semaine
        </button>
        <button
          onClick={() => setPeriod('month')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
            period === 'month'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          Mois
        </button>
        <button
          onClick={() => setPeriod('all')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
            period === 'all'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          Depuis toujours
        </button>
      </div>

      {role === 'fixer' && fixerKPIs.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Phone className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Contacts par jour</p>
                <p className="text-2xl font-bold text-slate-900">{calculateAverage(fixerKPIs, 'contacts_per_day')}</p>
                <p className="text-xs text-slate-500">Moyenne sur {periodLabel}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border-2 border-emerald-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">RDV pris</p>
                <p className="text-2xl font-bold text-slate-900">{calculateTotal(fixerKPIs, 'appointments_booked')}</p>
                <p className="text-xs text-slate-500">Total sur {periodLabel}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border-2 border-red-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Taux no-show</p>
                <p className="text-2xl font-bold text-slate-900">{calculateAverage(fixerKPIs, 'no_show_rate')}%</p>
                <p className="text-xs text-slate-500">Moyenne sur {periodLabel}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border-2 border-orange-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">RDV qualifiés</p>
                <p className="text-2xl font-bold text-slate-900">{calculateTotal(fixerKPIs, 'qualified_appointments')}</p>
                <p className="text-xs text-slate-500">Total sur {periodLabel}</p>
              </div>
            </div>
          </div>

          {fixerKPIs.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border-2 border-blue-200">
              <p className="text-sm text-slate-700 font-semibold mb-2">Jours de données enregistrées</p>
              <p className="text-3xl font-bold text-blue-900">{fixerKPIs.length}</p>
            </div>
          )}
        </div>
      )}

      {role === 'closer' && closerKPIs.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 border-2 border-green-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Taux de conversion</p>
                <p className="text-2xl font-bold text-slate-900">{calculateAverage(closerKPIs, 'conversion_rate')}%</p>
                <p className="text-xs text-slate-500">Moyenne sur {periodLabel}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Panier moyen</p>
                <p className="text-2xl font-bold text-slate-900">{calculateAverage(closerKPIs, 'average_cart')}€</p>
                <p className="text-xs text-slate-500">Moyenne sur {periodLabel}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border-2 border-orange-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Délai de closing</p>
                <p className="text-2xl font-bold text-slate-900">{calculateAverage(closerKPIs, 'closing_delay_days')} j</p>
                <p className="text-xs text-slate-500">Moyenne sur {periodLabel}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border-2 border-emerald-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Score de satisfaction</p>
                <p className="text-2xl font-bold text-slate-900">{calculateAverage(closerKPIs, 'satisfaction_score')}/5</p>
                <p className="text-xs text-slate-500">Moyenne sur {periodLabel}</p>
              </div>
            </div>
          </div>

          {closerKPIs.length > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-100 rounded-lg p-4 border-2 border-green-200">
              <p className="text-sm text-slate-700 font-semibold mb-2">Jours de données enregistrées</p>
              <p className="text-3xl font-bold text-green-900">{closerKPIs.length}</p>
            </div>
          )}
        </div>
      )}

      {((role === 'fixer' && fixerKPIs.length === 0) || (role === 'closer' && closerKPIs.length === 0)) && (
        <div className="bg-yellow-50 rounded-lg p-6 text-center border-2 border-yellow-200">
          <BarChart3 className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
          <p className="text-slate-700 font-semibold">Aucune donnée disponible</p>
          <p className="text-sm text-slate-600 mt-2">
            Ce commercial n'a pas encore de KPIs enregistrés pour la période sélectionnée.
          </p>
        </div>
      )}
    </div>
  );
}
