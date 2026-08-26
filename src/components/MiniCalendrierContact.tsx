import { useMemo, useState } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, isSameMonth, isSameDay, format, parseISO,
  startOfDay, endOfDay, isWithinInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck as CheckCircle2, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui';
import { OPP_STAGE_LABELS, OPP_STAGE_ORDER } from '@/lib/constants';
import { cn, fullName } from '@/lib/utils';
import type {
  Contact, ContactAction, Opportunite, OpportuniteStage,
  ParticipantStatut, SessionFormation, SessionParticipant,
} from '@/lib/database.types';

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const PART_STATUTS: { v: ParticipantStatut; label: string }[] = [
  { v: 'inscrit', label: 'Inscrit' }, { v: 'present', label: 'Présent' },
  { v: 'absent', label: 'Absent' }, { v: 'annule', label: 'Annulé' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/** Jour local d'une session (et non le jour UTC : `slice(0,10)` décalait les sessions du soir). */
const jourDe = (s: SessionFormation) => format(parseISO(s.date_debut), 'yyyy-MM-dd');
const heureDe = (s: SessionFormation) => format(parseISO(s.date_debut), 'HH:mm');
const dansNJours = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

/** Options de la mise à jour en cascade déclenchée par la mise en session. */
type Cascade = {
  oppId: string;
  stage: OpportuniteStage | '';
  action: boolean;
  fiche: boolean;
  apprenant: boolean;
};

interface Props {
  contact: Contact;
  /** Toutes les sessions du calendrier (chargées par la fiche). */
  sessions: SessionFormation[];
  /** Lignes de participation DU contact. */
  participants: SessionParticipant[];
  /** Opportunités du contact — cibles de la mise à jour en cascade. */
  opportunites: Opportunite[];
  /** Actions du contact — servent à prévenir d'un passage en stand-by du pipeline. */
  actions: ContactAction[];
  /** Rechargement des données de la fiche (sessions, opportunités, contact). */
  onChanged: () => void;
  /** Fermeture de la fiche avant navigation vers le calendrier complet. */
  onNavigate: () => void;
}

/**
 * Calendrier miniature de la fiche contact : montre les sessions du mois et
 * permet de positionner le contact sur l'une d'elles sans quitter le volet.
 * L'inscription entraîne une mise à jour en cascade (fiche, action de suivi,
 * étape de l'opportunité) que l'utilisateur valide au cas par cas.
 */
export default function MiniCalendrierContact({
  contact, sessions, participants, opportunites, actions, onChanged, onNavigate,
}: Props) {
  const { session: auth } = useAuth();
  const [mois, setMois] = useState<Date>(new Date());
  const [jour, setJour] = useState<Date>(new Date());
  const [pending, setPending] = useState<SessionFormation | null>(null);
  const [busy, setBusy] = useState(false);
  const [recap, setRecap] = useState<string[]>([]);

  const oppsOuvertes = opportunites.filter((o) => o.stage !== 'gagne' && o.stage !== 'perdu');
  const [cas, setCas] = useState<Cascade>({ oppId: '', stage: 'gagne', action: true, fiche: true, apprenant: true });

  const jours = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(mois), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(mois), { weekStartsOn: 1 }),
  }), [mois]);

  // Une session occupe tous les jours de date_debut à date_fin (même règle que
  // la page Calendrier), sinon une session sur 2 jours n'apparaît que le premier.
  const sessionsDuJour = (d: Date) => sessions.filter((s) => {
    const debut = parseISO(s.date_debut);
    const fin = s.date_fin ? parseISO(s.date_fin) : debut;
    const end = fin < debut ? debut : fin;
    return isWithinInterval(d, { start: startOfDay(debut), end: endOfDay(end) });
  });
  const participationDe = (sessionId: string) => participants.find((p) => p.session_id === sessionId) ?? null;

  const ouvrirCascade = (s: SessionFormation) => {
    setRecap([]);
    setCas({
      oppId: oppsOuvertes[0]?.id ?? '',
      stage: 'gagne',
      action: true,
      fiche: true,
      apprenant: contact.type === 'prospect' || contact.type === 'contact',
    });
    setPending(s);
  };

  /** Inscription + mises à jour concordantes choisies par l'utilisateur. */
  const positionner = async () => {
    const s = pending;
    if (!s) return;
    const date = jourDe(s);
    const heure = heureDe(s);
    setBusy(true);
    const faits: string[] = [];

    // 1 ─ Inscription à la session (déclenche aussi le provisionnement Qualiopi).
    const { error: errPart } = await supabase.from('session_participants').insert({
      session_id: s.id, contact_id: contact.id,
      nom: contact.nom, prenom: contact.prenom, email: contact.email, statut: 'inscrit',
    });
    if (errPart) {
      setBusy(false);
      alert(`Inscription impossible : ${errPart.message}`);
      return;
    }
    faits.push(`Inscrit à « ${s.titre} » le ${format(parseISO(s.date_debut), 'dd/MM/yyyy')}`);

    // 2 ─ Action de suivi à la date de la session : c'est elle qui empêche
    //     l'opportunité de basculer en stand-by dans le pipeline.
    if (cas.action) {
      const doublon = actions.some((a) => a.date_action === date && a.description === `Session — ${s.titre}`);
      if (!doublon) {
        const { error } = await supabase.from('contact_actions').insert({
          contact_id: contact.id, date_action: date, heure_action: heure,
          type: 'rdv', description: `Session — ${s.titre}`, faite: false,
        });
        faits.push(error ? `⚠ Action de suivi non créée : ${error.message}` : 'Action de suivi créée');
      }
    }

    // 3 ─ Fiche contact : date de formation, checklist, requalification.
    const champs: Partial<Contact> = {};
    if (cas.fiche) {
      champs.date_formation = date;
      champs.inscription_validee = true;
      if (!contact.date_fixee) champs.date_fixee = date;
    }
    if (cas.apprenant) {
      champs.type = 'apprenant';
      champs.statut_prospect = 'gagné';
    }
    if (Object.keys(champs).length) {
      const { data, error } = await supabase.from('contacts').update(champs).eq('id', contact.id).select('id');
      if (error) faits.push(`⚠ Fiche non mise à jour : ${error.message}`);
      else if (!data?.length) faits.push('⚠ Fiche non mise à jour : contact non attribué');
      else faits.push(cas.apprenant ? 'Fiche mise à jour (apprenant, date de formation)' : 'Fiche mise à jour (date de formation)');
    }

    // 4 ─ Opportunité : l'étape du pipeline suit la mise en session.
    if (cas.oppId && cas.stage) {
      const patch: Partial<Opportunite> = { stage: cas.stage };
      if (cas.stage === 'gagne') { patch.probabilite = 100; patch.date_cloture = ymd(new Date()); }
      else if (cas.stage === 'perdu') { patch.probabilite = 0; patch.date_cloture = ymd(new Date()); }
      const { data, error } = await supabase.from('opportunites').update(patch).eq('id', cas.oppId).select('id');
      if (error) faits.push(`⚠ Opportunité non mise à jour : ${error.message}`);
      else if (!data?.length) faits.push("⚠ Opportunité non mise à jour : elle ne vous appartient pas");
      else {
        faits.push(`Opportunité passée en « ${OPP_STAGE_LABELS[cas.stage]} »`);
        // Le pipeline calcule le stand-by depuis les actions à faire : une
        // opportunité encore ouverte sans action sous 30 jours y retombera.
        const ouverte = cas.stage !== 'gagne' && cas.stage !== 'perdu';
        const prochaine = [
          ...actions.filter((a) => !a.faite && a.date_action >= ymd(new Date())).map((a) => a.date_action),
          ...(cas.action ? [date] : []),
        ].sort()[0];
        if (ouverte && (!prochaine || prochaine > dansNJours(30))) {
          faits.push('⚠ Aucune action sous 30 jours : l\'opportunité s\'affichera en stand-by');
        }
      }
    }

    setBusy(false);
    setPending(null);
    setRecap(faits);
    onChanged();
  };

  /** Retrait d'une session : on défait aussi ce qui n'a plus lieu d'être. */
  const retirer = async (p: SessionParticipant, s: SessionFormation) => {
    if (!confirm(`Retirer ${fullName(contact.prenom, contact.nom)} de « ${s.titre} » ?`)) return;
    setBusy(true);
    const { error } = await supabase.from('session_participants').delete().eq('id', p.id);
    if (error) { setBusy(false); alert(`Retrait impossible : ${error.message}`); return; }
    const faits = [`Retiré de « ${s.titre} »`];
    // La date de formation ne doit plus pointer sur une session quittée.
    if (contact.date_formation === jourDe(s)) {
      const reste = participants.some((x) => x.id !== p.id);
      const champs: Partial<Contact> = { date_formation: null };
      if (!reste) champs.inscription_validee = false;
      const { data } = await supabase.from('contacts').update(champs).eq('id', contact.id).select('id');
      if (data?.length) faits.push(reste ? 'Date de formation effacée' : 'Date de formation et inscription remises à zéro');
    }
    setBusy(false);
    setRecap(faits);
    onChanged();
  };

  const changerStatut = async (p: SessionParticipant, statut: ParticipantStatut) => {
    const { error } = await supabase.from('session_participants').update({ statut }).eq('id', p.id);
    if (error) { alert(`Modification impossible : ${error.message}`); return; }
    onChanged();
  };

  const duJour = sessionsDuJour(jour);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Calendrier — positionner sur une session</h3>
        </div>
        <Link to={`/calendrier?date=${ymd(jour)}`} onClick={onNavigate} className="text-xs text-brand-600 hover:underline dark:text-brand-400">
          Ouvrir
        </Link>
      </div>

      {/* Navigation du mois */}
      <div className="mb-1 flex items-center justify-between">
        <button onClick={() => setMois(subMonths(mois, 1))} aria-label="Mois précédent" className="rounded p-1 text-muted hover:bg-surface-2 hover:text-brand-600">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setMois(new Date()); setJour(new Date()); }}
          className="text-sm font-semibold capitalize text-fg hover:text-brand-600"
          title="Revenir au mois en cours"
        >
          {format(mois, 'MMMM yyyy', { locale: fr })}
        </button>
        <button onClick={() => setMois(addMonths(mois, 1))} aria-label="Mois suivant" className="rounded p-1 text-muted hover:bg-surface-2 hover:text-brand-600">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Grille miniature */}
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-muted">
        {JOURS.map((d, i) => <div key={i} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {jours.map((d) => {
          const items = sessionsDuJour(d);
          const inscrit = items.some((s) => participationDe(s.id));
          const actif = isSameDay(d, jour);
          return (
            <button
              key={d.toISOString()}
              onClick={() => { setJour(d); setPending(null); setRecap([]); }}
              title={items.length ? items.map((s) => s.titre).join(' · ') : undefined}
              className={cn(
                'flex h-9 flex-col items-center justify-center rounded-md text-xs transition-colors',
                !isSameMonth(d, mois) && 'text-muted/50',
                actif ? 'bg-brand-600 font-semibold text-white'
                  : inscrit ? 'bg-brand-500/15 font-semibold text-brand-600 hover:bg-brand-500/25 dark:text-brand-400'
                    : 'text-fg hover:bg-surface-2',
                isSameDay(d, new Date()) && !actif && 'ring-1 ring-inset ring-brand-400',
              )}
            >
              {format(d, 'd')}
              <span className="mt-0.5 flex h-1 items-center gap-0.5">
                {items.slice(0, 3).map((s) => (
                  <span key={s.id} className="h-1 w-1 rounded-full" style={{ background: actif ? '#fff' : s.couleur }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sessions du jour sélectionné */}
      <div className="mt-3 space-y-1.5">
        <p className="text-xs font-medium text-muted">
          {format(jour, 'EEEE d MMMM yyyy', { locale: fr })}
        </p>
        {duJour.length === 0 ? (
          <p className="text-sm text-muted">
            Aucune session ce jour.{' '}
            <Link to={`/calendrier?date=${ymd(jour)}`} onClick={onNavigate} className="text-brand-600 hover:underline dark:text-brand-400">
              Créer une session
            </Link>
          </p>
        ) : duJour.map((s) => {
          const p = participationDe(s.id);
          return (
            <div key={s.id} className="rounded-lg border border-line px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm text-fg">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.couleur }} />
                  <span className="truncate">{heureDe(s)} · {s.titre}</span>
                </span>
                {p ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <select
                      className="input max-w-[105px] py-0.5 text-xs"
                      value={p.statut}
                      onChange={(e) => changerStatut(p, e.target.value as ParticipantStatut)}
                      title="Statut du participant"
                    >
                      {PART_STATUTS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                    </select>
                    <button onClick={() => retirer(p, s)} disabled={busy} title="Retirer de la session" className="rounded p-0.5 text-muted hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => ouvrirCascade(s)}
                    disabled={busy}
                    className="btn-secondary shrink-0 px-2 py-1 text-xs"
                    title="Positionner ce contact sur la session"
                  >
                    <Plus className="h-3.5 w-3.5" /> Positionner
                  </button>
                )}
              </div>

              {/* Options de la mise à jour en cascade */}
              {pending?.id === s.id && (
                <div className="mt-2 space-y-2 rounded-lg border border-brand-500/40 bg-surface-2 p-2">
                  <p className="text-xs font-semibold text-fg">
                    Mettre à jour en cascade
                  </p>
                  {opportunites.length > 0 && (
                    <div className="flex gap-1.5">
                      <select
                        className="input py-1 text-xs"
                        value={cas.oppId}
                        onChange={(e) => setCas({ ...cas, oppId: e.target.value })}
                        title="Opportunité à faire avancer"
                      >
                        <option value="">Ne pas toucher au pipeline</option>
                        {opportunites.map((o) => (
                          <option key={o.id} value={o.id}>{o.titre} ({OPP_STAGE_LABELS[o.stage]})</option>
                        ))}
                      </select>
                      <select
                        className="input max-w-[125px] py-1 text-xs"
                        value={cas.stage}
                        onChange={(e) => setCas({ ...cas, stage: e.target.value as OpportuniteStage })}
                        disabled={!cas.oppId}
                        title="Étape cible"
                      >
                        {OPP_STAGE_ORDER.map((st) => <option key={st} value={st}>{OPP_STAGE_LABELS[st]}</option>)}
                      </select>
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs text-fg">
                    <input type="checkbox" checked={cas.action} onChange={(e) => setCas({ ...cas, action: e.target.checked })} />
                    Créer l'action de suivi au {format(parseISO(s.date_debut), 'dd/MM')} (évite le stand-by)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-fg">
                    <input type="checkbox" checked={cas.fiche} onChange={(e) => setCas({ ...cas, fiche: e.target.checked })} />
                    Date de formation + inscription validée
                  </label>
                  <label className="flex items-center gap-2 text-xs text-fg">
                    <input type="checkbox" checked={cas.apprenant} onChange={(e) => setCas({ ...cas, apprenant: e.target.checked })} />
                    Passer le contact en apprenant (statut « gagné »)
                  </label>
                  <div className="flex gap-2">
                    <button onClick={positionner} disabled={busy} className="btn-primary py-1 text-xs">
                      {busy ? 'Enregistrement…' : 'Confirmer'}
                    </button>
                    <button onClick={() => setPending(null)} disabled={busy} className="btn-secondary py-1 text-xs">Annuler</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Récapitulatif de ce qui a réellement été écrit */}
      {recap.length > 0 && (
        <ul className="mt-2 space-y-0.5 rounded-lg border border-line bg-surface-2 p-2">
          {recap.map((r, i) => (
            <li key={i} className={cn('flex items-start gap-1.5 text-xs', r.startsWith('⚠') ? 'text-amber-600 dark:text-amber-400' : 'text-muted')}>
              {r.startsWith('⚠')
                ? <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
                : <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />}
              <span>{r.replace(/^⚠ /, '')}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Rappel des sessions du contact hors du mois affiché */}
      {participants.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          {participants.length} session{participants.length > 1 ? 's' : ''} pour ce contact.{' '}
          <Badge tone="brand">{participants.filter((p) => p.statut === 'inscrit').length} inscrit(s)</Badge>
        </p>
      )}
    </div>
  );
}
