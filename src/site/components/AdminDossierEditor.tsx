// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Save, MessageSquare, Send, Trash2 } from 'lucide-react';
import { Dossier, DOSSIER_STATUSES, SOURCES, DECISIONS, COMPLEMENTARY_FUNDING_TYPES, FINANCING_MODES } from '../types/dossiers';
import RelatedContactsManager from './dossiers/RelatedContactsManager';

interface Comment {
  id: string;
  dossier_id: string;
  profile_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  author?: {
    email: string;
    role: string;
  };
}

interface AdminDossierEditorProps {
  dossier: Dossier;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AdminDossierEditor({ dossier, onClose, onUpdate }: AdminDossierEditorProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState<Dossier>(dossier);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadComments();
  }, [dossier.id]);

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('dossier_comments')
        .select(`
          *,
          author:profiles!dossier_comments_profile_id_fkey(email, role)
        `)
        .eq('dossier_id', dossier.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setComments(data || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('dossiers')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', dossier.id);

      if (error) throw error;

      onUpdate();
    } catch (error) {
      console.error('Error updating dossier:', error);
      alert('Erreur lors de la mise à jour du dossier');
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('dossier_comments')
        .insert({
          dossier_id: dossier.id,
          profile_id: profile?.id,
          comment: newComment.trim()
        });

      if (error) throw error;

      setNewComment('');
      await loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Erreur lors de l\'ajout du commentaire');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce commentaire ?')) return;

    try {
      const { error } = await supabase
        .from('dossier_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      await loadComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Erreur lors de la suppression du commentaire');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Édition Complète - {formData.company}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Informations de l'entreprise</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Entreprise</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Secteur</label>
                    <input
                      type="text"
                      value={formData.sector}
                      onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Taille</label>
                    <input
                      type="text"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Source</label>
                    <select
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {SOURCES.map(source => (
                        <option key={source.value} value={source.value}>{source.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Produit</label>
                    <select
                      value={formData.product_type}
                      onChange={(e) => setFormData({ ...formData, product_type: e.target.value as 'marche_public' | 'formations_ia' })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="formations_ia">Formations IA</option>
                      <option value="marche_public">Le marché public.fr</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Contact</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Prénom</label>
                    <input
                      type="text"
                      value={formData.contact_first_name}
                      onChange={(e) => setFormData({ ...formData, contact_first_name: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Nom</label>
                    <input
                      type="text"
                      value={formData.contact_last_name}
                      onChange={(e) => setFormData({ ...formData, contact_last_name: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Fonction</label>
                    <input
                      type="text"
                      value={formData.contact_function}
                      onChange={(e) => setFormData({ ...formData, contact_function: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Suivi commercial</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Statut</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {DOSSIER_STATUSES.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date appel initial</label>
                    <input
                      type="date"
                      value={formData.initial_call_date || ''}
                      onChange={(e) => setFormData({ ...formData, initial_call_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.prospect_response || false}
                        onChange={(e) => setFormData({ ...formData, prospect_response: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Prospect a répondu</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date RDV</label>
                    <input
                      type="date"
                      value={formData.rdv_date || ''}
                      onChange={(e) => setFormData({ ...formData, rdv_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.show_up || false}
                        onChange={(e) => setFormData({ ...formData, show_up: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Client présent au RDV</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date RDV Closer</label>
                    <input
                      type="date"
                      value={formData.rdv_closer_date || ''}
                      onChange={(e) => setFormData({ ...formData, rdv_closer_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Prochaine étape</label>
                    <input
                      type="date"
                      value={formData.next_step_date || ''}
                      onChange={(e) => setFormData({ ...formData, next_step_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Action prochaine étape</label>
                    <input
                      type="text"
                      value={formData.next_step_action}
                      onChange={(e) => setFormData({ ...formData, next_step_action: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Décision</label>
                    <select
                      value={formData.decision || ''}
                      onChange={(e) => setFormData({ ...formData, decision: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">Aucune</option>
                      {DECISIONS.map(decision => (
                        <option key={decision.value} value={decision.value}>{decision.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Qualité du lead (1-5)</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={formData.lead_quality || ''}
                      onChange={(e) => setFormData({ ...formData, lead_quality: parseInt(e.target.value) || null })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Temps de discussion (min)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.call_duration_minutes}
                      onChange={(e) => setFormData({ ...formData, call_duration_minutes: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Mode de financement</label>
                    <select
                      value={formData.financing_mode}
                      onChange={(e) => setFormData({ ...formData, financing_mode: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {FINANCING_MODES.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Montant CPF (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.cpf_amount}
                      onChange={(e) => setFormData({ ...formData, cpf_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Financement complémentaire</label>
                    <select
                      value={formData.complementary_funding_type}
                      onChange={(e) => setFormData({ ...formData, complementary_funding_type: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {COMPLEMENTARY_FUNDING_TYPES.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Montant financement complémentaire (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.complementary_funding_amount}
                      onChange={(e) => setFormData({ ...formData, complementary_funding_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Financement personnel (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.personal_funding_amount}
                      onChange={(e) => setFormData({ ...formData, personal_funding_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Notes Fixer</label>
                  <textarea
                    value={formData.fixer_notes}
                    onChange={(e) => setFormData({ ...formData, fixer_notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Objections</label>
                  <textarea
                    value={formData.objections}
                    onChange={(e) => setFormData({ ...formData, objections: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Valeur du panier (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.cart_value}
                      onChange={(e) => setFormData({ ...formData, cart_value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Nombre de clients connexes</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.related_clients_count}
                      onChange={(e) => setFormData({ ...formData, related_clients_count: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Notes Closer</label>
                  <textarea
                    value={formData.closer_notes}
                    onChange={(e) => setFormData({ ...formData, closer_notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              <RelatedContactsManager dossierId={dossier.id} />

              <div className="bg-purple-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Rappels</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_rappel}
                        onChange={(e) => setFormData({ ...formData, is_rappel: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Rappel programmé</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date du rappel</label>
                    <input
                      type="date"
                      value={formData.rappel_date || ''}
                      onChange={(e) => setFormData({ ...formData, rappel_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Notes du rappel</label>
                    <textarea
                      value={formData.rappel_notes}
                      onChange={(e) => setFormData({ ...formData, rappel_notes: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Raison du rappel, informations importantes..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-teal-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Suivi du financement (non-CPF)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.quote_sent}
                        onChange={(e) => setFormData({ ...formData, quote_sent: e.target.checked, quote_sent_date: e.target.checked ? new Date().toISOString().split('T')[0] : null })}
                        className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Devis envoyé</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date devis envoyé</label>
                    <input
                      type="date"
                      value={formData.quote_sent_date || ''}
                      onChange={(e) => setFormData({ ...formData, quote_sent_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.quote_accepted}
                        onChange={(e) => setFormData({ ...formData, quote_accepted: e.target.checked, quote_accepted_date: e.target.checked ? new Date().toISOString().split('T')[0] : null })}
                        className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Devis accepté</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date devis accepté</label>
                    <input
                      type="date"
                      value={formData.quote_accepted_date || ''}
                      onChange={(e) => setFormData({ ...formData, quote_accepted_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.payment_requested}
                        onChange={(e) => setFormData({ ...formData, payment_requested: e.target.checked, payment_requested_date: e.target.checked ? new Date().toISOString().split('T')[0] : null })}
                        className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Paiement demandé</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date paiement demandé</label>
                    <input
                      type="date"
                      value={formData.payment_requested_date || ''}
                      onChange={(e) => setFormData({ ...formData, payment_requested_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.payment_received}
                        onChange={(e) => setFormData({ ...formData, payment_received: e.target.checked, payment_received_date: e.target.checked ? new Date().toISOString().split('T')[0] : null })}
                        className="w-5 h-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Paiement reçu</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date paiement reçu</label>
                    <input
                      type="date"
                      value={formData.payment_received_date || ''}
                      onChange={(e) => setFormData({ ...formData, payment_received_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Formation & Paiement</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.formation_done}
                        onChange={(e) => setFormData({ ...formData, formation_done: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Formation effectuée</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date fin formation</label>
                    <input
                      type="date"
                      value={formData.formation_end_date || ''}
                      onChange={(e) => setFormData({ ...formData, formation_end_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Date encaissement prévue</label>
                    <input
                      type="date"
                      value={formData.expected_payment_date || ''}
                      onChange={(e) => setFormData({ ...formData, expected_payment_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Montant</label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.paid}
                        onChange={(e) => setFormData({ ...formData, paid: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Payé</span>
                    </label>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.dispute}
                        onChange={(e) => setFormData({ ...formData, dispute: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Litige</span>
                    </label>
                  </div>
                  {formData.dispute && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Raison du litige</label>
                      <textarea
                        value={formData.dispute_reason}
                        onChange={(e) => setFormData({ ...formData, dispute_reason: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-slate-50 rounded-xl p-6 sticky top-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-slate-700" />
                  <h3 className="text-lg font-semibold text-slate-900">Commentaires</h3>
                </div>

                <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                  {comments.map((comment) => {
                    const isOwnComment = comment.profile_id === profile?.id;
                    const authorEmail = comment.author?.email || 'Utilisateur inconnu';
                    const authorRole = comment.author?.role || '';

                    return (
                      <div
                        key={comment.id}
                        className={`flex ${isOwnComment ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] ${isOwnComment ? 'order-2' : 'order-1'}`}>
                          <div className={`rounded-lg p-3 ${
                            isOwnComment
                              ? 'bg-orange-500 text-white'
                              : 'bg-white border border-slate-200'
                          }`}>
                            <div className="flex items-center justify-between mb-1">
                              <p className={`text-xs font-semibold ${
                                isOwnComment ? 'text-orange-100' : 'text-slate-900'
                              }`}>
                                {authorEmail}
                                {authorRole && (
                                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                    isOwnComment
                                      ? 'bg-orange-600'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {authorRole}
                                  </span>
                                )}
                              </p>
                              {isOwnComment && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className="text-orange-100 hover:text-white ml-2"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <p className={`text-sm ${isOwnComment ? 'text-white' : 'text-slate-700'}`}>
                              {comment.comment}
                            </p>
                            <p className={`text-xs mt-1 ${
                              isOwnComment ? 'text-orange-100' : 'text-slate-400'
                            }`}>
                              {new Date(comment.created_at).toLocaleString('fr-FR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {comments.length === 0 && (
                    <p className="text-center text-slate-500 text-sm py-8">Aucun commentaire</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Ajouter un commentaire..."
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={loading || !newComment.trim()}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-semibold"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-lg transition-colors font-semibold flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
