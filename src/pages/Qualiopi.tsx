import { useMemo, useState } from 'react';
import {
  ShieldCheck, ChevronDown, FileCheck2, FolderArchive, MessageSquare, Download,
  Sparkles, Send, Link2, Eye, Paperclip, AlertTriangle, Loader2, RefreshCw, CheckCircle2,
  FileText, Check, X,
} from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  PageHeader, Button, Badge, Card, StatCard, EmptyState, Spinner, SearchSelect, Modal, Field,
} from '@/components/ui';
import type { SearchOption } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import { formatDate, cn } from '@/lib/utils';
import {
  APPLICABLE_LABELS, CONFORMITE_LABELS, CONFORMITE_TONES, DOC_STATUT_LABELS, DOC_STATUT_TONES,
  QUESTIONNAIRE_STATUT_LABELS, QUESTIONNAIRE_STATUT_TONES, MOMENT_LABELS, GENERABLE_DOC_TYPES,
} from '@/lib/qualiopi';
import type {
  QualiopiCritere, QualiopiIndicateur, QualiopiConformite, QualiopiDossierDoc, QualiopiDocStatut,
  QualiopiPreuveDocument, QuestionnaireEnvoi, QuestionnaireModele, QuestionnaireReponse,
  QualiopiModeleDoc, Document as DocRow, SessionFormation, SessionParticipant,
} from '@/lib/database.types';

type Tab = 'referentiel' | 'dossiers' | 'questionnaires' | 'modeles';

const CONFORMITES: QualiopiConformite[] = ['conforme', 'a_completer', 'non_applicable', 'a_verifier'];
const DOC_STATUTS: QualiopiDocStatut[] = ['a_generer', 'genere', 'envoye', 'signe', 'recu', 'valide', 'non_applicable'];

