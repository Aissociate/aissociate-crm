// @ts-nocheck
import { useState } from 'react';
import { Target, CheckCircle, Star, Award, Calendar, ChevronDown, ChevronUp, TrendingUp, ArrowUpRight } from 'lucide-react';
import { FixerKPIs } from '../../types/dossiers';
import { formatPercent, formatCurrency } from '../../utils/kpiCalculations';

interface FixerKPIWidgetProps {
  kpis: FixerKPIs;
  bonusEstimate: {
    amount: number;
    tier: number;
    nextTier: number | null;
    clientsToNext: number;
  };
  period: 'all' | 'day' | 'week' | 'month';
  onPeriodChange: (period: 'all' | 'day' | 'week' | 'month') => void;
}

const periods = [
  { key: 'all' as const, label: 'Tout' },
  { key: 'day' as const, label: 'Jour' },
  { key: 'week' as const, label: 'Semaine' },
  { key: 'month' as const, label: 'Mois' },
];

export default function FixerKPIWidget({ kpis, bonusEstimate, period, onPeriodChange }: FixerKPIWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Performance</h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>

        {!isExpanded && (
          <div className="flex items-center gap-5 text-xs text-slate-600">
            <span><strong className="text-slate-900">{kpis.rdvPlanned}</strong> RDV</span>
            <span><strong className="text-slate-900">{formatPercent(kpis.showUpRate)}</strong> Show-up</span>
            <span><strong className="text-slate-900">{kpis.clientsPaid}</strong> Encaisses</span>
            <span className="text-blue-600 font-semibold">{formatCurrency(bonusEstimate.amount)}</span>
          </div>
        )}

        {isExpanded && (
          <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg p-1">
            {periods.map(p => (
              <button
                key={p.key}
                onClick={() => onPeriodChange(p.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  period === p.key
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard
              icon={<Target className="w-4 h-4" />}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              label="RDV planifies"
              value={kpis.rdvPlanned.toString()}
            />
            <MetricCard
              icon={<CheckCircle className="w-4 h-4" />}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              label="Show-up"
              value={formatPercent(kpis.showUpRate)}
            />
            <MetricCard
              icon={<ArrowUpRight className="w-4 h-4" />}
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
              label="Encaisses"
              value={kpis.clientsPaid.toString()}
            />
            <MetricCard
              icon={<Star className="w-4 h-4" />}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
              label="Qualite moy."
              value={`${kpis.avgQuality.toFixed(1)}/10`}
            />
            <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-1.5">
                <Award className="w-4 h-4 text-blue-600" />
                <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wider">Prime estimee</span>
              </div>
              <p className="text-2xl font-bold text-blue-700 tracking-tight">{formatCurrency(bonusEstimate.amount)}</p>
              {bonusEstimate.nextTier && bonusEstimate.clientsToNext > 0 && (
                <p className="text-[11px] text-blue-500 mt-1">
                  Encore {bonusEstimate.clientsToNext} client{bonusEstimate.clientsToNext > 1 ? 's' : ''} pour le palier suivant
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, iconBg, iconColor, label, value }: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl p-4 bg-slate-50/50 border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-6 h-6 rounded-md ${iconBg} flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
    </div>
  );
}
