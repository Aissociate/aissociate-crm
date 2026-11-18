// Génération du SQL. Deux règles de sécurité, sans exception :
//  1. tout identifiant (table, colonne, relation, fonction) vient du cache de
//     schéma — jamais directement de la requête ;
//  2. toute valeur est passée en paramètre ($1, $2…), jamais concaténée.
import { ApiError, badRequest } from '../errors.js';
import { FTS } from './parse.js';

export const q = (id) => `"${String(id).replace(/"/g, '""')}"`;
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

export class Ctx {
  params = [];
  n = 0;
  p(value) { this.params.push(value); return `$${this.params.length}`; }
  alias(prefix) { return `${prefix}${++this.n}`; }
}

export function getTable(sch, name) {
  const t = sch.tables.get(name);
  if (!t) throw new ApiError(404, 'PGRST205', `Could not find the table 'public.${String(name).slice(0, 80)}' in the schema cache`);
  return t;
}

function checkColumn(t, name) {
  if (!t.columns.has(name)) throw badRequest(`column ${t.name}.${name} does not exist`, '42703');
  return name;
}

function checkPayloadColumn(t, name) {
  if (!t.columns.has(name)) throw new ApiError(400, 'PGRST204', `Could not find the '${String(name).slice(0, 80)}' column of '${t.name}' in the schema cache`);
  return name;
}

function colSql(t, alias, ref) {
  let s = `${q(alias)}.${q(checkColumn(t, ref.name))}`;
  if (!ref.path.length) return s;
  for (const p of ref.path) s += `${p.op}${/^\d+$/.test(p.key) ? p.key : lit(p.key)}`;
  return `(${s})`;
}

const SIMPLE = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', cs: '@>', cd: '<@', ov: '&&' };
const TSQUERY = { fts: 'to_tsquery', plfts: 'plainto_tsquery', phfts: 'phraseto_tsquery', wfts: 'websearch_to_tsquery' };

function condSql(t, alias, c, ctx) {
  if (c.type === 'and' || c.type === 'or') {
    if (!c.children.length) throw badRequest('Condition vide');
    const s = `(${c.children.map((ch) => condSql(t, alias, ch, ctx)).join(c.type === 'and' ? ' AND ' : ' OR ')})`;
    return c.negate ? `NOT ${s}` : s;
  }
  const X = colSql(t, alias, c.ref);
  let s;
  if (SIMPLE[c.op]) s = `${X} ${SIMPLE[c.op]} ${ctx.p(c.value)}`;
  else if (c.op === 'like') s = `${X} LIKE ${ctx.p(c.value.replaceAll('*', '%'))}`;
  else if (c.op === 'ilike') s = `${X} ILIKE ${ctx.p(c.value.replaceAll('*', '%'))}`;
  else if (c.op === 'is') s = `${X} IS ${c.value.toUpperCase()}`; // valeur en liste blanche (parse.js)
  else if (c.op === 'in') s = `${X} = ANY(${ctx.p(c.value)})`;
  else if (FTS.has(c.op)) {
    const cfg = c.config ? `${ctx.p(c.config)}::regconfig, ` : '';
    const isVector = !c.ref.path.length && t.columns.get(c.ref.name) === 'tsvector';
    s = `${isVector ? X : `to_tsvector(${cfg}${X})`} @@ ${TSQUERY[c.op]}(${cfg}${ctx.p(c.value)})`;
  }
  else throw badRequest(`Opérateur non pris en charge : ${c.op}`);
  return c.negate ? `NOT (${s})` : s;
}

function resolveRelation(sch, base, target, hint) {
  let cands = [];
  for (const fk of sch.fks) {
    if (fk.child === base && fk.parent === target) cands.push({ card: 'one', fk });
    else if (fk.child === target && fk.parent === base) cands.push({ card: 'many', fk });
  }
  if (hint) cands = cands.filter((c) => c.fk.name === hint || c.fk.child_cols.includes(hint));
  if (!cands.length) throw new ApiError(400, 'PGRST200', `Could not find a relationship between '${base}' and '${target}' in the schema cache`);
  if (cands.length > 1) throw new ApiError(300, 'PGRST201', `Could not embed because more than one relationship was found for '${base}' and '${target}'`);
  const rel = cands[0];
  if (rel.card === 'many') {
    // Clé étrangère unique côté enfant = relation un-à-un → objet et non tableau.
    const cols = [...rel.fk.child_cols].sort().join(',');
    const child = sch.tables.get(rel.fk.child);
    rel.o2o = child.uniques.some((u) => [...u].sort().join(',') === cols);
  }
  return rel;
}

