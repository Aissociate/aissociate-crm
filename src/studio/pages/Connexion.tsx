import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { appel, type Me } from '../api';
import { Bouton } from '../composants';
import { useStudioBrut } from '../StudioApp';

const EQUIPE = [
  { id: 'lea', p: 'Léa', c: '#f97316' }, { id: 'hugo', p: 'Hugo', c: '#ec4899' }, { id: 'sam', p: 'Sam', c: '#3b82f6' },
  { id: 'ines', p: 'Inès', c: '#10b981' }, { id: 'mael', p: 'Maël', c: '#8b5cf6' }, { id: 'nora', p: 'Nora', c: '#eab308' },
];

export default function Connexion() {
  const { me, connecte } = useStudioBrut();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  // Mot de passe oublié : même réponse que le compte existe ou non.
  const [oubli, setOubli] = useState<'' | 'saisie' | 'envoye'>('');

  const demanderLien = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(''); setEnvoi(true);
    try { await appel('mdp_oublie', { email }); setOubli('envoye'); }
    catch (err) { setErreur(err instanceof Error ? err.message : 'Envoi impossible'); }
    finally { setEnvoi(false); }
  };

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
              <img key={a.p} src={`/agents-ia/studio/${a.id}.webp`} alt={a.p} width={64} height={64}
                className="h-16 w-16 rounded-full border-2 border-neutral-950 object-cover object-top" style={{ background: a.c }} />
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
        {oubli ? (
          <form onSubmit={demanderLien} className="w-full max-w-sm space-y-5">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-neutral-900">Mot de passe oublié</h2>
              <p className="mt-2 text-sm text-neutral-500">
                {oubli === 'envoye'
                  ? 'Si un compte existe pour cette adresse, un e-mail vient de partir avec un lien valable une heure. Pensez à vérifier les indésirables.'
                  : 'Indiquez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.'}
              </p>
            </div>
            {oubli === 'saisie' && (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-neutral-700">Adresse e-mail</span>
                  <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 focus:bg-white" />
                </label>
                {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
                <Bouton type="submit" disabled={envoi} className="w-full py-2.5">{envoi ? 'Envoi…' : 'Recevoir le lien'}</Bouton>
              </>
            )}
            <p className="text-center text-xs text-neutral-500">
              <button type="button" className="underline" onClick={() => { setOubli(''); setErreur(''); }}>Retour à la connexion</button>
            </p>
          </form>
        ) : (
        <form onSubmit={soumettre} className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-neutral-900">Bienvenue sur votre Studio</h2>
            <p className="mt-2 text-sm text-neutral-500">Connectez-vous avec les identifiants reçus par e-mail.</p>
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
            <button type="button" className="underline" onClick={() => { setOubli('saisie'); setErreur(''); }}>Mot de passe oublié ?</button>
          </p>
          <p className="border-t border-neutral-100 pt-4 text-center text-sm text-neutral-600">
            Pas encore de compte ? <a className="font-medium text-orange-600 underline" href="/studio/demarrer">Essayer gratuitement 7 jours</a>
          </p>
        </form>
        )}
      </section>
    </div>
  );
}
