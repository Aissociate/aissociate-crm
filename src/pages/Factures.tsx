import { useState } from 'react';
import { Plus, Trash2, Pencil, FileDown, Loader as Loader2, ReceiptText, Landmark, CheckCircle2 } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState, Badge, SearchSelect, StatCard, type Tone } from '@/components/ui';
import { FileLink } from '@/components/FileUpload';
import { formatDate, fullName, formatMoney } from '@/lib/utils';
import type { Facture, FactureLigne, FactureStatut, Devis, DevisLigne, Contact, Entreprise, Financeur, Formation, Dossier, Profile } from '@/lib/database.types';

const STATUT_LABELS: Record<FactureStatut, string> = { brouillon: 'Brouillon', envoyee: 'Envoyée', payee: 'Payée', annulee: 'Annulée' };
const STATUT_TONES: Record<FactureStatut, Tone> = { brouillon: 'neutral', envoyee: 'info', payee: 'success', annulee: 'danger' };
const UNITES = ['heure', 'jour', 'forfait', 'session', 'participant'];

type Ligne = { designation: string; description: string; quantite: number | string; unite: string; prix_unitaire_ht: number | string };
const emptyLigne = (): Ligne => ({ designation: '', description: '', quantite: 1, unite: 'heure', prix_unitaire_ht: 0 });

