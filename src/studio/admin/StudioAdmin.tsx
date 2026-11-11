// Page CRM « Studio IA » (managers) : espaces clients, accès, catalogue d'agents.
// Lectures/écritures via la RLS is_manager() ; les mots de passe passent par
// l'Edge Function `studio` (hash côté serveur, jamais lisible depuis le CRM).
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Bot, Building2, ShieldCheck, Copy, ExternalLink, KeyRound, Plus, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { ModeleSelect, type ModeleOR } from './ModeleSelect';
import HarnessPanel from './HarnessPanel';
import ConnecteursEspace from './ConnecteursEspace';
import SavoirsAgent from './SavoirsAgent';

// Tables studio_* absentes des types générés du CRM (module isolé) : client non typé.
const db = supabase as unknown as SupabaseClient;

type Workspace = {
  id: string; nom: string; entreprise_id: string | null; offre: string; secteur: string | null; taille: string | null;
  max_utilisateurs: number; actif: boolean; quota_messages_mois: number | null; contexte_entreprise: string;
  quota_images_mois: number | null; quota_videos_mois: number | null;
  expire_le: string | null; created_at: string; modele: string | null;
};
type StudioUser = { id: string; workspace_id: string; email: string; prenom: string | null; nom: string | null; role: string; actif: boolean; last_login_at: string | null };
type AgentCat = {
  id: string; prenom: string; metier: string; accroche: string; description: string; prompt_systeme: string;
  demandes: { titre: string; prompt: string }[]; super_pouvoirs: unknown[]; minutes_par_tache: number; couleur: string; offres: string[]; ordre: number; actif: boolean; modele: string | null; photo: string | null;
};
/** Catalogue OpenRouter + modèle par défaut global (parametres.ai). */
type Catalogue = { modeles: ModeleOR[]; defaut: string; chargement: boolean };
type Usage = { workspace_id: string; demandes: number; reponses: number; derniere_activite: string };

const OFFRES = [['essentiel', 'Essentiel'], ['pro', 'Pro'], ['sur_mesure', 'Sur mesure']] as const;
const TAILLES = ['1', '2-4', '5-9', '10-49', '50+'];

function motDePasseProvisoire(): string {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const d = '23456789';
  const r = crypto.getRandomValues(new Uint32Array(12));
  const base = [...r].map((x, i) => (i % 4 === 3 ? d : a)[x % (i % 4 === 3 ? d.length : a.length)]).join('');
  return base;
}

async function adminStudio<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('studio', { body });
  if (error) throw new Error(await functionErrorMessage(error));
  return data as T;
}

