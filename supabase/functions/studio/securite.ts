// Authentification propre au Studio IA (comptes clients hors Supabase Auth).
// Hash : PBKDF2-SHA256 (Web Crypto natif, aucune dépendance).
// Session : jeton opaque aléatoire remis au navigateur ; seul son SHA-256 est stocké.

const ITERATIONS = 150_000;
const enc = new TextEncoder();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Comparaison à temps constant (évite de révéler la position du 1er écart). */
function egal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Format stocké : pbkdf2_sha256$<itérations>$<sel b64>$<hash b64>. */
export async function hasherMotDePasse(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2_sha256$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifierMotDePasse(password: string, stocke: string): Promise<boolean> {
  const [algo, iter, salt, hash] = stocke.split("$");
  if (algo !== "pbkdf2_sha256" || !iter || !salt || !hash) return false;
  const calc = await pbkdf2(password, unb64(salt), Number(iter));
  return egal(calc, unb64(hash));
}

/** Hash factice : même coût de calcul quand l'e-mail est inconnu (pas d'énumération par le temps de réponse). */
export async function calculFactice(password: string): Promise<void> {
  await pbkdf2(password, new Uint8Array(16), ITERATIONS);
}

export function nouveauJeton(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sha256(texte: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(texte))));
}

/** Règle minimale : 10 caractères, au moins une lettre et un chiffre. */
export function motDePasseValide(p: string): string | null {
  if (p.length < 10) return "Le mot de passe doit contenir au moins 10 caractères.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  if (p.length > 200) return "Mot de passe trop long.";
  return null;
}
