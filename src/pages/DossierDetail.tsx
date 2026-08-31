import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Plus, Trash2, Save, FileCheck2, History, ReceiptText, FileText, Sparkles, FolderArchive, FolderPlus, Paperclip, UserRound, PenLine, Send, Bot, Loader as Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection } from '@/hooks/useCollection';
import { PageHeader, Button, Card, Spinner, Badge, Field, Modal, TONE_BADGE } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import { copyToBucket } from '@/lib/storage';
import ContactFiche from '@/components/ContactFiche';
import SignatureButton from '@/components/SignatureButton';
import ComposeMessageModal, { type ComposeInitial } from '@/components/ComposeMessageModal';
import {
  DOSSIER_STATUT_TONES, DOSSIER_STATUT_LABELS, PIECE_STATUT_TONES, PIECE_STATUT_LABELS,
} from '@/lib/constants';
import { formatMoney, formatDate, fullName } from '@/lib/utils';
import { PIECES_STANDARD } from '@/lib/dossierClient';
import type {
  Dossier, DossierStatut, DossierPiece, PieceStatut, WorkflowEtape, Financeur, PieceVersion,
  Devis, PlanFormation, PlanPdf, Document, ContactDocument, DossierDocument,
  Contact, Entreprise, Profile, Signature as SignatureDemande,
} from '@/lib/database.types';

