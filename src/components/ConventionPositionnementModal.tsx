import { useEffect, useMemo, useState } from 'react';
import { FileSignature, Loader as Loader2, Sparkles, Wand as Wand2, Link2 } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { Button, Modal, Field, SearchSelect } from '@/components/ui';
import { FileLink } from '@/components/FileUpload';
import AddToDossierButton from '@/components/AddToDossierButton';
import { fullName, formatDate } from '@/lib/utils';
import { generatePlanPdf } from '@/lib/generatePlanPdf';
import type {
  Positionnement as Pos, Contact, Dossier, SessionFormation, Entreprise, Formation, PlanFormation, PlanPdf,
} from '@/lib/database.types';

/**
 * Convention de formation générée depuis les répondants au test de
 * positionnement. Les répondants peuvent être hors base : l'entreprise est
 * alors l'organisation qu'ils ont déclarée. Le PDF est produit par l'Edge
 * Function `generate-agefice` en mode direct (sans plan de formation) et
 * rejoint la liste des PDF générés des Plans de formation.
 *
 * Un plan de formation peut compléter la convention : ses objectifs, son
 * programme, sa durée et ses dates, sur mesure, priment sur le catalogue.
 * Il peut aussi être rédigé par l'IA à partir des réponses cochées (Edge
 * Function `plan-positionnement`) : le plan est enregistré, lié aux réponses
 * (`positionnements.plan_id`), mis en PDF (`generate-plan`), puis sert à la
 * convention — « Tout générer par l'IA » enchaîne les trois étapes.
 *
 * Depuis un dossier client, la fenêtre reçoit aussi des stagiaires sans
 * positionnement (`autres` : apprenants de l'entreprise sur la formation) et
 * un pré-remplissage (`prefill` : formation, entreprise, plan, session).
 */

/** Stagiaire sans réponse au positionnement (apprenant d'un dossier). */
export type StagiaireDossier = { id: string; nom: string; contact_id: string | null; dossier_id: string | null };
export type PrefillConvention = {
  formationId?: string | null; entrepriseId?: string | null; planId?: string | null;
  sessionId?: string | null; signataireId?: string | null;
};

