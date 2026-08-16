import { useState } from 'react';
import { FolderPlus, Loader as Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button, Modal } from '@/components/ui';
import type { Dossier, DossierPiece } from '@/lib/database.types';

/**
 * Bouton « Ajouter au dossier » — tickets Benjamin « Devis : bouton Ajout au
 * dossier » et « Plans de formation bouton ajouter au dossier ».
 *
 * Règles demandées, communes aux deux usages :
 *  - aucun dossier pour le contact  → message d'information (pas de création
 *    silencieuse : c'est explicitement ce qui est demandé) ;
 *  - un seul dossier, pièce absente → dépôt direct + message de confirmation ;
 *  - un seul dossier, pièce déjà présente → confirmation « remplacer » / « annuler » ;
 *  - plusieurs dossiers → choix du dossier, puis les règles ci-dessus.
 *
 * Le document est déposé dans la pièce justificative dont le libellé est
 * `pieceLibelle` (celle de la checklist par défaut du dossier). Si elle n'existe
 * pas encore dans le dossier, elle est créée.
 */
export default function AddToDossierButton({
  contactId, dossiers, fichierUrl, pieceLibelle, documentLabel, onDone, lierDossier,
}: {
  contactId: string | null;
  dossiers: Dossier[];
  fichierUrl: string | null;
  /** Libellé de la pièce justificative cible, ex. « Devis signé ». */
  pieceLibelle: string;
  /** Nom du document dans les messages, ex. « devis », « plan de formation ». */
  documentLabel: string;
  onDone?: () => void;
  /**
   * Rattachement sans PDF : quand le document n'a pas encore été généré, le
   * bouton se contente de le relier au dossier. Renvoie un message d'erreur,
   * ou null si tout s'est bien passé.
   */
  lierDossier?: (dossier: Dossier) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  // Choix du dossier quand le contact en a plusieurs.
  const [picking, setPicking] = useState<Dossier[] | null>(null);
  // Confirmation de remplacement : dossier cible + pièce déjà remplie.
  const [replacing, setReplacing] = useState<{ dossier: Dossier; piece: DossierPiece } | null>(null);

  const candidates = contactId ? dossiers.filter((d) => d.contact_id === contactId) : [];
  const disabled = busy || (!fichierUrl && !lierDossier);

  /** Dépose (ou remplace) le fichier dans la pièce du dossier. */
  const attach = async (dossier: Dossier, existing: DossierPiece | null) => {
    if (!fichierUrl) return;
    setBusy(true);
    const { error } = existing
      ? await supabase.from('dossier_pieces')
          .update({ fichier_url: fichierUrl, statut: 'recue', version: (existing.version ?? 1) + 1 })
          .eq('id', existing.id)
      : await supabase.from('dossier_pieces')
          .insert({ dossier_id: dossier.id, libelle: pieceLibelle, obligatoire: true, statut: 'recue', fichier_url: fichierUrl });
    setBusy(false);
    if (error) { setInfo(`Échec de l'ajout : ${error.message}`); return; }
    setInfo(`${documentLabel.charAt(0).toUpperCase()}${documentLabel.slice(1)} ${existing ? 'remplacé' : 'ajouté'} dans le dossier ${dossier.reference}.`);
    onDone?.();
  };

  /** Cherche la pièce cible du dossier, puis dépose ou demande confirmation. */
  const applyTo = async (dossier: Dossier) => {
    // Pas encore de PDF : on se contente de relier le document au dossier.
    if (!fichierUrl && lierDossier) {
      setBusy(true);
      const err = await lierDossier(dossier);
      setBusy(false);
      setInfo(err
        ? `Rattachement impossible : ${err}`
        : `${documentLabel.charAt(0).toUpperCase()}${documentLabel.slice(1)} rattaché au dossier ${dossier.reference}. Générez le PDF pour le déposer dans les pièces.`);
      if (!err) onDone?.();
      return;
    }
    setBusy(true);
    const { data: pieces, error } = await supabase.from('dossier_pieces')
      .select('*').eq('dossier_id', dossier.id).eq('libelle', pieceLibelle);
    setBusy(false);
    if (error) { setInfo(`Lecture du dossier impossible : ${error.message}`); return; }
    const filled = (pieces ?? []).find((p) => p.fichier_url) as DossierPiece | undefined;
    if (filled) { setReplacing({ dossier, piece: filled }); return; }
    await attach(dossier, ((pieces ?? [])[0] as DossierPiece | undefined) ?? null);
  };

  const start = async () => {
    if (candidates.length === 0) { setInfo('Le contact ne contient aucun dossier.'); return; }
    if (candidates.length === 1) { await applyTo(candidates[0]); return; }
    setPicking(candidates);
  };

  return (
    <>
      <button
        onClick={start}
        disabled={disabled}
        title={fichierUrl
          ? `Ajouter le ${documentLabel} aux pièces du dossier`
          : lierDossier ? `Rattacher le ${documentLabel} à un dossier` : `Générez d'abord le PDF du ${documentLabel}`}
        className="rounded p-1.5 text-muted transition hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
      </button>

      {/* Choix du dossier — cas « plusieurs dossiers » */}
      <Modal
        open={!!picking} onClose={() => setPicking(null)} title="Choisir le dossier"
        footer={<Button variant="secondary" onClick={() => setPicking(null)}>Annuler</Button>}
      >
        <p className="mb-3 text-sm text-muted">Ce contact possède plusieurs dossiers. Dans lequel ajouter le {documentLabel} ?</p>
        <div className="space-y-2">
          {(picking ?? []).map((d) => (
            <button key={d.id}
              onClick={() => { setPicking(null); void applyTo(d); }}
              className="w-full rounded-lg border border-line p-3 text-left transition hover:border-brand-400 hover:bg-surface-2">
              <p className="text-sm font-medium text-fg">{d.reference}</p>
              <p className="text-xs text-muted">{d.intitule}</p>
            </button>
          ))}
        </div>
      </Modal>

      {/* Confirmation de remplacement — cas « pièce déjà présente » */}
      <Modal
        open={!!replacing} onClose={() => setReplacing(null)} title={`Remplacer le ${documentLabel} existant ?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReplacing(null)}>Annuler</Button>
            <Button onClick={() => { const r = replacing; setReplacing(null); if (r) void attach(r.dossier, r.piece); }}>
              Remplacer
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg">
          Le dossier <strong>{replacing?.dossier.reference}</strong> contient déjà un {documentLabel} dans la pièce
          « {pieceLibelle} » (version {replacing?.piece.version ?? 1}). Le remplacer par le document courant ?
        </p>
      </Modal>

      {/* Messages d'information / d'erreur */}
      <Modal
        open={!!info} onClose={() => setInfo(null)} title="Ajout au dossier"
        footer={<Button onClick={() => setInfo(null)}>Fermer</Button>}
      >
        <p className="text-sm text-fg">{info}</p>
      </Modal>
    </>
  );
}
