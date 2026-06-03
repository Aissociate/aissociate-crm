// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Search, Building2, Mail, Phone, User, Calendar, Eye, LogOut, ArrowLeft } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';
import { Dossier, getStatusLabel, getStatusColor } from '../types/dossiers';
import AdminDossierEditor from '../components/AdminDossierEditor';

export default function AdminProspectsSearch() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [filteredDossiers, setFilteredDossiers] = useState<Dossier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);

  useEffect(() => {
    if (!profile) return;

    if (!profile.is_admin) {
      navigate('/dashboard');
      return;
    }

    loadAllDossiers();
  }, [profile, navigate]);

  useEffect(() => {
    filterDossiers();
  }, [searchQuery, dossiers]);

  const loadAllDossiers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dossiers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDossiers(data || []);
    } catch (error) {
      console.error('Error loading dossiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterDossiers = () => {
    if (!searchQuery.trim()) {
      setFilteredDossiers(dossiers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = dossiers.filter(dossier => {
      return (
        dossier.company.toLowerCase().includes(query) ||
        dossier.contact_first_name.toLowerCase().includes(query) ||
        dossier.contact_last_name.toLowerCase().includes(query) ||
        dossier.email.toLowerCase().includes(query) ||
        dossier.phone.includes(query) ||
        dossier.sector.toLowerCase().includes(query)
      );
    });

    setFilteredDossiers(filtered);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <AdminLogo
              src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
              alt="Aissociate Logo"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Recherche de Prospects</h1>
              <p className="text-slate-600">Tous les dossiers - Édition complète</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par entreprise, nom, email, téléphone, secteur..."
              className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-slate-900 placeholder-slate-400"
            />
          </div>
          <p className="text-sm text-slate-600 mt-2">
            {filteredDossiers.length} résultat{filteredDossiers.length > 1 ? 's' : ''} trouvé{filteredDossiers.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Entreprise</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Contact</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Téléphone</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Secteur</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Statut</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Créé le</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDossiers.map((dossier) => (
                  <tr key={dossier.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">{dossier.company}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <div className="text-sm">
                          <p className="font-medium text-slate-900">
                            {dossier.contact_first_name} {dossier.contact_last_name}
                          </p>
                          <p className="text-slate-500 text-xs">{dossier.contact_function}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{dossier.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{dossier.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{dossier.sector}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dossier.status)}`}>
                        {getStatusLabel(dossier.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">
                          {new Date(dossier.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedDossier(dossier)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Éditer
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDossiers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Search className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-slate-500 font-medium">Aucun résultat trouvé</p>
                        {searchQuery && (
                          <p className="text-sm text-slate-400 mt-1">
                            Essayez avec d'autres mots-clés
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedDossier && (
        <AdminDossierEditor
          dossier={selectedDossier}
          onClose={() => setSelectedDossier(null)}
          onUpdate={() => {
            loadAllDossiers();
            setSelectedDossier(null);
          }}
        />
      )}
    </div>
  );
}
