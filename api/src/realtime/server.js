// Temps réel compatible avec supabase-js (protocole Phoenix, « postgres_changes »).
// Usage dans l'application : trois abonnements qui déclenchent un simple
// rechargement. Le serveur envoie donc « telle table a changé » sans le contenu
// de la ligne : les données sont relues par l'API, sous RLS.
import pg from 'pg';
import { WebSocketServer } from 'ws';
import { config } from '../config.js';
import { verifyJwt } from '../jwt.js';

const R = config.realtime;
const sockets = new Set();
let nextBindingId = 1;

function claimsOf(token) {
  try { return verifyJwt(token, config.jwtSecret); } catch { return null; }
}

/** filter « colonne=eq.valeur » évalué sur les seules colonnes transmises par la base. */
export function matches(binding, change) {
  if (binding.schema !== 'public' || binding.table !== change.t) return false;
  if (binding.event !== '*' && binding.event !== change.op) return false;
  const m = /^([a-z_]+)=eq\.(.+)$/.exec(binding.filter ?? '');
  if (m && (m[1] === 'id' || m[1] === 'user_id')) return change[m[1]] === m[2];
  return true;
}

function dispatch(change) {
  const now = Math.floor(Date.now() / 1000);
  for (const s of sockets) {
    for (const [topic, ch] of s.channels) {
      // Réservé aux utilisateurs connectés dont le jeton est encore valide.
      const c = ch.claims;
      if (!c || !['authenticated', 'service_role'].includes(c.role) || (typeof c.exp === 'number' && c.exp < now)) continue;
      const ids = ch.bindings.filter((b) => matches(b, change)).map((b) => b.id);
      if (!ids.length) continue;
      const record = change.op === 'DELETE' ? {} : { id: change.id };
      const old_record = change.op === 'INSERT' ? {} : { id: change.id };
      s.send({ topic, event: 'postgres_changes', ref: null, payload: { ids, data: { schema: 'public', table: change.t, commit_timestamp: new Date().toISOString(), type: change.op, columns: [], record, old_record, errors: null } } });
    }
  }
}

function onMessage(s, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }
  const { topic, event, payload = {}, ref } = msg ?? {};
  if (typeof topic !== 'string' || typeof event !== 'string') return;
  const reply = (status, response = {}) => s.send({ topic, event: 'phx_reply', ref, payload: { status, response } });
  s.lastSeen = Date.now();

  if (topic === 'phoenix' && event === 'heartbeat') return reply('ok');
  if (event === 'phx_join') {
    if (s.channels.size >= R.maxChannelsPerSocket && !s.channels.has(topic)) return reply('error', { reason: 'too_many_channels' });
    const claims = claimsOf(payload.access_token ?? s.apikey);
    if (!claims) return reply('error', { reason: 'invalid_token' });
    const asked = Array.isArray(payload.config?.postgres_changes) ? payload.config.postgres_changes.slice(0, 20) : [];
    const bindings = asked.map((b) => {
      const out = { id: nextBindingId++, event: String(b.event ?? '*'), schema: String(b.schema ?? 'public'), table: String(b.table ?? '') };
      if (typeof b.filter === 'string') out.filter = b.filter; // même forme que la demande : le client compare
      return out;
    });
    s.channels.set(topic, { claims, bindings });
    reply('ok', { postgres_changes: bindings });
    if (bindings.length) s.send({ topic, event: 'system', ref: null, payload: { extension: 'postgres_changes', status: 'ok', message: 'Subscribed to PostgreSQL', channel: topic.replace(/^realtime:/, '') } });
    return;
  }
  if (event === 'access_token') {
    const ch = s.channels.get(topic);
    const claims = claimsOf(payload.access_token);
    if (ch && claims) ch.claims = claims;
    return;
  }
  if (event === 'phx_leave') { s.channels.delete(topic); return reply('ok'); }
  // Diffusion et présence ne sont pas utilisées par l'application.
  if (ref) reply('ok');
}

async function listen(log) {
  const client = new pg.Client(config.auth.db);
  client.on('error', () => {});
  client.on('end', () => setTimeout(() => listen(log).catch(() => {}), 5000));
  client.on('notification', (n) => {
    try { dispatch(JSON.parse(n.payload)); } catch { /* charge utile illisible */ }
  });
  await client.connect();
  await client.query('listen table_changes');
}

export async function startRealtime(app) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  app.server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/realtime/v1/websocket' || sockets.size >= R.maxConnections || !claimsOf(url.searchParams.get('apikey'))) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const s = { ws, apikey: url.searchParams.get('apikey'), channels: new Map(), lastSeen: Date.now(), send: (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); } };
      sockets.add(s);
      ws.on('message', (data) => onMessage(s, data.toString()));
      ws.on('close', () => sockets.delete(s));
      ws.on('error', () => sockets.delete(s));
    });
  });
  // Connexions muettes (pas de battement de cœur) : fermées.
  setInterval(() => { const now = Date.now(); for (const s of sockets) if (now - s.lastSeen > R.idleMs) s.ws.terminate(); }, 30_000).unref();
  await listen(app.log).catch((err) => app.log.error({ msg: 'temps réel : écoute impossible', err: err.message }));
  app.log.info('temps réel : prêt');
}
