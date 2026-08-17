/**
 * Prérendu SEO au build (postbuild).
 *
 * La SPA injecte le <head> par JavaScript (SEO.tsx) → invisible pour les crawlers
 * qui n'exécutent pas le JS (LinkedIn, Facebook, WhatsApp, Bing partiellement).
 * Ce script génère, pour chaque page publique, un fichier HTML statique avec
 * le bon <title>, meta description/keywords, canonical, Open Graph/Twitter et
 * JSON-LD — directement dans le HTML servi par Netlify.
 *
 * Les pages statiques (accueil, services, légal, etc.) ont leurs métadonnées
 * définies ci-dessous. Les formations et articles de blog sont lus dans
 * Supabase au build (lecture publique RLS).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Charger .env (Vite expose VITE_* au client mais le postbuild tourne hors Vite)
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

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
const course = (name, description, opts = {}) => ({
  '@context': 'https://schema.org', '@type': 'Course', name, description,
  provider: { '@type': 'Organization', '@id': `${SITE}/#organization`, name: 'Aissociate', url: SITE },
  inLanguage: 'fr-FR', courseMode: ['blended', 'onsite', 'online'],
  ...opts,
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
  {
    path: '/formulaire',
    title: 'Demande de devis — Aissociate, formation IA à La Réunion',
    description: "Formulaire de demande de contact pour vos projets de formation IA, assistance ou développement sur-mesure. Organisme certifié Qualiopi à La Réunion.",
    keywords: 'devis formation IA, demande de contact formation IA, formulaire inscription formation, organisme formation IA La Réunion',
    schemas: [breadcrumb([{ name: 'Accueil', url: SITE }, { name: 'Contact', url: `${SITE}/contact` }, { name: 'Demande de devis', url: `${SITE}/formulaire` }])],
  },
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

// ── Fetch helper (défensif : en l'absence d'accès, on saute sans faire échouer le build) ──
async function fetchJson(url) {
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!process.env.VITE_SUPABASE_URL || !anon) return null;
  try {
    const res = await fetch(url, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Formations : lues dans Supabase (lecture publique RLS) ──
async function prerenderFormations() {
  const baseUrl = process.env.VITE_SUPABASE_URL;
  if (!baseUrl) { console.log('[prerender] Formations ignorées (VITE_SUPABASE_URL absent).'); return 0; }
  const formations = await fetchJson(
    `${baseUrl}/rest/v1/formations?select=slug,intitule,objectifs,duree_heures,prix,prix_intra,public_vise,certifiante,reference&actif=eq.true&order=slug.asc`
  );
  if (!formations || !Array.isArray(formations)) {
    console.log('[prerender] Formations ignorées (pas de données).');
    return 0;
  }
  let n = 0;
  for (const f of formations) {
    if (!f.slug) continue;
    const u = `${SITE}/formations/${f.slug}`;
    const objectifs = f.objectifs ? String(f.objectifs).split('\n').map(s => s.trim()).filter(Boolean) : [];
    const desc = `${f.intitule}. ${f.duree_heures || 7}h, formation certifiée Qualiopi, finançable ${f.certifiante ? 'CPF et OPCO' : 'OPCO'}. Présentiel à La Réunion ou distanciel.`;
    const courseSchema = course(f.intitule, objectifs[0] || desc, {
      timeRequired: f.duree_heures ? `PT${f.duree_heures}H` : undefined,
      offers: {
        '@type': 'Offer',
        price: f.prix_intra || f.prix || '0',
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: u,
        validFrom: new Date().toISOString().slice(0, 10),
      },
    });
    writeRoute({
      path: `/formations/${f.slug}`,
      title: `${f.intitule} — Formation IA | Aissociate`,
      description: desc,
      keywords: `${f.intitule}, formation IA, Qualiopi, ${f.certifiante ? 'CPF, ' : ''}OPCO, intelligence artificielle, La Réunion`,
      schemas: [courseSchema, breadcrumb([
        { name: 'Accueil', url: SITE },
        { name: 'Formations', url: `${SITE}/formations` },
        { name: f.intitule, url: u },
      ])],
    });
    n++;
  }
  return n;
}

// ── Articles de blog : lus dans Supabase (lecture publique RLS) ──
async function prerenderBlog() {
  const baseUrl = process.env.VITE_SUPABASE_URL;
  if (!baseUrl) { console.log('[prerender] Blog ignoré (VITE_SUPABASE_URL absent).'); return 0; }
  const articles = await fetchJson(
    `${baseUrl}/rest/v1/blog_articles?select=slug,title,excerpt,seo_title,seo_description,seo_keywords,image_url,author,published_at,updated_at&published=eq.true&order=published_at.desc`
  );
  if (!articles || !Array.isArray(articles)) {
    console.log('[prerender] Blog ignoré (pas de données).');
    return 0;
  }
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
}

// ── Sitemap dynamique : pages statiques + formations + articles de blog ──
async function generateSitemap(formations, blogArticles) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];

  // Pages statiques
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/formations', priority: '0.95', changefreq: 'weekly' },
    { loc: '/assistance', priority: '0.75', changefreq: 'monthly' },
    { loc: '/developpement', priority: '0.75', changefreq: 'monthly' },
    { loc: '/aides-formation', priority: '0.8', changefreq: 'monthly' },
    { loc: '/blog', priority: '0.85', changefreq: 'daily' },
    { loc: '/contact', priority: '0.75', changefreq: 'monthly' },
    { loc: '/formulaire', priority: '0.7', changefreq: 'monthly' },
    { loc: '/mentions-legales', priority: '0.3', changefreq: 'yearly' },
    { loc: '/confidentialite', priority: '0.3', changefreq: 'yearly' },
    { loc: '/accessibilite', priority: '0.3', changefreq: 'yearly' },
    { loc: '/reclamations', priority: '0.3', changefreq: 'yearly' },
  ];
  for (const p of staticPages) {
    urls.push(`  <url>\n    <loc>${SITE}${p.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`);
  }

  // Formations
  for (const f of formations) {
    if (!f.slug) continue;
    urls.push(`  <url>\n    <loc>${SITE}/formations/${f.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>`);
  }

  // Articles de blog
  for (const a of blogArticles) {
    if (!a.slug) continue;
    const lastmod = (a.updated_at || a.published_at || today).slice(0, 10);
    urls.push(`  <url>\n    <loc>${SITE}/blog/${a.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  writeFileSync(join(DIST, 'sitemap.xml'), xml, 'utf8');
}

// ── Exécution ──
const formationCount = await prerenderFormations();
const blogCount = await prerenderBlog();

// Récupérer les données pour le sitemap (réutilise le cache fetch si possible)
const baseUrl = process.env.VITE_SUPABASE_URL;
let formationsForSitemap = [];
let blogForSitemap = [];
if (baseUrl) {
  formationsForSitemap = await fetchJson(`${baseUrl}/rest/v1/formations?select=slug&actif=eq.true`) || [];
  blogForSitemap = await fetchJson(`${baseUrl}/rest/v1/blog_articles?select=slug,published_at,updated_at&published=eq.true`) || [];
}
await generateSitemap(formationsForSitemap, blogForSitemap);

console.log(`[prerender] ${count} pages statiques + ${formationCount} formations + ${blogCount} articles de blog générés (<head> + JSON-LD). Sitemap mis à jour.`);