export default function Qualiopi() {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>('referentiel');
  const [exporting, setExporting] = useState(false);

  const criteres = useCollection<QualiopiCritere>('qualiopi_criteres', { orderBy: { column: 'numero' } });
  const indicateurs = useCollection<QualiopiIndicateur>('qualiopi_indicateurs', { orderBy: { column: 'numero' } });
  const documents = useCollection<DocRow>('documents', { orderBy: { column: 'titre' } });
  const preuves = useCollection<QualiopiPreuveDocument>('qualiopi_preuve_document');
  const dossierDocs = useCollection<QualiopiDossierDoc>('qualiopi_dossier_docs');

  // Couverture par preuve : nb de preuves organisme (documents rattachés) +
  // pièces de dossier « faites » (générées/reçues/signées/validées) par indicateur.
  const coverage = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of preuves.data) m.set(p.indicateur_numero, (m.get(p.indicateur_numero) ?? 0) + 1);
    for (const d of dossierDocs.data) {
      if (d.indicateur_numero && ['valide', 'signe', 'recu', 'genere'].includes(d.statut))
        m.set(d.indicateur_numero, (m.get(d.indicateur_numero) ?? 0) + 1);
    }
    return m;
  }, [preuves.data, dossierDocs.data]);

  const exportZip = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('qualiopi-export', {
        body: { annee: new Date().getFullYear() },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (url) window.open(url, '_blank', 'noopener');
      else alert("Export généré, mais aucun lien retourné. Vérifiez le déploiement de la fonction « qualiopi-export ».");
    } catch (e) {
      alert(
        "Export indisponible : déployez l'Edge Function « qualiopi-export ». " +
        (e instanceof Error ? e.message : ''),
      );
    } finally {
      setExporting(false);
    }
  };

  const stats = useMemo(() => {
    const rows = indicateurs.data;
    const applicables = rows.filter((i) => i.statut !== 'non_applicable');
    // Conformité RÉELLE : « conforme » ET couvert par au moins une preuve.
    const conformes = rows.filter((i) => i.statut === 'conforme' && (coverage.get(i.numero) ?? 0) > 0).length;
    const sansPreuve = rows.filter((i) => i.statut === 'conforme' && (coverage.get(i.numero) ?? 0) === 0).length;
    return {
      total: rows.length,
      conformes,
      sansPreuve,
      aCompleter: rows.filter((i) => i.statut === 'a_completer' || i.statut === 'a_verifier').length,
      na: rows.filter((i) => i.statut === 'non_applicable').length,
      pct: applicables.length ? Math.round((conformes / applicables.length) * 100) : 0,
    };
  }, [indicateurs.data, coverage]);

  return (
    <div>
      <PageHeader
        title="Conformité Qualiopi"
        subtitle="Référentiel National Qualité — preuves d'audit (7 critères / 32 indicateurs)"
        actions={
          <Button onClick={exportZip} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exporter le ZIP d'audit
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Conformité réelle" value={`${stats.pct}%`} icon={<ShieldCheck className="h-5 w-5" />} hint={`${stats.conformes}/${stats.total - stats.na} indicateurs applicables (preuve requise)`} />
        <StatCard label="Conformes avec preuve" value={stats.conformes} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="À compléter" value={stats.aCompleter} icon={<AlertTriangle className="h-5 w-5" />} hint={stats.sansPreuve > 0 ? `dont ${stats.sansPreuve} « conforme » sans preuve` : undefined} />
        <StatCard label="Non applicables" value={stats.na} icon={<FileCheck2 className="h-5 w-5" />} />
      </div>

      <div className="mb-6 flex gap-1 border-b border-line">
        {([
          ['referentiel', 'Référentiel', ShieldCheck],
          ['dossiers', 'Dossiers de formation', FolderArchive],
          ['questionnaires', 'Questionnaires', MessageSquare],
          ['modeles', 'Modèles de documents', FileText],
        ] as [Tab, string, typeof ShieldCheck][]).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition',
              tab === id ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'referentiel' && (
        <Referentiel
          criteres={criteres.data}
          indicateurs={indicateurs.data}
          documents={documents.data}
          preuves={preuves.data}
          coverage={coverage}
          loading={indicateurs.loading}
          userId={session?.user.id ?? null}
          onRefresh={() => { indicateurs.refresh(); preuves.refresh(); documents.refresh(); dossierDocs.refresh(); }}
        />
      )}
      {tab === 'dossiers' && <Dossiers userId={session?.user.id ?? null} />}
      {tab === 'questionnaires' && <Questionnaires />}
      {tab === 'modeles' && <Modeles />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — RÉFÉRENTIEL
// ─────────────────────────────────────────────────────────────────────────────
function Referentiel({
  criteres, indicateurs, documents, preuves, coverage, loading, userId, onRefresh,
}: {
  criteres: QualiopiCritere[]; indicateurs: QualiopiIndicateur[];
  documents: DocRow[]; preuves: QualiopiPreuveDocument[];
  coverage: Map<number, number>;
  loading: boolean; userId: string | null; onRefresh: () => void;
}) {
  const [openCrit, setOpenCrit] = useState<number | null>(criteres[0]?.numero ?? 1);
  const [openInd, setOpenInd] = useState<number | null>(null);

  if (loading && indicateurs.length === 0) return <div className="flex justify-center py-16"><Spinner /></div>;

  const docsById = new Map(documents.map((d) => [d.id, d]));
  const preuvesByInd = (num: number) => preuves.filter((p) => p.indicateur_numero === num);

  const setStatut = async (num: number, statut: QualiopiConformite) => {
    await supabase.from('qualiopi_indicateurs').update({ statut }).eq('numero', num);
    onRefresh();
  };
  const saveComment = async (num: number, commentaire: string) => {
    await supabase.from('qualiopi_indicateurs').update({ commentaire }).eq('numero', num);
    onRefresh();
  };
  const attachDoc = async (num: number, documentId: string) => {
    if (!documentId) return;
    await supabase.from('qualiopi_preuve_document').insert({ indicateur_numero: num, document_id: documentId });
    onRefresh();
  };
  const detachDoc = async (id: string) => {
    await supabase.from('qualiopi_preuve_document').delete().eq('id', id);
    onRefresh();
  };
  const uploadProof = async (num: number, value: string, file?: File) => {
    const titre = file?.name ?? `Preuve indicateur ${num}`;
    const { data, error } = await supabase.from('documents')
      .insert({ titre, categorie: 'qualiopi', fichier_url: value, tags: [`indicateur-${num}`], owner_id: userId })
      .select().single();
    if (error) { alert(error.message); return; }
    if (data) await supabase.from('qualiopi_preuve_document').insert({ indicateur_numero: num, document_id: data.id });
    onRefresh();
  };

  const docOptions: SearchOption[] = documents.map((d) => ({ value: d.id, label: d.titre, sub: d.categorie }));

  // Auto-évaluation fondée sur les preuves : un indicateur couvert (≥1 preuve)
  // et encore « à compléter » passe « conforme » ; un « conforme » sans preuve
  // est rétrogradé « à vérifier ». Les non-applicables sont laissés tels quels.
  const autoEval = async () => {
    const updates: { numero: number; statut: QualiopiConformite }[] = [];
    for (const ind of indicateurs) {
      if (ind.applicable === 'non_applicable') continue;
      const cov = coverage.get(ind.numero) ?? 0;
      if (cov > 0 && ind.statut === 'a_completer') updates.push({ numero: ind.numero, statut: 'conforme' });
      else if (cov === 0 && ind.statut === 'conforme') updates.push({ numero: ind.numero, statut: 'a_verifier' });
    }
    if (updates.length === 0) { alert('Rien à ajuster : la conformité est déjà cohérente avec les preuves.'); return; }
    if (!confirm(`Auto-évaluer ${updates.length} indicateur(s) selon les preuves rattachées ?`)) return;
    for (const u of updates) await supabase.from('qualiopi_indicateurs').update({ statut: u.statut }).eq('numero', u.numero);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-4 py-2.5">
        <p className="text-xs text-muted">
          La conformité est <span className="font-semibold">fondée sur les preuves</span> : un indicateur n'est réellement conforme que s'il a au moins une preuve rattachée.
        </p>
        <Button variant="secondary" className="h-8 py-0 text-xs" onClick={autoEval}>
          <Sparkles className="h-3.5 w-3.5" /> Auto-évaluer selon les preuves
        </Button>
      </div>
      {criteres.map((crit) => {
        const inds = indicateurs.filter((i) => i.critere === crit.numero);
        const applicable = inds.filter((i) => i.statut !== 'non_applicable');
        const ok = inds.filter((i) => i.statut === 'conforme').length;
        const isOpen = openCrit === crit.numero;
        return (
          <Card key={crit.numero} className="p-0">
            <button
              onClick={() => setOpenCrit(isOpen ? null : crit.numero)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-sm font-bold text-brand-600 dark:text-brand-400">
                {crit.numero}
              </span>
              <span className="flex-1 font-semibold text-fg">{crit.libelle}</span>
              <Badge tone={ok === applicable.length && applicable.length > 0 ? 'success' : 'warning'}>
                {ok}/{applicable.length} conformes
              </Badge>
              <ChevronDown className={cn('h-5 w-5 text-muted transition', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
              <div className="divide-y divide-line border-t border-line">
                {inds.map((ind) => {
                  const links = preuvesByInd(ind.numero);
                  const cov = coverage.get(ind.numero) ?? 0;
                  const sansPreuve = ind.statut === 'conforme' && cov === 0;
                  const expanded = openInd === ind.numero;
                  return (
                    <div key={ind.numero} className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => setOpenInd(expanded ? null : ind.numero)} className="flex flex-1 items-center gap-2 text-left">
                          <span className="text-sm font-semibold text-muted">#{ind.numero}</span>
                          <span className="text-sm text-fg">{ind.intitule}</span>
                        </button>
                        {ind.applicable === 'si_certifiante' && <Badge tone="info">Si certifiante</Badge>}
                        {cov > 0 && <Badge tone="neutral"><Paperclip className="h-3 w-3" /> {cov}</Badge>}
                        {sansPreuve && <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> Sans preuve</Badge>}
                        <Badge tone={CONFORMITE_TONES[ind.statut]}>{CONFORMITE_LABELS[ind.statut]}</Badge>
                        <ChevronDown className={cn('h-4 w-4 text-muted transition', expanded && 'rotate-180')} onClick={() => setOpenInd(expanded ? null : ind.numero)} />
                      </div>

                      {expanded && (
                        <div className="mt-3 space-y-3 rounded-lg bg-surface-2 p-4">
                          {ind.preuves_attendues && (
                            <p className="text-xs text-muted"><span className="font-semibold">Preuves attendues :</span> {ind.preuves_attendues}</p>
                          )}

                          <div>
                            <p className="mb-1 text-xs font-semibold text-muted">Preuves rattachées</p>
                            {links.length === 0 && <p className="text-xs text-muted/70">Aucune preuve rattachée.</p>}
                            <ul className="space-y-1">
                              {links.map((l) => {
                                const d = docsById.get(l.document_id);
                                const perime = d?.date_validite && new Date(d.date_validite) < new Date();
                                return (
                                  <li key={l.id} className="flex items-center gap-2 text-sm">
                                    <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                    <span className="flex-1 truncate text-fg">{d?.titre ?? 'Document'}</span>
                                    {perime && <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> Périmé</Badge>}
                                    {d?.fichier_url && <FileLink bucket={(d.categorie === 'qualiopi' ? 'qualiopi' : 'documents')} value={d.fichier_url} />}
                                    <button onClick={() => detachDoc(l.id)} className="text-xs text-muted hover:text-red-500">Retirer</button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <div className="min-w-[220px] flex-1">
                              <SearchSelect
                                value=""
                                onChange={(v) => attachDoc(ind.numero, v)}
                                options={docOptions}
                                placeholder="Rattacher un document existant…"
                                emptyLabel="— choisir —"
                              />
                            </div>
                            <FileUpload bucket="qualiopi" label="Téléverser une preuve" onUploaded={(v, f) => uploadProof(ind.numero, v, f)} />
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <label className="text-xs font-semibold text-muted">Statut :</label>
                            <select
                              value={ind.statut}
                              onChange={(e) => setStatut(ind.numero, e.target.value as QualiopiConformite)}
                              className="input h-9 w-auto py-0 text-sm"
                            >
                              {CONFORMITES.map((c) => <option key={c} value={c}>{CONFORMITE_LABELS[c]}</option>)}
                            </select>
                            <span className="text-xs text-muted">Applicabilité : {APPLICABLE_LABELS[ind.applicable]}</span>
                          </div>

                          <CommentBox value={ind.commentaire ?? ''} onSave={(v) => saveComment(ind.numero, v)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function CommentBox({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <div>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Note interne / commentaire d'audit…"
        className="input min-h-[60px] text-sm"
      />
      {v !== value && (
        <Button variant="secondary" className="mt-1 h-8 py-0 text-xs" onClick={() => onSave(v)}>Enregistrer la note</Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — DOSSIERS DE FORMATION
// ─────────────────────────────────────────────────────────────────────────────
function Dossiers({ userId }: { userId: string | null }) {
  const sessions = useCollection<SessionFormation>('sessions_formation', { orderBy: { column: 'date_debut', ascending: false } });
  const docs = useCollection<QualiopiDossierDoc>('qualiopi_dossier_docs');
  const participants = useCollection<SessionParticipant>('session_participants');
  const modeles = useCollection<QualiopiModeleDoc>('qualiopi_modeles_doc');
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Types de pièces disposant d'un modèle .docx actif → publipostage possible.
  const modelTypes = new Set(modeles.data.filter((m) => m.actif && m.fichier_url).map((m) => m.type_doc));

  const refresh = () => { docs.refresh(); };

  const prepare = async (sessionId: string) => {
    setBusy(sessionId);
    const { error } = await supabase.rpc('qualiopi_prepare_session', { p_session: sessionId });
    setBusy(null);
    if (error) { alert(error.message); return; }
    docs.refresh();
  };

  const setDocStatut = async (id: string, statut: QualiopiDocStatut) => {
    await supabase.from('qualiopi_dossier_docs').update({ statut }).eq('id', id);
    docs.refresh();
  };
  const uploadDoc = async (id: string, value: string) => {
    await supabase.from('qualiopi_dossier_docs').update({ fichier_url: value, statut: 'recu' }).eq('id', id);
    docs.refresh();
  };
  // Publipostage sur modèle .docx si dispo, sinon génération pdf-lib générique.
  const generateDoc = async (id: string, typeDoc: string) => {
    const fn = modelTypes.has(typeDoc) ? 'qualiopi-doc-tpl' : 'qualiopi-doc';
    setBusy(id);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: { docId: id } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      docs.refresh();
    } catch (e) {
      alert("Génération indisponible : déployez l'Edge Function « " + fn + " ». " + (e instanceof Error ? e.message : ''));
    } finally { setBusy(null); }
  };

  if (sessions.loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (sessions.data.length === 0) return <EmptyState title="Aucune session de formation" message="Créez une session dans le Calendrier : son dossier Qualiopi sera provisionné automatiquement." />;

  return (
    <div className="space-y-3">
      {sessions.data.map((s) => {
        const sDocs = docs.data.filter((d) => d.session_id === s.id);
        const done = sDocs.filter((d) => ['valide', 'recu', 'signe', 'genere'].includes(d.statut)).length;
        const pct = sDocs.length ? Math.round((done / sDocs.length) * 100) : 0;
        const parts = participants.data.filter((p) => p.session_id === s.id);
        const collectifs = sDocs.filter((d) => !d.participant_id);
        const isOpen = openSession === s.id;
        return (
          <Card key={s.id} className="p-0">
            <button onClick={() => setOpenSession(isOpen ? null : s.id)} className="flex w-full items-center gap-3 px-5 py-4 text-left">
              <FolderArchive className="h-5 w-5 shrink-0 text-brand-500" />
              <div className="flex-1">
                <p className="font-semibold text-fg">{s.titre}</p>
                <p className="text-xs text-muted">{formatDate(s.date_debut)} · {parts.length} apprenant(s) · {sDocs.length} pièces</p>
              </div>
              <div className="hidden w-40 sm:block">
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <Badge tone={pct === 100 ? 'success' : pct > 0 ? 'warning' : 'neutral'}>{pct}%</Badge>
              <ChevronDown className={cn('h-5 w-5 text-muted transition', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
              <div className="border-t border-line px-5 py-4">
                {sDocs.length === 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted">Dossier non provisionné.</p>
                    <Button onClick={() => prepare(s.id)} disabled={busy === s.id}>
                      {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Préparer le dossier
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <DocGroup title="Documents collectifs" docs={collectifs} busy={busy} modelTypes={modelTypes} onGenerate={generateDoc} onUpload={uploadDoc} onStatut={setDocStatut} />
                    {parts.map((p) => (
                      <DocGroup
                        key={p.id}
                        title={`${p.prenom ?? ''} ${p.nom}`.trim()}
                        docs={sDocs.filter((d) => d.participant_id === p.id)}
                        busy={busy}
                        modelTypes={modelTypes}
                        onGenerate={generateDoc}
                        onUpload={uploadDoc}
                        onStatut={setDocStatut}
                      />
                    ))}
                    <Button variant="ghost" className="text-xs" onClick={() => prepare(s.id)} disabled={busy === s.id}>
                      <RefreshCw className="h-3.5 w-3.5" /> Re-synchroniser la checklist
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function DocGroup({
  title, docs, busy, modelTypes, onGenerate, onUpload, onStatut,
}: {
  title: string; docs: QualiopiDossierDoc[]; busy: string | null; modelTypes: Set<string>;
  onGenerate: (id: string, typeDoc: string) => void; onUpload: (id: string, v: string) => void;
  onStatut: (id: string, s: QualiopiDocStatut) => void;
}) {
  if (docs.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="overflow-hidden rounded-lg border border-line">
        {docs.map((d) => {
          const canGenerate = GENERABLE_DOC_TYPES.has(d.type_doc) || modelTypes.has(d.type_doc);
          return (
          <div key={d.id} className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 last:border-0">
            <span className="flex-1 text-sm text-fg">{d.libelle}</span>
            {modelTypes.has(d.type_doc) && <Badge tone="info">modèle</Badge>}
            <Badge tone={DOC_STATUT_TONES[d.statut]}>{DOC_STATUT_LABELS[d.statut]}</Badge>
            {d.fichier_url && <FileLink bucket="qualiopi" value={d.fichier_url} />}
            {canGenerate && (
              <Button variant="ghost" className="h-8 py-0 text-xs" onClick={() => onGenerate(d.id, d.type_doc)} disabled={busy === d.id}>
                {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Générer
              </Button>
            )}
            <FileUpload bucket="qualiopi" label="Téléverser" onUploaded={(v) => onUpload(d.id, v)} />
            <select value={d.statut} onChange={(e) => onStatut(d.id, e.target.value as QualiopiDocStatut)} className="input h-8 w-auto py-0 text-xs">
              {DOC_STATUTS.map((s) => <option key={s} value={s}>{DOC_STATUT_LABELS[s]}</option>)}
            </select>
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — QUESTIONNAIRES
// ─────────────────────────────────────────────────────────────────────────────
function Questionnaires() {
  const envois = useCollection<QuestionnaireEnvoi>('questionnaire_envois', { orderBy: { column: 'created_at', ascending: false } });
  const reponses = useCollection<QuestionnaireReponse>('questionnaire_reponses');
  const modeles = useCollection<QuestionnaireModele>('questionnaire_modeles');
  const sessions = useCollection<SessionFormation>('sessions_formation');
  const [view, setView] = useState<QuestionnaireReponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const modeleByCode = new Map(modeles.data.map((m) => [m.code, m]));
  const sessionById = new Map(sessions.data.map((s) => [s.id, s]));
  const repByEnvoi = new Map(reponses.data.map((r) => [r.envoi_id, r]));

  const notes = reponses.data.map((r) => r.note_globale).filter((n): n is number => n != null);
  const satisfaction = notes.length ? (notes.reduce((a, b) => a + b, 0) / notes.length) : null;
  const tauxReponse = envois.data.length ? Math.round((reponses.data.length / envois.data.length) * 100) : 0;

  const link = (token: string) => `${window.location.origin}/q/${token}`;

  const sendOne = async (e: QuestionnaireEnvoi, relance = false) => {
    if (!e.destinataire_email) { alert('Aucune adresse e-mail pour ce destinataire.'); return; }
    const m = modeleByCode.get(e.modele_code);
    setBusy(e.id);
    const url = link(e.token);
    const html = `
      <p>Bonjour ${e.destinataire_nom ?? ''},</p>
      <p>${relance ? 'Petit rappel : merci de' : 'Merci de'} prendre quelques minutes pour répondre au questionnaire
      « <strong>${m?.titre ?? e.modele_code}</strong> ».</p>
      <p><a href="${url}" style="background:#ea6a1e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Répondre au questionnaire</a></p>
      <p>Ou copiez ce lien : ${url}</p>
      <p>Merci,<br/>L'équipe Aissociate</p>`;
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: { to: e.destinataire_email, subject: m?.titre ?? 'Questionnaire de formation', html },
      });
      if (error) throw error;
      await supabase.from('questionnaire_envois').update({
        statut: relance ? 'relance' : 'envoye', sent_at: new Date().toISOString(),
      }).eq('id', e.id);
      envois.refresh();
    } catch (err) {
      alert("Envoi impossible (SMTP non configuré ?). " + (err instanceof Error ? err.message : ''));
    } finally { setBusy(null); }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(link(token));
  };

  if (envois.loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Taux de réponse" value={`${tauxReponse}%`} icon={<MessageSquare className="h-5 w-5" />} hint={`${reponses.data.length}/${envois.data.length} envois`} />
        <StatCard label="Satisfaction moyenne" value={satisfaction != null ? `${satisfaction.toFixed(1)}/5` : '—'} icon={<Sparkles className="h-5 w-5" />} />
        <StatCard label="En attente d'envoi" value={envois.data.filter((e) => e.statut === 'a_envoyer').length} icon={<Send className="h-5 w-5" />} />
      </div>

      {envois.data.length === 0 ? (
        <EmptyState title="Aucun questionnaire" message="Les envois sont provisionnés automatiquement à la création d'une session (positionnement, à chaud, à froid)." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">Destinataire</th>
                  <th className="px-4 py-2.5">Questionnaire</th>
                  <th className="px-4 py-2.5">Session</th>
                  <th className="px-4 py-2.5">Statut</th>
                  <th className="px-4 py-2.5">Envoyé le</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {envois.data.map((e) => {
                  const m = modeleByCode.get(e.modele_code);
                  const rep = repByEnvoi.get(e.id);
                  const sess = e.session_id ? sessionById.get(e.session_id) : null;
                  return (
                    <tr key={e.id}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-fg">{e.destinataire_nom ?? '—'}</p>
                        <p className="text-xs text-muted">{e.destinataire_email ?? ''}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-fg">{m?.titre ?? e.modele_code}</p>
                        <p className="text-xs text-muted">{MOMENT_LABELS[m?.moment ?? 'autre']}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{sess?.titre ?? '—'}</td>
                      <td className="px-4 py-2.5"><Badge tone={QUESTIONNAIRE_STATUT_TONES[e.statut]}>{QUESTIONNAIRE_STATUT_LABELS[e.statut]}</Badge></td>
                      <td className="px-4 py-2.5 text-muted">{e.sent_at ? formatDate(e.sent_at) : '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {rep ? (
                            <Button variant="ghost" className="h-8 py-0 text-xs" onClick={() => setView(rep)}><Eye className="h-3.5 w-3.5" /> Réponse</Button>
                          ) : (
                            <>
                              <button onClick={() => copyLink(e.token)} title="Copier le lien" className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-fg"><Link2 className="h-4 w-4" /></button>
                              <Button variant="ghost" className="h-8 py-0 text-xs" onClick={() => sendOne(e, e.statut !== 'a_envoyer')} disabled={busy === e.id}>
                                {busy === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                                {e.statut === 'a_envoyer' ? 'Envoyer' : 'Relancer'}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!view} onClose={() => setView(null)} title="Réponse au questionnaire" wide>
        {view && (
          <div className="space-y-3">
            {view.note_globale != null && <p className="text-sm"><span className="font-semibold">Note globale :</span> {view.note_globale}/5</p>}
            <div className="space-y-2">
              {Object.entries((view.reponses ?? {}) as Record<string, unknown>).map(([k, val]) => (
                <div key={k} className="rounded-lg bg-surface-2 p-3">
                  <p className="text-xs font-semibold text-muted">{k}</p>
                  <p className="text-sm text-fg">{String(val)}</p>
                </div>
              ))}
            </div>
            {view.commentaire && <p className="text-sm text-muted">{view.commentaire}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4 — MODÈLES DE DOCUMENTS (publipostage)
// ─────────────────────────────────────────────────────────────────────────────
const MERGE_TOKENS = [
  'NOM ORGANISME', 'SIRET', 'ADRESSE', 'VILLE', 'NUMERO DECLARATION', 'REPRESENTANT', 'REGION',
  'NOM ENTREPRISE', 'INTITULE FORMATION', 'OBJECTIFS PEDAGOGIQUES', 'NOMBRE HEURES',
  'DATE DEBUT', 'DATE FIN DE FORMATION', 'DATES', 'LIEU', 'ADRESSE SALLE', 'MODALITE',
  'FORMATEUR', 'PRENOM NOM', 'NOM', 'PRENOM', 'TARIF', 'DATE DU JOUR',
];

function Modeles() {
  const modeles = useCollection<QualiopiModeleDoc>('qualiopi_modeles_doc', { orderBy: { column: 'titre' } });

  const setModele = async (type_doc: string, patch: Partial<QualiopiModeleDoc>) => {
    await supabase.from('qualiopi_modeles_doc').update(patch).eq('type_doc', type_doc);
    modeles.refresh();
  };
  const onUpload = async (type_doc: string, value: string) => {
    await supabase.from('qualiopi_modeles_doc').update({ fichier_url: value, actif: true }).eq('type_doc', type_doc);
    modeles.refresh();
  };

  if (modeles.loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <Card className="bg-surface-2">
        <p className="text-sm font-semibold text-fg">Publipostage sur vos modèles Word</p>
        <p className="mt-1 text-xs text-muted">
          Téléversez votre modèle <code>.docx</code> par type de pièce. Insérez les champs de fusion entre crochets, ex.
          <code> [NOM ORGANISME]</code>, <code>[PRENOM NOM]</code>, <code>[DATES]</code>. À la génération, ils sont remplacés
          par les données du dossier et un <code>.docx</code> personnalisé est produit (fidèle à votre charte). Sans modèle
          actif, la génération reste en PDF générique.
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-brand-600 dark:text-brand-400">Voir les champs de fusion disponibles</summary>
          <div className="mt-2 flex flex-wrap gap-1">
            {MERGE_TOKENS.map((t) => (
              <code key={t} className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-muted">[{t}]</code>
            ))}
          </div>
        </details>
      </Card>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Type de pièce</th>
                <th className="px-4 py-2.5">Modèle</th>
                <th className="px-4 py-2.5">Actif</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {modeles.data.map((m) => (
                <tr key={m.type_doc}>
                  <td className="px-4 py-2.5 font-medium text-fg">{m.titre}</td>
                  <td className="px-4 py-2.5">
                    {m.fichier_url
                      ? <Badge tone="success"><Check className="h-3 w-3" /> Téléversé</Badge>
                      : <Badge tone="neutral">Aucun</Badge>}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setModele(m.type_doc, { actif: !m.actif })}
                      disabled={!m.fichier_url}
                      className={cn('inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-40',
                        m.actif ? 'bg-brand-500' : 'bg-surface-2')}
                      title={m.actif ? 'Désactiver' : 'Activer'}
                    >
                      <span className={cn('h-4 w-4 rounded-full bg-white transition', m.actif ? 'translate-x-4' : 'translate-x-0.5')} />
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      {m.fichier_url && <FileLink bucket="qualiopi" value={m.fichier_url} />}
                      <FileUpload bucket="qualiopi" label={m.fichier_url ? 'Remplacer' : 'Téléverser .docx'} onUploaded={(v) => onUpload(m.type_doc, v)} />
                      {m.fichier_url && (
                        <button onClick={() => setModele(m.type_doc, { fichier_url: null, actif: false })} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-red-500" title="Retirer le modèle">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
