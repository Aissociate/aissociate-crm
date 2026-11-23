// Première connexion (ou CGV modifiées) : lecture et acceptation des conditions générales de
// vente et de l'accord de traitement des données (RGPD). Rien d'autre n'est accessible avant.
import { useEffect, useState } from 'react';
import { FileText, LogOut } from 'lucide-react';
import { appel } from '../api';
import { Bouton, Carte, Chargement, Markdown, cx } from '../composants';
import { Logo } from '@/components/Logo';

type Textes = { version: string | null; documents: { titre: string; contenu: string }[] };

export default function AccepterCgv({ onAccepte, onDeconnexion, gerer }: {
  onAccepte: () => Promise<void>; onDeconnexion: () => void; gerer: (e: unknown) => string;
}) {
  const [t, setT] = useState<Textes | null>(null);
  const [onglet, setOnglet] = useState(0);
  const [lu, setLu] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => { appel<Textes>('cgv').then(setT).catch((e) => setErreur(gerer(e))); }, [gerer]);

  const accepter = async () => {
    if (!t?.version) return;
    setEnvoi(true); setErreur('');
    try { await appel('cgv_accepter', { version: t.version }); await onAccepte(); }
    catch (e) { setErreur(gerer(e)); setEnvoi(false); }
  };

  return (
    <div className="min-h-screen bg-[#F2ECE4] px-4 py-8 font-sans text-neutral-900 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Logo size="sm" branche="Studio IA" fond="clair" />
            <h1 className="mt-3 text-2xl font-semibold">Avant de commencer</h1>
            <p className="mt-1 text-sm text-neutral-600">Merci de lire et d'accepter nos conditions générales de vente et notre accord de traitement des données personnelles.</p>
          </div>
          <button onClick={onDeconnexion} className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
        {!t ? (erreur ? <p className="text-sm text-red-700">{erreur}</p> : <Chargement />) : (
          <Carte className="p-0">
            <div className="flex flex-wrap gap-1 border-b border-neutral-100 p-2">
              {t.documents.map((d, i) => (
                <button key={i} onClick={() => setOnglet(i)}
                  className={cx('flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm', i === onglet ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100')}>
                  <FileText className="h-4 w-4 shrink-0" /> {d.titre}
                </button>
              ))}
            </div>
            <div className="max-h-[55vh] overflow-y-auto px-5 py-4 text-sm leading-relaxed">
              {t.documents[onglet] && <Markdown texte={t.documents[onglet].contenu} />}
            </div>
            <div className="space-y-3 border-t border-neutral-100 p-4">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={lu} onChange={(e) => setLu(e.target.checked)} />
                <span>J'ai lu et j'accepte, pour le compte de mon entreprise, {t.documents.map((d) => `« ${d.titre} »`).join(' et ')}.</span>
              </label>
              {erreur && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
              <Bouton variante="noir" disabled={!lu || envoi || !t.version} onClick={accepter}>{envoi ? 'Enregistrement…' : 'Accepter et accéder à mon Studio'}</Bouton>
              <p className="text-xs text-neutral-500">Votre acceptation est horodatée et conservée. Ces documents restent consultables sur demande à contact@aissociate.re.</p>
            </div>
          </Carte>
        )}
      </div>
    </div>
  );
}
