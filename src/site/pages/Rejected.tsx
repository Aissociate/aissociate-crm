// @ts-nocheck
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { XCircle, LogOut } from 'lucide-react';
import AdminLogo from '../components/AdminLogo';

export default function Rejected() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center relative">
          <button
            onClick={handleSignOut}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Se déconnecter"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <AdminLogo
            src="https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg"
            alt="Aissociate Logo"
            className="h-16 w-auto object-contain mx-auto mb-6"
          />

          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            Candidature non retenue
          </h1>

          <p className="text-lg text-slate-600 mb-8">
            Nous vous remercions de l'intérêt que vous portez à Aissociate.
            Malheureusement, votre candidature n'a pas été retenue pour le moment.
          </p>

          <div className="bg-slate-50 rounded-xl p-6 mb-8 text-left">
            <h2 className="font-semibold text-slate-900 mb-3">Prochaines étapes</h2>
            <ul className="space-y-2 text-slate-700">
              <li>• Nous conservons votre dossier dans notre base de données</li>
              <li>• Vous pourrez postuler à nouveau dans 3 mois</li>
              <li>• N'hésitez pas à améliorer vos compétences en attendant</li>
            </ul>
          </div>

          <button
            onClick={handleSignOut}
            className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-8 py-3 rounded-lg font-semibold transition-all"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
