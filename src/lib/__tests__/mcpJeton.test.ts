import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cacheSessions, empreinte, extraireJeton, marquerUtilisation, verifierJeton, type JetonValide,
} from '../../../supabase/functions/_shared/mcp_jeton';
import { traiterCorps, versOutilsMcp, type Serveur } from '../../../supabase/functions/_shared/mcp_protocole';
import { buildTools, type Ctx } from '../../../supabase/functions/_shared/agent/outils';
import { fauxDb } from './fauxSupabase';

const JETON = 'crm_mcp_' + 'A'.repeat(20) + '-_' + 'b9'.repeat(10) + 'z';
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

const base = (lignes: Record<string, unknown>[]) => {
  const db = fauxDb({ mcp_jetons: lignes });
  return { db, client: db as unknown as SupabaseClient };
};
const ligne = (extra: Record<string, unknown> = {}) => ({
  id: 'j1', user_id: 'u1', libelle: 'n8n', empreinte: sha(JETON),
  revoked_at: null, expires_at: null, last_used_at: null, ...extra,
});

describe('extraireJeton', () => {
  it('lit l’en-tête Bearer', () => {
    const req = new Request('https://x/functions/v1/mcp', { headers: { Authorization: `Bearer ${JETON}` } });
    expect(extraireJeton(req)).toBe(JETON);
  });
  it('se rabat sur ?jeton= (connecteur claude.ai)', () => {
    expect(extraireJeton(new Request(`https://x/functions/v1/mcp?jeton=${JETON}`))).toBe(JETON);
  });
  it('renvoie null sans jeton', () => {
    expect(extraireJeton(new Request('https://x/functions/v1/mcp'))).toBeNull();
    expect(extraireJeton(new Request('https://x', { headers: { Authorization: 'Basic abc' } }))).toBeNull();
  });
});