/** Colonnes, jointures latérales et conditions (!inner) pour une liste de select. */
function selectSql(sch, t, alias, items, ctx, embedFilters) {
  const cols = [], joins = [], where = [];
  const usedFilters = new Set();
  for (const it of items) {
    if (it.kind === 'star') { cols.push(`${q(alias)}.*`); continue; }
    if (it.kind === 'col') {
      let s = colSql(t, alias, it.ref);
      if (it.cast) s = `${s}::${it.cast}`; // liste blanche (parse.js)
      const out = it.alias ?? (it.ref.path.length ? it.ref.path.at(-1).key : it.ref.name);
      cols.push(`${s} AS ${q(out)}`);
      continue;
    }
    const tt = getTable(sch, it.name);
    const rel = resolveRelation(sch, t.name, tt.name, it.hint);
    const a = ctx.alias('t'), e = ctx.alias('e');
    const out = it.alias ?? it.name;
    const inner = selectSql(sch, tt, a, it.select, ctx, new Map());
    const { fk } = rel;
    const on = rel.card === 'one'
      ? fk.child_cols.map((c, i) => `${q(a)}.${q(fk.parent_cols[i])} = ${q(alias)}.${q(c)}`)
      : fk.child_cols.map((c, i) => `${q(a)}.${q(c)} = ${q(alias)}.${q(fk.parent_cols[i])}`);
    const filters = (embedFilters.get(out) ?? []).map((c) => condSql(tt, a, c, ctx));
    usedFilters.add(out);
    const sub = `SELECT ${inner.cols.length ? inner.cols.join(', ') : '1 AS "_"'} FROM public.${q(tt.name)} AS ${q(a)} ${inner.joins.join(' ')} WHERE ${[...on, ...filters, ...inner.where].join(' AND ')}`;
    const asObject = rel.card === 'one' || rel.o2o;
    joins.push(asObject
      ? `LEFT JOIN LATERAL (SELECT row_to_json(s) AS data FROM (${sub} LIMIT 1) s) AS ${q(e)} ON true`
      : `LEFT JOIN LATERAL (SELECT coalesce(json_agg(s), '[]'::json) AS data FROM (${sub}) s) AS ${q(e)} ON true`);
    if (inner.cols.length) cols.push(`${q(e)}.data AS ${q(out)}`);
    if (it.inner) where.push(asObject ? `${q(e)}.data IS NOT NULL` : `json_array_length(${q(e)}.data) > 0`);
  }
  for (const name of embedFilters.keys()) {
    if (!usedFilters.has(name)) throw badRequest(`Filtre sur une relation absente du select : ${name}`);
  }
  return { cols, joins, where };
}

/**
 * Lecture. `from` : source SQL déjà sûre (table du schéma, ou CTE "m" d'une écriture).
 * Renvoie { rows, count } : deux requêtes partageant les mêmes paramètres.
 */
