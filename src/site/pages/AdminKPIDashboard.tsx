// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Phone, Calendar, CheckCircle2, Users, LogOut, AlertCircle, ChevronDown, Clock, DollarSign, TrendingUp, CalendarDays } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';

interface FunnelData {
  totalCalls: number;
  totalAppointmentsBooked: number;
  totalAppointmentsDone: number;
  totalStudents: number;
  conversionCallToAppointment: number;
  conversionAppointmentToDone: number;
  conversionDoneToStudent: number;
}

interface InsightsData {
  avgCallDuration: number;
  avgCart: number;
  avgClosingDelay: number;
  totalFixers: number;
  totalClosers: number;
}

const getDefaultEndDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const getDefaultStartDate = () => {
  const today = new Date();
  today.setDate(today.getDate() - 7);
  return today.toISOString().split('T')[0];
};

export default function AdminKPIDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [funnel, setFunnel] = useState<FunnelData>({
    totalCalls: 0,
    totalAppointmentsBooked: 0,
    totalAppointmentsDone: 0,
    totalStudents: 0,
    conversionCallToAppointment: 0,
    conversionAppointmentToDone: 0,
    conversionDoneToStudent: 0,
  });
  const [insights, setInsights] = useState<InsightsData>({
    avgCallDuration: 0,
    avgCart: 0,
    avgClosingDelay: 0,
    totalFixers: 0,
    totalClosers: 0,
  });
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    if (!profile.is_admin) {
      navigate('/dashboard');
      return;
    }
    loadFunnelData();
  }, [profile, startDate, endDate, navigate]);

  const loadFunnelData = async () => {
    setLoading(true);

    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('status', 'active')
        .in('role', ['fixer', 'closer']);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        setLoading(false);
        return;
      }

      if (!profiles) {
        setLoading(false);
        return;
      }

      const fixerIds = profiles.filter(p => p.role === 'fixer').map(p => p.id);
      const closerIds = profiles.filter(p => p.role === 'closer').map(p => p.id);

      const { data: fixerKPIs } = await supabase
        .from('kpis_fixer')
        .select('*')
        .in('profile_id', fixerIds)
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: closerKPIs } = await supabase
        .from('kpis_closer')
        .select('*')
        .in('profile_id', closerIds)
        .gte('date', startDate)
        .lte('date', endDate);

      const totalCalls = (fixerKPIs || []).reduce((sum, kpi) => sum + (kpi.contacts_per_day || 0), 0);
      const totalAppointmentsBooked = (fixerKPIs || []).reduce((sum, kpi) => sum + (kpi.appointments_booked || 0), 0);
      (fixerKPIs || []).reduce((sum: number, kpi: any) => sum + (kpi.qualified_appointments || 0), 0);

      const avgNoShowRate = fixerKPIs && fixerKPIs.length > 0
        ? fixerKPIs.reduce((sum, kpi) => sum + (parseFloat(kpi.no_show_rate) || 0), 0) / fixerKPIs.length
        : 0;

      const totalAppointmentsDone = Math.round(totalAppointmentsBooked * (1 - avgNoShowRate / 100));

      const avgConversionRate = closerKPIs && closerKPIs.length > 0
        ? closerKPIs.reduce((sum, kpi) => sum + (parseFloat(kpi.conversion_rate) || 0), 0) / closerKPIs.length
        : 0;

      const totalStudents = Math.round(totalAppointmentsDone * (avgConversionRate / 100));

      const avgCart = closerKPIs && closerKPIs.length > 0
        ? closerKPIs.reduce((sum, kpi) => sum + (parseFloat(kpi.average_cart) || 0), 0) / closerKPIs.length
        : 0;

      const avgClosingDelay = closerKPIs && closerKPIs.length > 0
        ? closerKPIs.reduce((sum, kpi) => sum + (kpi.closing_delay_days || 0), 0) / closerKPIs.length
        : 0;

      setFunnel({
        totalCalls,
        totalAppointmentsBooked,
        totalAppointmentsDone,
        totalStudents,
        conversionCallToAppointment: totalCalls > 0 ? (totalAppointmentsBooked / totalCalls) * 100 : 0,
        conversionAppointmentToDone: totalAppointmentsBooked > 0 ? (totalAppointmentsDone / totalAppointmentsBooked) * 100 : 0,
        conversionDoneToStudent: totalAppointmentsDone > 0 ? (totalStudents / totalAppointmentsDone) * 100 : 0,
      });

      setInsights({
        avgCallDuration: 0,
        avgCart: Math.round(avgCart),
        avgClosingDelay: Math.round(avgClosingDelay),
        totalFixers: fixerIds.length,
        totalClosers: closerIds.length,
      });

    } catch (error) {
      console.error('Error loading funnel data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  const setCurrentMonth = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  const setLastMonth = () => {
    const end = new Date();
    end.setMonth(end.getMonth() - 1);
    const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0);
    const firstDay = new Date(end.getFullYear(), end.getMonth(), 1);
    setEndDate(lastDay.toISOString().split('T')[0]);
    setStartDate(firstDay.toISOString().split('T')[0]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-end mb-4">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Aissociate Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Entonnoir de Conversion
          </h1>
          <p className="text-lg text-slate-600">
            Vue globale de la performance commerciale
          </p>
        </div>

        {(funnel.totalCalls === 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-900">Aucune donnée disponible</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Les données de conversion s'afficheront une fois que les commerciaux auront saisi leurs KPIs.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <CalendarDays className="w-6 h-6 text-orange-500" />
            <h3 className="text-lg font-semibold text-slate-900">Période d'analyse</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date de début
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Date de fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                max={getDefaultEndDate()}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Raccourcis</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setDateRange(7)}
                className="px-4 py-2 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-700 rounded-lg transition-all font-medium"
              >
                7 derniers jours
              </button>
              <button
                onClick={() => setDateRange(14)}
                className="px-4 py-2 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-700 rounded-lg transition-all font-medium"
              >
                14 derniers jours
              </button>
              <button
                onClick={() => setDateRange(30)}
                className="px-4 py-2 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-700 rounded-lg transition-all font-medium"
              >
                30 derniers jours
              </button>
              <button
                onClick={setCurrentMonth}
                className="px-4 py-2 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-700 rounded-lg transition-all font-medium"
              >
                Mois en cours
              </button>
              <button
                onClick={setLastMonth}
                className="px-4 py-2 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-700 rounded-lg transition-all font-medium"
              >
                Mois dernier
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-full max-w-2xl">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 rounded-lg p-3">
                      <Phone className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold opacity-90">Fixers - Appels</h3>
                      <p className="text-sm opacity-75">{insights.totalFixers} fixers actifs</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold">{funnel.totalCalls}</p>
                    <p className="text-sm opacity-75">appels</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center py-4">
                <div className="text-center">
                  <ChevronDown className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-600 mt-1">
                    {funnel.conversionCallToAppointment.toFixed(1)}% conversion
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform" style={{ width: '90%', margin: '0 auto' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 rounded-lg p-3">
                      <Calendar className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold opacity-90">RDV Pris</h3>
                      <p className="text-sm opacity-75">par les fixers</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold">{funnel.totalAppointmentsBooked}</p>
                    <p className="text-sm opacity-75">rendez-vous</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center py-4">
                <div className="text-center">
                  <ChevronDown className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-600 mt-1">
                    {funnel.conversionAppointmentToDone.toFixed(1)}% présence
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform" style={{ width: '80%', margin: '0 auto' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 rounded-lg p-3">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold opacity-90">Closers - RDV Effectués</h3>
                      <p className="text-sm opacity-75">{insights.totalClosers} closers actifs</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold">{funnel.totalAppointmentsDone}</p>
                    <p className="text-sm opacity-75">rdv réalisés</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center py-4">
                <div className="text-center">
                  <ChevronDown className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-600 mt-1">
                    {funnel.conversionDoneToStudent.toFixed(1)}% closing
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform" style={{ width: '70%', margin: '0 auto' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 rounded-lg p-3">
                      <Users className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold opacity-90">Élèves Inscrits</h3>
                      <p className="text-sm opacity-75">objectif final</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold">{funnel.totalStudents}</p>
                    <p className="text-sm opacity-75">élèves</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-orange-500" />
            Insights Clés
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-blue-500 rounded-lg p-2">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-slate-900">Durée Conversation</h3>
              </div>
              <p className="text-3xl font-bold text-blue-600">
                {insights.avgCallDuration > 0 ? `${insights.avgCallDuration} min` : 'N/A'}
              </p>
              <p className="text-sm text-slate-600 mt-2">Moyenne par appel fixer</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-green-500 rounded-lg p-2">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-slate-900">Panier Moyen</h3>
              </div>
              <p className="text-3xl font-bold text-green-600">{insights.avgCart}€</p>
              <p className="text-sm text-slate-600 mt-2">Par élève inscrit</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-orange-500 rounded-lg p-2">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-slate-900">Délai de Closing</h3>
              </div>
              <p className="text-3xl font-bold text-orange-600">{insights.avgClosingDelay} j</p>
              <p className="text-sm text-slate-600 mt-2">Du RDV à l'inscription</p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => navigate('/admin')}
            className="px-8 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors font-semibold"
          >
            Retour au tableau de bord admin
          </button>
        </div>
      </div>
    </div>
  );
}
