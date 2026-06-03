// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, RefreshCw, Target, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FixerKPITargets {
  id: string;
  call_duration_hours: number;
  calls_per_hour: number;
  calls_per_day: number;
  calls_per_week: number;
  pickup_rate: number;
  rdv_rate: number;
  show_rate: number;
  prospects_per_call: number;
  monthly_prospects: number;
  avg_lead_quality: number;
}

export default function FixerKPITargetsEditor(_props?: { profileId?: string; onClose?: () => void }) {
  const [targets, setTargets] = useState<FixerKPITargets | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadTargets();
  }, []);

  const loadTargets = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('fixer_kpi_targets')
        .select('*')
        .is('profile_id', null)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        const { data: newData, error: createError } = await supabase
          .from('fixer_kpi_targets')
          .insert({
            profile_id: null,
            call_duration_hours: 0.15,
            calls_per_hour: 10,
            calls_per_day: 40,
            calls_per_week: 200,
            pickup_rate: 50,
            rdv_rate: 12.5,
            show_rate: 11.25,
            prospects_per_call: 1.8,
            monthly_prospects: 81,
            avg_lead_quality: 75,
          })
          .select()
          .single();

        if (createError) throw createError;
        setTargets(newData);
      } else {
        setTargets(data);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des objectifs');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!targets) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('fixer_kpi_targets')
        .update({
          call_duration_hours: targets.call_duration_hours,
          calls_per_hour: targets.calls_per_hour,
          calls_per_day: targets.calls_per_day,
          calls_per_week: targets.calls_per_week,
          pickup_rate: targets.pickup_rate,
          rdv_rate: targets.rdv_rate,
          show_rate: targets.show_rate,
          prospects_per_call: targets.prospects_per_call,
          monthly_prospects: targets.monthly_prospects,
          avg_lead_quality: targets.avg_lead_quality,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targets.id);

      if (updateError) throw updateError;

      setSuccess('Objectifs mis à jour avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof FixerKPITargets, value: string) => {
    if (!targets) return;
    setTargets({
      ...targets,
      [field]: parseFloat(value) || 0,
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!targets) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="text-center text-slate-500">
          Aucun objectif trouvé
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <Target className="w-6 h-6 text-orange-500" />
        <h2 className="text-xl font-bold text-slate-900">Objectifs KPI - Fixers</h2>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Durée d'un appel (minutes)
          </label>
          <input
            type="number"
            step="1"
            value={Math.round((targets.call_duration_hours || 0) * 60)}
            onChange={(e) => {
              const minutes = parseFloat(e.target.value) || 0;
              const hours = minutes / 60;
              setTargets({ ...targets, call_duration_hours: hours });
            }}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre d'appels par heure
          </label>
          <input
            type="number"
            step="1"
            value={targets.calls_per_hour}
            onChange={(e) => handleChange('calls_per_hour', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre d'appels par jour
          </label>
          <input
            type="number"
            step="1"
            value={targets.calls_per_day}
            onChange={(e) => handleChange('calls_per_day', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre d'appels par semaine
          </label>
          <input
            type="number"
            step="1"
            value={targets.calls_per_week}
            onChange={(e) => handleChange('calls_per_week', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Taux de décroché (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={targets.pickup_rate}
            onChange={(e) => handleChange('pickup_rate', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Taux de RDV (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={targets.rdv_rate}
            onChange={(e) => handleChange('rdv_rate', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Taux de show/noShow (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={targets.show_rate}
            onChange={(e) => handleChange('show_rate', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre de prospects par appel
          </label>
          <input
            type="number"
            step="0.1"
            value={targets.prospects_per_call}
            onChange={(e) => handleChange('prospects_per_call', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre de prospects mensuels
          </label>
          <input
            type="number"
            step="1"
            value={targets.monthly_prospects}
            onChange={(e) => handleChange('monthly_prospects', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Qualité moyenne des leads (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={targets.avg_lead_quality}
            onChange={(e) => handleChange('avg_lead_quality', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={loadTargets}
          disabled={saving}
          className="px-6 py-2 border-2 border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Réinitialiser
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Enregistrer
            </>
          )}
        </button>
      </div>
    </div>
  );
}
