import { useState, useMemo } from 'react';
import { Bug, Lightbulb, Plus, ThumbsUp, ChevronRight, TriangleAlert as AlertTriangle, Clock, CircleCheck as CheckCircle2, Circle as XCircle, Loader as Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, Button, Modal, Field, Badge, EmptyState, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Ticket, TicketStatut, TicketPriorite, TicketType } from '@/lib/database.types';

// ─── Types enrichis ────────────────────────────────────────────────────────────

type TicketWithMeta = Ticket & {
  author_nom?: string | null;
  author_prenom?: string | null;
  votes_count: number;
  user_voted: boolean;
};

// ─── Constantes ────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<TicketStatut, { label: string; className: string; icon: typeof Clock }> = {
  ouvert:   { label: 'Ouvert',    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',   icon: Clock },
  en_cours: { label: 'En cours',  className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Loader2 },
  resolu:   { label: 'Résolu',    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  refuse:   { label: 'Refusé',    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',       icon: XCircle },
};

const PRIORITE_CONFIG: Record<TicketPriorite, { label: string; className: string }> = {
  faible:   { label: 'Faible',   className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  normale:  { label: 'Normale',  className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  haute:    { label: 'Haute',    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critique: { label: 'Critique', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

// ─── Schémas Zod ───────────────────────────────────────────────────────────────

const createSchema = z.object({
  titre: z.string().min(5, 'Minimum 5 caractères').max(120),
  description: z.string().min(10, "Décrivez le problème ou l'idée (min 10 car.)"),
  priorite: z.enum(['faible', 'normale', 'haute', 'critique']).optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const adminSchema = z.object({
  statut: z.enum(['ouvert', 'en_cours', 'resolu', 'refuse']),
  admin_note: z.string().optional(),
});
type AdminForm = z.infer<typeof adminSchema>;

// ─── Composants internes ───────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: TicketStatut }) {
  const cfg = STATUT_CONFIG[statut];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function PrioriteBadge({ priorite }: { priorite: TicketPriorite | null }) {
  if (!priorite) return null;
  const cfg = PRIORITE_CONFIG[priorite];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
}

function FilterPill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium transition',
        active
          ? 'bg-brand-500 text-white'
          : 'bg-surface-2 text-muted hover:bg-surface-2/80 hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

// ─── Modal de création ─────────────────────────────────────────────────────────

function CreateModal({
  open, onClose, type, onCreated,
}: {
  open: boolean; onClose: () => void;
  type: TicketType; onCreated: () => void;
}) {
  const { session } = useAuth();
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { priorite: 'normale' },
  });

  const onSubmit = async (values: CreateForm) => {
    if (!session) return;
    const { error } = await supabase.from('tickets').insert({
      type,
      titre: values.titre,
      description: values.description,
      priorite: type === 'bug' ? (values.priorite ?? 'normale') : null,
      created_by: session.user.id,
    });
    if (!error) { reset(); onCreated(); onClose(); }
  };

  const title = type === 'bug' ? 'Signaler un bug' : 'Proposer une amélioration';

  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Envoi…' : 'Envoyer'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Titre" required>
          <input className="input" placeholder={type === 'bug' ? 'Ex : Le bouton X ne fonctionne pas' : 'Ex : Ajouter un export PDF'} {...register('titre')} />
          {errors.titre && <p className="mt-1 text-xs text-red-500">{errors.titre.message}</p>}
        </Field>
        <Field label="Description" required hint={type === 'bug' ? "Décrivez les étapes pour reproduire le bug, le comportement attendu et observé." : "Expliquez votre idée et la valeur qu'elle apporterait."}>
          <textarea className="input min-h-[120px] resize-y" {...register('description')} />
          {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>}
        </Field>
        {type === 'bug' && (
          <Field label="Priorité">
            <select className="input" {...register('priorite')}>
              <option value="faible">Faible</option>
              <option value="normale">Normale</option>
              <option value="haute">Haute</option>
              <option value="critique">Critique</option>
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

// ─── Modal de détail / admin ───────────────────────────────────────────────────

function DetailModal({
  ticket, onClose, onUpdated,
}: {
  ticket: TicketWithMeta; onClose: () => void; onUpdated: () => void;
}) {
  const { isAdmin, session } = useAuth();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<AdminForm>({
    defaultValues: { statut: ticket.statut, admin_note: ticket.admin_note ?? '' },
  });

  const onSaveAdmin = async (values: AdminForm) => {
    await supabase.from('tickets').update({
      statut: values.statut,
      admin_note: values.admin_note || null,
    }).eq('id', ticket.id);
    onUpdated();
    onClose();
  };

  const handleVote = async () => {
    if (!session) return;
    if (ticket.user_voted) {
      await supabase.from('ticket_votes').delete()
        .eq('ticket_id', ticket.id).eq('user_id', session.user.id);
    } else {
      await supabase.from('ticket_votes').insert({ ticket_id: ticket.id, user_id: session.user.id });
    }
    onUpdated();
    onClose();
  };

  const typeLabel = ticket.type === 'bug' ? 'Bug' : 'Proposition';
  const TypeIcon = ticket.type === 'bug' ? Bug : Lightbulb;

  return (
    <Modal open onClose={onClose} title={typeLabel} wide
      footer={
        isAdmin ? (
          <>
            <Button variant="secondary" onClick={onClose}>Fermer</Button>
            <Button onClick={handleSubmit(onSaveAdmin)} disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
        )
      }
    >
      <div className="space-y-5">
        {/* En-tête */}
        <div className="flex flex-wrap items-start gap-2">
          <div className={cn('rounded-lg p-2', ticket.type === 'bug' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30')}>
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-fg">{ticket.titre}</h3>
            <p className="text-xs text-muted mt-0.5">
              {ticket.author_prenom} {ticket.author_nom} &middot;{' '}
              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: fr })}
            </p>
          </div>
          <StatutBadge statut={ticket.statut} />
          {ticket.priorite && <PrioriteBadge priorite={ticket.priorite} />}
        </div>

        {/* Description */}
        <div className="rounded-lg bg-surface-2 p-4">
          <p className="whitespace-pre-wrap text-sm text-fg leading-relaxed">{ticket.description}</p>
        </div>

        {/* Votes (propositions) */}
        {ticket.type === 'proposition' && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleVote}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition border',
                ticket.user_voted
                  ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400'
                  : 'border-line text-muted hover:border-brand-400 hover:text-brand-600',
              )}
            >
              <ThumbsUp className="h-4 w-4" />
              {ticket.votes_count} vote{ticket.votes_count !== 1 ? 's' : ''}
            </button>
            <span className="text-xs text-muted">
              {ticket.user_voted ? 'Vous avez soutenu cette idée' : 'Soutenez cette idée'}
            </span>
          </div>
        )}

        {/* Note admin existante (si non-admin) */}
        {!isAdmin && ticket.admin_note && (
          <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">Réponse équipe</p>
            <p className="whitespace-pre-wrap text-sm text-fg">{ticket.admin_note}</p>
          </div>
        )}

        {/* Section admin */}
        {isAdmin && (
          <div className="space-y-3 border-t border-line pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Gestion admin</p>
            <Field label="Statut">
              <select className="input" {...register('statut')}>
                <option value="ouvert">Ouvert</option>
                <option value="en_cours">En cours</option>
                <option value="resolu">Résolu</option>
                <option value="refuse">Refusé</option>
              </select>
            </Field>
            <Field label="Réponse / Note" hint="Visible par tous les utilisateurs">
              <textarea className="input min-h-[80px] resize-y" placeholder="Ajoutez un commentaire ou une explication…" {...register('admin_note')} />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Composant carte ───────────────────────────────────────────────────────────

function TicketCard({
  ticket, onClick,
}: { ticket: TicketWithMeta; onClick: () => void }) {
  const TypeIcon = ticket.type === 'bug' ? Bug : Lightbulb;
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl border border-line bg-surface p-4 text-left transition hover:border-brand-400 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'mt-0.5 shrink-0 rounded-lg p-2',
          ticket.type === 'bug'
            ? 'bg-red-100 text-red-500 dark:bg-red-900/30'
            : 'bg-amber-100 text-amber-500 dark:bg-amber-900/30',
        )}>
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <StatutBadge statut={ticket.statut} />
            {ticket.priorite && <PrioriteBadge priorite={ticket.priorite} />}
            {ticket.admin_note && (
              <Badge className="bg-brand-500/10 text-brand-600 dark:text-brand-400">Réponse</Badge>
            )}
          </div>
          <p className="font-medium text-fg group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
            {ticket.titre}
          </p>
          <p className="mt-1 text-sm text-muted line-clamp-2">{ticket.description}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted">
            <span>{ticket.author_prenom} {ticket.author_nom}</span>
            <span>&middot;</span>
            <span>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: fr })}</span>
            {ticket.type === 'proposition' && (
              <>
                <span>&middot;</span>
                <span className={cn('flex items-center gap-1', ticket.user_voted && 'text-brand-600 dark:text-brand-400')}>
                  <ThumbsUp className="h-3 w-3" />
                  {ticket.votes_count}
                </span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
      </div>
    </button>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function Tickets() {
  const { session, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TicketType>('bug');
  const [statutFilter, setStatutFilter] = useState<TicketStatut | 'tous'>('tous');
  const [createType, setCreateType] = useState<TicketType | null>(null);
  const [selected, setSelected] = useState<TicketWithMeta | null>(null);

  // Tickets
  const { data: rawTickets, loading, refresh: refreshTickets } = useCollection<Ticket>('tickets', {
    orderBy: { column: 'created_at', ascending: false },
  });

  // Votes
  const { data: rawVotes, refresh: refreshVotes } = useCollection('ticket_votes', {
    select: 'ticket_id, user_id',
  });

  // Profils (pour afficher le nom de l'auteur)
  const { data: profiles } = useCollection<{ id: string; nom: string; prenom: string }>('profiles', {
    select: 'id, nom, prenom',
  });

  const profileMap = useMemo(() => {
    const m: Record<string, { nom: string; prenom: string }> = {};
    profiles.forEach((p) => { m[p.id] = { nom: p.nom, prenom: p.prenom }; });
    return m;
  }, [profiles]);

  const voteMap = useMemo(() => {
    const m: Record<string, { count: number; voted: boolean }> = {};
    rawVotes.forEach((v) => {
      const vote = v as Record<string, string>;
      const t = m[vote.ticket_id] ?? { count: 0, voted: false };
      t.count += 1;
      if (vote.user_id === session?.user.id) t.voted = true;
      m[vote.ticket_id] = t;
    });
    return m;
  }, [rawVotes, session]);

  const tickets: TicketWithMeta[] = useMemo(() =>
    rawTickets.map((t) => ({
      ...t,
      author_nom: profileMap[t.created_by]?.nom ?? null,
      author_prenom: profileMap[t.created_by]?.prenom ?? null,
      votes_count: voteMap[t.id]?.count ?? 0,
      user_voted: voteMap[t.id]?.voted ?? false,
    })),
    [rawTickets, profileMap, voteMap],
  );

  const refresh = () => { refreshTickets(); refreshVotes(); };

  // Filtrage
  const byType = tickets.filter((t) => t.type === activeTab);
  const filtered = byType.filter((t) => statutFilter === 'tous' || t.statut === statutFilter);

  // Compteurs
  const bugCount = tickets.filter((t) => t.type === 'bug' && t.statut === 'ouvert').length;
  const propCount = tickets.filter((t) => t.type === 'proposition' && t.statut === 'ouvert').length;

  const STATUTS: { value: TicketStatut | 'tous'; label: string }[] = [
    { value: 'tous', label: 'Tous' },
    { value: 'ouvert', label: 'Ouverts' },
    { value: 'en_cours', label: 'En cours' },
    { value: 'resolu', label: 'Résolus' },
    { value: 'refuse', label: 'Refusés' },
  ];

  return (
    <div>
      <PageHeader
        title="Espace développement"
        subtitle="Signalez un bug ou soumettez vos idées d'amélioration"
        actions={
          <Button onClick={() => setCreateType(activeTab)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {activeTab === 'bug' ? 'Signaler un bug' : 'Proposer une idée'}
          </Button>
        }
      />

      {/* Statistiques rapides */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Bugs ouverts', value: bugCount, icon: <Bug className="h-5 w-5" />, color: 'text-red-500 bg-red-100 dark:bg-red-900/30' },
          { label: 'Propositions actives', value: propCount, icon: <Lightbulb className="h-5 w-5" />, color: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30' },
          { label: 'Bugs résolus', value: tickets.filter((t) => t.type === 'bug' && t.statut === 'resolu').length, icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30' },
          { label: 'Propositions planifiées', value: tickets.filter((t) => t.type === 'proposition' && t.statut === 'en_cours').length, icon: <AlertTriangle className="h-5 w-5" />, color: 'text-sky-500 bg-sky-100 dark:bg-sky-900/30' },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 p-4">
            <div className={cn('rounded-lg p-2 shrink-0', s.color)}>{s.icon}</div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-fg">{s.value}</p>
              <p className="text-xs text-muted truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 border-b border-line">
        {(['bug', 'proposition'] as TicketType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setActiveTab(t); setStatutFilter('tous'); }}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition',
              activeTab === t
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {t === 'bug' ? <Bug className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
            {t === 'bug' ? 'Bugs' : 'Propositions'}
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-xs font-semibold',
              activeTab === t
                ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400'
                : 'bg-surface-2 text-muted',
            )}>
              {t === 'bug' ? tickets.filter((x) => x.type === 'bug').length : tickets.filter((x) => x.type === 'proposition').length}
            </span>
          </button>
        ))}
      </div>

      {/* Filtres statut */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUTS.map((s) => (
          <FilterPill
            key={s.value}
            active={statutFilter === s.value}
            onClick={() => setStatutFilter(s.value)}
          >
            {s.label}
            {s.value !== 'tous' && (
              <span className="ml-1 opacity-70">
                ({byType.filter((t) => t.statut === s.value).length})
              </span>
            )}
          </FilterPill>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={statutFilter === 'tous' ? `Aucun ${activeTab === 'bug' ? 'bug signalé' : 'proposition'}` : 'Aucun ticket pour ce statut'}
          message={statutFilter === 'tous' ? 'Soyez le premier à contribuer !' : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TicketCard key={t.id} ticket={t} onClick={() => setSelected(t)} />
          ))}
        </div>
      )}

      {/* Modals */}
      {createType && (
        <CreateModal
          open
          onClose={() => setCreateType(null)}
          type={createType}
          onCreated={refresh}
        />
      )}
      {selected && (
        <DetailModal
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdated={refresh}
        />
      )}
    </div>
  );
}