export function buildRead(sch, t, query, ctx, { from, maxRows, single = false, applyFilters = true }) {
  const sel = selectSql(sch, t, 't0', query.selectItems, ctx, query.embedFilters);
  if (!sel.cols.length) sel.cols.push(`${q('t0')}.*`);
  const where = [...(applyFilters ? query.filters.map((c) => condSql(t, 't0', c, ctx)) : []), ...sel.where];
  const base = `SELECT ${sel.cols.join(', ')} FROM ${from} AS "t0" ${sel.joins.join(' ')}${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
  const order = query.order.length
    ? ` ORDER BY ${query.order.map((o) => `${colSql(t, 't0', o.ref)} ${o.dir}${o.nulls ? ` ${o.nulls}` : ''}`).join(', ')}`
    : '';
  const limit = Math.min(query.limit ?? maxRows, maxRows);
  const offset = query.offset ?? 0;
  const page = `${base}${order} LIMIT ${limit} OFFSET ${offset}`;
  const body = single ? `(json_agg(q)->0)::text` : `coalesce(json_agg(q), '[]'::json)::text`;
  return {
    rows: `SELECT ${body} AS body, count(*)::int AS n FROM (${page}) q`,
    count: `SELECT count(*)::int AS total FROM (${base}) c`,
    offset,
  };
}

function payloadSource(t, P) {
  return `json_populate_recordset(null::public.${q(t.name)}, CASE WHEN json_typeof(${P}::json) = 'array' THEN ${P}::json ELSE json_build_array(${P}::json) END)`;
}

export function buildInsert(t, body, query, prefer, ctx) {
  const rows = Array.isArray(body) ? body : [body];
  for (const r of rows) {
    if (r === null || typeof r !== 'object' || Array.isArray(r)) throw badRequest('Corps attendu : objet JSON ou tableau d\'objets');
  }
  const cols = (query.columns ?? Object.keys(rows[0] ?? {})).map((c) => checkPayloadColumn(t, c));
  const list = cols.map(q).join(', ');
  let sql = cols.length
    ? `INSERT INTO public.${q(t.name)} (${list}) SELECT ${list} FROM ${payloadSource(t, ctx.p(JSON.stringify(body)))} AS _`
    : `INSERT INTO public.${q(t.name)} DEFAULT VALUES`;
  if (prefer.resolution) {
    const target = (query.onConflict ?? t.pk).map((c) => checkColumn(t, c));
    if (!target.length) throw badRequest('on_conflict requis : la table n\'a pas de clé primaire');
    const tgt = `(${target.map(q).join(', ')})`;
    sql += prefer.resolution === 'merge-duplicates' && cols.length
      ? ` ON CONFLICT ${tgt} DO UPDATE SET ${cols.map((c) => `${q(c)} = EXCLUDED.${q(c)}`).join(', ')}`
      : ` ON CONFLICT ${tgt} DO NOTHING`;
  }
  return sql;
}

function mutationWhere(t, query, ctx, verb) {
  if (query.embedFilters.size) throw badRequest('Filtre sur relation non pris en charge en écriture');
  // Même garde-fou que Supabase (pg-safeupdate) : jamais d'écriture sans filtre.
  if (!query.filters.length) throw new ApiError(400, '21000', `${verb} requires a WHERE clause`);
  return query.filters.map((c) => condSql(t, 't0', c, ctx)).join(' AND ');
}

export function buildUpdate(t, body, query, ctx) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Corps attendu : objet JSON');
  const cols = Object.keys(body).map((c) => checkPayloadColumn(t, c));
  if (!cols.length) return null;
  const P = ctx.p(JSON.stringify(body));
  return `UPDATE public.${q(t.name)} AS "t0" SET ${cols.map((c) => `${q(c)} = _.${q(c)}`).join(', ')} FROM json_populate_record(null::public.${q(t.name)}, ${P}::json) AS _ WHERE ${mutationWhere(t, query, ctx, 'UPDATE')}`;
}

export function buildDelete(t, query, ctx) {
  return `DELETE FROM public.${q(t.name)} AS "t0" WHERE ${mutationWhere(t, query, ctx, 'DELETE')}`;
}

/** Appel de fonction : arguments nommés, valeurs en paramètres. */
export function buildRpc(sch, name, args, ctx) {
  const overloads = sch.functions.get(name);
  const notFound = () => new ApiError(404, 'PGRST202', `Could not find the function public.${String(name).slice(0, 80)} in the schema cache`);
  if (!overloads) throw notFound();
  if (args === null || typeof args !== 'object' || Array.isArray(args)) throw badRequest('Arguments attendus : objet JSON');
  const given = Object.keys(args);
  const fn = overloads.find((f) => {
    const names = f.inputs.map((i) => i.name);
    const required = names.slice(0, names.length - f.ndefaults);
    return given.every((g) => names.includes(g)) && required.every((r) => given.includes(r));
  });
  if (!fn) throw notFound();
  const call = `public.${q(fn.name)}(${given.map((g) => {
    const type = fn.inputs.find((i) => i.name === g).type;
    const v = args[g];
    // json/jsonb : texte JSON ; le reste : valeur brute (pg convertit les tableaux).
    const value = v === null ? null : (type === 'json' || type === 'jsonb') ? JSON.stringify(v) : (typeof v === 'object' && !Array.isArray(v)) ? JSON.stringify(v) : v;
    return `${q(g)} := ${ctx.p(value)}`;
  }).join(', ')})`;
  if (fn.rettype === 'void') return { sql: `SELECT ${call}`, kind: 'void' };
  if (fn.retset) return { sql: `SELECT coalesce(json_agg(r), '[]'::json)::text AS body, count(*)::int AS n FROM ${call} AS r`, kind: 'json' };
  if (fn.rettyptype === 'c') return { sql: `SELECT row_to_json(r)::text AS body FROM ${call} AS r`, kind: 'json' };
  return { sql: `SELECT to_json(${call})::text AS body`, kind: 'json' };
}
