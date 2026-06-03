// @ts-nocheck
import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Dossier, SOURCES, getEditableStatusesByRole, DOSSIER_STATUSES, COMPLEMENTARY_FUNDING_TYPES } from '../../types/dossiers';
import { supabase } from '../../lib/supabase';
import { syncLeadToGHL } from '../../lib/ghlSync';

interface DossierFormProps {
  dossier: Partial<Dossier> | null;
  fixerId: string;
  onClose: () => void;
  onSave: () => void;
  role: 'fixer' | 'closer' | 'admin';
}

export default function DossierForm({ dossier, fixerId, onClose, onSave, role }: DossierFormProps) {
  const [formData, setFormData] = useState({
    company: '',
    contact_first_name: '',
    contact_last_name: '',
    contact_function: '',
    phone: '',
    email: '',
    sector: '',
    size: '',
    source: 'cold_call',
    status: 'à_contacter',
    initial_call_date: '',
    prospect_response: null as boolean | null,
    rdv_date: '',
    show_up: null as boolean | null,
    fixer_notes: '',
    call_duration_minutes: 0,
    cpf_amount: 0,
    complementary_funding_type: '',
    complementary_funding_amount: 0,
    next_step_date: '',
    next_step_action: '',
  });

  useEffect(() => {
    if (dossier) {
      setFormData({
        company: dossier.company || '',
        contact_first_name: dossier.contact_first_name || '',
        contact_last_name: dossier.contact_last_name || '',
        contact_function: dossier.contact_function || '',
        phone: dossier.phone || '',
        email: dossier.email || '',
        sector: dossier.sector || '',
        size: dossier.size || '',
        source: dossier.source || 'cold_call',
        status: dossier.status || 'à_contacter',
        initial_call_date: dossier.initial_call_date || '',
        prospect_response: dossier.prospect_response ?? null,
        rdv_date: dossier.rdv_date ? dossier.rdv_date.split('T')[0] : '',
        show_up: dossier.show_up ?? null,
        fixer_notes: dossier.fixer_notes || '',
        call_duration_minutes: dossier.call_duration_minutes || 0,
        cpf_amount: dossier.cpf_amount || 0,
        complementary_funding_type: dossier.complementary_funding_type || '',
        complementary_funding_amount: dossier.complementary_funding_amount || 0,
        next_step_date: dossier.next_step_date ? dossier.next_step_date.split('T')[0] : '',
        next_step_action: dossier.next_step_action || '',
      });
    }
  }, [dossier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const dataToSave = {
        ...formData,
        fixer_id: fixerId,
        rdv_date: formData.rdv_date ? new Date(formData.rdv_date).toISOString() : null,
        initial_call_date: formData.initial_call_date || null,
        next_step_date: formData.next_step_date ? new Date(formData.next_step_date).toISOString() : null,
      };

      if (dossier?.id) {
        const { error } = await supabase
          .from('dossiers')
          .update(dataToSave)
          .eq('id', dossier.id);

        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('dossiers')
          .insert([dataToSave])
          .select('id')
          .single();

        if (error) throw error;

        if (inserted?.id) {
          syncLeadToGHL({
            source_table: 'dossiers',
            source_id: inserted.id,
            first_name: formData.contact_first_name,
            last_name: formData.contact_last_name,
            email: formData.email,
            phone: formData.phone,
            company: formData.company,
            source: formData.source,
            status: formData.status,
            sector: formData.sector,
            notes: formData.fixer_notes,
          });
        }
      }

      onSave();
    } catch (error) {
      console.error('Error saving dossier:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const editableStatuses = getEditableStatusesByRole(role);
  const filteredStatuses = DOSSIER_STATUSES.filter(s => editableStatuses.includes(s.value));

  const requiresDateForStatus = ['à_contacter', 'contacté_pas_réponse', 'contacté_conversation'].includes(formData.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b-2 border-slate-200 p-6 flex justify-between items-center">
          <h3 className="text-2xl font-bold text-slate-900">
            {dossier?.id ? 'Modifier le dossier' : 'Nouveau dossier'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div>
              <h4 className="font-bold text-lg text-slate-900 mb-4">Identité</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Entreprise <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contact_first_name}
                    onChange={(e) => setFormData({ ...formData, contact_first_name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contact_last_name}
                    onChange={(e) => setFormData({ ...formData, contact_last_name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Fonction</label>
                  <input
                    type="text"
                    value={formData.contact_function}
                    onChange={(e) => setFormData({ ...formData, contact_function: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Téléphone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Secteur</label>
                  <input
                    type="text"
                    value={formData.sector}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Pharma, Auto, etc."
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-lg text-slate-900 mb-4">Pipeline</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    {SOURCES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Statut</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    {filteredStatuses.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  {role === 'fixer' && (
                    <div className="text-xs text-slate-500 mt-1 space-y-1">
                      <p className="font-semibold">Règles de statut :</p>
                      <ul className="list-disc list-inside space-y-0.5 ml-2">
                        <li>À contacter : nécessite date de prochaine action</li>
                        <li>Contacté - pas de réponse : nécessite date de prochaine action</li>
                        <li>Contacté - conversation : nécessite date de prochaine action</li>
                        <li>RDV closer planifié : rendez-vous fixé avec le closer</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-lg text-slate-900 mb-4">Données Fixer</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Date appel initial</label>
                  <input
                    type="date"
                    value={formData.initial_call_date}
                    onChange={(e) => setFormData({ ...formData, initial_call_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Réponse prospect</label>
                  <select
                    value={formData.prospect_response === null ? '' : formData.prospect_response.toString()}
                    onChange={(e) => setFormData({ ...formData, prospect_response: e.target.value === '' ? null : e.target.value === 'true' })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Non renseigné</option>
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Date RDV Closer</label>
                  <input
                    type="date"
                    value={formData.rdv_date}
                    onChange={(e) => setFormData({ ...formData, rdv_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  {role === 'fixer' && (
                    <p className="text-xs text-slate-500 mt-1">
                      Un closer sera assigné automatiquement quand le statut passe à "RDV closer planifié"
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Show-up</label>
                  <select
                    value={formData.show_up === null ? '' : formData.show_up.toString()}
                    onChange={(e) => setFormData({ ...formData, show_up: e.target.value === '' ? null : e.target.value === 'true' })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Non renseigné</option>
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Temps de discussion (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.call_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, call_duration_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Montant CPF (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.cpf_amount}
                    onChange={(e) => setFormData({ ...formData, cpf_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Financement complémentaire</label>
                  <select
                    value={formData.complementary_funding_type}
                    onChange={(e) => setFormData({ ...formData, complementary_funding_type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    {COMPLEMENTARY_FUNDING_TYPES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Montant financement complémentaire (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.complementary_funding_amount}
                    onChange={(e) => setFormData({ ...formData, complementary_funding_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    disabled={!formData.complementary_funding_type}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Notes Fixer</label>
                  <textarea
                    value={formData.fixer_notes}
                    onChange={(e) => setFormData({ ...formData, fixer_notes: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    rows={3}
                  ></textarea>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-lg text-slate-900 mb-4">Planification Relance</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Date de prochaine action
                    {requiresDateForStatus && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    type="date"
                    value={formData.next_step_date}
                    onChange={(e) => setFormData({ ...formData, next_step_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    required={requiresDateForStatus}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Date obligatoire pour les statuts : "À contacter", "Contacté - pas de réponse", "Contacté - conversation"
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Objectif de la prochaine action
                  </label>
                  <input
                    type="text"
                    value={formData.next_step_action}
                    onChange={(e) => setFormData({ ...formData, next_step_action: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Ex: Rappel pour présenter notre offre"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Recommandé pour tous les statuts
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t-2 border-slate-200">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all font-semibold"
            >
              <Save className="w-5 h-5" />
              {dossier?.id ? 'Mettre à jour' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg transition-colors font-semibold"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
