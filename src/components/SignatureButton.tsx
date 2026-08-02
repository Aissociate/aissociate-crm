import { useState } from 'react';
import { PenLine, Loader as Loader2, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Modal, Field, Badge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { Signature } from '@/lib/database.types';

/**
 * Bouton « Envoyer pour signature » — crée la demande, envoie le code par
 * e-mail au signataire et affiche le lien à transmettre.
 *
 * La signature elle-même se déroule sur la page publique `/signature/:token` :
 * le signataire reçoit un code à usage unique, le saisit, et une page de preuve
 * (horodatage, IP, empreinte du document) est jointe au PDF.
 */
export default function SignatureButton({
  libelle, bucket, fichierUrl, planPdfId = null, devisId = null, dossierId = null,
  contactId = null, defautNom = '', defautEmail = '', onDone,
}: {
  libelle: string;
  bucket: string;
  fichierUrl: string | null;
  planPdfId?: string | null;
  devisId?: string | null;
  dossierId?: string | null;
  contactId?: string | null;
  defautNom?: string;
  defautEmail?: string;
  onDone?: () => void;
}) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState(defautNom);
  const [email, setEmail] = useState(defautEmail);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [creee, setCreee] = useState<Signature | null>(null);
  const [copie, setCopie] = useState(false);

  const lien = creee ? `${window.location.origin}/signature/${creee.token}` : '';

  const ouvrir = () => {
    setNom(defautNom); setEmail(defautEmail);
    setCreee(null); setErreur(null); setCopie(false);
    setOpen(true);
  };

  const envoyer = async () => {
    if (!fichierUrl) return;
    setBusy(true); setErreur(null);
    try {
      const { data, error } = await supabase.from('signatures').insert({
        libelle, bucket, fichier_url: fichierUrl,
        plan_pdf_id: planPdfId, devis_id: devisId, dossier_id: dossierId, contact_id: contactId,
        signataire_nom: nom.trim(), signataire_email: email.trim(),
        created_by: session?.user.id ?? null,
      }).select().single();
      if (error) throw new Error(error.message);

      // Envoi immédiat du code : le signataire reçoit le lien et le code ensemble.
      const { data: res, error: fnErr } = await supabase.functions.invoke('signature', {
        body: { action: 'code', token: data.token },
      });
      if (fnErr) throw new Error("Demande créée, mais l'envoi du code a échoué. Renvoyez-le depuis la page de signature.");
      const err = (res as { error?: string } | null)?.error;
      if (err) throw new Error(`Demande créée, mais : ${err}`);

      setCreee(data as Signature);
      onDone?.();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copier = async () => {
    await navigator.clipboard.writeText(lien);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  return (
    <>
      <button
        onClick={ouvrir}
        disabled={!fichierUrl}
        title={fichierUrl ? 'Envoyer ce document pour signature électronique' : "Générez d'abord le PDF"}
        className="rounded p-1.5 text-muted transition hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <PenLine className="h-4 w-4" />
      </button>

      <Modal
        open={open} onClose={() => setOpen(false)}
        title={creee ? 'Demande de signature envoyée' : 'Envoyer pour signature'}
        footer={creee
          ? <Button onClick={() => setOpen(false)}>Fermer</Button>
          : <>
              <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={envoyer} disabled={busy || nom.trim().length < 3 || !email.includes('@')}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</> : <><PenLine className="h-4 w-4" /> Envoyer</>}
              </Button>
            </>}
      >
        {creee ? (
          <div className="space-y-4">
            <p className="text-sm text-fg">
              Le code de signature a été envoyé à <strong>{creee.signataire_email}</strong>.
            </p>
            <Field label="Lien de signature" hint="À transmettre si le signataire ne retrouve pas l'e-mail">
              <div className="flex items-center gap-2">
                <input className="input font-mono text-xs" readOnly value={lien} onFocus={(e) => e.target.select()} />
                <Button variant="secondary" onClick={copier}>
                  {copie ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </Field>
            <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">
              Le lien expire le {formatDate(creee.expire_at)}. Le code est valable 30 minutes et
              peut être renvoyé depuis la page de signature. Une fois signé, le document est archivé
              avec sa page de preuve (horodatage, adresse IP, empreinte du fichier).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Document : <strong className="text-fg">{libelle}</strong>
            </p>
            <Field label="Nom du signataire" required>
              <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} />
            </Field>
            <Field label="E-mail du signataire" required hint="C'est à cette adresse qu'est envoyé le code à usage unique">
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {erreur && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600">{erreur}</p>}
            <p className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted">
              <Badge tone="info">eIDAS</Badge>
              Signature électronique simple : lien privé + code à usage unique par e-mail,
              journal de preuve horodaté joint au document.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}
