// @ts-nocheck
import { useState, useEffect } from 'react';
import { X, Save, Bell } from 'lucide-react';
import { Dossier, DECISIONS, getFullName } from '../../types/dossiers';
import { supabase } from '../../lib/supabase';

interface CloserDossierFormProps {
  dossier: Dossier;
  onClose: () => void;
  onSave: () => void;
}

export default function CloserDossierForm({ dossier, onClose, onSave }: CloserDossierFormProps) {
  const [formData, setFormData] = useState({
    rdv_closer_date: '',
    decision: '',
    objections: '',
    lead_quality: '',
    next_step_date: '',
    next_step_action: '',
    closer_notes: '',
    cart_value: 0,
    related_clients_count: 0,
    is_rappel: false,
    rappel_date: '',
    rappel_notes: '',
    cpf_amount: 0,
    complementary_funding_type: '',
    complementary_funding_amount: 0,
    financing_mode: '',
    personal_funding_amount: 0,
  });

  useEffect(() => {
    const formatDateForInput = (dateString: string | null) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setFormData({
      rdv_closer_date: dossier.rdv_closer_date ? dossier.rdv_closer_date.split('T')[0] : '',
      decision: dossier.decision || '',
      objections: dossier.objections || '',
      lead_quality: dossier.lead_quality?.toString() || '',
      next_step_date: dossier.next_step_date || '',
      next_step_action: dossier.next_step_action || '',
      closer_notes: dossier.closer_notes || '',
      cart_value: dossier.cart_value || 0,
      related_clients_count: dossier.related_clients_count || 0,
      is_rappel: dossier.is_rappel || false,
      rappel_date: formatDateForInput(dossier.rappel_date),
      rappel_notes: dossier.rappel_notes || '',
      cpf_amount: dossier.cpf_amount || 0,
      complementary_funding_type: dossier.complementary_funding_type || '',
      complementary_funding_amount: dossier.complementary_funding_amount || 0,
      financing_mode: dossier.financing_mode || '',
      personal_funding_amount: dossier.personal_funding_amount || 0,
    });
  }, [dossier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('dossiers')
        .update({
          rdv_closer_date: formData.rdv_closer_date ? new Date(formData.rdv_closer_date).toISOString() : null,
          decision: formData.decision || null,
          objections: formData.objections,
          lead_quality: formData.lead_quality ? parseInt(formData.lead_quality) : null,
          next_step_date: formData.next_step_date || null,
          next_step_action: formData.next_step_action,
          closer_notes: formData.closer_notes,
          cart_value: formData.cart_value,
          related_clients_count: formData.related_clients_count,
          is_rappel: formData.is_rappel,
          rappel_date: formData.rappel_date ? new Date(formData.rappel_date).toISOString() : null,
          rappel_notes: formData.rappel_notes,
          cpf_amount: formData.cpf_amount,
          complementary_funding_type: formData.complementary_funding_type,
          complementary_funding_amount: formData.complementary_funding_amount,
          financing_mode: formData.financing_mode,
          personal_funding_amount: formData.personal_funding_amount,
          status: formData.decision === 'oui' ? 'décision_oui' : formData.decision === 'non' ? 'décision_non' : dossier.status,
        })
        .eq('id', dossier.id);

      if (error) throw error;

      onSave();
    } catch (error) {
      console.error('Error saving dossier:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b-2 border-slate-200 p-6 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Mise à jour RDV Closer</h3>
            <p className="text-slate-600 text-sm mt-1">{dossier.company} - {getFullName(dossier)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <h4 className="font-bold text-slate-900 mb-2">Informations Fixer</h4>
              <div className="text-sm text-slate-700 space-y-1">
                <p>
                  <strong>Produit:</strong>{' '}
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    dossier.product_type === 'marche_public'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {dossier.product_type === 'marche_public' ? 'Le marché public.fr' : 'Formations IA'}
                  </span>
                </p>
                <p><strong>Téléphone:</strong> {dossier.phone || '-'}</p>
                <p><strong>Email:</strong> {dossier.email || '-'}</p>
                <p><strong>Secteur:</strong> {dossier.sector || '-'}</p>
                {dossier.call_duration_minutes > 0 && (
                  <p><strong>Temps de discussion:</strong> {dossier.call_duration_minutes} minutes</p>
                )}
                {dossier.cpf_amount > 0 && (
                  <p className="text-blue-700"><strong>Montant CPF (Fixer):</strong> {dossier.cpf_amount}€</p>
                )}
                {dossier.complementary_funding_type && (
                  <p className="text-blue-700"><strong>Financement complémentaire (Fixer):</strong> {dossier.complementary_funding_type} ({dossier.complementary_funding_amount}€)</p>
                )}
                {dossier.fixer_notes && (
                  <p><strong>Notes Fixer:</strong> {dossier.fixer_notes}</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Date RDV Closer <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.rdv_closer_date}
                  onChange={(e) => setFormData({ ...formData, rdv_closer_date: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Décision <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.decision}
                  onChange={(e) => setFormData({ ...formData, decision: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Sélectionner...</option>
                  {DECISIONS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Qualité lead (1-10) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="10"
                  value={formData.lead_quality}
                  onChange={(e) => setFormData({ ...formData, lead_quality: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                  placeholder="1-10"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Prochaine étape (date)</label>
                <input
                  type="date"
                  value={formData.next_step_date}
                  onChange={(e) => setFormData({ ...formData, next_step_date: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Valeur du panier (€)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cart_value}
                  onChange={(e) => setFormData({ ...formData, cart_value: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nombre de clients connexes</label>
                <input
                  type="number"
                  min="0"
                  value={formData.related_clients_count}
                  onChange={(e) => setFormData({ ...formData, related_clients_count: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Objections</label>
                <input
                  type="text"
                  value={formData.objections}
                  onChange={(e) => setFormData({ ...formData, objections: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                  placeholder="Prix, timing, concurrence..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Prochaine action</label>
                <input
                  type="text"
                  value={formData.next_step_action}
                  onChange={(e) => setFormData({ ...formData, next_step_action: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                  placeholder="Rappel, envoi devis, formation..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Notes Closer</label>
                <textarea
                  value={formData.closer_notes}
                  onChange={(e) => setFormData({ ...formData, closer_notes: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                  rows={4}
                  placeholder="Notes détaillées sur le RDV..."
                ></textarea>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-6 border-2 border-blue-200">
            <h4 className="font-bold text-slate-900 mb-4 text-lg">Options de Financement</h4>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Mode de financement principal
                  </label>
                  <select
                    value={formData.financing_mode}
                    onChange={(e) => setFormData({ ...formData, financing_mode: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Sélectionner...</option>
                    <option value="cpf">CPF</option>
                    <option value="opco">OPCO</option>
                    <option value="pole_emploi">Pôle Emploi</option>
                    <option value="employeur">Employeur</option>
                    <option value="personnel">Personnel</option>
                    <option value="mixte">Mixte</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Montant CPF (€)
                  </label>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Type de financement complémentaire
                  </label>
                  <select
                    value={formData.complementary_funding_type}
                    onChange={(e) => setFormData({ ...formData, complementary_funding_type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Aucun</option>
                    <option value="pole_emploi">Pôle Emploi (AIF)</option>
                    <option value="opco">OPCO</option>
                    <option value="agefice">AGEFICE</option>
                    <option value="employeur">Employeur</option>
                    <option value="region">Région</option>
                    <option value="agefiph">Agefiph</option>
                    <option value="transitions_pro">Transitions Pro</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Montant financement complémentaire (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.complementary_funding_amount}
                    onChange={(e) => setFormData({ ...formData, complementary_funding_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Financement personnel (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.personal_funding_amount}
                    onChange={(e) => setFormData({ ...formData, personal_funding_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <div className="bg-white rounded-lg p-3 border-2 border-blue-300 w-full">
                    <p className="text-xs text-slate-600 mb-1">Total financements</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {(formData.cpf_amount + formData.complementary_funding_amount + formData.personal_funding_amount).toFixed(2)}€
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-200">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-orange-600" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_rappel}
                  onChange={(e) => setFormData({ ...formData, is_rappel: e.target.checked })}
                  className="w-5 h-5 text-orange-600 border-2 border-slate-300 rounded focus:ring-orange-500"
                />
                <span className="font-bold text-slate-900">Marquer comme Rappel</span>
              </label>
            </div>

            {formData.is_rappel && (
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Date de rappel <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required={formData.is_rappel}
                    value={formData.rappel_date}
                    onChange={(e) => setFormData({ ...formData, rappel_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Notes de rappel</label>
                  <textarea
                    value={formData.rappel_notes}
                    onChange={(e) => setFormData({ ...formData, rappel_notes: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    rows={3}
                    placeholder="Raison du rappel, contexte, points à aborder..."
                  ></textarea>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6 pt-6 border-t-2 border-slate-200">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg transition-all font-semibold"
            >
              <Save className="w-5 h-5" />
              Enregistrer
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