// « en_instruction » a été fusionné avec « depose » (impossible de savoir si le
// financeur a réellement ouvert l'instruction) — ticket Benjamin.
const STATUTS: DossierStatut[] = [
  'brouillon', 'montage', 'depose', 'accorde', 'refuse', 'en_cours', 'solde', 'cloture',
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
  // Centralisation : production et documents rattachés au dossier client.
  const [devis, setDevis] = useState<Devis[]>([]);
  const [plans, setPlans] = useState<PlanFormation[]>([]);
  const [planPdfs, setPlanPdfs] = useState<PlanPdf[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [coffre, setCoffre] = useState<ContactDocument[]>([]);
  // Contact du dossier : raccourci d'ouverture de sa fiche depuis le dossier.
  const [contact, setContact] = useState<Contact | null>(null);
  const [ficheOpen, setFicheOpen] = useState(false);
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');
  const profiles = useCollection<Profile>('profiles');
  // Autres documents : dépôt libre, distinct des pièces justificatives.
  const [autres, setAutres] = useState<DossierDocument[]>([]);
  const [autreTitre, setAutreTitre] = useState('');
  const [autreDesc, setAutreDesc] = useState('');
  // Demandes de signature électronique rattachées au dossier.
  const [sigs, setSigs] = useState<SignatureDemande[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: d } = await supabase.from('dossiers').select('*').eq('id', id).maybeSingle();
    setDossier(d);
    // Production et documents centralisés dans le dossier client.
    const [{ data: dv }, { data: pl }, { data: dc }] = await Promise.all([
      supabase.from('devis').select('*').eq('dossier_id', id).order('created_at', { ascending: false }),
      supabase.from('plans_formation').select('*').eq('dossier_id', id).order('created_at', { ascending: false }),
      supabase.from('documents').select('*').eq('dossier_id', id).order('created_at', { ascending: false }),
    ]);
    setDevis(dv ?? []);
    setPlans(pl ?? []);
    setDocs(dc ?? []);
    const planIds = (pl ?? []).map((p) => p.id);
    if (planIds.length) {
      const { data: pp } = await supabase.from('plan_pdfs').select('*')
        .in('plan_id', planIds).order('created_at', { ascending: false });
      setPlanPdfs(pp ?? []);
    } else setPlanPdfs([]);
    if (d?.contact_id) {
      const [{ data: cd }, { data: ct }] = await Promise.all([
        supabase.from('contact_documents').select('*')
          .eq('contact_id', d.contact_id).order('created_at', { ascending: false }),
        supabase.from('contacts').select('*').eq('id', d.contact_id).maybeSingle(),
      ]);
      setCoffre(cd ?? []);
      setContact(ct);
    } else { setCoffre([]); setContact(null); }
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
    const { data: ad } = await supabase.from('dossier_documents').select('*')
      .eq('dossier_id', id).order('created_at', { ascending: false });
    setAutres(ad ?? []);
    const { data: sg } = await supabase.from('signatures').select('*')
      .eq('dossier_id', id).order('created_at', { ascending: false });
    setSigs(sg ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (changes: Partial<Dossier>) => {
    if (!dossier) return;
    setDossier({ ...dossier, ...changes });
    const { error } = await supabase.from('dossiers').update(changes).eq('id', dossier.id);
    if (error) { alert(error.message); void load(); }
  };

  const saveMeta = async () => {
    if (!dossier) return;
    setSaving(true);
    const { error } = await supabase.from('dossiers').update({
      // « Montant demandé » était affiché en lecture seule ici alors qu'il est
      // librement saisissable depuis la liste des dossiers : il est désormais
      // éditable des deux côtés (ticket « champ inopérant »).
      montant_demande: Number(dossier.montant_demande ?? 0),
      montant_accorde: Number(dossier.montant_accorde ?? 0),
      notes: dossier.notes,
    }).eq('id', dossier.id);
    setSaving(false);
    if (error) alert(error.message);
  };

  const setPieceStatut = async (p: DossierPiece, statut: PieceStatut) => {
    setPieces((prev) => prev.map((x) => (x.id === p.id ? { ...x, statut } : x)));
    const { error } = await supabase.from('dossier_pieces').update({ statut }).eq('id', p.id);
    if (error) { alert(error.message); void load(); }
  };

  // Associe (ou retire) un fichier à une pièce. Un nouvel upload remplaçant un
  // fichier existant archive l'ancien dans piece_versions et incrémente la version.
  const setPieceFichier = async (p: DossierPiece, fichier_url: string | null) => {
    const remplace = Boolean(fichier_url && p.fichier_url);
    if (remplace) {
      const { error: vErr } = await supabase.from('piece_versions').insert({
        piece_id: p.id, version: p.version, fichier_url: p.fichier_url, created_by: session?.user.id,
      });
      if (vErr) { alert(vErr.message); return; }
    }
    const version = remplace ? p.version + 1 : p.version;
    const statut: PieceStatut = fichier_url ? (p.statut === 'manquante' ? 'recue' : p.statut) : p.statut;
    const { error } = await supabase.from('dossier_pieces').update({ fichier_url, statut, version }).eq('id', p.id);
    if (error) { alert(error.message); void load(); return; }
    setPieces((prev) => prev.map((x) => (x.id === p.id ? { ...x, fichier_url, statut, version } : x)));
  };

  const openHistory = async (p: DossierPiece) => {
    const { data } = await supabase.from('piece_versions').select('*')
      .eq('piece_id', p.id).order('version', { ascending: false });
    setVersions(data ?? []);
    setHistPiece(p);
  };

  const insertPiece = async (libelle: string) => {
    if (!libelle.trim() || !dossier) return;
    const { data, error } = await supabase.from('dossier_pieces')
      .insert({ dossier_id: dossier.id, libelle: libelle.trim(), obligatoire: true, statut: 'manquante' })
      .select().single();
    if (error) { alert(`Ajout impossible : ${error.message}`); return; }
    if (data) setPieces((prev) => [...prev, data]);
  };
  const addPiece = async () => { await insertPiece(newPiece); setNewPiece(''); };

  // ── Coffre-fort → Pièces justificatives ─────────────────────────────────────
  // Une copie du document du coffre est déposée dans la pièce choisie (libellé
  // standard ou libre). Copie et non partage de chemin : les pièces sont relues
  // depuis le bucket « pieces », le fichier doit y être physiquement présent.
  const [versement, setVersement] = useState<ContactDocument | null>(null);
  const [versementLibelle, setVersementLibelle] = useState('');
  const [versementBusy, setVersementBusy] = useState(false);

  // ── Mail au financeur ───────────────────────────────────────────────────────
  // Ouvre la composition avec toutes les pièces du dossier déjà cochées. Le
  // destinataire reste à saisir : `financeurs` ne porte pas d'adresse e-mail.
  const [mailOpen, setMailOpen] = useState(false);
  const [mailInitial, setMailInitial] = useState<ComposeInitial>({});
  const piecesJointes = pieces.filter((p) => p.fichier_url).length;

  const ouvrirMailFinanceur = () => {
    if (!dossier) return;
    const beneficiaire = contact ? fullName(contact.prenom, contact.nom) : '';
    setMailInitial({
      canal: 'email',
      sujet: `Dossier ${dossier.reference}${beneficiaire ? ` — ${beneficiaire}` : ''} : pièces justificatives`,
      corps: [
        'Bonjour,',
        '',
        `Veuillez trouver ci-joint les pièces justificatives du dossier ${dossier.reference} (${dossier.intitule})${beneficiaire ? `, au nom de ${beneficiaire}` : ''}.`,
        '',
        'Je reste à votre disposition pour toute pièce complémentaire.',
        '',
        'Bien cordialement,',
      ].join('\n'),
      dossierId: dossier.id,
      contactId: dossier.contact_id,
      cocherPiecesDossier: true,
    });
    setMailOpen(true);
  };

  const ouvrirVersement = (d: ContactDocument) => {
    setVersement(d);
    // Pré-sélection du libellé standard le plus proche du titre du document.
    const proche = PIECES_STANDARD.find((l) => d.titre.toLowerCase().includes(l.toLowerCase()));
    setVersementLibelle(proche ?? '');
  };

  const verserAuxPieces = async () => {
    const libelle = versementLibelle.trim();
    if (!versement?.fichier_url || !libelle || !dossier) return;
    setVersementBusy(true);
    const { path, error: copieErr } = await copyToBucket('coffre', versement.fichier_url, 'pieces');
    if (copieErr || !path) { setVersementBusy(false); alert(`Copie impossible : ${copieErr ?? 'chemin vide'}`); return; }

    const existante = pieces.find((p) => p.libelle === libelle);
    if (existante) {
      if (existante.fichier_url && !confirm(`La pièce « ${libelle} » contient déjà un fichier (v${existante.version}).\nLe remplacer ? L'ancien reste consultable dans l'historique.`)) {
        setVersementBusy(false); return;
      }
      await setPieceFichier(existante, path);
    } else {
      const { data, error } = await supabase.from('dossier_pieces')
        .insert({ dossier_id: dossier.id, libelle, obligatoire: true, statut: 'recue', fichier_url: path })
        .select().single();
      if (error) { setVersementBusy(false); alert(`Ajout impossible : ${error.message}`); return; }
      if (data) setPieces((prev) => [...prev, data]);
    }
    setVersementBusy(false);
    setVersement(null);
  };
  // Pièces standard non présentes → ajoutables en un clic (ré-ajout d'une pièce
  // supprimée par erreur, ou pièce propre au financeur du dossier).
  const missingStd = PIECES_STANDARD.filter((l) => !pieces.some((p) => p.libelle === l));

  const removeDossier = async () => {
    if (!dossier) return;
    if (!confirm(`Supprimer définitivement le dossier « ${dossier.intitule} » (${dossier.reference}) ?\nCette action est irréversible.`)) return;
    const { error } = await supabase.from('dossiers').delete().eq('id', dossier.id);
    if (error) { alert(`Suppression impossible : ${error.message}`); return; }
    navigate('/dossiers');
  };

  const removePiece = async (p: DossierPiece) => {
    const { error } = await supabase.from('dossier_pieces').delete().eq('id', p.id);
    if (error) { alert(error.message); return; }
    setPieces((prev) => prev.filter((x) => x.id !== p.id));
  };

  // ── Autres documents : dépôt libre, hors checklist du financeur ─────────────
  const addAutreDoc = async (fichier_url: string, file?: File) => {
    if (!dossier) return;
    const { data, error } = await supabase.from('dossier_documents').insert({
      dossier_id: dossier.id,
      titre: autreTitre.trim() || file?.name || 'Document',
      description: autreDesc.trim() || null,
      fichier_url,
      created_by: session?.user.id ?? null,
    }).select().single();
    if (error) { alert(`Ajout impossible : ${error.message}`); return; }
    if (data) setAutres((prev) => [data, ...prev]);
    setAutreTitre(''); setAutreDesc('');
  };

  // Renvoi du code au signataire, sans recréer de demande : le lien reste le même.
  const [relanceId, setRelanceId] = useState<string | null>(null);
  const relancerSignature = async (s: SignatureDemande) => {
    setRelanceId(s.id);
    const { data, error } = await supabase.functions.invoke('signature', {
      body: { action: 'code', token: s.token },
    });
    setRelanceId(null);
    if (error) { alert("Envoi impossible. Vérifiez la configuration SMTP."); return; }
    const err = (data as { error?: string } | null)?.error;
    if (err) { alert(err); return; }
    void load();
    alert(`Nouveau code envoyé à ${s.signataire_email}.`);
  };

  const removeAutreDoc = async (d: DossierDocument) => {
    if (!confirm(`Retirer « ${d.titre} » des autres documents ?`)) return;
    const { error } = await supabase.from('dossier_documents').delete().eq('id', d.id);
    if (error) { alert(error.message); return; }
    setAutres((prev) => prev.filter((x) => x.id !== d.id));
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (!dossier) return <div className="py-20 text-center text-muted">Dossier introuvable.</div>;

  const piecesOk = pieces.filter((p) => p.statut === 'validee').length;

  return (
    <div>
      <button onClick={() => navigate('/dossiers')} className="mb-3 flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
      </button>
      <PageHeader
        title={dossier.intitule}
        subtitle={`${dossier.reference}${financeur ? ` · ${financeur.nom}` : ''}`}
        actions={
          <>
            <Button variant="ghost" title="Ouvrir l'assistant IA sur ce dossier"
              onClick={() => navigate('/assistant', { state: { assistantContexte: { type: 'dossier', id: dossier.id, label: `${dossier.reference} — ${dossier.intitule}` } } })}>
              <Bot className="h-4 w-4" /> Assistant
            </Button>
            {contact && (
              <Button variant="secondary" onClick={() => setFicheOpen(true)} title="Ouvrir la fiche du contact">
                <UserRound className="h-4 w-4" /> {fullName(contact.prenom, contact.nom)}
              </Button>
            )}
            <Badge tone={DOSSIER_STATUT_TONES[dossier.statut]}>{DOSSIER_STATUT_LABELS[dossier.statut]}</Badge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Workflow */}
          <Card>
            <h2 className="mb-4 font-semibold text-fg">Workflow du financeur</h2>
            {etapes.length === 0 ? (
              <p className="text-sm text-muted">Aucun workflow associé (sélectionnez un financeur).</p>
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
                          current ? 'border-brand-500 bg-brand-500/5' : done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-line hover:bg-surface-2'
                        }`}
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          done ? 'bg-emerald-500 text-white' : current ? 'bg-brand-600 text-white' : 'bg-surface-2 text-muted'
                        }`}>
                          {done ? <Check className="h-3.5 w-3.5" /> : e.ordre}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-fg">{e.libelle}</p>
                          {e.description && <p className="text-xs text-muted">{e.description}</p>}
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-fg">Pièces justificatives</h2>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={ouvrirMailFinanceur} disabled={piecesJointes === 0}
                  title={piecesJointes === 0
                    ? 'Aucune pièce ne porte de fichier à joindre'
                    : `Rédiger un mail avec les ${piecesJointes} pièce(s) du dossier en pièces jointes`}>
                  <Send className="h-4 w-4" /> Mail au financeur
                </Button>
                <Badge className="bg-surface-2 text-muted">{piecesOk}/{pieces.length} validées</Badge>
              </div>
            </div>
            <ul className="space-y-2">
              {pieces.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-muted" />
                  <span className="flex-1 text-sm text-fg">{p.libelle}{p.obligatoire && <span className="text-red-400"> *</span>}</span>
                  {p.fichier_url
                    ? <span className="inline-flex items-center gap-2">
                        <FileLink bucket="pieces" value={p.fichier_url} onClear={() => setPieceFichier(p, null)} />
                        <SignatureButton
                          libelle={`${p.libelle} — ${dossier.reference}`}
                          bucket="pieces" fichierUrl={p.fichier_url}
                          dossierId={dossier.id} contactId={dossier.contact_id}
                          defautNom={contact ? fullName(contact.prenom, contact.nom) : ''}
                          defautEmail={contact?.email ?? ''}
                          onDone={() => void load()}
                        />
                        <FileUpload bucket="pieces" label="Nouvelle version" onUploaded={(v) => setPieceFichier(p, v)} />
                        {p.version > 1 && (
                          <button onClick={() => openHistory(p)} title="Historique des versions"
                            className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted hover:bg-surface-2">
                            <History className="h-3.5 w-3.5" /> v{p.version}
                          </button>
                        )}
                      </span>
                    : <FileUpload bucket="pieces" label="Joindre" onUploaded={(v) => setPieceFichier(p, v)} />}
                  <select
                    className={`rounded-md border-0 px-2 py-1 text-xs font-medium ${TONE_BADGE[PIECE_STATUT_TONES[p.statut]]}`}
                    value={p.statut} onChange={(e) => setPieceStatut(p, e.target.value as PieceStatut)}
                  >
                    {PIECE_STATUTS.map((s) => <option key={s} value={s}>{PIECE_STATUT_LABELS[s]}</option>)}
                  </select>
                  <button onClick={() => removePiece(p)} className="rounded p-1 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <input className="input min-w-[160px] flex-1" placeholder="Ajouter une pièce…" value={newPiece}
                onChange={(e) => setNewPiece(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addPiece()} />
              <Button variant="secondary" onClick={addPiece}><Plus className="h-4 w-4" /></Button>
              {missingStd.length > 0 && (
                <select className="input max-w-[260px]" value="" onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v) void insertPiece(v); }} title="Ajouter une pièce au libellé standard">
                  <option value="">+ Pièce standard…</option>
                  {missingStd.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
            </div>
          </Card>

          {/* Autres documents : dépôt libre, hors dossier financeur */}
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-fg">
                <Paperclip className="h-4 w-4 text-brand-500" /> Autres documents
              </h2>
              <Badge className="bg-surface-2 text-muted">{autres.length}</Badge>
            </div>
            <p className="mb-4 text-sm text-muted">
              Documents informatifs, brouillons, versions non finalisées… Ils n'entrent pas dans
              la checklist du financeur et ne comptent pas dans les pièces validées.
            </p>

            {autres.length === 0 ? (
              <p className="mb-3 text-xs text-muted">Aucun document pour l'instant.</p>
            ) : (
              <ul className="mb-3 space-y-1.5">
                {autres.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-fg">{d.titre}</span>
                      <span className="block truncate text-xs text-muted">
                        {d.description ? `${d.description} · ` : ''}{formatDate(d.created_at, 'dd/MM/yyyy HH:mm')}
                      </span>
                    </span>
                    {d.fichier_url && <FileLink bucket="pieces" value={d.fichier_url} />}
                    <SignatureButton
                      libelle={`${d.titre} — ${dossier.reference}`}
                      bucket="pieces" fichierUrl={d.fichier_url}
                      dossierId={dossier.id} contactId={dossier.contact_id}
                      defautNom={contact ? fullName(contact.prenom, contact.nom) : ''}
                      defautEmail={contact?.email ?? ''}
                      onDone={() => void load()}
                    />
                    <button onClick={() => removeAutreDoc(d)} title="Retirer ce document"
                      className="rounded p-1 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-lg border border-dashed border-line p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input className="input" placeholder="Titre (par défaut : nom du fichier)" value={autreTitre}
                  onChange={(e) => setAutreTitre(e.target.value)} />
                <input className="input" placeholder="Description (optionnelle)" value={autreDesc}
                  onChange={(e) => setAutreDesc(e.target.value)} />
              </div>
              <div className="mt-2">
                <FileUpload bucket="pieces" label="Déposer un document" onUploaded={addAutreDoc} />
              </div>
            </div>
          </Card>

          {/* Suivi des signatures électroniques du dossier */}
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-fg">
                <PenLine className="h-4 w-4 text-brand-500" /> Signatures électroniques
              </h2>
              <Badge className="bg-surface-2 text-muted">
                {sigs.filter((s) => s.statut === 'signee').length}/{sigs.length} signée(s)
              </Badge>
            </div>
            <p className="mb-4 text-sm text-muted">
              Demandes envoyées depuis les pièces du dossier ou les documents générés.
              Le bouton stylo, sur une pièce, lance une nouvelle demande.
            </p>
            {sigs.length === 0 ? (
              <p className="text-xs text-muted">Aucune demande de signature pour ce dossier.</p>
            ) : (
              <ul className="space-y-1.5">
                {sigs.map((s) => {
                  const perime = s.statut === 'en_attente' && new Date(s.expire_at) < new Date();
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-fg">{s.libelle}</p>
                        <p className="truncate text-xs text-muted">
                          {s.signataire_nom} · {s.signataire_email}
                          {s.statut === 'signee' && s.signe_at
                            ? ` · signé le ${formatDate(s.signe_at, 'dd/MM/yyyy HH:mm')}`
                            : ` · expire le ${formatDate(s.expire_at)}`}
                        </p>
                      </div>
                      {s.statut === 'signee'
                        ? <Badge tone="success">Signé</Badge>
                        : perime ? <Badge tone="danger">Lien expiré</Badge> : <Badge tone="warning">En attente</Badge>}
                      {s.statut === 'signee' && s.fichier_signe_url && (
                        <FileLink bucket={s.bucket as 'pieces'} value={s.fichier_signe_url} />
                      )}
                      {s.statut === 'en_attente' && (
                        <button
                          onClick={() => relancerSignature(s)}
                          disabled={relanceId === s.id}
                          title="Renvoyer le code au signataire"
                          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-brand-600 hover:bg-brand-500/10 disabled:opacity-40 dark:text-brand-400"
                        >
                          <Send className="h-3.5 w-3.5" /> {relanceId === s.id ? 'Envoi…' : 'Renvoyer'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Centralisation client : production générée + documents téléversés */}
          <Card>
            <h2 className="mb-1 flex items-center gap-2 font-semibold text-fg">
              <FolderArchive className="h-4 w-4 text-brand-500" /> Centralisation client
            </h2>
            <p className="mb-4 text-sm text-muted">
              Toute la production générée et les documents téléversés pour ce prospect, regroupés ici automatiquement.
            </p>
            <div className="space-y-5">
              {/* Devis */}
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-fg"><ReceiptText className="h-4 w-4 text-muted" /> Devis ({devis.length})</p>
                {devis.length === 0 ? <p className="text-xs text-muted">Aucun devis.</p> : (
                  <ul className="space-y-1.5">
                    {devis.map((dv) => (
                      <li key={dv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                        <span className="text-fg">{dv.numero}{dv.objet ? ` · ${dv.objet}` : ''}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-muted">{formatMoney(dv.total_ht)}</span>
                          {dv.fichier_url && <FileLink bucket="devis" value={dv.fichier_url} />}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Plans de formation */}
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-fg"><FileText className="h-4 w-4 text-muted" /> Plans de formation ({plans.length})</p>
                {plans.length === 0 ? <p className="text-xs text-muted">Aucun plan.</p> : (
                  <ul className="space-y-1.5">
                    {plans.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                        <span className="text-fg">{p.nom} <span className="text-xs text-muted">v{p.version} · {p.duree_heures} h</span></span>
                        <Badge tone="brand">{p.statut}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* PDF générés (via les plans du dossier) */}
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-fg"><Sparkles className="h-4 w-4 text-muted" /> PDF générés ({planPdfs.length})</p>
                {planPdfs.length === 0 ? <p className="text-xs text-muted">Aucun PDF généré.</p> : (
                  <ul className="space-y-1.5">
                    {planPdfs.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                        <span className="text-fg">{d.titre} <span className="text-xs text-muted">{formatDate(d.created_at, 'dd/MM/yyyy HH:mm')}</span></span>
                        {d.fichier_url && <FileLink bucket="plans" value={d.fichier_url} />}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Documents téléversés */}
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-fg"><FileText className="h-4 w-4 text-muted" /> Documents ({docs.length})</p>
                {docs.length === 0 ? <p className="text-xs text-muted">Aucun document.</p> : (
                  <ul className="space-y-1.5">
                    {docs.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                        <span className="text-fg">{d.titre} <span className="text-xs text-muted">{d.categorie} · v{d.version}</span></span>
                        {d.fichier_url && <FileLink bucket="documents" value={d.fichier_url} />}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Coffre-fort du contact */}
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-fg"><FolderArchive className="h-4 w-4 text-muted" /> Coffre-fort du contact ({coffre.length})</p>
                {coffre.length === 0 ? <p className="text-xs text-muted">Aucune pièce.</p> : (
                  <ul className="space-y-1.5">
                    {coffre.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                        <span className="text-fg">{d.titre}{d.categorie ? <span className="text-xs text-muted"> · {d.categorie}</span> : null}</span>
                        <span className="flex items-center gap-2">
                          {d.fichier_url && <FileLink bucket="coffre" value={d.fichier_url} />}
                          {d.fichier_url && (
                            <button onClick={() => ouvrirVersement(d)} title="Copier ce document dans les pièces justificatives"
                              className="rounded p-1 text-muted transition hover:text-brand-600">
                              <FolderPlus className="h-4 w-4" />
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 font-semibold text-fg">Statut & financement</h2>
            <div className="space-y-4">
              <Field label="Statut du dossier">
                <select className="input" value={dossier.statut} onChange={(e) => patch({ statut: e.target.value as DossierStatut })}>
                  {STATUTS.map((s) => <option key={s} value={s}>{DOSSIER_STATUT_LABELS[s]}</option>)}
                </select>
              </Field>
              <Field label="Montant demandé (€)">
                <input className="input" type="number" value={dossier.montant_demande ?? 0}
                  onChange={(e) => setDossier({ ...dossier, montant_demande: Number(e.target.value) })} />
              </Field>
              <Field label="Montant accordé (€)">
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
              <button onClick={removeDossier}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" /> Supprimer le dossier
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Fiche du contact du dossier, ouverte en surcouche */}
      {ficheOpen && contact && (
        <ContactFiche
          key={contact.id}
          contact={contact}
          entreprises={entreprises.data}
          financeurs={financeurs.data}
          profiles={profiles.data}
          onClose={() => setFicheOpen(false)}
          onEdit={() => { setFicheOpen(false); navigate('/contacts'); }}
          onUpdated={() => void load()}
        />
      )}

      <Modal
        open={!!histPiece} onClose={() => setHistPiece(null)}
        title={`Historique — ${histPiece?.libelle ?? ''}`}
        footer={<Button variant="secondary" onClick={() => setHistPiece(null)}>Fermer</Button>}
      >
        {histPiece && (
          <ul className="space-y-2">
            <li className="flex items-center justify-between rounded-lg border border-brand-500/30 bg-brand-500/5 px-3 py-2">
              <span className="text-sm font-medium text-fg">Version {histPiece.version} (actuelle)</span>
              {histPiece.fichier_url && <FileLink bucket="pieces" value={histPiece.fichier_url} />}
            </li>
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                <span className="text-sm text-muted">Version {v.version} · {formatDate(v.created_at, 'dd/MM/yyyy HH:mm')}</span>
                {v.fichier_url && <FileLink bucket="pieces" value={v.fichier_url} />}
              </li>
            ))}
            {versions.length === 0 && <p className="py-4 text-center text-sm text-muted">Aucune version antérieure.</p>}
          </ul>
        )}
      </Modal>

      {/* Coffre-fort → pièce justificative : choix du libellé de la pièce cible. */}
      <Modal
        open={!!versement} onClose={() => setVersement(null)}
        title="Copier dans les pièces justificatives"
        footer={
          <>
            <Button variant="secondary" onClick={() => setVersement(null)}>Annuler</Button>
            <Button onClick={() => void verserAuxPieces()} disabled={versementBusy || !versementLibelle.trim()}>
              {versementBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />} Copier
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          Une copie de <strong className="text-fg">{versement?.titre}</strong> sera déposée dans la pièce ci-dessous.
          L'original reste dans le coffre-fort du contact.
        </p>
        <Field label="Pièce justificative" hint="Un libellé standard, ou le vôtre">
          <select className="input mb-2" value={PIECES_STANDARD.includes(versementLibelle) ? versementLibelle : ''}
            onChange={(e) => setVersementLibelle(e.target.value)}>
            <option value="">— Libellé libre —</option>
            {PIECES_STANDARD.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <input className="input" value={versementLibelle} placeholder="Intitulé de la pièce…"
            onChange={(e) => setVersementLibelle(e.target.value)} />
        </Field>
      </Modal>

      {/* Mail au financeur : pièces du dossier jointes d'office. */}
      <ComposeMessageModal
        open={mailOpen} onClose={() => setMailOpen(false)} initial={mailInitial}
        onSent={() => void load()}
      />
    </div>
  );
}
