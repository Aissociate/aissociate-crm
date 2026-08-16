import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Building2, Search } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PageHeader, Button, Modal, Field, Table, Spinner, EmptyState } from '@/components/ui';
import type { Entreprise } from '@/lib/database.types';

const STATUTS_JURIDIQUES = ['', 'EI', 'EURL', 'SARL', 'SASU', 'SAS', 'SA', 'SCI', 'Association', 'Autre'];

const empty = (): Partial<Entreprise> => ({
  raison_sociale: '', siret: '', naf: '', secteur: '', statut_juridique: '', effectif: null,
  adresse: '', code_postal: '', ville: '', telephone: '', email: '', site_web: '', notes: '',
});

export default function Entreprises() {
  const { session } = useAuth();
  const { data, loading, refresh } = useCollection<Entreprise>('entreprises', {
    orderBy: { column: 'raison_sociale' },
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Entreprise>>(empty());
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Ouverture directe d'une entreprise via ?open=<id> (lien depuis la fiche contact).
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || loading) return;
    const ent = data.find((e) => e.id === openId);
    if (ent) { setForm(ent); setOpen(true); }
    searchParams.delete('open');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, data, loading, setSearchParams]);

  const set = (k: keyof Entreprise, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const payload = {
      ...form,
      effectif: form.effectif ? Number(form.effectif) : null,
      owner_id: form.owner_id ?? session?.user.id,
    };
    const { error } = form.id
      ? await supabase.from('entreprises').update(payload).eq('id', form.id)
      : await supabase.from('entreprises').insert(payload);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setOpen(false);
    refresh();
  };

  const remove = async (e: Entreprise) => {
    if (!confirm(`Supprimer ${e.raison_sociale} ?`)) return;
    const { error } = await supabase.from('entreprises').delete().eq('id', e.id);
    if (error) { alert(error.message); return; }
    refresh();
  };

  const filtered = data.filter((e) =>
    `${e.raison_sociale} ${e.ville} ${e.siret}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Entreprises"
        subtitle="Clients et structures partenaires"
        actions={<Button onClick={() => { setForm(empty()); setOpen(true); }}><Plus className="h-4 w-4" /> Nouvelle entreprise</Button>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
        <input className="input pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucune entreprise" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((e) => (
            <div key={e.id} className="card flex flex-col p-5">
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-brand-500/10 p-2 text-brand-600 dark:text-brand-400"><Building2 className="h-5 w-5" /></div>
                  <div>
                    <p className="font-semibold text-fg">{e.raison_sociale}</p>
                    <p className="text-xs text-muted">{e.ville || '—'}{e.secteur ? ` · ${e.secteur}` : ''}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setForm(e); setOpen(true); }} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(e)} className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <dl className="mt-2 space-y-1 text-sm text-muted">
                {e.siret && <div>SIRET : <span className="text-fg">{e.siret}</span></div>}
                {e.email && <div>{e.email}</div>}
                {e.telephone && <div>{e.telephone}</div>}
                {e.effectif != null && <div>{e.effectif} salariés</div>}
              </dl>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)} wide
        title={form.id ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || !form.raison_sociale}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field label="Raison sociale" required><input className="input" value={form.raison_sociale ?? ''} onChange={(e) => set('raison_sociale', e.target.value)} /></Field></div>
          <Field label="SIRET">
            <div className="flex gap-2">
              <input className="input" value={form.siret ?? ''} onChange={(e) => set('siret', e.target.value)} />
              <button
                type="button"
                disabled={!form.siret}
                title="Ouvrir la fiche Pappers (recherche sur le SIREN, 9 premiers chiffres)"
                // Pappers ne trouve rien sur les 14 chiffres du SIRET : la recherche
                // se fait sur le SIREN, c'est-à-dire les 9 premiers chiffres.
                onClick={() => {
                  const siren = (form.siret ?? '').replace(/\D/g, '').slice(0, 9);
                  if (siren) window.open(`https://www.pappers.fr/recherche?q=${encodeURIComponent(siren)}`, '_blank', 'noopener');
                }}
                className="btn-secondary shrink-0 whitespace-nowrap disabled:opacity-50"
              >Pappers</button>
            </div>
          </Field>
          {/* NAF et IDCC (convention collective) : deux codes courts, côte à côte
              dans l'emplacement occupé jusque-là par le seul code NAF. */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code NAF"><input className="input" maxLength={6} value={form.naf ?? ''} onChange={(e) => set('naf', e.target.value)} /></Field>
            <Field label="IDCC"><input className="input" maxLength={5} placeholder="ex. 1486" value={form.idcc ?? ''} onChange={(e) => set('idcc', e.target.value)} /></Field>
          </div>
          <Field label="Secteur d'activité"><input className="input" value={form.secteur ?? ''} onChange={(e) => set('secteur', e.target.value)} /></Field>
          <Field label="Statut juridique">
            <select className="input" value={form.statut_juridique ?? ''} onChange={(e) => set('statut_juridique', e.target.value)}>
              {STATUTS_JURIDIQUES.map((s) => <option key={s} value={s}>{s || 'Non défini'}</option>)}
            </select>
          </Field>
          <Field label="Effectif"><input className="input" type="number" value={form.effectif ?? ''} onChange={(e) => set('effectif', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Adresse"><input className="input" value={form.adresse ?? ''} onChange={(e) => set('adresse', e.target.value)} /></Field></div>
          <Field label="Code postal"><input className="input" value={form.code_postal ?? ''} onChange={(e) => set('code_postal', e.target.value)} /></Field>
          <Field label="Ville"><input className="input" value={form.ville ?? ''} onChange={(e) => set('ville', e.target.value)} /></Field>
          <Field label="Téléphone"><input className="input" value={form.telephone ?? ''} onChange={(e) => set('telephone', e.target.value)} /></Field>
          <Field label="E-mail"><input className="input" type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Site web"><input className="input" value={form.site_web ?? ''} onChange={(e) => set('site_web', e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field></div>
        </div>
      </Modal>
    </div>
  );
}
