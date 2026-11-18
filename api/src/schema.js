// Cache du schéma `public` : seule source de vérité pour les noms de tables,
// colonnes, relations et fonctions. Tout identifiant reçu d'un client est
// comparé à ce cache avant d'apparaître dans une requête SQL.
import { pool } from './db.js';

const SQL_TABLES = `
select c.relname as name,
  (select json_agg(json_build_object('name', a.attname, 'type', format_type(a.atttypid, null)) order by a.attnum)
     from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns,
  (select json_agg(a.attname order by array_position(i.indkey::int2[], a.attnum))
     from pg_index i join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
    where i.indrelid = c.oid and i.indisprimary) as pk,
  (select json_agg(u.cols) from (
     select (select json_agg(a.attname) from pg_attribute a where a.attrelid = c.oid and a.attnum = any(i.indkey)) as cols
       from pg_index i where i.indrelid = c.oid and i.indisunique and i.indpred is null) u) as uniques
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')`;

const SQL_FKS = `
select con.conname as name, c1.relname as child, c2.relname as parent,
  (select json_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(attnum, ord)
     join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as child_cols,
  (select json_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(attnum, ord)
     join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as parent_cols
from pg_constraint con
join pg_class c1 on c1.oid = con.conrelid join pg_namespace n1 on n1.oid = c1.relnamespace
join pg_class c2 on c2.oid = con.confrelid join pg_namespace n2 on n2.oid = c2.relnamespace
where con.contype = 'f' and n1.nspname = 'public' and n2.nspname = 'public'`;

const SQL_FUNCTIONS = `
select p.proname as name, p.proretset as retset, t.typtype as rettyptype, t.typname as rettype,
  coalesce(p.proargnames, '{}') as argnames,
  p.proargmodes::text[] as argmodes,
  (select array_agg(format_type(u.t, null) order by u.ord)
     from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality u(t, ord)) as argtypes,
  p.pronargdefaults as ndefaults
from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type t on t.oid = p.prorettype
where n.nspname = 'public' and p.prokind = 'f' and t.typname <> 'trigger'`;

let cache = null;
let loadedAt = 0;

export async function loadSchema() {
  const [tables, fks, fns] = await Promise.all([pool.query(SQL_TABLES), pool.query(SQL_FKS), pool.query(SQL_FUNCTIONS)]);
  const next = { tables: new Map(), fks: fks.rows, functions: new Map() };
  for (const t of tables.rows) {
    next.tables.set(t.name, {
      name: t.name,
      columns: new Map((t.columns ?? []).map((c) => [c.name, c.type])),
      pk: t.pk ?? [],
      uniques: (t.uniques ?? []).filter(Boolean),
    });
  }
  for (const f of fns.rows) {
    const inputs = [];
    (f.argtypes ?? []).forEach((type, i) => {
      const mode = f.argmodes ? f.argmodes[i] : 'i';
      if (mode === 'i' || mode === 'b' || mode === 'v') inputs.push({ name: f.argnames[i] ?? '', type });
    });
    const def = { name: f.name, retset: f.retset, rettyptype: f.rettyptype, rettype: f.rettype, inputs, ndefaults: f.ndefaults };
    if (!next.functions.has(f.name)) next.functions.set(f.name, []);
    next.functions.get(f.name).push(def);
  }
  cache = next;
  loadedAt = Date.now();
  return cache;
}

export function schema() {
  if (!cache) throw new Error('Schéma non chargé');
  return cache;
}

/** Recharge le cache au plus une fois toutes les 10 s (table ou fonction créée depuis). */
export async function reloadIfStale() {
  if (Date.now() - loadedAt < 10_000) return false;
  await loadSchema();
  return true;
}
