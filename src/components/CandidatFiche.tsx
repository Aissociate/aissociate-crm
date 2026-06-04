import { useState } from 'react';
import { X, Mail, Phone, FileText, Pencil, CircleCheck as CheckCircle2, Circle as XCircle, Calendar, Star, TableProperties, NotebookPen, Save, ExternalLink, Building2, ClipboardList, SlidersHorizontal, FileSignature } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { cn, fullName, initials, formatDate } from '@/lib/utils';
import { CANDIDAT_STATUT_LABELS } from '@/lib/constants';
import { Badge, TONE_BADGE } from '@/components/ui';
import type { Candidat, CandidatStatut, OffreRecrutement } from '@/lib/database.types';

// Colonnes déjà affichées → masquées dans metadata
const META_SKIP = new Set([
  'full_name', 'name', 'nom', 'prenom', 'email', 'phone', 'phone_number',
  'telephone', 'téléphone', 'id', 'created_time', 'lead_status',
  'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id',
  'campaign_name', 'form_id', 'form_name', 'is_organic', 'platform', '',
]);

// Grille de validation (critères notés sur 5) — d'après la feuille de suivi métier
const CRITERES = [
  { key: 'note_experience', label: 'Expérience' },
  { key: 'note_conversation', label: 'Conversation' },
  { key: 'note_autonomie', label: 'Autonomie' },
  { key: 'note_comprehension', label: 'Compréhension' },
  { key: 'note_motivation', label: 'Motivation' },
] as const;
const AVIS_OPTIONS = ['', 'favorable', 'réservé', 'défavorable'];
// Étapes de contractualisation
const CONTRACT_STEPS = [
  { key: 'contract_etape1', label: 'Proposition envoyée' },
  { key: 'contract_etape2', label: 'Contrat envoyé' },
  { key: 'contract_etape3', label: 'Contrat signé' },
  { key: 'contract_etape4', label: 'Démarrage / onboarding' },
] as const;

const STATUT_COLORS: Record<CandidatStatut, string> = {
  recu:         TONE_BADGE.neutral,
  preselection: TONE_BADGE.info,
  entretien:    TONE_BADGE.warning,
  retenu:       TONE_BADGE.success,
  refuse:       TONE_BADGE.danger,
  onboarding:   TONE_BADGE.brand,
};

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return null;
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">Score</span>
        <span className="font-semibold text-fg">{score} / 100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
  candidat: Candidat;
  offres: OffreRecrutement[];
  onClose: () => void;
  onEdit: (c: Candidat) => void;
  onUpdated: () => void;
}

