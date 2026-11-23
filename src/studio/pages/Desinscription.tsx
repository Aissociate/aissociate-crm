// Page publique de désinscription (lien en pied de chaque mailing).
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { appel } from '../api';

export default function Desinscription() {
  const { jeton } = useParams();
  const [etat, setEtat] = useState<{ ok: boolean; texte: string } | null>(null);

  useEffect(() => {
    appel<{ entreprise: string }>('desinscription', { jeton })
      .then((r) => setEtat({ ok: true, texte: `Vous ne recevrez plus les e-mails de ${r.entreprise || 'cette entreprise'}.` }))
      .catch((e) => setEtat({ ok: false, texte: e instanceof Error ? e.message : 'Lien invalide.' }));
  }, [jeton]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F2ECE4] p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">{!etat ? 'Désinscription…' : etat.ok ? 'Désinscription confirmée' : 'Désinscription impossible'}</h1>
        {etat && <p className="mt-2 text-sm text-neutral-600">{etat.texte}</p>}
      </div>
    </div>
  );
}
