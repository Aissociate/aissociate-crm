import { useMemo, useState } from 'react';
import {
  Users, TrendingUp, FolderKanban, Euro, ListTodo, FolderArchive,
  Plus, Trash2, UserRound, AlarmClock,
} from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, Card, Spinner, Badge, Button, Modal, Field, StatCard, EmptyState } from '@/components/ui';
import { FileUpload, FileLink } from '@/components/FileUpload';
import { OPP_STAGE_LABELS, OPP_STAGE_ORDER } from '@/lib/constants';
import { fullName, initials, formatMoney, formatDate } from '@/lib/utils';
import type { Profile, Contact, Opportunite, Dossier, ContactAction, ConseillerDocument } from '@/lib/database.types';

const TODAY = new Date().toISOString().slice(0, 10);

export default function Conseillers() {
  const { session } = useAuth();
  const profiles = useCollection<Profile>('profiles', { orderBy: { column: 'nom' } });
  const contacts = useCollection<Contact>('contacts');
  const opps = useCollection<Opportunite>('opportunites');
  const dossiers = useCollection<Dossier>('dossiers');
  const actions = useCollection<ContactAction>('contact_actions');
  const coffre = useCollection<ConseillerDocument>('conseiller_documents', { orderBy: { column: 'created_at', ascending: false } });

  const [selId, setSelId] = useState<string | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState<{ titre: string; categorie: string; fichier_url: string }>({ titre: '', categorie: '', fichier_url: '' });
  const [saving, setSaving] = useState(false);

  const conseillers = useMemo(
    () => profiles.data.filter((p) => p.role === 'conseiller' && p.approved),
    [profiles.data],
  );

  // Statistiques par conseiller (un contact « affecté » = propriétaire ou responsable).
  const statsOf = (uid: string) => {
    const assigned = contacts.data.filter((c) => c.owner_id === uid || c.responsable_id === uid);
    const prospects = assigned.filter((c) => c.type === 'prospect');
    const nonTraites = prospects.filter((c) => !(c.statut_prospect ?? '').trim()).length;
    const ids = new Set(assigned.map((c) => c.id));
    const acts = actions.data.filter((a) => ids.has(a.contact_id));
    const aRelancer = acts.filter((a) => !a.faite && a.date_action <= TODAY).length;
    const aFaire = acts.filter((a) => !a.faite).length;
    const faites = acts.filter((a) => a.faite).length;
    const o = opps.data.filter((x) => x.owner_id === uid);
    const gagne = o.filter((x) => x.stage === 'gagne').length;
    const perdu = o.filter((x) => x.stage === 'perdu').length;
    const taux = o.length ? Math.round((gagne / o.length) * 100) : 0;
    const ds = dossiers.data.filter((d) => d.owner_id === uid);
    const demande = ds.reduce((s, d) => s + Number(d.montant_demande ?? 0), 0);
    const accorde = ds.reduce((s, d) => s + Number(d.montant_accorde ?? 0), 0);
    const docs = coffre.data.filter((cd) => cd.conseiller_id === uid).length;
    return {
      prospects: prospects.length, assigned: assigned.length, nonTraites, aRelancer, aFaire, faites,
      opps: o.length, gagne, perdu, taux, dossiers: ds.length, demande, accorde, docs,
    };
  };

  const loading = profiles.loading || contacts.loading || opps.loading || dossiers.loading;
  const selected = conseillers.find((c) => c.id === selId) ?? conseillers[0] ?? null;
  const s = selected ? statsOf(selected.id) : null;
  const selDocs = selected ? coffre.data.filter((cd) => cd.conseiller_id === selected.id) : [];

  const addDoc = async () => {
    if (!selected || !docForm.titre || !docForm.fichier_url) return;
    setSaving(true);
    const { error } = await supabase.from('conseiller_documents').insert({
      conseiller_id: selected.id, titre: docForm.titre,
      categorie: docForm.categorie || null, fichier_url: docForm.fichier_url,
      created_by: session?.user.id ?? null,
    });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setDocOpen(false); setDocForm({ titre: '', categorie: '', fichier_url: '' });
    coffre.refresh();
  };

  const removeDoc = async (d: ConseillerDocument) => {
    if (!confirm(`Retirer « ${d.titre} » du coffre ?`)) return;
    const { error } = await supabase.from('conseiller_documents').delete().eq('id', d.id);
    if (error) { alert(error.message); return; }
    coffre.refresh();
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <PageHeader title="Conseillers" subtitle="Affectations, coffre-fort personnel et stats individuelles" />

      {conseillers.length === 0 ? (
        <EmptyState title="Aucun conseiller" message="Les comptes au rôle « Conseiller » (approuvés) apparaîtront ici." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
          {/* Liste des conseillers */}
          <div className="space-y-2">
            {conseillers.map((c) => {
              const st = statsOf(c.id);
              const active = selected?.id === c.id;
              return (
                <button key={c.id} onClick={() => setSelId(c.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-brand-500 bg-brand-500/5' : 'border-line bg-surface hover:bg-surface-2'}`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-600 dark:text-brand-400">{initials(c.nom, c.prenom)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{fullName(c.prenom, c.nom)}</p>
                      <p className="truncate text-xs text-muted">{st.prospects} prospect(s) · {st.dossiers} dossier(s)</p>
                    </div>
                    {st.aRelancer > 0 && <Badge tone="warning">{st.aRelancer} à relancer</Badge>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Détail du conseiller sélectionné */}
          {selected && s && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500/15 text-sm font-semibold text-brand-600 dark:text-brand-400">{initials(selected.nom, selected.prenom)}</span>
                <div>
                  <h2 className="text-lg font-semibold text-fg">{fullName(selected.prenom, selected.nom)}</h2>
                  <p className="text-xs text-muted">{selected.email}</p>
                </div>
              </div>

              {/* Prospects & affectations */}
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg"><UserRound className="h-4 w-4 text-brand-500" /> Prospects & affectations</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCard label="Prospects affectés" value={s.prospects} icon={<Users className="h-5 w-5" />} />
                  <StatCard label="Contacts affectés" value={s.assigned} />
                  <StatCard label="Non traités" value={s.nonTraites} hint="sans statut prospect" />
                  <StatCard label="À relancer" value={s.aRelancer} icon={<AlarmClock className="h-5 w-5" />} hint="actions en retard" />
                </div>
              </div>

              {/* Pipeline & conversion */}
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg"><TrendingUp className="h-4 w-4 text-brand-500" /> Pipeline & conversion</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCard label="Opportunités" value={s.opps} />
                  <StatCard label="Gagnées" value={s.gagne} />
                  <StatCard label="Perdues" value={s.perdu} />
                  <StatCard label="Taux de conversion" value={`${s.taux}%`} />
                </div>
                <Card className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    {OPP_STAGE_ORDER.map((st) => {
                      const n = opps.data.filter((o) => o.owner_id === selected.id && o.stage === st).length;
                      return <Badge key={st} tone={st === 'gagne' ? 'success' : st === 'perdu' ? 'danger' : 'neutral'}>{OPP_STAGE_LABELS[st]} : {n}</Badge>;
                    })}
                  </div>
                </Card>
              </div>

              {/* Dossiers & montants */}
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg"><FolderKanban className="h-4 w-4 text-brand-500" /> Dossiers & montants</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatCard label="Dossiers" value={s.dossiers} icon={<FolderKanban className="h-5 w-5" />} />
                  <StatCard label="Financements demandés" value={formatMoney(s.demande)} icon={<Euro className="h-5 w-5" />} />
                  <StatCard label="Financements accordés" value={formatMoney(s.accorde)} icon={<Euro className="h-5 w-5" />} />
                </div>
              </div>

              {/* Activité & documents */}
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg"><ListTodo className="h-4 w-4 text-brand-500" /> Activité & documents</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatCard label="Actions à faire" value={s.aFaire} />
                  <StatCard label="Actions réalisées" value={s.faites} />
                  <StatCard label="Documents au coffre" value={s.docs} icon={<FolderArchive className="h-5 w-5" />} />
                </div>
              </div>

              {/* Coffre-fort personnel */}
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <p className="flex items-center gap-2 text-sm font-semibold text-fg"><FolderArchive className="h-4 w-4 text-brand-500" /> Coffre-fort de {fullName(selected.prenom, selected.nom)}</p>
                  <Button onClick={() => { setDocForm({ titre: '', categorie: '', fichier_url: '' }); setDocOpen(true); }}><Plus className="h-4 w-4" /> Déposer un document</Button>
                </div>
                {selDocs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">Aucun document. Déposez ici les ressources destinées à ce conseiller (scripts, grilles, modèles…).</p>
                ) : (
                  <div className="divide-y divide-line">
                    {selDocs.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-fg">{d.titre}</p>
                          <p className="text-xs text-muted">{d.categorie ? `${d.categorie} · ` : ''}{formatDate(d.created_at)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <FileLink bucket="conseiller_coffre" value={d.fichier_url} />
                          <button onClick={() => removeDoc(d)} className="rounded p-1.5 text-muted hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      <Modal open={docOpen} onClose={() => setDocOpen(false)} title="Déposer un document au coffre"
        footer={<><Button variant="secondary" onClick={() => setDocOpen(false)}>Annuler</Button><Button onClick={addDoc} disabled={saving || !docForm.titre || !docForm.fichier_url}>{saving ? 'Enregistrement…' : 'Déposer'}</Button></>}>
        <div className="space-y-4">
          <Field label="Titre" required><input className="input" value={docForm.titre} onChange={(e) => setDocForm((f) => ({ ...f, titre: e.target.value }))} /></Field>
          <Field label="Catégorie"><input className="input" placeholder="ex. Script, Grille tarifaire, Modèle…" value={docForm.categorie} onChange={(e) => setDocForm((f) => ({ ...f, categorie: e.target.value }))} /></Field>
          <Field label="Fichier" required>
            <div className="flex items-center gap-3">
              <FileUpload bucket="conseiller_coffre" onUploaded={(v) => setDocForm((f) => ({ ...f, fichier_url: v }))} />
              {docForm.fichier_url && <FileLink bucket="conseiller_coffre" value={docForm.fichier_url} onClear={() => setDocForm((f) => ({ ...f, fichier_url: '' }))} />}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
