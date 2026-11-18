// Contexte technique joint automatiquement aux bugs signalés pendant la recette.
// Les dernières erreurs JavaScript sont gardées en mémoire dès le chargement du CRM.

const MAX_ERREURS = 8;
const erreurs: string[] = [];
let installe = false;

function noter(message: string) {
  const ligne = `${new Date().toLocaleTimeString('fr-FR')} ${message}`.slice(0, 400);
  erreurs.push(ligne);
  if (erreurs.length > MAX_ERREURS) erreurs.shift();
}

function texte(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

/** Branche la collecte des erreurs (idempotent). */
export function installerCollecteErreurs() {
  if (installe || typeof window === 'undefined') return;
  installe = true;
  window.addEventListener('error', (e) => noter(e.message || texte(e.error)));
  window.addEventListener('unhandledrejection', (e) => noter(`Promesse rejetée : ${texte(e.reason)}`));
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    noter(args.map(texte).join(' '));
    original(...args);
  };
}

function navigateur(): string {
  const ua = navigator.userAgent;
  const m = ua.match(/(Edg|OPR|Chrome|Firefox|Version)\/(\d+)/);
  const nom = !m ? 'inconnu' : m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1] === 'Version' ? 'Safari' : m[1];
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'OS inconnu';
  return `${nom} ${m?.[2] ?? ''} · ${os}`.trim();
}

/** Bloc texte ajouté à la fin de la description du ticket. */
export function contexteTechnique(utilisateur?: string | null): string {
  const lignes = [
    `Page : ${location.pathname}${location.search}${location.hash}`,
    `Titre : ${document.title}`,
    `Navigateur : ${navigateur()}`,
    `Fenêtre : ${window.innerWidth}×${window.innerHeight} (écran ${screen.width}×${screen.height}, zoom ${Math.round(window.devicePixelRatio * 100)} %)`,
    `Thème : ${document.documentElement.classList.contains('dark') ? 'sombre' : 'clair'}`,
    `Date : ${new Date().toLocaleString('fr-FR')}`,
  ];
  if (utilisateur) lignes.push(`Utilisateur : ${utilisateur}`);
  if (erreurs.length) lignes.push('', 'Dernières erreurs :', ...erreurs.map((e) => `• ${e}`));
  return `\n\n— Contexte technique —\n${lignes.join('\n')}`;
}