function plus30(): string {
  const d = new Date(); d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function Factures() {
  const { session, isManager } = useAuth();
  const { data, loading, refresh } = useCollection<Facture>('factures', { orderBy: { column: 'created_at', ascending: false } });
  const contacts = useCollection<Contact>('contacts');
  const entreprises = useCollection<Entreprise>('entreprises');
  const financeurs = useCollection<Financeur>('financeurs');
  const formations = useCollection<Formation>('formations');
  const dossiers = useCollection<Dossier>('dossiers');
  const devisCol = useCollection<Devis>('devis', { orderBy: { column: 'created_at', ascending: false } });
  const profiles = useCollection<Profile>('profiles');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Facture | null>(null);
  const [form, setForm] = useState({
    contact_id: '', financeur_id: '', dossier_id: '', formation_id: '', devis_id: '',
    date_emission: new Date().toISOString().slice(0, 10), date_echeance: plus30(),
    objet: '', conditions: 'Règlement à 30 jours par virement bancaire.', statut: 'brouillon' as FactureStatut,
  });
  const [lines, setLines] = useState<Ligne[]>([emptyLigne()]);
  const [saving, setSaving] = useState(false);
  const [genId, setGenId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const setF = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const cName = (id: string | null) => { const c = contacts.data.find((x) => x.id === id); return c ? fullName(c.prenom, c.nom) : '—'; };
  const eName = (id: string | null) => entreprises.data.find((x) => x.id === id)?.raison_sociale ?? null;
  const uName = (id: string | null) => { const p = profiles.data.find((x) => x.id === id); return p ? fullName(p.prenom, p.nom) : '—'; };
  const totalHT = lines.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire_ht) || 0), 0);

  const enAttente = data.filter((f) => f.statut === 'envoyee');
  const echues = enAttente.filter((f) => f.date_echeance && f.date_echeance < new Date().toISOString().slice(0, 10));

  const openNew = () => {
    setEditing(null);
    setForm({ contact_id: '', financeur_id: '', dossier_id: '', formation_id: '', devis_id: '', date_emission: new Date().toISOString().slice(0, 10), date_echeance: plus30(), objet: '', conditions: 'Règlement à 30 jours par virement bancaire.', statut: 'brouillon' });
    setLines([emptyLigne()]);
    setOpen(true);
  };

  // Pré-remplit la facture depuis un devis (client, objet, lignes).
  const depuisDevis = async (devisId: string) => {
    const d = devisCol.data.find((x) => x.id === devisId);
    if (!d) return;
    setF('devis_id', devisId);
    setF('contact_id', d.contact_id ?? '');
    setF('financeur_id', d.financeur_id ?? '');
    setF('dossier_id', d.dossier_id ?? '');
    setF('objet', d.objet ?? '');
    const { data: lg } = await supabase.from('devis_lignes').select('*').eq('devis_id', devisId).order('ordre');
    if (lg?.length) setLines((lg as DevisLigne[]).map((l) => ({ designation: l.designation, description: l.description ?? '', quantite: l.quantite, unite: l.unite, prix_unitaire_ht: l.prix_unitaire_ht })));
  };

  const openEdit = async (f: Facture) => {
    setEditing(f);
    setForm({ contact_id: f.contact_id ?? '', financeur_id: f.financeur_id ?? '', dossier_id: f.dossier_id ?? '', formation_id: f.formation_id ?? '', devis_id: f.devis_id ?? '', date_emission: f.date_emission, date_echeance: f.date_echeance ?? plus30(), objet: f.objet ?? '', conditions: f.conditions ?? '', statut: f.statut });
    const { data: lg } = await supabase.from('facture_lignes').select('*').eq('facture_id', f.id).order('ordre');
    setLines((lg ?? []).length ? (lg as FactureLigne[]).map((l) => ({ designation: l.designation, description: l.description ?? '', quantite: l.quantite, unite: l.unite, prix_unitaire_ht: l.prix_unitaire_ht })) : [emptyLigne()]);
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
      devis_id: form.devis_id || null,
      contact_id: form.contact_id || null, entreprise_id: contact?.entreprise_id ?? null,
      financeur_id: form.financeur_id || null, dossier_id: form.dossier_id || null,
      formation_id: form.formation_id || null,
      date_emission: form.date_emission, date_echeance: form.date_echeance || null,
      objet: form.objet || null, conditions: form.conditions || null, statut: form.statut,
      tva_exoneree: true, tva_taux: 0, total_ht: totalHT, total_tva: 0, total_ttc: totalHT,
      owner_id: session?.user.id ?? null,
    };
    let factureId = editing?.id ?? null;
    if (factureId) {
      const { error } = await supabase.from('factures').update(payload).eq('id', factureId);
      if (error) { setSaving(false); alert(error.message); return null; }
      await supabase.from('facture_lignes').delete().eq('facture_id', factureId);
    } else {
      const { data: ins, error } = await supabase.from('factures').insert(payload).select('id').single();
      if (error || !ins) { setSaving(false); alert(error?.message ?? 'Erreur'); return null; }
      factureId = ins.id;
    }
    const rows = lines.filter((l) => l.designation.trim()).map((l, i) => ({
      facture_id: factureId, designation: l.designation.trim(), description: l.description || null,
      quantite: Number(l.quantite) || 1, unite: l.unite || 'heure', prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0, ordre: i,
    }));
    if (rows.length) await supabase.from('facture_lignes').insert(rows);
    setSaving(false);
    setOpen(false);
    refresh();
    return factureId;
  };

  const saveAndGenerate = async () => {
    const id = await save();
    if (id) await generate(id);
  };

  const generate = async (id: string) => {
    setGenId(id);
    try {
      const { data: res, error } = await supabase.functions.invoke('generate-facture', { body: { factureId: id } });
      if (error) throw new Error(await functionErrorMessage(error));
      if ((res as { error?: string })?.error) throw new Error((res as { error?: string }).error);
      refresh();
    } catch (err) {
      alert(`Génération indisponible : déployez l'Edge Function « generate-facture ». ${err instanceof Error ? err.message : ''}`);
    } finally {
      setGenId(null);
    }
  };

  const marquerPayee = async (f: Facture) => {
    if (!confirm(`Marquer la facture ${f.numero} comme payée ?`)) return;
    const { error } = await supabase.from('factures').update({
      statut: 'payee', date_reglement: new Date().toISOString().slice(0, 10),
      mode_reglement: f.mode_reglement ?? 'virement',
    }).eq('id', f.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  const syncQonto = async () => {
    setSyncing(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('qonto-sync', { body: {} });
      if (error) throw new Error(await functionErrorMessage(error));
      const r = res as { rapprochees?: number; skipped?: string; a_verifier?: unknown[]; error?: string };
      if (r?.error) throw new Error(r.error);
      if (r?.skipped) alert(`Rapprochement non configuré : ${r.skipped}`);
      else alert(`${r?.rapprochees ?? 0} facture(s) rapprochée(s) avec Qonto.${(r?.a_verifier?.length ?? 0) > 0 ? ` ${r!.a_verifier!.length} paiement(s) au même montant sans référence : à vérifier manuellement.` : ''}`);
      refresh();
    } catch (err) {
      alert(`Rapprochement Qonto indisponible : ${err instanceof Error ? err.message : ''}`);
    } finally {
      setSyncing(false);
    }
  };

  const remove = async (f: Facture) => {
    if (!confirm(`Supprimer la facture ${f.numero} ? (numérotation : préférez « Annulée » pour une facture émise)`)) return;
    const { error } = await supabase.from('factures').delete().eq('id', f.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Factures"
        subtitle="Facturation client (HT, norme française) — rapprochement bancaire Qonto"
        actions={
          <>
            {isManager && (
              <Button variant="secondary" onClick={syncQonto} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />} Rapprocher Qonto
              </Button>
            )}
            <Button onClick={openNew}><Plus className="h-4 w-4" /> Nouvelle facture</Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="En attente de règlement" value={formatMoney(enAttente.reduce((s, f) => s + (f.total_ttc || 0), 0))} hint={`${enAttente.length} facture(s)`} />
        <StatCard label="Échues" value={formatMoney(echues.reduce((s, f) => s + (f.total_ttc || 0), 0))} hint={`${echues.length} facture(s) en retard`} />
        <StatCard label="Encaissé (année en cours)" value={formatMoney(data.filter((f) => f.statut === 'payee' && (f.date_reglement ?? '').startsWith(String(new Date().getFullYear()))).reduce((s, f) => s + (f.total_ttc || 0), 0))} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : data.length === 0 ? (
        <EmptyState title="Aucune facture" message="Créez une facture, ou générez-la depuis un devis accepté." />
      ) : (
        <Table head={
          <tr>
            <th className="px-4 py-3">Numéro</th><th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Émission</th><th className="px-4 py-3">Échéance</th>
            <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Statut</th>
            <th className="px-4 py-3">Règlement</th><th className="px-4 py-3 text-right">Actions</th>
          </tr>
        }>
          {data.map((f) => {
            const enRetard = f.statut === 'envoyee' && f.date_echeance && f.date_echeance < new Date().toISOString().slice(0, 10);
            return (
              <tr key={f.id} className="hover:bg-surface-2">
                <td className="px-4 py-3 font-medium text-fg">{f.numero}</td>
                <td className="px-4 py-3 text-muted">{eName(f.entreprise_id) ?? cName(f.contact_id)}</td>
                <td className="px-4 py-3 text-muted">{formatDate(f.date_emission)}</td>
                <td className={`px-4 py-3 ${enRetard ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted'}`}>{formatDate(f.date_echeance)}</td>
                <td className="px-4 py-3 text-right text-fg">{formatMoney(f.total_ttc)}</td>
                <td className="px-4 py-3"><Badge tone={enRetard ? 'danger' : STATUT_TONES[f.statut]}>{enRetard ? 'Échue' : STATUT_LABELS[f.statut]}</Badge></td>
                <td className="px-4 py-3 text-muted">
                  {f.statut === 'payee'
                    ? <span title={f.qonto_transaction_id ? `Rapprochée Qonto (${f.qonto_transaction_id})` : undefined}>{formatDate(f.date_reglement)}{f.qonto_transaction_id ? ' · Qonto' : ''}</span>
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {f.fichier_url && <FileLink bucket="factures" value={f.fichier_url} />}
                    <button onClick={() => generate(f.id)} disabled={genId === f.id} title="Générer le PDF" className="rounded p-1.5 text-muted hover:text-brand-600">{genId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}</button>
                    {f.statut === 'envoyee' && (
                      <button onClick={() => marquerPayee(f)} title="Marquer payée" className="rounded p-1.5 text-muted hover:text-emerald-600"><CheckCircle2 className="h-4 w-4" /></button>
                    )}
                    <button onClick={() => openEdit(f)} className="rounded p-1.5 text-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(f)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} wide
        title={editing ? `Facture ${editing.numero}` : 'Nouvelle facture'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="secondary" onClick={save} disabled={saving || !form.contact_id}>Enregistrer</Button>
            <Button onClick={saveAndGenerate} disabled={saving || !form.contact_id}><FileDown className="h-4 w-4" /> Enregistrer + PDF</Button>
          </>
        }
      >
        <div className="space-y-4">
          {!editing && (
            <Field label="Créer depuis un devis" hint="Reprend client, objet et prestations du devis">
              <SearchSelect
                value={form.devis_id}
                onChange={(v) => { if (v) void depuisDevis(v); else setF('devis_id', ''); }}
                options={devisCol.data.filter((d) => d.statut === 'accepte' || d.statut === 'envoye').map((d) => ({ value: d.id, label: `${d.numero} — ${formatMoney(d.total_ht)}`, sub: d.objet ?? cName(d.contact_id) }))}
                placeholder="Rechercher un devis…" emptyLabel="— Facture libre —"
              />
            </Field>
          )}
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
            <Field label="Dossier lié">
              <SearchSelect
                value={form.dossier_id}
                onChange={(v) => setF('dossier_id', v)}
                options={dossiers.data.map((d) => ({ value: d.id, label: `${d.reference} — ${d.intitule}` }))}
                placeholder="Rechercher un dossier…" emptyLabel="— Aucun —"
              />
            </Field>
            <Field label="Formation concernée">
              <SearchSelect
                value={form.formation_id}
                onChange={(v) => setF('formation_id', v)}
                options={formations.data.map((f) => ({ value: f.id, label: f.intitule }))}
                placeholder="Rechercher une formation…" emptyLabel="— Aucune —"
              />
            </Field>
            <Field label="Statut">
              <select className="input" value={form.statut} onChange={(e) => setF('statut', e.target.value as FactureStatut)}>
                {(Object.keys(STATUT_LABELS) as FactureStatut[]).map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
              </select>
            </Field>
            <Field label="Date d'émission"><input className="input" type="date" value={form.date_emission} onChange={(e) => setF('date_emission', e.target.value)} /></Field>
            <Field label="Échéance de règlement"><input className="input" type="date" value={form.date_echeance} onChange={(e) => setF('date_echeance', e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Objet"><input className="input" value={form.objet} onChange={(e) => setF('objet', e.target.value)} placeholder="ex. Formation Intégrer l'IA dans votre entreprise — session de mars" /></Field></div>
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
              <span className="font-semibold text-fg">Net à payer : {formatMoney(totalHT)}</span>
            </div>
          </div>

          <Field label="Conditions de règlement"><textarea className="input" rows={2} value={form.conditions} onChange={(e) => setF('conditions', e.target.value)} /></Field>
          {editing?.owner_id && <p className="text-xs text-muted">Créée par {uName(editing.owner_id)}</p>}
          <p className="flex items-center gap-1.5 rounded-lg bg-surface-2 p-2 text-xs text-muted"><ReceiptText className="h-3.5 w-3.5" /> Le rapprochement Qonto marque automatiquement « Payée » toute facture dont le virement reçu porte le numéro et le montant exacts (secrets QONTO_LOGIN / QONTO_SECRET_KEY ou Paramètres, clé « qonto »).</p>
        </div>
      </Modal>
    </div>
  );
}
