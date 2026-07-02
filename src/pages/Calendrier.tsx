import { useState, useEffect, useCallback } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, isSameMonth, isSameDay, format, parseISO,
  startOfDay, endOfDay, isWithinInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Plus, Trash2, Users, MapPin, Clock, CalendarDays,
} from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner } from '@/components/ui';
import { MODALITES } from '@/lib/constants';
import { fullName } from '@/lib/utils';
import type {
  SessionFormation, SessionParticipant, ParticipantStatut, Formation, Contact, Formateur,
} from '@/lib/database.types';

const COULEURS = ['#ea6a1e', '#10b981', '#6366f1', '#ef4444', '#0ea5e9', '#a855f7', '#64748b'];
const PART_STATUTS: { v: ParticipantStatut; label: string }[] = [
  { v: 'inscrit', label: 'Inscrit' }, { v: 'present', label: 'Présent' },
  { v: 'absent', label: 'Absent' }, { v: 'annule', label: 'Annulé' },
];
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

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
    });

  return (
    <div>
      <PageHeader
        title="Calendrier des sessions"
        subtitle="Planning des sessions de formation et participants — partagé par toute l'équipe"
        actions={<Button onClick={() => openNew(new Date())}><Plus className="h-4 w-4" /> Nouvelle session</Button>}
      />

      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(subMonths(month, 1))} className="rounded-lg p-2 text-muted hover:bg-surface-2"><ChevronLeft className="h-5 w-5" /></button>
            <h2 className="min-w-[180px] text-center text-lg font-semibold capitalize text-fg">
              {format(month, 'MMMM yyyy', { locale: fr })}
            </h2>
            <button onClick={() => setMonth(addMonths(month, 1))} className="rounded-lg p-2 text-muted hover:bg-surface-2"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <Button variant="secondary" onClick={() => setMonth(new Date())}><CalendarDays className="h-4 w-4" /> Aujourd'hui</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-px border-b border-line pb-1 text-center text-xs font-semibold uppercase text-muted">
              {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-px bg-line">
              {days.map((day) => {
                const inMonth = isSameMonth(day, month);
                const today = isSameDay(day, new Date());
                const items = sessionsOfDay(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[104px] bg-surface p-1.5 ${inMonth ? '' : 'opacity-50'}`}
                    onDoubleClick={() => openNew(day)}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${today ? 'bg-brand-600 font-semibold text-white' : 'text-muted'}`}>
                        {format(day, 'd')}
                      </span>
                      <button onClick={() => openNew(day)} className="rounded p-0.5 text-muted opacity-0 hover:bg-surface-2 hover:text-brand-600 group-hover:opacity-100" title="Ajouter">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, 3).map((s) => (
                        <button
                          key={s.id} onClick={() => openEdit(s)}
                          className="block w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium text-white hover:opacity-90"
                          style={{ backgroundColor: s.couleur }}
                          title={s.titre}
                        >
                          {format(parseISO(s.date_debut), 'HH:mm')} {s.titre}
                        </button>
                      ))}
                      {items.length > 3 && <p className="px-1 text-[11px] text-muted">+{items.length - 3} autre(s)</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted">Astuce : double-cliquez sur un jour pour créer une session.</p>
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
