// CRM › Studio IA › Demandes : questionnaires d'onboarding reçus de /studio/demarrer.
// Score de maturité /100, points d'attention RGPD, réponses complètes, puis
// « Créer l'espace » (provisionnement par l'Edge Function) ou « Refuser ».
import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Copy, ExternalLink, Rocket, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { functionErrorMessage } from '@/lib/invokeError';
import { Badge, Button, EmptyState, Field, Modal, Spinner } from '@/components/ui';
import { AGENTS_CATALOGUE, SECTIONS, scorer, type Reponses } from '../../../supabase/functions/studio/questionnaire';

const db = supabase as unknown as SupabaseClient;

type Demande = {
  id: string; statut: 'nouvelle' | 'en_revue' | 'provisionnee' | 'refusee'; entreprise: string; contact_nom: string | null;
  email: string; telephone: string | null; agents: string[]; reponses: Reponses; score: number; lecture: string | null;
  drapeaux: string[]; workspace_id: string | null; notes_crm: string; created_at: string;
  identifiants_envoyes_le?: string | null; traite_par?: string | null;
};
/** Essai ouvert automatiquement par le questionnaire, mais e-mail d'identifiants non parti. */
const sansIdentifiants = (d: Demande) => d.statut === 'provisionnee' && !d.traite_par && !d.identifiants_envoyes_le;

const STATUTS: Record<Demande['statut'], { label: string; tone: 'info' | 'warning' | 'success' | 'danger' }> = {
  nouvelle: { label: 'Nouvelle', tone: 'info' }, en_revue: { label: 'En revue', tone: 'warning' },
  provisionnee: { label: 'Espace créé', tone: 'success' }, refusee: { label: 'Refusée', tone: 'danger' },
};
const DRAPEAUX: Record<string, string> = {
  donnees_sensibles: 'Données de santé, sociales ou bancaires', mineurs: 'Données de mineurs',
  disponibilite_insuffisante: 'Moins de 2 h/semaine de disponibilité', sans_double_authentification: 'Pas de double authentification',
};
const LECTURES: Record<string, string> = {
  diagnostic: 'Commencer par un diagnostic accompagné (données ou temps insuffisants)',
  pilote: 'Démarrer en pilote sur 1 agent pendant 30 jours',
  'démarrage': 'Démarrage complet possible',
};
const DETAIL: Record<string, [string, number]> = {
  temps: ['Temps récupérable', 25], donnees: ['Données accessibles', 20], decideur: ['Décideur disponible', 20],
  process: ['Process décrits', 15], rgpd: ['Hygiène RGPD', 10], budget: ['Budget', 10],
};
const libelleAgent = (id: string) => AGENTS_CATALOGUE.find((a) => a.id === id)?.libelle.split(' —')[0] ?? id;

