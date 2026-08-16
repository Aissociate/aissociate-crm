import { useMemo, useState } from 'react';
import { ListTodo, AlertTriangle, UserX, CircleCheck as Check, Clock, ArrowUpDown, Zap } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Spinner, Badge, StatCard, EmptyState, Table, type Tone } from '@/components/ui';
import { fullName, formatDate } from '@/lib/utils';
import { anomaliesHoraires } from '@/lib/joursFeries';
import { CONTACT_TYPE_LABELS, OPP_STAGE_LABELS } from '@/lib/constants';
import ContactFiche from '@/components/ContactFiche';
import type { ContactAction, Contact, Profile, Opportunite, Entreprise, Financeur } from '@/lib/database.types';

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Statut d'une action — ticket Benjamin « tableau de visualisation des actions à
 * faire ». Les quatre états forment une partition : une action est soit faite,
 * soit en retard (échéance passée), soit à traiter aujourd'hui (ASAP), soit
 * planifiée dans le futur.
 */
type Statut = 'realisee' | 'asap' | 'en_retard' | 'planifiee';
const STATUT_LABELS: Record<Statut, string> = {
  realisee: 'Réalisée', asap: 'ASAP', en_retard: 'En retard', planifiee: 'Planifiée',
};
const STATUT_TONES: Record<Statut, Tone> = {
  realisee: 'success', asap: 'warning', en_retard: 'danger', planifiee: 'neutral',
};
const STATUT_ORDER: Statut[] = ['en_retard', 'asap', 'planifiee', 'realisee'];

function statutOf(a: ContactAction): Statut {
  if (a.faite) return 'realisee';
  if (a.date_action < TODAY) return 'en_retard';
  if (a.date_action === TODAY) return 'asap';
  return 'planifiee';
}

type Tri = 'chrono' | 'chrono_desc' | 'contact' | 'conseiller' | 'tache';

// Jour de la semaine abrégé (midi : insensible au fuseau).
const JOURS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const jourCourt = (d: string) => (d ? JOURS_COURTS[new Date(`${d}T12:00:00`).getDay()] ?? '' : '');

