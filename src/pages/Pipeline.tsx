import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Phone } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Spinner } from '@/components/ui';
import ContactFiche from '@/components/ContactFiche';
import { OPP_STAGE_LABELS, OPP_STAGE_ORDER } from '@/lib/constants';
import { formatMoney, fullName } from '@/lib/utils';
import type { Opportunite, OpportuniteStage, Contact, ContactAction, Entreprise, Financeur, Profile } from '@/lib/database.types';

const empty = (): Partial<Opportunite> => ({
  titre: '', montant: 0, stage: 'nouveau', probabilite: 10,
  contact_id: null, entreprise_id: null, financeur_id: null, notes: '',
});

// ── Colonnes « stand-by » ────────────────────────────────────────────────────
// Une opportunité est en stand-by quand le contact lié n'a aucune action à faire
// dans les 30 (ou 90) prochains jours : rien n'est prévu pour la faire avancer.
// La colonne est CALCULÉE à chaque affichage, jamais stockée : elle reflète donc
// en permanence l'état réel des actions, sans traitement de fond à synchroniser.
type Colonne = OpportuniteStage | 'standby30' | 'standby90';
const STANDBY_LABELS: Record<'standby30' | 'standby90', string> = {
  standby30: 'Stand-by > 30 J', standby90: 'Stand-by > 90 J',
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dansNJours = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

export default function Pipeline() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { data, loading, refresh } = useCollection<Opportunite>('opportunites', {
    orderBy: { column: 'created_at', ascending: false },
  });
  const contacts = useCollection<Contact>('contacts');
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');
  const profiles = useCollection<Profile>('profiles');
  const actions = useCollection<ContactAction>('contact_actions');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Opportunite>>(empty());
  const [saving, setSaving] = useState(false);
  const [ficheContact, setFicheContact] = useState<Contact | null>(null);
  const set = (k: keyof Opportunite, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const openFiche = (contactId: string | null) => {
    const c = contactId ? contacts.data.find((x) => x.id === contactId) : null;
    if (c) setFicheContact(c);
  };

  // ── Filtre par conseiller ───────────────────────────────────────────────────
  // Le conseiller d'une opportunité est celui affecté au contact lié (c'est lui
  // qui suit le client) ; à défaut, le propriétaire de l'opportunité.
  const [conseillerId, setConseillerId] = useState('');
  const conseillerDe = (o: Opportunite): string | null => {
    const contact = o.contact_id ? contacts.data.find((x) => x.id === o.contact_id) : null;
    return contact?.responsable_id ?? contact?.owner_id ?? o.owner_id ?? null;
  };
  const nomConseiller = (id: string | null) => {
    const p = id ? profiles.data.find((x) => x.id === id) : null;
    return p ? fullName(p.prenom, p.nom) : '';
  };
  const visibles = conseillerId
    ? data.filter((o) => (conseillerId === 'aucun' ? !conseillerDe(o) : conseillerDe(o) === conseillerId))
    : data;

  // ── Stand-by : dérivé des actions à faire du contact ────────────────────────
  /** Date de la prochaine action non réalisée du contact, ou null. */
  const prochaineAction = (contactId: string | null): string | null => {
    if (!contactId) return null;
    const futures = actions.data
      .filter((a) => a.contact_id === contactId && !a.faite && a.date_action >= ymd(new Date()))
      .map((a) => a.date_action)
      .sort();
    return futures[0] ?? null;
  };
  /** Colonne d'affichage. Une carte posée à la main (colonne_manuelle) reste où
   *  l'utilisateur l'a mise ; le calcul stand-by automatique ne s'applique
   *  qu'aux cartes jamais déplacées. */
  const colonneDe = (o: Opportunite): Colonne => {
    if (o.colonne_manuelle) return o.colonne_manuelle as Colonne;
    if (o.stage === 'gagne' || o.stage === 'perdu') return o.stage;
    const prochaine = prochaineAction(o.contact_id);
    if (!prochaine || prochaine > dansNJours(90)) return 'standby90';
    if (prochaine > dansNJours(30)) return 'standby30';
    return o.stage;
  };
  /** Cartes d'une colonne, dans l'ordre manuel (les non-placées en fin, plus récentes d'abord). */
  const itemsDe = (c: Colonne): Opportunite[] =>
    visibles
      .filter((o) => colonneDe(o) === c)
      .sort((a, b) =>
        (a.position ?? Number.POSITIVE_INFINITY) - (b.position ?? Number.POSITIVE_INFINITY) ||
        (a.created_at < b.created_at ? 1 : -1));
  // Stand-by intercalé avant gagné / perdu : ce sont des affaires encore ouvertes.
  const COLONNES: Colonne[] = [
    ...OPP_STAGE_ORDER.filter((s) => s !== 'gagne' && s !== 'perdu'),
    'standby30', 'standby90', 'gagne', 'perdu',
  ];
  const libelleColonne = (c: Colonne) =>
    c === 'standby30' || c === 'standby90' ? STANDBY_LABELS[c] : OPP_STAGE_LABELS[c];

  const save = async () => {
    setSaving(true);
    const payload = {
      ...form,
      montant: Number(form.montant ?? 0),
      probabilite: Number(form.probabilite ?? 0),
      owner_id: form.owner_id ?? session?.user.id,
    };
    // Étape changée dans le formulaire : épingler la carte sur cette étape,
    // sinon un éventuel épinglage stand-by la maintiendrait dans l'ancienne colonne.
    const original = form.id ? data.find((x) => x.id === form.id) : null;
    if (original && form.stage && form.stage !== original.stage) {
      payload.colonne_manuelle = form.stage;
      payload.position = null;
    }
    const { error } = form.id
      ? await supabase.from('opportunites').update(payload).eq('id', form.id)
      : await supabase.from('opportunites').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    refresh();
  };

  /** Flèches ← → : étape précédente/suivante, carte épinglée en fin de colonne. */
  const move = async (o: Opportunite, dir: -1 | 1) => {
    const next = OPP_STAGE_ORDER[OPP_STAGE_ORDER.indexOf(o.stage) + dir];
    if (!next) return;
    const { error } = await supabase.from('opportunites')
      .update({ stage: next, colonne_manuelle: next, position: null }).eq('id', o.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  // ── Glisser-déposer ─────────────────────────────────────────────────────────
  // Sans restriction : toute carte peut être déposée sur n'importe quelle
  // colonne — y compris Stand-by > 30/90 J — et à n'importe quelle position
  // entre deux cartes (un trait d'insertion suit le curseur). Le dépôt épingle
  // la carte (colonne_manuelle) : elle reste où on l'a mise, le calcul
  // stand-by automatique ne la reclasse plus. La RLS de `opportunites` fait foi
  // sur qui peut modifier quoi.
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ col: Colonne; index: number } | null>(null);
  const estEtape = (c: Colonne): c is OpportuniteStage => c !== 'standby30' && c !== 'standby90';
  const setOverAt = (col: Colonne, index: number) =>
    setOver((p) => (p && p.col === col && p.index === index ? p : { col, index }));

  const onDrop = async (col: Colonne, index: number) => {
    const o = dragId ? data.find((x) => x.id === dragId) : null;
    setDragId(null); setOver(null);
    if (!o) return;
    // Liste d'arrivée sans la carte déplacée ; si elle venait de cette colonne
    // depuis une position antérieure, l'index visé recule d'un cran.
    const avant = itemsDe(col);
    const idxOrigine = avant.findIndex((x) => x.id === o.id);
    const dest = avant.filter((x) => x.id !== o.id);
    const cible = Math.max(0, Math.min(idxOrigine !== -1 && idxOrigine < index ? index - 1 : index, dest.length));
    dest.splice(cible, 0, o);
    // Réindexation compacte de la colonne d'arrivée (colonnes courtes : quelques
    // écritures) ; seule la carte déplacée change d'étape/épinglage.
    const updates = dest
      .map((x, i) => ({ x, i }))
      .filter(({ x, i }) => x.id === o.id || x.position !== i)
      .map(({ x, i }) => {
        const patch: Partial<Opportunite> = { position: i };
        if (x.id === o.id) {
          patch.colonne_manuelle = col;
          if (estEtape(col)) patch.stage = col; // en stand-by, l'étape réelle est conservée
        }
        return supabase.from('opportunites').update(patch).eq('id', x.id);
      });
    const results = await Promise.all(updates);
    const err = results.find((r) => r.error)?.error;
    if (err) alert(err.message);
    refresh();
  };

  const remove = async (o: Opportunite) => {
    if (!confirm(`Supprimer l'opportunité « ${o.titre} » ?`)) return;
    const { error } = await supabase.from('opportunites').delete().eq('id', o.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Pipeline commercial"
        subtitle="Suivi des opportunités de la qualification à la signature (4.1) — glissez une carte où vous voulez, y compris en stand-by et entre deux cartes"
        actions={
          <div className="flex items-center gap-2">
            <select
              className="input max-w-[15rem] py-1.5 text-sm" value={conseillerId}
              onChange={(e) => setConseillerId(e.target.value)}
              title="Filtrer les opportunités par conseiller affecté au contact"
            >
              <option value="">Tous les conseillers</option>
              {profiles.data.map((p) => <option key={p.id} value={p.id}>{fullName(p.prenom, p.nom)}</option>)}
              <option value="aucun">— Non affecté —</option>
            </select>
            <Button onClick={() => { setForm(empty()); setOpen(true); }}><Plus className="h-4 w-4" /> Nouvelle opportunité</Button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : (
        <div className="scroll-x flex gap-2.5 overflow-x-auto pb-3">
          {COLONNES.map((stage) => {
            const items = itemsDe(stage);
            const total = items.reduce((s, o) => s + Number(o.montant ?? 0), 0);
            const standby = stage === 'standby30' || stage === 'standby90';
            const cible = !!dragId && over?.col === stage;
            return (
              <div
                key={stage}
                className="flex w-60 shrink-0 flex-col"
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault(); // sans quoi le dépôt est refusé par le navigateur
                  e.dataTransfer.dropEffect = 'move';
                  // Survol du fond de colonne (hors carte) : insertion en fin.
                  setOverAt(stage, items.length);
                }}
                onDragLeave={(e) => {
                  // Ignorer les sorties vers un enfant de la colonne.
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setOver((p) => (p?.col === stage ? null : p));
                }}
                onDrop={(e) => { e.preventDefault(); void onDrop(stage, over?.col === stage ? over.index : items.length); }}
              >
                {/* En-tête sur une seule ligne : étape, effectif, montant */}
                <div className="mb-1.5 flex items-baseline gap-1.5 px-1">
                  <span className={`truncate text-sm font-semibold ${standby ? 'text-red-600 dark:text-red-400' : 'text-fg'}`}>{libelleColonne(stage)}</span>
                  <span className="rounded-full bg-surface-2 px-1.5 text-[11px] leading-4 text-muted">{items.length}</span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">{formatMoney(total)}</span>
                </div>
                {/* Une seule classe de fond : deux `bg-*` concurrentes se départagent
                    par l'ordre du CSS généré, pas par l'ordre d'écriture. */}
                <div className={`flex-1 space-y-1.5 rounded-xl p-1.5 transition-colors ${cible ? 'bg-brand-500/10 ring-2 ring-brand-500' : 'bg-surface-2'}`}>
                  {items.map((o, pos) => {
                    const idx = OPP_STAGE_ORDER.indexOf(o.stage);
                    const traitAvant = cible && over?.index === pos && dragId !== o.id;
                    const contact = o.contact_id ? contacts.data.find((x) => x.id === o.contact_id) : null;
                    const entreprise = entreprises.data.find((x) => x.id === (o.entreprise_id ?? contact?.entreprise_id));
                    const title = contact ? fullName(contact.prenom, contact.nom) : o.titre;
                    // Sous-titre : société et conseiller sur une seule ligne. Le
                    // conseiller est redondant quand la vue est déjà filtrée sur lui.
                    const sousTitre = [
                      entreprise?.raison_sociale,
                      conseillerId ? null : (nomConseiller(conseillerDe(o)) || 'Non affecté'),
                    ].filter(Boolean).join(' · ');
                    return (
                      <div key={o.id}>
                      {/* Trait d'insertion : la carte lâchée prendra cette place. */}
                      {traitAvant && <div className="mb-1.5 h-0.5 rounded-full bg-brand-500" />}
                      <div
                        onClick={() => openFiche(o.contact_id)}
                        draggable
                        onDragStart={(e) => {
                          setDragId(o.id);
                          e.dataTransfer.effectAllowed = 'move';
                          // Firefox n'amorce pas le glisser sans données transportées.
                          e.dataTransfer.setData('text/plain', o.id);
                        }}
                        onDragEnd={() => { setDragId(null); setOver(null); }}
                        onDragOver={(e) => {
                          if (!dragId) return;
                          e.preventDefault();
                          e.stopPropagation(); // sinon la colonne force l'insertion en fin
                          e.dataTransfer.dropEffect = 'move';
                          // Moitié haute : insérer avant cette carte ; basse : après.
                          const r = e.currentTarget.getBoundingClientRect();
                          setOverAt(stage, e.clientY < r.top + r.height / 2 ? pos : pos + 1);
                        }}
                        className={`group card cursor-grab px-2.5 py-2 active:cursor-grabbing ${o.contact_id ? 'hover:border-brand-300' : ''} ${dragId === o.id ? 'opacity-40' : ''}`}
                        title={o.contact_id ? 'Ouvrir la fiche client' : undefined}
                      >
                        {/* Ligne 1 : qui, et combien */}
                        <div className="flex items-baseline gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{title}</p>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400">{formatMoney(Number(o.montant))}</span>
                        </div>
                        {/* Ligne 2 : société · conseiller */}
                        {sousTitre && <p className="truncate text-xs text-muted" title={sousTitre}>{sousTitre}</p>}
                        {/* Ligne 3 : intitulé de l'affaire (le titre de la carte est le contact) */}
                        {contact && o.titre && <p className="truncate text-xs text-muted/80">{o.titre}</p>}
                        {/* En stand-by, la carte rappelle l'étape réelle de l'opportunité. */}
                        {standby && <p className="truncate text-xs font-medium text-red-600 dark:text-red-400">{OPP_STAGE_LABELS[o.stage]} · aucune action prévue</p>}

                        {/* Probabilité : jauge fine plutôt qu'une ligne de texte */}
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line" title={`${o.probabilite} % de probabilité`}>
                            <div className="h-full rounded-full bg-brand-500/70" style={{ width: `${Math.min(100, Math.max(0, Number(o.probabilite) || 0))}%` }} />
                          </div>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted">{o.probabilite} %</span>
                        </div>

                        {/* Barre d'outils : discrète au repos, visible au survol ou au
                            focus clavier. Toujours visible sur écran tactile (pas de survol). */}
                        <div
                          className="mt-1 flex items-center justify-between opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-0.5">
                            <button disabled={idx === 0} onClick={() => move(o, -1)} title="Étape précédente" aria-label="Déplacer l'opportunité à l'étape précédente" className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                            <button disabled={idx === OPP_STAGE_ORDER.length - 1} onClick={() => move(o, 1)} title="Étape suivante" aria-label="Déplacer l'opportunité à l'étape suivante" className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {contact?.telephone && (
                              <a href={`tel:${contact.telephone}`} title={`Appeler ${contact.telephone}`} aria-label={`Appeler ${contact.telephone}`} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-brand-600"><Phone className="h-3.5 w-3.5" /></a>
                            )}
                            <button onClick={() => { setForm(o); setOpen(true); }} title="Modifier" aria-label="Modifier l'opportunité" className="rounded p-1 text-muted hover:text-brand-600"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => remove(o)} title="Supprimer" aria-label="Supprimer l'opportunité" className="rounded p-1 text-muted hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                      </div>
                    );
                  })}
                  {/* Trait d'insertion en fin de colonne */}
                  {cible && over?.index === items.length && items.length > 0 && (
                    <div className="h-0.5 rounded-full bg-brand-500" />
                  )}
                  {items.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted">
                      {cible ? 'Déposer ici' : '—'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)}
        title={form.id ? 'Modifier l\'opportunité' : 'Nouvelle opportunité'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.titre}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="Titre" required><input className="input" value={form.titre ?? ''} onChange={(e) => set('titre', e.target.value)} /></Field></div>
          <Field label="Montant (€)"><input className="input" type="number" value={form.montant ?? 0} onChange={(e) => set('montant', e.target.value)} /></Field>
          <Field label="Probabilité (%)"><input className="input" type="number" min={0} max={100} value={form.probabilite ?? 0} onChange={(e) => set('probabilite', e.target.value)} /></Field>
          <Field label="Étape"><select className="input" value={form.stage} onChange={(e) => set('stage', e.target.value as OpportuniteStage)}>
            {OPP_STAGE_ORDER.map((s) => <option key={s} value={s}>{OPP_STAGE_LABELS[s]}</option>)}
          </select></Field>
          <Field label="Clôture prévue"><input className="input" type="date" value={form.date_cloture_prev ?? ''} onChange={(e) => set('date_cloture_prev', e.target.value || null)} /></Field>
          <Field label="Contact"><select className="input" value={form.contact_id ?? ''} onChange={(e) => set('contact_id', e.target.value || null)}>
            <option value="">—</option>
            {contacts.data.map((c) => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
          </select></Field>
          <Field label="Entreprise"><select className="input" value={form.entreprise_id ?? ''} onChange={(e) => set('entreprise_id', e.target.value || null)}>
            <option value="">—</option>
            {entreprises.data.map((e) => <option key={e.id} value={e.id}>{e.raison_sociale}</option>)}
          </select></Field>
          <Field label="Financeur"><select className="input" value={form.financeur_id ?? ''} onChange={(e) => set('financeur_id', e.target.value || null)}>
            <option value="">—</option>
            {financeurs.data.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select></Field>
          <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field></div>
        </div>
      </Modal>

      {ficheContact && (
        <ContactFiche
          key={ficheContact.id}
          contact={contacts.data.find((x) => x.id === ficheContact.id) ?? ficheContact}
          entreprises={entreprises.data}
          financeurs={financeurs.data}
          profiles={profiles.data}
          onClose={() => setFicheContact(null)}
          onEdit={() => { setFicheContact(null); navigate('/contacts'); }}
          onUpdated={() => contacts.refresh()}
        />
      )}
    </div>
  );
}
