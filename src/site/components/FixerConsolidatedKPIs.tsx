// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FixerKPITargets } from '../types/dossiers';
import { TrendingUp, TrendingDown, Minus, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import FixerKPITargetsEditor from './FixerKPITargetsEditor';

interface FixerConsolidatedKPIsProps {
  profileId: string;
  isAdmin?: boolean;
}

interface ConsolidatedKPIs {
  callDuration: number;
  callsPerHour: number;
  callsPerDay: number;
  callsPerWeek: number;
  pickupRate: number;
  rdvRate: number;
  showRate: number;
  prospectsPerCall: number;
  monthlyProspects: number;
  avgLeadQuality: number;
}

export default function FixerConsolidatedKPIs({ profileId, isAdmin }: FixerConsolidatedKPIsProps) {
  const [targets, setTargets] = useState<FixerKPITargets | null>(null);
  const [actualKPIs, setActualKPIs] = useState<ConsolidatedKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    loadData();
  }, [profileId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadTargets(), calculateActualKPIs()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTargets = async () => {
    try {
      const { data, error } = await supabase
        .from('fixer_kpi_targets')
        .select('*')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: defaultData, error: defaultError } = await supabase
          .from('fixer_kpi_targets')
          .select('*')
          .is('profile_id', null)
          .maybeSingle();

        if (defaultError) throw defaultError;
        setTargets(defaultData);
      } else {
        setTargets(data);
      }
    } catch (error) {
      console.error('Error loading targets:', error);
    }
  };

  const calculateActualKPIs = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());

      const { data: allDossiers, error: allError } = await supabase
        .from('dossiers')
        .select('*')
        .eq('fixer_id', profileId);

      if (allError) throw allError;

      const { data: monthlyDossiers, error: monthlyError } = await supabase
        .from('dossiers')
        .select('*')
        .eq('fixer_id', profileId)
        .gte('created_at', startOfMonth.toISOString());

      if (monthlyError) throw monthlyError;

      const { data: weeklyDossiers, error: weeklyError } = await supabase
        .from('dossiers')
        .select('*')
        .eq('fixer_id', profileId)
        .gte('created_at', startOfWeek.toISOString());

      if (weeklyError) throw weeklyError;

      const totalCalls = allDossiers?.length || 0;
      const contacted = allDossiers?.filter(d =>
        d.status !== 'à_contacter'
      ).length || 0;

      const rdvScheduled = allDossiers?.filter(d =>
        ['rdv_closer_planifié', 'rdv_closer_tenu', 'décision_oui', 'décision_non', 'formation_planifiée', 'formation_réalisée', 'attente_encaissement', 'encaissé'].includes(d.status)
      ).length || 0;

      const rdvHeld = allDossiers?.filter(d =>
        d.show_up === true
      ).length || 0;

      const qualityScores = allDossiers?.filter(d => d.lead_quality !== null).map(d => d.lead_quality as number) || [];
      const avgQuality = qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0;

      const pickupRate = totalCalls > 0 ? (contacted / totalCalls) * 100 : 0;
      const rdvRate = contacted > 0 ? (rdvScheduled / contacted) * 100 : 0;
      const showRate = rdvScheduled > 0 ? (rdvHeld / rdvScheduled) * 100 : 0;

      const workingDaysInMonth = 20;
      const workingHoursPerDay = 8;

      const callsPerDay = totalCalls > 0 ? totalCalls / workingDaysInMonth : 0;
      const callsPerWeek = (weeklyDossiers?.length || 0);
      const callsPerHour = callsPerDay > 0 ? callsPerDay / workingHoursPerDay : 0;

      const avgCallDuration = 0.15;

      const prospectsPerCall = totalCalls > 0 ? totalCalls / totalCalls : 1;

      setActualKPIs({
        callDuration: avgCallDuration,
        callsPerHour: callsPerHour,
        callsPerDay: callsPerDay,
        callsPerWeek: callsPerWeek,
        pickupRate: pickupRate,
        rdvRate: rdvRate,
        showRate: showRate,
        prospectsPerCall: prospectsPerCall,
        monthlyProspects: monthlyDossiers?.length || 0,
        avgLeadQuality: (avgQuality / 5) * 100
      });
    } catch (error) {
      console.error('Error calculating KPIs:', error);
    }
  };

  const getPerformanceIndicator = (actual: number, target: number) => {
    const diff = ((actual - target) / target) * 100;

    if (Math.abs(diff) < 5) {
      return { icon: Minus, color: 'text-slate-500', bg: 'bg-slate-100' };
    } else if (diff > 0) {
      return { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' };
    } else {
      return { icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-100' };
    }
  };

  const formatValue = (value: number, decimals: number = 2) => {
    return value.toFixed(decimals);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      </div>
    );
  }

  if (!targets || !actualKPIs) return null;

  const kpis = [
    {
      label: 'Durée d\'un appel',
      actual: formatValue(actualKPIs.callDuration, 2),
      target: formatValue(targets.call_duration_hours, 2),
      unit: 'h',
      actualNum: actualKPIs.callDuration,
      targetNum: targets.call_duration_hours
    },
    {
      label: 'Appels / heure',
      actual: formatValue(actualKPIs.callsPerHour, 0),
      target: formatValue(targets.calls_per_hour, 0),
      unit: '',
      actualNum: actualKPIs.callsPerHour,
      targetNum: targets.calls_per_hour
    },
    {
      label: 'Appels / jour',
      actual: formatValue(actualKPIs.callsPerDay, 0),
      target: formatValue(targets.calls_per_day, 0),
      unit: '',
      actualNum: actualKPIs.callsPerDay,
      targetNum: targets.calls_per_day
    },
    {
      label: 'Appels / semaine',
      actual: formatValue(actualKPIs.callsPerWeek, 0),
      target: formatValue(targets.calls_per_week, 0),
      unit: '',
      actualNum: actualKPIs.callsPerWeek,
      targetNum: targets.calls_per_week
    },
    {
      label: 'Taux de décroché',
      actual: formatValue(actualKPIs.pickupRate, 1),
      target: formatValue(targets.pickup_rate, 1),
      unit: '%',
      actualNum: actualKPIs.pickupRate,
      targetNum: targets.pickup_rate
    },
    {
      label: 'Taux de RDV',
      actual: formatValue(actualKPIs.rdvRate, 1),
      target: formatValue(targets.rdv_rate, 1),
      unit: '%',
      actualNum: actualKPIs.rdvRate,
      targetNum: targets.rdv_rate
    },
    {
      label: 'Taux show/noShow',
      actual: formatValue(actualKPIs.showRate, 2),
      target: formatValue(targets.show_rate, 2),
      unit: '%',
      actualNum: actualKPIs.showRate,
      targetNum: targets.show_rate
    },
    {
      label: 'Prospects / appel',
      actual: formatValue(actualKPIs.prospectsPerCall, 1),
      target: formatValue(targets.prospects_per_call, 1),
      unit: '',
      actualNum: actualKPIs.prospectsPerCall,
      targetNum: targets.prospects_per_call
    },
    {
      label: 'Prospects mensuels',
      actual: formatValue(actualKPIs.monthlyProspects, 0),
      target: formatValue(targets.monthly_prospects, 0),
      unit: '',
      actualNum: actualKPIs.monthlyProspects,
      targetNum: targets.monthly_prospects
    },
    {
      label: 'Qualité moyenne',
      actual: formatValue(actualKPIs.avgLeadQuality, 1),
      target: formatValue(targets.avg_lead_quality, 1),
      unit: '%',
      actualNum: actualKPIs.avgLeadQuality,
      targetNum: targets.avg_lead_quality
    }
  ];

  if (showEditor) {
    return (
      <FixerKPITargetsEditor
        profileId={profileId}
        onClose={() => {
          setShowEditor(false);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-slate-900">KPI Consolidés</h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-500" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {!isExpanded && actualKPIs && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-700">
                <strong>{formatValue(actualKPIs.callsPerDay, 0)}</strong> appels/j
              </span>
              <span className="text-slate-700">
                <strong>{formatValue(actualKPIs.rdvRate, 1)}%</strong> RDV
              </span>
              <span className="text-slate-700">
                <strong>{formatValue(actualKPIs.monthlyProspects, 0)}</strong> prospects
              </span>
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowEditor(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors text-sm font-semibold"
            >
              <Settings className="w-4 h-4" />
              Éditer objectifs
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, index) => {
          const performance = getPerformanceIndicator(kpi.actualNum, kpi.targetNum);
          const Icon = performance.icon;

          return (
            <div
              key={index}
              className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200 hover:border-orange-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-medium text-slate-600">{kpi.label}</p>
                <div className={`${performance.bg} ${performance.color} p-1 rounded`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1">
                <div>
                  <p className="text-xs text-slate-500">Réel</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {kpi.actual}
                    <span className="text-sm text-slate-500 ml-1">{kpi.unit}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Objectif</p>
                  <p className="text-lg font-semibold text-slate-600">
                    {kpi.target}
                    <span className="text-xs text-slate-400 ml-1">{kpi.unit}</span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
