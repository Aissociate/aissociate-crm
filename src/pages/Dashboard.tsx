import { useState, useEffect, type ReactNode } from 'react';
import {
  startOfDay, startOfWeek, startOfMonth,
  subDays, subWeeks, subMonths, differenceInHours, format,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Eye, ClipboardList, TrendingUp, Clock, Euro, Landmark, Trophy, Megaphone,
  ArrowUpRight, ArrowDownRight, Minus, Mail,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Spinner, Badge } from '@/components/ui';
import { DOSSIER_STATUT_LABELS } from '@/lib/constants';
import { formatMoney, initials } from '@/lib/utils';
import type { Dossier, Opportunite, Profile, PageView, ContactRequest, Email } from '@/lib/database.types';

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
function Kpi({ icon, label, value, hint, delta }: {
  icon: ReactNode; label: string; value: ReactNode; hint?: string; delta?: ReactNode;
}) {
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className="rounded-lg bg-brand-500/10 p-2 text-brand-500">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-fg">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {delta && <div className="border-t border-line pt-2">{delta}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { profile, isManager } = useAuth();
  const [gran, setGran] = useState<Gran>('semaine');

  const opps = useCollection<Opportunite>('opportunites');
  const dossiers = useCollection<Dossier>('dossiers');
  const views = useCollection<PageView>('page_views');
  const leads = useCollection<ContactRequest>('contact_requests');
  const profiles = useCollection<Profile>('profiles');
  const emails = useCollection<Email>('emails');

  // Mails entrants non lus par intervenant (owner du mail). Voir RLS : un
  // conseiller ne voit que les siens, la direction voit tout.
  const unreadByOwner = new Map<string, number>();
  for (const e of emails.data) {
    if (e.canal === 'whatsapp' || e.direction !== 'entrant' || e.lu) continue;
    const k = e.owner_id ?? '—';
    unreadByOwner.set(k, (unreadByOwner.get(k) ?? 0) + 1);
  }
  const myUnread = profile ? (unreadByOwner.get(profile.id) ?? 0) : 0;
  const unreadList = [...unreadByOwner.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

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
  const uniq = (rows: PageView[], a: Date, b: Date) =>
    new Set(rows.filter((v) => inRange(v.created_at, a, b)).map((v) => v.visitor_id ?? v.id)).size;
  const visiteursCur = uniq(views.data, start, now);
  const visiteursPrev = uniq(views.data, prevStart, prevEnd);
  const vuesCur = views.data.filter((v) => inRange(v.created_at, start, now)).length;

  // ── KPI : formulaires web ──
  const formCur = leads.data.filter((l) => inRange(l.created_at, start, now)).length;
  const formPrev = leads.data.filter((l) => inRange(l.created_at, prevStart, prevEnd)).length;

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

  // ── KPI : dossiers chez le financeur (à l'étude / en instruction) — instantané ──
  const depose = dossiers.data.filter((d) => d.statut === 'depose').length;
  const enInstruction = dossiers.data.filter((d) => d.statut === 'en_instruction').length;
  const chezFinanceur = depose + enInstruction;

  // ── Courbe de tendance ──
  const starts = bucketStarts(gran, now, gran === 'jour' ? 14 : 12);
  const trend = starts.map((bStart, i) => {
    const bEnd = i + 1 < starts.length ? starts[i + 1] : new Date(now.getTime() + 1);
    return {
      label: bucketLabel(gran, bStart),
      Visiteurs: uniq(views.data, bStart, bEnd),
      Formulaires: leads.data.filter((l) => inRange(l.created_at, bStart, bEnd)).length,
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

      {/* ── KPI ─────────────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isManager && (
          <Kpi
            icon={<Eye className="h-5 w-5" />} label="Visiteurs site web" value={visiteursCur}
            hint={`${vuesCur} pages vues`}
            delta={<Delta cur={visiteursCur} prev={visiteursPrev} label={cmp} />}
          />
        )}
        {isManager && (
          <Kpi
            icon={<ClipboardList className="h-5 w-5" />} label="Formulaires web" value={formCur}
            delta={<Delta cur={formCur} prev={formPrev} label={cmp} />}
          />
        )}
        <Kpi
          icon={<TrendingUp className="h-5 w-5" />} label="Opportunités créées" value={oppsCreesCur.length}
          delta={<Delta cur={oppsCreesCur.length} prev={oppsCreesPrev.length} label={cmp} />}
        />
        <Kpi
          icon={<Clock className="h-5 w-5" />} label="Temps de traitement moyen"
          value={fmtDays(traitementCur)} hint="ouverture → gagné/perdu"
          delta={<Delta cur={traitementCur} prev={traitementPrev} invert label={cmp} />}
        />
        <Kpi
          icon={<Euro className="h-5 w-5" />} label="Valeur moyenne / opportunité"
          value={formatMoney(valMoyCur)}
          delta={<Delta cur={valMoyCur} prev={valMoyPrev} label={cmp} />}
        />
        <Kpi
          icon={<Landmark className="h-5 w-5" />} label="Dossiers chez le financeur"
          value={chezFinanceur}
          hint={`${depose} déposés · ${enInstruction} en instruction`}
        />
      </div>

      {/* ── Tendance + répartition ──────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
              {isManager && <Area type="monotone" dataKey="Formulaires" stroke="#10b981" fill="url(#gF)" strokeWidth={2} />}
              <Area type="monotone" dataKey="Opportunités" stroke="#ea6a1e" fill="url(#gO)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Landmark className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-fg">Chez le financeur</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <span className="text-sm text-muted">{DOSSIER_STATUT_LABELS.depose}</span>
              <span className="text-xl font-bold text-fg">{depose}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-sm text-muted">{DOSSIER_STATUT_LABELS.en_instruction}</span>
              <span className="text-xl font-bold text-fg">{enInstruction}</span>
            </div>
            <div className="border-t border-line pt-3">
              <div className="flex items-end justify-between">
                <span className="text-sm font-medium text-fg">Total à l'étude</span>
                <span className="text-2xl font-bold text-brand-600">{chezFinanceur}</span>
              </div>
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-surface-2 p-3 text-xs text-muted">
            Dossiers déposés et en cours d'instruction chez les financeurs (OPCO, CPF, France Travail…).
          </p>
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

      {/* ── Mails entrants non lus par intervenant ───────────────────────────── */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-fg"><Mail className="h-5 w-5 text-brand-500" /> Mails entrants non lus</h2>
          <Badge tone={(isManager ? unreadList.reduce((s, [, n]) => s + n, 0) : myUnread) > 0 ? 'warning' : 'neutral'}>
            {isManager ? unreadList.reduce((s, [, n]) => s + n, 0) : myUnread} au total
          </Badge>
        </div>
        {isManager ? (
          unreadList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Aucun mail entrant non lu.</p>
          ) : (
            <ul className="divide-y divide-line">
              {unreadList.map(([id, n]) => (
                <li key={id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-fg">{pName(id)}</span>
                  <Badge tone="warning">{n} non lu{n > 1 ? 's' : ''}</Badge>
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="text-sm text-fg">Vous avez <strong>{myUnread}</strong> mail{myUnread > 1 ? 's' : ''} entrant{myUnread > 1 ? 's' : ''} non lu{myUnread > 1 ? 's' : ''}.</p>
        )}
      </Card>

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
