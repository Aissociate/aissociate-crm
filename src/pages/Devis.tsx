import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, FileDown, Loader as Loader2, ReceiptText, Search, FolderKanban } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, SearchSelect, TONE_BADGE, type Tone } from '@/components/ui';
import { FileLink } from '@/components/FileUpload';
import AddToDossierButton from '@/components/AddToDossierButton';
import { cn, formatDate, fullName, formatMoney } from '@/lib/utils';
import { ensureDossierClient } from '@/lib/dossierClient';
import type { Devis, DevisLigne, DevisStatut, Contact, Financeur, Formation, Dossier, Profile } from '@/lib/database.types';

const STATUT_LABELS: Record<DevisStatut, string> = { brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé', expire: 'Expiré' };
const STATUT_TONES: Record<DevisStatut, Tone> = {
  brouillon: 'neutral', envoye: 'info', accepte: 'success', refuse: 'danger', expire: 'warning',
};
const UNITES = ['heure', 'jour', 'forfait', 'session', 'participant'];

type Ligne = { designation: string; description: string; quantite: number | string; unite: string; prix_unitaire_ht: number | string };
const emptyLigne = (): Ligne => ({ designation: '', description: '', quantite: 1, unite: 'heure', prix_unitaire_ht: 0 });

function plus30(): string {
  const d = new Date(); d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function Devis() {
  const { session } = useAuth();
  const { data, loading, refresh } = useCollection<Devis>('devis', { orderBy: { column: 'created_at', ascending: false } });
  const contacts = useCollection<Contact>('contacts');
  const financeurs = useCollection<Financeur>('financeurs');
  const formations = useCollection<Formation>('formations');
  const dossiers = useCollection<Dossier>('dossiers');
  const profiles = useCollection<Profile>('profiles');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Devis | null>(null);
  const [form, setForm] = useState({
    contact_id: '', financeur_id: '', dossier_id: '', formation_id: '',
    date_emission: new Date().toISOString().slice(0, 10), date_validite: plus30(),
    objet: '', conditions: 'Règlement à 30 jours. Acompte de 30 % à la commande.', statut: 'brouillon' as DevisStatut,
  });
  const [lines, setLines] = useState<Ligne[]>([emptyLigne()]);
  const [saving, setSaving] = useState(false);
  const [genId, setGenId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statutFilter, setStatutFilter] = useState<DevisStatut | ''>('');

  const setF = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const cName = (id: string | null) => { const c = contacts.data.find((x) => x.id === id); return c ? fullName(c.prenom, c.nom) : '—'; };
  const uName = (id: string | null) => { const p = profiles.data.find((x) => x.id === id); return p ? fullName(p.prenom, p.nom) : '—'; };
  // Conseiller affecté = propriétaire du contact lié au devis.
  const conseillerName = (contactId: string | null) => { const c = contacts.data.find((x) => x.id === contactId); return c?.owner_id ? uName(c.owner_id) : '—'; };
  const totalHT = lines.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0);

  const openNew = () => {
    setEditing(null);
    setForm({ contact_id: '', financeur_id: '', dossier_id: '', formation_id: '', date_emission: new Date().toISOString().slice(0, 10), date_validite: plus30(), objet: '', conditions: 'Règlement à 30 jours. Acompte de 30 % à la commande.', statut: 'brouillon' });
    setLines([emptyLigne()]);
    setOpen(true);
  };
  const openEdit = async (d: Devis) => {
    setEditing(d);
    setForm({ contact_id: d.contact_id ?? '', financeur_id: d.financeur_id ?? '', dossier_id: d.dossier_id ?? '', formation_id: '', date_emission: d.date_emission, date_validite: d.date_validite ?? plus30(), objet: d.objet ?? '', conditions: d.conditions ?? '', statut: d.statut });
    const { data: lg } = await supabase.from('devis_lignes').select('*').eq('devis_id', d.id).order('ordre');
    setLines((lg ?? []).length ? (lg as DevisLigne[]).map((l) => ({ designation: l.designation, description: l.description ?? '', quantite: l.quantite, unite: l.unite, prix_unitaire_ht: l.prix_unitaire_ht })) : [emptyLigne()]);
    setOpen(true);
  };

  // Arrivée depuis un dossier ou une fiche : /devis?contact=…&dossier=… ouvre un
  // devis pré-rempli, /devis?ouvrir=… ouvre un devis existant.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const ouvrir = params.get('ouvrir');
    const contactId = params.get('contact');
    if (!ouvrir && !contactId) return;
    if (loading || contacts.loading || dossiers.loading) return;
    if (ouvrir) {
      const d = data.find((x) => x.id === ouvrir);
      if (d) void openEdit(d);
    } else if (contactId) {
      openNew();
      setForm((f) => ({ ...f, contact_id: contactId, dossier_id: params.get('dossier') ?? '' }));
    }
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, contacts.loading, dossiers.loading, params]);

  // Changer le statut depuis la liste : un devis envoyé puis accepté se note en un geste.
  const changerStatut = async (d: Devis, statut: DevisStatut) => {
    const { error } = await supabase.from('devis').update({ statut }).eq('id', d.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  const addLigne = () => setLines((l) => [...l, emptyLigne()]);
  const addFromFormation = (fid: string) => {
    const f = formations.data.find((x) => x.id === fid);
    if (!f) return;
    setLines((l) => [...l.filter((x) => x.designation || x.prix_unitaire_ht), { designation: f.intitule, description: f.objectifs ?? '', quantite: f.duree_heures || 1, unite: 'heure', prix_unitaire_ht: f.prix || 0 }]);
  };
  const setLigne = (i: number, k: keyof Ligne, v: unknown) => setLines((ls) => ls.map((l, j) => j === i ? { ...l, [k]: v } : l));
  const removeLigne = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));

  const save = async (): Promise<string | null> => {
    setSaving(true);
    const contact = contacts.data.find((c) => c.id === form.contact_id);
    // Création automatique du dossier client au nom du prospect (si non rattaché).
    let dossierId = form.dossier_id || null;
    if (!dossierId && form.contact_id) {
      const formation = formations.data.find((f) => f.id === form.formation_id);
      const dossier = await ensureDossierClient({
        contactId: form.contact_id, contactName: fullName(contact?.prenom, contact?.nom),
        formationId: form.formation_id || null, formationName: formation?.intitule ?? null,
        entrepriseId: contact?.entreprise_id ?? null, financeurId: form.financeur_id || null,
        ownerId: session?.user.id ?? null,
      });
      dossierId = dossier?.id ?? null;
    }
    const payload = {
      contact_id: form.contact_id || null, entreprise_id: contact?.entreprise_id ?? null,
      financeur_id: form.financeur_id || null, dossier_id: dossierId,
      date_emission: form.date_emission, date_validite: form.date_validite || null,
      objet: form.objet || null, conditions: form.conditions || null, statut: form.statut,
      tva_exoneree: true, tva_taux: 0, total_ht: totalHT, total_tva: 0, total_ttc: totalHT,
      owner_id: session?.user.id ?? null,
    };
    let devisId = editing?.id ?? null;
    if (devisId) {
      const { error } = await supabase.from('devis').update(payload).eq('id', devisId);
      if (error) { setSaving(false); alert(error.message); return null; }
      await supabase.from('devis_lignes').delete().eq('devis_id', devisId);
    } else {
      const { data: ins, error } = await supabase.from('devis').insert(payload).select('id').single();
      if (error || !ins) { setSaving(false); alert(error?.message ?? 'Erreur'); return null; }
      devisId = ins.id;
    }
    const rows = lines.filter((l) => l.designation.trim()).map((l, i) => ({
      devis_id: devisId, designation: l.designation.trim(), description: l.description || null,
      quantite: Number(l.quantite) || 1, unite: l.unite || 'heure', prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0, ordre: i,
    }));
    if (rows.length) await supabase.from('devis_lignes').insert(rows);
    setSaving(false);
    setOpen(false);
    refresh();
    return devisId;
  };

  const saveAndGenerate = async () => {
    const id = await save();
    if (id) await generate(id);
  };

  const generate = async (id: string) => {
    setGenId(id);
    try {
      const { data: res, error } = await supabase.functions.invoke('generate-devis', { body: { devisId: id } });
      if (error) throw new Error(await functionErrorMessage(error));
      if ((res as { error?: string })?.error) throw new Error((res as { error?: string }).error);
      refresh();
    } catch (err) {
      alert(`Le PDF n'a pas pu être généré. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setGenId(null);
    }
  };

  const remove = async (d: Devis) => {
    if (!confirm(`Supprimer le devis ${d.numero} ?`)) return;
    const { error } = await supabase.from('devis').delete().eq('id', d.id);
    if (error) { alert(error.message); return; }
    setOpen(false);
    refresh();
  };

  const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const cherches = data.filter((d) => !q.trim() || norm(`${d.numero} ${d.objet ?? ''} ${cName(d.contact_id)}`).includes(norm(q.trim())));
  const filtres = statutFilter ? cherches.filter((d) => d.statut === statutFilter) : cherches;
  const statutsPresents = (Object.keys(STATUT_LABELS) as DevisStatut[]).filter((s) => s === statutFilter || data.some((d) => d.statut === s));
  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="Devis" subtitle="Devis HT, à transmettre au client ou à son financeur" actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Nouveau devis</Button>} />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {[...statutsPresents.map((s) => ({ cle: s as DevisStatut | '', label: STATUT_LABELS[s], n: cherches.filter((d) => d.statut === s).length })), { cle: '' as DevisStatut | '', label: 'Tous', n: cherches.length }].map((p) => (
          <button key={p.cle || 'tous'} onClick={() => setStatutFilter(p.cle)} aria-pressed={statutFilter === p.cle}
            className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition',
              statutFilter === p.cle ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'border-line text-muted hover:bg-surface-2 hover:text-fg')}>
            {p.label} <span className="text-xs tabular-nums opacity-70">{p.n}</span>
          </button>
        ))}
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
        <input className="input pl-9" placeholder="Numéro, objet, client…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : filtres.length === 0 ? (
        <EmptyState
          title={data.length === 0 ? 'Aucun devis' : 'Aucun devis ne correspond'}
          message={data.length === 0 ? 'Créez un devis à transmettre au client ou au financeur.' : 'Changez de statut ou videz la recherche.'}
        />
      ) : (
        <Table head={
          <tr>
            <th className="px-4 py-3">Devis</th><th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Total HT</th>
            <th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">PDF et dossier</th>
          </tr>
        }>
          {filtres.map((d) => {
            const perime = d.statut === 'envoye' && !!d.date_validite && d.date_validite < aujourdhui;
            return (
            <tr key={d.id} className="cursor-pointer hover:bg-surface-2" onClick={() => void openEdit(d)} title="Ouvrir le devis">
              <td className="px-4 py-3">
                <span className="font-medium text-fg">{d.numero}</span>
                {d.objet && <span className="block max-w-[260px] truncate text-xs text-muted" title={d.objet}>{d.objet}</span>}
              </td>
              <td className="px-4 py-3">
                <span className="text-fg">{cName(d.contact_id)}</span>
                <span className="block text-xs text-muted" title={`Devis créé par ${uName(d.owner_id)}`}>Conseiller : {conseillerName(d.contact_id)}</span>
              </td>
              <td className="px-4 py-3 text-muted">
                {formatDate(d.date_emission)}
                {perime && <span className="block text-xs font-medium text-amber-600 dark:text-amber-400">validité dépassée le {formatDate(d.date_validite!)}</span>}
              </td>
              <td className="px-4 py-3 text-right font-medium text-fg">{formatMoney(d.total_ht)}</td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <select
                  className={cn('rounded-full border-0 px-2.5 py-1 text-xs font-medium', TONE_BADGE[STATUT_TONES[d.statut]])}
                  value={d.statut} onChange={(e) => void changerStatut(d, e.target.value as DevisStatut)} aria-label={`Statut du devis ${d.numero}`}
                >
                  {(Object.keys(STATUT_LABELS) as DevisStatut[]).map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
                </select>
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  {d.fichier_url && <FileLink bucket="devis" value={d.fichier_url} />}
                  <button onClick={() => generate(d.id)} disabled={genId === d.id} title={d.fichier_url ? 'Régénérer le PDF' : 'Générer le PDF'} className="rounded p-1.5 text-muted hover:text-brand-600">{genId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}</button>
                  <AddToDossierButton
                    contactId={d.contact_id} dossiers={dossiers.data} fichierUrl={d.fichier_url} sourceBucket="devis"
                    pieceLibelle="Devis signé" documentLabel="devis" onDone={() => { dossiers.refresh(); refresh(); }}
                    // Sans PDF généré, le bouton relie simplement le devis au dossier.
                    lierDossier={async (dos) => {
                      const { error } = await supabase.from('devis').update({ dossier_id: dos.id }).eq('id', d.id);
                      return error?.message ?? null;
                    }}
                  />
                  {d.dossier_id && (
                    <Link to={`/dossiers/${d.dossier_id}`} title="Ouvrir le dossier client" className="rounded p-1.5 text-muted hover:text-brand-600"><FolderKanban className="h-4 w-4" /></Link>
                  )}
                </div>
              </td>
            </tr>
            );
          })}
        </Table>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} wide
        title={editing ? `Devis ${editing.numero}` : 'Nouveau devis'}
        footer={
          <>
            {editing && <Button variant="danger" className="mr-auto" onClick={() => void remove(editing)}><Trash2 className="h-4 w-4" /> Supprimer</Button>}
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="secondary" onClick={save} disabled={saving || !form.contact_id}>Enregistrer</Button>
            <Button onClick={saveAndGenerate} disabled={saving || !form.contact_id}><FileDown className="h-4 w-4" /> Enregistrer + PDF</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client (contact)" required>
              <SearchSelect
                value={form.contact_id}
                onChange={(v) => setF('contact_id', v)}
                options={contacts.data.map((c) => ({ value: c.id, label: fullName(c.prenom, c.nom), sub: c.email ?? undefined }))}
                placeholder="Rechercher un contact (nom, e-mail)…"
              />
            </Field>
            <Field label="Financeur (éventuel)">
              <SearchSelect
                value={form.financeur_id}
                onChange={(v) => setF('financeur_id', v)}
                options={financeurs.data.map((f) => ({ value: f.id, label: f.nom }))}
                placeholder="Rechercher un financeur…" emptyLabel="— Aucun —"
              />
            </Field>
            <Field label="Dossier lié" hint="Laissez vide : le dossier du client est créé ou retrouvé tout seul">
              <SearchSelect
                value={form.dossier_id}
                onChange={(v) => setF('dossier_id', v)}
                options={dossiers.data.map((d) => ({ value: d.id, label: `${d.reference} — ${d.intitule}` }))}
                placeholder="Rechercher un dossier…" emptyLabel="— Automatique —"
              />
            </Field>
            <Field label="Formation concernée" hint="Sert à retrouver le bon dossier du client">
              <SearchSelect
                value={form.formation_id}
                onChange={(v) => setF('formation_id', v)}
                options={formations.data.map((f) => ({ value: f.id, label: f.intitule }))}
                placeholder="Rechercher une formation…" emptyLabel="— Aucune —" disabled={!!form.dossier_id}
              />
            </Field>
            <Field label="Statut">
              <select className="input" value={form.statut} onChange={(e) => setF('statut', e.target.value as DevisStatut)}>
                {(Object.keys(STATUT_LABELS) as DevisStatut[]).map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Date d'émission"><input className="input" type="date" value={form.date_emission} onChange={(e) => setF('date_emission', e.target.value)} /></Field>
            <Field label="Validité"><input className="input" type="date" value={form.date_validite} onChange={(e) => setF('date_validite', e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Objet"><input className="input" value={form.objet} onChange={(e) => setF('objet', e.target.value)} placeholder="ex. Formation Intégrer l'IA dans votre entreprise" /></Field></div>
          </div>

          {/* Lignes */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg">Prestations (HT)</p>
              <div className="flex items-center gap-2">
                <select className="input py-1 text-sm" value="" onChange={(e) => { if (e.target.value) addFromFormation(e.target.value); e.target.value = ''; }}>
                  <option value="">+ depuis le catalogue…</option>
                  {formations.data.map((f) => <option key={f.id} value={f.id}>{f.intitule}</option>)}
                </select>
                <Button variant="secondary" onClick={addLigne}><Plus className="h-4 w-4" /> Ligne</Button>
              </div>
            </div>
            <div className="space-y-2">
              {/* En-têtes de colonnes : une fois les champs remplis, leurs indications
                  disparaissent ; sans titre, la quantité passait inaperçue. */}
              <div className="grid grid-cols-12 gap-2 px-0.5 text-xs font-medium text-muted">
                <span className="col-span-4">Désignation</span>
                <span className="col-span-2">Quantité</span>
                <span className="col-span-2">Unité</span>
                <span className="col-span-2">Prix unitaire HT</span>
                <span className="col-span-2 pr-7 text-right">Montant HT</span>
              </div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 items-start gap-2">
                  <div className="col-span-4">
                    <input className="input" placeholder="Désignation" value={l.designation} onChange={(e) => setLigne(i, 'designation', e.target.value)} />
                    <input className="input mt-1 text-xs" placeholder="Description (optionnel)" value={l.description} onChange={(e) => setLigne(i, 'description', e.target.value)} />
                  </div>
                  <input className="input col-span-2" type="number" min={0} step="any" placeholder="Qté" aria-label="Quantité" value={l.quantite} onChange={(e) => setLigne(i, 'quantite', e.target.value)} />
                  <select className="input col-span-2" aria-label="Unité" value={l.unite} onChange={(e) => setLigne(i, 'unite', e.target.value)}>
                    {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input className="input col-span-2" type="number" step="any" placeholder="PU HT" aria-label="Prix unitaire HT" value={l.prix_unitaire_ht} onChange={(e) => setLigne(i, 'prix_unitaire_ht', e.target.value)} />
                  <div className="col-span-2 flex items-center gap-1 pt-2">
                    <span className="flex-1 text-right text-sm text-fg">{formatMoney((Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0))}</span>
                    <button onClick={() => removeLigne(i)} className="rounded p-1 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-6 border-t border-line pt-3 text-sm">
              <span className="text-muted">TVA non applicable (art. 261-4-4° du CGI)</span>
              <span className="font-semibold text-fg">Total HT : {formatMoney(totalHT)}</span>
            </div>
          </div>

          <Field label="Conditions de règlement"><textarea className="input" rows={2} value={form.conditions} onChange={(e) => setF('conditions', e.target.value)} /></Field>
          <p className="flex items-center gap-1.5 rounded-lg bg-surface-2 p-2 text-xs text-muted"><ReceiptText className="h-3.5 w-3.5" /> Renseignez SIRET, n° de déclaration d'activité et coordonnées de l'organisme dans <strong>Paramètres › Organisme</strong> : ils figurent sur le PDF.</p>
        </div>
      </Modal>
    </div>
  );
}
