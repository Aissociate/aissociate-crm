// Génère supabase/seed/studio_demo.sql à partir de supabase/seed/studio_demo.json
// (espace de démonstration FICTIF du Studio IA, « 1 mois de fonctionnement »).
//   node scripts/studio-demo-sql.mjs
// Le SQL est idempotent : ids fixes, `on conflict do nothing`. Pour repartir de
// zéro : `delete from studio_workspaces where id = '<workspace.id>';` (cascade).
// Aucun mot de passe n'est créé : donner l'accès depuis le CRM › Studio IA clients
// › espace « Démo… » › Mot de passe.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const d = JSON.parse(readFileSync(join(racine, 'supabase/seed/studio_demo.json'), 'utf8'));
const q = (v) => (v == null ? 'null' : `'${String(v).replaceAll("'", "''")}'`);
const quand = (jours, minutes = 0) => `now() - interval '${jours} days' + interval '${minutes} minutes'`;
const w = d.workspace;
const u = d.utilisateur;
const l = [];

l.push(`-- GÉNÉRÉ par scripts/studio-demo-sql.mjs depuis supabase/seed/studio_demo.json — ne pas éditer à la main.
-- Espace de démonstration FICTIF du Studio IA (1 mois de fonctionnement).
begin;`);
l.push(`insert into public.studio_workspaces (id, nom, offre, secteur, taille, contexte_entreprise, created_at)
values (${q(w.id)}, ${q(w.nom)}, ${q(w.offre)}, ${q(w.secteur)}, ${q(w.taille)}, ${q(w.contexte_entreprise)}, ${quand(31)})
on conflict (id) do nothing;`);
l.push(`insert into public.studio_users (id, workspace_id, email, prenom, nom, role, created_at)
values (${q(u.id)}, ${q(w.id)}, ${q(u.email)}, ${q(u.prenom)}, ${q(u.nom)}, ${q(u.role)}, ${quand(31)})
on conflict (id) do nothing;`);
for (const doc of d.documents) {
  l.push(`insert into public.studio_documents (id, workspace_id, titre, type, format, taille, contenu, actif, created_by, created_at)
values (${q(doc.id)}, ${q(w.id)}, ${q(doc.titre)}, ${q(doc.type)}, ${q(doc.format)}, ${doc.taille ?? 'null'}, ${q(doc.contenu)}, ${doc.actif}, ${q(u.id)}, ${quand(doc.jours)})
on conflict (id) do nothing;`);
}
for (const c of d.conversations) {
  l.push(`insert into public.studio_conversations (id, workspace_id, user_id, agent_id, titre, created_at, updated_at)
values (${q(c.id)}, ${q(w.id)}, ${q(u.id)}, ${q(c.agent_id)}, ${q(c.titre)}, ${quand(c.jours)}, ${quand(c.jours, 5)})
on conflict (id) do nothing;`);
  c.messages.forEach((m, i) => {
    const id = m.id ? q(m.id) : `gen_random_uuid()`;
    l.push(`insert into public.studio_messages (id, conversation_id, workspace_id, agent_id, role, content, retour, epingle, created_at)
values (${id}, ${q(c.id)}, ${q(w.id)}, ${q(c.agent_id)}, ${q(m.role)}, ${q(m.content)}, ${m.retour ?? 'null'}, ${m.epingle === true}, ${quand(c.jours, i + 1)})
${m.id ? 'on conflict (id) do nothing' : ''};`);
  });
}
for (const k of d.connecteurs) {
  l.push(`insert into public.studio_connecteurs (workspace_id, type, statut, infos, notes_admin, demande_par)
values (${q(w.id)}, ${q(k.type)}, ${q(k.statut)}, ${q(JSON.stringify(k.infos))}::jsonb, ${q(k.notes_admin)}, ${q(u.id)})
on conflict (workspace_id, type) do nothing;`);
}
l.push('commit;');
writeFileSync(join(racine, 'supabase/seed/studio_demo.sql'), l.join('\n\n') + '\n');
console.log('supabase/seed/studio_demo.sql écrit');
