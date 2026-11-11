import { useState, type FormEvent } from 'react';
import { useStudio } from '../StudioApp';
import { appel } from '../api';
import { Bouton, Carte, Titre } from '../composants';

/** Changement de mot de passe. Imposé à la 1re connexion (mot de passe provisoire transmis par Aissociate). */
export default function Compte({ premiereConnexion = false }: { premiereConnexion?: boolean }) {
  const { me, gerer, rafraichir, deconnexion } = useStudio();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [ok, setOk] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const soumettre = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(''); setOk(false);
    if (nouveau !== confirmation) { setErreur('Les deux mots de passe ne correspondent pas.'); return; }
    setEnvoi(true);
    try {
      await appel('change_password', { ancien, nouveau });
      setOk(true); setAncien(''); setNouveau(''); setConfirmation('');
      await rafraichir();
    } catch (err) { setErreur(gerer(err)); } finally { setEnvoi(false); }
  };

  const champ = 'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-neutral-900 focus:bg-white';
  const formulaire = (
    <form onSubmit={soumettre} className="space-y-4">
      <label className="block"><span className="mb-1 block text-sm text-neutral-700">{premiereConnexion ? 'Mot de passe provisoire' : 'Mot de passe actuel'}</span>
        <input type="password" required autoComplete="current-password" value={ancien} onChange={(e) => setAncien(e.target.value)} className={champ} /></label>
      <label className="block"><span className="mb-1 block text-sm text-neutral-700">Nouveau mot de passe</span>
        <input type="password" required minLength={10} autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} className={champ} />
        <span className="mt-1 block text-xs text-neutral-500">10 caractères minimum, avec au moins une lettre et un chiffre.</span></label>
      <label className="block"><span className="mb-1 block text-sm text-neutral-700">Confirmer</span>
        <input type="password" required autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={champ} /></label>
      {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{erreur}</p>}
      {ok && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Mot de passe modifié. Vos autres appareils ont été déconnectés.</p>}
      <Bouton type="submit" disabled={envoi}>{envoi ? 'Enregistrement…' : 'Changer le mot de passe'}</Bouton>
    </form>
  );

  if (premiereConnexion) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f4] px-4 font-sans">
        <Carte className="w-full max-w-md p-8">
          <h1 className="text-xl font-semibold">Bienvenue {me.user.prenom ?? ''} !</h1>
          <p className="mb-6 mt-1 text-sm text-neutral-500">Choisissez votre mot de passe personnel pour accéder à votre Studio.</p>
          {formulaire}
          <button onClick={deconnexion} className="mt-4 text-xs text-neutral-500 underline">Se déconnecter</button>
        </Carte>
      </div>
    );
  }

  return (
    <>
      <Titre sous={me.user.email}>Mon compte</Titre>
      <Carte className="max-w-lg">{formulaire}</Carte>
    </>
  );
}
