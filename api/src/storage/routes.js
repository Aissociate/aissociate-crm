// Routes /storage/v1 : mêmes URL et formats que le stockage de Supabase, pour
// les six opérations utilisées (upload, download, lien signé, lien public,
// copie, suppression). Les droits viennent des policies de storage.objects :
// chaque opération lit ou écrit cette table sous l'identité de l'appelant.
import multipart from '@fastify/multipart';
import { config } from '../config.js';
import { withIdentity } from '../db.js';
import { StorageError } from '../errors.js';
import { authenticate, signJwt, verifyJwt } from '../jwt.js';
import { commitTemp, copyToTemp, discard, removeObject, sendObject, writeTemp } from './files.js';

const S = config.storage;
const SERVICE = { role: 'service_role', claims: { role: 'service_role' } };
// Même jeu de caractères que Supabase pour les noms d'objets.
const NAME_RE = /^[\w/!\-.*'() &$@=;:+,?]+$/;
const BUCKET_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;
const COLS = 'id, bucket_id, name, owner, metadata, created_at, updated_at, last_accessed_at';

export function checkName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 1024 || !NAME_RE.test(name)
    || name.startsWith('/') || name.endsWith('/') || name.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) {
    throw new StorageError(400, 'InvalidKey', `Invalid key: ${String(name).slice(0, 80)}`);
  }
  return name;
}

function checkBucket(bucket) {
  if (typeof bucket !== 'string' || !BUCKET_RE.test(bucket)) throw new StorageError(404, 'Bucket not found', 'Bucket not found');
  return bucket;
}

const notFound = () => new StorageError(404, 'not_found', 'Object not found');

function who(req) {
  try { return authenticate(req.headers, config.jwtSecret); } catch { throw new StorageError(401, 'Unauthorized', 'Clé API ou jeton invalide'); }
}

function mapPg(err) {
  if (err instanceof StorageError) return err;
  if (err.code === '42501') return new StorageError(403, 'Unauthorized', 'new row violates row-level security policy');
  if (err.code === '23505') return new StorageError(409, 'Duplicate', 'The resource already exists');
  if (err.code === '23503') return new StorageError(404, 'Bucket not found', 'Bucket not found');
  return err;
}

async function getBucket(id) {
  const r = await withIdentity(SERVICE, { readOnly: true }, (db) => db.query('select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = $1', [id]));
  if (!r.rows[0]) throw new StorageError(404, 'Bucket not found', 'Bucket not found');
  return r.rows[0];
}

async function findObject(identity, bucket, name) {
  const r = await withIdentity(identity, { readOnly: true }, (db) => db.query(`select ${COLS} from storage.objects where bucket_id = $1 and name = $2`, [bucket, name]));
  if (!r.rows[0]) throw notFound(); // absent ou non autorisé : même réponse
  return r.rows[0];
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req.body ?? []) {
    size += c.length;
    if (size > 1024 * 1024) throw new StorageError(413, 'Payload too large', 'Corps trop volumineux');
    chunks.push(c);
  }
  try { return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch { throw new StorageError(400, 'InvalidRequest', 'Corps JSON invalide'); }
}

function mimeAllowed(bucket, mime) {
  const list = bucket.allowed_mime_types;
  if (!list?.length) return true;
  return list.some((m) => m === mime || (m.endsWith('/*') && mime.startsWith(m.slice(0, -1))));
}

