import { useState, useEffect, type ReactNode } from 'react';
import {
  startOfDay, startOfWeek, startOfMonth,
  subDays, subWeeks, subMonths, differenceInHours, format,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Eye, ClipboardList, TrendingUp, Clock, Euro, Landmark, Trophy, Megaphone,
  ArrowUpRight, ArrowDownRight, Minus, Mail, ListTodo, Percent, Target,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Spinner, Badge } from '@/components/ui';
import { DOSSIER_STATUT_LABELS } from '@/lib/constants';
import { formatMoney, initials, isConseillerInactif } from '@/lib/utils';
import type { Dossier, DossierStatut, Opportunite, Profile, ContactRequest, Email, Contact, ContactAction } from '@/lib/database.types';

/** Compteurs de trafic renvoyés par la fonction SQL `dashboard_visiteurs`. */
type Trafic = { visiteurs: number; vues: number };

type MetaCampaign = { name: string; spend: number; impressions: number; clicks: number; leads: number };
type MetaInsights = {
  ok?: boolean; configured?: boolean; error?: string; message?: string;
  currency?: string; account?: string | null;
  totals?: { spend: number; impressions: number; clicks: number; ctr: number; cpc: number; reach: number; leads: number };
  campaigns?: MetaCampaign[];
};

type Gran = 'jour' | 'semaine' | 'mois';
const GRAN_LABEL: Record<Gran, string> = { jour: 'Jour', semaine: 'Semaine', mois: 'Mois' };
const COMPARATIF: Record<Gran, string> = { jour: "vs hier", semaine: 'vs semaine préc.', mois: 'vs mois préc.' };
const GRID = 'rgb(148 163 184 / 0.2)';

// ─── Helpers de période ──────────────────────────────────────────────────────
function periodStart(gran: Gran, now: Date): Date {
  if (gran === 'jour') return startOfDay(now);
  if (gran === 'semaine') return startOfWeek(now, { weekStartsOn: 1 });
  return startOfMonth(now);
}
function previousStart(gran: Gran, start: Date): Date {
  if (gran === 'jour') return subDays(start, 1);
  if (gran === 'semaine') return subWeeks(start, 1);
  return subMonths(start, 1);
}
/** Débuts des N derniers seaux (pour la courbe de tendance). */
function bucketStarts(gran: Gran, now: Date, n: number): Date[] {
  const f = gran === 'jour'
    ? (k: number) => startOfDay(subDays(now, k))
    : gran === 'semaine'
      ? (k: number) => startOfWeek(subWeeks(now, k), { weekStartsOn: 1 })
      : (k: number) => startOfMonth(subMonths(now, k));
  const out: Date[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(f(i));
  return out;
}
function bucketLabel(gran: Gran, d: Date): string {
  if (gran === 'mois') return format(d, 'MMM yy', { locale: fr });
  return format(d, 'dd/MM', { locale: fr });
}

const inRange = (iso: string | null | undefined, a: Date, b: Date): boolean => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= a.getTime() && t < b.getTime();
};

// ─── Indicateur de variation ─────────────────────────────────────────────────
function Delta({ cur, prev, invert = false, label }: { cur: number; prev: number; invert?: boolean; label: string }) {
  if (prev === 0 && cur === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-muted"><Minus className="h-3 w-3" /> {label}</span>;
  }
  const pct = prev === 0 ? 100 : Math.round(((cur - prev) / Math.abs(prev)) * 100);
  const up = pct >= 0;
  const good = invert ? !up : up;
  const tone = pct === 0 ? 'text-muted' : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const Icon = pct === 0 ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}>
      <Icon className="h-3.5 w-3.5" /> {prev === 0 ? '—' : `${up ? '+' : ''}${pct}%`}
      <span className="font-normal text-muted">· {label}</span>
    </span>
  );
}

