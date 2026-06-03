// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, RefreshCw, Target, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CloserKPITargets {
  id: string;
  closing_rate: number;
  appointment_duration_minutes: number;
  appointments_per_hour: number;
  followup_calls: number;
  appointments_per_day: number;
  clients_per_day: number;
  clients_per_month: number;
  closers_needed: number;
  average_cart: number;
}

export default function CloserKPITargetsEditor() {
  const [targets, setTargets] = useState<CloserKPITargets | null>(null);
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
        .from('closer_kpi_targets')
        .select('*')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        const { data: newData, error: createError } = await supabase
          .from('closer_kpi_targets')
          .insert({
            closing_rate: 25,
            appointment_duration_minutes: 45,
            appointments_per_hour: 1,
            followup_calls: 3,
            appointments_per_day: 8,
            clients_per_day: 2,
            clients_per_month: 40,
            closers_needed: 5,
            average_cart: 1800,
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
        .from('closer_kpi_targets')
        .update({
          closing_rate: targets.closing_rate,
          appointment_duration_minutes: targets.appointment_duration_minutes,
          appointments_per_hour: targets.appointments_per_hour,
          followup_calls: targets.followup_calls,
          appointments_per_day: targets.appointments_per_day,
          clients_per_day: targets.clients_per_day,
          clients_per_month: targets.clients_per_month,
          closers_needed: targets.closers_needed,
          average_cart: targets.average_cart,
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

  const handleChange = (field: keyof CloserKPITargets, value: string) => {
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
        <h2 className="text-xl font-bold text-slate-900">Objectifs KPI - Closers</h2>
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
            Taux de closing (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={targets.closing_rate}
            onChange={(e) => handleChange('closing_rate', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Durée d'un RDV (minutes)
          </label>
          <input
            type="number"
            step="1"
            value={targets.appointment_duration_minutes}
            onChange={(e) => handleChange('appointment_duration_minutes', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre de RDV par heure
          </label>
          <input
            type="number"
            step="0.1"
            value={targets.appointments_per_hour}
            onChange={(e) => handleChange('appointments_per_hour', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre de rappels pour suivi
          </label>
          <input
            type="number"
            step="1"
            value={targets.followup_calls}
            onChange={(e) => handleChange('followup_calls', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre de RDV par jour
          </label>
          <input
            type="number"
            step="1"
            value={targets.appointments_per_day}
            onChange={(e) => handleChange('appointments_per_day', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre de clients par jour
          </label>
          <input
            type="number"
            step="0.1"
            value={targets.clients_per_day}
            onChange={(e) => handleChange('clients_per_day', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre de clients par mois
          </label>
          <input
            type="number"
            step="1"
            value={targets.clients_per_month}
            onChange={(e) => handleChange('clients_per_month', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Closers nécessaires
          </label>
          <input
            type="number"
            step="1"
            value={targets.closers_needed}
            onChange={(e) => handleChange('closers_needed', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Panier moyen (€)
          </label>
          <input
            type="number"
            step="1"
            value={targets.average_cart}
            onChange={(e) => handleChange('average_cart', e.target.value)}
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
