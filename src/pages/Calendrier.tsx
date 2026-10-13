import { useState, useEffect, useCallback } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, addWeeks, addDays, isSameMonth, isSameDay, format, parseISO,
  startOfDay, endOfDay, isWithinInterval, differenceInCalendarDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Users, MapPin, Clock, CalendarDays, User,
  Phone, Mail, CalendarClock, ListTodo, Check,
} from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner } from '@/components/ui';
import { MODALITES } from '@/lib/constants';
import { fullName } from '@/lib/utils';
import type {
  SessionFormation, SessionParticipant, ParticipantStatut, Formation, Contact, Formateur, ContactAction,
} from '@/lib/database.types';

const COULEURS = ['#ea6a1e', '#10b981', '#6366f1', '#ef4444', '#0ea5e9', '#a855f7', '#64748b'];
const PART_STATUTS: { v: ParticipantStatut; label: string }[] = [
  { v: 'inscrit', label: 'Inscrit' }, { v: 'present', label: 'Présent' },
  { v: 'absent', label: 'Absent' }, { v: 'annule', label: 'Annulé' },
];
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

type Vue = 'mois' | 'semaine' | 'jour';
const VUES: { v: Vue; label: string }[] = [
  { v: 'mois', label: 'Mois' }, { v: 'semaine', label: 'Semaine' }, { v: 'jour', label: 'Jour' },
];
const CLE_VUE = 'calendrier:vue';
const CLE_ACTIONS = 'calendrier:actions';

/** Rendez-vous et relances des fiches contacts affichés à côté des sessions. */
type ActionCal = Pick<ContactAction, 'id' | 'contact_id' | 'date_action' | 'heure_action' | 'type' | 'description' | 'faite'>
  & { contacts: { nom: string; prenom: string | null } | null };
const ICONE_ACTION: Record<string, typeof Phone> = { appel: Phone, email: Mail, rdv: CalendarClock };
const heureAction = (a: ActionCal) => (a.heure_action ? a.heure_action.slice(0, 5) : '');
const vueInitiale = (): Vue => {
  try { const v = localStorage.getItem(CLE_VUE); return v === 'semaine' || v === 'jour' ? v : 'mois'; } catch { return 'mois'; }
};

const toInput = (iso: string | null | undefined) =>
  iso ? format(parseISO(iso), "yyyy-MM-dd'T'HH:mm") : '';

type Form = {
  id?: string; titre: string; formation_id: string | null; formateur_id: string | null;
  debut: string; fin: string; lieu: string; modalite: string; formateur: string;
  couleur: string; notes: string;
};
const emptyForm = (day?: Date): Form => ({
  titre: '', formation_id: null, formateur_id: null,
  debut: day ? `${format(day, 'yyyy-MM-dd')}T09:00` : '',
  fin: day ? `${format(day, 'yyyy-MM-dd')}T17:00` : '',
  lieu: '', modalite: 'presentiel', formateur: '', couleur: COULEURS[0], notes: '',
});