async function upload(req, reply, forceUpsert) {
  const identity = who(req);
  const bucketId = checkBucket(req.params.bucket);
  const name = checkName(req.params['*']);
  const bucket = await getBucket(bucketId);
  const upsert = forceUpsert || String(req.headers['x-upsert'] ?? '').toLowerCase() === 'true';
  const limit = Math.min(bucket.file_size_limit ?? S.maxFileSize, S.maxFileSize);

  let stream, mimetype, cacheControl = 'no-cache';
  if (req.isMultipart()) {
    const part = await req.file();
    if (!part) throw new StorageError(400, 'InvalidRequest', 'Fichier manquant');
    stream = part.file;
    mimetype = part.mimetype;
    const cc = part.fields?.cacheControl?.value;
    if (/^\d{1,9}$/.test(String(cc ?? ''))) cacheControl = `max-age=${cc}`;
  } else {
    stream = req.body;
    mimetype = String(req.headers['content-type'] ?? '').split(';')[0].trim();
    const cc = /max-age=(\d{1,9})/.exec(req.headers['cache-control'] ?? '');
    if (cc) cacheControl = `max-age=${cc[1]}`;
  }
  if (!stream || typeof stream.pipe !== 'function') throw new StorageError(400, 'InvalidRequest', 'Fichier manquant');
  mimetype = /^[\w.+-]+\/[\w.+-]+$/.test(mimetype ?? '') ? mimetype : 'application/octet-stream';
  if (!mimeAllowed(bucket, mimetype)) throw new StorageError(415, 'invalid_mime_type', `mime type ${mimetype} is not supported`);

  const { tmp, size, etag } = await writeTemp(stream, limit);
  if (stream.truncated) { await discard(tmp); throw new StorageError(413, 'Payload too large', 'The object exceeded the maximum allowed size'); }
  const metadata = JSON.stringify({ eTag: etag, size, mimetype, cacheControl, lastModified: new Date().toISOString(), contentLength: size, httpStatusCode: 200 });
  try {
    const id = await withIdentity(identity, {}, async (db) => {
      // L'écriture en base (soumise aux policies) et la mise en place du fichier
      // se valident ensemble : si l'une échoue, rien ne change.
      const r = await db.query(
        `insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, auth.uid(), $3)
         ${upsert ? 'on conflict (bucket_id, name) do update set metadata = excluded.metadata, updated_at = now(), last_accessed_at = now()' : ''}
         returning id`,
        [bucketId, name, metadata],
      );
      await commitTemp(tmp, bucketId, r.rows[0].id);
      return r.rows[0].id;
    });
    return reply.code(200).send({ Id: id, Key: `${bucketId}/${name}` });
  } catch (err) {
    await discard(tmp);
    throw mapPg(err);
  }
}

