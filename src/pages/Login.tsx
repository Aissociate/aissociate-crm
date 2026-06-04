import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Field, Spinner } from '@/components/ui';
import { Logo } from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';

export default function Login() {
  const { session, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/dashboard" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    if (mode === 'in') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email, password, { nom, prenom });
      if (error) setError(error);
      else setInfo('Votre compte a été créé. Un administrateur doit l\'approuver avant que vous puissiez accéder au back-office. Vous serez notifié.');
      if (!error) setMode('in');
    }
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-app p-6">
      {/* Halo décoratif aux couleurs de la marque */}
      <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="absolute right-4 top-4"><ThemeToggle /></div>

      <div className="card relative w-full max-w-md p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size="lg" tagline />
          <p className="mt-4 text-sm text-muted">CRM de gestion des dossiers de formation</p>
        </div>

        <div className="mb-5 flex rounded-lg bg-surface-2 p-1 text-sm font-medium">
          <button
            className={`flex-1 rounded-md py-1.5 transition ${mode === 'in' ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}
            onClick={() => setMode('in')}
          >
            Connexion
          </button>
          <button
            className={`flex-1 rounded-md py-1.5 transition ${mode === 'up' ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}
            onClick={() => setMode('up')}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'up' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom">
                <input className="input" value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
              </Field>
              <Field label="Nom">
                <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} required />
              </Field>
            </div>
          )}
          <Field label="E-mail">
            <input
              type="email" className="input" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
            />
          </Field>
          <Field label="Mot de passe">
            <input
              type="password" className="input" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={6}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            />
          </Field>

          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {info && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">{info}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Spinner className="h-4 w-4 text-white" /> : mode === 'in' ? 'Se connecter' : 'Créer le compte'}
          </Button>
        </form>

        {mode === 'up' && (
          <p className="mt-4 text-center text-xs text-muted">
            Votre compte sera actif après validation par un administrateur ou directeur commercial.
          </p>
        )}
      </div>
    </div>
  );
}
