// @ts-nocheck
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, CheckCircle } from 'lucide-react';

export default function CreateAdmin() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const createAdmin = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { data: existingUser } = await supabase.auth.signInWithPassword({
        email: 'admin@admin.com',
        password: 'admin123',
      });

      if (existingUser.user) {
        setSuccess(true);
        setLoading(false);
        return;
      }
    } catch (err) {
      // User doesn't exist, create it
    }

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: 'admin@admin.com',
        password: 'admin123',
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Failed to create admin user');
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: 'admin@admin.com',
        role: 'closer',
        status: 'active',
        is_admin: true,
        experience: 'expert',
        availability: 'full-time',
        motivation: 'Admin account',
        framework_accepted_at: new Date().toISOString(),
        training_completed_at: new Date().toISOString(),
        validated_at: new Date().toISOString(),
        activated_at: new Date().toISOString(),
      });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
            <Shield className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Créer un compte admin
          </h1>
          <p className="text-slate-600">
            Email: admin@admin.com<br />
            Mot de passe: admin123
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span>Compte admin créé avec succès!</span>
          </div>
        )}

        <button
          onClick={createAdmin}
          disabled={loading || success}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Création en cours...' : success ? 'Admin créé' : 'Créer le compte admin'}
        </button>

        {success && (
          <a
            href="/onboarding"
            className="mt-4 block text-center text-orange-600 hover:text-orange-700 font-medium"
          >
            Aller à la page de connexion
          </a>
        )}
      </div>
    </div>
  );
}
