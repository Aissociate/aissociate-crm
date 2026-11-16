// Page publique /studio/connecter/:jeton — ouverte depuis l'e-mail « connectez votre application ».
// L'espace vient de l'invitation (côté serveur) ; la page ne fait que rediriger vers Nango.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Lock, Plug } from 'lucide-react';
import { appel } from '../api';
import { Bouton, Chargement } from '../composants';

type Invitation = { lien: string; espace: string; application: string | null };

export default function ConnecterInvitation() {
  const { jeton } = useParams();
  const [inv, setInv] = useState<Invitation | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    document.title = 'Connecter une application — Studio IA Aissociate';
    appel<Invitation>('invitation_ouvrir', { jeton }).then(setInv).catch((e) => setErreur(e instanceof Error ? e.message : 'Lien invalide'));
  }, [jeton]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f6f4] px-4 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-bold">A(I)ssociate <span className="text-orange-500">Studio</span></p>
        {!inv && !erreur && <Chargement />}
        {erreur && <p className="mt-6 rounded-xl bg-red-50 px-3 py-3 text-sm text-red-700">{erreur}</p>}
        {inv && (
          <>
            <span className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Plug className="h-6 w-6" /></span>
            <h1 className="mt-4 text-xl font-semibold">
              Connecter {inv.application ?? 'vos applications'} à l'espace « {inv.espace} »
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Vous allez être redirigé vers une page sécurisée pour autoriser l'accès. Les agents IA prépareront ensuite
              leur travail dans cet outil ; rien n'est envoyé ni publié sans validation.
            </p>
            <Bouton className="mt-6 w-full py-2.5" onClick={() => { window.location.href = inv.lien; }}>Continuer vers la connexion sécurisée</Bouton>
            <p className="mt-4 flex items-center justify-center gap-1 text-xs text-neutral-400">
              <Lock className="h-3 w-3" /> Vos identifiants ne sont jamais transmis à Aissociate.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
