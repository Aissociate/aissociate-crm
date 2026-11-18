import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDelete, buildInsert, buildRead, buildRpc, buildUpdate, Ctx } from '../../src/rest/build.js';
import { parseQuery, parseSelect } from '../../src/rest/parse.js';
import { signJwt, verifyJwt } from '../../src/jwt.js';

const table = (name, cols, pk = ['id'], uniques = [['id']]) => ({ name, columns: new Map(cols.map((c) => [c, 'text'])), pk, uniques });
const sch = {
  tables: new Map([
    ['contacts', table('contacts', ['id', 'nom', 'prenom', 'email', 'owner_id', 'meta'])],
    ['contact_actions', table('contact_actions', ['id', 'contact_id', 'type', 'faite', 'date_action'])],
    ['parametres', table('parametres', ['id', 'cle', 'valeur'], ['id'], [['id'], ['cle']])],
  ]),
  fks: [{ name: 'contact_actions_contact_id_fkey', child: 'contact_actions', parent: 'contacts', child_cols: ['contact_id'], parent_cols: ['id'] }],
  functions: new Map([['is_manager', [{ name: 'is_manager', retset: false, rettyptype: 'b', rettype: 'bool', inputs: [], ndefaults: 0 }]],
    ['log_audit', [{ name: 'log_audit', retset: false, rettyptype: 'p', rettype: 'void', inputs: [{ name: 'p_action', type: 'text' }, { name: 'p_details', type: 'jsonb' }], ndefaults: 1 }]]]),
};
const qs = (s) => parseQuery(new URLSearchParams(s));
const read = (tbl, s) => {
  const ctx = new Ctx();
  const t = sch.tables.get(tbl);
  return { sql: buildRead(sch, t, qs(s), ctx, { from: `public."${tbl}"`, maxRows: 1000 }), params: ctx.params };
};

test('filtres simples : valeurs en paramètres uniquement', () => {
  const { sql, params } = read('contacts', 'select=id,nom&nom=ilike.*dup*&owner_id=eq.abc&order=nom.desc.nullslast&limit=10&offset=20');
  assert.match(sql.rows, /"t0"\."nom" ILIKE \$1 AND "t0"\."owner_id" = \$2/);
  assert.match(sql.rows, /ORDER BY "t0"\."nom" DESC NULLS LAST LIMIT 10 OFFSET 20/);
  assert.deepEqual(params, ['%dup%', 'abc']);
});

test('or imbriqué, in, is, not', () => {
  const { sql, params } = read('contacts', 'or=(owner_id.is.null,owner_id.not.in.(a,"b,c"),and(nom.eq.x,prenom.neq.y))&email=not.is.null');
  assert.match(sql.rows, /\("t0"\."owner_id" IS NULL OR NOT \("t0"\."owner_id" = ANY\(\$1\)\) OR \("t0"\."nom" = \$2 AND "t0"\."prenom" <> \$3\)\)/);
  assert.match(sql.rows, /NOT \("t0"\."email" IS NULL\)/);
  assert.deepEqual(params, [['a', 'b,c'], 'x', 'y']);
});

test('relation à-un, à-plusieurs et !inner avec filtre', () => {
  const one = read('contact_actions', 'select=id,contacts(nom,prenom)');
  assert.match(one.sql.rows, /LEFT JOIN LATERAL \(SELECT row_to_json\(s\) AS data FROM \(SELECT .* FROM public\."contacts" AS "t1"  WHERE "t1"\."id" = "t0"\."contact_id" LIMIT 1\) s\)/);
  const many = read('contacts', 'select=*,contact_actions!inner(id)&contact_actions.faite=eq.false');
  assert.match(many.sql.rows, /json_agg\(s\).*"t1"\."contact_id" = "t0"\."id" AND "t1"\."faite" = \$1/);
  assert.match(many.sql.rows, /json_array_length\("e2"\.data\) > 0/);
});

test('chemin JSON et alias', () => {
  const { sql, params } = read('contacts', 'select=m:meta->>ville&meta->>ville=eq.Saint-Denis');
  assert.match(sql.rows, /\("t0"\."meta"->>'ville'\) AS "m"/);
  assert.match(sql.rows, /\("t0"\."meta"->>'ville'\) = \$1/);
  assert.deepEqual(params, ['Saint-Denis']);
});

