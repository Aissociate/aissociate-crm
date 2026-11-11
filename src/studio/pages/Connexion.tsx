import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { appel, type Me } from '../api';
import { Bouton } from '../composants';
import { useStudioBrut } from '../StudioApp';

const EQUIPE = [
  { p: 'Léa', c: '#f97316' }, { p: 'Hugo', c: '#ec4899' }, { p: 'Sam', c: '#3b82f6' },
  { p: 'Inès', c: '#10b981' }, { p: 'Maël', c: '#8b5cf6' }, { p: 'Nora', c: '#eab308' },
];

export default function Connexion() {
  const { me, connecte } = useStudioBrut();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  if (me) return <Navigate to="/studio" replace />;

  const soumettre = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(''); setEnvoi(true);
    try {
      const r = await appel<Me & { token: string }>('login', { email, password });
      connecte(r.token, r);
      navigate('/studio', { replace: true });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Connexion impossible');
    } finally { setEnvoi(false); }
  };

  return (
    <div className="grid min-h-screen font-sans lg:grid-cols-[1fr_1.1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-neutral-950 p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-orange-500/25 blur-3xl" />
        <p className="relative text-xl font-bold">A(I)ssociate <span className="text-orange-400">Studio</span></p>
        <div className="relative">
          <div className="mb-8 flex -space-x-3">
            {EQUIPE.map((a) => (
              <span key={a.p} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-neutral-950 text-lg font-semibold"
                style={{ background: `linear-gradient(135deg, ${a.c}, ${a.c}aa)` }}>{a.p[0]}</span>
            ))}
          </div>
          <h1 className="text-4xl font-semibold leading-tight">Votre équipe d'agents IA,<br />disponible 24 h/24.</h1>
          <p className="mt-4 max-w-md text-neutral-400">
            Marketing, prospection, contenus, administratif, RH : chaque agent connaît votre entreprise
            et prépare un travail prêt à l'emploi.
          </p>
        </div>
        <p className="relative text-xs text-neutral-500">Un service Aissociate — organisme de formation certifié Qualiopi</p>
      </section>

      <section className="flex items-center justify-center bg-white px-4 py-12">
        <form onSubmit={soumettre} className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-neutral-900">Bienvenue sur votre Studio</h2>
            <p className="mt-2 text-sm text-neutral-500">Connectez-vous avec les identifiants transmis par Aissociate.</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Adresse e-mail</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 focus:bg-white" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Mot de passe</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 focus:bg-white" />
          </label>
          {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
          <Bouton type="submit" disabled={envoi} className="w-full py-2.5">{envoi ? 'Connexion…' : 'Se connecter'}</Bouton>
          <p className="text-center text-xs text-neutral-500">
            Mot de passe oublié ? Écrivez à <a className="underline" href="mailto:contact@aissociate.re">contact@aissociate.re</a>
          </p>
        </form>
      </section>
    </div>
  );
}
