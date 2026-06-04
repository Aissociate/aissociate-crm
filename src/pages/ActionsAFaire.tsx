import { useMemo } from 'react';
import { ListTodo, AlertTriangle, UserX, CircleCheck as Check, Clock } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Spinner, Badge, StatCard, EmptyState } from '@/components/ui';
import { fullName, formatDate } from '@/lib/utils';
import type { ContactAction, Contact, Profile } from '@/lib/database.types';

const TODAY = new Date().toISOString().slice(0, 10);

export default function ActionsAFaire() {
  const actions = useCollection<ContactAction>('contact_actions', { orderBy: { column: 'date_action' } });
  const contacts = useCollection<Contact>('contacts');
  const profiles = useCollection<Profile>('profiles', { orderBy: { column: 'nom' } });

  const loading = actions.loading || contacts.loading || profiles.loading;

  const contactById = useMemo(() => Object.fromEntries(contacts.data.map((c) => [c.id, c])), [contacts.data]);

  // Conseiller responsable d'une action = responsable_id du contact, sinon owner_id
  const groups = useMemo(() => {
    const todo = actions.data.filter((a) => !a.faite);
    const map = new Map<string, ContactAction[]>();
    for (const a of todo) {
      const c = contactById[a.contact_id];
      const who = c?.responsable_id ?? c?.owner_id ?? '__none__';
      if (!map.has(who)) map.set(who, []);
      map.get(who)!.push(a);
    }
    return map;
  }, [actions.data, contactById]);

  const todoCount = actions.data.filter((a) => !a.faite).length;
  const lateCount = actions.data.filter((a) => !a.faite && a.date_action < TODAY).length;
  const noneCount = (groups.get('__none__') ?? []).length;

  const markDone = async (a: ContactAction) => {
    await supabase.from('contact_actions').update({ faite: true }).eq('id', a.id);
    actions.refresh();
  };

  const profName = (id: string) => {
    if (id === '__none__') return 'Non attribué';
    const p = profiles.data.find((x) => x.id === id);
    return p ? fullName(p.prenom, p.nom) : 'Inconnu';
  };

  // Ordre : conseillers d'abord (par nb d'actions desc), "non attribué" en dernier
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    if (a === '__none__') return 1;
    if (b === '__none__') return -1;
    return (groups.get(b)?.length ?? 0) - (groups.get(a)?.length ?? 0);
  });

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <PageHeader title="Actions à faire" subtitle="Suivi des actions en attente, agrégé par conseiller" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Actions à faire" value={todoCount} icon={<ListTodo className="h-6 w-6" />} />
        <StatCard label="En retard" value={lateCount} icon={<AlertTriangle className="h-6 w-6" />} hint="échéance dépassée" />
        <StatCard label="Non attribuées" value={noneCount} icon={<UserX className="h-6 w-6" />} />
      </div>

      {todoCount === 0 ? (
        <EmptyState title="Aucune action en attente" message="Tout est traité 👌" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {orderedKeys.map((key) => {
            const list = (groups.get(key) ?? []).slice().sort((a, b) => a.date_action.localeCompare(b.date_action));
            const late = list.filter((a) => a.date_action < TODAY).length;
            return (
              <Card key={key}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-fg">{profName(key)}</h2>
                  <div className="flex items-center gap-2 text-xs">
                    {late > 0 && <Badge tone="danger">{late} en retard</Badge>}
                    <Badge tone="neutral">{list.length}</Badge>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {list.map((a) => {
                    const c = contactById[a.contact_id];
                    const overdue = a.date_action < TODAY;
                    return (
                      <li key={a.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                        <button onClick={() => markDone(a)} title="Marquer comme faite"
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-transparent hover:border-emerald-500 hover:bg-emerald-500 hover:text-white">
                          <Check className="h-3 w-3" />
                        </button>
                        <Badge tone="neutral">{a.type}</Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-fg">{a.description}</p>
                          <p className="text-xs text-muted">{c ? fullName(c.prenom, c.nom) : '—'}</p>
                        </div>
                        <span className={`flex items-center gap-1 whitespace-nowrap text-xs ${overdue ? 'text-red-600 dark:text-red-400' : 'text-muted'}`}>
                          <Clock className="h-3 w-3" />{formatDate(a.date_action, 'dd/MM/yyyy')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
