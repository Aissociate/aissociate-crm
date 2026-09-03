// Historique unifié d'un contact : toutes les traces rattachées à la fiche,
// fusionnées en une seule timeline antichronologique — actions de suivi,
// e-mails/WhatsApp, conversations enregistrées (capture mobile), opportunités,
// devis, signatures, dossiers, plans de formation, sessions, questionnaires,
// documents du coffre, demande initiale du site et création de la fiche.
// Chargé à l'ouverture de l'onglet (une requête par source, en parallèle).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone, Mail, MessageCircle, Mic, TrendingUp, FileText, PenLine, FolderKanban,
  ClipboardList, CalendarDays, ListChecks, FolderLock, Globe, UserPlus, CalendarClock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge, Spinner, type Tone } from '@/components/ui';
import { DOSSIER_STATUT_LABELS, DOSSIER_STATUT_TONES, OPP_STAGE_LABELS } from '@/lib/constants';

type Famille = 'echange' | 'commercial' | 'formation' | 'document' | 'systeme';

type Evt = {
  date: string; // ISO — clé de tri
  famille: Famille;
  icone: JSX.Element;
  titre: string;
  detail?: string | null;
  badge?: { text: string; tone: Tone };
  lien?: string; // route interne : ferme la fiche à la navigation
  /** Action planifiée non réalisée : mise en avant. */
  aFaire?: boolean;
};

const FAMILLES: { cle: Famille | 'tout'; label: string }[] = [
  { cle: 'tout', label: 'Tout' },
  { cle: 'echange', label: 'Échanges' },
  { cle: 'commercial', label: 'Commercial' },
  { cle: 'formation', label: 'Formation' },
  { cle: 'document', label: 'Documents' },
];

const FAMILLE_STYLE: Record<Famille, string> = {
  echange: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  commercial: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  formation: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  document: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  systeme: 'bg-surface-2 text-muted',
};

const jourLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const heureLabel = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() || d.getMinutes() ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
};

const ACTION_ICONES: Record<string, JSX.Element> = {
  appel: <Phone className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  rdv: <CalendarClock className="h-3.5 w-3.5" />,
};

type Props = { contactId: string; contactCreatedAt: string; onNavigate: () => void };

