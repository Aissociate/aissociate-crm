import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSignature, FileText, Sparkles, Plus, Loader as Loader2, ClipboardCheck, Send, Copy, Check,
  FolderCheck, ExternalLink, RefreshCw, MessageSquareHeart, CalendarClock, GraduationCap, PenLine, X, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCollection } from '@/hooks/useCollection';
import { functionErrorMessage } from '@/lib/invokeError';
import { generatePlanPdf } from '@/lib/generatePlanPdf';
import { GENERABLE_DOC_TYPES, DOC_STATUT_LABELS, DOC_STATUT_TONES } from '@/lib/qualiopi';
import { Button, Badge, Field, SearchSelect, type Tone } from '@/components/ui';
import { FileLink } from '@/components/FileUpload';
import AddToDossierButton from '@/components/AddToDossierButton';
import ComposeMessageModal, { type ComposeInitial } from '@/components/ComposeMessageModal';
import ConventionPositionnementModal, { type StagiaireDossier } from '@/components/ConventionPositionnementModal';
import { formatDate, formatMoney, fullName, cn } from '@/lib/utils';
import { copyToBucket, type Bucket } from '@/lib/storage';
import OngletCalendrier from '@/components/dossier/OngletCalendrier';
import {
  echeanceFroid, messageInvitation, LIBELLES_DEFAUT, TYPE_LABELS, DELAI_FROID_JOURS, type EvaluationType,
} from '@/lib/evaluation';
import type {
  Dossier, Contact, DossierPiece, Formation, PlanFormation, PlanPdf, Positionnement as Pos,
  PositionnementLien, SessionFormation, SessionParticipant, QualiopiDossierDoc, QualiopiModeleDoc,
  Evaluation, EvaluationLien, Devis,
} from '@/lib/database.types';

/**
 * Onglet « Parcours » du dossier client : les quatre étapes d'un dossier de
 * formation (devis, montage, formation, clôture), chacune avec ses documents,
 * leur état et le bouton qui les produit.
 *
 * L'état d'une étape se déduit de ce qui existe (devis accepté, convention
 * déposée, session terminée, évaluation reçue) : rien à cocher à la main.
 * Tout PDF produit ici est rangé automatiquement dans la pièce justificative
 * correspondante du dossier ; le bouton dossier sert à remplacer une pièce
 * déjà remplie par une version plus récente.
 */

type Etat = 'fait' | 'en_cours' | 'a_faire';
const ETAT_BADGE: Record<Etat, { label: string; tone: Tone }> = {
  fait: { label: 'Fait', tone: 'success' },
  en_cours: { label: 'En cours', tone: 'warning' },
  a_faire: { label: 'À faire', tone: 'neutral' },
};
const ETAPES = ['Devis', 'Montage', 'Formation', 'Clôture'];

function Pastille({ n, etat }: { n: number; etat: Etat }) {
  return (
    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
      etat === 'fait' ? 'bg-emerald-500 text-white' : etat === 'en_cours' ? 'bg-brand-500 text-white' : 'bg-surface-2 text-muted')}>
      {etat === 'fait' ? <Check className="h-4 w-4" /> : n}
    </span>
  );
}

function Etape({ n, titre, etat, resume, ouvert, onToggle, children }: {
  n: number; titre: string; etat: Etat; resume: string; ouvert: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <section className="card">
      <button onClick={onToggle} aria-expanded={ouvert} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <Pastille n={n} etat={etat} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-fg">{titre}</span>
          <span className="block truncate text-xs text-muted">{resume}</span>
        </span>
        <Badge tone={ETAT_BADGE[etat].tone}>{ETAT_BADGE[etat].label}</Badge>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition', ouvert && 'rotate-180')} />
      </button>
      {ouvert && <div className="space-y-6 border-t border-line px-5 py-5">{children}</div>}
    </section>
  );
}

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

