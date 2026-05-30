import { useState } from 'react';
import { X, Mail, Phone, Building2, User, Pencil, CircleCheck as CheckCircle2, Circle as XCircle, Calendar, Tag, TableProperties, NotebookPen, Save } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { cn, fullName, initials, formatDate } from '@/lib/utils';
import { CONTACT_TYPE_LABELS } from '@/lib/constants';
import { Badge } from '@/components/ui';
import type { Contact, Entreprise, Financeur, Profile } from '@/lib/database.types';

// Colonnes déjà affichées dans les champs principaux — on les masque dans metadata
const META_SKIP = new Set([
  'full_name', 'name', 'nom', 'prenom', 'email', 'phone', 'phone_number',
  'telephone', 'téléphone', 'company_name', 'entreprise', 'société', 'societe',
  'ville', 'city', '',
]);

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 text-muted">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm text-fg">{value}</p>
      </div>
    </div>
  );
}

interface Props {
  contact: Contact;
  entreprises: Entreprise[];
  financeurs: Financeur[];
  profiles: Profile[];
  onClose: () => void;
  onEdit: (c: Contact) => void;
  onUpdated: () => void;
}

export default function ContactFiche({ contact: c, entreprises, financeurs, profiles, onClose, onEdit, onUpdated }: Props) {
  const entreprise = entreprises.find((e) => e.id === c.entreprise_id);
  const financeur = financeurs.find((f) => f.id === c.financeur_id);
  const owner = profiles.find((p) => p.id === c.owner_id);

  // ── Notes éditable ────────────────────────────────────────────────────────────
  const [notesValue, setNotesValue] = useState(c.notes ?? '');
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

  const handleNotesSave = async () => {
    setNotesSaving(true);
    await supabase.from('contacts').update({ notes: notesValue || null }).eq('id', c.id);
    setNotesSaving(false);
    setNotesDirty(false);
    onUpdated();
  };

  // Entrées metadata à afficher (exclut les doublons avec les champs principaux)
  const metaEntries = c.metadata
    ? Object.entries(c.metadata).filter(([k, v]) => k && !META_SKIP.has(k.toLowerCase().trim()) && v && String(v).trim())
    : [];

  // Fallback : parse le champ notes si pas de metadata structuré (anciens imports)
  const parsedNotes = !c.metadata && c.notes
    ? c.notes.split('\n').reduce<Array<[string, string]>>((acc, line) => {
        const idx = line.indexOf(' : ');
        if (idx > 0) acc.push([line.slice(0, idx).trim(), line.slice(idx + 3).trim()]);
        return acc;
      }, [])
    : [];

  const TYPE_COLORS: Record<string, string> = {
    prospect: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    apprenant: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    contact_entreprise: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    contact_financeur: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-2xl animate-slide-in-right">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-line p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-base font-bold text-brand-600 dark:text-brand-400">
              {initials(c.nom, c.prenom)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-fg leading-tight">
                {c.civilite && <span className="text-muted font-normal">{c.civilite} </span>}
                {fullName(c.prenom, c.nom)}
              </h2>
              {c.fonction && <p className="text-sm text-muted">{c.fonction}</p>}
              <Badge className={cn('mt-1', TYPE_COLORS[c.type] ?? 'bg-slate-100 text-slate-700')}>
                {CONTACT_TYPE_LABELS[c.type]}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { onClose(); onEdit(c); }}
              className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-brand-600"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Coordonnées */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Coordonnées</h3>
            <div className="space-y-3">
              {c.email ? (
                <InfoRow icon={<Mail className="h-4 w-4" />} label="E-mail"
                  value={<a href={`mailto:${c.email}`} className="text-brand-600 hover:underline dark:text-brand-400">{c.email}</a>}
                />
              ) : null}
              {c.telephone ? (
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Téléphone"
                  value={<a href={`tel:${c.telephone}`} className="text-brand-600 hover:underline dark:text-brand-400">{c.telephone}</a>}
                />
              ) : null}
              {!c.email && !c.telephone && (
                <p className="text-sm text-muted italic">Aucune coordonnée renseignée</p>
              )}
            </div>
          </section>

          {/* Relations */}
          {(entreprise || financeur || owner) && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Relations</h3>
              <div className="space-y-3">
                {entreprise && (
                  <InfoRow icon={<Building2 className="h-4 w-4" />} label="Entreprise" value={entreprise.raison_sociale} />
                )}
                {financeur && (
                  <InfoRow icon={<Tag className="h-4 w-4" />} label="Financeur" value={financeur.nom} />
                )}
                {owner && (
                  <InfoRow icon={<User className="h-4 w-4" />} label="Conseiller affecté"
                    value={fullName(owner.prenom, owner.nom)}
                  />
                )}
                {!owner && c.type === 'prospect' && (
                  <InfoRow icon={<User className="h-4 w-4" />} label="Conseiller affecté"
                    value={<span className="text-amber-600">Non affecté</span>}
                  />
                )}
              </div>
            </section>
          )}

          {/* RGPD + dates */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Informations</h3>
            <div className="space-y-3">
              <InfoRow
                icon={c.rgpd_consent ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                label="Consentement RGPD"
                value={c.rgpd_consent ? 'Recueilli' : 'Non recueilli'}
              />
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Créé"
                value={`${formatDate(c.created_at)} · ${formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}`}
              />
            </div>
          </section>

          {/* Notes texte libre */}
          {c.notes && metaEntries.length === 0 && parsedNotes.length === 0 && (
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Notes</h3>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-sm text-fg leading-relaxed">{c.notes}</p>
            </section>
          )}

          {/* Données importées (metadata structuré ou notes parsées) */}
          {(metaEntries.length > 0 || parsedNotes.length > 0) && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <TableProperties className="h-4 w-4 text-muted" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Données importées</h3>
              </div>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-line">
                    {(metaEntries.length > 0 ? metaEntries : parsedNotes).map(([key, val]) => (
                      <tr key={key} className="hover:bg-surface-2">
                        <td className="w-2/5 px-3 py-2 text-xs font-medium text-muted align-top">
                          {key.replace(/_/g, ' ').replace(/\?+/g, '?')}
                        </td>
                        <td className="px-3 py-2 text-fg align-top break-words">
                          {String(val)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {metaEntries.length > 0
                  ? `${metaEntries.length} champ(s) issus du fichier importé`
                  : 'Données reconstruites depuis le champ notes — re-importez pour obtenir la vue structurée'}
              </p>
            </section>
          )}

          {/* Notes conseiller */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <NotebookPen className="h-4 w-4 text-muted" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Notes conseiller</h3>
              </div>
              {notesDirty && (
                <button
                  onClick={handleNotesSave}
                  disabled={notesSaving}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400"
                >
                  <Save className="h-3 w-3" />
                  {notesSaving ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
              )}
            </div>
            <textarea
              className="input min-h-[88px] resize-y text-sm"
              placeholder="Observations, rappels, informations de suivi…"
              value={notesValue}
              onChange={(e) => { setNotesValue(e.target.value); setNotesDirty(true); }}
            />
            {!notesDirty && (
              <p className="mt-1 text-xs text-muted">Modifiez pour sauvegarder</p>
            )}
          </section>
        </div>

        {/* Pied */}
        <div className="border-t border-line px-5 py-3 flex items-center justify-between gap-2">
          <div>
            {notesDirty && (
              <button
                onClick={handleNotesSave}
                disabled={notesSaving}
                className="btn-primary text-sm py-2"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {notesSaving ? 'Sauvegarde…' : 'Sauvegarder les notes'}
              </button>
            )}
          </div>
          <button
            onClick={() => { onClose(); onEdit(c); }}
            className="btn-secondary text-sm"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Modifier ce contact
          </button>
        </div>
      </div>
    </>
  );
}