describe('empreinte', () => {
  it('est le SHA-256 hex du jeton, identique à digest() côté Postgres', async () => {
    expect(await empreinte(JETON)).toBe(sha(JETON));
    expect(await empreinte(JETON)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifierJeton', () => {
  it('accepte un jeton actif et renvoie son propriétaire', async () => {
    const { client } = base([ligne()]);
    const r = await verifierJeton(client, JETON);
    expect(r).toEqual({ ok: true, jeton: { id: 'j1', user_id: 'u1', libelle: 'n8n', last_used_at: null } });
  });
  it('refuse sans jeton', async () => {
    const { client } = base([ligne()]);
    expect(await verifierJeton(client, null)).toEqual({ ok: false, raison: 'absent' });
  });
  it('refuse un jeton mal formé sans interroger la base', async () => {
    const { client } = base([ligne()]);
    expect(await verifierJeton(client, 'crm_mcp_court')).toEqual({ ok: false, raison: 'format' });
    expect(await verifierJeton(client, 'eyJhbGciOiJIUzI1NiJ9.x.y')).toEqual({ ok: false, raison: 'format' });
  });
  it('refuse un jeton inconnu', async () => {
    const { client } = base([ligne({ empreinte: sha('autre') })]);
    expect(await verifierJeton(client, JETON)).toEqual({ ok: false, raison: 'inconnu' });
  });
  it('ne compare jamais le jeton en clair', async () => {
    const { client } = base([ligne({ empreinte: JETON })]);
    expect(await verifierJeton(client, JETON)).toEqual({ ok: false, raison: 'inconnu' });
  });
  it('refuse un jeton révoqué', async () => {
    const { client } = base([ligne({ revoked_at: '2026-10-01T00:00:00Z' })]);
    expect(await verifierJeton(client, JETON)).toEqual({ ok: false, raison: 'revoque' });
  });
  it('refuse un jeton expiré, accepte avant l’échéance', async () => {
    const { client } = base([ligne({ expires_at: '2026-10-10T00:00:00Z' })]);
    expect(await verifierJeton(client, JETON, new Date('2026-10-14T00:00:00Z'))).toEqual({ ok: false, raison: 'expire' });
    expect((await verifierJeton(client, JETON, new Date('2026-10-09T00:00:00Z'))).ok).toBe(true);
  });
});

describe('marquerUtilisation', () => {
  const jeton = (last: string | null): JetonValide => ({ id: 'j1', user_id: 'u1', libelle: 'n8n', last_used_at: last });
  it('écrit last_used_at au plus toutes les 5 minutes', async () => {
    const { db, client } = base([ligne()]);
    const t = new Date('2026-10-14T10:00:00Z');
    expect(await marquerUtilisation(client, jeton(null), t)).toBe(true);
    expect(db.tables.mcp_jetons[0].last_used_at).toBe(t.toISOString());
    expect(await marquerUtilisation(client, jeton('2026-10-14T09:58:00Z'), t)).toBe(false);
    expect(await marquerUtilisation(client, jeton('2026-10-14T09:50:00Z'), t)).toBe(true);
  });
});

describe('cacheSessions', () => {
  const jeton: JetonValide = { id: 'j1', user_id: 'u1', libelle: 'n8n', last_used_at: null };
  it('réutilise la session puis la renouvelle 5 min avant expiration', async () => {
    let now = 1000;
    let ouvertures = 0;
    const cache = cacheSessions(async () => ({ access_token: `t${++ouvertures}`, expire_a: now + 3600 }), () => now);
    expect(await cache.obtenir(jeton)).toBe('t1');
    now += 3000;
    expect(await cache.obtenir(jeton)).toBe('t1');
    now += 400;
    expect(await cache.obtenir(jeton)).toBe('t2');
  });
});

describe('protocole MCP', () => {
  const serveur: Serveur = {
    nom: 'crm', version: '1', instructions: 'i',
    lister: async () => versOutilsMcp([
      { type: 'function', function: { name: 'rechercher_contacts', description: 'Recherche', parameters: { type: 'object', properties: {} } } },
      { type: 'function', function: { name: 'proposer_note_contact', description: 'Note.', parameters: { type: 'object', properties: {} } } },
    ]),
    appeler: async (nom) => (nom === 'rechercher_contacts' ? { total: 0 } : { erreur: 'x' }),
  };

  it('initialize négocie la version et annonce les outils', async () => {
    const r = await traiterCorps(serveur, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
    expect(r).toMatchObject({ id: 1, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} } } });
  });
  it('tools/list expose le catalogue avec les annotations lecture / proposition', async () => {
    const r = await traiterCorps(serveur, { jsonrpc: '2.0', id: 2, method: 'tools/list' }) as { result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] } };
    expect(r.result.tools.map((t) => [t.name, t.annotations.readOnlyHint])).toEqual([
      ['rechercher_contacts', true], ['proposer_note_contact', false],
    ]);
  });
  it('tools/call refuse un outil hors catalogue', async () => {
    const r = await traiterCorps(serveur, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'proposer_suppression', arguments: {} } });
    expect(r).toMatchObject({ error: { code: -32602 } });
  });
  it('tools/call renvoie le résultat en texte, isError si erreur', async () => {
    expect(await traiterCorps(serveur, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'rechercher_contacts' } }))
      .toMatchObject({ result: { content: [{ type: 'text', text: '{"total":0}' }], isError: false } });
    expect(await traiterCorps(serveur, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'proposer_note_contact' } }))
      .toMatchObject({ result: { isError: true } });
  });
  it('les notifications ne reçoivent pas de réponse', async () => {
    expect(await traiterCorps(serveur, { jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
  });
});

describe('catalogue partagé avec l’assistant', () => {
  const ctx = (droits: Ctx['droits'], isDirection = false): Ctx => ({
    user: { id: 'u1' }, db: fauxDb() as unknown as SupabaseClient, isDirection, finances: false, droits,
    authHeader: '', supabaseUrl: '', conversationId: null, emit: () => {}, sources: [],
  });
  it('suit les droits du rôle et ne contient que lectures et propositions', () => {
    const tous = versOutilsMcp(buildTools(ctx({}))).map((t) => t.name);
    expect(tous).toContain('rechercher_contacts');
    expect(tous).toContain('proposer_note_contact');
    expect(tous).not.toContain('lister_leads');
    const sansContacts = versOutilsMcp(buildTools(ctx({ contacts: false }))).map((t) => t.name);
    expect(sansContacts).not.toContain('rechercher_contacts');
    expect(sansContacts).not.toContain('proposer_note_contact');
    expect(versOutilsMcp(buildTools(ctx({}, true))).map((t) => t.name)).toContain('lister_leads');
  });
});
