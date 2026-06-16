import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Field, Spinner } from '@/components/ui';
import { Logo } from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase redirige vers /reset-password#access_token=...&type=recovery
  // onAuthStateChange émet PASSWORD_RECOVERY quand le token est valide.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // Si la session est déjà établie (rechargement de page), on autorise aussi.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setInfo('Mot de passe mis à jour. Redirection...');
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    }
  };

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-app p-6">
      <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="absolute right-4 top-4"><ThemeToggle /></div>

      <div className="card relative w-full max-w-md p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size="lg" tagline />
          <p className="mt-4 text-sm text-muted">CRM de gestion des dossiers de formation</p>
        </div>

        <div className="mb-5">
          <h2 className="text-base font-semibold text-fg">Nouveau mot de passe</h2>
          <p className="mt-1 text-sm text-muted">Choisissez un mot de passe d'au moins 6 caractères.</p>
        </div>

        {!ready && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            Lien de réinitialisation en cours de validation...
          </p>
        )}

        {ready && (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nouveau mot de passe">
              <input
                type="password" className="input" value={password}
                onChange={(e) => setPassword(e.target.value)}
                required minLength={6} autoComplete="new-password"
              />
            </Field>
            <Field label="Confirmer le mot de passe">
              <input
                type="password" className="input" value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required minLength={6} autoComplete="new-password"
              />
            </Field>

            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            {info && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">{info}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Spinner className="h-4 w-4 text-white" /> : 'Enregistrer le mot de passe'}
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-muted">
          <button
            className="underline hover:text-fg transition-colors"
            onClick={() => navigate('/login', { replace: true })}
          >
            Retour à la connexion
          </button>
        </p>
      </div>
    </div>
  );
}
