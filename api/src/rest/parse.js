// Analyse de la syntaxe de requête envoyée par supabase-js (protocole PostgREST),
// limitée au sous-ensemble utilisé par l'application. Ce module ne produit
// aucun SQL : il renvoie des structures que build.js valide contre le schéma.
import { badRequest } from '../errors.js';

const CASTS = new Set(['text', 'int', 'integer', 'bigint', 'numeric', 'date', 'timestamptz', 'uuid', 'boolean', 'float8', 'json', 'jsonb']);
const COMPARE = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'cs', 'cd', 'ov']);
const FTS = new Set(['fts', 'plfts', 'phfts', 'wfts']);
const IS_VALUES = new Set(['null', 'true', 'false', 'unknown']);

/** Découpe sur `sep` hors parenthèses et hors guillemets doubles. */
export function splitTopLevel(str, sep = ',') {
  const out = [];
  let depth = 0, quoted = false, cur = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quoted) {
      cur += ch;
      if (ch === '\\' && i + 1 < str.length) cur += str[++i];
      else if (ch === '"') quoted = false;
      continue;
    }
    if (ch === '"') { quoted = true; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) throw badRequest('Parenthèses déséquilibrées');
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (depth !== 0 || quoted) throw badRequest('Parenthèses ou guillemets déséquilibrés');
  out.push(cur);
  return out;
}

function unquote(v) {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\(.)/g, '$1');
  return v;
}

/** `col`, `col->key`, `col->>key` (clés alphanumériques uniquement). */
export function parseColumnRef(str) {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)((?:->>?[A-Za-z0-9_]+)*)$/.exec(str);
  if (!m) throw badRequest(`Référence de colonne invalide : ${str.slice(0, 80)}`);
  const path = [];
  for (const p of m[2].matchAll(/(->>?)([A-Za-z0-9_]+)/g)) path.push({ op: p[1], key: p[2] });
  return { name: m[1], path };
}

function stripSpaces(str) {
  let out = '', quoted = false;
  for (const ch of str) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && /\s/.test(ch)) continue;
    out += ch;
  }
  return out;
}

/** select=col,alias:col,col->>k,rel(...),rel!inner(...),alias:rel!fk(...) */
export function parseSelect(raw, depth = 0) {
  if (depth > 4) throw badRequest('Trop de niveaux de relations imbriquées');
  const str = stripSpaces(raw ?? '*');
  if (str === '') return [];
  return splitTopLevel(str).map((item) => {
    if (item === '*') return { kind: 'star' };
    const emb = /^(?:([A-Za-z_][A-Za-z0-9_]*):)?([A-Za-z_][A-Za-z0-9_]*)((?:![A-Za-z_][A-Za-z0-9_]*)*)\((.*)\)$/s.exec(item);
    if (emb) {
      const hints = emb[3].split('!').filter(Boolean);
      const inner = hints.includes('inner');
      const fk = hints.filter((h) => h !== 'inner' && h !== 'left');
      if (fk.length > 1) throw badRequest(`Relation invalide : ${item.slice(0, 80)}`);
      return { kind: 'embed', alias: emb[1] ?? null, name: emb[2], hint: fk[0] ?? null, inner, select: parseSelect(emb[4], depth + 1) };
    }
    const col = /^(?:([A-Za-z_][A-Za-z0-9_]*):)?([^:]+?)(?:::([a-z0-9]+))?$/.exec(item);
    if (!col) throw badRequest(`Élément de select invalide : ${item.slice(0, 80)}`);
    if (col[3] && !CASTS.has(col[3])) throw badRequest(`Conversion non autorisée : ${col[3]}`);
    return { kind: 'col', alias: col[1] ?? null, ref: parseColumnRef(col[2]), cast: col[3] ?? null };
  });
}

/** `[not.]op.valeur` → condition. `inLogic` : valeur éventuellement entre guillemets. */
export function parseCondition(ref, str, inLogic = false) {
  let s = str, negate = false;
  if (s.startsWith('not.')) { negate = true; s = s.slice(4); }
  const dot = s.indexOf('.');
  const opRaw = dot < 0 ? s : s.slice(0, dot);
  let value = dot < 0 ? '' : s.slice(dot + 1);
  const fts = /^(fts|plfts|phfts|wfts)(?:\(([A-Za-z_]+)\))?$/.exec(opRaw);
  if (fts) return { type: 'cond', ref, negate, op: fts[1], config: fts[2] ?? null, value: inLogic ? unquote(value) : value };
  if (!COMPARE.has(opRaw)) throw badRequest(`Opérateur non pris en charge : ${opRaw.slice(0, 40)}`);
  if (opRaw === 'in') {
    if (!value.startsWith('(') || !value.endsWith(')')) throw badRequest('Liste attendue pour "in" : (a,b,c)');
    const inner = value.slice(1, -1);
    value = inner === '' ? [] : splitTopLevel(inner).map(unquote);
  } else if (opRaw === 'is') {
    value = value.toLowerCase();
    if (!IS_VALUES.has(value)) throw badRequest('Valeur attendue pour "is" : null, true, false ou unknown');
  } else if (inLogic) {
    value = unquote(value);
  }
  return { type: 'cond', ref, negate, op: opRaw, value };
}

