// Page publique /studio/mot-de-passe/:jeton : choix d'un nouveau mot de passe depuis le lien
// reçu par e-mail (« Mot de passe oublié ? » sur la page de connexion). Lien à usage unique, une heure.
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { appel } from '../api';
import { Bouton } from '../composants';
import { Logo } from '@/components/Logo';

const champ = 'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 focus:bg-white';

export default function Reinitialiser() {
  const { jeton } = useParams();
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(false);

  const soumettre = async (e: FormEvent) => {
    e.preventDefault();
    setErreur('');
    if (nouveau !== confirmation) { setErreur('Les deux mots de passe ne correspondent pas.'); return; }
    setEnvoi(true);
    try { await appel('mdp_reinitialiser', { jeton, nouveau }); setFait(true); }
    catch (err) { setErreur(err instanceof Error ? err.message : 'Enregistrement impossible'); }
    finally { setEnvoi(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F2ECE4] px-4 font-sans text-neutral-900">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8">
        <Logo size="sm" branche="Studio IA" fond="clair" className="mb-6" />
        {fait ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" /></div>
            <h1 className="text-xl font-semibold">Mot de passe enregistré</h1>
            <p className="mt-2 text-sm text-neutral-600">Vous pouvez vous connecter avec votre nouveau mot de passe. Vos autres appareils ont été déconnectés.</p>
            <Link to="/studio/connexion" className="mt-6 inline-block rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Se connecter</Link>
          </div>
        ) : (
          <form onSubmit={soumettre} className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold">Choisissez un nouveau mot de passe</h1>
              <p className="mt-1 text-sm text-neutral-500">10 caractères minimum, avec au moins une lettre et un chiffre.</p>
            </div>
            <label className="block"><span className="mb-1 block text-sm text-neutral-700">Nouveau mot de passe</span>
              <input type="password" required minLength={10} autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} className={champ} /></label>
            <label className="block"><span className="mb-1 block text-sm text-neutral-700">Confirmer</span>
              <input type="password" required autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={champ} /></label>
            {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
            <Bouton type="submit" disabled={envoi} className="w-full py-2.5">{envoi ? 'Enregistrement…' : 'Enregistrer le mot de passe'}</Bouton>
            <p className="text-center text-xs text-neutral-500"><Link to="/studio/connexion" className="underline">Retour à la connexion</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