export default function OngletParcours({
  dossier, contact, pieces, devis, onChanged,
}: {
  dossier: Dossier;
  contact: Contact | null;
  pieces: DossierPiece[];
  /** Devis rattachés au dossier (étape 1). */
  devis: Devis[];
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
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [liensEval, setLiensEval] = useState<EvaluationLien[]>([]);
  const [participations, setParticipations] = useState<SessionParticipant[]>([]);
  const [qDocs, setQDocs] = useState<QualiopiDossierDoc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [conventionOpen, setConventionOpen] = useState(false);
  const [planAgefice, setPlanAgefice] = useState('');
  // `table` : le lien envoyé (positionnement ou évaluation) passe à « envoyé » au retour.
  const [mail, setMail] = useState<{ initial: ComposeInitial; lienId: string; table: 'positionnement_liens' | 'evaluation_liens' } | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  // Formation sur mesure : saisie du titre et de la durée.
  const [surMesure, setSurMesure] = useState<{ intitule: string; duree: string } | null>(null);
  // Étapes dépliées ; null = seule l'étape en cours est ouverte.
  const [ouvertes, setOuvertes] = useState<Set<number> | null>(null);

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

    // Évaluations à chaud / à froid du bénéficiaire ou du dossier.
    const [{ data: ev }, { data: le }] = await Promise.all([
      supabase.from('evaluations').select('*').or(filtre).order('completed_at', { ascending: false }),
      supabase.from('evaluation_liens').select('*').or(filtre).order('created_at', { ascending: false }),
    ]);
    setEvaluations(ev ?? []);
    setLiensEval(le ?? []);

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

  // ── Rangement automatique des PDF produits dans les pièces du dossier ─────
  // Le dernier PDF de chaque type va dans sa pièce justificative, si celle-ci
  // est vide. Une pièce déjà remplie n'est jamais écrasée, et une pièce vidée
  // à la main après la production du PDF n'est pas re-remplie.
  const rangement = useRef(new Set<string>());
  useEffect(() => {
    const aRanger = Object.keys(PIECE_POUR).map((kind) => {
      const pdf = pdfs.find((d) => d.kind === kind && d.fichier_url); // pdfs : du plus récent au plus ancien
      if (!pdf || rangement.current.has(pdf.id)) return null;
      const piece = pieces.find((x) => x.libelle === PIECE_POUR[kind]);
      if (piece?.fichier_url) return null;
      if (piece && piece.updated_at > pdf.created_at) return null;
      return { pdf, piece, libelle: PIECE_POUR[kind] };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    if (!aRanger.length) return;
    aRanger.forEach((x) => rangement.current.add(x.pdf.id));
    void (async () => {
      const ranges: string[] = [];
      for (const { pdf, piece, libelle } of aRanger) {
        const { path, error } = await copyToBucket('plans', pdf.fichier_url!, 'pieces');
        if (error || !path) continue;
        const { error: ecr } = piece
          ? await supabase.from('dossier_pieces').update({ fichier_url: path, statut: 'recue' }).eq('id', piece.id)
          : await supabase.from('dossier_pieces').insert({ dossier_id: dossier.id, libelle, obligatoire: true, statut: 'recue', fichier_url: path });
        if (!ecr) ranges.push(libelle);
      }
      if (ranges.length) {
        setInfo(`Rangé automatiquement dans les pièces du dossier : ${ranges.join(', ')}.`);
        onChanged();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfs, pieces, dossier.id]);

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

  // ── Formation du dossier ───────────────────────────────────────────────────
  const choisirFormation = (id: string) => appeler('formation', async () => {
    const { error } = await supabase.from('dossiers').update({ formation_id: id || null }).eq('id', dossier.id);
    if (error) throw new Error(error.message);
    onChanged();
  });
  const creerSurMesure = () => appeler('formation', async () => {
    const intitule = surMesure?.intitule.trim() ?? '';
    if (!intitule) throw new Error('Indiquez le titre de la formation.');
    const { error } = await supabase.rpc('creer_formation_sur_mesure', {
      p_dossier: dossier.id, p_intitule: intitule, p_duree_heures: Number(surMesure?.duree.replace(',', '.')) || 0,
    });
    if (error) throw new Error(error.message);
    setSurMesure(null);
    formations.refresh();
    onChanged();
    setInfo('Formation sur mesure créée (hors catalogue public) et rattachée au dossier.');
  });
  // Catalogue public, plus la formation actuelle du dossier si elle est sur mesure.
  const optionsFormations = formations.data
    .filter((f) => f.actif || f.id === dossier.formation_id)
    .map((f) => ({ value: f.id, label: f.intitule, sub: `${f.duree_heures} h${f.actif ? '' : ' · sur mesure'}` }));

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
    if (!formation) throw new Error("Le dossier n'a pas de formation : choisissez-la ou donnez un titre sur mesure dans « Formation du dossier ».");
    const { error } = await supabase.from('plans_formation').insert({
      nom: `Plan — ${formation.intitule}${contact ? ` — ${fullName(contact.prenom, contact.nom)}` : ''}`,
      formation_id: formation.id, contact_id: dossier.contact_id, entreprise_id: entrepriseId,
      dossier_id: dossier.id, financeur_id: dossier.financeur_id,
      objectifs: formation.objectifs, contenu: (formation.programme ?? []).map(ligneModule),
      duree_heures: formation.duree_heures, modalite: formation.modalite && ['presentiel', 'distanciel', 'mixte', 'e-learning'].includes(formation.modalite) ? formation.modalite : 'presentiel',
      statut: 'brouillon', version: 1, owner_id: userId,
    });
    if (error) throw new Error(error.message);
    setInfo('Plan créé depuis le catalogue. Mettez-le en PDF : il sera rangé dans les pièces du dossier.');
  });

  const planParIA = () => appeler('plan-ia', async () => {
    if (!dossier.formation_id) throw new Error("Le dossier n'a pas de formation.");
    if (!positionnements.length) throw new Error("Aucun positionnement : envoyez d'abord le test au bénéficiaire.");
    const res = await invoquer('plan-positionnement', {
      formationId: dossier.formation_id, positionnementIds: [positionnements[0].id],
      dossierId: dossier.id, entrepriseId, userId,
    });
    setInfo(`Plan rédigé par l'IA : ${res.nom as string}. Mettez-le en PDF : il sera rangé dans les pièces du dossier.`);
  });

  const planEnPdf = (p: PlanFormation) => appeler(`pdf-${p.id}`, async () => {
    await generatePlanPdf({
      planId: p.id,
      contexte: {
        nom: p.nom, objectifs: p.objectifs, contenu: p.contenu, duree_heures: p.duree_heures,
        modalite: p.modalite, dates_session: p.dates_session, formation: formation?.intitule,
        apprenant: contact ? fullName(contact.prenom, contact.nom) : '', nb_participants: p.nb_participants,
      },
      apprenant: contact ? fullName(contact.prenom, contact.nom) : '', nbParticipants: p.nb_participants,
      organismePartenaire: '', datesSession: p.dates_session, clientSiret: contact?.siret ?? null,
      userId, contactId: dossier.contact_id, entrepriseId, financeurId: dossier.financeur_id,
    });
    setInfo('PDF du plan produit.');
  });

  /** Effectif (« pax ») du plan : repris par son PDF et par la convention. */
  const changerPax = (p: PlanFormation, valeur: string) => {
    const n = Math.round(Number(valeur.replace(',', '.'))) || null;
    if (n === p.nb_participants || (n !== null && n < 1)) return;
    void appeler(`pax-${p.id}`, async () => {
      const { error } = await supabase.from('plans_formation').update({ nb_participants: n }).eq('id', p.id);
      if (error) throw new Error(error.message);
    });
  };

  // ── AGEFICE ────────────────────────────────────────────────────────────────
  const genererAgefice = (kind: string) => appeler(`agefice-${kind}`, async () => {
    if (!planAgefice) throw new Error('Choisissez (ou créez) le plan de formation du dossier.');
    await invoquer('generate-agefice', { planId: planAgefice, type: kind, userId });
    setInfo('Document produit.');
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
      lienId: lien.id, table: 'positionnement_liens',
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

  // ── Évaluations à chaud / à froid ─────────────────────────────────────────
  const urlEval = (token: string) => `${window.location.origin}/evaluation/${token}`;
  /** Fin de formation : session du dossier, à défaut aujourd'hui. */
  const finFormation = (sessionDossier?.date_fin ?? sessionDossier?.date_debut ?? new Date().toISOString()).slice(0, 10);

  const lienEvalPersonnel = async (type: EvaluationType): Promise<EvaluationLien> => {
    if (!contact) throw new Error('Le dossier n’a pas de bénéficiaire.');
    const existant = liensEval.find((l) => l.type === type && !l.multi && l.actif && l.statut !== 'complete');
    if (existant) return existant;
    const { data, error } = await supabase.from('evaluation_liens').insert({
      type, libelle: LIBELLES_DEFAUT[type],
      contact_id: contact.id, destinataire_nom: fullName(contact.prenom, contact.nom),
      destinataire_email: contact.email, dossier_id: dossier.id, session_id: sessionDossier?.id ?? null,
      formation_intitule: formation?.intitule ?? sessionDossier?.titre ?? null,
      date_fin_formation: finFormation,
      envoi_prevu_le: type === 'froid' ? echeanceFroid(finFormation) : null,
      created_by: userId,
    }).select().single();
    if (error) throw new Error(error.message);
    return data as EvaluationLien;
  };

  const envoyerEval = (type: EvaluationType) => appeler(`ev-${type}`, async () => {
    const lien = await lienEvalPersonnel(type);
    const { texte } = messageInvitation(type, lien.destinataire_nom, urlEval(lien.token), lien.statut !== 'a_envoyer');
    setMail({
      lienId: lien.id, table: 'evaluation_liens',
      initial: {
        canal: 'email', dest: contact?.email ?? '', contactId: contact?.id, dossierId: dossier.id,
        sujet: lien.libelle, corps: texte,
      },
    });
  });

  const copierLienEval = async (token: string) => {
    try { await navigator.clipboard.writeText(urlEval(token)); setCopie(token); setTimeout(() => setCopie(null), 1500); }
    catch { setErreur('Copie impossible : sélectionnez le lien à la main.'); }
  };

  const programmerFroid = () => appeler('ev-prog', async () => {
    const lien = await lienEvalPersonnel('froid');
    setInfo(`Évaluation à froid programmée : envoi prévu le ${formatDate(lien.envoi_prevu_le ?? '')} (fin de formation + ${DELAI_FROID_JOURS} jours). Elle apparaîtra dans « Évaluations » à l'échéance.`);
  });

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

  // ── Parcours : état de chaque étape, déduit des documents du dossier ──────
  const pieceDeposee = (libelle: string) => pieces.some((x) => x.libelle === libelle && x.fichier_url);
  const sessionsInscrit = toutesSessions.data.filter((x) => participations.some((y) => y.session_id === x.id));
  const sessionFinie = sessionsInscrit.some((x) => new Date(x.date_fin ?? x.date_debut).getTime() < Date.now());
  const devisAccepte = devis.some((d) => d.statut === 'accepte');
  const etats: Etat[] = [
    devisAccepte || pieceDeposee('Devis signé') ? 'fait' : devis.length ? 'en_cours' : 'a_faire',
    pieceDeposee('Convention / contrat de formation') && pdfsDe('plan').length > 0 ? 'fait'
      : (dossier.formation_id || plans.length || positionnements.length || conventions.length) ? 'en_cours' : 'a_faire',
    sessionFinie ? 'fait' : sessionsInscrit.length ? 'en_cours' : 'a_faire',
    evaluations.some((e) => e.type === 'chaud') && pieceDeposee("Attestation d'assiduité") ? 'fait'
      : (liensEval.length || evaluations.length || pdfsDe('attestation').length) ? 'en_cours' : 'a_faire',
  ];
  const courante = etats.findIndex((e) => e !== 'fait') + 1; // 0 = tout est fait
  const estOuverte = (n: number) => (ouvertes ? ouvertes.has(n) : n === courante);
  const basculer = (n: number) => setOuvertes((cur) => {
    const set = new Set(cur ?? (courante ? [courante] : []));
    if (set.has(n)) set.delete(n); else set.add(n);
    return set;
  });
  const boutonAgefice = (kind: 'demande' | 'emargement' | 'attestation') => {
    const a = AGEFICE.find((x) => x.kind === kind)!;
    return (
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-fg"><FolderCheck className="h-4 w-4 text-muted" /> {a.label}</p>
          <Button variant="secondary" onClick={() => void genererAgefice(kind)} disabled={!!busy || plans.length === 0}
            title={plans.length === 0 ? "Créez d'abord le plan individuel (étape Montage)" : undefined}>
            {busy === `agefice-${kind}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Générer
          </Button>
        </div>
        {plans.length > 1 && kind === 'demande' && (
          <div className="mb-2 max-w-md">
            <Field label="Plan utilisé pour les documents du financeur">
              <SearchSelect value={planAgefice} onChange={setPlanAgefice} options={optionsPlans} placeholder="Choisir un plan…" />
            </Field>
          </div>
        )}
        {pdfsDe(kind).length > 0
          ? <ul className="space-y-1.5">{pdfsDe(kind).map(ligneDoc)}</ul>
          : <p className="text-xs text-muted">Pas encore produit.</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {erreur && <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{erreur}</div>}
      {info && <div className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{info}</div>}

      {/* Fil du parcours : où en est le dossier, d'un coup d'œil */}
      <ol className="card flex items-center gap-1 overflow-x-auto p-3">
        {ETAPES.map((titre, i) => (
          <li key={titre} className="flex min-w-0 flex-1 items-center gap-1">
            <button onClick={() => basculer(i + 1)}
              className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-surface-2',
                courante === i + 1 && 'bg-brand-500/10')}>
              <Pastille n={i + 1} etat={etats[i]} />
              <span className={cn('truncate font-medium', etats[i] === 'a_faire' ? 'text-muted' : 'text-fg')}>{titre}</span>
            </button>
            {i < ETAPES.length - 1 && <span className={cn('h-px w-4 shrink-0', etats[i] === 'fait' ? 'bg-emerald-500' : 'bg-line')} />}
          </li>
        ))}
      </ol>

      {/* ── 1. Devis ── */}
      <Etape n={1} titre="Devis" etat={etats[0]} ouvert={estOuverte(1)} onToggle={() => basculer(1)}
        resume={devis.length ? `${devis.length} devis${devisAccepte ? ' · accepté' : ''}` : 'Aucun devis pour ce dossier'}>
        {devis.length === 0 ? <p className="text-sm text-muted">Aucun devis rattaché à ce dossier.</p> : (
          <ul className="space-y-1.5">
            {devis.map((dv) => (
              <li key={dv.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-fg">{dv.numero}{dv.objet ? ` · ${dv.objet}` : ''}</span>
                <span className="text-muted">{formatMoney(dv.total_ht)}</span>
                <Badge tone={dv.statut === 'accepte' ? 'success' : dv.statut === 'refuse' || dv.statut === 'expire' ? 'danger' : 'neutral'}>{dv.statut}</Badge>
                {dv.fichier_url && <FileLink bucket="devis" value={dv.fichier_url} />}
                <AddToDossierButton contactId={dossier.contact_id} dossiers={[dossier]} cibles={[dossier]}
                  fichierUrl={dv.fichier_url} sourceBucket="devis" pieceLibelle="Devis signé" documentLabel="devis" onDone={onChanged} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">
          Pièce « Devis signé » : {pieceDeposee('Devis signé') ? 'déposée' : 'pas encore déposée (bouton dossier sur le devis signé)'}.{' '}
          <Link to="/devis" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Créer ou modifier un devis</Link>
        </p>
      </Etape>

      {/* ── 2. Montage ── */}
      <Etape n={2} titre="Montage du dossier" etat={etats[1]} ouvert={estOuverte(2)} onToggle={() => basculer(2)}
        resume={`${formation?.intitule ?? 'Formation à choisir'} · convention ${pieceDeposee('Convention / contrat de formation') ? 'déposée' : 'à produire'}`}>
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-fg"><GraduationCap className="h-4 w-4 text-muted" /> Formation du dossier</p>
        {surMesure ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1">
              <Field label="Titre de la formation sur mesure">
                <input className="input" autoFocus value={surMesure.intitule} placeholder="Ex. : L'IA au service du cabinet comptable"
                  onChange={(e) => setSurMesure({ ...surMesure, intitule: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') void creerSurMesure(); }} />
              </Field>
            </div>
            <div className="w-28">
              <Field label="Durée (h)">
                <input className="input" inputMode="decimal" value={surMesure.duree}
                  onChange={(e) => setSurMesure({ ...surMesure, duree: e.target.value })} />
              </Field>
            </div>
            <Button onClick={() => void creerSurMesure()} disabled={!!busy || !surMesure.intitule.trim()}>
              {busy === 'formation' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Rattacher
            </Button>
            <Button variant="ghost" onClick={() => setSurMesure(null)} disabled={!!busy}><X className="h-4 w-4" /> Annuler</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[16rem] max-w-xl flex-1">
              <SearchSelect value={dossier.formation_id ?? ''} onChange={(v) => void choisirFormation(v)}
                options={optionsFormations} placeholder="Choisir une formation du catalogue…" disabled={!!busy} />
            </div>
            <Button variant="secondary" onClick={() => setSurMesure({ intitule: '', duree: formation?.duree_heures ? String(formation.duree_heures) : '' })} disabled={!!busy}>
              <PenLine className="h-4 w-4" /> Titre sur mesure
            </Button>
            {busy === 'formation' && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
            {formation && !formation.actif && <Badge tone="info">Sur mesure</Badge>}
          </div>
        )}
        </div>
        <div>
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
        <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-fg"><FileText className="h-4 w-4 text-muted" /> Plan individuel de formation</p>
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
                  <label className="flex items-center gap-1 text-xs text-muted" title="Nombre de participants imprimé sur le plan et la convention">
                    <input key={`${p.id}-${p.nb_participants ?? ''}`} className="input h-8 w-16 py-0 text-xs" inputMode="numeric"
                      defaultValue={p.nb_participants ?? ''} placeholder="1" disabled={!!busy}
                      onBlur={(e) => changerPax(p, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                    pax
                  </label>
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
        </div>
        <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-fg"><FileSignature className="h-4 w-4 text-muted" /> Convention de formation</p>
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
        </div>
        {boutonAgefice('demande')}
      </Etape>

      {/* ── 3. Formation ── */}
      <Etape n={3} titre="Formation" etat={etats[2]} ouvert={estOuverte(3)} onToggle={() => basculer(3)}
        resume={sessionsInscrit.length
          ? sessionsInscrit.map((x) => `${x.titre} · ${formatDate(x.date_debut)}`).join(' — ')
          : 'Aucune session réservée'}>
        <OngletCalendrier contact={contact} onChanged={() => { void charger(); onChanged(); }} />
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-fg"><ClipboardCheck className="h-4 w-4 text-muted" /> Émargement</p>
          <p className="text-xs text-muted">
            La présence se signe par demi-journée, par code envoyé au stagiaire.{' '}
            <Link to="/emargement" className="font-medium text-brand-600 hover:underline dark:text-brand-400">Ouvrir l'émargement</Link>
          </p>
        </div>
        {boutonAgefice('emargement')}
        <div>
          {/* Qualiopi */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg">Checklist Qualiopi de la session</p>
              {participations.length > 0 && (
                <Button variant="ghost" className="h-8 py-0 text-xs" onClick={() => void preparerQualiopi()} disabled={!!busy}>
                  {busy === 'q-prep' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Re-synchroniser
                </Button>
              )}
            </div>
            {participations.length === 0 ? (
              <p className="text-xs text-muted">Elle apparaît dès que le bénéficiaire est inscrit à une session (ci-dessus).</p>
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
                      {d.fichier_url && <FileLink bucket={(d.bucket ?? 'qualiopi') as Bucket} value={d.fichier_url} />}
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

        </div>
      </Etape>

      {/* ── 4. Clôture ── */}
      <Etape n={4} titre="Clôture" etat={etats[3]} ouvert={estOuverte(4)} onToggle={() => basculer(4)}
        resume={`${evaluations.length} évaluation(s) reçue(s) · attestation ${pieceDeposee("Attestation d'assiduité") ? 'déposée' : 'à produire'}`}>
        {boutonAgefice('attestation')}
        <div>
          {/* Évaluations à chaud / à froid */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium text-fg"><MessageSquareHeart className="h-4 w-4 text-muted" /> Évaluations de fin de formation</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => void envoyerEval('chaud')} disabled={!!busy || !contact}>
                  {busy === 'ev-chaud' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer l'évaluation à chaud
                </Button>
                {liensEval.some((l) => l.type === 'froid' && !l.multi && l.actif && l.statut === 'a_envoyer') ? (
                  <Button variant="secondary" onClick={() => void envoyerEval('froid')} disabled={!!busy || !contact}>
                    {busy === 'ev-froid' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer le froid maintenant
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => void programmerFroid()} disabled={!!busy || !contact}>
                    {busy === 'ev-prog' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Programmer le froid J+{DELAI_FROID_JOURS}
                  </Button>
                )}
                <Link to="/evaluations" className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand-600">
                  <ExternalLink className="h-3.5 w-3.5" /> Liens de groupe et toutes les réponses
                </Link>
              </div>
            </div>
            {evaluations.length === 0 ? <p className="text-xs text-muted">Aucune réponse pour l'instant.</p> : (
              <ul className="space-y-1.5">
                {evaluations.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                    <Badge tone={e.type === 'chaud' ? 'warning' : 'info'}>{TYPE_LABELS[e.type]}</Badge>
                    <span className="min-w-0 flex-1 truncate text-fg">{e.nom}</span>
                    <Badge tone="success">{e.note_globale != null ? `${Number(e.note_globale).toLocaleString('fr-FR')} / 5` : '—'}{e.nps != null ? ` · reco ${e.nps}/10` : ''}</Badge>
                    <span className="text-xs text-muted">{formatDate(e.completed_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            {liensEval.filter((l) => l.actif && l.statut !== 'complete').map((l) => (
              <div key={l.id} className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>
                  {TYPE_LABELS[l.type]} · lien {l.multi ? 'de groupe' : 'personnel'} · {l.statut}
                  {l.sent_at ? ` · envoyé le ${formatDate(l.sent_at)}` : l.envoi_prevu_le ? ` · envoi prévu le ${formatDate(l.envoi_prevu_le)}` : ''}
                </span>
                <button onClick={() => void copierLienEval(l.token)} className="inline-flex items-center gap-1 hover:text-brand-600">
                  {copie === l.token ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copier le lien
                </button>
              </div>
            ))}
          </div>
        </div>
      </Etape>

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
          if (id && mail) void supabase.from(mail.table).update({ statut: 'envoye', sent_at: new Date().toISOString() }).eq('id', id).then(() => charger());
        }}
      />
    </div>
  );
}
