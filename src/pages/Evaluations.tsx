import { useEffect, useMemo, useState } from 'react';
import {
  MessageSquareHeart, Plus, Link2, Send, Eye, Trash2, FolderPlus, Users, UserPlus,
  Loader as Loader2, Check, Ban, Copy, CalendarClock, Star,
} from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uploadFile } from '@/lib/storage';
import {
  PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge, StatCard,
  SearchSelect, type Tone,
} from '@/components/ui';
import EvaluationForm from '@/components/EvaluationForm';
import {
  noter, construireSynthese, reponsesVides, appreciation, echeanceFroid, messageInvitation,
  TYPE_LABELS, LIBELLES_DEFAUT, DELAI_FROID_JOURS,
  type EvaluationType, type Reponses,
} from '@/lib/evaluation';
import { formatDate, fullName, cn } from '@/lib/utils';
import type {
  Evaluation, EvaluationLien, PositionnementStatut, Contact, Dossier, SessionFormation, Profile,
} from '@/lib/database.types';

/**
 * Évaluations de fin de formation — Qualiopi indicateurs 11 et 30.
 *
 * Deux questionnaires génériques, valables pour toute formation :
 *   - à chaud, en fin de formation ;
 *   - à froid, à envoyer à J+30 de la fin. Un lien à froid porte son
 *     échéance (`envoi_prevu_le`) ; on peut le programmer d'un clic pour tous
 *     les répondants à chaud.
 *
 * Comme pour le positionnement : lien nominatif (envoyé par email), lien de
 * groupe (diffusé à une promotion, sans liste nominative), ou saisie par
 * l'organisme pour un apprenant qui n'a pas répondu.
 */

const STATUT_LABELS: Record<PositionnementStatut, string> = {
  a_envoyer: 'À envoyer', envoye: 'Envoyé', relance: 'Relancé', complete: 'Complété', clos: 'Clos',
};
const STATUT_TONES: Record<PositionnementStatut, Tone> = {
  a_envoyer: 'neutral', envoye: 'info', relance: 'warning', complete: 'success', clos: 'neutral',
};
const TYPE_TONES: Record<EvaluationType, Tone> = { chaud: 'warning', froid: 'info' };

const noteTone = (n: number | null): Tone =>
  n == null ? 'neutral' : n >= 4 ? 'success' : n >= 3 ? 'warning' : 'danger';

type Onglet = 'reponses' | 'liens';
type Filtre = 'tous' | EvaluationType;

const aujourdhui = () => new Date().toISOString().slice(0, 10);

const lienVide = (type: EvaluationType = 'chaud') => ({
  type,
  libelle: LIBELLES_DEFAUT[type],
  contact_id: '', destinataire_nom: '', destinataire_email: '',
  dossier_id: '', session_id: '', formation_intitule: '',
  date_fin_formation: '', envoi_prevu_le: '', multi: false,
});

/** Score NPS : % promoteurs (9-10) − % détracteurs (0-6). */
function scoreNps(valeurs: number[]): number | null {
  if (!valeurs.length) return null;
  const pro = valeurs.filter((v) => v >= 9).length;
  const det = valeurs.filter((v) => v <= 6).length;
  return Math.round(((pro - det) / valeurs.length) * 100);
}

const moyenne = (xs: number[]) =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

