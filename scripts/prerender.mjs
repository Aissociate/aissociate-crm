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
const faqPage = (items) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: items.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
});

// ⚠️ À garder aligné avec la FAQ rendue dans src/site/pages/OrganismHome.tsx
const HOME_FAQ = [
  { question: "Vos formations en intelligence artificielle sont-elles éligibles au CPF ?", answer: "Oui. Plusieurs de nos formations IA sont certifiantes et éligibles au CPF. Les autres sont finançables via votre OPCO, France Travail ou le plan de développement des compétences de votre entreprise." },
  { question: "AIssociate est-il un organisme de formation certifié Qualiopi ?", answer: "Oui, AIssociate est un organisme de formation certifié Qualiopi — gage de qualité reconnu par l'État et condition d'accès aux financements (CPF, OPCO, France Travail)." },
  { question: "Proposez-vous des formations IA à La Réunion et à distance ?", answer: "Oui. Nos formations en intelligence artificielle se déroulent à La Réunion en présentiel, ou en classe virtuelle à distance." },
  { question: "Faut-il des prérequis techniques pour se former à l'IA ?", answer: "Non. Nos formations s'adressent aux dirigeants, équipes et PME sans compétence technique : la maîtrise des outils informatiques de base suffit." },
  { question: "Combien de temps dure une formation en intelligence artificielle ?", answer: "De 7 h (1 jour) pour les formations d'initiation à 21 h (3 jours) pour les parcours certifiants." },
  { question: "Quels outils d'IA apprend-on (ChatGPT, prompt engineering…) ?", answer: "Vous apprenez à utiliser les principaux outils d'IA générative (ChatGPT, génération d'images, assistants) et le prompt engineering, via des cas pratiques." },
];

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
    schemas: [WEBSITE, ORG, faqPage(HOME_FAQ), breadcrumb([{ name: 'Accueil', url: SITE }])],
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
  if (r.ogType) set(/(<meta property="og:type" content=")[^"]*(")/, `$1${esc(r.ogType)}$2`);
  if (r.image) {
    set(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(r.image)}$2`);
    set(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${esc(r.image)}$2`);
  }
  const schemas = (r.schemas ?? []).map(ld).join('\n    ');
  if (schemas) html = html.replace('</head>', `    ${schemas}\n  </head>`);
  return html;
}

function writeRoute(r) {
  const html = applyHead(tpl, r);
  const outDir = r.path === '/' ? DIST : join(DIST, r.path);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf8');
}

let count = 0;
for (const r of routes) { writeRoute(r); count++; }

// ── Articles de blog : lus dans Supabase au build (lecture publique RLS) ──
// Nécessite VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY dans l'environnement de build.
// Défensif : en l'absence d'accès, on saute sans faire échouer le build.
async function prerenderBlog() {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.log('[prerender] Blog ignoré (VITE_SUPABASE_URL / ANON_KEY absents du build).');
    return 0;
  }
  try {
    const q = `${url}/rest/v1/blog_articles?select=slug,title,excerpt,seo_title,seo_description,seo_keywords,image_url,author,published_at,updated_at&published=eq.true&order=published_at.desc`;
    const res = await fetch(q, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
    if (!res.ok) { console.log(`[prerender] Blog ignoré (HTTP ${res.status}).`); return 0; }
    const articles = await res.json();
    let n = 0;
    for (const a of articles) {
      if (!a.slug) continue;
      const u = `${SITE}/blog/${a.slug}`;
      const img = a.image_url || OG_IMAGE;
      const desc = a.seo_description || a.excerpt || a.title;
      const article = {
        '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': `${u}#article`,
        headline: a.title, description: desc, image: img, url: u,
        datePublished: a.published_at, dateModified: a.updated_at || a.published_at,
        author: { '@type': 'Organization', name: a.author || 'Aissociate' },
        publisher: { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'Aissociate', logo: { '@type': 'ImageObject', url: OG_IMAGE } },
        mainEntityOfPage: u, inLanguage: 'fr-FR',
      };
      writeRoute({
        path: `/blog/${a.slug}`,
        title: `${a.seo_title || a.title} | Aissociate`,
        description: desc,
        keywords: a.seo_keywords || '',
        image: img,
        ogType: 'article',
        schemas: [article, breadcrumb([{ name: 'Accueil', url: SITE }, { name: 'Blog', url: `${SITE}/blog` }, { name: a.title, url: u }])],
      });
      n++;
    }
    return n;
  } catch (e) {
    console.log('[prerender] Blog ignoré (erreur fetch) :', String(e));
    return 0;
  }
}

const blogCount = await prerenderBlog();
console.log(`[prerender] ${count} pages statiques + ${blogCount} articles de blog générés (<head> + JSON-LD).`);
