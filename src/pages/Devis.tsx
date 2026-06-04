import { useState } from 'react';
import { Plus, Trash2, Pencil, FileDown, Loader as Loader2, ReceiptText } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge, type Tone } from '@/components/ui';
import { FileLink } from '@/components/FileUpload';
import { formatDate, fullName, formatMoney } from '@/lib/utils';
import type { Devis, DevisLigne, DevisStatut, Contact, Entreprise, Financeur, Formation, Dossier } from '@/lib/database.types';

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
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');
  const formations = useCollection<Formation>('formations');
  const dossiers = useCollection<Dossier>('dossiers');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Devis | null>(null);
  const [form, setForm] = useState({
    contact_id: '', financeur_id: '', dossier_id: '',
    date_emission: new Date().toISOString().slice(0, 10), date_validite: plus30(),
    objet: '', conditions: 'Règlement à 30 jours. Acompte de 30 % à la commande.', statut: 'brouillon' as DevisStatut,
  });
  const [lines, setLines] = useState<Ligne[]>([emptyLigne()]);
  const [saving, setSaving] = useState(false);
  const [genId, setGenId] = useState<string | null>(null);

  const setF = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const cName = (id: string | null) => { const c = contacts.data.find((x) => x.id === id); return c ? fullName(c.prenom, c.nom) : '—'; };
  const totalHT = lines.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0);

  const openNew = () => {
    setEditing(null);
    setForm({ contact_id: '', financeur_id: '', dossier_id: '', date_emission: new Date().toISOString().slice(0, 10), date_validite: plus30(), objet: '', conditions: 'Règlement à 30 jours. Acompte de 30 % à la commande.', statut: 'brouillon' });
    setLines([emptyLigne()]);
    setOpen(true);
  };
  const openEdit = async (d: Devis) => {
    setEditing(d);
    setForm({ contact_id: d.contact_id ?? '', financeur_id: d.financeur_id ?? '', dossier_id: d.dossier_id ?? '', date_emission: d.date_emission, date_validite: d.date_validite ?? plus30(), objet: d.objet ?? '', conditions: d.conditions ?? '', statut: d.statut });
    const { data: lg } = await supabase.from('devis_lignes').select('*').eq('devis_id', d.id).order('ordre');
    setLines((lg ?? []).length ? (lg as DevisLigne[]).map((l) => ({ designation: l.designation, description: l.description ?? '', quantite: l.quantite, unite: l.unite, prix_unitaire_ht: l.prix_unitaire_ht })) : [emptyLigne()]);
    setOpen(true);
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
    const payload = {
      contact_id: form.contact_id || null, entreprise_id: contact?.entreprise_id ?? null,
      financeur_id: form.financeur_id || null, dossier_id: form.dossier_id || null,
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
      if (error) throw new Error((error as { message?: string }).message ?? 'Erreur');
      if ((res as { error?: string })?.error) throw new Error((res as { error?: string }).error);
      refresh();
      alert('PDF du devis généré.');
    } catch (err) {
      alert(`Génération indisponible : déployez l'Edge Function « generate-devis ». ${err instanceof Error ? err.message : ''}`);
    } finally {
      setGenId(null);
    }
  };

  const remove = async (d: Devis) => {
    if (!confirm(`Supprimer le devis ${d.numero} ?`)) return;
    const { error } = await supabase.from('devis').delete().eq('id', d.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  return (
    <div>
      <PageHeader title="Devis" subtitle="Devis Aissociate → Client (HT, norme française) — à transmettre au financeur" actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> Nouveau devis</Button>} />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : data.length === 0 ? (
        <EmptyState title="Aucun devis" message="Créez un devis à transmettre au client ou au financeur." />
      ) : (
        <Table head={
          <tr>
            <th className="px-4 py-3">Numéro</th><th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Total HT</th>
            <th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Actions</th>
          </tr>
        }>
          {data.map((d) => (
            <tr key={d.id} className="hover:bg-surface-2">
              <td className="px-4 py-3 font-medium text-fg">{d.numero}</td>
              <td className="px-4 py-3 text-muted">{cName(d.contact_id)}</td>
              <td className="px-4 py-3 text-muted">{formatDate(d.date_emission)}</td>
              <td className="px-4 py-3 text-right text-fg">{formatMoney(d.total_ht)}</td>
              <td className="px-4 py-3"><Badge tone={STATUT_TONES[d.statut]}>{STATUT_LABELS[d.statut]}</Badge></td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  {d.fichier_url && <FileLink bucket="devis" value={d.fichier_url} />}
                  <button onClick={() => generate(d.id)} disabled={genId === d.id} title="Générer le PDF" className="rounded p-1.5 text-muted hover:text-brand-600">{genId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}</button>
                  <button onClick={() => openEdit(d)} className="rounded p-1.5 text-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(d)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} wide
        title={editing ? `Devis ${editing.numero}` : 'Nouveau devis'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="secondary" onClick={save} disabled={saving || !form.contact_id}>Enregistrer</Button>
            <Button onClick={saveAndGenerate} disabled={saving || !form.contact_id}><FileDown className="h-4 w-4" /> Enregistrer + PDF</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client (contact)" required>
              <select className="input" value={form.contact_id} onChange={(e) => setF('contact_id', e.target.value)}>
                <option value="">— Sélectionner —</option>
                {contacts.data.map((c) => <option key={c.id} value={c.id}>{fullName(c.prenom, c.nom)}{c.email ? ` · ${c.email}` : ''}</option>)}
              </select>
            </Field>
            <Field label="Financeur (éventuel)">
              <select className="input" value={form.financeur_id} onChange={(e) => setF('financeur_id', e.target.value)}>
                <option value="">— Aucun —</option>
                {financeurs.data.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            </Field>
            <Field label="Dossier lié (éventuel)">
              <select className="input" value={form.dossier_id} onChange={(e) => setF('dossier_id', e.target.value)}>
                <option value="">—</option>
                {dossiers.data.map((d) => <option key={d.id} value={d.id}>{d.reference} — {d.intitule}</option>)}
              </select>
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
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 items-start gap-2">
                  <div className="col-span-5">
                    <input className="input" placeholder="Désignation" value={l.designation} onChange={(e) => setLigne(i, 'designation', e.target.value)} />
                    <input className="input mt-1 text-xs" placeholder="Description (optionnel)" value={l.description} onChange={(e) => setLigne(i, 'description', e.target.value)} />
                  </div>
                  <input className="input col-span-1" type="number" placeholder="Qté" value={l.quantite} onChange={(e) => setLigne(i, 'quantite', e.target.value)} />
                  <select className="input col-span-2" value={l.unite} onChange={(e) => setLigne(i, 'unite', e.target.value)}>
                    {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input className="input col-span-2" type="number" placeholder="PU HT" value={l.prix_unitaire_ht} onChange={(e) => setLigne(i, 'prix_unitaire_ht', e.target.value)} />
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
