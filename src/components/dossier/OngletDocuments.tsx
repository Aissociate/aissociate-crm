import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSignature, FileText, Sparkles, Plus, Loader as Loader2, ClipboardCheck, Send, Copy, Check,
  FolderCheck, ExternalLink, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection } from '@/hooks/useCollection';
import { functionErrorMessage } from '@/lib/invokeError';
import { generatePlanPdf } from '@/lib/generatePlanPdf';
import { GENERABLE_DOC_TYPES, DOC_STATUT_LABELS, DOC_STATUT_TONES } from '@/lib/qualiopi';
import { Button, Card, Badge, Field, SearchSelect } from '@/components/ui';
import { FileLink } from '@/components/FileUpload';
import AddToDossierButton from '@/components/AddToDossierButton';
import ComposeMessageModal, { type ComposeInitial } from '@/components/ComposeMessageModal';
import ConventionPositionnementModal, { type StagiaireDossier } from '@/components/ConventionPositionnementModal';
import { formatDate, fullName } from '@/lib/utils';
import type {
  Dossier, Contact, DossierPiece, Formation, PlanFormation, PlanPdf, Positionnement as Pos,
  PositionnementLien, SessionFormation, SessionParticipant, QualiopiDossierDoc, QualiopiModeleDoc,
} from '@/lib/database.types';

/**
 * Onglet « Documents à générer » du dossier client : convention, plan
 * individuel de formation, et le reste de la paperasse (documents AGEFICE,
 * justificatifs Qualiopi des sessions, test de positionnement).
 *
 * Tout ce qui est produit ici se dépose d'un clic dans les pièces du dossier
 * (bouton dossier) et reste listé dans Plans de formation.
 */

// Documents AGEFICE produits depuis un plan, et la pièce du dossier qu'ils renseignent.
const AGEFICE: { kind: 'demande' | 'emargement' | 'attestation'; label: string; piece: string }[] = [
  { kind: 'demande', label: 'Demande préalable de financement (AGEFICE)', piece: 'Demande de prise en charge' },
  { kind: 'emargement', label: "Feuille d'émargement (AGEFICE)", piece: "Feuille d'émargement" },
  { kind: 'attestation', label: "Attestation d'assiduité et de règlement (AGEFICE)", piece: "Attestation d'assiduité" },
];
const PIECE_POUR: Record<string, string> = {
  plan: 'Programme de formation', convention: 'Convention / contrat de formation',
  ...Object.fromEntries(AGEFICE.map((a) => [a.kind, a.piece])),
};
const LIBELLE_KIND: Record<string, string> = {
  plan: 'Plan', convention: 'Convention', demande: 'Demande AGEFICE', emargement: 'Émargement', attestation: 'Attestation',
};

/** Module du catalogue { titre, contenu } en ligne de plan « Titre — contenu ». */
const ligneModule = (m: unknown): string => {
  if (m && typeof m === 'object') {
    const o = m as { titre?: string; contenu?: string };
    return [o.titre, o.contenu].filter(Boolean).join(' — ');
  }
  return String(m ?? '');
};