// ── Filtre par période ────────────────────────────────────────────────────────
type Periode = '' | 'aujourdhui' | 'matin' | 'apresmidi' | 'demain' | 'semaine' | 'mois';
const PERIODE_LABELS: Record<Exclude<Periode, ''>, string> = {
  aujourdhui: "Aujourd'hui", matin: 'Ce matin', apresmidi: 'Cet après-midi',
  demain: 'Demain', semaine: 'Cette semaine', mois: 'Ce mois-ci',
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** L'action tombe-t-elle dans la période demandée ? */
function dansPeriode(a: ContactAction, p: Periode): boolean {
  if (!p) return true;
  const now = new Date();
  const today = ymd(now);
  const heure = Number((a.heure_action ?? '').slice(0, 2));
  switch (p) {
    case 'aujourdhui': return a.date_action === today;
    // Sans heure renseignée, l'action est rattachée à la matinée.
    case 'matin': return a.date_action === today && (!a.heure_action || heure < 12);
    case 'apresmidi': return a.date_action === today && !!a.heure_action && heure >= 12;
    case 'demain': {
      const d = new Date(now); d.setDate(d.getDate() + 1);
      return a.date_action === ymd(d);
    }
    case 'semaine': {
      // Semaine calendaire en cours, du lundi au dimanche.
      const lundi = new Date(now);
      lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
      const dimanche = new Date(lundi); dimanche.setDate(dimanche.getDate() + 6);
      return a.date_action >= ymd(lundi) && a.date_action <= ymd(dimanche);
    }
    case 'mois': return a.date_action.slice(0, 7) === today.slice(0, 7);
  }
}

export default function ActionsAFaire() {
  const actions = useCollection<ContactAction>('contact_actions', { orderBy: { column: 'date_action' } });
  const contacts = useCollection<Contact>('contacts');
  const profiles = useCollection<Profile>('profiles', { orderBy: { column: 'nom' } });
  const opportunites = useCollection<Opportunite>('opportunites');
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');

  const loading = actions.loading || contacts.loading || profiles.loading;

  const [tri, setTri] = useState<Tri>('chrono');
  const [conseillerFilter, setConseillerFilter] = useState('');   // '' | 'none' | <profile id>
  const [typeFilter, setTypeFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('');           // '' = tout sauf réalisées
  const [periode, setPeriode] = useState<Periode>('');
  const [fiche, setFiche] = useState<Contact | null>(null);

  const contactById = useMemo(() => Object.fromEntries(contacts.data.map((c) => [c.id, c])), [contacts.data]);

  // Conseiller responsable d'une action = responsable_id du contact, sinon owner_id.
  const conseillerOf = (a: ContactAction): string => {
    const c = contactById[a.contact_id];
    return c?.responsable_id ?? c?.owner_id ?? '__none__';
  };
  const profName = (id: string) => {
    if (id === '__none__') return 'Non attribué';
    const p = profiles.data.find((x) => x.id === id);
    return p ? fullName(p.prenom, p.nom) : 'Inconnu';
  };
  const contactName = (a: ContactAction) => {
    const c = contactById[a.contact_id];
    return c ? fullName(c.prenom, c.nom) : '—';
  };

  const types = useMemo(
    () => [...new Set(actions.data.map((a) => a.type).filter(Boolean))].sort(),
    [actions.data],
  );

  // Anomalies d'horodatage, mémoïsées par action (le rendu les lit plusieurs fois).
  const anomaliesCache = new Map<string, ReturnType<typeof anomaliesHoraires>>();
  const anomalies = (a: ContactAction) => {
    let v = anomaliesCache.get(a.id);
    if (!v) { v = anomaliesHoraires(a.date_action, a.heure_action); anomaliesCache.set(a.id, v); }
    return v;
  };

  // Mentions complémentaires sous le nom du contact : statut du contact quand ce
  // n'est pas un prospect, et état de ses opportunités.
  const mentions = (a: ContactAction): { texte: string; rouge: boolean }[] => {
    const c = contactById[a.contact_id];
    if (!c) return [];
    const out: { texte: string; rouge: boolean }[] = [];
    if (c.type !== 'prospect') out.push({ texte: CONTACT_TYPE_LABELS[c.type] ?? c.type, rouge: true });
    const opps = opportunites.data.filter((o) => o.contact_id === c.id);
    if (opps.length === 0) out.push({ texte: 'opportunité manquante', rouge: true });
    else if (opps.length === 1) out.push({ texte: OPP_STAGE_LABELS[opps[0].stage] ?? opps[0].stage, rouge: false });
    else out.push({ texte: 'plusieurs opportunités', rouge: false });
    return out;
  };

  const rows = useMemo(() => {
    const list = actions.data.filter((a) => {
      const st = statutOf(a);
      // Sans filtre explicite, la page reste centrée sur ce qu'il reste à faire.
      if (!statutFilter && st === 'realisee') return false;
      if (statutFilter && st !== statutFilter) return false;
      if (typeFilter && a.type !== typeFilter) return false;
      if (!dansPeriode(a, periode)) return false;
      if (conseillerFilter) {
        const who = conseillerOf(a);
        if (conseillerFilter === 'none' ? who !== '__none__' : who !== conseillerFilter) return false;
      }
      return true;
    });
    const byDate = (x: ContactAction, y: ContactAction) =>
      `${x.date_action}T${x.heure_action ?? '00:00'}`.localeCompare(`${y.date_action}T${y.heure_action ?? '00:00'}`);
    return [...list].sort((a, b) => {
      if (tri === 'chrono') return byDate(a, b);
      if (tri === 'chrono_desc') return byDate(b, a);
      if (tri === 'contact') {
        const cmp = contactName(a).localeCompare(contactName(b), 'fr');
        return cmp !== 0 ? cmp : byDate(a, b);
      }
      if (tri === 'tache') {
        const cmp = (a.type ?? '').localeCompare(b.type ?? '', 'fr');
        return cmp !== 0 ? cmp : byDate(a, b);
      }
      const cmp = profName(conseillerOf(a)).localeCompare(profName(conseillerOf(b)), 'fr');
      return cmp !== 0 ? cmp : byDate(a, b);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions.data, contactById, profiles.data, tri, conseillerFilter, typeFilter, statutFilter, periode]);

  const todoCount = actions.data.filter((a) => !a.faite).length;
  const lateCount = actions.data.filter((a) => statutOf(a) === 'en_retard').length;
  const asapCount = actions.data.filter((a) => statutOf(a) === 'asap').length;
  const noneCount = actions.data.filter((a) => !a.faite && conseillerOf(a) === '__none__').length;

  // Même détrompeur que dans la fiche contact : une action réalisée le reste, et
  // une action datée dans le futur ne peut pas être cochée.
  const toggleDone = async (a: ContactAction) => {
    if (a.faite) { alert("Une action déjà réalisée ne peut plus être décochée."); return; }
    if (a.date_action > TODAY) { alert("Cette action est datée dans le futur : elle ne peut pas être notée comme réalisée."); return; }
    await supabase.from('contact_actions').update({ faite: true }).eq('id', a.id);
    actions.refresh();
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <PageHeader title="Actions à faire" subtitle="Tableau de suivi — tri chronologique ou par contact, filtres par conseiller, type et statut" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Actions à faire" value={todoCount} icon={<ListTodo className="h-6 w-6" />} />
        <StatCard label="En retard" value={lateCount} icon={<AlertTriangle className="h-6 w-6" />} hint="échéance dépassée" />
        <StatCard label="ASAP" value={asapCount} icon={<Zap className="h-6 w-6" />} hint="à traiter aujourd'hui" />
        <StatCard label="Non attribuées" value={noneCount} icon={<UserX className="h-6 w-6" />} />
      </div>

      {/* ── Tri & filtres ──────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-fg"><ArrowUpDown className="h-4 w-4 text-brand-500" /> Tri</span>
          <select className="input max-w-[220px] py-2 text-sm" value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
            <option value="chrono">Chronologique (plus proche d'abord)</option>
            <option value="chrono_desc">Chronologique inversé</option>
            <option value="contact">Par contact (A→Z)</option>
            <option value="conseiller">Par conseiller (A→Z)</option>
            <option value="tache">Par tâche (appel, e-mail, rdv…)</option>
          </select>

          <span className="ml-2 text-sm font-medium text-fg">Filtres</span>
          <select className="input max-w-[200px] py-2 text-sm" value={conseillerFilter} onChange={(e) => setConseillerFilter(e.target.value)}>
            <option value="">Tous les conseillers</option>
            <option value="none">Non attribuées</option>
            {profiles.data.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
          </select>
          <select className="input max-w-[170px] py-2 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Tous les types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input max-w-[190px] py-2 text-sm" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
            <option value="">À faire (tous statuts)</option>
            {STATUT_ORDER.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
          </select>
          <select className="input max-w-[180px] py-2 text-sm" value={periode} onChange={(e) => setPeriode(e.target.value as Periode)} title="Restreindre à une période">
            <option value="">Toutes les périodes</option>
            {(Object.keys(PERIODE_LABELS) as Exclude<Periode, ''>[]).map((p) => <option key={p} value={p}>{PERIODE_LABELS[p]}</option>)}
          </select>

          <span className="ml-auto text-sm text-muted">{rows.length} action(s)</span>
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="Aucune action" message="Aucune action ne correspond aux filtres sélectionnés." />
      ) : (
        <Table head={
          <tr>
            <th className="px-4 py-3 w-10"></th>
            <th className="px-4 py-3">Échéance</th>
            <th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Contact</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Conseiller</th>
          </tr>
        }>
          {rows.map((a) => {
            const st = statutOf(a);
            return (
              <tr key={a.id} className="hover:bg-surface-2">
                <td className="px-4 py-3">
                  <button onClick={() => toggleDone(a)} title={a.faite ? 'Réalisée (non modifiable)' : 'Marquer comme faite'}
                    className={`flex h-5 w-5 items-center justify-center rounded-full border border-line ${a.faite ? 'border-emerald-500 bg-emerald-500 text-white' : 'text-transparent hover:border-emerald-500 hover:bg-emerald-500 hover:text-white'}`}>
                    <Check className="h-3 w-3" />
                  </button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  {/* Horodatage suspect (week-end, férié, hors 9 h-18 h, très lointain)
                      signalé en rouge, avec le motif en micro-pastille. */}
                  <span className={`flex items-center gap-1 ${st === 'en_retard' || anomalies(a).length ? 'text-red-600 dark:text-red-400' : ''}`}>
                    <Clock className="h-3 w-3" />
                    {jourCourt(a.date_action)} {formatDate(a.date_action, 'dd/MM/yyyy')}{a.heure_action ? ` ${a.heure_action.slice(0, 5)}` : ''}
                  </span>
                  {anomalies(a).length > 0 && (
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {anomalies(a).map((an) => (
                        <span key={an.code} title={an.detail} className="rounded-full bg-red-500/10 px-1.5 text-[10px] font-medium text-red-600 dark:text-red-400">{an.code}</span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3"><Badge tone={STATUT_TONES[st]}>{STATUT_LABELS[st]}</Badge></td>
                <td className="px-4 py-3"><Badge tone="neutral">{a.type}</Badge></td>
                <td className="px-4 py-3">
                  {/* Le nom ouvre la fiche du contact, positionnée sur son suivi d'actions. */}
                  <button
                    onClick={() => { const c = contactById[a.contact_id]; if (c) setFiche(c); }}
                    disabled={!contactById[a.contact_id]}
                    className="text-left font-medium text-brand-600 hover:underline disabled:cursor-default disabled:text-fg disabled:no-underline dark:text-brand-400"
                    title="Ouvrir la fiche du contact"
                  >{contactName(a)}</button>
                  {mentions(a).map((m) => (
                    <span key={m.texte} className={`mt-0.5 block text-xs ${m.rouge ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted'}`}>{m.texte}</span>
                  ))}
                </td>
                <td className="px-4 py-3 text-muted">{a.description}</td>
                <td className="px-4 py-3 text-muted">{profName(conseillerOf(a))}</td>
              </tr>
            );
          })}
        </Table>
      )}

      {fiche && (
        <ContactFiche
          key={fiche.id}
          contact={contacts.data.find((x) => x.id === fiche.id) ?? fiche}
          entreprises={entreprises.data}
          financeurs={financeurs.data}
          profiles={profiles.data}
          onClose={() => setFiche(null)}
          onEdit={() => setFiche(null)}
          onUpdated={() => { contacts.refresh(); actions.refresh(); }}
        />
      )}
    </div>
  );
}