// ─── Carte KPI ───────────────────────────────────────────────────────────────
// `compact` : version resserrée pour que les 6 indicateurs de performance
// tiennent sur une seule ligne (ticket Benjamin « ergonomie tableau de bord »).
function Kpi({ icon, label, value, hint, delta, compact = false }: {
  icon: ReactNode; label: string; value: ReactNode; hint?: string; delta?: ReactNode; compact?: boolean;
}) {
  return (
    <div className={`card flex flex-col ${compact ? 'gap-1.5 p-3' : 'gap-3 p-5'}`}>
      <div className="flex items-center justify-between gap-1">
        <span className={`${compact ? 'text-xs leading-tight' : 'text-sm'} text-muted`}>{label}</span>
        <span className={`shrink-0 rounded-lg bg-brand-500/10 text-brand-500 ${compact ? 'p-1.5' : 'p-2'}`}>{icon}</span>
      </div>
      <div>
        <p className={`font-bold tracking-tight text-fg ${compact ? 'text-lg' : 'text-2xl'}`}>{value}</p>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-muted">{hint}</p>}
      </div>
      {delta && <div className={`border-t border-line ${compact ? 'pt-1.5' : 'pt-2'}`}>{delta}</div>}
    </div>
  );
}

// Ligne « libellé — valeur » des badges de prospection.
function Ligne({ label, value, sub, alerte = false }: { label: string; value: ReactNode; sub?: string; alerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="min-w-0 text-sm text-muted">
        {label}{sub && <span className="block text-[11px] text-muted/80">{sub}</span>}
      </span>
      <span className={`shrink-0 text-lg font-bold ${alerte ? 'text-red-600 dark:text-red-400' : 'text-fg'}`}>{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const { profile, isManager } = useAuth();
  const [gran, setGran] = useState<Gran>('semaine');

  const opps = useCollection<Opportunite>('opportunites');
  const dossiers = useCollection<Dossier>('dossiers');
  const leads = useCollection<ContactRequest>('contact_requests');
  const contacts = useCollection<Contact>('contacts');
  const profiles = useCollection<Profile>('profiles');
  const emails = useCollection<Email>('emails');
  const actionsCol = useCollection<ContactAction>('contact_actions');

  // Mails entrants non lus par intervenant (owner du mail). Voir RLS : un
  // conseiller ne voit que les siens, la direction voit tout.
  // Les conseillers devenus inactifs sont exclus : leurs mails ne doivent plus
  // remonter comme notifications (ticket Benjamin « notifications messagerie »).
  const inactifIds = new Set(profiles.data.filter(isConseillerInactif).map((p) => p.id));
  const unreadByOwner = new Map<string, number>();
  for (const e of emails.data) {
    if (e.canal === 'whatsapp' || e.direction !== 'entrant' || e.lu) continue;
    if (e.owner_id && inactifIds.has(e.owner_id)) continue;
    const k = e.owner_id ?? '—';
    unreadByOwner.set(k, (unreadByOwner.get(k) ?? 0) + 1);
  }
  const myUnread = profile ? (unreadByOwner.get(profile.id) ?? 0) : 0;
  const unreadList = [...unreadByOwner.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const totalNonLus = unreadList.reduce((s, [, n]) => s + n, 0);

  // ── Trafic du site : compté côté serveur ────────────────────────────────────
  // `page_views` dépasse 20 000 lignes : les rapatrier pour compter dans le
  // navigateur demandait 21 requêtes paginées (~35 s), pendant lesquelles la
  // tuile affichait 0. La fonction `dashboard_visiteurs` renvoie un compteur par
  // fenêtre en une requête. `null` = pas encore chargé (≠ zéro visiteur).
  const [trafic, setTrafic] = useState<{ cur: Trafic; prev: Trafic; buckets: Trafic[] } | null>(null);
  useEffect(() => {
    if (!isManager) { setTrafic(null); return; }
    // Base de temps figée dans l'effet : `now` recalculé à chaque rendu
    // relancerait la requête en boucle.
    const n = new Date();
    const s = periodStart(gran, n);
    const ps = previousStart(gran, s);
    const pe = new Date(ps.getTime() + (n.getTime() - s.getTime()));
    const bs = bucketStarts(gran, n, gran === 'jour' ? 14 : 12);
    const fin = new Date(n.getTime() + 1);
    const ranges = [
      [s.toISOString(), n.toISOString()],
      [ps.toISOString(), pe.toISOString()],
      ...bs.map((b, i) => [b.toISOString(), (i + 1 < bs.length ? bs[i + 1] : fin).toISOString()]),
    ];
    supabase.rpc('dashboard_visiteurs', { p_ranges: ranges }).then(({ data, error }) => {
      const rows = (Array.isArray(data) ? data : []) as Trafic[];
      if (error || rows.length < 2) { setTrafic(null); return; }
      setTrafic({ cur: rows[0], prev: rows[1], buckets: rows.slice(2) });
    });
  }, [gran, isManager]);

  // Performances publicitaires Meta (lues côté serveur via l'Edge Function meta-ads).
  const [meta, setMeta] = useState<MetaInsights | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  useEffect(() => {
    if (!isManager) return;
    const n = new Date();
    const s = periodStart(gran, n);
    setMetaLoading(true);
    supabase.functions
      .invoke('meta-ads', { body: { action: 'insights', since: format(s, 'yyyy-MM-dd'), until: format(n, 'yyyy-MM-dd') } })
      .then(({ data, error }) => setMeta(error ? { ok: false, error: error.message } : (data as MetaInsights)))
      .catch((e) => setMeta({ ok: false, error: e instanceof Error ? e.message : String(e) }))
      .finally(() => setMetaLoading(false));
  }, [gran, isManager]);

  if (opps.loading || dossiers.loading) {
    return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  }

  const now = new Date();
  const start = periodStart(gran, now);
  const prevStart = previousStart(gran, start);
  // Comparatif à durée égale : on compare la même fraction écoulée de la période.
  const elapsed = now.getTime() - start.getTime();
  const prevEnd = new Date(prevStart.getTime() + elapsed);
  const cmp = COMPARATIF[gran];

  // ── KPI : visiteurs (uniques) + pages vues ──
  const visiteursCur = trafic?.cur.visiteurs ?? 0;
  const visiteursPrev = trafic?.prev.visiteurs ?? 0;
  const vuesCur = trafic?.cur.vues ?? 0;

  // ── KPI : leads totaux = formulaires web + nouveaux prospects (import/manuel) ──
  // Anti double-comptage : un lead du formulaire crée déjà un contact prospect
  // (trigger) ; on ne recompte donc que les prospects créés HORS formulaire.
  const formContactIds = new Set(leads.data.map((l) => l.contact_id).filter(Boolean) as string[]);
  const newProspects = (a: Date, b: Date) =>
    contacts.data.filter((c) => c.type === 'prospect' && !formContactIds.has(c.id) && inRange(c.created_at, a, b)).length;
  const formCur = leads.data.filter((l) => inRange(l.created_at, start, now)).length;
  const formPrev = leads.data.filter((l) => inRange(l.created_at, prevStart, prevEnd)).length;
  const leadsCur = formCur + newProspects(start, now);
  const leadsPrev = formPrev + newProspects(prevStart, prevEnd);

  // ── KPI : opportunités créées ──
  const oppsCreesCur = opps.data.filter((o) => inRange(o.created_at, start, now));
  const oppsCreesPrev = opps.data.filter((o) => inRange(o.created_at, prevStart, prevEnd));

  // ── KPI : valeur moyenne d'opportunité (sur la période de création) ──
  const avg = (arr: Opportunite[]) => (arr.length ? arr.reduce((s, o) => s + Number(o.montant ?? 0), 0) / arr.length : 0);
  const valMoyCur = avg(oppsCreesCur);
  const valMoyPrev = avg(oppsCreesPrev);

  // ── KPI : temps de traitement (ouverture -> clôture gagné/perdu), en jours ──
  const closedIn = (a: Date, b: Date) => opps.data.filter((o) => inRange(o.date_cloture, a, b));
  const avgDays = (arr: Opportunite[]) =>
    arr.length ? arr.reduce((s, o) => s + differenceInHours(new Date(o.date_cloture!), new Date(o.created_at)) / 24, 0) / arr.length : 0;
  const traitementCur = avgDays(closedIn(start, now));
  const traitementPrev = avgDays(closedIn(prevStart, prevEnd));

  // ── KPI : dossiers en vie chez le financeur — instantané ──
  // Ordre chronologique du parcours ; brouillon, refusé et clôturé sont exclus
  // (ticket Benjamin « badge dossier chez le financeur »).
  const ETAPES_FINANCEUR: DossierStatut[] = ['montage', 'depose', 'en_instruction', 'accorde', 'en_cours', 'solde'];
  const parEtape = ETAPES_FINANCEUR.map((s) => ({
    statut: s, label: DOSSIER_STATUT_LABELS[s],
    n: dossiers.data.filter((d) => d.statut === s).length,
  }));
  const chezFinanceur = parEtape.reduce((s, e) => s + e.n, 0);

  // ── Suivi de la prospection : actions à faire ──
  const todayStr = format(now, 'yyyy-MM-dd');
  const aFaire = actionsCol.data.filter((a) => !a.faite);
  const appelsEnRetard = aFaire.filter((a) => a.type === 'appel' && a.date_action < todayStr).length;
  const appelsAujourdhui = aFaire.filter((a) => a.type === 'appel' && a.date_action === todayStr).length;
  const mailsAEnvoyer = aFaire.filter((a) => a.type === 'email').length;
  const rdvAujourdhui = aFaire.filter((a) => a.type === 'rdv' && a.date_action === todayStr).length;

  // ── Suivi de la prospection : opportunités en cours ──
  // « Stand-by » : même définition que les colonnes du pipeline — le contact lié
  // n'a aucune action à faire dans les 30 (ou 90) prochains jours.
  const ouvertes = opps.data.filter((o) => o.stage !== 'gagne' && o.stage !== 'perdu');
  const somme = (arr: Opportunite[]) => arr.reduce((s, o) => s + Number(o.montant ?? 0), 0);
  const dansNJours = (n: number) => { const d = new Date(now); d.setDate(d.getDate() + n); return format(d, 'yyyy-MM-dd'); };
  const prochaineAction = (contactId: string | null): string | null => {
    if (!contactId) return null;
    return aFaire.filter((a) => a.contact_id === contactId && a.date_action >= todayStr)
      .map((a) => a.date_action).sort()[0] ?? null;
  };
  const oppNouveau = ouvertes.filter((o) => o.stage === 'nouveau');
  const oppEnCours = ouvertes.filter((o) => o.stage === 'qualifie' || o.stage === 'negociation');
  const oppStandby30 = ouvertes.filter((o) => {
    const p = prochaineAction(o.contact_id);
    return !!p && p > dansNJours(30) && p <= dansNJours(90);
  });
  const oppStandby90 = ouvertes.filter((o) => {
    const p = prochaineAction(o.contact_id);
    return !p || p > dansNJours(90);
  });

  // ── Suivi de la prospection : mails entrants à qualifier ──
  // La synchronisation IMAP n'ingère que des expéditeurs connus : un mail sans
  // contact rattaché vient d'un individu non référencé comme contact.
  const contactById = new Map(contacts.data.map((c) => [c.id, c]));
  const entrantsNonLus = emails.data.filter((e) => e.direction === 'entrant' && !e.lu && e.canal !== 'whatsapp');
  const nonReference = entrantsNonLus.filter((e) => !e.contact_id).length;
  const nonAffecte = entrantsNonLus.filter((e) => {
    const c = e.contact_id ? contactById.get(e.contact_id) : null;
    return !!c && !c.owner_id && !c.responsable_id;
  }).length;

  // ── Courbe de tendance ──
  const starts = bucketStarts(gran, now, gran === 'jour' ? 14 : 12);
  const trend = starts.map((bStart, i) => {
    const bEnd = i + 1 < starts.length ? starts[i + 1] : new Date(now.getTime() + 1);
    return {
      label: bucketLabel(gran, bStart),
      Visiteurs: trafic?.buckets[i]?.visiteurs ?? 0,
      Leads: leads.data.filter((l) => inRange(l.created_at, bStart, bEnd)).length + newProspects(bStart, bEnd),
      Opportunités: opps.data.filter((o) => inRange(o.created_at, bStart, bEnd)).length,
    };
  });

  // ── Classement conseillers : CA des opportunités gagnées sur la période ──
  const wonInPeriod = opps.data.filter((o) => o.stage === 'gagne' && inRange(o.date_cloture, start, now));
  const byOwner = new Map<string, { ca: number; n: number }>();
  for (const o of wonInPeriod) {
    const k = o.owner_id ?? '—';
    const cur = byOwner.get(k) ?? { ca: 0, n: 0 };
    cur.ca += Number(o.montant ?? 0); cur.n += 1;
    byOwner.set(k, cur);
  }
  // ── KPI : taux de transformation ────────────────────────────────────────────
  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
  const fmtPct = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: n < 10 ? 2 : 1 })} %`;

  // Visiteur → lead, sur la période affichée : le trafic est assez dense pour
  // que le ratio ait un sens à la semaine. Seules les demandes du formulaire
  // viennent du site — les prospects importés ou saisis ne sont pas issus du
  // trafic et fausseraient le taux.
  const tauxLeadCur = pct(formCur, visiteursCur);
  const tauxLeadPrev = pct(formPrev, visiteursPrev);

  // Lead → gagné et valeur moyenne d'un gain : sur 12 MOIS GLISSANTS, pas sur la
  // période affichée. Le cycle de vente dépasse largement la semaine et les
  // affaires gagnées se comptent sur les doigts d'une main : rapporté à la
  // semaine, le taux vaudrait 0 % en permanence et n'apprendrait rien. La
  // fenêtre est indiquée sous chaque tuile.
  // Ratio de flux, pas suivi de cohorte : une affaire gagnée dans la fenêtre
  // peut venir d'un lead antérieur.
  const an1 = subMonths(now, 12);
  const an2 = subMonths(now, 24);
  const leadsEntre = (a: Date, b: Date) =>
    leads.data.filter((l) => inRange(l.created_at, a, b)).length + newProspects(a, b);
  const gagneesEntre = (a: Date, b: Date) =>
    opps.data.filter((o) => o.stage === 'gagne' && inRange(o.date_cloture, a, b));
  const leads12 = leadsEntre(an1, now);
  const leads24 = leadsEntre(an2, an1);
  const gagnees12 = gagneesEntre(an1, now);
  const gagnees24 = gagneesEntre(an2, an1);

  const tauxGagneCur = pct(gagnees12.length, leads12);
  const tauxGagnePrev = pct(gagnees24.length, leads24);
  const gainMoyCur = gagnees12.length ? somme(gagnees12) / gagnees12.length : 0;
  const gainMoyPrev = gagnees24.length ? somme(gagnees24) / gagnees24.length : 0;

  const pName = (id: string) => {
    const p = profiles.data.find((x) => x.id === id);
    return p ? `${p.prenom ?? ''} ${p.nom ?? ''}`.trim() || p.email : 'Non attribué';
  };
  const classement = [...byOwner.entries()]
    .map(([id, v]) => ({ id, name: pName(id), ...v }))
    .sort((a, b) => b.ca - a.ca);
  const caMax = classement[0]?.ca ?? 0;
  const caTotal = classement.reduce((s, c) => s + c.ca, 0);

  const fmtDays = (d: number) => `${d.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j`;
  const fmtNum = (n: number) => n.toLocaleString('fr-FR');
  const fmtCur = (n: number, cur = 'EUR') => {
    try { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); }
    catch { return `${fmtNum(Math.round(n))} ${cur}`; }
  };
  const metaCur = meta?.currency ?? 'EUR';
  const metaCpl = meta?.totals && meta.totals.leads > 0 ? meta.totals.spend / meta.totals.leads : null;

  return (
    <div>
      <PageHeader
        title={`Tableau de bord${profile?.prenom ? ` — ${profile.prenom}` : ''}`}
        subtitle="Pilotage de l'activité commerciale et du site web, avec comparatif de période"
        actions={
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
            {(Object.keys(GRAN_LABEL) as Gran[]).map((g) => (
              <button
                key={g}
                onClick={() => setGran(g)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  gran === g ? 'bg-brand-500 text-white shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                {GRAN_LABEL[g]}
              </button>
            ))}
          </div>
        }
      />

      {/* ── Suivi de la prospection (en tête de page) ───────────────────────── */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Suivi de la prospection</h2>
      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Mails entrants */}
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold text-fg"><Mail className="h-5 w-5 text-brand-500" /> Mails entrants</h3>
            <Badge tone={(isManager ? totalNonLus : myUnread) > 0 ? 'warning' : 'neutral'}>
              {isManager ? totalNonLus : myUnread} non lu{(isManager ? totalNonLus : myUnread) > 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="divide-y divide-line">
            {isManager ? (
              unreadList.length === 0
                ? <p className="py-4 text-center text-sm text-muted">Aucun mail entrant non lu.</p>
                : unreadList.map(([id, n]) => <Ligne key={id} label={pName(id)} value={n} />)
            ) : (
              <Ligne label="Vos mails non lus" value={myUnread} />
            )}
          </div>
          {/* Mails à qualifier : expéditeur sans conseiller, ou inconnu de la base. */}
          {(nonAffecte > 0 || nonReference > 0) && (
            <div className="mt-3 space-y-1 border-t border-line pt-3">
              {nonAffecte > 0 && <Ligne label="Individu non affecté" sub="expéditeur connu, sans conseiller" value={nonAffecte} alerte />}
              {nonReference > 0 && <Ligne label="Individu non référencé" sub="contact spontané, absent de la base" value={nonReference} alerte />}
            </div>
          )}
        </Card>

        {/* Actions à faire */}
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold text-fg"><ListTodo className="h-5 w-5 text-amber-500" /> Actions à faire</h3>
            <Badge tone={appelsEnRetard > 0 ? 'danger' : 'neutral'}>{aFaire.length} au total</Badge>
          </div>
          <div className="divide-y divide-line">
            <Ligne label="Appels en retard" value={appelsEnRetard} alerte={appelsEnRetard > 0} />
            <Ligne label="Appels à passer aujourd'hui" value={appelsAujourdhui} />
            <Ligne label="Mails à envoyer" value={mailsAEnvoyer} />
            <Ligne label="RDV prévus aujourd'hui" value={rdvAujourdhui} />
          </div>
        </Card>

        {/* Opportunités en cours */}
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold text-fg"><TrendingUp className="h-5 w-5 text-brand-600" /> Opportunités en cours</h3>
            <Badge tone="brand">{formatMoney(somme(ouvertes))}</Badge>
          </div>
          <div className="divide-y divide-line">
            <Ligne label="Nouvelles" sub={formatMoney(somme(oppNouveau))} value={oppNouveau.length} />
            <Ligne label="Qualifiées et en négociation" sub={formatMoney(somme(oppEnCours))} value={oppEnCours.length} />
            <Ligne label="En attente > 30 j" sub={formatMoney(somme(oppStandby30))} value={oppStandby30.length} alerte={oppStandby30.length > 0} />
            <Ligne label="En attente > 90 j" sub={formatMoney(somme(oppStandby90))} value={oppStandby90.length} alerte={oppStandby90.length > 0} />
          </div>
        </Card>
      </div>

      {/* ── Suivi des performances (6 indicateurs sur une ligne) ─────────────── */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Suivi des performances</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {isManager && (
          <Kpi
            compact icon={<Eye className="h-4 w-4" />} label="Visiteurs site"
            value={trafic ? visiteursCur : '…'}
            hint={trafic ? `${fmtNum(vuesCur)} pages vues` : 'chargement…'}
            delta={<Delta cur={visiteursCur} prev={visiteursPrev} label={cmp} />}
          />
        )}
        {isManager && (
          <Kpi
            compact icon={<ClipboardList className="h-4 w-4" />} label="Leads (total)" value={leadsCur}
            hint="Formulaire + nouveaux prospects"
            delta={<Delta cur={leadsCur} prev={leadsPrev} label={cmp} />}
          />
        )}
        {isManager && (
          <Kpi
            compact icon={<Percent className="h-4 w-4" />} label="Visiteur → lead"
            value={trafic ? fmtPct(tauxLeadCur) : '…'}
            hint={trafic ? `${fmtNum(formCur)} demande(s) / ${fmtNum(visiteursCur)} visiteurs` : 'chargement…'}
            delta={<Delta cur={tauxLeadCur} prev={tauxLeadPrev} label={cmp} />}
          />
        )}
        <Kpi
          compact icon={<TrendingUp className="h-4 w-4" />} label="Opportunités créées" value={oppsCreesCur.length}
          delta={<Delta cur={oppsCreesCur.length} prev={oppsCreesPrev.length} label={cmp} />}
        />
        <Kpi
          compact icon={<Clock className="h-4 w-4" />} label="Temps de traitement"
          value={fmtDays(traitementCur)} hint="ouverture → gagné/perdu"
          delta={<Delta cur={traitementCur} prev={traitementPrev} invert label={cmp} />}
        />
        <Kpi
          compact icon={<Euro className="h-4 w-4" />} label="Valeur moy. / opp."
          value={formatMoney(valMoyCur)}
          delta={<Delta cur={valMoyCur} prev={valMoyPrev} label={cmp} />}
        />
        {isManager && (
          <Kpi
            compact icon={<Target className="h-4 w-4" />} label="Lead → gagné"
            value={fmtPct(tauxGagneCur)}
            hint={`${fmtNum(gagnees12.length)} gagné(s) / ${fmtNum(leads12)} lead(s) · 12 mois`}
            delta={<Delta cur={tauxGagneCur} prev={tauxGagnePrev} label="vs 12 mois préc." />}
          />
        )}
        <Kpi
          compact icon={<Trophy className="h-4 w-4" />} label="Valeur moy. / gain"
          value={formatMoney(gainMoyCur)}
          hint={gagnees12.length ? `${fmtNum(gagnees12.length)} affaire(s) gagnée(s) · 12 mois` : 'aucune affaire gagnée sur 12 mois'}
          delta={<Delta cur={gainMoyCur} prev={gainMoyPrev} label="vs 12 mois préc." />}
        />
        <Kpi
          compact icon={<Landmark className="h-4 w-4" />} label="Dossiers chez le financeur"
          value={chezFinanceur}
          hint={parEtape.filter((e) => e.n > 0).map((e) => `${e.n} ${e.label.toLowerCase()}`).join(' · ') || 'aucun dossier en cours'}
        />
      </div>

      {/* ── Tendance ────────────────────────────────────────────────────────── */}
      {/* La carte « Chez le financeur » qui occupait la colonne de droite faisait
          doublon avec l'indicateur « Dossiers chez le financeur » : supprimée. */}
      <div className="mb-6">
        <Card>
          <h2 className="mb-1 font-semibold text-fg">Activité</h2>
          <p className="mb-4 text-xs text-muted">
            {gran === 'jour' ? '14 derniers jours' : gran === 'semaine' ? '12 dernières semaines' : '12 derniers mois'}
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trend} margin={{ left: -16, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} /><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} /></linearGradient>
                <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                <linearGradient id="gO" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ea6a1e" stopOpacity={0.4} /><stop offset="95%" stopColor="#ea6a1e" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgb(148 163 184 / 0.3)', fontSize: 12 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              {isManager && <Area type="monotone" dataKey="Visiteurs" stroke="#0ea5e9" fill="url(#gV)" strokeWidth={2} />}
              {isManager && <Area type="monotone" dataKey="Leads" stroke="#10b981" fill="url(#gF)" strokeWidth={2} />}
              <Area type="monotone" dataKey="Opportunités" stroke="#ea6a1e" fill="url(#gO)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Publicité Meta (performances Ads, lecture seule) ────────────────── */}
      {isManager && (
        <Card className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold text-fg">
              <Megaphone className="h-5 w-5 text-brand-600" /> Publicité Meta
            </h2>
            <div className="flex items-center gap-2">
              {meta?.account && <Badge tone="neutral">{meta.account}</Badge>}
              <Badge tone="brand">{GRAN_LABEL[gran].toLowerCase()}</Badge>
            </div>
          </div>

          {metaLoading ? (
            <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
          ) : !meta ? null : meta.configured === false ? (
            <p className="rounded-lg bg-surface-2 p-4 text-sm text-muted">
              {meta.message ?? 'Compte Meta non configuré.'} Renseignez le compte publicitaire et le token dans <strong>Paramètres › Publicité Meta (Ads)</strong>.
            </p>
          ) : meta.ok === false ? (
            <p className="rounded-lg bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
              {meta.error?.includes('Failed to fetch') || meta.error?.includes('Edge Function')
                ? "Edge Function « meta-ads » non déployée. Déployez-la puis rechargez."
                : `Erreur Meta : ${meta.error}`}
            </p>
          ) : meta.totals ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                <Kpi icon={<Euro className="h-5 w-5" />} label="Dépense" value={fmtCur(meta.totals.spend, metaCur)} />
                <Kpi icon={<ClipboardList className="h-5 w-5" />} label="Leads" value={fmtNum(meta.totals.leads)} />
                <Kpi icon={<Euro className="h-5 w-5" />} label="Coût par lead" value={metaCpl != null ? fmtCur(metaCpl, metaCur) : '—'} />
                <Kpi icon={<Eye className="h-5 w-5" />} label="Impressions" value={fmtNum(meta.totals.impressions)} hint={`${fmtNum(meta.totals.reach)} portée`} />
                <Kpi icon={<TrendingUp className="h-5 w-5" />} label="Clics" value={fmtNum(meta.totals.clicks)} hint={`CTR ${meta.totals.ctr.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`} />
              </div>
              {meta.campaigns && meta.campaigns.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted">Campagnes</p>
                  <ul className="space-y-1.5">
                    {meta.campaigns.slice(0, 6).map((c, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-fg">{c.name}</span>
                        <span className="flex items-center gap-4 text-muted">
                          <span>{c.leads} lead{c.leads > 1 ? 's' : ''}</span>
                          <span className="font-medium text-fg">{fmtCur(c.spend, metaCur)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted">Aucune donnée publicitaire sur la période.</p>
          )}
        </Card>
      )}

      {/* ── Classement des conseillers (CA des opportunités gagnées) ─────────── */}
      {isManager && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold text-fg">
              <Trophy className="h-5 w-5 text-amber-500" /> Classement des conseillers
            </h2>
            <Badge tone="brand">CA gagné · {GRAN_LABEL[gran].toLowerCase()} · {formatMoney(caTotal)}</Badge>
          </div>
          {classement.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Aucune opportunité gagnée sur la période sélectionnée.</p>
          ) : (
            <ul className="space-y-2">
              {classement.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 rounded-lg border border-line p-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    i === 0 ? 'bg-amber-400/20 text-amber-600 dark:text-amber-400'
                    : i === 1 ? 'bg-slate-400/20 text-slate-500'
                    : i === 2 ? 'bg-orange-700/20 text-orange-700 dark:text-orange-400'
                    : 'bg-surface-2 text-muted'
                  }`}>{i + 1}</span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-xs font-semibold text-brand-600">
                    {initials(c.name.split(' ').slice(-1)[0], c.name.split(' ')[0])}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-fg">{c.name}</p>
                      <p className="shrink-0 text-sm font-bold text-fg">{formatMoney(c.ca)}</p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${caMax ? (c.ca / caMax) * 100 : 0}%` }} />
                      </div>
                      <span className="shrink-0 text-xs text-muted">{c.n} gagnée{c.n > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
