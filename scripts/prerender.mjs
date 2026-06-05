/**
 * Prérendu SEO au build (postbuild).
 *
 * La SPA injecte le <head> par JavaScript (SEO.tsx) → invisible pour les crawlers
 * qui n'exécutent pas le JS (LinkedIn, Facebook, WhatsApp, Bing partiellement).
 * Ce script génère, pour chaque page publique clé, un fichier HTML statique avec
 * le bon <title>, meta description/keywords, canonical, Open Graph/Twitter et
 * JSON-LD — directement dans le HTML servi par Netlify.
 *
 * ⚠️ Les méta ci-dessous doivent rester alignées avec les <SEO> des pages
 *    correspondantes (src/site/pages/*). C'est volontairement dupliqué pour
 *    rester sans dépendance ni refonte du runtime.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const SITE = 'https://aissociate.re';
const OG_IMAGE = 'https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg';

const tpl = readFileSync(join(DIST, 'index.html'), 'utf8');

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ld = (obj) => `<script type="application/ld+json" data-prerender="true">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

const ORG = {
  '@context': 'https://schema.org',
  '@type': ['EducationalOrganization', 'LocalBusiness'],
  '@id': `${SITE}/#organization`,
  name: 'Aissociate',
  description: "Organisme de formation certifié Qualiopi spécialisé en intelligence artificielle générative à La Réunion. Formations finançables CPF, OPCO et France Travail.",
  url: SITE,
  logo: { '@type': 'ImageObject', url: OG_IMAGE },
  image: OG_IMAGE,
  email: 'contact@aissociate.re',
  telephone: '+262692246860',
  address: { '@type': 'PostalAddress', streetAddress: "36 chemin de l'État Major", addressLocality: 'Saint-Denis', postalCode: '97417', addressCountry: 'RE' },
  hasCredential: { '@type': 'EducationalOccupationalCredential', name: 'Certification Qualiopi' },
  sameAs: [SITE],
};
const WEBSITE = {
  '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#website`,
  name: 'Aissociate — Formation IA Générative', url: SITE, inLanguage: 'fr-FR',
};
const breadcrumb = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
});
const course = (name) => ({
  '@context': 'https://schema.org', '@type': 'Course', name,
  provider: { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'Aissociate', url: SITE },
  inLanguage: 'fr-FR', courseMode: ['blended', 'onsite', 'online'],
});

const FORMATIONS = [
  { id: 'closer-ia-cpf', title: 'Formation Closer IA éligible CPF — Certifiante Qualiopi' },
  { id: 'creation-contenus-ia', title: "Création de contenus par l'IA générative — Certifiante CPF" },
  { id: 'introduction-ia-pme', title: 'Introduction aux IA pour les PME' },
  { id: 'automatisation-process-pme', title: 'Automatisation des process des PME avec l\'IA' },
  { id: 'marches-publics-btp-ia', title: 'Réponse aux marchés publics BTP avec l\'IA' },
  { id: 'ia-relation-client', title: "L'IA pour optimiser la relation client" },
  { id: 'ia-marketing-communication', title: "L'IA pour le marketing et la communication" },
  { id: 'ia-prospection-commerciale', title: "L'IA pour la prospection commerciale" },
  { id: 'ia-ressources-humaines', title: "L'IA pour les ressources humaines" },
  { id: 'ia-manager', title: "L'IA au service du manager" },
];

const routes = [
  {
    path: '/',
    title: 'Formation IA à La Réunion — Qualiopi, CPF & OPCO | Aissociate',
    description: "Organisme de formation certifié Qualiopi à La Réunion. Formez vos équipes à l'IA générative : ChatGPT, prompt engineering, automatisation des process. Finançable CPF, OPCO, France Travail — présentiel ou distanciel.",
    keywords: 'formation IA La Réunion, formation intelligence artificielle Réunion, formation IA 974, formation IA Qualiopi, formation IA CPF, OPCO intelligence artificielle, ChatGPT entreprise, IA générative PME, automatisation IA, prompt engineering',
    schemas: [WEBSITE, ORG, breadcrumb([{ name: 'Accueil', url: SITE }])],
  },
  {
    path: '/formations',
    title: 'Catalogue de formations IA — Qualiopi, CPF & OPCO | Aissociate',
    description: 'Découvrez nos formations en intelligence artificielle à La Réunion : création de contenus IA, IA pour PME, prospection, marketing, RH, management. Certifiées Qualiopi, finançables CPF et OPCO.',
    keywords: 'catalogue formation IA, formations intelligence artificielle Réunion, formation IA PME, formation IA marketing, formation IA RH, formation prospection IA, Qualiopi, CPF, OPCO',
    schemas: [breadcrumb([{ name: 'Accueil', url: SITE }, { name: 'Formations', url: `${SITE}/formations` }])],
  },
  {
    path: '/assistance',
    title: 'Assistance & chatbots IA pour entreprises | Aissociate',
    description: "Déployez des assistants IA pour votre entreprise à La Réunion : support client 24/7, chatbots, qualification de leads, FAQ automatisée. Accompagnement par un organisme certifié Qualiopi.",
    keywords: 'assistant IA entreprise, chatbot IA, support client IA, qualification de leads IA, automatisation relation client, IA La Réunion',
    schemas: [breadcrumb([{ name: 'Accueil', url: SITE }, { name: 'Assistance', url: `${SITE}/assistance` }])],
  },
  {
    path: '/developpement',
    title: "Développement d'agents IA & automatisation sur-mesure | Aissociate",
    description: "Création d'agents IA et automatisation des process pour les entreprises réunionnaises : intégrations sur-mesure, workflows intelligents, gain de productivité.",
    keywords: 'développement agent IA, automatisation process IA, agents IA sur-mesure, intégration IA entreprise, workflow IA, IA Réunion',
    schemas: [breadcrumb([{ name: 'Accueil', url: SITE }, { name: 'Développement', url: `${SITE}/developpement` }])],
  },
  {
    path: '/aides-formation',
    title: 'Financer sa formation IA : CPF, OPCO, France Travail | Aissociate',
    description: "Toutes les aides pour financer votre formation en intelligence artificielle : CPF, OPCO, France Travail, plan de développement des compétences. Accompagnement par un organisme Qualiopi à La Réunion.",
    keywords: 'financement formation IA, CPF formation IA, OPCO formation, aide formation France Travail, financer formation intelligence artificielle, Qualiopi',
    schemas: [breadcrumb([{ name: 'Accueil', url: SITE }, { name: 'Aides au financement', url: `${SITE}/aides-formation` }])],
  },
  {
    path: '/blog',
    title: 'Blog IA — Actualités, conseils et formations | Aissociate',
    description: "Articles sur l'intelligence artificielle générative, le CPF, l'automatisation des PME et les tendances IA. Conseils pratiques par un organisme certifié Qualiopi.",
    keywords: 'blog intelligence artificielle, actualités IA, formation IA PME, IA générative conseils, ChatGPT entreprise, automatisation IA, CPF formation IA',
    schemas: [breadcrumb([{ name: 'Accueil', url: SITE }, { name: 'Blog', url: `${SITE}/blog` }])],
  },
  {
    path: '/contact',
    title: 'Contact — Aissociate, formation IA à La Réunion (Qualiopi)',
    description: "Contactez Aissociate, organisme de formation en intelligence artificielle certifié Qualiopi à La Réunion. Devis, financement CPF / OPCO, inscriptions.",
    keywords: 'contact Aissociate, formation IA Réunion contact, devis formation IA, organisme formation IA La Réunion',
    schemas: [breadcrumb([{ name: 'Accueil', url: SITE }, { name: 'Contact', url: `${SITE}/contact` }])],
  },
  // Formations (détail)
  ...FORMATIONS.map((f) => ({
    path: `/formations/${f.id}`,
    title: `${f.title} — Formation IA | Aissociate`,
    description: `${f.title}. Formation professionnelle en intelligence artificielle, certifiée Qualiopi, finançable CPF / OPCO, à La Réunion ou à distance.`,
    keywords: `${f.title}, formation IA, Qualiopi, CPF, OPCO, intelligence artificielle`,
    schemas: [course(f.title), breadcrumb([{ name: 'Accueil', url: SITE }, { name: 'Formations', url: `${SITE}/formations` }, { name: f.title, url: `${SITE}/formations/${f.id}` }])],
  })),
  // Pages légales
  { path: '/mentions-legales', title: 'Mentions légales | Aissociate', description: "Mentions légales d'Aissociate, organisme de formation IA certifié Qualiopi à La Réunion." },
  { path: '/confidentialite', title: 'Politique de confidentialité | Aissociate', description: "Politique de confidentialité et protection des données (RGPD) d'Aissociate." },
  { path: '/accessibilite', title: 'Accessibilité | Aissociate', description: "Accessibilité et accueil des personnes en situation de handicap dans les formations Aissociate." },
  { path: '/reclamations', title: 'Réclamations | Aissociate', description: "Procédure de réclamation et de traitement des litiges d'Aissociate (organisme Qualiopi)." },
];

function applyHead(html, r) {
  const url = r.path === '/' ? SITE + '/' : SITE + r.path;
  const set = (re, val) => { html = html.replace(re, val); };
  set(/<title>[\s\S]*?<\/title>/, `<title>${esc(r.title)}</title>`);
  set(/(<meta name="description" content=")[^"]*(")/, `$1${esc(r.description)}$2`);
  if (r.keywords) set(/(<meta name="keywords" content=")[^"]*(")/, `$1${esc(r.keywords)}$2`);
  set(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(url)}$2`);
  set(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(r.title)}$2`);
  set(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(r.description)}$2`);
  set(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`);
  set(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(r.title)}$2`);
  set(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(r.description)}$2`);
  const schemas = (r.schemas ?? []).map(ld).join('\n    ');
  if (schemas) html = html.replace('</head>', `    ${schemas}\n  </head>`);
  return html;
}

let count = 0;
for (const r of routes) {
  const html = applyHead(tpl, r);
  const outDir = r.path === '/' ? DIST : join(DIST, r.path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf8');
  count++;
}
console.log(`[prerender] ${count} pages générées avec <head> + JSON-LD statiques.`);
