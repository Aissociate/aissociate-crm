// Page publique /studio/connecter/:jeton — ouverte depuis l'e-mail « connectez votre application ».
// L'espace vient de l'invitation (côté serveur) ; la page redirige vers la connexion Zernio,
// qui revient ici avec ?retour=1 et le résultat.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Lock, Plug } from 'lucide-react';
import { appel } from '../api';
import { Bouton, Chargement } from '../composants';
import { Logo } from '@/components/Logo';

type Invitation = { lien: string; espace: string; application: string | null };

export default function ConnecterInvitation() {
  const { jeton } = useParams();
  const [p] = useState(() => new URLSearchParams(window.location.search));
  const retour = p.get('retour') === '1';
  const echec = retour && (p.get('error') || p.get('status') === 'error');
  const [inv, setInv] = useState<Invitation | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    document.title = 'Connecter une application — Studio IA Aissociate';
    if (retour && !echec) return;
    appel<Invitation>('invitation_ouvrir', { jeton }).then(setInv).catch((e) => setErreur(e instanceof Error ? e.message : 'Lien invalide'));
  }, [jeton, retour, echec]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F2ECE4] px-4 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <Logo size="sm" branche="Studio IA" fond="clair" />
        {retour && !echec ? (
          <>
            <span className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-6 w-6" /></span>
            <h1 className="mt-4 text-xl font-semibold">Connexion effectuée</h1>
            <p className="mt-2 text-sm text-neutral-500">
              {p.get('missing_permissions')
                ? `Certains accès n'ont pas été accordés (${p.get('missing_permissions')}). Rouvrez le lien reçu pour reconnecter le compte en cochant tout.`
                : 'Merci ! Vous pouvez fermer cette page. Rien ne sera envoyé ni publié sans validation.'}
            </p>
          </>
        ) : (
          <>
            {!inv && !erreur && <Chargement />}
            {echec && <p className="mt-6 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-800">La connexion n'a pas abouti{p.get('error_message') ? ` : ${p.get('error_message')}` : ''}. Vous pouvez réessayer.</p>}
            {erreur && <p className="mt-6 rounded-xl bg-red-50 px-3 py-3 text-sm text-red-700">{erreur}</p>}
            {inv && (
              <>
                <span className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Plug className="h-6 w-6" /></span>
                <h1 className="mt-4 text-xl font-semibold">
                  Connecter {inv.application ?? 'votre messagerie'} à l'espace « {inv.espace} »
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
          </>
        )}
      </div>
    </div>
  );
}