type PlanIA = {
  planId: string; nom: string; objectifs: string[]; duree_heures: number; nbJours: number;
  modules: { titre: string; contenu: string; duree_heures: number }[]; justification: string;
};
const nombre = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.')) || null;

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Valeur la plus fréquente d'une liste (les vides sont ignorés). */
function plusFrequent(valeurs: (string | null | undefined)[]): string {
  const compte = new Map<string, number>();
  for (const v of valeurs) if (v) compte.set(v, (compte.get(v) ?? 0) + 1);
  return [...compte.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

export default function ConventionPositionnementModal({
  open, onClose, repondants, autres = [], prefill, positionnements, onLie, contacts, dossiers, sessions,
}: {
  open: boolean;
  onClose: () => void;
  repondants: Pos[];
  /** Stagiaires sans positionnement, cochables comme les répondants. */
  autres?: StagiaireDossier[];
  /** Valeurs imposées par le contexte (dossier), prioritaires sur la déduction. */
  prefill?: PrefillConvention;
  /** Toutes les réponses : pour montrer celles déjà liées au plan choisi. */
  positionnements: Pos[];
  /** Appelé quand des réponses ont été liées à un plan. */
  onLie?: () => void;
  contacts: Contact[];
  dossiers: Dossier[];
  sessions: SessionFormation[];
}) {
  const { session } = useAuth();
  const entreprises = useCollection<Entreprise>('entreprises', { orderBy: { column: 'raison_sociale', ascending: true } });
  const formations = useCollection<Formation>('formations', { orderBy: { column: 'intitule', ascending: true } });
  const plans = useCollection<PlanFormation>('plans_formation', { orderBy: { column: 'created_at', ascending: false } });
  const pdfs = useCollection<PlanPdf>('plan_pdfs', { orderBy: { column: 'created_at', ascending: false } });

  const [entrepriseId, setEntrepriseId] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [formationId, setFormationId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [signataireId, setSignataireId] = useState('');
  const [prix, setPrix] = useState('');
  const [planId, setPlanId] = useState('');
  // Saisie libre, pré-remplie depuis la session choisie.
  const [lieu, setLieu] = useState('');
  const [formateur, setFormateur] = useState('');
  // Durée imprimée dans la convention (et imposée à l'IA pour le plan).
  const [dureeH, setDureeH] = useState('');
  const [nbJours, setNbJours] = useState('');
  const [consignes, setConsignes] = useState('');
  const [avecPdfPlan, setAvecPdfPlan] = useState(true);
  const [etape, setEtape] = useState<string | null>(null);
  const [planIA, setPlanIA] = useState<PlanIA | null>(null);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [retenus, setRetenus] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ fichier_url: string; titre: string; effectif: number } | null>(null);

  const contactDe = (p: Pos) => contacts.find((c) => c.id === p.contact_id) ?? null;
  /**
   * Le signataire représente l'entreprise : un contact n'est repris (depuis un
   * plan) que s'il est rattaché à cette entreprise. Le contact d'un plan est
   * souvent un prospect sans lien avec elle.
   */
  const membreDe = (contactId: string | null | undefined, entId: string | null | undefined) =>
    !!contactId && !!entId && contacts.find((c) => c.id === contactId)?.entreprise_id === entId;
  /** Nom porté sur la convention : celui du CRM si le répondant y est, sinon le nom déclaré. */
  const nomDe = (p: Pos) => { const c = contactDe(p); return c ? fullName(c.prenom, c.nom) : p.nom; };

  // Pré-remplissage à chaque ouverture, d'après les répondants choisis.
  useEffect(() => {
    if (!open) return;
    setResultat(null); setErreur(null); setSignataireId(''); setPrix(''); setPlanId('');
    setNbJours(''); setConsignes(''); setPlanIA(null); setAvertissement(null);
    setRetenus(new Set([...repondants.map((p) => p.id), ...autres.map((a) => a.id)]));

    // Entreprise : celle des contacts du CRM si elle est unique, sinon
    // l'organisation déclarée retrouvée parmi les entreprises connues.
    const entContacts = [...new Set([
      ...repondants.map((p) => contactDe(p)?.entreprise_id),
      ...autres.map((a) => contacts.find((c) => c.id === a.contact_id)?.entreprise_id),
    ].filter(Boolean) as string[])];
    const orga = plusFrequent(repondants.map((p) => p.organisation?.trim()));
    const parNom = entreprises.data.find((e) => orga && norm(e.raison_sociale) === norm(orga));
    setEntrepriseId(entContacts.length === 1 ? entContacts[0] : parNom?.id ?? '');
    setOrganisation(orga);

    // Formation : celle des dossiers rattachés, sinon l'intitulé déclaré.
    const depuisDossiers = plusFrequent([...repondants.map((p) => p.dossier_id), ...autres.map((a) => a.dossier_id)]
      .map((id) => dossiers.find((d) => d.id === id)?.formation_id));
    const intitule = plusFrequent(repondants.map((p) => p.formation_intitule?.trim()));
    const parIntitule = formations.data.find((f) => intitule && norm(f.intitule) === norm(intitule));
    const formation = depuisDossiers || parIntitule?.id || '';
    setFormationId(formation);
    const f = formations.data.find((x) => x.id === formation);
    setDureeH(f?.duree_heures ? String(f.duree_heures) : '');
    choisirSession(plusFrequent(repondants.map((p) => p.session_id)));

    // Plan : proposé d'office s'il est le seul de cette entreprise sur cette formation.
    const entrepriseRetenue = entContacts.length === 1 ? entContacts[0] : parNom?.id ?? '';
    const candidats = entrepriseRetenue
      ? plans.data.filter((p) => formation && p.formation_id === formation && p.entreprise_id === entrepriseRetenue)
      : [];
    if (candidats.length === 1) {
      setPlanId(candidats[0].id);
      if (membreDe(candidats[0].contact_id, entrepriseRetenue)) setSignataireId(candidats[0].contact_id!);
      if (candidats[0].duree_heures) setDureeH(String(candidats[0].duree_heures));
    }

    // Contexte imposé (dossier client) : prioritaire sur la déduction.
    if (prefill?.formationId) {
      setFormationId(prefill.formationId);
      const fp = formations.data.find((x) => x.id === prefill.formationId);
      if (fp?.duree_heures) setDureeH(String(fp.duree_heures));
    }
    if (prefill?.entrepriseId) setEntrepriseId(prefill.entrepriseId);
    if (prefill?.sessionId) choisirSession(prefill.sessionId);
    if (prefill?.planId) {
      setPlanId(prefill.planId);
      const pp = plans.data.find((x) => x.id === prefill.planId);
      if (pp?.duree_heures) setDureeH(String(pp.duree_heures));
    }
    if (prefill?.signataireId && membreDe(prefill.signataireId, prefill.entrepriseId ?? entrepriseRetenue)) {
      setSignataireId(prefill.signataireId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, repondants, autres.length, prefill?.formationId, prefill?.planId, entreprises.data.length, formations.data.length, plans.data.length]);

  /** Choisir une session propose son lieu et son formateur (modifiables). */
  function choisirSession(id: string) {
    setSessionId(id);
    const s = sessions.find((x) => x.id === id);
    setLieu(s?.lieu ?? '');
    setFormateur(s?.formateur ?? '');
  }

  /** Choisir un plan reprend sa formation, son entreprise et son contact (signataire). */
  const choisirPlan = (id: string) => {
    setPlanId(id);
    const p = plans.data.find((x) => x.id === id);
    if (!p) return;
    if (p.formation_id) setFormationId(p.formation_id);
    const ent = p.entreprise_id || entrepriseId;
    if (p.entreprise_id) setEntrepriseId(p.entreprise_id);
    setSignataireId(membreDe(p.contact_id, ent) ? p.contact_id! : membreDe(signataireId, ent) ? signataireId : '');
    if (p.duree_heures) setDureeH(String(p.duree_heures));
  };

  /** Changer d'entreprise écarte un signataire qui n'en fait pas partie. */
  const choisirEntreprise = (id: string) => {
    setEntrepriseId(id);
    if (!membreDe(signataireId, id)) setSignataireId('');
  };

  /** Changer de formation reprend sa durée, sauf si un plan fixe déjà la sienne. */
  const choisirFormation = (id: string) => {
    setFormationId(id);
    const f = formations.data.find((x) => x.id === id);
    if (!planId && f?.duree_heures) setDureeH(String(f.duree_heures));
  };

  /** Lie les réponses cochées au plan : on retrouve ensuite d'où vient le plan. */
  const lierReponses = async (pid: string) => {
    const ids = choisis.map((p) => p.id);
    if (!pid || !ids.length) return;
    const { error } = await supabase.from('positionnements').update({ plan_id: pid }).in('id', ids);
    if (!error) onLie?.();
  };

  const choisis = repondants.filter((p) => retenus.has(p.id));
  const autresChoisis = autres.filter((a) => retenus.has(a.id));
  /** Effectif de la convention : répondants cochés puis stagiaires du dossier. */
  const nomsEffectif = [...choisis.map(nomDe), ...autresChoisis.map((a) => a.nom)];
  const entreprise = entreprises.data.find((e) => e.id === entrepriseId) ?? null;

  // Dossiers où déposer la convention : ceux des répondants, et ceux de leurs
  // contacts sur la formation retenue (un dossier par contact et formation).
  const cibles = useMemo(() => {
    const ids = new Set([...choisis.map((p) => p.dossier_id), ...autresChoisis.map((a) => a.dossier_id)].filter(Boolean) as string[]);
    const contactIds = new Set([...choisis.map((p) => p.contact_id), ...autresChoisis.map((a) => a.contact_id)].filter(Boolean) as string[]);
    return dossiers.filter((d) => ids.has(d.id)
      || (!!d.contact_id && contactIds.has(d.contact_id) && (!formationId || d.formation_id === formationId)));
  }, [choisis, autresChoisis, dossiers, formationId]);

  const optionsEntreprises = entreprises.data.map((e) => ({ value: e.id, label: e.raison_sociale, sub: e.ville ?? undefined }));
  const optionsFormations = formations.data.map((f) => ({ value: f.id, label: f.intitule, sub: `${f.duree_heures} h` }));
  const nomEntreprise = (id: string | null) => entreprises.data.find((e) => e.id === id)?.raison_sociale;
  const intituleFormation = (id: string | null) => formations.data.find((f) => f.id === id)?.intitule;
  // Plans de la formation retenue en premier, puis les autres.
  const optionsPlans = [...plans.data]
    .sort((a, b) => Number(b.formation_id === formationId) - Number(a.formation_id === formationId))
    .map((p) => ({
      value: p.id, label: p.nom,
      sub: [nomEntreprise(p.entreprise_id), intituleFormation(p.formation_id), p.dates_session].filter(Boolean).join(' · ') || undefined,
    }));
  const planChoisi = plans.data.find((p) => p.id === planId) ?? null;
  const optionsSessions = sessions.map((s) => ({ value: s.id, label: s.titre, sub: formatDate(s.date_debut) }));
  // Signataire pour l'entreprise : de préférence un contact de l'entreprise.
  const optionsSignataires = contacts
    .filter((c) => !entrepriseId || c.entreprise_id === entrepriseId)
    .map((c) => ({ value: c.id, label: fullName(c.prenom, c.nom), sub: c.fonction ?? undefined }));

  const generer = async (planForce?: string) => {
    const pid = planForce ?? planId;
    if (!nomsEffectif.length) { setErreur('Cochez au moins un stagiaire.'); return; }
    if (!entrepriseId && !organisation.trim()) { setErreur("Indiquez l'entreprise cocontractante."); return; }
    if (!formationId) { setErreur('Choisissez la formation du catalogue.'); return; }
    setBusy(true); setErreur(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-agefice', {
        body: {
          type: 'convention', userId: session?.user.id ?? null,
          // Vides : la fonction retombe sur la session, puis sur l'adresse de l'entreprise.
          lieu: lieu.trim() || undefined, formateur: formateur.trim() || undefined,
          direct: {
            entrepriseId: entrepriseId || null,
            organisation: entrepriseId ? null : organisation.trim(),
            formationId, sessionId: sessionId || null, contactId: signataireId || null,
            planId: pid || null,
            dureeH: nombre(dureeH), nbJours: nombre(nbJours),
            dossierIds: cibles.map((d) => d.id),
            stagiaires: nomsEffectif,
            prix: Number(prix.replace(/\s/g, '').replace(',', '.')) || null,
          },
        },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      const res = data as { error?: string; fichier_url?: string; titre?: string; effectif?: number } | null;
      if (res?.error) throw new Error(res.error);
      setResultat({ fichier_url: res?.fichier_url ?? '', titre: res?.titre ?? 'Convention', effectif: res?.effectif ?? nomsEffectif.length });
      if (pid) await lierReponses(pid);
      pdfs.refresh();
    } catch (e) {
      setErreur(`Génération impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Plan rédigé par l'IA d'après les réponses cochées, puis (option) son PDF
   * et la convention. Un nouveau plan est toujours créé : un plan existant,
   * peut-être retouché à la main, n'est jamais écrasé.
   */
  const genererPlanIA = async (puisConvention: boolean) => {
    if (!choisis.length) { setErreur("L'IA s'appuie sur le positionnement : cochez au moins un répondant au test."); return; }
    if (!formationId) { setErreur('Choisissez la formation du catalogue.'); return; }
    if (puisConvention && !entrepriseId && !organisation.trim()) { setErreur("Indiquez l'entreprise cocontractante."); return; }
    setBusy(true); setErreur(null); setAvertissement(null);
    try {
      setEtape("Rédaction du plan par l'IA d'après le positionnement…");
      const modaliteSession = sessions.find((s) => s.id === sessionId)?.modalite;
      const { data, error } = await supabase.functions.invoke('plan-positionnement', {
        body: {
          formationId, positionnementIds: choisis.map((p) => p.id),
          entrepriseId: entrepriseId || null, contactId: signataireId || null,
          dureeH: nombre(dureeH), nbJours: nombre(nbJours), modalite: modaliteSession,
          datesSession: planChoisi?.dates_session ?? null, consignes: consignes.trim() || undefined,
          userId: session?.user.id ?? null,
        },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      const res = data as (PlanIA & { error?: string }) | null;
      if (!res || res.error) throw new Error(res?.error ?? 'Réponse vide');
      setPlanIA(res); setPlanId(res.planId); setDureeH(String(res.duree_heures));
      plans.refresh(); onLie?.();

      if (avecPdfPlan) {
        setEtape("Mise en forme du plan en PDF par l'IA (1 à 2 minutes)…");
        const orga = entreprise?.raison_sociale || organisation.trim();
        try {
          await generatePlanPdf({
            planId: res.planId,
            contexte: {
              nom: res.nom, objectifs: res.objectifs, duree_heures: res.duree_heures,
              contenu: res.modules.map((m) => `${m.titre} (${m.duree_heures} h) — ${m.contenu}`),
              modalite: modaliteSession ?? 'presentiel', dates_session: planChoisi?.dates_session ?? null,
              formation: formations.data.find((f) => f.id === formationId)?.intitule,
              apprenant: nomsEffectif.join(', '), organisme: orga,
              positionnement: {
                justification: res.justification,
                participants: choisis.map((p) => ({ nom: nomDe(p), niveau: p.niveau, reussite_pct: p.pct })),
              },
            },
            apprenant: nomsEffectif.length === 1 ? nomsEffectif[0] : `${nomsEffectif.length} stagiaires`,
            organismePartenaire: orga,
            datesSession: planChoisi?.dates_session ?? null,
            clientSiret: entreprise?.siret ?? null,
            userId: session?.user.id ?? null,
            contactId: signataireId || null, entrepriseId: entrepriseId || null,
          });
          pdfs.refresh();
        } catch (e) {
          // Le plan est enregistré : la convention peut se faire sans son PDF.
          setAvertissement(`PDF du plan non produit : ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      if (puisConvention) {
        setEtape('Génération de la convention…');
        await generer(res.planId);
      }
    } catch (e) {
      setErreur(`Plan IA impossible : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false); setEtape(null);
    }
  };

  // Réponses et documents déjà rattachés au plan choisi.
  const reponsesLiees = planId ? positionnements.filter((p) => p.plan_id === planId) : [];
  const documentsPlan = planId ? pdfs.data.filter((d) => d.plan_id === planId) : [];
  const blocLiens = planId && (reponsesLiees.length > 0 || documentsPlan.length > 0) && (
    <div className="rounded-lg border border-line bg-surface-2/50 p-3 text-xs">
      <p className="mb-1 flex items-center gap-1 font-semibold text-fg"><Link2 className="h-3.5 w-3.5" /> Lié au plan « {planChoisi?.nom ?? planIA?.nom} »</p>
      {reponsesLiees.length > 0 && (
        <p className="text-muted">Positionnements : {reponsesLiees.map((p) => `${p.nom}${p.niveau ? ` (${p.niveau})` : ''}`).join(', ')}</p>
      )}
      {documentsPlan.map((d) => (
        <div key={d.id} className="mt-1 flex items-center gap-2">
          <span className="flex-1 truncate text-fg">{d.kind === 'convention' ? 'Convention' : 'Plan'} · {d.titre}</span>
          {d.fichier_url && <FileLink bucket="plans" value={d.fichier_url} />}
        </div>
      ))}
    </div>
  );

  return (
    <Modal
      open={open} onClose={onClose} title="Convention de formation"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
          {!resultat && (
            <>
              <Button variant="secondary" onClick={() => genererPlanIA(false)} disabled={busy}
                title="Rédige un plan adapté aux réponses cochées, sans générer la convention">
                <Sparkles className="h-4 w-4" /> Plan par l'IA
              </Button>
              <Button variant="secondary" onClick={() => genererPlanIA(true)} disabled={busy}
                title="Plan adapté au positionnement, son PDF, puis la convention">
                <Wand2 className="h-4 w-4" /> Tout générer par l'IA
              </Button>
              <Button onClick={() => generer()} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Générer la convention
              </Button>
            </>
          )}
        </>
      }
    >
      {resultat ? (
        <div className="space-y-3">
          <p className="text-sm text-fg">
            <strong>{resultat.titre}</strong> générée — {resultat.effectif} stagiaire(s) dans l'effectif.
          </p>
          <div className="flex items-center gap-2">
            <FileLink bucket="plans" value={resultat.fichier_url} />
            <AddToDossierButton
              contactId={null} dossiers={dossiers} cibles={cibles}
              fichierUrl={resultat.fichier_url} sourceBucket="plans"
              pieceLibelle="Convention / contrat de formation" documentLabel="convention de formation"
            />
            <span className="text-xs text-muted">
              {cibles.length
                ? `Ajouter aux ${cibles.length} dossier(s) des stagiaires`
                : 'Aucun dossier rattaché aux stagiaires'}
            </span>
          </div>
          <p className="text-xs text-muted">Elle figure aussi dans les PDF générés de la page Plans de formation.</p>
          {avertissement && <p className="text-xs text-amber-600 dark:text-amber-400">{avertissement}</p>}
          {blocLiens}
        </div>
      ) : (
        <div className="space-y-4">
          {erreur && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{erreur}</div>}
          {etape && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-500/10 px-3 py-2 text-sm text-fg">
              <Loader2 className="h-4 w-4 animate-spin text-brand-500" /> {etape}
            </div>
          )}
          {avertissement && <p className="text-xs text-amber-600 dark:text-amber-400">{avertissement}</p>}

          <Field label={`Stagiaires (${nomsEffectif.length}/${repondants.length + autres.length})`} hint="Personnes reprises dans l'effectif de la convention.">
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
              {repondants.map((p) => {
                const c = contactDe(p);
                const ent = c?.entreprise_id ? entreprises.data.find((e) => e.id === c.entreprise_id)?.raison_sociale : null;
                return (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-surface-2">
                    <input
                      type="checkbox" checked={retenus.has(p.id)}
                      onChange={() => setRetenus((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                    />
                    <span className="flex-1 text-fg">{nomDe(p)}</span>
                    <span className="text-xs text-muted">{ent ?? p.organisation ?? (c ? 'sans entreprise' : 'hors base')}</span>
                  </label>
                );
              })}
              {autres.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-surface-2">
                  <input
                    type="checkbox" checked={retenus.has(a.id)}
                    onChange={() => setRetenus((st) => { const n = new Set(st); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })}
                  />
                  <span className="flex-1 text-fg">{a.nom}</span>
                  <span className="text-xs text-muted">sans positionnement</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Entreprise cocontractante" hint="Sans entreprise au CRM, l'organisation déclarée est reprise telle quelle.">
            <SearchSelect value={entrepriseId} onChange={choisirEntreprise} options={optionsEntreprises}
              emptyLabel="Aucune (organisation déclarée)" placeholder="Rechercher une entreprise…" />
          </Field>
          {!entrepriseId && (
            <Field label="Organisation">
              <input className="input" value={organisation} onChange={(e) => setOrganisation(e.target.value)} />
            </Field>
          )}
          {entreprise && !entreprise.adresse && (
            <p className="text-xs text-muted">L'adresse de {entreprise.raison_sociale} n'est pas renseignée : elle restera à compléter sur la convention.</p>
          )}

          <Field label="Plan de formation" hint="Facultatif — complète la convention avec les objectifs, le programme, la durée et les dates du plan.">
            <SearchSelect value={planId} onChange={choisirPlan} options={optionsPlans}
              emptyLabel="Aucun (catalogue seul)" placeholder="Rechercher un plan…" />
          </Field>
          {planChoisi && (
            <p className="-mt-2 text-xs text-muted">
              {planChoisi.duree_heures ? `${planChoisi.duree_heures} h · ` : ''}{planChoisi.contenu?.length ?? 0} module(s)
              {planChoisi.dates_session ? ` · ${planChoisi.dates_session}` : ''}
              {planChoisi.formation_id && formationId && planChoisi.formation_id !== formationId
                ? ' · attention : ce plan porte sur une autre formation' : ''}
            </p>
          )}

          {blocLiens}
          {planIA && planIA.planId === planId && (
            <div className="rounded-lg border border-brand-400/40 bg-brand-500/5 p-3 text-xs">
              <p className="mb-1 font-semibold text-fg">Plan rédigé par l'IA · {planIA.duree_heures} h · {planIA.modules.length} modules</p>
              <ul className="mb-1 list-disc pl-4 text-fg">
                {planIA.modules.map((m, i) => <li key={i}>{m.titre} ({m.duree_heures} h)</li>)}
              </ul>
              {planIA.justification && <p className="text-muted">{planIA.justification}</p>}
              <p className="mt-1 text-muted">Modifiable dans Plans de formation avant de générer la convention.</p>
            </div>
          )}

          <Field label="Formation" required>
            <SearchSelect value={formationId} onChange={choisirFormation} options={optionsFormations}
              emptyLabel="Choisir…" placeholder="Rechercher une formation…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Durée de la formation (heures)" hint="Imprimée dans la convention et imposée à l'IA pour le plan.">
              <input className="input" inputMode="decimal" value={dureeH} onChange={(e) => setDureeH(e.target.value)} placeholder="ex. 21" />
            </Field>
            <Field label="Nombre de jours" hint="Vide : jours planifiés de la session, sinon durée ÷ 7.">
              <input className="input" inputMode="numeric" value={nbJours} onChange={(e) => setNbJours(e.target.value)} placeholder="ex. 3" />
            </Field>
          </div>
          <Field label="Consignes pour l'IA" hint="Facultatif — ex. insister sur la conformité RGPD, public de commerciaux.">
            <textarea className="input min-h-[60px]" value={consignes} onChange={(e) => setConsignes(e.target.value)} />
          </Field>
          <label className="-mt-2 flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={avecPdfPlan} onChange={(e) => setAvecPdfPlan(e.target.checked)} />
            Produire aussi le PDF du plan (1 à 2 minutes de plus)
          </label>
          {(() => {
            const f = formations.data.find((x) => x.id === formationId);
            const suggestion = f?.prix ? Number(f.prix) * nomsEffectif.length : 0;
            return (
              <Field label="Prix total de la formation (€, net de taxes)"
                hint={`Article 8. Vide : devis du dossier s'il existe, sinon à compléter à la main.${suggestion ? ` Catalogue : ${suggestion.toLocaleString('fr-FR')} € pour ${nomsEffectif.length} stagiaire(s).` : ''}`}>
                <input className="input" inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="ex. 1 600" />
              </Field>
            );
          })()}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Session" hint="Dates, lieu et formateur.">
              <SearchSelect value={sessionId} onChange={choisirSession} options={optionsSessions}
                emptyLabel="Aucune" placeholder="Rechercher une session…" />
            </Field>
            <Field label="Signataire pour l'entreprise" hint="« Représentée par ».">
              <SearchSelect value={signataireId} onChange={setSignataireId} options={optionsSignataires}
                emptyLabel="À compléter" placeholder="Rechercher un contact…" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lieu de formation" hint="Texte libre, imprimé tel quel. Vide : lieu de la session ou adresse de l'entreprise.">
              <input className="input" value={lieu} onChange={(e) => setLieu(e.target.value)}
                placeholder="ex. présentiel au 8, rue Pondichéry, 97438 Sainte-Marie" />
            </Field>
            <Field label="Formateur" hint="Texte libre. Vide : formateur de la session.">
              <input className="input" value={formateur} onChange={(e) => setFormateur(e.target.value)}
                placeholder="ex. Shanti MERALLI BALLOU" />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