export default function Calendrier() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  // Ouverture sur le mois d'une session via ?date=YYYY-MM-DD (lien depuis la fiche contact).
  const navigate = useNavigate();
  const [vue, setVueEtat] = useState<Vue>(vueInitiale);
  // Rendez-vous et relances des contacts : affichés par défaut, masquables.
  const [voirActions, setVoirActionsEtat] = useState(() => {
    try { return localStorage.getItem(CLE_ACTIONS) !== '0'; } catch { return true; }
  });
  const setVoirActions = (v: boolean) => {
    setVoirActionsEtat(v);
    try { localStorage.setItem(CLE_ACTIONS, v ? '1' : '0'); } catch { /* stockage indisponible */ }
  };
  const setVue = (v: Vue) => { setVueEtat(v); try { localStorage.setItem(CLE_VUE, v); } catch { /* stockage indisponible */ } };
  const [month, setMonth] = useState<Date>(() => {
    const d = searchParams.get('date');
    const parsed = d ? parseISO(d) : null;
    return parsed && !isNaN(parsed.getTime()) ? parsed : new Date();
  });
  const { data: sessions, loading, refresh } = useCollection<SessionFormation>('sessions_formation', {
    orderBy: { column: 'date_debut' },
  });
  const formations = useCollection<Formation>('formations');
  const contacts = useCollection<Contact>('contacts');
  const formateurs = useCollection<Formateur>('formateurs', { orderBy: { column: 'nom' } });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [part, setPart] = useState({ contact_id: '', nom: '', prenom: '', email: '', statut: 'inscrit' as ParticipantStatut });

  const set = (k: keyof Form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // `month` sert de date de référence pour les trois vues.
  const days = vue === 'mois'
    ? eachDayOfInterval({
      start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    })
    : vue === 'semaine'
      ? eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(month, { weekStartsOn: 1 }) })
      : [month];
  const decaler = (sens: 1 | -1) => setMonth((m) => (
    vue === 'mois' ? addMonths(m, sens) : vue === 'semaine' ? addWeeks(m, sens) : addDays(m, sens)));
  const titrePeriode = vue === 'mois'
    ? format(month, 'MMMM yyyy', { locale: fr })
    : vue === 'semaine'
      ? `${format(days[0], 'd MMM', { locale: fr })} – ${format(days[6], 'd MMM yyyy', { locale: fr })}`
      : format(month, 'EEEE d MMMM yyyy', { locale: fr });
  const ouvrirJour = (day: Date) => { setMonth(day); setVue('jour'); };

  // Actions des fiches contacts sur la période affichée : tout ce qui reste à
  // faire (appels, relances…) et les rendez-vous, même faits. Les centaines
  // d'appels et d'e-mails déjà faits n'y sont pas : ils noieraient le planning.
  const [actions, setActions] = useState<ActionCal[]>([]);
  const debutPeriode = format(days[0], 'yyyy-MM-dd');
  const finPeriode = format(days[days.length - 1], 'yyyy-MM-dd');
  const chargerActions = useCallback(async () => {
    const { data } = await supabase.from('contact_actions')
      .select('id, contact_id, date_action, heure_action, type, description, faite, contacts(nom, prenom)')
      .gte('date_action', debutPeriode).lte('date_action', finPeriode)
      .or('faite.eq.false,type.eq.rdv')
      .order('heure_action', { ascending: true, nullsFirst: false })
      .limit(1000);
    setActions((data ?? []) as unknown as ActionCal[]);
  }, [debutPeriode, finPeriode]);
  useEffect(() => { if (voirActions) void chargerActions(); }, [voirActions, chargerActions]);
  const actionsOfDay = (day: Date) => (voirActions ? actions.filter((a) => a.date_action === format(day, 'yyyy-MM-dd')) : []);
  const ouvrirContact = (a: ActionCal) => navigate(`/contacts?id=${a.contact_id}`);
  const marquerFaite = async (a: ActionCal) => {
    setActions((prev) => prev.map((x) => (x.id === a.id ? { ...x, faite: true } : x)));
    const { error } = await supabase.from('contact_actions').update({ faite: true }).eq('id', a.id);
    if (error) { alert(error.message); void chargerActions(); }
  };

  const loadParticipants = useCallback(async (sessionId: string) => {
    const { data } = await supabase.from('session_participants').select('*')
      .eq('session_id', sessionId).order('created_at');
    setParticipants(data ?? []);
  }, []);

  const openNew = (day?: Date) => { setForm(emptyForm(day)); setParticipants([]); setOpen(true); };
  const openEdit = async (s: SessionFormation) => {
    setForm({
      id: s.id, titre: s.titre, formation_id: s.formation_id, formateur_id: s.formateur_id ?? null,
      debut: toInput(s.date_debut), fin: toInput(s.date_fin),
      lieu: s.lieu ?? '', modalite: s.modalite, formateur: s.formateur ?? '',
      couleur: s.couleur, notes: s.notes ?? '',
    });
    await loadParticipants(s.id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.titre || !form.debut) return;
    setSaving(true);
    const formateurNom = form.formateur_id
      ? (() => { const f = formateurs.data.find((x) => x.id === form.formateur_id); return f ? fullName(f.prenom, f.nom) : form.formateur; })()
      : form.formateur;
    const payload = {
      titre: form.titre, formation_id: form.formation_id || null, formateur_id: form.formateur_id || null,
      date_debut: new Date(form.debut).toISOString(),
      date_fin: form.fin ? new Date(form.fin).toISOString() : null,
      lieu: form.lieu || null, modalite: form.modalite, formateur: formateurNom || null,
      couleur: form.couleur, notes: form.notes || null,
    };
    if (form.id) {
      const { error } = await supabase.from('sessions_formation').update(payload).eq('id', form.id);
      if (error) { setSaving(false); alert(error.message); return; }
    } else {
      const { data, error } = await supabase.from('sessions_formation')
        .insert({ ...payload, created_by: session?.user.id }).select().single();
      if (error || !data) { setSaving(false); alert(error?.message); return; }
      setForm((f) => ({ ...f, id: data.id })); // passe en mode édition pour les participants
    }
    setSaving(false);
    refresh();
  };

  const removeSession = async (id: string) => {
    if (!confirm('Supprimer cette session et ses participants ?')) return;
    await supabase.from('sessions_formation').delete().eq('id', id);
    setOpen(false);
    refresh();
  };

  const addParticipant = async () => {
    if (!form.id) { alert('Enregistrez d\'abord la session.'); return; }
    if (!part.nom.trim()) return;
    const { data } = await supabase.from('session_participants').insert({
      session_id: form.id, contact_id: part.contact_id || null,
      nom: part.nom.trim(), prenom: part.prenom || null, email: part.email || null, statut: part.statut,
    }).select().single();
    if (data) setParticipants((p) => [...p, data]);
    setPart({ contact_id: '', nom: '', prenom: '', email: '', statut: 'inscrit' });
  };

  const setPartStatut = async (p: SessionParticipant, statut: ParticipantStatut) => {
    setParticipants((prev) => prev.map((x) => (x.id === p.id ? { ...x, statut } : x)));
    await supabase.from('session_participants').update({ statut }).eq('id', p.id);
  };
  const removeParticipant = async (p: SessionParticipant) => {
    await supabase.from('session_participants').delete().eq('id', p.id);
    setParticipants((prev) => prev.filter((x) => x.id !== p.id));
  };

  // Pré-remplit un participant depuis un contact choisi
  const onPickContact = (id: string) => {
    const c = contacts.data.find((x) => x.id === id);
    setPart((p) => ({ ...p, contact_id: id, nom: c?.nom ?? p.nom, prenom: c?.prenom ?? '', email: c?.email ?? '' }));
  };

  // Une session occupe TOUS les jours de date_debut à date_fin (inclus), pas
  // seulement son jour de début (ex. session des 4 et 5 août affichée sur 2 jours).
  const sessionsOfDay = (day: Date) =>
    sessions.filter((s) => {
      const debut = parseISO(s.date_debut);
      const fin = s.date_fin ? parseISO(s.date_fin) : debut;
      const end = fin < debut ? debut : fin;
      return isWithinInterval(day, { start: startOfDay(debut), end: endOfDay(end) });
    }).sort((a, b) => format(parseISO(a.date_debut), 'HH:mm').localeCompare(format(parseISO(b.date_debut), 'HH:mm')));

  /** « J2/3 » pour une session sur plusieurs jours, sinon l'heure de début. */
  const repere = (s: SessionFormation, day: Date) => {
    const debut = parseISO(s.date_debut);
    const fin = s.date_fin ? parseISO(s.date_fin) : debut;
    const total = Math.max(0, differenceInCalendarDays(fin, debut)) + 1;
    if (total === 1 || isSameDay(day, debut)) return format(debut, 'HH:mm');
    return `J${differenceInCalendarDays(day, debut) + 1}/${total}`;
  };

  // Vue jour : nombre de participants de chaque session affichée.
  const [nbInscrits, setNbInscrits] = useState<Record<string, number>>({});
  const idsJour = vue === 'jour' ? sessionsOfDay(month).map((s) => s.id).join(',') : '';
  useEffect(() => {
    if (!idsJour) return;
    void supabase.from('session_participants').select('session_id').in('session_id', idsJour.split(','))
      .then(({ data }) => {
        const n: Record<string, number> = {};
        for (const r of data ?? []) n[r.session_id] = (n[r.session_id] ?? 0) + 1;
        setNbInscrits(n);
      });
  }, [idsJour]);

  const pastilleAction = (a: ActionCal) => {
    const Icone = ICONE_ACTION[a.type] ?? ListTodo;
    const qui = a.contacts ? fullName(a.contacts.prenom, a.contacts.nom) : 'Contact';
    return (
      <button
        key={a.id} onClick={() => ouvrirContact(a)}
        className={`flex w-full items-center gap-1 truncate rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-left text-xs text-sky-700 hover:bg-sky-500/20 dark:text-sky-300 ${a.faite ? 'line-through opacity-60' : ''}`}
        title={`${a.type} — ${qui} : ${a.description}`}
      >
        <Icone className="h-3 w-3 shrink-0" />
        <span className="truncate">{heureAction(a)} {qui}</span>
      </button>
    );
  };

  /** Sessions puis actions du jour, mêlées par heure (sans heure : en fin de journée). */
  const elementsDuJour = (day: Date) => {
    const cle = (h: string) => h || '99:99';
    return [
      ...sessionsOfDay(day).map((x) => ({ h: format(parseISO(x.date_debut), 'HH:mm'), el: pastille(x, day) })),
      ...actionsOfDay(day).map((a) => ({ h: heureAction(a), el: pastilleAction(a) })),
    ].sort((x, y) => cle(x.h).localeCompare(cle(y.h))).map((x) => x.el);
  };

  const pastille = (s: SessionFormation, day: Date) => (
    <button
      key={s.id} onClick={() => openEdit(s)}
      className="block w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium text-white hover:opacity-90"
      style={{ backgroundColor: s.couleur }}
      title={`${s.titre}${s.lieu ? ` — ${s.lieu}` : ''}`}
    >
      {repere(s, day)} {s.titre}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Calendrier des sessions"
        subtitle="Planning des sessions de formation et participants — partagé par toute l'équipe"
        actions={<Button onClick={() => openNew(new Date())}><Plus className="h-4 w-4" /> Nouvelle session</Button>}
      />

      <div className="card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => decaler(-1)} className="rounded-lg p-2 text-muted hover:bg-surface-2"><ChevronLeft className="h-5 w-5" /></button>
            <h2 className="min-w-[220px] text-center text-lg font-semibold capitalize text-fg">{titrePeriode}</h2>
            <button onClick={() => decaler(1)} className="rounded-lg p-2 text-muted hover:bg-surface-2"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-line p-0.5 text-sm">
              {VUES.map(({ v, label }) => (
                <button key={v} onClick={() => setVue(v)}
                  className={`rounded-md px-3 py-1 font-medium transition ${vue === v ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'text-muted hover:text-fg'}`}>
                  {label}
                </button>
              ))}
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm text-muted hover:text-fg"
              title="Appels, relances et rendez-vous planifiés sur les fiches contacts">
              <input type="checkbox" checked={voirActions} onChange={(e) => setVoirActions(e.target.checked)} className="accent-sky-500" />
              Rendez-vous & relances
            </label>
            <Button variant="secondary" onClick={() => setMonth(new Date())}><CalendarDays className="h-4 w-4" /> Aujourd'hui</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
        ) : (
          <>
            {vue !== 'jour' && (
              <div className="grid grid-cols-7 gap-px border-b border-line pb-1 text-center text-xs font-semibold uppercase text-muted">
                {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
              </div>
            )}

            {/* Mois et semaine : toutes les sessions de chaque jour, sans « +N autre(s) ». */}
            {vue !== 'jour' && (
              <div className="grid grid-cols-7 gap-px bg-line">
                {days.map((day) => {
                  const inMonth = vue === 'semaine' || isSameMonth(day, month);
                  const today = isSameDay(day, new Date());
                  const items = elementsDuJour(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`group bg-surface p-1.5 ${vue === 'semaine' ? 'min-h-[320px]' : 'min-h-[104px]'} ${inMonth ? '' : 'opacity-50'}`}
                      onDoubleClick={() => openNew(day)}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <button onClick={() => ouvrirJour(day)} title="Voir la journée"
                          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs hover:ring-2 hover:ring-brand-500/40 ${today ? 'bg-brand-600 font-semibold text-white' : 'text-muted'}`}>
                          {vue === 'semaine' ? format(day, 'd MMM', { locale: fr }) : format(day, 'd')}
                        </button>
                        <button onClick={() => openNew(day)} className="rounded p-0.5 text-muted opacity-0 hover:bg-surface-2 hover:text-brand-600 group-hover:opacity-100" title="Ajouter">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {items}
                        {vue === 'semaine' && items.length === 0 && <p className="px-1 text-[11px] text-muted/60">—</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Jour : le détail de chaque session, puis les rendez-vous et relances. */}
            {vue === 'jour' && (sessionsOfDay(month).length === 0 && actionsOfDay(month).length === 0 ? (
              <div className="rounded-lg border border-dashed border-line py-12 text-center text-sm text-muted" onDoubleClick={() => openNew(month)}>
                Rien de prévu ce jour-là.
                <div className="mt-3"><Button variant="secondary" onClick={() => openNew(month)}><Plus className="h-4 w-4" /> Créer une session</Button></div>
              </div>
            ) : (
              <div className="space-y-5">
                {sessionsOfDay(month).length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sessions ({sessionsOfDay(month).length})</h3>
                    <ul className="space-y-2">
                      {sessionsOfDay(month).map((s) => (
                        <li key={s.id}>
                          <button onClick={() => openEdit(s)}
                            className="flex w-full items-stretch gap-3 rounded-lg border border-line bg-surface text-left transition hover:bg-surface-2">
                            <span className="w-1.5 shrink-0 rounded-l-lg" style={{ backgroundColor: s.couleur }} />
                            <span className="w-24 shrink-0 py-3 text-sm font-semibold tabular-nums text-fg">
                              {repere(s, month)}
                              {s.date_fin && isSameDay(parseISO(s.date_fin), month) && (
                                <span className="block text-xs font-normal text-muted">→ {format(parseISO(s.date_fin), 'HH:mm')}</span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1 py-3 pr-3">
                              <span className="block font-medium text-fg">{s.titre}</span>
                              <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                                {s.lieu && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.lieu}</span>}
                                {s.modalite && <span>{s.modalite}</span>}
                                {s.formateur && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{s.formateur}</span>}
                                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{nbInscrits[s.id] ?? 0} participant(s)</span>
                              </span>
                              {s.notes && <span className="mt-1 block line-clamp-2 text-xs text-muted">{s.notes}</span>}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {actionsOfDay(month).length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Rendez-vous & relances ({actionsOfDay(month).length})</h3>
                    <ul className="space-y-2">
                      {actionsOfDay(month).map((a) => {
                        const Icone = ICONE_ACTION[a.type] ?? ListTodo;
                        return (
                          <li key={a.id} className={`flex items-start gap-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 ${a.faite ? 'opacity-60' : ''}`}>
                            <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-fg">{heureAction(a) || '—'}</span>
                            <Icone className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                            <button onClick={() => ouvrirContact(a)} className="min-w-0 flex-1 text-left">
                              <span className="block font-medium text-fg hover:underline">
                                {a.contacts ? fullName(a.contacts.prenom, a.contacts.nom) : 'Contact'}
                                <span className="ml-2 text-xs font-normal capitalize text-muted">{a.type}</span>
                              </span>
                              <span className={`mt-0.5 block line-clamp-2 text-sm text-muted ${a.faite ? 'line-through' : ''}`}>{a.description}</span>
                            </button>
                            {!a.faite ? (
                              <Button variant="ghost" onClick={() => void marquerFaite(a)} className="!px-2 !py-1 text-xs" title="Marquer comme fait">
                                <Check className="h-3.5 w-3.5" /> Fait
                              </Button>
                            ) : <span className="text-xs text-muted">Fait</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </div>
            ))}

            <p className="mt-2 text-xs text-muted">Astuce : cliquez sur un numéro de jour pour voir la journée ; double-cliquez sur un jour pour créer une session.</p>
          </>
        )}
      </div>

      <Modal
        open={open} onClose={() => setOpen(false)} wide
        title={form.id ? 'Modifier la session' : 'Nouvelle session'}
        footer={
          <>
            {form.id && <Button variant="danger" onClick={() => removeSession(form.id!)} className="mr-auto"><Trash2 className="h-4 w-4" /> Supprimer</Button>}
            <Button variant="secondary" onClick={() => setOpen(false)}>Fermer</Button>
            <Button onClick={save} disabled={saving || !form.titre || !form.debut}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="Titre" required><input className="input" value={form.titre} onChange={(e) => set('titre', e.target.value)} /></Field></div>
          <Field label="Début" required><input className="input" type="datetime-local" value={form.debut} onChange={(e) => set('debut', e.target.value)} /></Field>
          <Field label="Fin"><input className="input" type="datetime-local" value={form.fin} onChange={(e) => set('fin', e.target.value)} /></Field>
          <Field label="Formation"><select className="input" value={form.formation_id ?? ''} onChange={(e) => set('formation_id', e.target.value || null)}>
            <option value="">—</option>
            {formations.data.map((f) => <option key={f.id} value={f.id}>{f.intitule}</option>)}
          </select></Field>
          <Field label="Modalité"><select className="input" value={form.modalite} onChange={(e) => set('modalite', e.target.value)}>
            {MODALITES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select></Field>
          <Field label="Lieu"><input className="input" value={form.lieu} onChange={(e) => set('lieu', e.target.value)} /></Field>
          <Field label="Formateur"><select className="input" value={form.formateur_id ?? ''} onChange={(e) => set('formateur_id', e.target.value || null)}>
            <option value="">— Non affecté —</option>
            {formateurs.data.map((f) => <option key={f.id} value={f.id}>{fullName(f.prenom, f.nom)}</option>)}
          </select></Field>
          <div className="col-span-2">
            <Field label="Couleur">
              <div className="flex gap-2">
                {COULEURS.map((c) => (
                  <button key={c} type="button" onClick={() => set('couleur', c)}
                    className={`h-7 w-7 rounded-full ${form.couleur === c ? 'ring-2 ring-offset-2 ring-offset-surface' : ''}`}
                    style={{ backgroundColor: c, boxShadow: form.couleur === c ? `0 0 0 2px ${c}` : undefined }} />
                ))}
              </div>
            </Field>
          </div>
          <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field></div>
        </div>

        {/* Participants */}
        <div className="mt-6 border-t border-line pt-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-fg"><Users className="h-4 w-4" /> Participants ({participants.length})</h3>
          {!form.id ? (
            <p className="text-sm text-muted">Enregistrez la session pour ajouter des participants.</p>
          ) : (
            <>
              <ul className="mb-3 space-y-2">
                {participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                    <span className="flex-1 text-sm text-fg">{fullName(p.prenom, p.nom)}{p.email && <span className="text-muted"> · {p.email}</span>}</span>
                    <select className="input max-w-[130px] py-1 text-xs" value={p.statut} onChange={(e) => setPartStatut(p, e.target.value as ParticipantStatut)}>
                      {PART_STATUTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                    </select>
                    <button onClick={() => removeParticipant(p)} className="rounded p-1 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
                {participants.length === 0 && <li className="text-sm text-muted">Aucun participant.</li>}
              </ul>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-3 sm:grid-cols-4">
                <select className="input py-1.5" value={part.contact_id} onChange={(e) => onPickContact(e.target.value)}>
                  <option value="">Contact (option)…</option>
                  {contacts.data.map((c) => <option key={c.id} value={c.id}>{fullName(c.prenom, c.nom)}</option>)}
                </select>
                <input className="input py-1.5" placeholder="Nom *" value={part.nom} onChange={(e) => setPart({ ...part, nom: e.target.value })} />
                <input className="input py-1.5" placeholder="Prénom" value={part.prenom} onChange={(e) => setPart({ ...part, prenom: e.target.value })} />
                <input className="input py-1.5" placeholder="E-mail" value={part.email} onChange={(e) => setPart({ ...part, email: e.target.value })} />
                <div className="col-span-2 sm:col-span-4">
                  <Button variant="secondary" onClick={addParticipant} disabled={!part.nom.trim()}><Plus className="h-4 w-4" /> Ajouter le participant</Button>
                </div>
              </div>
            </>
          )}
        </div>

        {form.id && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
            {form.lieu && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{form.lieu}</span>}
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{form.debut && format(parseISO(new Date(form.debut).toISOString()), 'dd/MM HH:mm')}</span>
          </div>
        )}
      </Modal>
    </div>
  );
}