export async function storageRoutes(app) {
  // Dans ce périmètre, les corps ne sont jamais chargés en mémoire : flux bruts
  // (y compris le JSON, lu à la main avec une limite de taille).
  app.removeAllContentTypeParsers();
  await app.register(multipart, { limits: { fileSize: S.maxFileSize, files: 1, fields: 10, fieldSize: 100_000 } });
  app.addContentTypeParser('*', (_req, payload, done) => done(null, payload));
  app.setErrorHandler((err, req, reply) => {
    const e = mapPg(err);
    if (e instanceof StorageError) return reply.code(e.status).type('application/json; charset=utf-8').send(JSON.stringify(e));
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).type('application/json; charset=utf-8').send(JSON.stringify(new StorageError(err.statusCode, 'InvalidRequest', err.message)));
    req.log.error(err);
    return reply.code(500).type('application/json; charset=utf-8').send(JSON.stringify(new StorageError(500, 'Internal', 'Erreur interne')));
  });

  const big = { bodyLimit: S.maxFileSize + 1024 * 1024 };
  app.post('/storage/v1/object/:bucket/*', big, (req, reply) => upload(req, reply, false));
  app.put('/storage/v1/object/:bucket/*', big, (req, reply) => upload(req, reply, true));

  // Fichier d'un bucket public : aucune identité requise.
  app.get('/storage/v1/object/public/:bucket/*', async (req, reply) => {
    const bucket = await getBucket(checkBucket(req.params.bucket));
    if (!bucket.public) throw notFound();
    const row = await findObject(SERVICE, bucket.id, checkName(req.params['*']));
    return sendObject(req, reply, bucket.id, row, { download: req.query.download });
  });

  // Lien signé : création (droit de lecture requis) puis accès par le seul jeton.
  app.post('/storage/v1/object/sign/:bucket/*', async (req, reply) => {
    const identity = who(req);
    const bucket = checkBucket(req.params.bucket);
    const name = checkName(req.params['*']);
    const body = await readJson(req);
    const expiresIn = Number(body.expiresIn);
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > S.maxSignedUrlSeconds) throw new StorageError(400, 'InvalidRequest', 'expiresIn invalide');
    await findObject(identity, bucket, name);
    const token = signJwt({ url: `${bucket}/${name}`, typ: 'storage-signed-url' }, config.jwtSecret, expiresIn);
    return reply.send({ signedURL: `/object/sign/${bucket}/${name}?token=${token}` });
  });

  app.get('/storage/v1/object/sign/:bucket/*', async (req, reply) => {
    const bucket = checkBucket(req.params.bucket);
    const name = checkName(req.params['*']);
    let claims;
    try { claims = verifyJwt(req.query.token, config.jwtSecret); } catch { throw new StorageError(400, 'InvalidJWT', 'Lien expiré ou invalide'); }
    if (claims.typ !== 'storage-signed-url' || claims.url !== `${bucket}/${name}`) throw new StorageError(400, 'InvalidSignature', 'Lien expiré ou invalide');
    const row = await findObject(SERVICE, bucket, name);
    return sendObject(req, reply, bucket, row, { download: req.query.download });
  });

  app.post('/storage/v1/object/copy', async (req, reply) => {
    const identity = who(req);
    const body = await readJson(req);
    const srcBucket = checkBucket(body.bucketId);
    const dstBucket = checkBucket(body.destinationBucket ?? body.bucketId);
    const src = checkName(body.sourceKey);
    const dst = checkName(body.destinationKey);
    await getBucket(dstBucket);
    const source = await findObject(identity, srcBucket, src);
    const tmp = await copyToTemp(srcBucket, source.id).catch(() => { throw notFound(); });
    try {
      const id = await withIdentity(identity, {}, async (db) => {
        const r = await db.query(
          'insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, auth.uid(), $3) returning id',
          [dstBucket, dst, JSON.stringify({ ...source.metadata, lastModified: new Date().toISOString() })],
        );
        await commitTemp(tmp, dstBucket, r.rows[0].id);
        return r.rows[0].id;
      });
      return reply.send({ Id: id, Key: `${dstBucket}/${dst}` });
    } catch (err) {
      await discard(tmp);
      throw mapPg(err);
    }
  });

  app.delete('/storage/v1/object/:bucket', async (req, reply) => {
    const identity = who(req);
    const bucket = checkBucket(req.params.bucket);
    const body = await readJson(req);
    if (!Array.isArray(body.prefixes) || body.prefixes.length > 1000) throw new StorageError(400, 'InvalidRequest', 'prefixes : tableau de 1000 noms au plus');
    const names = body.prefixes.map(checkName);
    if (!names.length) return reply.send([]);
    const rows = await withIdentity(identity, {}, async (db) =>
      (await db.query(`delete from storage.objects where bucket_id = $1 and name = any($2) returning ${COLS}`, [bucket, names])).rows);
    // Les fichiers ne sont retirés qu'après validation de la suppression en base.
    await Promise.all(rows.map((r) => removeObject(bucket, r.id)));
    return reply.send(rows);
  });

  // Téléchargement sous l'identité de l'appelant.
  const download = async (req, reply) => {
    const identity = who(req);
    const bucket = checkBucket(req.params.bucket);
    const row = await findObject(identity, bucket, checkName(req.params['*']));
    return sendObject(req, reply, bucket, row, { download: req.query.download });
  };
  app.get('/storage/v1/object/authenticated/:bucket/*', download);
  app.get('/storage/v1/object/:bucket/*', download);
}