export default function Evaluations() {
  const { session, profile } = useAuth();
  const liens = useCollection<EvaluationLien>('evaluation_liens', { orderBy: { column: 'created_at', ascending: false } });
  const evals = useCollection<Evaluation>('evaluations', { orderBy: { column: 'completed_at', ascending: false } });
  const contacts = useCollection<Contact>('contacts');
  const dossiers = useCollection<Dossier>('dossiers');
  const sessions = useCollection<SessionFormation>('sessions_formation');
  const profiles = useCollection<Profile>('profiles');

  const [onglet, setOnglet] = useState<Onglet>('reponses');
  const [filtre, setFiltre] = useState<Filtre>('tous');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [smtpFrom, setSmtpFrom] = useState<string | null>(null);
  useEffect(() => {
    void supabase.from('parametres').select('valeur').eq('cle', 'smtp').maybeSingle()
      .then(({ data }) => setSmtpFrom(((data?.valeur ?? {}) as { from?: string }).from ?? null));
  }, []);

  const loading = liens.loading || evals.loading;

  const dossierLabel = (id: string | null) => {
    const d = id ? dossiers.data.find((x) => x.id === id) : null;
    return d ? `${d.reference} — ${d.intitule}` : null;
  };
  const nomProfil = (id: string | null) => {
    const p = id ? profiles.data.find((x) => x.id === id) : null;
    return p ? fullName(p.prenom, p.nom) : '—';
  };
  const optionsContacts = useMemo(
    () => contacts.data.map((c) => ({ value: c.id, label: fullName(c.prenom, c.nom), sub: c.email ?? undefined })),
    [contacts.data],
  );
  const optionsDossiers = useMemo(
    () => dossiers.data.map((d) => ({ value: d.id, label: `${d.reference} — ${d.intitule}` })),
    [dossiers.data],
  );
  const optionsSessions = useMemo(
    () => sessions.data.map((s) => ({ value: s.id, label: s.titre, sub: formatDate(s.date_debut) })),
    [sessions.data],
  );

  const urlLien = (token: string) => `${window.location.origin}/evaluation/${token}`;
  const nbReponses = (lienId: string) => evals.data.filter((r) => r.lien_id === lienId).length;

  const liensFiltres = liens.data.filter((l) => filtre === 'tous' || l.type === filtre);
  const evalsFiltrees = evals.data.filter((e) => filtre === 'tous' || e.type === filtre);

  /** Liens nominatifs dont l'échéance d'envoi est atteinte. */
  const echus = liens.data.filter((l) =>
    l.actif && !l.multi && l.statut === 'a_envoyer' && l.destinataire_email
    && l.envoi_prevu_le && l.envoi_prevu_le <= aujourdhui());

  // ── Création d'un lien ─────────────────────────────────────────────────────
  const [lienOpen, setLienOpen] = useState(false);
  const [lienForm, setLienForm] = useState(lienVide());
  const setL = (k: keyof ReturnType<typeof lienVide>, v: unknown) => setLienForm((f) => ({ ...f, [k]: v }));

  const ouvrirLien = (type: EvaluationType = 'chaud') => { setLienForm(lienVide(type)); setErreur(null); setLienOpen(true); };

  const changerType = (type: EvaluationType) => setLienForm((f) => ({
    ...f, type,
    libelle: Object.values(LIBELLES_DEFAUT).includes(f.libelle) ? LIBELLES_DEFAUT[type] : f.libelle,
    envoi_prevu_le: type === 'froid' ? (echeanceFroid(f.date_fin_formation) ?? '') : '',
  }));

  // La date de fin fixe l'échéance J+30 du froid ; la session la fournit.
  const changerDateFin = (date: string) => setLienForm((f) => ({
    ...f, date_fin_formation: date,
    envoi_prevu_le: f.type === 'froid' ? (echeanceFroid(date) ?? '') : f.envoi_prevu_le,
  }));
  const changerSession = (id: string) => {
    const s = sessions.data.find((x) => x.id === id);
    setLienForm((f) => {
      const fin = (s?.date_fin ?? s?.date_debut ?? '').slice(0, 10) || f.date_fin_formation;
      return {
        ...f, session_id: id, date_fin_formation: fin,
        formation_intitule: f.formation_intitule || s?.titre || '',
        envoi_prevu_le: f.type === 'froid' ? (echeanceFroid(fin) ?? '') : f.envoi_prevu_le,
      };
    });
  };

  const creerLien = async () => {
    const contact = lienForm.contact_id ? contacts.data.find((c) => c.id === lienForm.contact_id) : null;
    const { error } = await supabase.from('evaluation_liens').insert({
      type: lienForm.type,
      libelle: lienForm.libelle.trim() || LIBELLES_DEFAUT[lienForm.type],
      contact_id: lienForm.contact_id || null,
      destinataire_nom: lienForm.multi ? null
        : (lienForm.destinataire_nom.trim() || (contact ? fullName(contact.prenom, contact.nom) : null)),
      destinataire_email: lienForm.multi ? null : (lienForm.destinataire_email.trim() || contact?.email || null),
      dossier_id: lienForm.dossier_id || null,
      session_id: lienForm.session_id || null,
      formation_intitule: lienForm.formation_intitule.trim() || null,
      date_fin_formation: lienForm.date_fin_formation || null,
      envoi_prevu_le: lienForm.envoi_prevu_le || null,
      multi: lienForm.multi,
      created_by: session?.user.id ?? null,
    });
    if (error) { setErreur(error.message); return; }
    setLienOpen(false);
    await liens.refresh();
    setOnglet('liens');
  };

  const copierLien = async (token: string) => {
    try { await navigator.clipboard.writeText(urlLien(token)); setBusy(`copie-${token}`); setTimeout(() => setBusy(null), 1500); }
    catch { setErreur('Copie impossible : sélectionnez le lien à la main.'); }
  };

  /** Envoi (ou relance) par email, tracé dans la Messagerie comme le positionnement. */
  const expedier = async (l: EvaluationLien) => {
    if (!l.destinataire_email) throw new Error('Ce lien n’a pas de destinataire : copiez-le et diffusez-le vous-même.');
    const relance = l.statut !== 'a_envoyer';
    const { texte, html } = messageInvitation(l.type, l.destinataire_nom, urlLien(l.token), relance);
    const { error } = await supabase.functions.invoke('send-email', {
      body: { to: l.destinataire_email, subject: l.libelle, html, text: texte },
    });
    if (error) throw new Error(`Envoi impossible (SMTP non configuré ?). ${error.message}`);
    const envoyeLe = new Date().toISOString();
    await supabase.from('evaluation_liens').update({ statut: relance ? 'relance' : 'envoye', sent_at: envoyeLe }).eq('id', l.id);
    const { error: logErr } = await supabase.from('emails').insert({
      destinataires: [l.destinataire_email], copie: [], sujet: l.libelle, corps: texte,
      statut: 'envoye', canal: 'email', direction: 'sortant',
      expediteur: smtpFrom ?? profile?.email ?? null,
      contact_id: l.contact_id, dossier_id: l.dossier_id,
      sent_at: envoyeLe, owner_id: session?.user.id ?? null, attachments: [],
    });
    if (logErr) setErreur(`Mail envoyé, mais non enregistré dans la Messagerie : ${logErr.message}`);
  };

  const envoyerLien = async (l: EvaluationLien) => {
    setBusy(l.id); setErreur(null); setInfo(null);
    try { await expedier(l); await liens.refresh(); }
    catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  };

  const envoyerEchus = async () => {
    if (!confirm(`Envoyer maintenant les ${echus.length} évaluation(s) arrivée(s) à échéance ?`)) return;
    setBusy('echus'); setErreur(null); setInfo(null);
    let ok = 0;
    const echecs: string[] = [];
    for (const l of echus) {
      try { await expedier(l); ok++; }
      catch (e) { echecs.push(`${l.destinataire_nom ?? l.destinataire_email} (${e instanceof Error ? e.message : e})`); }
    }
    await liens.refresh();
    setBusy(null);
    setInfo(`${ok} évaluation(s) envoyée(s).`);
    if (echecs.length) setErreur(`Échecs : ${echecs.join(' ; ')}`);
  };

  const basculerActif = async (l: EvaluationLien) => {
    const { error } = await supabase.from('evaluation_liens')
      .update({ actif: !l.actif, statut: l.actif ? 'clos' : (l.sent_at ? 'envoye' : 'a_envoyer') }).eq('id', l.id);
    if (error) { setErreur(error.message); return; }
    await liens.refresh();
  };

  const supprimerLien = async (l: EvaluationLien) => {
    const n = nbReponses(l.id);
    const message = n
      ? `Supprimer ce lien ? Les ${n} réponse(s) déjà reçues sont conservées mais perdront leur rattachement au lien.`
      : 'Supprimer ce lien ? Il cessera immédiatement de fonctionner.';
    if (!confirm(message)) return;
    const { error } = await supabase.from('evaluation_liens').delete().eq('id', l.id);
    if (error) { setErreur(error.message); return; }
    await Promise.all([liens.refresh(), evals.refresh()]);
  };

  // ── Programmation du froid J+30 depuis les réponses à chaud ───────────────
  const dejaProgramme = useMemo(
    () => new Set(liens.data.map((l) => l.source_evaluation_id).filter(Boolean) as string[]),
    [liens.data],
  );
  /** Date de fin de formation retenue pour une réponse à chaud. */
  const finPour = (e: Evaluation): string => {
    const l = e.lien_id ? liens.data.find((x) => x.id === e.lien_id) : null;
    const s = e.session_id ? sessions.data.find((x) => x.id === e.session_id) : null;
    return (l?.date_fin_formation ?? s?.date_fin ?? s?.date_debut ?? e.completed_at).slice(0, 10);
  };
  const aProgrammer = evals.data.filter((e) => e.type === 'chaud' && e.email && !dejaProgramme.has(e.id));

  const programmerFroid = async (cibles: Evaluation[]) => {
    if (!cibles.length) return;
    setBusy('froid'); setErreur(null); setInfo(null);
    const { error } = await supabase.from('evaluation_liens').insert(cibles.map((e) => ({
      type: 'froid' as const,
      libelle: LIBELLES_DEFAUT.froid,
      contact_id: e.contact_id, destinataire_nom: e.nom, destinataire_email: e.email,
      dossier_id: e.dossier_id, session_id: e.session_id, formation_intitule: e.formation_intitule,
      date_fin_formation: finPour(e), envoi_prevu_le: echeanceFroid(finPour(e)),
      source_evaluation_id: e.id, created_by: session?.user.id ?? null,
    })));
    setBusy(null);
    if (error) { setErreur(error.message); return; }
    setInfo(`${cibles.length} évaluation(s) à froid programmée(s) à J+${DELAI_FROID_JOURS} de la fin de formation.`);
    await liens.refresh();
  };

  // ── Saisie par l'organisme ─────────────────────────────────────────────────
  const [saisieOpen, setSaisieOpen] = useState(false);
  const [saisieType, setSaisieType] = useState<EvaluationType>('chaud');
  const [saisieRep, setSaisieRep] = useState<Reponses>(reponsesVides);
  const [saisieMeta, setSaisieMeta] = useState({ contact_id: '', dossier_id: '', session_id: '' });
  const [saisieBusy, setSaisieBusy] = useState(false);

  const ouvrirSaisie = () => {
    setSaisieRep(reponsesVides());
    setSaisieMeta({ contact_id: '', dossier_id: '', session_id: '' });
    setErreur(null);
    setSaisieOpen(true);
  };
  const choisirContactSaisie = (id: string) => {
    setSaisieMeta((m) => ({ ...m, contact_id: id }));
    const c = contacts.data.find((x) => x.id === id);
    if (c) setSaisieRep((r) => ({ ...r, champs: { ...r.champs, nom: fullName(c.prenom, c.nom), email: c.email ?? r.champs.email ?? '' } }));
  };

  const enregistrerSaisie = async () => {
    const nom = (saisieRep.champs.nom ?? '').trim();
    if (!nom) { setErreur("Renseignez au moins le nom de l'apprenant."); return; }
    setSaisieBusy(true); setErreur(null);
    const n = noter(saisieType, saisieRep);
    const auteur = session?.user.id ? nomProfil(session.user.id) : undefined;
    const { error } = await supabase.from('evaluations').insert({
      type: saisieType, lien_id: null,
      contact_id: saisieMeta.contact_id || null,
      dossier_id: saisieMeta.dossier_id || null,
      session_id: saisieMeta.session_id || null,
      nom,
      email: (saisieRep.champs.email ?? '').trim() || null,
      organisation: (saisieRep.champs.orga ?? '').trim() || null,
      poste: (saisieRep.champs.poste ?? '').trim() || null,
      formation_intitule: (saisieRep.champs.formation ?? '').trim() || null,
      origine: 'formateur',
      reponses: saisieRep,
      note_globale: n.note, pct: n.pct, nps: n.nps,
      synthese: construireSynthese(saisieType, saisieRep, n, { origine: 'formateur', auteur }),
      saisi_par: session?.user.id ?? null,
      completed_at: new Date().toISOString(),
    });
    setSaisieBusy(false);
    if (error) { setErreur(error.message); return; }
    setSaisieOpen(false);
    await evals.refresh();
    setOnglet('reponses');
  };

  // ── Consultation ───────────────────────────────────────────────────────────
  const [vue, setVue] = useState<Evaluation | null>(null);
  const [rattachement, setRattachement] = useState('');
  const ouvrirVue = (e: Evaluation) => { setVue(e); setRattachement(e.dossier_id ?? ''); setErreur(null); };

  const syntheseDe = (e: Evaluation) => {
    if (e.synthese) return e.synthese;
    const r = e.reponses as unknown as Reponses;
    return construireSynthese(e.type, r, noter(e.type, r));
  };

  const supprimerEval = async (e: Evaluation) => {
    if (!confirm(`Supprimer l'évaluation de ${e.nom} ?`)) return;
    const { error } = await supabase.from('evaluations').delete().eq('id', e.id);
    if (error) { setErreur(error.message); return; }
    setVue(null);
    await evals.refresh();
  };

  /** Dépose la synthèse dans « Autres documents » du dossier (pièce d'audit). */
  const verserAuDossier = async () => {
    if (!vue || !rattachement) { setErreur('Choisissez un dossier.'); return; }
    setBusy('dossier'); setErreur(null);
    try {
      const nomFichier = `evaluation-${vue.type}-${vue.nom.replace(/[^\w-]+/g, '-').toLowerCase()}.txt`;
      const fichier = new File([syntheseDe(vue)], nomFichier, { type: 'text/plain;charset=utf-8' });
      // Bucket « pieces » : c'est là que la fiche dossier relit « Autres documents ».
      const { value, error: upErr } = await uploadFile('pieces', fichier);
      if (upErr || !value) throw new Error(upErr ?? 'Téléversement impossible');
      const { data: doc, error: docErr } = await supabase.from('dossier_documents').insert({
        dossier_id: rattachement,
        titre: `Évaluation ${vue.type === 'chaud' ? 'à chaud' : 'à froid'} — ${vue.nom}`,
        description: `Note ${vue.note_globale ?? '—'} / 5${vue.nps != null ? ` · recommandation ${vue.nps}/10` : ''} — complétée le ${formatDate(vue.completed_at)}`,
        fichier_url: value,
        created_by: session?.user.id ?? null,
      }).select().single();
      if (docErr) throw new Error(docErr.message);
      const { error: majErr } = await supabase.from('evaluations')
        .update({ dossier_id: rattachement, document_id: doc?.id ?? null }).eq('id', vue.id);
      if (majErr) throw new Error(majErr.message);
      await evals.refresh();
      setVue((v) => (v ? { ...v, dossier_id: rattachement, document_id: doc?.id ?? null } : v));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Ajout au dossier impossible.');
    } finally { setBusy(null); }
  };

  // ── Indicateurs ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const de = (t: EvaluationType) => evals.data.filter((e) => e.type === t);
    const notes = (t: EvaluationType) => de(t).map((e) => e.note_globale).filter((n): n is number => n != null).map(Number);
    const nps = evals.data.map((e) => e.nps).filter((n): n is number => n != null);
    return {
      chaud: de('chaud').length, froid: de('froid').length,
      noteChaud: moyenne(notes('chaud')), noteFroid: moyenne(notes('froid')),
      nps: scoreNps(nps),
      froidEnAttente: liens.data.filter((l) => l.type === 'froid' && l.statut === 'a_envoyer' && l.actif).length,
    };
  }, [evals.data, liens.data]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <PageHeader
        title="Évaluations"
        subtitle={`Questionnaires à chaud et à froid (J+${DELAI_FROID_JOURS}) — Qualiopi indicateurs 11 et 30`}
        actions={
          <>
            <Button variant="secondary" onClick={ouvrirSaisie}><UserPlus className="h-4 w-4" /> Saisir pour un absent</Button>
            <Button onClick={() => ouvrirLien('chaud')}><Plus className="h-4 w-4" /> Nouveau lien</Button>
          </>
        }
      />

      {erreur && <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{erreur}</div>}
      {info && <div className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">{info}</div>}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Satisfaction à chaud" value={stats.noteChaud != null ? `${stats.noteChaud.toLocaleString('fr-FR')} / 5` : '—'}
          icon={<Star className="h-5 w-5" />} hint={`${stats.chaud} réponse(s) · ${appreciation(stats.noteChaud)}`} />
        <StatCard label="Retour à froid" value={stats.noteFroid != null ? `${stats.noteFroid.toLocaleString('fr-FR')} / 5` : '—'}
          icon={<MessageSquareHeart className="h-5 w-5" />} hint={`${stats.froid} réponse(s) · ${appreciation(stats.noteFroid)}`} />
        <StatCard label="Recommandation (NPS)" value={stats.nps != null ? `${stats.nps > 0 ? '+' : ''}${stats.nps}` : '—'}
          icon={<Users className="h-5 w-5" />} hint="% promoteurs − % détracteurs" />
        <StatCard label="Froids programmés" value={stats.froidEnAttente} icon={<CalendarClock className="h-5 w-5" />}
          hint={echus.length ? `${echus.length} à échéance aujourd'hui` : 'Aucune échéance atteinte'} />
      </div>

      {(echus.length > 0 || aProgrammer.length > 0) && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <CalendarClock className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="flex-1 text-fg">
            {echus.length > 0 && <>{echus.length} évaluation(s) à froid arrivée(s) à J+{DELAI_FROID_JOURS}. </>}
            {aProgrammer.length > 0 && <>{aProgrammer.length} répondant(s) à chaud sans évaluation à froid programmée.</>}
          </span>
          {aProgrammer.length > 0 && (
            <Button variant="secondary" onClick={() => void programmerFroid(aProgrammer)} disabled={!!busy}>
              {busy === 'froid' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
              Programmer le froid J+{DELAI_FROID_JOURS}
            </Button>
          )}
          {echus.length > 0 && (
            <Button onClick={() => void envoyerEchus()} disabled={!!busy}>
              {busy === 'echus' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer les échéances ({echus.length})
            </Button>
          )}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line">
        <div className="flex flex-wrap gap-2">
          {([['reponses', `Réponses (${evalsFiltrees.length})`], ['liens', `Liens (${liensFiltres.length})`]] as [Onglet, string][])
            .map(([cle, label]) => (
              <button key={cle} onClick={() => setOnglet(cle)}
                className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                  onglet === cle ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted hover:text-fg')}>
                {label}
              </button>
            ))}
        </div>
        <div className="mb-2 flex gap-1 rounded-lg bg-surface-2 p-1">
          {([['tous', 'Toutes'], ['chaud', 'À chaud'], ['froid', 'À froid']] as [Filtre, string][]).map(([cle, label]) => (
            <button key={cle} onClick={() => setFiltre(cle)}
              className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors',
                filtre === cle ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Réponses ──────────────────────────────────────────────────────── */}
      {onglet === 'reponses' && (
        evalsFiltrees.length === 0 ? (
          <EmptyState title="Aucune évaluation"
            message="Créez un lien et diffusez-le en fin de formation, ou saisissez l'évaluation d'un apprenant absent." />
        ) : (
          <Table
            head={
              <tr>
                <th className="px-4 py-3">Apprenant</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Formation</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Reco.</th>
                <th className="px-4 py-3">Dossier</th>
                <th className="px-4 py-3">Complétée le</th>
                <th className="px-4 py-3" />
              </tr>
            }
          >
            {evalsFiltrees.map((e) => (
              <tr key={e.id} className="hover:bg-surface-2/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-fg">{e.nom}</p>
                  <p className="text-xs text-muted">
                    {e.organisation ?? e.email ?? ''}{e.origine === 'formateur' ? ` · saisie par ${nomProfil(e.saisi_par)}` : ''}
                  </p>
                </td>
                <td className="px-4 py-3"><Badge tone={TYPE_TONES[e.type]}>{TYPE_LABELS[e.type]}</Badge></td>
                <td className="px-4 py-3 text-muted">{e.formation_intitule ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone={noteTone(e.note_globale)}>{e.note_globale != null ? `${Number(e.note_globale).toLocaleString('fr-FR')} / 5` : '—'}</Badge>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted">{e.nps != null ? `${e.nps}/10` : '—'}</td>
                <td className="px-4 py-3 text-xs text-muted">{dossierLabel(e.dossier_id) ?? '—'}</td>
                <td className="px-4 py-3 text-muted">{formatDate(e.completed_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button className="btn-secondary" onClick={() => ouvrirVue(e)}><Eye className="h-4 w-4" /> Ouvrir</button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )
      )}

      {/* ── Liens ─────────────────────────────────────────────────────────── */}
      {onglet === 'liens' && (
        liensFiltres.length === 0 ? (
          <EmptyState title="Aucun lien"
            message="Un lien nominatif s'envoie par email ; un lien de groupe se diffuse tel quel à une promotion, sans liste nominative." />
        ) : (
          <Table
            head={
              <tr>
                <th className="px-4 py-3">Destinataire</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Formation</th>
                <th className="px-4 py-3">Échéance</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Réponses</th>
                <th className="px-4 py-3" />
              </tr>
            }
          >
            {liensFiltres.map((l) => {
              const echu = echus.some((x) => x.id === l.id);
              return (
                <tr key={l.id} className={cn('hover:bg-surface-2/50', !l.actif && 'opacity-60')}>
                  <td className="px-4 py-3">
                    {l.multi ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-fg">
                        <Users className="h-4 w-4 text-brand-500" /> Lien de groupe
                      </span>
                    ) : (
                      <>
                        <p className="font-medium text-fg">{l.destinataire_nom ?? 'Sans destinataire'}</p>
                        <p className="text-xs text-muted">{l.destinataire_email ?? 'à diffuser à la main'}</p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3"><Badge tone={TYPE_TONES[l.type]}>{TYPE_LABELS[l.type]}</Badge></td>
                  <td className="px-4 py-3 text-muted">
                    {l.formation_intitule ?? '—'}
                    {l.date_fin_formation && <p className="text-xs">fin le {formatDate(l.date_fin_formation)}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {l.sent_at ? `Envoyé le ${formatDate(l.sent_at)}`
                      : l.envoi_prevu_le ? (
                        <span className={cn(echu && 'font-medium text-amber-600 dark:text-amber-400')}>
                          {echu ? 'À envoyer — ' : 'Prévu le '}{formatDate(l.envoi_prevu_le)}
                        </span>
                      ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={l.actif ? STATUT_TONES[l.statut] : 'neutral'}>{l.actif ? STATUT_LABELS[l.statut] : 'Clos'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-fg">{nbReponses(l.id)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="btn-ghost" title="Copier le lien" aria-label="Copier le lien" onClick={() => void copierLien(l.token)}>
                        {busy === `copie-${l.token}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      {!l.multi && l.destinataire_email && l.actif && l.statut !== 'complete' && (
                        <button className="btn-ghost" onClick={() => void envoyerLien(l)} disabled={busy === l.id}
                          title={l.statut === 'a_envoyer' ? 'Envoyer maintenant' : 'Relancer'} aria-label="Envoyer le lien">
                          {busy === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </button>
                      )}
                      <button className="btn-ghost" onClick={() => void basculerActif(l)}
                        title={l.actif ? 'Clore le lien' : 'Réactiver'} aria-label="Clore ou réactiver">
                        <Ban className={cn('h-4 w-4', !l.actif && 'text-emerald-500')} />
                      </button>
                      <button className="btn-ghost" onClick={() => void supprimerLien(l)} aria-label="Supprimer le lien">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )
      )}

      {/* ── Modale : nouveau lien ─────────────────────────────────────────── */}
      <Modal
        open={lienOpen} onClose={() => setLienOpen(false)} title="Nouveau lien d'évaluation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLienOpen(false)}>Annuler</Button>
            <Button onClick={() => void creerLien()}>Créer le lien</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['chaud', 'froid'] as EvaluationType[]).map((t) => (
              <button key={t} type="button" onClick={() => changerType(t)}
                className={cn('rounded-lg border px-3 py-3 text-left transition-colors',
                  lienForm.type === t ? 'border-brand-500 bg-brand-500/10' : 'border-line hover:border-brand-500/50')}>
                <p className="text-sm font-semibold text-fg">{TYPE_LABELS[t]}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {t === 'chaud' ? 'Satisfaction et acquis, en fin de formation.' : `Mise en pratique, à envoyer à J+${DELAI_FROID_JOURS} de la fin.`}
                </p>
              </button>
            ))}
          </div>

          <Field label="Titre affiché">
            <input className="input" value={lienForm.libelle} onChange={(e) => setL('libelle', e.target.value)} />
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={lienForm.multi}
              onChange={(e) => setL('multi', e.target.checked)} />
            <span className="text-sm text-fg">
              Lien de groupe
              <span className="mt-0.5 block text-xs text-muted">
                Un seul lien, réutilisable, à diffuser à toute une promotion. Chacun déclare son identité en répondant.
              </span>
            </span>
          </label>

          {!lienForm.multi && (
            <>
              <Field label="Contact du CRM" hint="Facultatif — pré-remplit le nom et l'email.">
                <SearchSelect
                  value={lienForm.contact_id}
                  onChange={(v) => {
                    setL('contact_id', v);
                    const c = contacts.data.find((x) => x.id === v);
                    if (c) { setL('destinataire_nom', fullName(c.prenom, c.nom)); setL('destinataire_email', c.email ?? ''); }
                  }}
                  options={optionsContacts} emptyLabel="Aucun (apprenant hors base)" placeholder="Rechercher un contact…"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom du destinataire">
                  <input className="input" value={lienForm.destinataire_nom} onChange={(e) => setL('destinataire_nom', e.target.value)} />
                </Field>
                <Field label="Email" hint="Sans email, le lien se copie et se diffuse à la main.">
                  <input type="email" className="input" value={lienForm.destinataire_email} onChange={(e) => setL('destinataire_email', e.target.value)} />
                </Field>
              </div>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Session" hint="Fournit la date de fin.">
              <SearchSelect value={lienForm.session_id} onChange={changerSession}
                options={optionsSessions} emptyLabel="Aucune" placeholder="Rechercher une session…" />
            </Field>
            <Field label="Dossier client" hint="Facultatif — hérité par les réponses.">
              <SearchSelect value={lienForm.dossier_id} onChange={(v) => setL('dossier_id', v)}
                options={optionsDossiers} emptyLabel="Aucun" placeholder="Rechercher un dossier…" />
            </Field>
          </div>
          <Field label="Formation" hint="Pré-remplit le champ du questionnaire.">
            <input className="input" value={lienForm.formation_intitule} onChange={(e) => setL('formation_intitule', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fin de la formation">
              <input type="date" className="input" value={lienForm.date_fin_formation} onChange={(e) => changerDateFin(e.target.value)} />
            </Field>
            <Field label="Envoi prévu le"
              hint={lienForm.type === 'froid' ? `Calculé à J+${DELAI_FROID_JOURS} de la fin — modifiable.` : 'Facultatif.'}>
              <input type="date" className="input" value={lienForm.envoi_prevu_le} onChange={(e) => setL('envoi_prevu_le', e.target.value)} />
            </Field>
          </div>
        </div>
      </Modal>

      {/* ── Modale : saisie par l'organisme ───────────────────────────────── */}
      <Modal
        open={saisieOpen} onClose={() => setSaisieOpen(false)} wide title="Évaluation saisie par l'organisme"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaisieOpen(false)}>Annuler</Button>
            <Button onClick={() => void enregistrerSaisie()} disabled={saisieBusy}>
              {saisieBusy && <Spinner className="h-4 w-4" />} Enregistrer l'évaluation
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            Pour retranscrire une évaluation recueillie hors ligne (papier, entretien téléphonique). Elle sera
            tracée comme saisie par l'organisme, pour qu'un audit ne la confonde jamais avec une réponse en ligne.
          </p>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Type">
              <select className="input" value={saisieType} onChange={(e) => setSaisieType(e.target.value as EvaluationType)}>
                <option value="chaud">{TYPE_LABELS.chaud}</option>
                <option value="froid">{TYPE_LABELS.froid}</option>
              </select>
            </Field>
            <Field label="Contact du CRM">
              <SearchSelect value={saisieMeta.contact_id} onChange={choisirContactSaisie}
                options={optionsContacts} emptyLabel="Aucun (hors base)" placeholder="Rechercher…" />
            </Field>
            <Field label="Dossier client">
              <SearchSelect value={saisieMeta.dossier_id} onChange={(v) => setSaisieMeta((m) => ({ ...m, dossier_id: v }))}
                options={optionsDossiers} emptyLabel="Aucun" placeholder="Rechercher…" />
            </Field>
            <Field label="Session">
              <SearchSelect value={saisieMeta.session_id} onChange={(v) => setSaisieMeta((m) => ({ ...m, session_id: v }))}
                options={optionsSessions} emptyLabel="Aucune" placeholder="Rechercher…" />
            </Field>
          </div>
          <EvaluationForm type={saisieType} valeur={saisieRep} onChange={setSaisieRep} />
        </div>
      </Modal>

      {/* ── Modale : consultation ─────────────────────────────────────────── */}
      <Modal
        open={!!vue} onClose={() => setVue(null)} wide
        title={vue ? `Évaluation ${vue.type === 'chaud' ? 'à chaud' : 'à froid'} — ${vue.nom}` : 'Évaluation'}
        footer={
          <>
            <Button variant="danger" onClick={() => vue && void supprimerEval(vue)}><Trash2 className="h-4 w-4" /> Supprimer</Button>
            <Button variant="secondary" onClick={() => setVue(null)}>Fermer</Button>
          </>
        }
      >
        {vue && (
          <div className="space-y-5">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              {([
                ['Note moyenne', vue.note_globale != null ? `${Number(vue.note_globale).toLocaleString('fr-FR')} / 5 — ${appreciation(Number(vue.note_globale))}` : null],
                ['Recommandation', vue.nps != null ? `${vue.nps} / 10` : null],
                ['Complétée le', formatDate(vue.completed_at)],
                ['Fonction', vue.poste], ['Organisation', vue.organisation], ['Email', vue.email],
              ] as [string, string | null][]).map(([lab, v]) => (
                <div key={lab} className="rounded-lg bg-surface-2 px-3 py-2">
                  <p className="text-xs text-muted">{lab}</p>
                  <p className="font-medium text-fg">{v || '—'}</p>
                </div>
              ))}
            </div>

            {vue.origine === 'formateur' && (
              <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                Évaluation saisie par l'organisme ({nomProfil(vue.saisi_par)}).
              </p>
            )}

            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-surface-2/40 p-4 font-sans text-sm leading-relaxed text-fg">
              {syntheseDe(vue)}
            </pre>

            {vue.type === 'chaud' && vue.email && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-4">
                <CalendarClock className="h-4 w-4 text-muted" />
                <p className="flex-1 text-sm text-fg">
                  {dejaProgramme.has(vue.id)
                    ? `Évaluation à froid déjà programmée (fin + ${DELAI_FROID_JOURS} j).`
                    : `Évaluation à froid : envoi prévu le ${formatDate(echeanceFroid(finPour(vue)) ?? '')}.`}
                </p>
                {!dejaProgramme.has(vue.id) && (
                  <Button variant="secondary" onClick={() => void programmerFroid([vue])} disabled={!!busy}>
                    {busy === 'froid' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Programmer
                  </Button>
                )}
              </div>
            )}

            <div className="rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-fg">Dossier client</p>
              {vue.document_id ? (
                <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                  <Check className="mr-1 inline h-4 w-4" />
                  Synthèse versée dans « Autres documents » de {dossierLabel(vue.dossier_id) ?? 'ce dossier'}.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-muted">Verse la synthèse dans « Autres documents » du dossier — pièce d'audit Qualiopi.</p>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div className="min-w-[240px] flex-1">
                      <SearchSelect value={rattachement} onChange={setRattachement}
                        options={optionsDossiers} emptyLabel="Aucun" placeholder="Choisir un dossier…" />
                    </div>
                    <Button onClick={() => void verserAuDossier()} disabled={!rattachement || busy === 'dossier'}>
                      {busy === 'dossier' ? <Spinner className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />} Ajouter au dossier
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