export default function StudioAdmin() {
  const [onglet, setOnglet] = useState<'espaces' | 'agents' | 'harness'>('espaces');
  const [espaces, setEspaces] = useState<Workspace[] | null>(null);
  const [users, setUsers] = useState<StudioUser[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [agents, setAgents] = useState<AgentCat[]>([]);
  const [entreprises, setEntreprises] = useState<{ id: string; raison_sociale: string }[]>([]);
  const [ouvert, setOuvert] = useState<Workspace | 'nouveau' | null>(null);
  const [agentEdite, setAgentEdite] = useState<AgentCat | null>(null);
  const [erreur, setErreur] = useState('');
  const [catalogue, setCatalogue] = useState<Catalogue>({ modeles: [], defaut: '', chargement: true });

  // Catalogue OpenRouter chargé une fois (via la fonction `studio`, avec la clé du CRM).
  useEffect(() => {
    adminStudio<{ modeles: ModeleOR[]; defaut: string }>({ action: 'admin_modeles' })
      .then((r) => setCatalogue({ modeles: r.modeles, defaut: r.defaut, chargement: false }))
      .catch((e) => { setCatalogue((c) => ({ ...c, chargement: false })); setErreur(`Modèles OpenRouter : ${e.message}`); });
  }, []);

  const charger = useCallback(async () => {
    const [w, u, us, ag, en] = await Promise.all([
      db.from('studio_workspaces').select('*').order('created_at', { ascending: false }),
      db.from('studio_users').select('id, workspace_id, email, prenom, nom, role, actif, last_login_at').order('created_at'),
      db.from('studio_usage_mois').select('*'),
      db.from('studio_agents').select('*').order('ordre'),
      db.from('entreprises').select('id, raison_sociale').order('raison_sociale').limit(2000),
    ]);
    const e = w.error ?? u.error ?? ag.error;
    if (e) setErreur(e.message.includes('studio_') ? `${e.message} — migration Studio IA non appliquée ?` : e.message);
    setEspaces((w.data ?? []) as Workspace[]); setUsers((u.data ?? []) as StudioUser[]);
    setUsage((us.data ?? []) as Usage[]); setAgents((ag.data ?? []) as AgentCat[]);
    setEntreprises((en.data ?? []) as { id: string; raison_sociale: string }[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const lienStudio = `${window.location.origin}/studio`;

  return (
    <div>
      <PageHeader
        title="Studio IA"
        subtitle="Espaces agentiques des entreprises clientes : accès, offre, usage et catalogue d'agents."
        actions={<>
          <a href="/studio" target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-1.5"><ExternalLink className="h-4 w-4" /> Ouvrir le Studio</a>
          {onglet === 'espaces' && <Button onClick={() => setOuvert('nouveau')}><Plus className="mr-1 inline h-4 w-4" />Nouvel espace</Button>}
        </>}
      />
      <div className="mb-5 flex gap-2">
        <button onClick={() => setOnglet('espaces')} className={onglet === 'espaces' ? 'btn-primary' : 'btn-secondary'}><Building2 className="mr-1 inline h-4 w-4" />Espaces clients</button>
        <button onClick={() => setOnglet('agents')} className={onglet === 'agents' ? 'btn-primary' : 'btn-secondary'}><Bot className="mr-1 inline h-4 w-4" />Catalogue d'agents</button>
        <button onClick={() => setOnglet('harness')} className={onglet === 'harness' ? 'btn-primary' : 'btn-secondary'}><ShieldCheck className="mr-1 inline h-4 w-4" />Harness général</button>
      </div>
      {erreur && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{erreur}</p>}

      {onglet === 'espaces' && (espaces === null ? <Spinner /> : espaces.length === 0 ? (
        <EmptyState title="Aucun espace client" message="Créez un espace pour une entreprise qui souscrit à l'offre agents IA, puis ajoutez ses accès." />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-muted">
              <tr><th className="px-4 py-3">Espace</th><th>Offre</th><th>Accès</th><th>Missions ce mois</th><th>Dernière activité</th><th>Échéance</th><th /></tr>
            </thead>
            <tbody>
              {espaces.map((w) => {
                const u = usage.find((x) => x.workspace_id === w.id);
                const nb = users.filter((x) => x.workspace_id === w.id).length;
                return (
                  <tr key={w.id} className="cursor-pointer border-b border-line/60 hover:bg-surface-2" onClick={() => setOuvert(w)}>
                    <td className="px-4 py-3 font-medium text-fg">{w.nom}{!w.actif && <Badge tone="danger" className="ml-2">inactif</Badge>}</td>
                    <td>{OFFRES.find(([k]) => k === w.offre)?.[1]}</td>
                    <td>{nb} / {w.max_utilisateurs}</td>
                    <td>{u?.demandes ?? 0}{w.quota_messages_mois ? ` / ${w.quota_messages_mois}` : ''}</td>
                    <td>{u?.derniere_activite ? new Date(u.derniere_activite).toLocaleDateString('fr-FR') : '—'}</td>
                    <td>{w.expire_le ? new Date(w.expire_le).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="pr-4 text-right text-muted">›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {onglet === 'harness' && <HarnessPanel />}

      {onglet === 'agents' && (
        <div className="grid gap-3 md:grid-cols-2">
          {agents.map((a) => (
            <Card key={a.id} className="cursor-pointer hover:shadow-md">
              <div onClick={() => setAgentEdite(a)}>
                <div className="flex items-center gap-3">
                  {a.photo
                    ? <img src={a.photo} alt="" className="h-10 w-10 rounded-full object-cover object-top" style={{ background: a.couleur }} />
                    : <span className="flex h-10 w-10 items-center justify-center rounded-full font-semibold text-white" style={{ background: a.couleur }}>{a.prenom[0]}</span>}
                  <div><p className="font-semibold text-fg">{a.prenom} <span className="font-normal text-muted">· {a.metier}</span></p>
                    <p className="text-xs text-muted">Offres : {a.offres.join(', ')} · ≈ {a.minutes_par_tache} min / mission</p>
                    <p className="text-xs text-muted">Modèle : <code>{a.modele || `${catalogue.defaut || '…'} (défaut)`}</code></p></div>
                  {!a.actif && <Badge tone="danger" className="ml-auto">masqué</Badge>}
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted">{a.accroche}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {ouvert && (
        <EspaceModal
          espace={ouvert === 'nouveau' ? null : ouvert}
          users={ouvert === 'nouveau' ? [] : users.filter((u) => u.workspace_id === ouvert.id)}
          agents={agents} entreprises={entreprises} lienStudio={lienStudio} catalogue={catalogue}
          onClose={() => setOuvert(null)} onSaved={charger}
        />
      )}
      {agentEdite && <AgentModal agent={agentEdite} catalogue={catalogue} onClose={() => setAgentEdite(null)} onSaved={charger} />}
    </div>
  );
}

// ─── Espace : fiche, accès, agents ──────────────────────────────────────────

function EspaceModal({
  espace, users, agents, entreprises, lienStudio, catalogue, onClose, onSaved,
}: {
  espace: Workspace | null; users: StudioUser[]; agents: AgentCat[]; entreprises: { id: string; raison_sociale: string }[];
  lienStudio: string; catalogue: Catalogue; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [f, setF] = useState<Partial<Workspace>>(espace ?? { nom: '', offre: 'essentiel', max_utilisateurs: 5, quota_messages_mois: 300, quota_images_mois: 30, quota_videos_mois: 5, actif: true, contexte_entreprise: '' });
  const [reglages, setReglages] = useState<Record<string, { actif: boolean; consignes: string; modele: string | null }>>({});
  const [nouvelAcces, setNouvelAcces] = useState({ email: '', prenom: '', nom: '', role: 'proprietaire' });
  const [identifiants, setIdentifiants] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!espace) return;
    db.from('studio_workspace_agents').select('agent_id, actif, consignes, modele').eq('workspace_id', espace.id).then(({ data }) => {
      setReglages(Object.fromEntries((data ?? []).map((r) => [r.agent_id, { actif: r.actif, consignes: r.consignes, modele: r.modele ?? null }])));
    });
  }, [espace]);

  const enregistrer = async () => {
    setErreur(''); setEnvoi(true);
    const ligne = {
      nom: f.nom?.trim(), entreprise_id: f.entreprise_id || null, offre: f.offre, secteur: f.secteur || null, taille: f.taille || null,
      max_utilisateurs: Number(f.max_utilisateurs) || 5, quota_messages_mois: f.quota_messages_mois ? Number(f.quota_messages_mois) : null,
      quota_images_mois: f.quota_images_mois != null ? Number(f.quota_images_mois) : null,
      quota_videos_mois: f.quota_videos_mois != null ? Number(f.quota_videos_mois) : null,
      actif: f.actif !== false, contexte_entreprise: f.contexte_entreprise ?? '', expire_le: f.expire_le || null,
      modele: f.modele || null,
    };
    try {
      if (!ligne.nom) throw new Error("Nom de l'espace requis");
      if (espace) {
        const { error } = await db.from('studio_workspaces').update(ligne).eq('id', espace.id);
        if (error) throw error;
        const lignes = Object.entries(reglages).map(([agent_id, r]) => ({ workspace_id: espace.id, agent_id, ...r }));
        if (lignes.length) { const { error: e2 } = await db.from('studio_workspace_agents').upsert(lignes); if (e2) throw e2; }
      } else {
        const { data: me } = await supabase.auth.getUser();
        const { error } = await db.from('studio_workspaces').insert({ ...ligne, created_by: me.user?.id ?? null });
        if (error) throw error;
      }
      await onSaved(); onClose();
    } catch (e) { setErreur(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e)); }
    finally { setEnvoi(false); }
  };

  const creerAcces = async () => {
    if (!espace) return;
    setErreur('');
    const password = motDePasseProvisoire();
    try {
      await adminStudio({ action: 'admin_create_user', workspace_id: espace.id, ...nouvelAcces, password });
      setIdentifiants(`Accès à votre Studio IA Aissociate\nAdresse : ${lienStudio}\nIdentifiant : ${nouvelAcces.email.trim().toLowerCase()}\nMot de passe provisoire : ${password}\n(à changer lors de la première connexion)`);
      setNouvelAcces({ email: '', prenom: '', nom: '', role: 'membre' });
      await onSaved();
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
  };

  const reinitialiser = async (u: StudioUser) => {
    if (!confirm(`Générer un nouveau mot de passe provisoire pour ${u.email} ? Ses sessions seront fermées.`)) return;
    const password = motDePasseProvisoire();
    try {
      await adminStudio({ action: 'admin_set_password', user_id: u.id, password });
      setIdentifiants(`Nouveau mot de passe provisoire pour ${u.email} : ${password}\nAdresse : ${lienStudio}`);
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
  };

  const basculerUser = async (u: StudioUser) => {
    const { error } = await db.from('studio_users').update({ actif: !u.actif }).eq('id', u.id);
    if (error) setErreur(error.message); else await onSaved();
  };

  const set = <K extends keyof Workspace>(k: K, v: Workspace[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal open wide onClose={onClose} title={espace ? espace.nom : 'Nouvel espace client'}
      footer={<><Button variant="secondary" onClick={onClose}>Fermer</Button><Button onClick={enregistrer} disabled={envoi}>{espace ? 'Enregistrer' : "Créer l'espace"}</Button></>}>
      <div className="space-y-5">
        {erreur && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{erreur}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom de l'espace" required><input className="input" value={f.nom ?? ''} onChange={(e) => set('nom', e.target.value)} /></Field>
          <Field label="Entreprise du CRM">
            <select className="input" value={f.entreprise_id ?? ''} onChange={(e) => {
              const ent = entreprises.find((x) => x.id === e.target.value);
              setF((x) => ({ ...x, entreprise_id: e.target.value || null, nom: x.nom || ent?.raison_sociale || '' }));
            }}>
              <option value="">— Aucune —</option>
              {entreprises.map((e) => <option key={e.id} value={e.id}>{e.raison_sociale}</option>)}
            </select>
          </Field>
          <Field label="Offre">
            <select className="input" value={f.offre} onChange={(e) => set('offre', e.target.value)}>
              {OFFRES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Secteur d'activité"><input className="input" value={f.secteur ?? ''} onChange={(e) => set('secteur', e.target.value)} /></Field>
          <Field label="Taille">
            <select className="input" value={f.taille ?? ''} onChange={(e) => set('taille', e.target.value)}>
              <option value="">—</option>{TAILLES.map((t) => <option key={t} value={t}>{t} pers.</option>)}
            </select>
          </Field>
          <Field label="Utilisateurs inclus"><input type="number" min={1} className="input" value={f.max_utilisateurs ?? 5} onChange={(e) => set('max_utilisateurs', Number(e.target.value))} /></Field>
          <Field label="Quota de missions / mois" hint="Vide = illimité"><input type="number" min={0} className="input" value={f.quota_messages_mois ?? ''} onChange={(e) => set('quota_messages_mois', e.target.value ? Number(e.target.value) : null)} /></Field>
          <Field label="Visuels IA / mois" hint="Vide = illimité · 0 = désactivé"><input type="number" min={0} className="input" value={f.quota_images_mois ?? ''} onChange={(e) => set('quota_images_mois', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Vidéos IA / mois" hint="≈ 0,50 $ la vidéo de 6 s · 0 = désactivé"><input type="number" min={0} className="input" value={f.quota_videos_mois ?? ''} onChange={(e) => set('quota_videos_mois', e.target.value === '' ? null : Number(e.target.value))} /></Field>
          <Field label="Échéance (fin d'essai ou d'abonnement)"><input type="date" className="input" value={f.expire_le ?? ''} onChange={(e) => set('expire_le', e.target.value || null)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={f.actif !== false} onChange={(e) => set('actif', e.target.checked)} /> Espace actif</label>
        <Field label="Modèle IA pour ce client (tous ses agents)" hint="Laisser « hérité » : chaque agent garde son propre modèle. Un réglage par agent, plus bas, l'emporte sur celui-ci.">
          <ModeleSelect value={f.modele ?? null} onChange={(v) => set('modele', v)} modeles={catalogue.modeles} chargement={catalogue.chargement}
            herite="le modèle de chaque agent" />
        </Field>
        <Field label="Fiche entreprise (lue par tous les agents)" hint="Le propriétaire de l'espace peut aussi la compléter depuis le Studio.">
          <textarea className="input min-h-[120px]" value={f.contexte_entreprise ?? ''} onChange={(e) => set('contexte_entreprise', e.target.value)} />
        </Field>

        {espace && (
          <>
            <section>
              <h3 className="mb-2 font-semibold text-fg">Accès ({users.length} / {espace.max_utilisateurs})</h3>
              {identifiants && (
                <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                  <p className="mb-1 font-medium text-emerald-700">À transmettre au client (affiché une seule fois) :</p>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-fg">{identifiants}</pre>
                  <Button variant="secondary" className="mt-2" onClick={() => navigator.clipboard.writeText(identifiants)}><Copy className="mr-1 inline h-3.5 w-3.5" />Copier</Button>
                </div>
              )}
              <div className="space-y-1.5">
                {users.map((u) => (
                  <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                    <span className="font-medium text-fg">{[u.prenom, u.nom].filter(Boolean).join(' ') || u.email}</span>
                    <span className="text-muted">{u.email}</span>
                    <Badge tone={u.role === "proprietaire" ? "warning" : "neutral"}>{u.role}</Badge>
                    {!u.actif && <Badge tone="danger">désactivé</Badge>}
                    <span className="ml-auto text-xs text-muted">{u.last_login_at ? `vu le ${new Date(u.last_login_at).toLocaleDateString('fr-FR')}` : 'jamais connecté'}</span>
                    <button className="btn-ghost text-xs" onClick={() => reinitialiser(u)}><KeyRound className="mr-1 inline h-3.5 w-3.5" />Mot de passe</button>
                    <button className="btn-ghost text-xs" onClick={() => basculerUser(u)}>{u.actif ? 'Désactiver' : 'Réactiver'}</button>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
                <input className="input" placeholder="E-mail" value={nouvelAcces.email} onChange={(e) => setNouvelAcces({ ...nouvelAcces, email: e.target.value })} />
                <input className="input" placeholder="Prénom" value={nouvelAcces.prenom} onChange={(e) => setNouvelAcces({ ...nouvelAcces, prenom: e.target.value })} />
                <input className="input" placeholder="Nom" value={nouvelAcces.nom} onChange={(e) => setNouvelAcces({ ...nouvelAcces, nom: e.target.value })} />
                <select className="input" value={nouvelAcces.role} onChange={(e) => setNouvelAcces({ ...nouvelAcces, role: e.target.value })}>
                  <option value="proprietaire">Propriétaire</option><option value="membre">Membre</option>
                </select>
                <Button onClick={creerAcces} disabled={!nouvelAcces.email}><UserPlus className="mr-1 inline h-4 w-4" />Créer</Button>
              </div>
              <p className="mt-1 text-xs text-muted">Un mot de passe provisoire est généré ; le client le change à sa première connexion.</p>
            </section>

            <ConnecteursEspace workspaceId={espace.id} />

            <section>
              <h3 className="mb-2 font-semibold text-fg">Agents de l'espace</h3>
              <div className="space-y-2">
                {agents.filter((a) => a.actif).map((a) => {
                  const inclus = a.offres.includes(f.offre ?? 'essentiel');
                  const r = reglages[a.id] ?? { actif: true, consignes: '', modele: null };
                  return (
                    <div key={a.id} className="rounded-lg border border-line p-3">
                      <label className="flex items-center gap-2 text-sm text-fg">
                        <input type="checkbox" disabled={!inclus} checked={inclus && r.actif}
                          onChange={(e) => setReglages((x) => ({ ...x, [a.id]: { ...r, actif: e.target.checked } }))} />
                        <span className="font-medium">{a.prenom}</span> <span className="text-muted">· {a.metier}</span>
                        {!inclus && <span className="text-xs text-muted">(non inclus dans l'offre)</span>}
                      </label>
                      {inclus && r.actif && (
                        <div className="mt-2">
                          <ModeleSelect value={r.modele} onChange={(v) => setReglages((x) => ({ ...x, [a.id]: { ...r, modele: v } }))}
                            modeles={catalogue.modeles} chargement={catalogue.chargement}
                            herite={f.modele || a.modele || `${catalogue.defaut} (défaut)`} />
                        </div>
                      )}
                      {inclus && r.actif && (
                        <textarea className="input mt-2 min-h-[60px] text-xs" placeholder={`Consignes propres à ce client pour ${a.prenom} (facultatif)`}
                          value={r.consignes} onChange={(e) => setReglages((x) => ({ ...x, [a.id]: { ...r, consignes: e.target.value } }))} />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
        {!espace && <p className="text-sm text-muted">Une fois l'espace créé, rouvrez-le pour ajouter les accès et régler les agents.</p>}
      </div>
    </Modal>
  );
}

// ─── Catalogue : édition d'un agent ─────────────────────────────────────────

function AgentModal({ agent, catalogue, onClose, onSaved }: { agent: AgentCat; catalogue: Catalogue; onClose: () => void; onSaved: () => Promise<void> }) {
  const [a, setA] = useState(agent);
  const [demandes, setDemandes] = useState(JSON.stringify(agent.demandes, null, 2));
  const [pouvoirs, setPouvoirs] = useState(JSON.stringify(agent.super_pouvoirs ?? [], null, 2));
  const [erreur, setErreur] = useState('');

  const enregistrer = async () => {
    setErreur('');
    let d: unknown;
    try { d = JSON.parse(demandes); if (!Array.isArray(d)) throw new Error(); } catch { setErreur('Demandes : JSON invalide (liste de {titre, prompt}).'); return; }
    let sp: unknown;
    try {
      sp = JSON.parse(pouvoirs);
      if (!Array.isArray(sp) || sp.some((p) => !p.id || !p.titre || !Array.isArray(p.champs) || !p.gabarit)) throw new Error();
    } catch { setErreur('Super-pouvoirs : JSON invalide (chaque entrée : id, titre, champs[], gabarit).'); return; }
    const { id: _id, ...reste } = a;
    const { error } = await db.from('studio_agents').update({ ...reste, demandes: d, super_pouvoirs: sp }).eq('id', agent.id);
    if (error) { setErreur(error.message); return; }
    await onSaved(); onClose();
  };

  return (
    <Modal open wide onClose={onClose} title={`Agent ${agent.prenom}`}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={enregistrer}>Enregistrer</Button></>}>
      <div className="space-y-3">
        {erreur && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{erreur}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Prénom"><input className="input" value={a.prenom} onChange={(e) => setA({ ...a, prenom: e.target.value })} /></Field>
          <Field label="Métier"><input className="input" value={a.metier} onChange={(e) => setA({ ...a, metier: e.target.value })} /></Field>
          <Field label="Couleur"><input type="color" className="input h-10" value={a.couleur} onChange={(e) => setA({ ...a, couleur: e.target.value })} /></Field>
          <Field label="Minutes gagnées / mission"><input type="number" className="input" value={a.minutes_par_tache} onChange={(e) => setA({ ...a, minutes_par_tache: Number(e.target.value) })} /></Field>
          <Field label="Ordre"><input type="number" className="input" value={a.ordre} onChange={(e) => setA({ ...a, ordre: Number(e.target.value) })} /></Field>
          <Field label="Offres">
            <div className="flex flex-wrap gap-2 pt-2 text-sm text-fg">
              {OFFRES.map(([k, l]) => (
                <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={a.offres.includes(k)}
                  onChange={(e) => setA({ ...a, offres: e.target.checked ? [...a.offres, k] : a.offres.filter((o) => o !== k) })} />{l}</label>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Portrait (URL)" hint="Ex. /agents-ia/studio/lea.webp. Vide = pastille avec l'initiale.">
          <div className="flex items-center gap-3">
            {a.photo && <img src={a.photo} alt="" className="h-12 w-12 rounded-full object-cover object-top" style={{ background: a.couleur }} />}
            <input className="input" value={a.photo ?? ''} onChange={(e) => setA({ ...a, photo: e.target.value || null })} />
          </div>
        </Field>
        <Field label="Modèle IA de l'agent" hint="Par défaut pour tous les clients ; un client peut avoir son propre réglage (fiche de l'espace).">
          <ModeleSelect value={a.modele} onChange={(v) => setA({ ...a, modele: v })} modeles={catalogue.modeles} chargement={catalogue.chargement}
            herite={`${catalogue.defaut || '…'} (Paramètres › IA)`} />
        </Field>
        <Field label="Accroche (1re personne)"><input className="input" value={a.accroche} onChange={(e) => setA({ ...a, accroche: e.target.value })} /></Field>
        <Field label="Description"><input className="input" value={a.description} onChange={(e) => setA({ ...a, description: e.target.value })} /></Field>
        <Field label="Prompt système"><textarea className="input min-h-[140px] font-mono text-xs" value={a.prompt_systeme} onChange={(e) => setA({ ...a, prompt_systeme: e.target.value })} /></Field>
        {/* Enregistrée immédiatement (indépendante du bouton « Enregistrer » de l'agent). */}
        <SavoirsAgent agentId={agent.id} prenom={agent.prenom} />
        <Field label="Super-pouvoirs (JSON)" hint="Missions cadrées : champs du formulaire (texte, long, choix) et gabarit de consigne avec {{nom_du_champ}}. Le gabarit n'est jamais envoyé au navigateur du client.">
          <textarea className="input min-h-[220px] font-mono text-xs" value={pouvoirs} onChange={(e) => setPouvoirs(e.target.value)} />
        </Field>
        <Field label="Demandes suggérées (JSON)"><textarea className="input min-h-[140px] font-mono text-xs" value={demandes} onChange={(e) => setDemandes(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={a.actif} onChange={(e) => setA({ ...a, actif: e.target.checked })} /> Agent visible dans le Studio</label>
      </div>
    </Modal>
  );
}