test('tentatives d\'injection refusées ou neutralisées', () => {
  const bad = [
    'select=id;drop table contacts',
    'select=id,nom")--',
    'select=contacts(id);',
    'nom";drop table x;--=eq.1',
    'order=nom;drop table x',
    'order=nom.desc;--',
    'select=nom::regclass',
    "select=meta->>'x'",
    'nom=inconnu.1',
    'nom=is.null;--',
    'limit=10;drop',
    'offset=-1',
    'colonne_absente=eq.1',
    'select=mot_de_passe',
    'select=table_absente(id)',
    'or=(nom.eq.1',
    'nom=fts(english);x).a',
  ];
  for (const s of bad) assert.throws(() => read('contacts', s), (e) => e.status >= 300 && e.status < 500, s);
  // Une valeur hostile reste une valeur : elle part en paramètre, pas dans le SQL.
  const hostile = "x'); drop table contacts;--";
  const { sql, params } = read('contacts', `nom=eq.${encodeURIComponent(hostile)}&or=(prenom.eq."${hostile}")`);
  assert.ok(!sql.rows.includes('drop table'));
  assert.deepEqual(params, [hostile, hostile]);
  assert.throws(() => buildRead(sch, { name: 'x";drop', columns: new Map(), pk: [], uniques: [] }, qs('a=eq.1'), new Ctx(), { from: 'x', maxRows: 1 }));
});

test('plafond de lignes', () => {
  assert.match(read('contacts', 'limit=50000').sql.rows, /LIMIT 1000 OFFSET 0/);
  assert.match(read('contacts', '').sql.rows, /LIMIT 1000 OFFSET 0/);
});

test('insert, upsert, update, delete', () => {
  const t = sch.tables.get('parametres');
  let ctx = new Ctx();
  const ins = buildInsert(t, [{ cle: 'a', valeur: 1 }], qs('on_conflict=cle'), { resolution: 'merge-duplicates' }, ctx);
  assert.match(ins, /INSERT INTO public\."parametres" \("cle", "valeur"\) SELECT "cle", "valeur" FROM json_populate_recordset/);
  assert.match(ins, /ON CONFLICT \("cle"\) DO UPDATE SET "cle" = EXCLUDED\."cle", "valeur" = EXCLUDED\."valeur"/);
  assert.deepEqual(ctx.params, ['[{"cle":"a","valeur":1}]']);
  assert.throws(() => buildInsert(t, { 'cle") values (1);--': 1 }, qs(''), {}, new Ctx()), (e) => e.status === 400);
  assert.throws(() => buildInsert(t, 'texte', qs(''), {}, new Ctx()), (e) => e.status === 400);

  ctx = new Ctx();
  assert.match(buildUpdate(t, { valeur: 2 }, qs('cle=eq.a'), ctx), /UPDATE public\."parametres" AS "t0" SET "valeur" = _\."valeur" FROM json_populate_record\(.*\) AS _ WHERE "t0"\."cle" = \$2/);
  assert.throws(() => buildUpdate(t, { valeur: 2 }, qs(''), new Ctx()), (e) => e.code === '21000');
  assert.throws(() => buildDelete(t, qs(''), new Ctx()), (e) => e.code === '21000');
  assert.match(buildDelete(t, qs('cle=in.(a,b)'), new Ctx()), /DELETE FROM public\."parametres" AS "t0" WHERE "t0"\."cle" = ANY\(\$1\)/);
});

test('rpc : arguments nommés, fonction inconnue refusée', () => {
  const ctx = new Ctx();
  const r = buildRpc(sch, 'log_audit', { p_action: 'x', p_details: { a: [1] } }, ctx);
  assert.equal(r.sql, 'SELECT public."log_audit"("p_action" := $1, "p_details" := $2)');
  assert.deepEqual(ctx.params, ['x', '{"a":[1]}']);
  assert.equal(buildRpc(sch, 'is_manager', {}, new Ctx()).sql, 'SELECT to_json(public."is_manager"())::text AS body');
  assert.throws(() => buildRpc(sch, 'pg_sleep', { seconds: 10 }, new Ctx()), (e) => e.status === 404);
  assert.throws(() => buildRpc(sch, 'log_audit', { p_action: 'x', 'x); drop': 1 }, new Ctx()), (e) => e.status === 404);
  assert.throws(() => buildRpc(sch, 'log_audit', {}, new Ctx()), (e) => e.status === 404);
});

test('select : profondeur limitée', () => {
  assert.throws(() => parseSelect('a(b(c(d(e(f(g(id)))))))'), (e) => e.status === 400);
});

test('jwt : signature, expiration, algorithme', () => {
  const secret = 's3cret-de-test-suffisamment-long';
  const ok = signJwt({ role: 'authenticated', sub: 'u1' }, secret, 60);
  assert.equal(verifyJwt(ok, secret).sub, 'u1');
  assert.throws(() => verifyJwt(ok, 'autre-secret'), (e) => e.status === 401);
  assert.throws(() => verifyJwt(signJwt({ role: 'anon' }, secret, -10), secret), /expired/);
  const [h, p] = ok.split('.');
  const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${p}.`;
  assert.throws(() => verifyJwt(none, secret), (e) => e.status === 401);
  const forged = `${h}.${Buffer.from('{"role":"service_role"}').toString('base64url')}.${ok.split('.')[2]}`;
  assert.throws(() => verifyJwt(forged, secret), (e) => e.status === 401);
});
