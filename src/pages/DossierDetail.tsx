import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Plus, Trash2, Save, FileCheck2, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, Button, Card, Spinner, Badge, Field, Modal } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import {
  DOSSIER_STATUT_COLORS, DOSSIER_STATUT_LABELS, PIECE_STATUT_COLORS, PIECE_STATUT_LABELS,
} from '@/lib/constants';
import { formatMoney, formatDate } from '@/lib/utils';
import type {
  Dossier, DossierStatut, DossierPiece, PieceStatut, WorkflowEtape, Financeur, PieceVersion,
} from '@/lib/database.types';

const STATUTS: DossierStatut[] = [
  'brouillon', 'montage', 'depose', 'en_instruction', 'accorde', 'refuse', 'en_cours', 'solde', 'cloture',
];
const PIECE_STATUTS: PieceStatut[] = ['manquante', 'recue', 'validee', 'rejetee'];

export default function DossierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [etapes, setEtapes] = useState<WorkflowEtape[]>([]);
  const [pieces, setPieces] = useState<DossierPiece[]>([]);
  const [financeur, setFinanceur] = useState<Financeur | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPiece, setNewPiece] = useState('');
  const [saving, setSaving] = useState(false);
  const [histPiece, setHistPiece] = useState<DossierPiece | null>(null);
  const [versions, setVersions] = useState<PieceVersion[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: d } = await supabase.from('dossiers').select('*').eq('id', id).maybeSingle();
    setDossier(d);
    if (d?.workflow_id) {
      const { data: e } = await supabase.from('workflow_etapes').select('*')
        .eq('workflow_id', d.workflow_id).order('ordre');
      setEtapes(e ?? []);
    } else setEtapes([]);
    if (d?.financeur_id) {
      const { data: f } = await supabase.from('financeurs').select('*').eq('id', d.financeur_id).maybeSingle();
      setFinanceur(f);
    }
    const { data: p } = await supabase.from('dossier_pieces').select('*')
      .eq('dossier_id', id).order('created_at');
    setPieces(p ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (changes: Partial<Dossier>) => {
    if (!dossier) return;
    setDossier({ ...dossier, ...changes });
    await supabase.from('dossiers').update(changes).eq('id', dossier.id);
  };

  const saveMeta = async () => {
    if (!dossier) return;
    setSaving(true);
    await supabase.from('dossiers').update({
      montant_accorde: Number(dossier.montant_accorde ?? 0),
      notes: dossier.notes,
    }).eq('id', dossier.id);
    setSaving(false);
  };

  const setPieceStatut = async (p: DossierPiece, statut: PieceStatut) => {
    setPieces((prev) => prev.map((x) => (x.id === p.id ? { ...x, statut } : x)));
    await supabase.from('dossier_pieces').update({ statut }).eq('id', p.id);
  };

  // Associe (ou retire) un fichier à une pièce. Un nouvel upload remplaçant un
  // fichier existant archive l'ancien dans piece_versions et incrémente la version.
  const setPieceFichier = async (p: DossierPiece, fichier_url: string | null) => {
    const remplace = Boolean(fichier_url && p.fichier_url);
    if (remplace) {
      await supabase.from('piece_versions').insert({
        piece_id: p.id, version: p.version, fichier_url: p.fichier_url, created_by: session?.user.id,
      });
    }
    const version = remplace ? p.version + 1 : p.version;
    const statut: PieceStatut = fichier_url ? (p.statut === 'manquante' ? 'recue' : p.statut) : p.statut;
    setPieces((prev) => prev.map((x) => (x.id === p.id ? { ...x, fichier_url, statut, version } : x)));
    await supabase.from('dossier_pieces').update({ fichier_url, statut, version }).eq('id', p.id);
  };

  const openHistory = async (p: DossierPiece) => {
    const { data } = await supabase.from('piece_versions').select('*')
      .eq('piece_id', p.id).order('version', { ascending: false });
    setVersions(data ?? []);
    setHistPiece(p);
  };

  const addPiece = async () => {
    if (!newPiece.trim() || !dossier) return;
    const { data } = await supabase.from('dossier_pieces')
      .insert({ dossier_id: dossier.id, libelle: newPiece.trim(), obligatoire: true, statut: 'manquante' })
      .select().single();
    if (data) setPieces((prev) => [...prev, data]);
    setNewPiece('');
  };

  const removePiece = async (p: DossierPiece) => {
    await supabase.from('dossier_pieces').delete().eq('id', p.id);
    setPieces((prev) => prev.filter((x) => x.id !== p.id));
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!dossier) return <div className="py-20 text-center text-slate-500">Dossier introuvable.</div>;

  const piecesOk = pieces.filter((p) => p.statut === 'validee').length;

  return (
    <div>
      <button onClick={() => navigate('/dossiers')} className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
      </button>
      <PageHeader
        title={dossier.intitule}
        subtitle={`${dossier.reference}${financeur ? ` · ${financeur.nom}` : ''}`}
        actions={<Badge className={DOSSIER_STATUT_COLORS[dossier.statut]}>{DOSSIER_STATUT_LABELS[dossier.statut]}</Badge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Workflow */}
          <Card>
            <h2 className="mb-4 font-semibold text-slate-900">Workflow du financeur</h2>
            {etapes.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun workflow associé (sélectionnez un financeur).</p>
            ) : (
              <ol className="space-y-2">
                {etapes.map((e) => {
                  const done = e.ordre < dossier.etape_courante;
                  const current = e.ordre === dossier.etape_courante;
                  return (
                    <li key={e.id}>
                      <button
                        onClick={() => patch({ etape_courante: e.ordre })}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                          current ? 'border-brand-500 bg-brand-50' : done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          done ? 'bg-emerald-500 text-white' : current ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {done ? <Check className="h-3.5 w-3.5" /> : e.ordre}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{e.libelle}</p>
                          {e.description && <p className="text-xs text-slate-400">{e.description}</p>}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {/* Pieces */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Pièces justificatives</h2>
              <Badge className="bg-slate-100 text-slate-600">{piecesOk}/{pieces.length} validées</Badge>
            </div>
            <ul className="space-y-2">
              {pieces.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="flex-1 text-sm text-slate-700">{p.libelle}{p.obligatoire && <span className="text-red-400"> *</span>}</span>
                  {p.fichier_url
                    ? <span className="inline-flex items-center gap-2">
                        <FileLink bucket="pieces" value={p.fichier_url} onClear={() => setPieceFichier(p, null)} />
                        <FileUpload bucket="pieces" label="Nouvelle version" onUploaded={(v) => setPieceFichier(p, v)} />
                        {p.version > 1 && (
                          <button onClick={() => openHistory(p)} title="Historique des versions"
                            className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200">
                            <History className="h-3.5 w-3.5" /> v{p.version}
                          </button>
                        )}
                      </span>
                    : <FileUpload bucket="pieces" label="Joindre" onUploaded={(v) => setPieceFichier(p, v)} />}
                  <select
                    className={`rounded-md border-0 px-2 py-1 text-xs font-medium ${PIECE_STATUT_COLORS[p.statut]}`}
                    value={p.statut} onChange={(e) => setPieceStatut(p, e.target.value as PieceStatut)}
                  >
                    {PIECE_STATUTS.map((s) => <option key={s} value={s}>{PIECE_STATUT_LABELS[s]}</option>)}
                  </select>
                  <button onClick={() => removePiece(p)} className="rounded p-1 text-slate-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <input className="input" placeholder="Ajouter une pièce…" value={newPiece}
                onChange={(e) => setNewPiece(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPiece()} />
              <Button variant="secondary" onClick={addPiece}><Plus className="h-4 w-4" /></Button>
            </div>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-semibold text-slate-900">Statut & financement</h2>
            <div className="space-y-4">
              <Field label="Statut du dossier">
                <select className="input" value={dossier.statut} onChange={(e) => patch({ statut: e.target.value as DossierStatut })}>
                  {STATUTS.map((s) => <option key={s} value={s}>{DOSSIER_STATUT_LABELS[s]}</option>)}
                </select>
              </Field>
              <Field label="Montant demandé">
                <div className="input bg-slate-50">{formatMoney(dossier.montant_demande)}</div>
              </Field>
              <Field label="Montant accordé">
                <input className="input" type="number" value={dossier.montant_accorde ?? 0}
                  onChange={(e) => setDossier({ ...dossier, montant_accorde: Number(e.target.value) })} />
              </Field>
              <Field label="Notes">
                <textarea className="input" rows={4} value={dossier.notes ?? ''}
                  onChange={(e) => setDossier({ ...dossier, notes: e.target.value })} />
              </Field>
              <Button onClick={saveMeta} disabled={saving} className="w-full">
                <Save className="h-4 w-4" /> {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={!!histPiece} onClose={() => setHistPiece(null)}
        title={`Historique — ${histPiece?.libelle ?? ''}`}
        footer={<Button variant="secondary" onClick={() => setHistPiece(null)}>Fermer</Button>}
      >
        {histPiece && (
          <ul className="space-y-2">
            <li className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
              <span className="text-sm font-medium text-slate-800">Version {histPiece.version} (actuelle)</span>
              {histPiece.fichier_url && <FileLink bucket="pieces" value={histPiece.fichier_url} />}
            </li>
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-sm text-slate-600">Version {v.version} · {formatDate(v.created_at, 'dd/MM/yyyy HH:mm')}</span>
                {v.fichier_url && <FileLink bucket="pieces" value={v.fichier_url} />}
              </li>
            ))}
            {versions.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Aucune version antérieure.</p>}
          </ul>
        )}
      </Modal>
    </div>
  );
}