export default function HistoriqueContact({ contactId, contactCreatedAt, onNavigate }: Props) {
  const [evts, setEvts] = useState<Evt[] | null>(null);
  const [filtre, setFiltre] = useState<Famille | 'tout'>('tout');

  useEffect(() => {
    let vivant = true;
    (async () => {
      const [actions, emails, convs, opps, devis, signatures, dossiers, plans, parts, quests, docs, leads] = await Promise.all([
        supabase.from('contact_actions').select('type, description, date_action, heure_action, faite').eq('contact_id', contactId).limit(300),
        supabase.from('emails').select('direction, canal, sujet, statut, expediteur, created_at').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(150),
        supabase.from('conversations').select('titre, resume, statut, demarree_at, created_at').eq('contact_id', contactId).limit(50),
        supabase.from('opportunites').select('id, titre, stage, montant, created_at').eq('contact_id', contactId),
        supabase.from('devis').select('numero, objet, statut, date_emission, created_at').eq('contact_id', contactId),
        supabase.from('signatures').select('libelle, statut, signe_at, created_at').eq('contact_id', contactId),
        supabase.from('dossiers').select('id, reference, intitule, statut, created_at').eq('contact_id', contactId),
        supabase.from('plans_formation').select('nom, statut, created_at').eq('contact_id', contactId),
        supabase.from('session_participants').select('statut, created_at, session_id').eq('contact_id', contactId),
        supabase.from('questionnaire_envois').select('modele_code, statut, sent_at, responded_at, created_at').eq('contact_id', contactId),
        supabase.from('contact_documents').select('titre, created_at').eq('contact_id', contactId),
        supabase.from('contact_requests').select('request_type, source, created_at').eq('contact_id', contactId),
      ]);
      // Titres des sessions liées aux participations.
      const sessionIds = (parts.data ?? []).map((p) => p.session_id).filter(Boolean);
      const sessions = sessionIds.length
        ? (await supabase.from('sessions_formation').select('id, titre, date_debut').in('id', sessionIds)).data ?? []
        : [];
      const sessionDe = new Map(sessions.map((s) => [s.id, s]));
      if (!vivant) return;

      const out: Evt[] = [];

      for (const a of actions.data ?? []) {
        out.push({
          date: `${a.date_action}T${a.heure_action ?? '12:00'}`,
          famille: 'echange',
          icone: ACTION_ICONES[a.type] ?? <ClipboardList className="h-3.5 w-3.5" />,
          titre: a.description,
          detail: a.type,
          aFaire: !a.faite,
          badge: a.faite ? undefined : { text: 'À faire', tone: 'warning' },
        });
      }
      for (const e of emails.data ?? []) {
        const entrant = e.direction === 'entrant';
        out.push({
          date: e.created_at,
          famille: 'echange',
          icone: e.canal === 'whatsapp' ? <MessageCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />,
          titre: e.sujet || (e.canal === 'whatsapp' ? 'Message WhatsApp' : 'E-mail'),
          detail: entrant ? `reçu${e.expediteur ? ` de ${e.expediteur}` : ''}` : e.statut === 'brouillon' ? 'brouillon' : 'envoyé',
          badge: entrant ? { text: 'Reçu', tone: 'info' } : undefined,
        });
      }
      for (const cv of convs.data ?? []) {
        out.push({
          date: cv.demarree_at ?? cv.created_at,
          famille: 'echange',
          icone: <Mic className="h-3.5 w-3.5" />,
          titre: cv.titre || 'Conversation enregistrée',
          detail: cv.resume ? String(cv.resume).slice(0, 140) : cv.statut,
        });
      }
      for (const o of opps.data ?? []) {
        out.push({
          date: o.created_at,
          famille: 'commercial',
          icone: <TrendingUp className="h-3.5 w-3.5" />,
          titre: `Opportunité « ${o.titre} »`,
          detail: OPP_STAGE_LABELS[o.stage] ?? o.stage,
          lien: '/pipeline',
        });
      }
      for (const v of devis.data ?? []) {
        out.push({
          date: v.date_emission ?? v.created_at,
          famille: 'commercial',
          icone: <FileText className="h-3.5 w-3.5" />,
          titre: `Devis ${v.numero}`,
          detail: v.objet,
          badge: { text: v.statut, tone: v.statut === 'accepte' ? 'success' : v.statut === 'refuse' ? 'danger' : 'neutral' },
          lien: '/devis',
        });
      }
      for (const s of signatures.data ?? []) {
        out.push({
          date: s.signe_at ?? s.created_at,
          famille: 'commercial',
          icone: <PenLine className="h-3.5 w-3.5" />,
          titre: `Signature — ${s.libelle}`,
          badge: s.statut === 'signee'
            ? { text: 'Signée', tone: 'success' }
            : { text: s.statut, tone: String(s.statut) === 'annulee' ? 'neutral' : 'warning' },
        });
      }
      for (const d of dossiers.data ?? []) {
        out.push({
          date: d.created_at,
          famille: 'formation',
          icone: <FolderKanban className="h-3.5 w-3.5" />,
          titre: `Dossier ${d.reference} — ${d.intitule}`,
          badge: { text: DOSSIER_STATUT_LABELS[d.statut] ?? d.statut, tone: DOSSIER_STATUT_TONES[d.statut] ?? 'neutral' },
          lien: `/dossiers/${d.id}`,
        });
      }
      for (const p of plans.data ?? []) {
        out.push({
          date: p.created_at,
          famille: 'formation',
          icone: <ClipboardList className="h-3.5 w-3.5" />,
          titre: `Plan de formation « ${p.nom} »`,
          detail: p.statut,
          lien: '/plans',
        });
      }
      for (const pt of parts.data ?? []) {
        const s = sessionDe.get(pt.session_id);
        out.push({
          date: s?.date_debut ?? pt.created_at,
          famille: 'formation',
          icone: <CalendarDays className="h-3.5 w-3.5" />,
          titre: s ? `Session « ${s.titre} »` : 'Inscription à une session',
          detail: pt.statut,
          lien: s ? `/calendrier?date=${String(s.date_debut).slice(0, 10)}` : '/calendrier',
        });
      }
      for (const q of quests.data ?? []) {
        out.push({
          date: q.responded_at ?? q.sent_at ?? q.created_at,
          famille: 'formation',
          icone: <ListChecks className="h-3.5 w-3.5" />,
          titre: `Questionnaire ${q.modele_code}`,
          badge: q.responded_at
            ? { text: 'Répondu', tone: 'success' }
            : { text: q.statut, tone: q.statut === 'envoye' ? 'info' : 'neutral' },
        });
      }
      for (const d of docs.data ?? []) {
        out.push({
          date: d.created_at,
          famille: 'document',
          icone: <FolderLock className="h-3.5 w-3.5" />,
          titre: `Document « ${d.titre} » ajouté au coffre`,
        });
      }
      for (const l of leads.data ?? []) {
        out.push({
          date: l.created_at,
          famille: 'systeme',
          icone: <Globe className="h-3.5 w-3.5" />,
          titre: 'Demande reçue depuis le site',
          detail: [l.request_type, l.source].filter(Boolean).join(' · '),
        });
      }
      out.push({
        date: contactCreatedAt,
        famille: 'systeme',
        icone: <UserPlus className="h-3.5 w-3.5" />,
        titre: 'Fiche contact créée',
      });

      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      setEvts(out);
    })();
    return () => { vivant = false; };
  }, [contactId, contactCreatedAt]);

  const visibles = useMemo(
    () => (evts ?? []).filter((e) => filtre === 'tout' || e.famille === filtre),
    [evts, filtre],
  );
  const compteDe = (f: Famille | 'tout') =>
    f === 'tout' ? evts?.length ?? 0 : (evts ?? []).filter((e) => e.famille === f).length;

  if (evts === null) {
    return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  }

  // Groupage par jour pour la lecture (la liste reste un seul flux trié).
  const groupes: { jour: string; items: Evt[] }[] = [];
  for (const e of visibles) {
    const jour = e.date.slice(0, 10);
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.jour === jour) dernier.items.push(e);
    else groupes.push({ jour, items: [e] });
  }

  return (
    <div className="space-y-4">
      {/* Filtres par famille */}
      <div className="flex flex-wrap gap-1.5">
        {FAMILLES.map((f) => (
          <button key={f.cle} onClick={() => setFiltre(f.cle)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              filtre === f.cle
                ? 'border-brand-500/40 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                : 'border-line bg-surface text-muted hover:border-brand-300 hover:text-fg'
            }`}>
            {f.label} <span className="opacity-60">{compteDe(f.cle)}</span>
          </button>
        ))}
      </div>

      {visibles.length === 0 && <p className="py-8 text-center text-sm text-muted">Aucun élément dans cette catégorie.</p>}

      {groupes.map((g) => (
        <div key={g.jour}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{jourLabel(g.jour)}</p>
          <ol className="relative ml-3 space-y-2 border-l border-line pl-4">
            {g.items.map((e, i) => (
              <li key={i} className={`relative rounded-lg border px-3 py-2 ${e.aFaire ? 'border-amber-500/30 bg-amber-500/5' : 'border-line bg-surface'}`}>
                {/* Pastille sur le rail */}
                <span className={`absolute -left-[26px] top-2.5 flex h-5 w-5 items-center justify-center rounded-full ${FAMILLE_STYLE[e.famille]}`}>
                  {e.icone}
                </span>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-fg">
                      {e.lien
                        ? <Link to={e.lien} onClick={onNavigate} className="hover:text-brand-600 hover:underline dark:hover:text-brand-400">{e.titre}</Link>
                        : e.titre}
                    </p>
                    {e.detail && <p className="mt-0.5 truncate text-xs text-muted">{e.detail}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {e.badge && <Badge tone={e.badge.tone}>{e.badge.text}</Badge>}
                    <span className="text-xs tabular-nums text-muted">{heureLabel(e.date)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
