import { useMemo, useState } from 'react';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, eachDayOfInterval, format, isWithinInterval, parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { ChevronLeft, ChevronRight, ClipboardList, CircleCheck as CheckCircle2, Circle, CalendarDays, Download } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { fullName, formatDate, cn } from '@/lib/utils';
import type { Profile, Contact, ContactAction } from '@/lib/database.types';

type Gran = 'jour' | 'semaine' | 'mois';
const GRAN_LABEL: Record<Gran, string> = { jour: 'Jour', semaine: 'Semaine', mois: 'Mois' };
const GRID = 'rgb(148 163 184 / 0.2)';

// Bornes [début, fin] + libellé de la période courante selon la granularité.
function periodOf(gran: Gran, anchor: Date): { start: Date; end: Date; label: string } {
  if (gran === 'jour') {
    const s = startOfDay(anchor);
    return { start: s, end: endOfDay(anchor), label: format(s, 'EEEE d MMMM yyyy', { locale: fr }) };
  }
  if (gran === 'semaine') {
    const s = startOfWeek(anchor, { weekStartsOn: 1 });
    const e = endOfWeek(anchor, { weekStartsOn: 1 });
    return { start: s, end: e, label: `Semaine du ${format(s, 'd MMM', { locale: fr })} au ${format(e, 'd MMM yyyy', { locale: fr })}` };
  }
  const s = startOfMonth(anchor);
  return { start: s, end: endOfMonth(anchor), label: format(s, 'MMMM yyyy', { locale: fr }) };
}
const shiftAnchor = (gran: Gran, anchor: Date, dir: number): Date =>
  gran === 'jour' ? addDays(anchor, dir) : gran === 'semaine' ? addWeeks(anchor, dir) : addMonths(anchor, dir);

const actionDate = (a: ContactAction): Date =>
  parseISO(a.heure_action ? `${a.date_action}T${a.heure_action}` : a.date_action);
const actionKey = (a: ContactAction): string => `${a.date_action}T${a.heure_action ?? '99:99'}`;

