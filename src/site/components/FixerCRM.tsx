// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Phone, Mail, Plus, Edit2, Trash2, Calendar, X, Save } from 'lucide-react';

interface Contact {
  id: string;
  profile_id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  notes: string;
  last_contact_date: string;
  next_action_date: string | null;
  created_at: string;
}

interface FixerCRMProps {
  profileId: string;
}

const STATUS_OPTIONS = [
  { value: 'à_appeler', label: 'À appeler', color: 'bg-slate-100 text-slate-700' },
  { value: 'en_cours', label: 'En cours', color: 'bg-blue-100 text-blue-700' },
  { value: 'rdv_fixé', label: 'RDV fixé', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'rappel_ultérieur', label: 'Rappel ultérieur', color: 'bg-amber-100 text-amber-700' },
  { value: 'non_intéressé', label: 'Non intéressé', color: 'bg-red-100 text-red-700' },
];

export default function FixerCRM({ profileId }: FixerCRMProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    status: 'à_appeler',
    notes: '',
    next_action_date: '',
  });

  useEffect(() => {
    loadContacts();
  }, [profileId]);

  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredContacts(contacts);
    } else {
      setFilteredContacts(contacts.filter(c => c.status === filterStatus));
    }
  }, [contacts, filterStatus]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fixer_contacts')
        .select('*')
        .eq('profile_id', profileId)
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
      if (editingContact) {
        const { error } = await supabase
          .from('fixer_contacts')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingContact.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('fixer_contacts')
          .insert([
            {
              profile_id: profileId,
              ...formData,
              last_contact_date: new Date().toISOString().split('T')[0],
            },
          ]);

        if (error) throw error;
      }

      setFormData({
        name: '',
        phone: '',
        email: '',
        status: 'à_appeler',
        notes: '',
        next_action_date: '',
      });
      setShowAddForm(false);
      setEditingContact(null);
      loadContacts();
    } catch (error) {
      console.error('Error saving contact:', error);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      status: contact.status,
      notes: contact.notes,
      next_action_date: contact.next_action_date || '',
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) return;

    try {
      const { error } = await supabase
        .from('fixer_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingContact(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      status: 'à_appeler',
      notes: '',
      next_action_date: '',
    });
  };

  const getStatusColor = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-slate-100 text-slate-700';
  };

  const getStatusLabel = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Gestion des Contacts</h3>
          <p className="text-slate-600 text-sm mt-1">
            {contacts.length} contact{contacts.length > 1 ? 's' : ''} au total
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg transition-all font-semibold"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Annuler' : 'Nouveau contact'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-lg p-6 mb-6 border-2 border-blue-200">
          <h4 className="font-bold text-lg text-slate-900 mb-4">
            {editingContact ? 'Modifier le contact' : 'Nouveau contact'}
          </h4>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="Nom du contact"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Téléphone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="+33 6 12 34 56 78"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Statut</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Prochaine action</label>
              <input
                type="date"
                value={formData.next_action_date}
                onChange={(e) => setFormData({ ...formData, next_action_date: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-blue-500 focus:outline-none"
                rows={3}
                placeholder="Notes sur le contact..."
              ></textarea>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg transition-all font-semibold"
            >
              <Save className="w-4 h-4" />
              {editingContact ? 'Mettre à jour' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded-lg transition-colors font-semibold"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            filterStatus === 'all'
              ? 'bg-slate-700 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Tous ({contacts.length})
        </button>
        {STATUS_OPTIONS.map(option => (
          <button
            key={option.value}
            onClick={() => setFilterStatus(option.value)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              filterStatus === option.value
                ? option.color.replace('100', '500').replace('700', 'white')
                : `${option.color} hover:opacity-80`
            }`}
          >
            {option.label} ({contacts.filter(c => c.status === option.value).length})
          </button>
        ))}
      </div>

      {filteredContacts.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Phone className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 font-semibold">Aucun contact trouvé</p>
          <p className="text-slate-500 text-sm mt-2">
            {filterStatus === 'all'
              ? 'Commencez par ajouter un nouveau contact'
              : 'Aucun contact avec ce statut'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredContacts.map(contact => (
            <div
              key={contact.id}
              className="border-2 border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-bold text-lg text-slate-900">{contact.name}</h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(contact.status)}`}>
                      {getStatusLabel(contact.status)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-slate-600 mb-2">
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.next_action_date && (
                      <div className="flex items-center gap-2 text-amber-600">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Prochaine action: {new Date(contact.next_action_date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded italic">
                      {contact.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(contact)}
                    className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
