import { useMemo, useState } from 'react';
import { ListTodo, AlertTriangle, UserX, CircleCheck as Check, Clock, ArrowUpDown, Zap } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Spinner, Badge, StatCard, EmptyState, Table, type Tone } from '@/components/ui';
import { fullName, formatDate } from '@/lib/utils';
import type { ContactAction, Contact, Profile } from '@/lib/database.types';

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

type Tri = 'chrono' | 'chrono_desc' | 'contact' | 'conseiller';

export default function ActionsAFaire() {
  const actions = useCollection<ContactAction>('contact_actions', { orderBy: { column: 'date_action' } });
  const contacts = useCollection<Contact>('contacts');
  const profiles = useCollection<Profile>('profiles', { orderBy: { column: 'nom' } });

  const loading = actions.loading || contacts.loading || profiles.loading;

  const [tri, setTri] = useState<Tri>('chrono');
  const [conseillerFilter, setConseillerFilter] = useState('');   // '' | 'none' | <profile id>
  const [typeFilter, setTypeFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('');           // '' = tout sauf réalisées

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

  const rows = useMemo(() => {
    const list = actions.data.filter((a) => {
      const st = statutOf(a);
      // Sans filtre explicite, la page reste centrée sur ce qu'il reste à faire.
      if (!statutFilter && st === 'realisee') return false;
      if (statutFilter && st !== statutFilter) return false;
      if (typeFilter && a.type !== typeFilter) return false;
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
      const cmp = profName(conseillerOf(a)).localeCompare(profName(conseillerOf(b)), 'fr');
      return cmp !== 0 ? cmp : byDate(a, b);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions.data, contactById, profiles.data, tri, conseillerFilter, typeFilter, statutFilter]);

  const todoCount = actions.data.filter((a) => !a.faite).length;
  const lateCount = actions.data.filter((a) => statutOf(a) === 'en_retard').length;
  const asapCount = actions.data.filter((a) => statutOf(a) === 'asap').length;
  const noneCount = actions.data.filter((a) => !a.faite && conseillerOf(a) === '__none__').length;

  const toggleDone = async (a: ContactAction) => {
    await supabase.from('contact_actions').update({ faite: !a.faite }).eq('id', a.id);
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
                  <button onClick={() => toggleDone(a)} title={a.faite ? 'Marquer comme à faire' : 'Marquer comme faite'}
                    className={`flex h-5 w-5 items-center justify-center rounded-full border border-line ${a.faite ? 'border-emerald-500 bg-emerald-500 text-white' : 'text-transparent hover:border-emerald-500 hover:bg-emerald-500 hover:text-white'}`}>
                    <Check className="h-3 w-3" />
                  </button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted">
                  <span className={`flex items-center gap-1 ${st === 'en_retard' ? 'text-red-600 dark:text-red-400' : ''}`}>
                    <Clock className="h-3 w-3" />
                    {formatDate(a.date_action, 'dd/MM/yyyy')}{a.heure_action ? ` ${a.heure_action.slice(0, 5)}` : ''}
                  </span>
                </td>
                <td className="px-4 py-3"><Badge tone={STATUT_TONES[st]}>{STATUT_LABELS[st]}</Badge></td>
                <td className="px-4 py-3"><Badge tone="neutral">{a.type}</Badge></td>
                <td className="px-4 py-3 text-fg">{contactName(a)}</td>
                <td className="px-4 py-3 text-muted">{a.description}</td>
                <td className="px-4 py-3 text-muted">{profName(conseillerOf(a))}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
