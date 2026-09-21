import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck, Plus, Link2, Send, Eye, Trash2, FolderPlus, Users, UserPlus,
  Loader as Loader2, Check, Ban, Copy, FileSignature,
} from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { uploadFile } from '@/lib/storage';
import {
  PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge, StatCard,
  SearchSelect, type Tone,
} from '@/components/ui';
import PositionnementForm from '@/components/PositionnementForm';
import PositionnementResultat from '@/components/PositionnementResultat';
import ConventionPositionnementModal from '@/components/ConventionPositionnementModal';
import { FileLink } from '@/components/FileUpload';
import {
  noter, construireSynthese, reponsesVides, niveauDe,
  type Reponses, type Score,
} from '@/lib/positionnement';
import { formatDate, fullName, cn } from '@/lib/utils';
import type {
  Positionnement as Pos, PositionnementLien, PositionnementStatut,
  Contact, Dossier, SessionFormation, Profile, PlanFormation, PlanPdf,
} from '@/lib/database.types';

/**
 * Positionnement d'entrée — Qualiopi indicateur 4.
 *
 * Trois façons d'obtenir un positionnement, toutes réunies ici :
 *   1. un lien nominatif envoyé à un apprenant connu ;
 *   2. un lien de groupe, diffusé à une promotion dont on n'a pas la liste —
 *      aucun contact en base n'est requis, chacun déclare son identité ;
 *   3. une saisie par le formateur quand l'apprenant est absent ou ne répond
 *      pas : le même questionnaire, rempli depuis le CRM, tracé comme tel.
 *
 * Un positionnement peut ensuite être versé au dossier client : la synthèse
 * est déposée dans « Autres documents » du dossier et la trace conservée.
 */

const STATUT_LABELS: Record<PositionnementStatut, string> = {
  a_envoyer: 'À envoyer', envoye: 'Envoyé', relance: 'Relancé', complete: 'Complété', clos: 'Clos',
};
const STATUT_TONES: Record<PositionnementStatut, Tone> = {
  a_envoyer: 'neutral', envoye: 'info', relance: 'warning', complete: 'success', clos: 'neutral',
};
const NIVEAU_TONES: Record<string, Tone> = {
  Découverte: 'neutral', Initié: 'info', Autonome: 'warning', Référent: 'success',
};

type Onglet = 'reponses' | 'liens';

const lienVide = () => ({
  libelle: "Test de positionnement — l'IA dans votre métier",
  contact_id: '', destinataire_nom: '', destinataire_email: '',
  dossier_id: '', session_id: '', formation_intitule: '', multi: false,
});