export default function CandidatFiche({ candidat: c, offres, onClose, onEdit, onUpdated }: Props) {
  const offre = offres.find((o) => o.id === c.offre_id);

  // ── Notes éditable ────────────────────────────────────────────────────────────
  // Pour les anciens candidats, les notes contiennent le questionnaire en texte.
  // On sépare : lignes "clé : valeur" → questionnaire, reste → notes libres.
  const [notesValue, setNotesValue] = useState(() => {
    if (c.metadata) return c.notes ?? '';
    // Ancien import : ne garder que les lignes sans séparateur " : " comme notes libres
    return (c.notes ?? '').split('\n').filter((l) => l.indexOf(' : ') < 0).join('\n').trim();
  });
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);

  const handleNotesSave = async () => {
    setNotesSaving(true);
    await supabase.from('candidats').update({ notes: notesValue || null }).eq('id', c.id);
    setNotesSaving(false);
    setNotesDirty(false);
    onUpdated();
  };

  // ── Changement de statut inline ───────────────────────────────────────────────
  const [statut, setStatut] = useState<CandidatStatut>(c.statut);
  const handleStatutChange = async (s: CandidatStatut) => {
    setStatut(s);
    await supabase.from('candidats').update({ statut: s }).eq('id', c.id);
    onUpdated();
  };

  // ── Processus de recrutement (grille métier) ─────────────────────────────────
  const [proc, setProc] = useState({
    statut_entreprise: c.statut_entreprise ?? '', siret: c.siret ?? '',
    document_identite: c.document_identite, profil_details: c.profil_details ?? '',
    historique: c.historique ?? '', prochaine_action: c.prochaine_action ?? '',
    date_prochaine_action: c.date_prochaine_action ?? '',
    note_experience: c.note_experience ?? 0, note_conversation: c.note_conversation ?? 0,
    note_autonomie: c.note_autonomie ?? 0, note_comprehension: c.note_comprehension ?? 0,
    note_motivation: c.note_motivation ?? 0, avis: c.avis ?? '',
  });
  const setP = (k: string, v: unknown) => setProc((p) => ({ ...p, [k]: v }));
  const [savingSec, setSavingSec] = useState<string | null>(null);
  const saveSection = async (key: string, fields: Partial<Candidat>) => {
    setSavingSec(key);
    await supabase.from('candidats').update(fields).eq('id', c.id);
    setSavingSec(null);
    onUpdated();
  };
  const total5 = CRITERES.reduce((s, cr) => s + (Number((proc as Record<string, unknown>)[cr.key]) || 0), 0);
  const score100 = Math.round((total5 / 25) * 100);
  const toggleContract = async (key: keyof Candidat, val: boolean) => {
    await supabase.from('candidats').update({ [key]: !val } as Partial<Candidat>).eq('id', c.id);
    onUpdated();
  };
  const contractDone = CONTRACT_STEPS.filter((s) => c[s.key]).length;

  // ── Questionnaire ─────────────────────────────────────────────────────────────
  const metaEntries = c.metadata
    ? Object.entries(c.metadata).filter(([k, v]) => k && !META_SKIP.has(k.toLowerCase().trim()) && v && String(v).trim())
    : [];

  // Fallback : lignes "clé : valeur" des notes (anciens imports sans metadata)
  const parsedQuestionnaire = !c.metadata && c.notes
    ? c.notes.split('\n').reduce<Array<[string, string]>>((acc, line) => {
        const idx = line.indexOf(' : ');
        if (idx > 0) acc.push([line.slice(0, idx).trim(), line.slice(idx + 3).trim()]);
        return acc;
      }, [])
    : [];

  const hasQuestionnaire = metaEntries.length > 0 || parsedQuestionnaire.length > 0;

  const STATUTS: CandidatStatut[] = ['recu', 'preselection', 'entretien', 'retenu', 'refuse', 'onboarding'];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-2xl animate-slide-in-right">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-line p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-base font-bold text-brand-600 dark:text-brand-400">
              {initials(c.nom, c.prenom)}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-fg leading-tight">{fullName(c.prenom, c.nom)}</h2>
              {offre && <p className="text-xs text-muted mt-0.5">{offre.titre}</p>}
              <div className="mt-1.5 flex items-center gap-2">
                <select
                  value={statut}
                  onChange={(e) => handleStatutChange(e.target.value as CandidatStatut)}
                  className={cn('rounded-full border-0 px-2.5 py-0.5 text-xs font-medium cursor-pointer focus:ring-1 focus:ring-brand-500', STATUT_COLORS[statut])}
                >
                  {STATUTS.map((s) => (
                    <option key={s} value={s}>{CANDIDAT_STATUT_LABELS[s]}</option>
                  ))}
                </select>
                {c.score != null && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {c.score}
                  </span>
                )}
              </div>
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
            <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* Score */}
          {c.score != null && (
            <section>
              <ScoreBar score={c.score} />
            </section>
          )}

          {/* Coordonnées */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Coordonnées</h3>
            <div className="space-y-3">
              {c.email
                ? <InfoRow icon={<Mail className="h-4 w-4" />} label="E-mail"
                    value={<a href={`mailto:${c.email}`} className="text-brand-600 hover:underline dark:text-brand-400">{c.email}</a>} />
                : null}
              {c.telephone
                ? <InfoRow icon={<Phone className="h-4 w-4" />} label="Téléphone"
                    value={<a href={`tel:${c.telephone}`} className="text-brand-600 hover:underline dark:text-brand-400">{c.telephone}</a>} />
                : null}
              {c.cv_url && (
                <InfoRow icon={<FileText className="h-4 w-4" />} label="CV"
                  value={
                    <a href={c.cv_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400">
                      Voir le CV <ExternalLink className="h-3 w-3" />
                    </a>
                  } />
              )}
              {!c.email && !c.telephone && !c.cv_url && (
                <p className="text-sm text-muted italic">Aucune coordonnée renseignée</p>
              )}
            </div>
          </section>

          {/* Infos */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Informations</h3>
            <div className="space-y-3">
              <InfoRow
                icon={c.rgpd_consent ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-400" />}
                label="Consentement RGPD"
                value={c.rgpd_consent ? 'Recueilli' : 'Non recueilli'}
              />
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Candidature reçue"
                value={`${formatDate(c.created_at)} · ${formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}`}
              />
            </div>
          </section>

          {/* Profil administratif */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Profil administratif</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Statut entreprise</label><input className="input" value={proc.statut_entreprise} onChange={(e) => setP('statut_entreprise', e.target.value)} /></div>
              <div><label className="label">SIRET</label><input className="input" value={proc.siret} onChange={(e) => setP('siret', e.target.value)} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm text-fg">
                <input type="checkbox" checked={proc.document_identite} onChange={(e) => setP('document_identite', e.target.checked)} /> Document d'identité fourni
              </label>
              <div className="col-span-2"><label className="label">Détails</label><textarea className="input" rows={2} value={proc.profil_details} onChange={(e) => setP('profil_details', e.target.value)} /></div>
            </div>
            <button onClick={() => saveSection('profil', { statut_entreprise: proc.statut_entreprise || null, siret: proc.siret || null, document_identite: proc.document_identite, profil_details: proc.profil_details || null })}
              disabled={savingSec === 'profil'} className="btn-secondary mt-2 text-sm py-1.5"><Save className="h-3.5 w-3.5" /> {savingSec === 'profil' ? '…' : 'Enregistrer'}</button>
          </section>

          {/* Suivi recrutement */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Suivi recrutement</h3>
            </div>
            <div className="space-y-3">
              <div><label className="label">Historique</label><textarea className="input" rows={2} value={proc.historique} onChange={(e) => setP('historique', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Prochaine action</label><input className="input" value={proc.prochaine_action} onChange={(e) => setP('prochaine_action', e.target.value)} /></div>
                <div><label className="label">Date</label><input className="input" type="date" value={proc.date_prochaine_action ?? ''} onChange={(e) => setP('date_prochaine_action', e.target.value)} /></div>
              </div>
            </div>
            <button onClick={() => saveSection('suivi', { historique: proc.historique || null, prochaine_action: proc.prochaine_action || null, date_prochaine_action: proc.date_prochaine_action || null })}
              disabled={savingSec === 'suivi'} className="btn-secondary mt-2 text-sm py-1.5"><Save className="h-3.5 w-3.5" /> {savingSec === 'suivi' ? '…' : 'Enregistrer'}</button>
          </section>

          {/* Questionnaire */}
          {hasQuestionnaire && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <TableProperties className="h-4 w-4 text-muted" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Questionnaire</h3>
                {!c.metadata && (
                  <Badge tone="warning" className="text-xs">
                    re-importer pour structurer
                  </Badge>
                )}
              </div>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-line">
                    {(metaEntries.length > 0 ? metaEntries : parsedQuestionnaire).map(([key, val]) => (
                      <tr key={key} className="hover:bg-surface-2">
                        <td className="w-2/5 px-3 py-2 text-xs font-medium text-muted align-top">
                          {key.replace(/_/g, ' ').replace(/\?+$/, '?')}
                        </td>
                        <td className="px-3 py-2 text-fg align-top break-words">{String(val)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {metaEntries.length > 0 && (
                <p className="mt-1.5 text-xs text-muted">{metaEntries.length} réponse(s) importée(s)</p>
              )}
            </section>
          )}

          {/* Grille de validation */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Grille de validation</h3>
            </div>
            <div className="space-y-2">
              {CRITERES.map((cr) => {
                const val = Number((proc as Record<string, unknown>)[cr.key]) || 0;
                return (
                  <div key={cr.key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-fg">{cr.label}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setP(cr.key, n)}
                          className="p-0.5" title={`${n}/5`}>
                          <Star className={cn('h-4 w-4', n <= val ? 'fill-amber-400 text-amber-400' : 'text-muted')} />
                        </button>
                      ))}
                      <button onClick={() => setP(cr.key, 0)} className="ml-1 text-xs text-muted hover:text-fg" title="Réinitialiser">×</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
              <span className="text-sm font-medium text-fg">Score total</span>
              <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{total5} / 25 · {score100}/100</span>
            </div>
            <div className="mt-2">
              <label className="label">Avis</label>
              <select className="input" value={proc.avis} onChange={(e) => setP('avis', e.target.value)}>
                {AVIS_OPTIONS.map((a) => <option key={a} value={a}>{a ? a.charAt(0).toUpperCase() + a.slice(1) : '—'}</option>)}
              </select>
            </div>
            <button
              onClick={() => saveSection('grille', {
                note_experience: proc.note_experience, note_conversation: proc.note_conversation,
                note_autonomie: proc.note_autonomie, note_comprehension: proc.note_comprehension,
                note_motivation: proc.note_motivation, score_total: total5, score: score100, avis: proc.avis || null,
              })}
              disabled={savingSec === 'grille'} className="btn-secondary mt-2 text-sm py-1.5">
              <Save className="h-3.5 w-3.5" /> {savingSec === 'grille' ? '…' : 'Enregistrer l\'évaluation'}
            </button>
          </section>

          {/* Contractualisation */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-muted" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Contractualisation</h3>
              </div>
              <span className="text-xs text-muted">{contractDone}/4</span>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(contractDone / 4) * 100}%` }} />
            </div>
            <div className="space-y-1.5">
              {CONTRACT_STEPS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-sm text-fg">
                  <input type="checkbox" checked={c[s.key]} onChange={() => toggleContract(s.key, c[s.key])} />
                  {s.label}
                </label>
              ))}
            </div>
          </section>

          {/* Notes du recruteur */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <NotebookPen className="h-4 w-4 text-muted" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Notes recruteur</h3>
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
              className="input min-h-[100px] resize-y text-sm"
              placeholder="Ajoutez vos observations, retours d'entretien, points à vérifier…"
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
          <div className="flex gap-2">
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
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Modifier la fiche
          </button>
        </div>
      </div>
    </>
  );
}
