// @ts-nocheck
import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, User, Phone, Mail, X, Save } from 'lucide-react';
import { RelatedContact, CONTACT_STATUSES } from '../../types/dossiers';
import { supabase } from '../../lib/supabase';

interface RelatedContactsManagerProps {
  dossierId: string;
}

export default function RelatedContactsManager({ dossierId }: RelatedContactsManagerProps) {
  const [contacts, setContacts] = useState<RelatedContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<RelatedContact | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    function: '',
    phone: '',
    email: '',
    relationship: '',
    notes: '',
    status: 'à_contacter',
  });

  useEffect(() => {
    loadContacts();
  }, [dossierId]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('related_contacts')
        .select('*')
        .eq('dossier_id', dossierId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      if (editingContact) {
        const { error } = await supabase
          .from('related_contacts')
          .update(formData)
          .eq('id', editingContact.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('related_contacts')
          .insert([{
            ...formData,
            dossier_id: dossierId,
            created_by: user.id,
          }]);

        if (error) throw error;
      }

      resetForm();
      loadContacts();
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleEdit = (contact: RelatedContact) => {
    setEditingContact(contact);
    setFormData({
      first_name: contact.first_name,
      last_name: contact.last_name,
      function: contact.function,
      phone: contact.phone,
      email: contact.email,
      relationship: contact.relationship,
      notes: contact.notes,
      status: contact.status,
    });
    setShowForm(true);
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) return;

    try {
      const { error } = await supabase
        .from('related_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;
      loadContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      function: '',
      phone: '',
      email: '',
      relationship: '',
      notes: '',
      status: 'à_contacter',
    });
    setEditingContact(null);
    setShowForm(false);
  };

  return (
    <div className="bg-white rounded-lg border-2 border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-lg text-slate-900 flex items-center gap-2">
          <User className="w-5 h-5" />
          Contacts associés
        </h4>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg text-sm font-semibold transition-all"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-center py-4">Chargement...</p>
      ) : contacts.length === 0 ? (
        <p className="text-slate-500 text-center py-4">
          Aucun contact associé. Ajoutez des prospects en relation avec ce chef d'entreprise.
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map(contact => (
            <div key={contact.id} className="bg-slate-50 rounded-lg p-3 flex items-start justify-between">
              <div className="flex-1">
                <p className="font-semibold text-slate-900">
                  {contact.first_name} {contact.last_name}
                </p>
                {contact.function && (
                  <p className="text-sm text-slate-600">{contact.function}</p>
                )}
                {contact.relationship && (
                  <p className="text-xs text-slate-500">Relation: {contact.relationship}</p>
                )}
                <div className="flex gap-4 mt-2 text-xs text-slate-600">
                  {contact.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {contact.phone}
                    </span>
                  )}
                  {contact.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {contact.email}
                    </span>
                  )}
                </div>
                {contact.notes && (
                  <p className="text-xs text-slate-500 mt-1">{contact.notes}</p>
                )}
                <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                  {CONTACT_STATUSES.find(s => s.value === contact.status)?.label || contact.status}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(contact)}
                  className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  onClick={() => handleDelete(contact.id)}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b-2 border-slate-200 p-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">
                {editingContact ? 'Modifier le contact' : 'Nouveau contact'}
              </h3>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Prénom <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Nom</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Fonction</label>
                  <input
                    type="text"
                    value={formData.function}
                    onChange={(e) => setFormData({ ...formData, function: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Relation</label>
                  <input
                    type="text"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    placeholder="Collègue, Associé, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Téléphone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Statut</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    {CONTACT_STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    rows={3}
                  ></textarea>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t-2 border-slate-200">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all font-semibold"
                >
                  <Save className="w-5 h-5" />
                  {editingContact ? 'Mettre à jour' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg transition-colors font-semibold"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