export default function Positionnement() {
  const { session, profile } = useAuth();
  const liens = useCollection<PositionnementLien>('positionnement_liens', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const reponses = useCollection<Pos>('positionnements', {
    orderBy: { column: 'completed_at', ascending: false },
  });
  const contacts = useCollection<Contact>('contacts');
  const dossiers = useCollection<Dossier>('dossiers');
  const sessions = useCollection<SessionFormation>('sessions_formation');
  const profiles = useCollection<Profile>('profiles');
  // Plan rédigé d'après un positionnement, et ses documents (plan PDF, convention).
  const plans = useCollection<PlanFormation>('plans_formation');
  const plansPdf = useCollection<PlanPdf>('plan_pdfs', { orderBy: { column: 'created_at', ascending: false } });

  const [onglet, setOnglet] = useState<Onglet>('reponses');
  // Répondants cochés → convention de formation générée pour eux.
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [conventionOpen, setConventionOpen] = useState(false);
  const basculer = (id: string) => setSelection((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const repondantsChoisis = useMemo(
    () => reponses.data.filter((p) => selection.has(p.id)), [reponses.data, selection],
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Adresse d'expédition réelle (SMTP) pour la trace en Messagerie, comme
  // ComposeMessageModal. `parametres` n'est lisible que par un admin : les
  // autres profils retombent sur leur propre email.
  const [smtpFrom, setSmtpFrom] = useState<string | null>(null);
  useEffect(() => {
    void supabase.from('parametres').select('valeur').eq('cle', 'smtp').maybeSingle()
      .then(({ data }) => setSmtpFrom(((data?.valeur ?? {}) as { from?: string }).from ?? null));
  }, []);

  const loading = liens.loading || reponses.loading;

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

  const urlLien = (token: string) => `${window.location.origin}/positionnement/${token}`;
  const nbReponses = (lienId: string) => reponses.data.filter((r) => r.lien_id === lienId).length;

  // ── Création d'un lien ─────────────────────────────────────────────────────
  const [lienOpen, setLienOpen] = useState(false);
  const [lienForm, setLienForm] = useState(lienVide());
  const setL = (k: keyof ReturnType<typeof lienVide>, v: unknown) =>
    setLienForm((f) => ({ ...f, [k]: v }));

  const ouvrirLien = () => { setLienForm(lienVide()); setErreur(null); setLienOpen(true); };

  const creerLien = async () => {
    // Un lien de groupe se passe volontairement de destinataire : c'est le
    // répondant qui déclarera son identité.
    const contact = lienForm.contact_id ? contacts.data.find((c) => c.id === lienForm.contact_id) : null;
    const { error } = await supabase.from('positionnement_liens').insert({
      libelle: lienForm.libelle.trim() || "Test de positionnement — l'IA dans votre métier",
      contact_id: lienForm.contact_id || null,
      destinataire_nom: lienForm.multi
        ? null
        : (lienForm.destinataire_nom.trim() || (contact ? fullName(contact.prenom, contact.nom) : null)),
      destinataire_email: lienForm.multi
        ? null
        : (lienForm.destinataire_email.trim() || contact?.email || null),
      dossier_id: lienForm.dossier_id || null,
      session_id: lienForm.session_id || null,
      formation_intitule: lienForm.formation_intitule.trim() || null,
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
    catch { setErreur("Copie impossible : sélectionnez le lien à la main."); }
  };

  const envoyerLien = async (l: PositionnementLien) => {
    if (!l.destinataire_email) { setErreur('Ce lien n’a pas de destinataire : copiez-le et diffusez-le vous-même.'); return; }
    const relance = l.statut !== 'a_envoyer';
    setBusy(l.id);
    setErreur(null);
    const url = urlLien(l.token);
    const html = `
      <p>Bonjour ${l.destinataire_nom ?? ''},</p>
      <p>${relance ? 'Petit rappel : merci de' : 'Avant votre formation, merci de'} compléter votre
      test de positionnement (15 à 20 minutes). Il n'y a pas de note : ce questionnaire sert à adapter
      le contenu et les cas pratiques à votre niveau réel.</p>
      <p><a href="${url}" style="background:#ea6a1e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Compléter mon positionnement</a></p>
      <p>Ou copiez ce lien : ${url}</p>
      <p>Merci,<br/>L'équipe Aissociate</p>`;
    // Version texte : c'est elle que la Messagerie affiche, lien compris.
    const texte = [
      `Bonjour ${l.destinataire_nom ?? ''},`,
      '',
      `${relance ? 'Petit rappel : merci de' : 'Avant votre formation, merci de'} compléter votre test de positionnement (15 à 20 minutes). Il n'y a pas de note : ce questionnaire sert à adapter le contenu et les cas pratiques à votre niveau réel.`,
      '',
      `Compléter mon positionnement : ${url}`,
      '',
      'Merci,',
      "L'équipe Aissociate",
    ].join('\n');
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: { to: l.destinataire_email, subject: l.libelle, html, text: texte },
      });
      if (error) throw error;
      const envoyeLe = new Date().toISOString();
      await supabase.from('positionnement_liens').update({
        statut: relance ? 'relance' : 'envoye', sent_at: envoyeLe,
      }).eq('id', l.id);
      // send-email ne fait qu'expédier en SMTP : sans cette ligne, le mail
      // partait bien mais restait invisible dans la Messagerie et l'historique
      // du contact. Même journalisation que ComposeMessageModal.
      const { error: logErr } = await supabase.from('emails').insert({
        destinataires: [l.destinataire_email], copie: [], sujet: l.libelle, corps: texte,
        statut: 'envoye', canal: 'email', direction: 'sortant',
        expediteur: smtpFrom ?? profile?.email ?? null,
        contact_id: l.contact_id, dossier_id: l.dossier_id,
        sent_at: envoyeLe, owner_id: session?.user.id ?? null, attachments: [],
      });
      if (logErr) setErreur(`Mail envoyé, mais non enregistré dans la Messagerie : ${logErr.message}`);
      await liens.refresh();
    } catch (e) {
      setErreur(`Envoi impossible (SMTP non configuré ?). ${e instanceof Error ? e.message : ''}`);
    } finally { setBusy(null); }
  };

  const basculerActif = async (l: PositionnementLien) => {
    const { error } = await supabase.from('positionnement_liens')
      .update({ actif: !l.actif, statut: l.actif ? 'clos' : 'envoye' }).eq('id', l.id);
    if (error) { setErreur(error.message); return; }
    await liens.refresh();
  };

  const supprimerLien = async (l: PositionnementLien) => {
    const n = nbReponses(l.id);
    const message = n
      ? `Supprimer ce lien ? Les ${n} réponse(s) déjà reçues sont conservées mais perdront leur rattachement au lien.`
      : 'Supprimer ce lien ? Il cessera immédiatement de fonctionner.';
    if (!confirm(message)) return;
    const { error } = await supabase.from('positionnement_liens').delete().eq('id', l.id);
    if (error) { setErreur(error.message); return; }
    await Promise.all([liens.refresh(), reponses.refresh()]);
  };

  // ── Saisie par le formateur (apprenant absent) ─────────────────────────────
  const [saisieOpen, setSaisieOpen] = useState(false);
  const [saisieRep, setSaisieRep] = useState<Reponses>(reponsesVides);
  const [saisieMeta, setSaisieMeta] = useState({ contact_id: '', dossier_id: '', session_id: '' });
  const [saisieBusy, setSaisieBusy] = useState(false);

  const ouvrirSaisie = () => {
    setSaisieRep(reponsesVides());
    setSaisieMeta({ contact_id: '', dossier_id: '', session_id: '' });
    setErreur(null);
    setSaisieOpen(true);
  };

  // Le contact choisi pré-remplit l'identité : le formateur ne doit pas
  // ressaisir ce que le CRM connaît déjà.
  const choisirContactSaisie = (id: string) => {
    setSaisieMeta((m) => ({ ...m, contact_id: id }));
    const c = contacts.data.find((x) => x.id === id);
    if (!c) return;
    setSaisieRep((r) => ({
      ...r,
      champs: { ...r.champs, nom: fullName(c.prenom, c.nom), email: c.email ?? r.champs.email ?? '' },
    }));
  };

  const enregistrerSaisie = async () => {
    const nom = (saisieRep.champs.nom ?? '').trim();
    if (!nom) { setErreur("Renseignez au moins le nom de l'apprenant."); return; }
    setSaisieBusy(true);
    setErreur(null);
    const score = noter(saisieRep);
    const auteur = session?.user.id ? nomProfil(session.user.id) : undefined;
    const synthese = construireSynthese(saisieRep, score, { origine: 'formateur', auteur });
    const { error } = await supabase.from('positionnements').insert({
      lien_id: null,
      contact_id: saisieMeta.contact_id || null,
      dossier_id: saisieMeta.dossier_id || null,
      session_id: saisieMeta.session_id || null,
      nom,
      email: (saisieRep.champs.email ?? '').trim() || null,
      organisation: (saisieRep.champs.orga ?? '').trim() || null,
      poste: (saisieRep.champs.poste ?? '').trim() || null,
      secteur: (saisieRep.champs.secteur ?? '').trim() || null,
      formation_intitule: (saisieRep.champs.formation ?? '').trim() || null,
      origine: 'formateur',
      reponses: saisieRep,
      score,
      niveau: score.niveau,
      pct: score.pct,
      synthese,
      saisi_par: session?.user.id ?? null,
      completed_at: new Date().toISOString(),
    });
    setSaisieBusy(false);
    if (error) { setErreur(error.message); return; }
    setSaisieOpen(false);
    await reponses.refresh();
    setOnglet('reponses');
  };

  // ── Consultation d'une réponse ─────────────────────────────────────────────
  const [vue, setVue] = useState<Pos | null>(null);
  const [rattachement, setRattachement] = useState('');

  const ouvrirVue = (p: Pos) => { setVue(p); setRattachement(p.dossier_id ?? ''); setErreur(null); };

  /** Score relu depuis la base, avec repli sur un recalcul des réponses brutes
   *  si l'enregistrement est ancien ou incomplet. */
  const scoreDe = (p: Pos): Score => {
    const s = p.score as unknown as Score | null;
    if (s && typeof s.pct === 'number' && s.domaines) return s;
    return noter(p.reponses as unknown as Reponses);
  };

  const supprimerReponse = async (p: Pos) => {
    if (!confirm(`Supprimer le positionnement de ${p.nom} ?`)) return;
    const { error } = await supabase.from('positionnements').delete().eq('id', p.id);
    if (error) { setErreur(error.message); return; }
    setVue(null);
    await reponses.refresh();
  };

  /**
   * Verse le positionnement au dossier client : la synthèse est déposée en
   * fichier dans « Autres documents » du dossier — c'est la pièce qu'un
   * auditeur Qualiopi vient chercher — et le rattachement est enregistré.
   */
  const verserAuDossier = async () => {
    if (!vue || !rattachement) { setErreur('Choisissez un dossier.'); return; }
    setBusy('dossier');
    setErreur(null);
    try {
      const texte = vue.synthese ?? construireSynthese(vue.reponses as unknown as Reponses, scoreDe(vue));
      const nomFichier = `positionnement-${vue.nom.replace(/[^\w-]+/g, '-').toLowerCase()}.txt`;
      const fichier = new File([texte], nomFichier, { type: 'text/plain;charset=utf-8' });
      // Bucket « pieces » impérativement : un chemin de bucket privé n'a de sens
      // que dans SON bucket, et la fiche dossier relit « Autres documents »
      // depuis « pieces ». Déposer ailleurs donnerait un document introuvable.
      const { value, error: upErr } = await uploadFile('pieces', fichier);
      if (upErr || !value) throw new Error(upErr ?? 'Téléversement impossible');

      const { data: doc, error: docErr } = await supabase.from('dossier_documents').insert({
        dossier_id: rattachement,
        titre: `Positionnement d'entrée — ${vue.nom}`,
        description: `Niveau ${vue.niveau ?? '—'} (${vue.pct ?? 0} %) — complété le ${formatDate(vue.completed_at)}`,
        fichier_url: value,
        created_by: session?.user.id ?? null,
      }).select().single();
      if (docErr) throw new Error(docErr.message);

      const { error: majErr } = await supabase.from('positionnements')
        .update({ dossier_id: rattachement, document_id: doc?.id ?? null }).eq('id', vue.id);
      if (majErr) throw new Error(majErr.message);

      await reponses.refresh();
      setVue((v) => (v ? { ...v, dossier_id: rattachement, document_id: doc?.id ?? null } : v));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Ajout au dossier impossible.');
    } finally { setBusy(null); }
  };

  // ── Indicateurs ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const pcts = reponses.data.map((r) => r.pct).filter((p): p is number => typeof p === 'number');
    const moyenne = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
    const attendus = liens.data.filter((l) => l.actif && !l.multi).length;
    const recus = liens.data.filter((l) => !l.multi && nbReponses(l.id) > 0).length;
    return {
      moyenne,
      niveauMoyen: moyenne != null ? niveauDe(moyenne).nom : '—',
      taux: attendus ? Math.round((recus / attendus) * 100) : null,
      parFormateur: reponses.data.filter((r) => r.origine === 'formateur').length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reponses.data, liens.data]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <PageHeader
        title="Positionnement"
        subtitle="Test d'entrée envoyé par lien personnel — Qualiopi indicateur 4"
        actions={
          <>
            <Button variant="secondary" onClick={ouvrirSaisie}>
              <UserPlus className="h-4 w-4" /> Saisir pour un absent
            </Button>
            <Button onClick={ouvrirLien}>
              <Plus className="h-4 w-4" /> Nouveau lien
            </Button>
          </>
        }
      />

      {erreur && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{erreur}</div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Positionnements reçus" value={reponses.data.length} icon={<ClipboardCheck className="h-5 w-5" />}
          hint={`${stats.parFormateur} saisi(s) par l'organisme`} />
        <StatCard label="Niveau moyen" value={stats.niveauMoyen} icon={<Users className="h-5 w-5" />}
          hint={stats.moyenne != null ? `${stats.moyenne} % de réussite` : 'Aucune réponse'} />
        <StatCard label="Taux de retour" value={stats.taux != null ? `${stats.taux} %` : '—'} icon={<Send className="h-5 w-5" />}
          hint="Liens nominatifs actifs" />
        <StatCard label="Liens de groupe" value={liens.data.filter((l) => l.multi).length} icon={<Link2 className="h-5 w-5" />}
          hint="Diffusables sans liste nominative" />
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-line">
        {([['reponses', `Positionnements (${reponses.data.length})`], ['liens', `Liens (${liens.data.length})`]] as [Onglet, string][])
          .map(([cle, label]) => (
            <button
              key={cle} onClick={() => setOnglet(cle)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                onglet === cle ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              {label}
            </button>
          ))}
      </div>

      {/* ── Positionnements reçus ─────────────────────────────────────────── */}
      {onglet === 'reponses' && (
        reponses.data.length === 0 ? (
          <EmptyState
            title="Aucun positionnement"
            message="Créez un lien et diffusez-le, ou saisissez le positionnement d'un apprenant absent."
          />
        ) : (
          <>
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-muted">
              {selection.size ? `${selection.size} répondant(s) sélectionné(s)` : 'Cochez les répondants à reprendre dans une convention'}
            </span>
            <Button variant="secondary" disabled={!selection.size} onClick={() => setConventionOpen(true)}>
              <FileSignature className="h-4 w-4" /> Générer la convention
            </Button>
          </div>
          <Table
            head={
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox" aria-label="Tout sélectionner"
                    checked={selection.size > 0 && selection.size === reponses.data.length}
                    onChange={(e) => setSelection(e.target.checked ? new Set(reponses.data.map((p) => p.id)) : new Set())}
                  />
                </th>
                <th className="px-4 py-3">Apprenant</th>
                <th className="px-4 py-3">Organisation</th>
                <th className="px-4 py-3">Formation visée</th>
                <th className="px-4 py-3">Niveau</th>
                <th className="px-4 py-3">Origine</th>
                <th className="px-4 py-3">Dossier</th>
                <th className="px-4 py-3">Complété le</th>
                <th className="px-4 py-3" />
              </tr>
            }
          >
            {reponses.data.map((p) => (
              <tr key={p.id} className="hover:bg-surface-2/50">
                <td className="px-4 py-3">
                  <input type="checkbox" aria-label={`Sélectionner ${p.nom}`} checked={selection.has(p.id)} onChange={() => basculer(p.id)} />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-fg">{p.nom}</p>
                  <p className="text-xs text-muted">{p.email ?? p.poste ?? ''}</p>
                </td>
                <td className="px-4 py-3 text-muted">{p.organisation ?? '—'}</td>
                <td className="px-4 py-3 text-muted">{p.formation_intitule ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone={NIVEAU_TONES[p.niveau ?? ''] ?? 'neutral'}>
                    {p.niveau ?? '—'}{p.pct != null ? ` · ${p.pct} %` : ''}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {p.origine === 'formateur' ? (
                    <span className="text-xs text-muted">Saisi par {nomProfil(p.saisi_par)}</span>
                  ) : (
                    <span className="text-xs text-muted">Apprenant</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{dossierLabel(p.dossier_id) ?? '—'}</td>
                <td className="px-4 py-3 text-muted">{formatDate(p.completed_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button className="btn-secondary" onClick={() => ouvrirVue(p)}>
                      <Eye className="h-4 w-4" /> Ouvrir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          </>
        )
      )}

      {/* ── Liens ─────────────────────────────────────────────────────────── */}
      {onglet === 'liens' && (
        liens.data.length === 0 ? (
          <EmptyState
            title="Aucun lien"
            message="Un lien nominatif s'envoie par email ; un lien de groupe se diffuse tel quel à une promotion, sans qu'aucun apprenant ait à exister en base."
          />
        ) : (
          <Table
            head={
              <tr>
                <th className="px-4 py-3">Destinataire</th>
                <th className="px-4 py-3">Formation</th>
                <th className="px-4 py-3">Dossier</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Réponses</th>
                <th className="px-4 py-3">Envoyé le</th>
                <th className="px-4 py-3" />
              </tr>
            }
          >
            {liens.data.map((l) => (
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
                <td className="px-4 py-3 text-muted">{l.formation_intitule ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-muted">{dossierLabel(l.dossier_id) ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone={l.actif ? STATUT_TONES[l.statut] : 'neutral'}>
                    {l.actif ? STATUT_LABELS[l.statut] : 'Clos'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-fg">{nbReponses(l.id)}</td>
                <td className="px-4 py-3 text-muted">{l.sent_at ? formatDate(l.sent_at) : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      className="btn-ghost" title="Copier le lien"
                      onClick={() => void copierLien(l.token)} aria-label="Copier le lien"
                    >
                      {busy === `copie-${l.token}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                    {!l.multi && l.destinataire_email && l.actif && (
                      <button className="btn-ghost" onClick={() => void envoyerLien(l)} disabled={busy === l.id}
                        title={l.statut === 'a_envoyer' ? 'Envoyer' : 'Relancer'} aria-label="Envoyer le lien">
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
            ))}
          </Table>
        )
      )}

      {/* ── Modale : nouveau lien ─────────────────────────────────────────── */}
      <Modal
        open={lienOpen} onClose={() => setLienOpen(false)} title="Nouveau lien de positionnement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLienOpen(false)}>Annuler</Button>
            <Button onClick={() => void creerLien()}>Créer le lien</Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={lienForm.multi}
              onChange={(e) => setL('multi', e.target.checked)} />
            <span className="text-sm text-fg">
              Lien de groupe
              <span className="mt-0.5 block text-xs text-muted">
                Un seul lien, réutilisable, à diffuser à toute une promotion. Aucun apprenant n'a
                besoin d'exister en base : chacun déclare son identité en répondant.
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
                    if (c) {
                      setL('destinataire_nom', fullName(c.prenom, c.nom));
                      setL('destinataire_email', c.email ?? '');
                    }
                  }}
                  options={optionsContacts} emptyLabel="Aucun (apprenant hors base)"
                  placeholder="Rechercher un contact…"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom du destinataire">
                  <input className="input" value={lienForm.destinataire_nom}
                    onChange={(e) => setL('destinataire_nom', e.target.value)} />
                </Field>
                <Field label="Email" hint="Sans email, le lien se copie et se diffuse à la main.">
                  <input type="email" className="input" value={lienForm.destinataire_email}
                    onChange={(e) => setL('destinataire_email', e.target.value)} />
                </Field>
              </div>
            </>
          )}

          <Field label="Formation visée" hint="Pré-remplit le champ du questionnaire.">
            <input className="input" value={lienForm.formation_intitule}
              onChange={(e) => setL('formation_intitule', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dossier client" hint="Facultatif — hérité par les réponses.">
              <SearchSelect value={lienForm.dossier_id} onChange={(v) => setL('dossier_id', v)}
                options={optionsDossiers} emptyLabel="Aucun" placeholder="Rechercher un dossier…" />
            </Field>
            <Field label="Session">
              <SearchSelect value={lienForm.session_id} onChange={(v) => setL('session_id', v)}
                options={optionsSessions} emptyLabel="Aucune" placeholder="Rechercher une session…" />
            </Field>
          </div>
        </div>
      </Modal>

      {/* ── Modale : saisie pour un apprenant absent ──────────────────────── */}
      <Modal
        open={saisieOpen} onClose={() => setSaisieOpen(false)} wide
        title="Positionnement saisi par l'organisme"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaisieOpen(false)}>Annuler</Button>
            <Button onClick={() => void enregistrerSaisie()} disabled={saisieBusy}>
              {saisieBusy && <Spinner className="h-4 w-4" />} Enregistrer le positionnement
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            À utiliser quand l'apprenant est absent ou n'a pas répondu à son lien. Le positionnement
            sera tracé comme saisi par l'organisme — la synthèse le mentionne explicitement, pour
            qu'un audit ne le confonde jamais avec une réponse de l'apprenant.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Contact du CRM" hint="Facultatif.">
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

          <PositionnementForm valeur={saisieRep} onChange={setSaisieRep} />
        </div>
      </Modal>

      {/* ── Modale : consultation ─────────────────────────────────────────── */}
      <Modal
        open={!!vue} onClose={() => setVue(null)} wide
        title={vue ? `Positionnement — ${vue.nom}` : 'Positionnement'}
        footer={
          <>
            <Button variant="danger" onClick={() => vue && void supprimerReponse(vue)}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
            <Button variant="secondary" onClick={() => setVue(null)}>Fermer</Button>
          </>
        }
      >
        {vue && (
          <div className="space-y-5">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {([['Fonction', vue.poste], ['Organisation', vue.organisation], ['Secteur', vue.secteur],
                 ['Formation visée', vue.formation_intitule], ['Email', vue.email],
                 ['Complété le', formatDate(vue.completed_at)]] as [string, string | null][])
                .map(([lab, v]) => (
                  <div key={lab} className="rounded-lg bg-surface-2 px-3 py-2">
                    <p className="text-xs text-muted">{lab}</p>
                    <p className="font-medium text-fg">{v || '—'}</p>
                  </div>
                ))}
            </div>

            {vue.origine === 'formateur' && (
              <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                Positionnement saisi par l'organisme ({nomProfil(vue.saisi_par)}) — l'apprenant n'a pas répondu lui-même.
              </p>
            )}

            <PositionnementResultat score={scoreDe(vue)} synthese={vue.synthese ?? construireSynthese(vue.reponses as unknown as Reponses, scoreDe(vue))} />

            {(() => {
              // Plan de formation fondé sur ce positionnement, et ses documents.
              const pid = reponses.data.find((r) => r.id === vue.id)?.plan_id ?? vue.plan_id;
              const plan = pid ? plans.data.find((x) => x.id === pid) : null;
              if (!pid) return null;
              const docs = plansPdf.data.filter((d) => d.plan_id === pid);
              return (
                <div className="rounded-xl border border-line p-4">
                  <p className="text-sm font-semibold text-fg">Plan de formation lié</p>
                  <p className="mt-1 text-sm text-muted">
                    {plan ? `${plan.nom} · ${plan.duree_heures} h · ${plan.contenu?.length ?? 0} module(s)` : 'Plan introuvable (supprimé ?)'}
                  </p>
                  {docs.map((d) => (
                    <div key={d.id} className="mt-1 flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate text-fg">{d.kind === 'convention' ? 'Convention' : 'Plan'} · {d.titre}</span>
                      {d.fichier_url && <FileLink bucket="plans" value={d.fichier_url} />}
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="rounded-xl border border-line p-4">
              <p className="text-sm font-semibold text-fg">Dossier client</p>
              {vue.document_id ? (
                <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                  <Check className="mr-1 inline h-4 w-4" />
                  Synthèse versée dans « Autres documents » de {dossierLabel(vue.dossier_id) ?? 'ce dossier'}.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-muted">
                    Verse la synthèse dans « Autres documents » du dossier — la pièce attendue en
                    audit Qualiopi pour l'indicateur 4.
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div className="min-w-[240px] flex-1">
                      <SearchSelect value={rattachement} onChange={setRattachement}
                        options={optionsDossiers} emptyLabel="Aucun" placeholder="Choisir un dossier…" />
                    </div>
                    <Button onClick={() => void verserAuDossier()} disabled={!rattachement || busy === 'dossier'}>
                      {busy === 'dossier' ? <Spinner className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
                      Ajouter au dossier
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConventionPositionnementModal
        open={conventionOpen} onClose={() => setConventionOpen(false)}
        repondants={repondantsChoisis} positionnements={reponses.data}
        onLie={() => { reponses.refresh(); plans.refresh(); plansPdf.refresh(); }}
        contacts={contacts.data}
        dossiers={dossiers.data} sessions={sessions.data}
      />
    </div>
  );
}
