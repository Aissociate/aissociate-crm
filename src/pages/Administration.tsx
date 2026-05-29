import { useState } from 'react';
import { Users, Building, ScrollText, Plus, Pencil, Trash2 } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card, Spinner, Badge, Table, Button, Modal, Field } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/constants';
import { formatDate, fullName, initials } from '@/lib/utils';
import type { Profile, UserRole, Financeur, FinancementType, AuditLog } from '@/lib/database.types';

const ROLES: UserRole[] = ['admin', 'directeur_commercial', 'conseiller'];
const FIN_TYPES: FinancementType[] = [
  'cpf', 'opco', 'france_travail', 'pole_emploi', 'conseil_regional',
  'transition_pro', 'agefice', 'entreprise', 'particulier', 'autre',
];

type Tab = 'users' | 'financeurs' | 'audit';

export default function Administration() {
  const [tab, setTab] = useState<Tab>('users');
  const profiles = useCollection<Profile>('profiles', { orderBy: { column: 'created_at' } });
  const financeurs = useCollection<Financeur>('financeurs', { orderBy: { column: 'code' } });
  const audit = useCollection<AuditLog>('audit_log', { orderBy: { column: 'created_at', ascending: false } });

  const [finOpen, setFinOpen] = useState(false);
  const [finForm, setFinForm] = useState<Partial<Financeur>>({});
  const setF = (k: keyof Financeur, v: unknown) => setFinForm((f) => ({ ...f, [k]: v }));

  const changeRole = async (p: Profile, role: UserRole) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id);
    if (error) { alert(error.message); return; }
    profiles.refresh();
  };
  const toggleActif = async (p: Profile) => {
    const { error } = await supabase.from('profiles').update({ actif: !p.actif }).eq('id', p.id);
    if (error) { alert(error.message); return; }
    profiles.refresh();
  };

  const saveFin = async () => {
    const payload = { ...finForm, actif: finForm.actif ?? true };
    const { error } = finForm.id
      ? await supabase.from('financeurs').update(payload).eq('id', finForm.id)
      : await supabase.from('financeurs').insert(payload);
    if (error) { alert(error.message); return; }
    setFinOpen(false);
    financeurs.refresh();
  };
  const removeFin = async (f: Financeur) => {
    if (!confirm(`Supprimer le financeur ${f.nom} ?`)) return;
    const { error } = await supabase.from('financeurs').delete().eq('id', f.id);
    if (error) { alert(error.message); return; }
    financeurs.refresh();
  };

  const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'users', label: 'Utilisateurs & droits', icon: Users },
    { key: 'financeurs', label: 'Financeurs', icon: Building },
    { key: 'audit', label: 'Journal d\'audit', icon: ScrollText },
  ];

  return (
    <div>
      <PageHeader title="Administration" subtitle="Gestion des utilisateurs, financeurs et traçabilité (4.9)" />

      <div className="mb-5 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-muted hover:text-fg'}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        profiles.loading ? <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div> : (
          <Table head={
            <tr>
              <th className="px-4 py-3">Utilisateur</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Inscrit le</th>
            </tr>
          }>
            {profiles.data.map((p) => (
              <tr key={p.id} className="hover:bg-surface-2">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{initials(p.nom, p.prenom)}</span>
                    <div>
                      <p className="font-medium text-fg">{fullName(p.prenom, p.nom)}</p>
                      <p className="text-xs text-muted">{p.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select className="input max-w-[200px]" value={p.role} onChange={(e) => changeRole(p, e.target.value as UserRole)}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActif(p)}>
                    <Badge className={p.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>{p.actif ? 'Actif' : 'Désactivé'}</Badge>
                  </button>
                </td>
                <td className="px-4 py-3 text-muted">{formatDate(p.created_at)}</td>
              </tr>
            ))}
          </Table>
        )
      )}

      {tab === 'financeurs' && (
        <div>
          <div className="mb-3 flex justify-end">
            <Button onClick={() => { setFinForm({ actif: true, type: 'autre' }); setFinOpen(true); }}><Plus className="h-4 w-4" /> Nouveau financeur</Button>
          </div>
          {financeurs.loading ? <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div> : (
            <Table head={
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Spécificités</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            }>
              {financeurs.data.map((f) => (
                <tr key={f.id} className="hover:bg-surface-2">
                  <td className="px-4 py-3"><Badge className="bg-brand-50 text-brand-700">{f.code}</Badge></td>
                  <td className="px-4 py-3 font-medium text-fg">{f.nom}</td>
                  <td className="px-4 py-3 text-xs text-muted">{f.specificites}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setFinForm(f); setFinOpen(true); }} className="rounded p-1.5 text-muted hover:text-brand-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => removeFin(f)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      )}

      {tab === 'audit' && (
        audit.loading ? <div className="flex justify-center py-16"><Spinner className="h-7 w-7" /></div> :
        audit.data.length === 0 ? (
          <Card><p className="py-6 text-center text-sm text-muted">Aucune entrée d'audit. Les actions tracées via <code>log_audit()</code> apparaîtront ici.</p></Card>
        ) : (
          <Table head={<tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Entité</th></tr>}>
            {audit.data.map((a) => (
              <tr key={a.id} className="hover:bg-surface-2">
                <td className="px-4 py-3 text-muted">{formatDate(a.created_at, 'dd/MM/yyyy HH:mm')}</td>
                <td className="px-4 py-3 font-medium text-fg">{a.action}</td>
                <td className="px-4 py-3 text-muted">{a.entite}</td>
              </tr>
            ))}
          </Table>
        )
      )}

      <Modal open={finOpen} onClose={() => setFinOpen(false)} title={finForm.id ? 'Modifier le financeur' : 'Nouveau financeur'}
        footer={<><Button variant="secondary" onClick={() => setFinOpen(false)}>Annuler</Button><Button onClick={saveFin} disabled={!finForm.code || !finForm.nom}>Enregistrer</Button></>}>
        <div className="space-y-4">
          <Field label="Code" required><input className="input" value={finForm.code ?? ''} onChange={(e) => setF('code', e.target.value)} /></Field>
          <Field label="Nom" required><input className="input" value={finForm.nom ?? ''} onChange={(e) => setF('nom', e.target.value)} /></Field>
          <Field label="Type"><select className="input" value={finForm.type ?? 'autre'} onChange={(e) => setF('type', e.target.value as FinancementType)}>
            {FIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></Field>
          <Field label="Spécificités"><textarea className="input" rows={3} value={finForm.specificites ?? ''} onChange={(e) => setF('specificites', e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