export default function ConseillerActivite() {
  const { profile, isManager } = useAuth();
  const profiles = useCollection<Profile>('profiles');
  const contacts = useCollection<Contact>('contacts');
  const actions = useCollection<ContactAction>('contact_actions');

  const [gran, setGran] = useState<Gran>('semaine');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [conseillerFilter, setConseillerFilter] = useState<string>('');

  const { start, end, label } = periodOf(gran, anchor);

  const contactById = useMemo(() => new Map(contacts.data.map((c) => [c.id, c])), [contacts.data]);
  const profileName = (id: string | null) => {
    const p = id ? profiles.data.find((x) => x.id === id) : null;
    return p ? fullName(p.prenom, p.nom) : 'Non attribué';
  };
  // Conseiller à qui rattacher l'action : auteur si connu, sinon responsable/propriétaire du contact.
  const conseillerOf = (a: ContactAction): string => {
    if (a.auteur_id) return a.auteur_id;
    const c = contactById.get(a.contact_id);
    return c?.responsable_id ?? c?.owner_id ?? '—';
  };
  const contactName = (id: string): string => {
    const c = contactById.get(id);
    return c ? fullName(c.prenom, c.nom) : '—';
  };

  const loading = profiles.loading || contacts.loading || actions.loading;

  // Actions de la période, visibles (manager = tout, conseiller = les siennes).
  const periodActions = useMemo(() => actions.data
    .filter((a) => isWithinInterval(actionDate(a), { start, end }))
    .filter((a) => isManager || conseillerOf(a) === profile?.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions.data, contactById, start.getTime(), end.getTime(), isManager, profile?.id]);

  // Listes pour les filtres (depuis la période complète, avant filtrage).
  const typesPresents = [...new Set(periodActions.map((a) => a.type))].sort();
  const conseillersPresents = [...new Set(periodActions.map(conseillerOf))]
    .map((id) => ({ id, name: profileName(id === '—' ? null : id) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Application des filtres.
  const filtered = periodActions
    .filter((a) => !typeFilter || a.type === typeFilter)
    .filter((a) => !conseillerFilter || conseillerOf(a) === conseillerFilter);

  // Regroupement par conseiller.
  const byConseiller = new Map<string, ContactAction[]>();
  for (const a of filtered) {
    const k = conseillerOf(a);
    const arr = byConseiller.get(k) ?? [];
    arr.push(a);
    byConseiller.set(k, arr);
  }
  const groups = [...byConseiller.entries()]
    .map(([id, list]) => ({
      id,
      name: profileName(id === '—' ? null : id),
      list: [...list].sort((x, y) => actionKey(y).localeCompare(actionKey(x))),
      faites: list.filter((a) => a.faite).length,
      aFaire: list.filter((a) => !a.faite).length,
    }))
    .sort((a, b) => b.list.length - a.list.length);

  const totals = {
    n: filtered.length,
    faites: filtered.filter((a) => a.faite).length,
    aFaire: filtered.filter((a) => !a.faite).length,
  };

  // Données du graphique : par jour (semaine/mois) ou par type (jour).
  const chartData = useMemo(() => {
    if (gran === 'jour') {
      const m = new Map<string, { faites: number; aFaire: number }>();
      for (const a of filtered) {
        const e = m.get(a.type) ?? { faites: 0, aFaire: 0 };
        if (a.faite) e.faites++; else e.aFaire++;
        m.set(a.type, e);
      }
      return [...m.entries()].map(([name, v]) => ({ name, ...v }));
    }
    return eachDayOfInterval({ start, end }).map((d) => {
      const ds = format(d, 'yyyy-MM-dd');
      const day = filtered.filter((a) => a.date_action === ds);
      return {
        name: format(d, gran === 'mois' ? 'd' : 'EEE d', { locale: fr }),
        faites: day.filter((a) => a.faite).length,
        aFaire: day.filter((a) => !a.faite).length,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, gran, start.getTime(), end.getTime()]);
  const hasChart = chartData.some((d) => d.faites + d.aFaire > 0);

  // Export CSV (séparateur ; pour Excel FR, BOM pour les accents).
  const exportCsv = () => {
    const header = ['Date', 'Heure', 'Conseiller', 'Type', 'Statut', 'Contact', 'Description'];
    const lines = filtered
      .slice()
      .sort((x, y) => actionKey(y).localeCompare(actionKey(x)))
      .map((a) => [
        a.date_action,
        a.heure_action ? a.heure_action.slice(0, 5) : '',
        profileName(conseillerOf(a) === '—' ? null : conseillerOf(a)),
        a.type,
        a.faite ? 'Réalisée' : 'À faire',
        contactName(a.contact_id),
        (a.description ?? '').replace(/[\r\n]+/g, ' '),
      ]);
    const csv = [header, ...lines]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob([String.fromCharCode(0xFEFF) + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activite_conseillers_${gran}_${format(start, 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-fg">
          <ClipboardList className="h-5 w-5 text-brand-500" /> Activité des conseillers
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <div className="inline-flex rounded-lg border border-line p-0.5 text-sm">
            {(Object.keys(GRAN_LABEL) as Gran[]).map((g) => (
              <button key={g} onClick={() => setGran(g)}
                className={cn('rounded-md px-3 py-1 font-medium transition', gran === g ? 'bg-brand-500 text-white shadow-sm' : 'text-muted hover:text-fg')}>
                {GRAN_LABEL[g]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation de période */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setAnchor((a) => shiftAnchor(gran, a, -1))} className="rounded-lg border border-line p-1.5 text-muted hover:bg-surface-2 hover:text-fg" title="Période précédente"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setAnchor((a) => shiftAnchor(gran, a, 1))} className="rounded-lg border border-line p-1.5 text-muted hover:bg-surface-2 hover:text-fg" title="Période suivante"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => setAnchor(new Date())} className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"><CalendarDays className="h-3.5 w-3.5" /> Aujourd'hui</button>
        </div>
        <span className="text-sm font-medium capitalize text-fg">{label}</span>
      </div>

      {/* Filtres : type + conseiller (direction) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input max-w-[170px] py-1 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tous les types</option>
          {typesPresents.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {isManager && (
          <select className="input max-w-[200px] py-1 text-sm" value={conseillerFilter} onChange={(e) => setConseillerFilter(e.target.value)}>
            <option value="">Tous les conseillers</option>
            {conseillersPresents.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {(typeFilter || conseillerFilter) && (
          <button onClick={() => { setTypeFilter(''); setConseillerFilter(''); }} className="text-xs font-medium text-muted underline-offset-2 hover:underline">Réinitialiser</button>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1.5 text-sm">
          <Badge tone="neutral">{totals.n} action{totals.n > 1 ? 's' : ''}</Badge>
          <Badge tone="success">{totals.faites} réalisée{totals.faites > 1 ? 's' : ''}</Badge>
          <Badge tone="warning">{totals.aFaire} à faire</Badge>
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
      ) : (
        <>
          {/* Graphique d'activité */}
          {hasChart && (
            <div className="mb-5">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="name" fontSize={11} interval={gran === 'mois' ? 1 : 0} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="faites" name="Réalisées" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="aFaire" name="À faire" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Actions organisées par conseiller */}
          {groups.length === 0 ? (
            <EmptyState title="Aucune action sur cette période" message="Changez de période, de granularité ou de filtre." />
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.id} className="rounded-xl border border-line">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/50 px-3 py-2">
                    <span className="font-medium text-fg">{g.name}</span>
                    <span className="flex items-center gap-1.5 text-xs">
                      <Badge tone="neutral">{g.list.length}</Badge>
                      <Badge tone="success">{g.faites} ✓</Badge>
                      <Badge tone="warning">{g.aFaire} à faire</Badge>
                    </span>
                  </div>
                  <ul className="divide-y divide-line">
                    {g.list.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        {a.faite
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          : <Circle className="h-4 w-4 shrink-0 text-amber-500" />}
                        <span className="w-[110px] shrink-0 text-xs text-muted">
                          {formatDate(a.date_action, 'dd/MM/yyyy')}{a.heure_action ? ` ${a.heure_action.slice(0, 5)}` : ''}
                        </span>
                        <Badge className="shrink-0 bg-surface-2 text-muted">{a.type}</Badge>
                        <span className="min-w-0 flex-1 truncate text-fg">{a.description}</span>
                        <span className="hidden shrink-0 text-xs text-muted sm:inline">{contactName(a.contact_id)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
