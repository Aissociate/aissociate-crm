/**
 * Génère les icônes PNG du manifeste (Capture mobile installée sur l'écran
 * d'accueil Android) : dégradé de marque + glyphe micro, aux mêmes couleurs que
 * favicon.svg.
 *
 * Écrit dans /public — à relancer seulement si l'identité visuelle change :
 *   node scripts/gen-icons.mjs
 *
 * Encodeur PNG maison (zlib de Node) : aucune dépendance graphique à installer.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const OR = [0xf7, 0xa8, 0x23]; // #f7a823
const RD = [0xea, 0x3c, 0x2a]; // #ea3c2a

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Couverture d'un rectangle à coins arrondis en (x, y), 1 = plein. */
function dansRoundRect(x, y, x0, y0, w, h, r) {
  if (x < x0 || y < y0 || x > x0 + w || y > y0 + h) return false;
  const cx = Math.min(Math.max(x, x0 + r), x0 + w - r);
  const cy = Math.min(Math.max(y, y0 + r), y0 + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Un pixel du glyphe micro (blanc) : capsule + arc + pied. */
function dansMicro(x, y, N, echelle) {
  const c = N / 2;
  const u = (v) => v * N * echelle; // unités relatives à la taille de l'icône
  const capsuleW = u(0.22), capsuleH = u(0.42);
  const capsuleX = c - capsuleW / 2, capsuleY = c - u(0.34);
  if (dansRoundRect(x, y, capsuleX, capsuleY, capsuleW, capsuleH, capsuleW / 2)) return true;

  // Arc sous la capsule (demi-anneau ouvert vers le bas).
  const rExt = u(0.32), rInt = u(0.25);
  const dx = x - c, dy = y - (capsuleY + capsuleH - u(0.06));
  const d = Math.hypot(dx, dy);
  if (dy >= 0 && d <= rExt && d >= rInt) return true;

  // Pied : tige verticale + socle.
  const tigeW = u(0.07);
  if (dansRoundRect(x, y, c - tigeW / 2, capsuleY + capsuleH + u(0.20), tigeW, u(0.14), tigeW / 2)) return true;
  const socleW = u(0.36), socleH = u(0.075);
  if (dansRoundRect(x, y, c - socleW / 2, capsuleY + capsuleH + u(0.32), socleW, socleH, socleH / 2)) return true;
  return false;
}

function rendre(N, { maskable = false } = {}) {
  const rayon = maskable ? 0 : N * (15 / 64);
  // Maskable : Android rogne les bords, le glyphe reste dans la zone sûre.
  const echelle = maskable ? 0.78 : 1;
  const SS = 3; // suréchantillonnage → bords lissés
  const px = Buffer.alloc(N * N * 4);

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let fond = 0, glyphe = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;
          if (rayon === 0 || dansRoundRect(fx, fy, 0, 0, N, N, rayon)) fond += 1;
          if (dansMicro(fx, fy, N, echelle)) glyphe += 1;
        }
      }
      const aFond = fond / (SS * SS);
      const aGlyphe = clamp01(glyphe / (SS * SS)) * aFond;

      const t = clamp01((x + y) / (2 * N)); // dégradé diagonal
      const i = (y * N + x) * 4;
      for (let k = 0; k < 3; k++) {
        const base = OR[k] + (RD[k] - OR[k]) * t;
        px[i + k] = Math.round(base * (1 - aGlyphe) + 255 * aGlyphe);
      }
      px[i + 3] = Math.round(aFond * 255);
    }
  }
  return px;
}

function png(N, pixels) {
  const brut = Buffer.alloc(N * (N * 4 + 1));
  for (let y = 0; y < N; y++) {
    brut[y * (N * 4 + 1)] = 0; // filtre « None »
    pixels.copy(brut, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const corps = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corps) >>> 0);
    return Buffer.concat([len, corps, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(brut, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

for (const [nom, taille, opts] of [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['icon-maskable.png', 512, { maskable: true }],
]) {
  writeFileSync(join(PUBLIC, nom), png(taille, rendre(taille, opts)));
  console.log(`✓ public/${nom}`);
}
