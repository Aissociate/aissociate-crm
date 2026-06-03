// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  TrendingUp,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  LogOut,
  BookOpen,
  BarChart3,
  AlertCircle,
  Award
} from 'lucide-react';
import AdminLogo from '../components/AdminLogo';
import FixerCRM from '../components/FixerCRM';

interface FixerKPI {
  date: string;
  contacts_per_day: number;
  appointments_booked: number;
  no_show_rate: number;
  qualified_appointments: number;
  daily_rank: number | null;
}

export default function FixerDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [kpis, setKpis] = useState<FixerKPI[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

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

    loadKPIs();
  }, [profile, period, navigate]);

  const loadKPIs = async () => {
    if (!profile) return;

    setLoading(true);
    const daysAgo = period === 'week' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    try {
      const { data } = await supabase
        .from('kpis_fixer')
        .select('*')
        .eq('profile_id', profile.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      setKpis(data || []);
    } catch (error) {
      console.error('Error loading fixer KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAverage = (field: keyof FixerKPI) => {
    if (kpis.length === 0) return 0;
    const sum = kpis.reduce((acc, kpi) => acc + (parseFloat(String(kpi[field])) || 0), 0);
    return (sum / kpis.length).toFixed(2);
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
        {/* Header with Navigation */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Aissociate Logo"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Dashboard Fixer</h1>
              <p className="text-slate-600">{profile?.email}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/onboarding/amelioration')}
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
        </div>

        {/* Role Badge */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-6 mb-8 shadow-lg">
          <div className="flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <Phone className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Rôle: Fixer</h2>
                <p className="text-blue-100">Spécialiste de la prise de rendez-vous qualifiés</p>
              </div>
            </div>
            <BarChart3 className="w-12 h-12 text-blue-200" />
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Pilotage par la donnée</h3>
              <p className="text-slate-700">
                Vos indicateurs sont visibles, suivis et analysés. Ces KPIs servent à progresser, pas à sanctionner.
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setPeriod('week')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              period === 'week'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Hebdomadaire
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              period === 'month'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg'
                : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Mensuel
          </button>
        </div>

        {/* Daily Rank */}
        {kpis.length > 0 && kpis[0]?.daily_rank && (
          <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white rounded-xl p-6 mb-8 shadow-lg">
            <div className="flex items-center justify-center gap-4">
              <Award className="w-12 h-12" />
              <div className="text-center">
                <p className="text-lg font-semibold mb-1">Votre rang du jour</p>
                <p className="text-5xl font-bold">#{kpis[0].daily_rank}</p>
                <p className="text-amber-100 text-sm mt-1">
                  {new Date(kpis[0].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KPIs Grid */}
        {kpis.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-blue-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Contacts/jour</h3>
              </div>
              <p className="text-4xl font-bold text-slate-900">{calculateAverage('contacts_per_day')}</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-emerald-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">RDV pris</h3>
              </div>
              <p className="text-4xl font-bold text-slate-900">{calculateAverage('appointments_booked')}</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-red-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">Taux no-show</h3>
              </div>
              <p className="text-4xl font-bold text-slate-900">{calculateAverage('no_show_rate')}%</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 border-t-4 border-orange-500 hover:shadow-xl transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg text-slate-900">RDV qualifiés</h3>
              </div>
              <p className="text-4xl font-bold text-slate-900">{calculateAverage('qualified_appointments')}</p>
              <p className="text-sm text-slate-600 mt-2">Moyenne {period === 'week' ? 'hebdo' : 'mensuelle'}</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center mb-8">
            <TrendingUp className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">Aucune donnée disponible</h3>
            <p className="text-slate-600 mb-4">
              Vos KPI seront affichés ici une fois que vous aurez commencé à saisir vos données quotidiennes.
            </p>
          </div>
        )}

        {/* CRM Section */}
        <div className="mb-8">
          <FixerCRM profileId={profile?.id || ''} />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Actions rapides</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <button className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg hover:from-blue-100 hover:to-blue-200 transition-colors">
              <Phone className="w-8 h-8 text-blue-600" />
              <div className="text-left">
                <p className="font-semibold text-slate-900">Saisir mes KPIs</p>
                <p className="text-sm text-slate-600">Mettre à jour mes données</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/onboarding/amelioration')}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg hover:from-emerald-100 hover:to-emerald-200 transition-colors"
            >
              <BookOpen className="w-8 h-8 text-emerald-600" />
              <div className="text-left">
                <p className="font-semibold text-slate-900">Formation continue</p>
                <p className="text-sm text-slate-600">Améliorer mes compétences</p>
              </div>
            </button>
            <button className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg hover:from-orange-100 hover:to-orange-200 transition-colors">
              <TrendingUp className="w-8 h-8 text-orange-600" />
              <div className="text-left">
                <p className="font-semibold text-slate-900">Mes objectifs</p>
                <p className="text-sm text-slate-600">Voir mes cibles</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
