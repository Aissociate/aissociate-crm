// @ts-nocheck
import { useState, useEffect } from 'react';
import { FileText, CheckCircle2, CreditCard, Wallet, AlertCircle, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Dossier, getFullName } from '../types/dossiers';

interface FinancingTrackerProps {
  showOnlyAlerts?: boolean;
}

export default function FinancingTracker({ showOnlyAlerts = false }: FinancingTrackerProps) {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDossiers();
  }, []);

  const fetchDossiers = async () => {
    try {
      let query = supabase
        .from('dossiers')
        .select('*')
        .in('status', ['décision_oui', 'formation_planifiée', 'formation_réalisée', 'attente_encaissement']);

      if (showOnlyAlerts) {
        query = query.or('financing_mode.neq.cpf,financing_mode.neq.,complementary_funding_type.neq.');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      const filteredData = showOnlyAlerts
        ? (data || []).filter(d => d.financing_mode && d.financing_mode !== 'cpf' && d.financing_mode !== '')
        : data || [];

      setDossiers(filteredData);
    } catch (error) {
      console.error('Error fetching dossiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFinancingStep = async (dossierId: string, field: string, value: boolean) => {
    const dateField = `${field}_date`;
    const updates: any = {
      [field]: value,
      [dateField]: value ? new Date().toISOString().split('T')[0] : null,
    };

    try {
      const { error } = await supabase
        .from('dossiers')
        .update(updates)
        .eq('id', dossierId);

      if (error) throw error;

      fetchDossiers();
    } catch (error) {
      console.error('Error updating financing step:', error);
      alert('Erreur lors de la mise à jour');
    }
  };

  const getFinancingModeLabel = (mode: string) => {
    const modes: { [key: string]: string } = {
      cpf: 'CPF',
      opco: 'OPCO',
      pole_emploi: 'Pôle Emploi',
      employeur: 'Employeur',
      personnel: 'Personnel',
      mixte: 'Mixte',
      autre: 'Autre',
    };
    return modes[mode] || mode;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (dossiers.length === 0) {
    return (
      <div className="bg-slate-50 rounded-lg p-8 text-center">
        <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-600">
          {showOnlyAlerts
            ? 'Aucun dossier avec financement non-CPF nécessitant un suivi'
            : 'Aucun dossier en cours'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showOnlyAlerts && dossiers.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <p className="font-semibold text-amber-900">
              {dossiers.length} dossier{dossiers.length > 1 ? 's' : ''} nécessite{dossiers.length > 1 ? 'nt' : ''} un suivi de financement
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-100 border-b-2 border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">Client</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-slate-700">Financement</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-slate-700">Devis envoyé</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-slate-700">Devis accepté</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-slate-700">Paiement demandé</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-slate-700">Paiement reçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dossiers.map((dossier) => (
                <tr key={dossier.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">{dossier.company}</p>
                      <p className="text-sm text-slate-600">{getFullName(dossier)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {getFinancingModeLabel(dossier.financing_mode)}
                      </p>
                      {dossier.complementary_funding_type && (
                        <p className="text-xs text-slate-600">
                          + {dossier.complementary_funding_type}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => updateFinancingStep(dossier.id, 'quote_sent', !dossier.quote_sent)}
                        className={`p-2 rounded-lg transition-all ${
                          dossier.quote_sent
                            ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                      {dossier.quote_sent_date && (
                        <span className="text-xs text-slate-500">
                          {new Date(dossier.quote_sent_date).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => updateFinancingStep(dossier.id, 'quote_accepted', !dossier.quote_accepted)}
                        className={`p-2 rounded-lg transition-all ${
                          dossier.quote_accepted
                            ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      {dossier.quote_accepted_date && (
                        <span className="text-xs text-slate-500">
                          {new Date(dossier.quote_accepted_date).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => updateFinancingStep(dossier.id, 'payment_requested', !dossier.payment_requested)}
                        className={`p-2 rounded-lg transition-all ${
                          dossier.payment_requested
                            ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                      </button>
                      {dossier.payment_requested_date && (
                        <span className="text-xs text-slate-500">
                          {new Date(dossier.payment_requested_date).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => updateFinancingStep(dossier.id, 'payment_received', !dossier.payment_received)}
                        className={`p-2 rounded-lg transition-all ${
                          dossier.payment_received
                            ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        <Wallet className="w-5 h-5" />
                      </button>
                      {dossier.payment_received_date && (
                        <span className="text-xs text-slate-500">
                          {new Date(dossier.payment_received_date).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
