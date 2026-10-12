// Enregistrement d'une conversation depuis le poste de commande (mode avancé) :
// micro de l'ordinateur ou fichier audio importé (appel WhatsApp enregistré,
// mémo vocal…). Une fois transcrite, la conversation est confiée à l'assistant
// IA, qui propose les suites à valider.
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Pause, Play, Upload, X, TriangleAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDuree } from '@/lib/audioRecorder';
import { traiterConversation, messageAnalyseConversation } from '@/lib/conversation';
import { useCaptureConversation } from '@/hooks/useCaptureConversation';
import { Button, SearchSelect, type SearchOption } from '@/components/ui';
import { cn, fullName } from '@/lib/utils';

type Etape = 'preparation' | 'enregistrement' | 'finalisation' | 'traitement';

export default function CaptureConversation({ onAnalyse, onFermer }: {
  /** Message à envoyer à l'assistant une fois la conversation transcrite. */
  onAnalyse: (message: string) => void;
  onFermer: () => void;
}) {
  const capture = useCaptureConversation();
  const { secondes, niveau, enPause, erreur, setErreur } = capture;
  const [etape, setEtape] = useState<Etape>('preparation');
  const [contacts, setContacts] = useState<SearchOption[]>([]);
  const [contactId, setContactId] = useState('');
  const fichierRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void supabase.from('contacts').select('id, nom, prenom, telephone, email')
      .order('updated_at', { ascending: false }).limit(3000)
      .then(({ data }) => setContacts((data ?? []).map((c) => ({
        value: c.id, label: fullName(c.prenom, c.nom), sub: c.telephone ?? c.email ?? undefined,
      }))));
  }, []);

  const interlocuteur = contacts.find((c) => c.value === contactId) ?? null;
  const ouverture = () => ({
    contactId: contactId || null,
    telephone: interlocuteur?.sub ?? '',
    titre: interlocuteur?.label ?? `Conversation du ${new Date().toLocaleDateString('fr-FR')}`,
  });

  /** Transcription + compte-rendu, puis passage de relais à l'assistant. */
  const traiter = async (id: string) => {
    setEtape('traitement');
    const { conversation, erreur: echec } = await traiterConversation(id);
    if (!conversation || conversation.statut !== 'traitee') {
      setErreur(echec ?? 'Le traitement a échoué. L\'audio est conservé (Capture mobile › Dernières captures).');
      setEtape('preparation');
      return;
    }
    onAnalyse(messageAnalyseConversation(id, interlocuteur?.label ?? null));
    onFermer();
  };

  const demarrer = async () => {
    const id = await capture.demarrer(ouverture());
    if (id) setEtape('enregistrement');
  };

  const terminer = async () => {
    setEtape('finalisation');
    const id = await capture.terminer();
    if (id) await traiter(id); else setEtape('preparation');
  };

  const importer = async (fichier: File | undefined) => {
    if (!fichier) return;
    setEtape('finalisation');
    const id = await capture.importer(fichier, ouverture());
    if (id) await traiter(id); else setEtape('preparation');
  };

  const occupe = etape !== 'preparation';

  return (
    <div className="mx-auto mb-3 w-full max-w-3xl rounded-2xl border border-brand-500/30 bg-surface p-4 shadow-lg shadow-brand-500/5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-fg">Conversation enregistrée</p>
          <p className="text-xs text-muted">
            Transcrite puis analysée par l'IA, qui vous propose les actions à valider. Prévenez votre interlocuteur que l'échange est enregistré.
          </p>
        </div>
        {!occupe && (
          <button onClick={onFermer} title="Fermer" className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {erreur && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 p-2.5 text-sm text-red-600 dark:text-red-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {erreur}
        </p>
      )}

      {etape === 'preparation' && (
        <>
          <div className="mt-3">
            <SearchSelect
              value={contactId} onChange={setContactId} options={contacts}
              placeholder="Interlocuteur (facultatif — l'IA peut aussi le retrouver)" emptyLabel="Aucun contact lié"
            />
            <p className="mt-1 text-xs text-muted">
              {contactId
                ? 'Le compte-rendu sera ajouté à sa fiche.'
                : 'Sans contact lié, aucun compte-rendu n\'est ajouté automatiquement : l\'IA le proposera.'}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void demarrer()}><Mic className="h-4 w-4" /> Enregistrer au micro</Button>
            <Button variant="secondary" onClick={() => fichierRef.current?.click()}>
              <Upload className="h-4 w-4" /> Importer un audio
            </Button>
            <input
              ref={fichierRef} type="file" accept="audio/*,.opus,.m4a,.mp3,.ogg,.wav,.webm" className="hidden"
              onChange={(e) => { void importer(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Appel WhatsApp : sur ordinateur, mettez l'appel en haut-parleur près du micro, ou importez l'enregistrement de l'appel (24 Mo max).
          </p>
        </>
      )}

      {(etape === 'enregistrement' || etape === 'finalisation') && (
        <div className="mt-3 flex items-center gap-4">
          <p className="font-mono text-3xl font-bold tabular-nums text-fg">{formatDuree(secondes)}</p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn('h-full rounded-full transition-[width] duration-100', enPause ? 'bg-amber-500' : 'bg-brand-500')}
              style={{ width: `${Math.round(niveau * 100)}%` }}
            />
          </div>
          {etape === 'enregistrement' ? (
            <>
              <Button variant="secondary" onClick={capture.basculerPause} title={enPause ? 'Reprendre' : 'Pause'}>
                {enPause ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button variant="danger" onClick={() => void terminer()}><Square className="h-4 w-4" /> Terminer</Button>
            </>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Envoi de l'audio…</span>
          )}
        </div>
      )}

      {etape === 'traitement' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
          Transcription et compte-rendu en cours (environ une minute pour dix minutes d'échange)…
        </p>
      )}
    </div>
  );
}
