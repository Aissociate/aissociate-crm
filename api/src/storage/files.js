// Fichiers sur disque. Un objet est rangé sous <bucket>/<identifiant uuid> :
// le nom choisi par l'utilisateur ne sert jamais à construire un chemin.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, mkdir, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from '../config.js';
import { StorageError } from '../errors.js';

const ROOT = config.storage.dir;
const TMP = path.join(ROOT, '.tmp');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET_RE = /^[a-z0-9][a-z0-9_-]{0,62}$/;

export function objectPath(bucket, id) {
  if (!BUCKET_RE.test(bucket) || !UUID_RE.test(id)) throw new StorageError(400, 'InvalidKey', 'Invalid key');
  return path.join(ROOT, bucket, id);
}

/** Écrit le flux dans un fichier temporaire ; refuse au-delà de `limit` octets. */
export async function writeTemp(stream, limit) {
  await mkdir(TMP, { recursive: true });
  const tmp = path.join(TMP, randomUUID());
  const md5 = createHash('md5');
  let size = 0;
  const meter = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length;
      if (size > limit) return cb(new StorageError(413, 'Payload too large', 'The object exceeded the maximum allowed size'));
      md5.update(chunk);
      cb(null, chunk);
    },
  });
  try {
    await pipeline(stream, meter, createWriteStream(tmp, { flags: 'wx', mode: 0o600 }));
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
  return { tmp, size, etag: `"${md5.digest('hex')}"` };
}

export async function commitTemp(tmp, bucket, id) {
  const dest = objectPath(bucket, id);
  await mkdir(path.dirname(dest), { recursive: true });
  await rename(tmp, dest);
}

export async function copyToTemp(bucket, id) {
  await mkdir(TMP, { recursive: true });
  const tmp = path.join(TMP, randomUUID());
  await copyFile(objectPath(bucket, id), tmp);
  return tmp;
}

export const discard = (file) => unlink(file).catch(() => {});
export const removeObject = (bucket, id) => unlink(objectPath(bucket, id)).catch(() => {});

/** Envoie le fichier, avec prise en charge d'une plage d'octets (lecture vidéo). */
export async function sendObject(req, reply, bucket, row, { download } = {}) {
  const file = objectPath(bucket, row.id);
  let st;
  try { st = await stat(file); } catch { throw new StorageError(404, 'not_found', 'Object not found'); }
  const meta = row.metadata ?? {};
  reply
    .header('content-type', meta.mimetype || 'application/octet-stream')
    .header('cache-control', meta.cacheControl || 'no-cache')
    .header('accept-ranges', 'bytes')
    .header('last-modified', st.mtime.toUTCString())
    // Un fichier déposé par un utilisateur ne doit jamais s'exécuter comme une page.
    .header('x-content-type-options', 'nosniff')
    .header('content-security-policy', "default-src 'none'; sandbox");
  if (meta.eTag) reply.header('etag', meta.eTag);
  if (download !== undefined) {
    const name = String(download || path.posix.basename(row.name)).replace(/[\r\n"\\]/g, '_');
    reply.header('content-disposition', `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && (range[1] || range[2]) && st.size > 0) {
    let start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
    let end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) {
      return reply.code(416).header('content-range', `bytes */${st.size}`).send();
    }
    reply.code(206).header('content-range', `bytes ${start}-${end}/${st.size}`).header('content-length', end - start + 1);
    return reply.send(req.method === 'HEAD' ? '' : createReadStream(file, { start, end }));
  }
  reply.header('content-length', st.size);
  return reply.send(req.method === 'HEAD' ? '' : createReadStream(file));
}
