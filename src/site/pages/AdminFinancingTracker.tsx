// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';
import FinancingTracker from '../components/FinancingTracker';

export default function AdminFinancingTracker() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-slate-700" />
            </button>
            <AdminLogo />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">Suivi des Financements</h1>
              <p className="text-sm text-slate-600">Gestion des dossiers avec financement non-CPF</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Suivi des étapes de financement</h2>
                <p className="text-sm text-slate-600">
                  Gérez le workflow de financement pour les dossiers OPCO, Pôle Emploi, Employeur, etc.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600 mb-1">Devis envoyé</p>
                <p className="text-xs text-slate-500">Envoi du devis au financeur</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600 mb-1">Devis accepté</p>
                <p className="text-xs text-slate-500">Validation par le financeur</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600 mb-1">Paiement demandé</p>
                <p className="text-xs text-slate-500">Demande de paiement envoyée</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600 mb-1">Paiement reçu</p>
                <p className="text-xs text-slate-500">Encaissement confirmé</p>
              </div>
            </div>
          </div>
        </div>

        <FinancingTracker showOnlyAlerts={false} />
      </main>
    </div>
  );
}