export default function OnboardingPanel({ onProvisionne }: { onProvisionne: () => void }) {
  const [demandes, setDemandes] = useState<Demande[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [ouverte, setOuverte] = useState<Demande | null>(null);
  const [ouvert, setOuvert] = useState<boolean | null>(null);

  const charger = useCallback(async () => {
    const [{ data, error }, { data: cfg }] = await Promise.all([
      db.from('studio_onboarding').select('*').order('created_at', { ascending: false }).limit(300),
      db.from('studio_config').select('valeur').eq('cle', 'onboarding_ouvert').maybeSingle(),
    ]);
    if (error) setErreur(error.message.includes('studio_onboarding') ? 'Migration « studio_gouvernance » non appliquée.' : error.message);
    setDemandes((data ?? []) as Demande[]);
    setOuvert(cfg ? cfg.valeur !== 'false' : null);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const lien = `${window.location.origin}/studio/demarrer`;
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">Questionnaire public :</span>
        <code className="rounded bg-surface-2 px-2 py-1 text-xs">{lien}</code>
        <button className="btn-ghost text-xs" onClick={() => navigator.clipboard.writeText(lien)}><Copy className="mr-1 inline h-3.5 w-3.5" />Copier</button>
        <a className="btn-ghost text-xs" href="/studio/demarrer" target="_blank" rel="noreferrer"><ExternalLink className="mr-1 inline h-3.5 w-3.5" />Ouvrir</a>
        {ouvert === false && <Badge tone="danger">fermé (Paramètres)</Badge>}
      </div>
      {erreur && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{erreur}</p>}
      {demandes === null ? <Spinner /> : demandes.length === 0 ? (
        <EmptyState title="Aucune demande" message="Les questionnaires remplis sur /studio/demarrer arrivent ici, avec un lead dans le CRM." />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-muted">
              <tr><th className="px-4 py-3">Entreprise</th><th>Contact</th><th>Agents</th><th>Score</th><th>Attention</th><th>Reçue</th><th>Statut</th></tr>
            </thead>
            <tbody>
              {demandes.map((d) => (
                <tr key={d.id} className="cursor-pointer border-b border-line/60 hover:bg-surface-2" onClick={() => setOuverte(d)}>
                  <td className="px-4 py-3 font-medium text-fg">{d.entreprise}</td>
                  <td>{d.contact_nom}<br /><span className="text-xs text-muted">{d.email}</span></td>
                  <td>{d.agents.map(libelleAgent).join(', ')}</td>
                  <td><span className={d.score > 70 ? 'font-semibold text-emerald-600' : d.score >= 40 ? 'font-semibold text-amber-600' : 'font-semibold text-red-600'}>{d.score}</span><span className="text-muted">/100</span></td>
                  <td>{d.drapeaux.length ? <Badge tone="danger">{d.drapeaux.length}</Badge> : '—'}</td>
                  <td>{new Date(d.created_at).toLocaleDateString('fr-FR')}</td>
                  <td>
                    <Badge tone={STATUTS[d.statut].tone}>{d.statut === 'provisionnee' && !d.traite_par ? 'Essai ouvert' : STATUTS[d.statut].label}</Badge>
                    {sansIdentifiants(d) && <Badge tone="danger" className="ml-1">identifiants non envoyés</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ouverte && <DemandeModal demande={ouverte} onClose={() => setOuverte(null)} onSaved={async () => { await charger(); onProvisionne(); }} />}
    </div>
  );
}

function DemandeModal({ demande: d, onClose, onSaved }: { demande: Demande; onClose: () => void; onSaved: () => Promise<void> }) {
  const [agents, setAgents] = useState<string[]>(d.agents);
  const [offre, setOffre] = useState('sur_mesure');
  const [abonnement, setAbonnement] = useState('');
  const [notes, setNotes] = useState(d.notes_crm);
  const [identifiants, setIdentifiants] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const s = scorer(d.reponses);
  const traitee = d.statut === 'provisionnee' || d.statut === 'refusee';

  const maj = async (patch: Partial<Demande>) => {
    const { error } = await db.from('studio_onboarding').update(patch).eq('id', d.id);
    if (error) throw error;
  };

  const provisionner = async () => {
    if (!confirm(`Créer l'espace « ${d.entreprise} » avec ${agents.length} agent(s) et un accès propriétaire pour ${d.email} ?`)) return;
    setEnvoi(true); setErreur('');
    try {
      if (notes !== d.notes_crm) await maj({ notes_crm: notes });
      const { data, error } = await supabase.functions.invoke('studio', {
        body: { action: 'admin_provisionner', demande_id: d.id, agents, offre, abonnement_mensuel: abonnement || null },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      const r = data as { email: string; mot_de_passe: string };
      setIdentifiants(`Bienvenue dans votre Studio IA Aissociate !\nAdresse : ${window.location.origin}/studio\nIdentifiant : ${r.email}\nMot de passe provisoire : ${r.mot_de_passe}\n(à changer lors de la première connexion)`);
      await onSaved();
    } catch (e) { setErreur(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e)); }
    finally { setEnvoi(false); }
  };

  const changerStatut = async (statut: Demande['statut']) => {
    try { await maj({ statut, notes_crm: notes }); await onSaved(); onClose(); }
    catch (e) { setErreur(String((e as { message?: string }).message ?? e)); }
  };

  return (
    <Modal open wide onClose={onClose} title={`${d.entreprise} — demande d'onboarding`}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
        {!traitee && !identifiants && <>
          {d.statut === 'nouvelle' && <Button variant="secondary" onClick={() => changerStatut('en_revue')}>Passer en revue</Button>}
          <Button variant="secondary" onClick={() => confirm('Refuser cette demande ?') && changerStatut('refusee')}><X className="mr-1 inline h-4 w-4" />Refuser</Button>
          <Button onClick={provisionner} disabled={envoi || !agents.length}><Rocket className="mr-1 inline h-4 w-4" />{envoi ? 'Création…' : "Créer l'espace"}</Button>
        </>}
      </>}>
      <div className="space-y-5">
        {erreur && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{erreur}</p>}
        {identifiants && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <p className="mb-1 font-medium text-emerald-700">Espace créé. À transmettre au client (affiché une seule fois) :</p>
            <pre className="whitespace-pre-wrap font-mono text-xs text-fg">{identifiants}</pre>
            <Button variant="secondary" className="mt-2" onClick={() => navigator.clipboard.writeText(identifiants)}><Copy className="mr-1 inline h-3.5 w-3.5" />Copier</Button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <div className="rounded-lg border border-line p-3">
              <p className="text-3xl font-semibold text-fg">{s.score}<span className="text-base font-normal text-muted">/100</span></p>
              <p className="text-sm text-muted">{LECTURES[s.lecture]}</p>
              <ul className="mt-3 space-y-1 text-xs">
                {Object.entries(s.detail).map(([k, v]) => (
                  <li key={k} className="flex justify-between"><span className="text-muted">{DETAIL[k]?.[0] ?? k}</span><span className="text-fg">{v} / {DETAIL[k]?.[1]}</span></li>
                ))}
              </ul>
            </div>
            {s.drapeaux.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
                <p className="mb-1 font-medium text-red-600">Points d'attention</p>
                <ul className="list-disc pl-5 text-fg">{s.drapeaux.map((f) => <li key={f}>{DRAPEAUX[f] ?? f}</li>)}</ul>
              </div>
            )}
            <p className="text-sm text-fg">{d.contact_nom} · <a className="underline" href={`mailto:${d.email}`}>{d.email}</a>{d.telephone && ` · ${d.telephone}`}</p>
            <Field label="Notes internes"><textarea className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            {!traitee && !identifiants && (
              <div className="space-y-3 rounded-lg border border-line p-3">
                <p className="text-sm font-medium text-fg">Espace à créer</p>
                <div className="flex flex-wrap gap-2 text-sm text-fg">
                  {AGENTS_CATALOGUE.map((a) => (
                    <label key={a.id} className="flex items-center gap-1">
                      <input type="checkbox" checked={agents.includes(a.id)} onChange={(e) => setAgents(e.target.checked ? [...agents, a.id] : agents.filter((x) => x !== a.id))} />
                      {libelleAgent(a.id)}
                    </label>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Offre">
                    <select className="input" value={offre} onChange={(e) => setOffre(e.target.value)}>
                      <option value="sur_mesure">Sur mesure</option><option value="pro">Pro</option><option value="essentiel">Essentiel</option>
                    </select>
                  </Field>
                  <Field label="Abonnement HT / mois (€)"><input type="number" min={0} className="input" value={abonnement} onChange={(e) => setAbonnement(e.target.value)} /></Field>
                </div>
                <p className="text-xs text-muted">Quotas et plafond IA du jour : valeurs par défaut de l'onglet Paramètres. La fiche entreprise est pré-remplie depuis les réponses.</p>
              </div>
            )}
          </div>

          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {SECTIONS.map((sec) => {
              const lignes = sec.questions.filter((q) => {
                const v = d.reponses[q.id];
                return Array.isArray(v) ? v.length : String(v ?? '').trim();
              });
              if (!lignes.length) return null;
              return (
                <div key={sec.id}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{sec.titre}</p>
                  <dl className="space-y-1.5 text-sm">
                    {lignes.map((q) => {
                      const v = d.reponses[q.id];
                      return (
                        <div key={q.id}>
                          <dt className="text-xs text-muted">{q.libelle}</dt>
                          <dd className="whitespace-pre-wrap text-fg">{Array.isArray(v) ? v.map(libelleAgent).join(', ') : String(v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