/** or=(a.eq.1,b.ilike.%x%,and(c.is.null,d.gt.2)) */
export function parseLogic(kind, raw, negate = false, depth = 0) {
  if (depth > 4) throw badRequest('Trop de niveaux de conditions imbriquées');
  if (!raw.startsWith('(') || !raw.endsWith(')')) throw badRequest(`Parenthèses attendues pour "${kind}"`);
  const children = splitTopLevel(raw.slice(1, -1)).map((el) => {
    const nested = /^(not\.)?(and|or)(\(.*\))$/s.exec(el);
    if (nested) return parseLogic(nested[2], nested[3], Boolean(nested[1]), depth + 1);
    const dot = el.indexOf('.');
    if (dot < 0) throw badRequest(`Condition invalide : ${el.slice(0, 80)}`);
    return parseCondition(parseColumnRef(el.slice(0, dot)), el.slice(dot + 1), true);
  });
  return { type: kind, negate, children };
}

/** order=col.desc.nullslast,col2 */
export function parseOrder(raw) {
  return splitTopLevel(raw).filter(Boolean).map((item) => {
    const [col, ...mods] = item.split('.');
    const o = { ref: parseColumnRef(col), dir: 'ASC', nulls: null };
    for (const m of mods) {
      if (m === 'asc') o.dir = 'ASC';
      else if (m === 'desc') o.dir = 'DESC';
      else if (m === 'nullsfirst') o.nulls = 'NULLS FIRST';
      else if (m === 'nullslast') o.nulls = 'NULLS LAST';
      else throw badRequest(`Tri invalide : ${item.slice(0, 80)}`);
    }
    return o;
  });
}

export function parseInt0(raw, name) {
  if (raw == null) return null;
  if (!/^\d{1,9}$/.test(raw)) throw badRequest(`${name} invalide`);
  return Number(raw);
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

/** Paramètres d'URL → requête structurée. */
export function parseQuery(searchParams) {
  const q = { select: null, order: [], limit: null, offset: null, onConflict: null, columns: null, filters: [], embedFilters: new Map() };
  for (const [key, value] of searchParams) {
    if (key === 'select') q.select = value;
    else if (key === 'order') q.order = parseOrder(value);
    else if (key === 'limit') q.limit = parseInt0(value, 'limit');
    else if (key === 'offset') q.offset = parseInt0(value, 'offset');
    else if (key === 'on_conflict') q.onConflict = value.split(',').map((c) => parseColumnRef(c.trim()).name);
    else if (key === 'columns') q.columns = splitTopLevel(value).map((c) => parseColumnRef(unquote(c.trim())).name);
    else if (key === 'and' || key === 'or') q.filters.push(parseLogic(key, value));
    else if (key === 'not.and' || key === 'not.or') q.filters.push(parseLogic(key.slice(4), value, true));
    else if (key.includes('.')) {
      const [rel, col, ...rest] = key.split('.');
      if (rest.length || RESERVED.has(col)) throw badRequest(`Paramètre non pris en charge : ${key.slice(0, 80)}`);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(rel)) throw badRequest(`Relation invalide : ${rel.slice(0, 80)}`);
      if (!q.embedFilters.has(rel)) q.embedFilters.set(rel, []);
      q.embedFilters.get(rel).push(parseCondition(parseColumnRef(col), value));
    } else q.filters.push(parseCondition(parseColumnRef(key), value));
  }
  q.selectItems = parseSelect(q.select);
  return q;
}

export function parsePrefer(header) {
  const p = { return: null, count: null, resolution: null };
  for (const part of String(header ?? '').split(',')) {
    const [k, v] = part.trim().split('=');
    if (k === 'return' && ['representation', 'minimal', 'headers-only'].includes(v)) p.return = v;
    else if (k === 'count' && ['exact', 'planned', 'estimated'].includes(v)) p.count = v;
    else if (k === 'resolution' && ['merge-duplicates', 'ignore-duplicates'].includes(v)) p.resolution = v;
  }
  return p;
}

export { FTS };
