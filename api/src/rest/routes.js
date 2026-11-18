// Routes /rest/v1 : mêmes URL, en-têtes et formats de réponse que Supabase,
// pour que supabase-js fonctionne sans modification côté application.
import { config } from '../config.js';
import { withIdentity } from '../db.js';
import { ApiError, badRequest } from '../errors.js';
import { authenticate } from '../jwt.js';
import { reloadIfStale, schema } from '../schema.js';
import { buildDelete, buildInsert, buildRead, buildRpc, buildUpdate, Ctx, getTable, q } from './build.js';
import { parsePrefer, parseQuery } from './parse.js';

const JSON_TYPE = 'application/json; charset=utf-8';
const wantsObject = (req) => String(req.headers.accept ?? '').includes('application/vnd.pgrst.object+json');

function checkProfile(req) {
  const p = req.headers['accept-profile'] ?? req.headers['content-profile'];
  if (p && p !== 'public') throw new ApiError(406, 'PGRST106', 'The schema must be one of the following: public');
}

/** Résout une table ou une fonction ; recharge le schéma une fois si elle est inconnue. */
async function resolve(fn) {
  try { return fn(schema()); } catch (err) {
    if (err instanceof ApiError && err.status === 404 && (await reloadIfStale())) return fn(schema());
    throw err;
  }
}

function singleOrThrow(n) {
  if (n !== 1) throw new ApiError(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${n} rows`);
}

function contentRange(offset, n, total) {
  return `${n > 0 ? `${offset}-${offset + n - 1}` : '*'}/${total ?? '*'}`;
}

async function read(req, reply) {
  checkProfile(req);
  const who = authenticate(req.headers, config.jwtSecret);
  const query = parseQuery(new URL(req.raw.url, 'http://localhost').searchParams);
  const prefer = parsePrefer(req.headers.prefer);
  const single = wantsObject(req);
  const ctx = new Ctx();
  const sql = await resolve((sch) => {
    const t = getTable(sch, req.params.table);
    return buildRead(sch, t, query, ctx, { from: `public.${q(t.name)}`, maxRows: config.maxRows, single });
  });
  const out = await withIdentity(who, { readOnly: true }, async (db) => {
    const rows = (await db.query(sql.rows, ctx.params)).rows[0];
    const total = prefer.count ? (await db.query(sql.count, ctx.params)).rows[0].total : null;
    return { ...rows, total };
  });
  if (single) singleOrThrow(out.n);
  if (out.total !== null && sql.offset > 0 && sql.offset >= out.total) {
    reply.header('content-range', `*/${out.total}`);
    throw new ApiError(416, 'PGRST103', 'Requested range not satisfiable', `An offset of ${sql.offset} was requested, but there are only ${out.total} rows.`);
  }
  reply.header('content-range', contentRange(sql.offset, out.n, out.total)).type(JSON_TYPE);
  return reply.send(out.body);
}

async function write(req, reply, verb) {
  checkProfile(req);
  const who = authenticate(req.headers, config.jwtSecret);
  const query = parseQuery(new URL(req.raw.url, 'http://localhost').searchParams);
  const prefer = parsePrefer(req.headers.prefer);
  const single = wantsObject(req);
  const representation = prefer.return === 'representation';
  const ctx = new Ctx();
  const okStatus = verb === 'insert' ? 201 : representation ? 200 : 204;

  const plan = await resolve((sch) => {
    const t = getTable(sch, req.params.table);
    let stmt;
    if (verb === 'insert') {
      if (Array.isArray(req.body) && req.body.length === 0) return { empty: true };
      stmt = buildInsert(t, req.body ?? {}, query, prefer, ctx);
    } else if (verb === 'update') stmt = buildUpdate(t, req.body, query, ctx);
    else stmt = buildDelete(t, query, ctx);
    if (stmt === null) return { empty: true };
    if (!representation) return { stmt };
    // Écriture + relecture dans la même requête : le select s'applique aux lignes écrites.
    const r = buildRead(sch, t, query, ctx, { from: '"m"', maxRows: 1_000_000, single, applyFilters: false });
    return { stmt: `WITH "m" AS (${stmt} RETURNING ${verb === 'insert' ? '*' : '"t0".*'}) ${r.rows}` };
  });

  if (plan.empty) {
    if (single) singleOrThrow(0);
    return representation ? reply.code(okStatus).type(JSON_TYPE).send('[]') : reply.code(okStatus).send();
  }
  const out = await withIdentity(who, {}, async (db) => {
    const res = await db.query(plan.stmt, ctx.params);
    const r = representation ? res.rows[0] : { n: res.rowCount, body: null };
    if (single) singleOrThrow(r.n); // lève → ROLLBACK : rien n'est écrit
    return r;
  });
  reply.code(okStatus).header('content-range', verb === 'update' ? contentRange(0, out.n, prefer.count ? out.n : null) : `*/${prefer.count ? out.n : '*'}`);
  return representation ? reply.type(JSON_TYPE).send(out.body ?? '[]') : reply.send();
}

async function rpc(req, reply) {
  checkProfile(req);
  const who = authenticate(req.headers, config.jwtSecret);
  const ctx = new Ctx();
  const call = await resolve((sch) => buildRpc(sch, req.params.fn, req.body ?? {}, ctx));
  const row = await withIdentity(who, {}, async (db) => (await db.query(call.sql, ctx.params)).rows[0]);
  if (call.kind === 'void') return reply.code(204).send();
  reply.header('content-range', contentRange(0, row.n ?? 1, null));
  if (wantsObject(req)) {
    const v = JSON.parse(row.body);
    if (Array.isArray(v)) { singleOrThrow(v.length); return reply.type(JSON_TYPE).send(JSON.stringify(v[0])); }
  }
  return reply.type(JSON_TYPE).send(row.body ?? 'null');
}

export function restRoutes(app) {
  app.post('/rest/v1/rpc/:fn', rpc);
  app.get('/rest/v1/:table', read); // HEAD est dérivé automatiquement par Fastify
  app.post('/rest/v1/:table', (req, reply) => write(req, reply, 'insert'));
  app.patch('/rest/v1/:table', (req, reply) => {
    if (req.body === undefined) throw badRequest('Corps JSON requis');
    return write(req, reply, 'update');
  });
  app.delete('/rest/v1/:table', (req, reply) => write(req, reply, 'delete'));
}
