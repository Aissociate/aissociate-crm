import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ComposeMessageModal from '@/components/ComposeMessageModal';
import AssistantChat from '@/components/AssistantChat';
import HistoriqueContact from '@/components/HistoriqueContact';
import EspaceClientButton from '@/components/EspaceClientButton';
import { useEditionContact } from './contactFiche/useEditionContact';
import { useJournalActions } from './contactFiche/useJournalActions';
import { useAffaires } from './contactFiche/useAffaires';
import { OngletSuivi } from './contactFiche/OngletSuivi';
import { OngletAffaires } from './contactFiche/OngletAffaires';
import { OngletDetails } from './contactFiche/OngletDetails';
import { X, Mail, Phone, Pencil, ClipboardList, Bot, History, Briefcase, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { cn, fullName, initials } from '@/lib/utils';
import { CONTACT_TYPE_LABELS } from '@/lib/constants';
import { Badge, type Tone } from '@/components/ui';
import type {
  Contact, Entreprise, Financeur, Profile, ContactAction, ContactDocument, Opportunite, Dossier,
  SessionFormation, SessionParticipant,
} from '@/lib/database.types';
import { STATUTS_PROSPECT } from './contactFiche/outils';

interface Props {
  contact: Contact;
  entreprises: Entreprise[];
  financeurs: Financeur[];
  profiles: Profile[];
  onClose: () => void;
  onEdit: (c: Contact) => void;
  onUpdated: () => void;
}

export default function ContactFiche({ contact: c, entreprises, financeurs, profiles, onClose, onEdit, onUpdated }: Props) {
  const { session } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);
  // Cinq vues dans le même panneau. « Suivi » est celle qu'on ouvre pour traiter
  // un lead (quoi faire, qualification, notes) ; « Affaires » regroupe ce qui a
  // été vendu ou monté ; « Détails » range les champs qu'on remplit rarement.
  type Vue = 'suivi' | 'affaires' | 'details' | 'historique' | 'assistant';
  const [tab, setTab] = useState<Vue>('suivi');
  useEffect(() => { setTab('suivi'); }, [c.id]);
  const entreprise = entreprises.find((e) => e.id === c.entreprise_id);
  const financeur = financeurs.find((f) => f.id === c.financeur_id);
  const owner = profiles.find((p) => p.id === c.owner_id);

  // ── Statut transverse (pipeline / dossiers / sessions) ───────────────────────
  const [opps, setOpps] = useState<Opportunite[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [sessions, setSessions] = useState<SessionFormation[]>([]);
  // Lignes de participation du contact (statut, id) — utilisées par le calendrier miniature.
  const [participations, setParticipations] = useState<SessionParticipant[]>([]);
  const [actions, setActions] = useState<ContactAction[]>([]);
  const [coffre, setCoffre] = useState<ContactDocument[]>([]);

  const loadRefs = useCallback(async () => {
    const [o, d, sp, a, cd] = await Promise.all([
      supabase.from('opportunites').select('*').eq('contact_id', c.id).order('created_at', { ascending: false }),
      supabase.from('dossiers').select('*').eq('contact_id', c.id).order('created_at', { ascending: false }),
      supabase.from('session_participants').select('*').eq('contact_id', c.id),
      supabase.from('contact_actions').select('*').eq('contact_id', c.id).order('date_action', { ascending: false }).order('heure_action', { ascending: false, nullsFirst: false }),
      supabase.from('contact_documents').select('*').eq('contact_id', c.id).order('created_at', { ascending: false }),
    ]);
    setOpps(o.data ?? []); setDossiers(d.data ?? []); setActions(a.data ?? []); setCoffre(cd.data ?? []);
    const parts = (sp.data ?? []) as SessionParticipant[];
    setParticipations(parts);
    const ids = parts.map((x) => x.session_id);
    if (ids.length) {
      const s = await supabase.from('sessions_formation').select('*').in('id', ids).order('date_debut', { ascending: false });
      setSessions(s.data ?? []);
    } else setSessions([]);
  }, [c.id]);
  useEffect(() => { void loadRefs(); }, [loadRefs]);

  // Enregistrement des champs, journal d'actions, ajouts de l'onglet Affaires : la logique vit
  // dans des hooks appelés ici, pour que l'état survive au changement d'onglet.
  const edition = useEditionContact(c, onUpdated);
  const { cc, patch } = edition;
  const journal = useJournalActions(c, actions, setActions);
  const { aFaire } = journal;
  const affaires = useAffaires(c, session?.user.id, actions, loadRefs);

  const TYPE_TONE: Record<string, Tone> = {
    prospect: 'info',
    apprenant: 'success',
    contact_entreprise: 'warning',
    contact_financeur: 'brand',
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — élargi pour accueillir l'historique et le chat IA */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-surface shadow-2xl animate-slide-in-right">

        {/* En-tête : qui c'est, où il en est, comment le joindre */}
        <div className="border-b border-line p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-base font-bold text-brand-600 dark:text-brand-400">
                {initials(c.nom, c.prenom)}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold leading-tight text-fg">
                  {c.civilite && <span className="font-normal text-muted">{c.civilite} </span>}
                  {fullName(c.prenom, c.nom)}
                </h2>
                {(c.fonction || entreprise) && (
                  <p className="truncate text-sm text-muted">
                    {c.fonction}{c.fonction && entreprise ? ' · ' : ''}
                    {entreprise && <Link to={`/entreprises?open=${entreprise.id}`} onClick={onClose} title="Ouvrir la fiche entreprise" className="text-brand-600 hover:underline dark:text-brand-400">{entreprise.raison_sociale}</Link>}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge tone={TYPE_TONE[c.type] ?? 'neutral'}>{CONTACT_TYPE_LABELS[c.type]}</Badge>
                  <select value={cc.statut_prospect ?? ''} onChange={(e) => patch({ statut_prospect: e.target.value || null })}
                    title="Statut de qualification"
                    className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg">
                    {/* Un statut hérité d'un import reste affiché même s'il n'est plus proposé. */}
                    {[...new Set([...STATUTS_PROSPECT, cc.statut_prospect ?? ''])].map((s) => <option key={s} value={s}>{s || '— statut —'}</option>)}
                  </select>
                  <span className="text-xs text-muted">
                    {owner ? `Suivi par ${fullName(owner.prenom, owner.nom)}` : c.type === 'prospect' ? <span className="text-amber-600">Non affecté</span> : null}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <EspaceClientButton contactId={c.id} />
              <button
                onClick={() => { onClose(); onEdit(c); }}
                className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-brand-600"
                title="Modifier le contact (nom, coordonnées, entreprise, tags)"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={onClose} title="Fermer" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Joindre le contact : les deux gestes de la journée */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {c.telephone && (
              <a href={`tel:${c.telephone}`} className="btn-secondary py-1.5 text-sm"><Phone className="h-4 w-4" /> {c.telephone}</a>
            )}
            <button onClick={() => setComposeOpen(true)} className="btn-secondary py-1.5 text-sm" title="Envoyer un e-mail ou un WhatsApp">
              <Mail className="h-4 w-4" /> Écrire
            </button>
            {c.email
              ? <a href={`mailto:${c.email}`} className="min-w-0 truncate text-sm text-muted hover:text-brand-600">{c.email}</a>
              : !c.telephone && <span className="text-sm italic text-muted">Aucune coordonnée renseignée</span>}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex overflow-x-auto border-b border-line px-5" role="tablist">
          {([
            { cle: 'suivi', label: 'Suivi', icone: <ClipboardList className="h-4 w-4" />, n: aFaire.length },
            { cle: 'affaires', label: 'Affaires', icone: <Briefcase className="h-4 w-4" />, n: opps.length + dossiers.length },
            { cle: 'details', label: 'Détails', icone: <Info className="h-4 w-4" />, n: 0 },
            { cle: 'historique', label: 'Historique', icone: <History className="h-4 w-4" />, n: 0 },
            { cle: 'assistant', label: 'Assistant IA', icone: <Bot className="h-4 w-4" />, n: 0 },
          ] as const).map((t) => (
            <button
              key={t.cle}
              role="tab"
              aria-selected={tab === t.cle}
              onClick={() => setTab(t.cle)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition',
                tab === t.cle
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-muted hover:border-line hover:text-fg',
              )}
            >
              {t.icone} {t.label}
              {t.n > 0 && <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums text-muted">{t.n}</span>}
            </button>
          ))}
        </div>

        {/* Historique unifié de la fiche */}
        {tab === 'historique' && (
          <div className="flex-1 overflow-y-auto p-5">
            <HistoriqueContact contactId={c.id} contactCreatedAt={c.created_at} onNavigate={onClose} />
          </div>
        )}

        {/* Assistant IA embarqué, branché sur ce contact */}
        {tab === 'assistant' && (
          <AssistantChat
            compact
            contexte={{ type: 'contact', id: c.id, label: fullName(c.prenom, c.nom) }}
            suggestions={[
              'Résume la situation de ce contact',
              'Quelle est la prochaine action prévue ?',
              'Prépare un email de relance personnalisé',
              'Propose une relance téléphonique pour demain 9h',
            ]}
          />
        )}

        {/* ── Suivi : quoi faire, où en est le besoin, notes ── */}
        {tab === 'suivi' && <OngletSuivi c={c} journal={journal} edition={edition} />}

        {/* ── Affaires : opportunités, sessions, dossiers, documents ── */}
        {tab === 'affaires' && (
          <OngletAffaires
            c={c} cc={cc} affaires={affaires}
            opps={opps} dossiers={dossiers} sessions={sessions} participations={participations}
            actions={actions} coffre={coffre}
            loadRefs={loadRefs} onClose={onClose} onUpdated={onUpdated}
          />
        )}

        {/* ── Détails : ce qu'on remplit rarement ── */}
        {tab === 'details' && (
          <OngletDetails c={c} edition={edition} entreprise={entreprise} financeur={financeur} owner={owner} />
        )}
      </div>

      {/* Envoi rapide e-mail / WhatsApp depuis la fiche (modale partagée Messagerie) */}
      <ComposeMessageModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => { void loadRefs(); onUpdated(); }}
        initial={{ canal: 'email', dest: c.email ?? '', contactId: c.id }}
      />
    </>
  );
}
