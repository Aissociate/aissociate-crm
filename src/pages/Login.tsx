import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Field, Spinner } from '@/components/ui';

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

  if (session) return <Navigate to="/" replace />;

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
      else setInfo('Compte créé. Vous pouvez maintenant vous connecter.');
      if (!error) setMode('in');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-700 to-brand-900 p-6">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">CRM Formation</h1>
            <p className="text-xs text-slate-400">AIssociate · Qualiopi 814211-1</p>
          </div>
        </div>

        <div className="mb-5 flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <button
            className={`flex-1 rounded-md py-1.5 ${mode === 'in' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            onClick={() => setMode('in')}
          >
            Connexion
          </button>
          <button
            className={`flex-1 rounded-md py-1.5 ${mode === 'up' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
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

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {info && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Spinner className="h-4 w-4 text-white" /> : mode === 'in' ? 'Se connecter' : 'Créer le compte'}
          </Button>
        </form>

        {mode === 'up' && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Le premier compte créé peut être promu administrateur depuis Supabase
            (table <code>profiles</code>, colonne <code>role</code>).
          </p>
        )}
      </div>
    </div>
  );
}
