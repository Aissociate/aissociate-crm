// @ts-nocheck
import { useState } from 'react';
import { X, Save, Building2, User, Briefcase, Bell, ArrowRight, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SOURCES, COMPLEMENTARY_FUNDING_TYPES, DOSSIER_STATUSES, DossierStatus } from '../../types/dossiers';
import { syncLeadToGHL } from '../../lib/ghlSync';

interface CreateDossierFormProps {
  closerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateDossierForm({ closerId, onClose, onSuccess }: CreateDossierFormProps) {
  const [step, setStep] = useState<'product' | 'form'>('product');
  const [productType, setProductType] = useState<'marche_public' | 'formations_ia' | ''>('');
  const [formData, setFormData] = useState({
    company: '',
    contact_first_name: '',
    contact_last_name: '',
    contact_function: '',
    phone: '',
    email: '',
    sector: '',
    size: '',
    source: 'inbound',
    status: 'rdv_closer_planifié' as DossierStatus,
    rdv_closer_date: '',
    closer_notes: '',
    cpf_amount: '',
    complementary_funding_type: '',
    complementary_funding_amount: '',
    is_rappel: false,
    rappel_date: '',
    rappel_notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('dossiers')
        .insert([
          {
            company: formData.company,
            contact_first_name: formData.contact_first_name,
            contact_last_name: formData.contact_last_name,
            contact_function: formData.contact_function,
            phone: formData.phone,
            email: formData.email,
            sector: formData.sector,
            size: formData.size,
            source: formData.source,
            product_type: productType,
            closer_id: closerId,
            fixer_id: closerId,
            status: formData.status,
            rdv_closer_date: formData.rdv_closer_date ? new Date(formData.rdv_closer_date).toISOString() : null,
            closer_notes: formData.closer_notes,
            cpf_amount: formData.cpf_amount ? parseFloat(formData.cpf_amount) : 0,
            complementary_funding_type: formData.complementary_funding_type,
            complementary_funding_amount: formData.complementary_funding_amount ? parseFloat(formData.complementary_funding_amount) : 0,
            is_rappel: formData.is_rappel,
            rappel_date: formData.rappel_date ? new Date(formData.rappel_date).toISOString() : null,
            rappel_notes: formData.rappel_notes,
            fixer_notes: '',
            objections: '',
            next_step_action: '',
            dispute_reason: '',
            call_duration_minutes: 0,
            cart_value: 0,
            related_clients_count: 0,
            formation_done: false,
            paid: false,
            amount: 0,
            dispute: false,
          },
        ])
        .select('id')
        .single();

      if (insertError) throw insertError;

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
          product_type: productType,
          sector: formData.sector,
          notes: formData.closer_notes,
        });
      }

      onSuccess();
    } catch (err) {
      console.error('Error creating dossier:', err);
      setError('Erreur lors de la création du dossier');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product: 'marche_public' | 'formations_ia') => {
    setProductType(product);
    setStep('form');
  };

  if (step === 'product') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-2xl w-full">
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-6 rounded-t-xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-white">Quel produit vendez-vous ?</h3>
                <p className="text-emerald-100 text-sm mt-1">Sélectionnez le produit pour ce dossier</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-6">
              <button
                onClick={() => handleProductSelect('marche_public')}
                className="group relative bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-3 border-blue-300 hover:border-blue-500 rounded-2xl p-8 transition-all hover:shadow-2xl hover:scale-105"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Building2 className="w-10 h-10 text-white" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 mb-2">Le marché public.fr</h4>
                  <p className="text-sm text-slate-600">Prospection et closing pour les marchés publics</p>
                  <ArrowRight className="w-6 h-6 text-blue-600 mt-4 group-hover:translate-x-2 transition-transform" />
                </div>
              </button>

              <button
                onClick={() => handleProductSelect('formations_ia')}
                className="group relative bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 border-3 border-emerald-300 hover:border-emerald-500 rounded-2xl p-8 transition-all hover:shadow-2xl hover:scale-105"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Package className="w-10 h-10 text-white" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-900 mb-2">Formations IA</h4>
                  <p className="text-sm text-slate-600">Formations professionnelles financées par le CPF</p>
                  <ArrowRight className="w-6 h-6 text-emerald-600 mt-4 group-hover:translate-x-2 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b-2 border-emerald-200 p-6 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Créer un nouveau dossier</h3>
            <p className="text-slate-600 text-sm mt-1">
              Produit: <span className="font-semibold text-emerald-600">
                {productType === 'marche_public' ? 'Le marché public.fr' : 'Formations IA'}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 font-semibold">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="bg-emerald-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-slate-900">Informations Entreprise</h4>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Entreprise <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                    placeholder="Nom de l'entreprise"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Secteur</label>
                  <input
                    type="text"
                    value={formData.sector}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                    placeholder="Secteur d'activité"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Taille</label>
                  <input
                    type="text"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                    placeholder="Nombre d'employés"
                  />
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-blue-600" />
                <h4 className="font-bold text-slate-900">Contact Principal</h4>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
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
                    placeholder="Prénom"
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
                    placeholder="Nom"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Fonction</label>
                  <input
                    type="text"
                    value={formData.contact_function}
                    onChange={(e) => setFormData({ ...formData, contact_function: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Poste dans l'entreprise"
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
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
            </div>

            <div className="bg-amber-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="w-5 h-5 text-amber-600" />
                <h4 className="font-bold text-slate-900">Informations Dossier</h4>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Statut <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as DossierStatus })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none"
                  >
                    {DOSSIER_STATUSES.map(status => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none"
                  >
                    {SOURCES.map(source => (
                      <option key={source.value} value={source.value}>
                        {source.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Date RDV Closer</label>
                  <input
                    type="datetime-local"
                    value={formData.rdv_closer_date}
                    onChange={(e) => setFormData({ ...formData, rdv_closer_date: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Montant CPF (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.cpf_amount}
                    onChange={(e) => setFormData({ ...formData, cpf_amount: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Financement complémentaire</label>
                  <select
                    value={formData.complementary_funding_type}
                    onChange={(e) => setFormData({ ...formData, complementary_funding_type: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none"
                  >
                    {COMPLEMENTARY_FUNDING_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.complementary_funding_type && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Montant financement (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formData.complementary_funding_amount}
                      onChange={(e) => setFormData({ ...formData, complementary_funding_amount: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
                  <textarea
                    value={formData.closer_notes}
                    onChange={(e) => setFormData({ ...formData, closer_notes: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-amber-500 focus:outline-none"
                    rows={3}
                    placeholder="Notes sur le dossier..."
                  ></textarea>
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
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg transition-all font-semibold disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Création...' : 'Créer le dossier'}
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