export default function OngletDocuments({
  dossier, contact, pieces, onChanged,
}: {
  dossier: Dossier;
  contact: Contact | null;
  pieces: DossierPiece[];
  /** À appeler quand une pièce du dossier a pu changer. */
  onChanged: () => void;
}) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const formations = useCollection<Formation>('formations', { orderBy: { column: 'intitule', ascending: true } });
  const toutesSessions = useCollection<SessionFormation>('sessions_formation', { orderBy: { column: 'date_debut', ascending: false } });
  const contacts = useCollection<Contact>('contacts');
  const tousDossiers = useCollection<Dossier>('dossiers');
  const modeles = useCollection<QualiopiModeleDoc>('qualiopi_modeles_doc');

  const [plans, setPlans] = useState<PlanFormation[]>([]);
  const [pdfs, setPdfs] = useState<PlanPdf[]>([]);
  const [positionnements, setPositionnements] = useState<Pos[]>([]);
  const [liens, setLiens] = useState<PositionnementLien[]>([]);
  const [participations, setParticipations] = useState<SessionParticipant[]>([]);
  const [qDocs, setQDocs] = useState<QualiopiDossierDoc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [conventionOpen, setConventionOpen] = useState(false);
  const [planAgefice, setPlanAgefice] = useState('');
  const [mail, setMail] = useState<{ initial: ComposeInitial; lienId: string } | null>(null);
  const [copie, setCopie] = useState<string | null>(null);

  const entrepriseId = dossier.entreprise_id ?? contact?.entreprise_id ?? null;
  const formation = formations.data.find((f) => f.id === dossier.formation_id) ?? null;

  const charger = useCallback(async () => {
    // Plans du dossier, et ceux du bénéficiaire sur la même formation.
    const [{ data: parDossier }, { data: parContact }] = await Promise.all([
      supabase.from('plans_formation').select('*').eq('dossier_id', dossier.id),
      dossier.contact_id && dossier.formation_id
        ? supabase.from('plans_formation').select('*').eq('contact_id', dossier.contact_id).eq('formation_id', dossier.formation_id)
        : Promise.resolve({ data: [] as PlanFormation[] }),
    ]);
    const tous = [...(parDossier ?? []), ...((parContact ?? []) as PlanFormation[])]
      .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    setPlans(tous);
    setPlanAgefice((cur) => cur || tous[0]?.id || '');
    if (tous.length) {
      const { data } = await supabase.from('plan_pdfs').select('*').in('plan_id', tous.map((p) => p.id))
        .order('created_at', { ascending: false });
      setPdfs(data ?? []);
    } else setPdfs([]);

    // Positionnement : réponses et liens du bénéficiaire ou du dossier.
    const filtre = [`dossier_id.eq.${dossier.id}`, dossier.contact_id ? `contact_id.eq.${dossier.contact_id}` : ''].filter(Boolean).join(',');
    const [{ data: pos }, { data: li }] = await Promise.all([
      supabase.from('positionnements').select('*').or(filtre).order('completed_at', { ascending: false }),
      supabase.from('positionnement_liens').select('*').or(filtre).order('created_at', { ascending: false }),
    ]);
    setPositionnements(pos ?? []);
    setLiens(li ?? []);

    // Qualiopi : sessions où le bénéficiaire est inscrit → justificatifs.
    if (dossier.contact_id) {
      const { data: parts } = await supabase.from('session_participants').select('*').eq('contact_id', dossier.contact_id);
      setParticipations(parts ?? []);
      const sessionIds = [...new Set((parts ?? []).map((p) => p.session_id))];
      if (sessionIds.length) {
        const { data: qd } = await supabase.from('qualiopi_dossier_docs').select('*').in('session_id', sessionIds);
        const miens = new Set((parts ?? []).map((p) => p.id));
        setQDocs((qd ?? []).filter((d) => !d.participant_id || miens.has(d.participant_id)));
      } else setQDocs([]);
    } else { setParticipations([]); setQDocs([]); }
  }, [dossier.id, dossier.contact_id, dossier.formation_id]);

  useEffect(() => { void charger(); }, [charger]);

  const appeler = async (cle: string, fn: () => Promise<void>) => {
    setBusy(cle); setErreur(null); setInfo(null);
    try { await fn(); await charger(); }
    catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };
  const invoquer = async (nom: string, body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke(nom, { body });
    if (error) throw new Error(await functionErrorMessage(error));
    const err = (data as { error?: string } | null)?.error;
    if (err) throw new Error(err);
    return data as Record<string, unknown>;
  };

  // ── Convention : stagiaires de l'entreprise sur la même formation ──────────
  const autresDossiers = useMemo(() => (entrepriseId && dossier.formation_id
    ? tousDossiers.data.filter((d) => d.entreprise_id === entrepriseId && d.formation_id === dossier.formation_id)
    : []).concat(tousDossiers.data.filter((d) => d.id === dossier.id))
    .filter((d, i, a) => a.findIndex((x) => x.id === d.id) === i), [tousDossiers.data, entrepriseId, dossier.id, dossier.formation_id]);
  const contactsConcernes = new Set(autresDossiers.map((d) => d.contact_id).filter(Boolean) as string[]);
  // Répondants au test parmi eux (dernière réponse de chacun), les autres sans positionnement.
  const [reponsesGroupe, setReponsesGroupe] = useState<Pos[]>([]);
  useEffect(() => {
    const ids = [...contactsConcernes];
    if (!conventionOpen || !ids.length) { setReponsesGroupe([]); return; }
    void supabase.from('positionnements').select('*').in('contact_id', ids).order('completed_at', { ascending: false })
      .then(({ data }) => setReponsesGroupe((data ?? []).filter((p, i, a) => a.findIndex((x) => x.contact_id === p.contact_id) === i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conventionOpen, autresDossiers.length]);
  const sansPositionnement: StagiaireDossier[] = autresDossiers
    .filter((d) => d.contact_id && !reponsesGroupe.some((p) => p.contact_id === d.contact_id))
    .map((d) => {
      const c = contacts.data.find((x) => x.id === d.contact_id);
      return { id: `dossier-${d.id}`, nom: c ? fullName(c.prenom, c.nom) : d.intitule, contact_id: d.contact_id, dossier_id: d.id };
    });
  const sessionDossier = toutesSessions.data.find((s) => s.dossier_id === dossier.id)
    ?? toutesSessions.data.find((s) => participations.some((p) => p.session_id === s.id));

  const conventions = pdfs.filter((d) => d.kind === 'convention');
  const pieceConvention = pieces.find((p) => p.libelle === 'Convention / contrat de formation');

  // ── Plan individuel ────────────────────────────────────────────────────────
  const creerPlanCatalogue = () => appeler('plan-catalogue', async () => {
    if (!formation) throw new Error("Le dossier n'a pas de formation : renseignez-la pour partir du catalogue.");
    const { error } = await supabase.from('plans_formation').insert({
      nom: `Plan — ${formation.intitule}${contact ? ` — ${fullName(contact.prenom, contact.nom)}` : ''}`,
      formation_id: formation.id, contact_id: dossier.contact_id, entreprise_id: entrepriseId,
      dossier_id: dossier.id, financeur_id: dossier.financeur_id,
      objectifs: formation.objectifs, contenu: (formation.programme ?? []).map(ligneModule),
      duree_heures: formation.duree_heures, modalite: formation.modalite && ['presentiel', 'distanciel', 'mixte', 'e-learning'].includes(formation.modalite) ? formation.modalite : 'presentiel',
      statut: 'brouillon', version: 1, owner_id: userId,
    });
    if (error) throw new Error(error.message);
    setInfo('Plan créé depuis le catalogue. Mettez-le en PDF, ou ajustez-le dans Plans de formation.');
  });

  const planParIA = () => appeler('plan-ia', async () => {
    if (!dossier.formation_id) throw new Error("Le dossier n'a pas de formation.");
    if (!positionnements.length) throw new Error("Aucun positionnement : envoyez d'abord le test au bénéficiaire.");
    const res = await invoquer('plan-positionnement', {
      formationId: dossier.formation_id, positionnementIds: [positionnements[0].id],
      dossierId: dossier.id, entrepriseId, userId,
    });
    setInfo(`Plan rédigé par l'IA : ${res.nom as string}. Mettez-le en PDF pour le déposer au dossier.`);
  });

  const planEnPdf = (p: PlanFormation) => appeler(`pdf-${p.id}`, async () => {
    await generatePlanPdf({
      planId: p.id,
      contexte: {
        nom: p.nom, objectifs: p.objectifs, contenu: p.contenu, duree_heures: p.duree_heures,
        modalite: p.modalite, dates_session: p.dates_session, formation: formation?.intitule,
        apprenant: contact ? fullName(contact.prenom, contact.nom) : '',
      },
      apprenant: contact ? fullName(contact.prenom, contact.nom) : '',
      organismePartenaire: '', datesSession: p.dates_session, clientSiret: contact?.siret ?? null,
      userId, contactId: dossier.contact_id, entrepriseId, financeurId: dossier.financeur_id,
    });
    setInfo('PDF du plan produit.');
  });

  // ── AGEFICE ────────────────────────────────────────────────────────────────
  const genererAgefice = (kind: string) => appeler(`agefice-${kind}`, async () => {
    if (!planAgefice) throw new Error('Choisissez (ou créez) le plan de formation du dossier.');
    await invoquer('generate-agefice', { planId: planAgefice, type: kind, userId });
    setInfo('Document produit : déposez-le dans les pièces avec le bouton dossier.');
  });

  // ── Qualiopi ───────────────────────────────────────────────────────────────
  const modelTypes = new Set(modeles.data.filter((m) => m.actif && m.fichier_url).map((m) => m.type_doc));
  const genererQualiopi = (d: QualiopiDossierDoc) => appeler(`q-${d.id}`, async () => {
    await invoquer(modelTypes.has(d.type_doc) ? 'qualiopi-doc-tpl' : 'qualiopi-doc', { docId: d.id });
  });
  const preparerQualiopi = () => appeler('q-prep', async () => {
    for (const sid of [...new Set(participations.map((p) => p.session_id))]) {
      const { error } = await supabase.rpc('qualiopi_prepare_session', { p_session: sid });
      if (error) throw new Error(error.message);
    }
  });

  // ── Positionnement ─────────────────────────────────────────────────────────
  const urlLien = (token: string) => `${window.location.origin}/positionnement/${token}`;
  const envoyerTest = () => appeler('pos-lien', async () => {
    if (!contact) throw new Error('Le dossier n’a pas de bénéficiaire.');
    let lien = liens.find((l) => !l.multi && l.actif && l.statut !== 'complete');
    if (!lien) {
      const { data, error } = await supabase.from('positionnement_liens').insert({
        contact_id: contact.id, destinataire_nom: fullName(contact.prenom, contact.nom),
        destinataire_email: contact.email, dossier_id: dossier.id,
        formation_intitule: formation?.intitule ?? null, created_by: userId,
      }).select().single();
      if (error) throw new Error(error.message);
      lien = data as PositionnementLien;
    }
    const url = urlLien(lien.token);
    setMail({
      lienId: lien.id,
      initial: {
        canal: 'email', dest: contact.email ?? '', contactId: contact.id, dossierId: dossier.id,
        sujet: lien.libelle,
        corps: [
          `Bonjour ${fullName(contact.prenom, contact.nom)},`, '',
          "Avant votre formation, merci de compléter votre test de positionnement (15 à 20 minutes). Il n'y a pas de note : ce questionnaire sert à adapter le contenu et les cas pratiques à votre niveau réel.", '',
          `Compléter mon positionnement : ${url}`, '', 'Merci,', "L'équipe Aissociate",
        ].join('\n'),
      },
    });
  });
  const copierLien = async (token: string) => {
    try { await navigator.clipboard.writeText(urlLien(token)); setCopie(token); setTimeout(() => setCopie(null), 1500); }
    catch { setErreur('Copie impossible : sélectionnez le lien à la main.'); }
  };

  const optionsPlans = plans.map((p) => ({ value: p.id, label: p.nom, sub: `${p.duree_heures} h · ${formatDate(p.created_at)}` }));
  const pdfsDe = (kind: string) => pdfs.filter((d) => d.kind === kind);
  const ligneDoc = (d: PlanPdf) => (
    <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
      <Badge tone="info">{LIBELLE_KIND[d.kind] ?? d.kind}</Badge>
      <span className="min-w-0 flex-1 truncate text-fg">{d.titre}</span>
      <span className="text-xs text-muted">{formatDate(d.created_at, 'dd/MM/yyyy HH:mm')}</span>
      {d.fichier_url && <FileLink bucket="plans" value={d.fichier_url} />}
      <AddToDossierButton
        contactId={dossier.contact_id} dossiers={[dossier]} cibles={[dossier]}
        fichierUrl={d.fichier_url} sourceBucket="plans"
        pieceLibelle={PIECE_POUR[d.kind] ?? 'Programme de formation'}
        documentLabel={(LIBELLE_KIND[d.kind] ?? 'document').toLowerCase()}
        onDone={onChanged}
      />
    </li>
  );

  return (
    <div className="space-y-6">
      {erreur && <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{erreur}</div>}
      {info && <div className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{info}</div>}

      {/* ── Convention ── */}
      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-fg"><FileSignature className="h-4 w-4 text-brand-500" /> Générer une convention</h2>
          <Button onClick={() => setConventionOpen(true)}><FileSignature className="h-4 w-4" /> Générer la convention</Button>
        </div>
        <p className="mb-3 text-sm text-muted">
          Convention au modèle de l'organisme, conclue avec l'entreprise. Les autres apprenants de l'entreprise sur
          cette formation ({Math.max(0, autresDossiers.length - 1)}) peuvent figurer dans l'effectif. Le plan, la durée,
          le lieu et le prix se règlent dans la fenêtre ; l'IA peut rédiger le plan d'après le positionnement.
        </p>
        <p className="mb-2 flex items-center gap-2 text-xs text-muted">
          <FolderCheck className="h-3.5 w-3.5" /> Pièce « Convention / contrat de formation » :{' '}
          {pieceConvention?.fichier_url ? <FileLink bucket="pieces" value={pieceConvention.fichier_url} /> : 'pas encore déposée'}
        </p>
        {conventions.length > 0 && <ul className="space-y-1.5">{conventions.map(ligneDoc)}</ul>}
      </Card>

      {/* ── Plan individuel ── */}
      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-fg"><FileText className="h-4 w-4 text-brand-500" /> Plan individuel de formation</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void creerPlanCatalogue()} disabled={!!busy}
              title="Crée le plan à partir de la formation du catalogue">
              {busy === 'plan-catalogue' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Depuis le catalogue
            </Button>
            <Button variant="secondary" onClick={() => void planParIA()} disabled={!!busy || !positionnements.length}
              title={positionnements.length ? "L'IA adapte le plan au positionnement du bénéficiaire" : 'Aucun positionnement pour ce bénéficiaire'}>
              {busy === 'plan-ia' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Rédiger par l'IA
            </Button>
          </div>
        </div>
        <p className="mb-3 text-sm text-muted">
          Formation : {formation?.intitule ?? <em>non renseignée sur le dossier</em>}
          {positionnements[0] ? ` · positionnement : ${positionnements[0].niveau ?? '—'} (${positionnements[0].pct ?? 0} %)` : ''}
        </p>
        {plans.length === 0 ? <p className="text-xs text-muted">Aucun plan pour ce dossier.</p> : (
          <ul className="space-y-3">
            {plans.map((p) => (
              <li key={p.id} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{p.nom}</span>
                  <span className="text-xs text-muted">{p.duree_heures} h · {p.contenu?.length ?? 0} module(s) · {formatDate(p.created_at)}</span>
                  <Button variant="ghost" className="h-8 py-0 text-xs" onClick={() => void planEnPdf(p)} disabled={!!busy}
                    title="Mise en forme du plan par l'IA (1 à 2 minutes)">
                    {busy === `pdf-${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} PDF (IA)
                  </Button>
                  <Link to="/plans" className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand-600" title="Modifier dans Plans de formation">
                    <ExternalLink className="h-3.5 w-3.5" /> Modifier
                  </Link>
                </div>
                {pdfs.filter((d) => d.plan_id === p.id && d.kind === 'plan').length > 0 && (
                  <ul className="mt-2 space-y-1.5">{pdfs.filter((d) => d.plan_id === p.id && d.kind === 'plan').map(ligneDoc)}</ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Reste de la paperasse ── */}
      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-fg"><FolderCheck className="h-4 w-4 text-brand-500" /> Générer le reste de la paperasse</h2>
        <p className="mb-4 text-sm text-muted">Documents du financeur, justificatifs Qualiopi des sessions et test de positionnement.</p>

        <div className="space-y-6">
          {/* AGEFICE */}
          <div>
            <p className="mb-2 text-sm font-medium text-fg">Documents AGEFICE</p>
            {plans.length === 0 ? (
              <p className="text-xs text-muted">Ils se produisent depuis un plan : créez d'abord le plan individuel ci-dessus.</p>
            ) : (
              <>
                <div className="mb-2 max-w-md">
                  <Field label="Plan utilisé">
                    <SearchSelect value={planAgefice} onChange={setPlanAgefice} options={optionsPlans} placeholder="Choisir un plan…" />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  {AGEFICE.map((a) => (
                    <Button key={a.kind} variant="secondary" onClick={() => void genererAgefice(a.kind)} disabled={!!busy}>
                      {busy === `agefice-${a.kind}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {a.label}
                    </Button>
                  ))}
                </div>
                {AGEFICE.some((a) => pdfsDe(a.kind).length) && (
                  <ul className="mt-2 space-y-1.5">{pdfs.filter((d) => AGEFICE.some((a) => a.kind === d.kind)).map(ligneDoc)}</ul>
                )}
              </>
            )}
          </div>

          {/* Qualiopi */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg">Justificatifs Qualiopi des sessions</p>
              {participations.length > 0 && (
                <Button variant="ghost" className="h-8 py-0 text-xs" onClick={() => void preparerQualiopi()} disabled={!!busy}>
                  {busy === 'q-prep' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Re-synchroniser
                </Button>
              )}
            </div>
            {participations.length === 0 ? (
              <p className="text-xs text-muted">Le bénéficiaire n'est inscrit à aucune session (onglet Calendrier).</p>
            ) : qDocs.length === 0 ? (
              <p className="text-xs text-muted">Checklist non provisionnée : cliquez sur Re-synchroniser.</p>
            ) : (
              <ul className="space-y-1.5">
                {qDocs.map((d) => {
                  const s = toutesSessions.data.find((x) => x.id === d.session_id);
                  const generable = GENERABLE_DOC_TYPES.has(d.type_doc) || modelTypes.has(d.type_doc);
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-fg">
                        {d.libelle}
                        <span className="text-xs text-muted"> · {d.participant_id ? 'individuel' : 'collectif'}{s ? ` · ${s.titre}` : ''}</span>
                      </span>
                      <Badge tone={DOC_STATUT_TONES[d.statut]}>{DOC_STATUT_LABELS[d.statut]}</Badge>
                      {d.fichier_url && <FileLink bucket="qualiopi" value={d.fichier_url} />}
                      {generable && (
                        <Button variant="ghost" className="h-8 py-0 text-xs" onClick={() => void genererQualiopi(d)} disabled={!!busy}>
                          {busy === `q-${d.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Générer
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Positionnement */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium text-fg"><ClipboardCheck className="h-4 w-4 text-muted" /> Test de positionnement</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => void envoyerTest()} disabled={!!busy || !contact}>
                  {busy === 'pos-lien' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer le test
                </Button>
                <Link to="/positionnement" className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand-600">
                  <ExternalLink className="h-3.5 w-3.5" /> Liens de groupe et toutes les réponses
                </Link>
              </div>
            </div>
            {positionnements.length === 0 ? <p className="text-xs text-muted">Aucune réponse pour l'instant.</p> : (
              <ul className="space-y-1.5">
                {positionnements.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-fg">{p.nom}</span>
                    <Badge tone="info">{p.niveau ?? '—'}{p.pct != null ? ` · ${p.pct} %` : ''}</Badge>
                    <span className="text-xs text-muted">{formatDate(p.completed_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            {liens.filter((l) => l.actif).map((l) => (
              <div key={l.id} className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>Lien {l.multi ? 'de groupe' : 'personnel'} · {l.statut}{l.sent_at ? ` · envoyé le ${formatDate(l.sent_at)}` : ''}</span>
                <button onClick={() => void copierLien(l.token)} className="inline-flex items-center gap-1 hover:text-brand-600">
                  {copie === l.token ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copier le lien
                </button>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <ConventionPositionnementModal
        open={conventionOpen}
        onClose={() => { setConventionOpen(false); void charger(); onChanged(); }}
        repondants={reponsesGroupe}
        autres={sansPositionnement}
        prefill={{
          formationId: dossier.formation_id, entrepriseId,
          planId: plans.find((p) => p.dossier_id === dossier.id)?.id ?? plans[0]?.id ?? null,
          sessionId: sessionDossier?.id ?? null,
        }}
        positionnements={reponsesGroupe}
        onLie={() => void charger()}
        contacts={contacts.data} dossiers={tousDossiers.data} sessions={toutesSessions.data}
      />

      <ComposeMessageModal
        open={!!mail} onClose={() => setMail(null)} initial={mail?.initial ?? {}}
        onSent={() => {
          const id = mail?.lienId;
          if (id) void supabase.from('positionnement_liens').update({ statut: 'envoye', sent_at: new Date().toISOString() }).eq('id', id).then(() => charger());
        }}
      />
    </div>
  );
}
