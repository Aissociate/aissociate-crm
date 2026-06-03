// @ts-nocheck
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { TrendingUp, Phone, Calendar, CheckCircle2, XCircle, DollarSign, Clock } from 'lucide-react';
import AdminLogo from '../AdminLogo';

export default function Dashboard() {
  const { profile, adminMode } = useAuth();
  const [kpis, setKpis] = useState<any[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKPIs();
  }, [profile, period, adminMode]);

  const loadKPIs = async () => {
    if (!profile && !adminMode) return;
    if (!profile) {
      setLoading(false);
      return;
    }

    const tableName = profile.role === 'fixer' ? 'kpis_fixer' : 'kpis_closer';
    const daysAgo = period === 'week' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('profile_id', profile.id)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false });

    setKpis(data || []);
    setLoading(false);
  };

  const calculateAverage = (field: string) => {
    if (kpis.length === 0) return 0;
    const sum = kpis.reduce((acc, kpi) => acc + (parseFloat(kpi[field]) || 0), 0);
    return (sum / kpis.length).toFixed(2);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Aissociate Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Dashboard KPI - {profile?.role === 'fixer' ? 'Fixer' : profile?.role === 'closer' ? 'Closer' : 'Demo'}
          </h1>
          <p className="text-lg text-slate-600">
            Ici, on pilote à la donnée. Vos indicateurs sont visibles, suivis et analysés.
          </p>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
          <p className="text-slate-700 text-center">
            Ces indicateurs servent à progresser, pas à sanctionner.
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setPeriod('week')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              period === 'week'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Hebdomadaire
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              period === 'month'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Mensuel
          </button>
        </div>

        {profile?.role === 'fixer' ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Contacts/jour</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{calculateAverage('contacts_per_day')}</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">RDV pris</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{calculateAverage('appointments_booked')}</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Taux no-show</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{calculateAverage('no_show_rate')}%</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">RDV qualifiés</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{calculateAverage('qualified_appointments')}</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Taux closing</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{calculateAverage('conversion_rate')}%</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Panier moyen</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{calculateAverage('average_cart')}€</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Délai closing</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{calculateAverage('closing_delay_days')} j</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Satisfaction</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{calculateAverage('satisfaction_score')}/5</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>
          </div>
        )}

        {kpis.length === 0 && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <TrendingUp className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Aucune donnée disponible</h3>
            <p className="text-slate-600">
              Les KPI seront affichés ici une fois que vous aurez commencé à travailler.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
