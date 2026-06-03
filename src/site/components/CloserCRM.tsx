// @ts-nocheck
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Phone, Mail, Plus, Edit2, Trash2, Calendar, Building2, TrendingUp, X, Save, DollarSign } from 'lucide-react';

interface Lead {
  id: string;
  profile_id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  status: string;
  estimated_value: number;
  closing_probability: number;
  notes: string;
  last_contact_date: string;
  expected_close_date: string | null;
  created_at: string;
}

interface CloserCRMProps {
  profileId: string;
}

const STATUS_OPTIONS = [
  { value: 'nouveau', label: 'Nouveau', color: 'bg-blue-100 text-blue-700' },
  { value: 'contacté', label: 'Contacté', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'négociation', label: 'Négociation', color: 'bg-amber-100 text-amber-700' },
  { value: 'gagné', label: 'Gagné', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'perdu', label: 'Perdu', color: 'bg-red-100 text-red-700' },
];

export default function CloserCRM({ profileId }: CloserCRMProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    status: 'nouveau',
    estimated_value: '',
    closing_probability: '50',
    notes: '',
    expected_close_date: '',
  });

  useEffect(() => {
    loadLeads();
  }, [profileId]);

  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredLeads(leads);
    } else {
      setFilteredLeads(leads.filter(l => l.status === filterStatus));
    }
  }, [leads, filterStatus]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('closer_leads')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        company: formData.company,
        status: formData.status,
        estimated_value: parseFloat(formData.estimated_value) || 0,
        closing_probability: parseInt(formData.closing_probability) || 50,
        notes: formData.notes,
        expected_close_date: formData.expected_close_date || null,
      };

      if (editingLead) {
        const { error } = await supabase
          .from('closer_leads')
          .update({
            ...dataToSave,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingLead.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('closer_leads')
          .insert([
            {
              profile_id: profileId,
              ...dataToSave,
              last_contact_date: new Date().toISOString().split('T')[0],
            },
          ]);

        if (error) throw error;
      }

      setFormData({
        name: '',
        phone: '',
        email: '',
        company: '',
        status: 'nouveau',
        estimated_value: '',
        closing_probability: '50',
        notes: '',
        expected_close_date: '',
      });
      setShowAddForm(false);
      setEditingLead(null);
      loadLeads();
    } catch (error) {
      console.error('Error saving lead:', error);
    }
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      company: lead.company,
      status: lead.status,
      estimated_value: lead.estimated_value.toString(),
      closing_probability: lead.closing_probability.toString(),
      notes: lead.notes,
      expected_close_date: lead.expected_close_date || '',
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce lead ?')) return;

    try {
      const { error } = await supabase
        .from('closer_leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingLead(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      company: '',
      status: 'nouveau',
      estimated_value: '',
      closing_probability: '50',
      notes: '',
      expected_close_date: '',
    });
  };

  const getStatusColor = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-slate-100 text-slate-700';
  };

  const getStatusLabel = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
  };

  const calculateTotalPipeline = () => {
    return leads
      .filter(l => l.status !== 'perdu' && l.status !== 'gagné')
      .reduce((sum, lead) => sum + lead.estimated_value * (lead.closing_probability / 100), 0)
      .toFixed(0);
  };

  const calculateWonValue = () => {
    return leads
      .filter(l => l.status === 'gagné')
      .reduce((sum, lead) => sum + lead.estimated_value, 0)
      .toFixed(0);
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
          <h3 className="text-2xl font-bold text-slate-900">Pipeline Commercial</h3>
          <div className="flex gap-4 text-sm mt-2">
            <p className="text-slate-600">
              {leads.length} lead{leads.length > 1 ? 's' : ''} au total
            </p>
            <p className="text-emerald-600 font-semibold">
              Pipeline: {calculateTotalPipeline()}€
            </p>
            <p className="text-blue-600 font-semibold">
              Gagné: {calculateWonValue()}€
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg transition-all font-semibold"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Annuler' : 'Nouveau lead'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-lg p-6 mb-6 border-2 border-emerald-200">
          <h4 className="font-bold text-lg text-slate-900 mb-4">
            {editingLead ? 'Modifier le lead' : 'Nouveau lead'}
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
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                placeholder="Nom du prospect"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Entreprise</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                placeholder="Nom de l'entreprise"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Téléphone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                placeholder="+33 6 12 34 56 78"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Statut</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Valeur estimée (€)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={formData.estimated_value}
                onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                placeholder="5000"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Probabilité de closing ({formData.closing_probability}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={formData.closing_probability}
                onChange={(e) => setFormData({ ...formData, closing_probability: e.target.value })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Date de closing prévue</label>
              <input
                type="date"
                value={formData.expected_close_date}
                onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border-2 border-slate-300 rounded-lg focus:border-emerald-500 focus:outline-none"
                rows={3}
                placeholder="Notes sur le lead..."
              ></textarea>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg transition-all font-semibold"
            >
              <Save className="w-4 h-4" />
              {editingLead ? 'Mettre à jour' : 'Enregistrer'}
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
          Tous ({leads.length})
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
            {option.label} ({leads.filter(l => l.status === option.value).length})
          </button>
        ))}
      </div>

      {filteredLeads.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <TrendingUp className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 font-semibold">Aucun lead trouvé</p>
          <p className="text-slate-500 text-sm mt-2">
            {filterStatus === 'all'
              ? 'Commencez par ajouter un nouveau lead'
              : 'Aucun lead avec ce statut'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredLeads.map(lead => (
            <div
              key={lead.id}
              className="border-2 border-slate-200 rounded-lg p-4 hover:border-emerald-300 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-bold text-lg text-slate-900">{lead.name}</h4>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(lead.status)}`}>
                      {getStatusLabel(lead.status)}
                    </span>
                  </div>
                  {lead.company && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                      <Building2 className="w-4 h-4" />
                      <span className="font-semibold">{lead.company}</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1 text-sm text-slate-600 mb-2">
                    {lead.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        <a href={`tel:${lead.phone}`} className="hover:text-emerald-600">
                          {lead.phone}
                        </a>
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${lead.email}`} className="hover:text-emerald-600">
                          {lead.email}
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm mb-2">
                    <div className="flex items-center gap-2 text-blue-600 font-semibold">
                      <DollarSign className="w-4 h-4" />
                      <span>{lead.estimated_value}€</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                      <TrendingUp className="w-4 h-4" />
                      <span>{lead.closing_probability}% de chance</span>
                    </div>
                  </div>
                  {lead.expected_close_date && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 mb-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Closing prévu: {new Date(lead.expected_close_date).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}
                  {lead.notes && (
                    <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded italic">
                      {lead.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(lead)}
                    className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(lead.id)}
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
