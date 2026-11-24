import MiniCalendrierContact from '@/components/MiniCalendrierContact';
import { TrendingUp, FolderKanban, CalendarDays, Plus, Trash2, FolderLock, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate, formatMoney } from '@/lib/utils';
import { DOSSIER_STATUT_LABELS, DOSSIER_STATUT_TONES, OPP_STAGE_LABELS } from '@/lib/constants';
import { Badge } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import type {
  Contact, ContactAction, ContactDocument, Opportunite, Dossier, SessionFormation, SessionParticipant,
} from '@/lib/database.types';
import { titreSection } from './outils';
import type { Affaires } from './useAffaires';

/** Onglet « Affaires » : opportunités, dossiers, sessions et documents du contact. */
export function OngletAffaires({
  c, cc, affaires, opps, dossiers, sessions, participations, actions, coffre, loadRefs, onClose, onUpdated,
}: {
  c: Contact;
  /** Le contact avec ses modifications pas encore rechargées. */
  cc: Contact;
  affaires: Affaires;
  opps: Opportunite[];
  dossiers: Dossier[];
  sessions: SessionFormation[];
  participations: SessionParticipant[];
  actions: ContactAction[];
  coffre: ContactDocument[];
  loadRefs: () => Promise<void>;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const {
    allSessions, addPanel, setAddPanel, calOpen, setCalOpen, busy, newOpp, setNewOpp, newDoss, setNewDoss,
    addOpp, addDoss, addDoc, removeDoc,
  } = affaires;
  const now = new Date();

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-5">
      {/* Opportunités */}
      <section>
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted" /><h3 className={titreSection}>Opportunités ({opps.length})</h3></div><button onClick={() => setAddPanel(addPanel === 'opp' ? null : 'opp')} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"><Plus className="h-3.5 w-3.5" /> Ajouter</button></div>
        {opps.length === 0 ? <p className="text-sm text-muted">Aucune opportunité.</p> : (
          <ul className="space-y-1.5">{opps.map((o) => (
            <li key={o.id} className="flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5 text-sm">
              <span className="text-fg">{o.titre}</span>
              <span className="flex items-center gap-2"><Badge tone="brand">{OPP_STAGE_LABELS[o.stage] ?? o.stage}</Badge><span className="text-xs text-muted">{formatMoney(o.montant)}</span></span>
            </li>))}
          </ul>
        )}
        {addPanel === 'opp' && (
          <div className="mt-2 space-y-2 rounded-lg border border-line bg-surface-2 p-2">
            <input className="input" placeholder="Intitulé de l'opportunité" value={newOpp.titre} onChange={(e) => setNewOpp({ ...newOpp, titre: e.target.value })} />
            <div className="flex gap-2">
              <input className="input" type="number" placeholder="Montant €" value={newOpp.montant} onChange={(e) => setNewOpp({ ...newOpp, montant: e.target.value })} />
              <button onClick={addOpp} disabled={busy || !newOpp.titre.trim()} className="btn-primary shrink-0 py-1.5 text-sm"><Plus className="h-3.5 w-3.5" /> Ajouter</button>
            </div>
          </div>
        )}
      </section>

      {/* Dossiers */}
      <section>
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-muted" /><h3 className={titreSection}>Dossiers ({dossiers.length})</h3></div><div className="flex items-center gap-3"><Link to={`/devis?contact=${c.id}`} onClick={onClose} title="Le dossier du client est créé ou retrouvé avec le devis" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"><Plus className="h-3.5 w-3.5" /> Devis</Link><button onClick={() => setAddPanel(addPanel === 'doss' ? null : 'doss')} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"><Plus className="h-3.5 w-3.5" /> Dossier</button></div></div>
        {dossiers.length === 0 ? <p className="text-sm text-muted">Aucun dossier.</p> : (
          <ul className="space-y-1.5">{dossiers.map((d) => (
            <li key={d.id}>
              <Link to={`/dossiers/${d.id}`} onClick={onClose} title="Ouvrir le dossier" className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:border-brand-300 hover:bg-surface-2">
                <span className="min-w-0 truncate text-fg">{d.intitule}</span>
                <Badge tone={DOSSIER_STATUT_TONES[d.statut]}>{DOSSIER_STATUT_LABELS[d.statut]}</Badge>
              </Link>
            </li>))}
          </ul>
        )}
        {addPanel === 'doss' && (
          <div className="mt-2 flex gap-2 rounded-lg border border-line bg-surface-2 p-2">
            <input className="input" placeholder="Intitulé du dossier" value={newDoss.intitule} onChange={(e) => setNewDoss({ intitule: e.target.value })} />
            <button onClick={addDoss} disabled={busy || !newDoss.intitule.trim()} className="btn-primary shrink-0 py-1.5 text-sm"><Plus className="h-3.5 w-3.5" /> Créer</button>
          </div>
        )}
      </section>

      {/* Sessions */}
      <section>
        <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted" /><h3 className={titreSection}>Sessions ({sessions.length})</h3></div><button onClick={() => setCalOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">{calOpen ? 'Masquer le calendrier' : 'Positionner sur une session'}</button></div>
        {sessions.length === 0 ? <p className="text-sm text-muted">Aucune session.</p> : (
          <ul className="space-y-1.5">{sessions.map((s) => {
            const passee = new Date(s.date_debut) < now;
            return (
              <li key={s.id} className="flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5 text-sm">
                <span className="flex items-center gap-2 text-fg"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.couleur }} />{s.titre}</span>
                <span className="flex items-center gap-2"><span className="text-xs text-muted">{formatDate(s.date_debut, 'dd/MM/yyyy')}</span><Badge tone={passee ? 'success' : 'warning'}>{passee ? 'Réalisée' : 'Programmée'}</Badge><Link to={`/calendrier?date=${(s.date_debut ?? '').slice(0, 10)}`} onClick={onClose} title="Voir dans le calendrier" className="rounded p-0.5 text-muted hover:text-brand-600"><CalendarDays className="h-3.5 w-3.5" /></Link></span>
              </li>);
          })}</ul>
        )}
        {/* Calendrier miniature : positionne le contact sur une session et
            répercute la mise à jour sur la fiche et le pipeline. */}
        {calOpen && (
          <div className="mt-3">
            <MiniCalendrierContact
              contact={cc}
              sessions={allSessions}
              participants={participations}
              opportunites={opps}
              actions={actions}
              onChanged={() => { void loadRefs(); onUpdated(); }}
              onNavigate={onClose}
            />
          </div>
        )}
      </section>

      {/* Documents du contact */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><FolderLock className="h-4 w-4 text-muted" /><h3 className={titreSection}>Documents ({coffre.length})</h3></div>
          <FileUpload bucket="coffre" label="Ajouter" onUploaded={(v, f) => addDoc(v, f?.name)} />
        </div>
        {coffre.length === 0 ? <p className="text-sm text-muted">Aucun document. Téléversez pièces, justificatifs, échanges…</p> : (
          <ul className="space-y-1.5">{coffre.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-fg"><FileText className="h-4 w-4 shrink-0 text-brand-500" /><span className="truncate">{d.titre}</span></span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="text-xs text-muted">{formatDate(d.created_at)}</span>
                <FileLink bucket="coffre" value={d.fichier_url} />
                <button onClick={() => removeDoc(d)} title="Supprimer ce document" className="rounded p-0.5 text-muted hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            </li>))}
          </ul>
        )}
      </section>
    </div>
  );
}
