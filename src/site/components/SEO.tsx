// @ts-nocheck
import { useEffect } from 'react';

export const SITE_URL = 'https://aissociate.fr';
export const SITE_NAME = 'Aissociate — Formation IA Générative';
export const DEFAULT_OG_IMAGE = 'https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg';

interface Breadcrumb { name: string; url: string }

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  imageAlt?: string;
  url?: string;
  type?: 'website' | 'article' | 'product' | 'course';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
  breadcrumbs?: Breadcrumb[];
  courseData?: {
    name: string;
    description: string;
    provider: string;
    duration: string;
    price: string;
    priceCurrency: string;
    educationalLevel: string;
    courseMode: string[];
    hasCourseInstance?: { startDate: string; endDate: string; location: string };
  };
  organizationData?: {
    name: string;
    description: string;
    url: string;
    logo: string;
    telephone?: string;
    email?: string;
    address?: { streetAddress: string; addressLocality: string; postalCode: string; addressCountry: string };
  };
  articleData?: {
    headline: string;
    description: string;
    image?: string;
    author: string;
    datePublished?: string;
    dateModified?: string;
    keywords?: string;
  };
  faqData?: { question: string; answer: string }[];
}

const defaultProps = {
  title: 'Formation IA Générative certifiée Qualiopi — Financement CPF & OPCO | Aissociate',
  description: 'Organisme de formation certifié Qualiopi. Maîtrisez l\'IA générative en 21h : ChatGPT, DALL-E, prompt engineering. Financement OPCO, CPF, France Travail. Présentiel ou distanciel.',
  keywords: 'formation intelligence artificielle, formation IA Qualiopi, ChatGPT formation, IA générative, formation CPF IA, OPCO intelligence artificielle, prompt engineering, formation professionnelle IA, PME intelligence artificielle, automatisation IA, Aissociate formation',
  image: DEFAULT_OG_IMAGE,
  imageAlt: 'Aissociate — Formation IA Générative certifiée Qualiopi',
  url: SITE_URL,
  type: 'website' as const,
};

function setMeta(attrs: Record<string, string>) {
  const key = attrs.name ? `meta[name="${attrs.name}"]` : `meta[property="${attrs.property}"]`;
  let el = document.querySelector(key) as HTMLMetaElement;
  if (!el) {
    el = document.createElement('meta');
    Object.entries(attrs).forEach(([k, v]) => { if (k !== 'content') el.setAttribute(k, v); });
    document.head.appendChild(el);
  }
  el.setAttribute('content', attrs.content);
}

export default function SEO(props: SEOProps) {
  const c = { ...defaultProps, ...props };
  const canonical = c.url || SITE_URL;
  const ogImage = c.image || DEFAULT_OG_IMAGE;

  useEffect(() => {
    document.title = c.title;
    document.documentElement.setAttribute('lang', 'fr');

    const metas = [
      // Fondamentaux
      { name: 'description', content: c.description },
      { name: 'keywords', content: c.keywords },
      { name: 'robots', content: c.noindex ? 'noindex, nofollow' : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' },
      { name: 'googlebot', content: c.noindex ? 'noindex' : 'index, follow' },
      { name: 'bingbot', content: c.noindex ? 'noindex' : 'index, follow' },
      { name: 'language', content: 'French' },
      { name: 'geo.region', content: 'FR' },
      { name: 'geo.placename', content: 'France' },
      { name: 'author', content: c.author || SITE_NAME },
      // Open Graph
      { property: 'og:type', content: c.type },
      { property: 'og:title', content: c.title },
      { property: 'og:description', content: c.description },
      { property: 'og:image', content: ogImage },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:type', content: 'image/jpeg' },
      { property: 'og:image:alt', content: c.imageAlt || c.title },
      { property: 'og:url', content: canonical },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:locale', content: 'fr_FR' },
      // Twitter / X
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: c.title },
      { name: 'twitter:description', content: c.description },
      { name: 'twitter:image', content: ogImage },
      { name: 'twitter:image:alt', content: c.imageAlt || c.title },
      // Mobile
      { name: 'format-detection', content: 'telephone=no' },
      { name: 'theme-color', content: '#ea6a1e' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    ];

    if (c.type === 'article' || c.articleData) {
      metas.push({ property: 'og:type', content: 'article' });
      if (c.author) metas.push({ property: 'article:author', content: c.author });
      if (c.publishedTime) metas.push({ property: 'article:published_time', content: c.publishedTime });
      if (c.modifiedTime) {
        metas.push({ property: 'article:modified_time', content: c.modifiedTime });
        metas.push({ property: 'og:updated_time', content: c.modifiedTime });
      }
      metas.push({ property: 'article:publisher', content: SITE_URL });
    }

    metas.forEach(setMeta);

    // Canonical
    let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonical);

    // JSON-LD : purge précédente
    document.querySelectorAll('script[data-seo="true"]').forEach(s => s.remove());

    const schemas: object[] = [];

    // WebSite (une seule fois, en homepage idéalement)
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: defaultProps.description,
      inLanguage: 'fr-FR',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/blog?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    });

    // Organization / LocalBusiness
    if (c.organizationData) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': ['EducationalOrganization', 'LocalBusiness'],
        '@id': `${SITE_URL}/#organization`,
        name: c.organizationData.name,
        description: c.organizationData.description,
        url: c.organizationData.url,
        logo: {
          '@type': 'ImageObject',
          url: c.organizationData.logo,
          width: 200,
          height: 60,
        },
        image: DEFAULT_OG_IMAGE,
        hasCredential: { '@type': 'EducationalOccupationalCredential', name: 'Certification Qualiopi' },
        sameAs: [SITE_URL],
        ...(c.organizationData.telephone && { telephone: c.organizationData.telephone }),
        ...(c.organizationData.email && { email: c.organizationData.email }),
        ...(c.organizationData.address && {
          address: {
            '@type': 'PostalAddress',
            streetAddress: c.organizationData.address.streetAddress,
            addressLocality: c.organizationData.address.addressLocality,
            postalCode: c.organizationData.address.postalCode,
            addressCountry: c.organizationData.address.addressCountry,
          },
        }),
      });
    }

    // Course
    if (c.courseData) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: c.courseData.name,
        description: c.courseData.description,
        url: canonical,
        image: ogImage,
        provider: {
          '@type': 'Organization',
          '@id': `${SITE_URL}/#organization`,
          name: c.courseData.provider,
          url: SITE_URL,
        },
        educationalLevel: c.courseData.educationalLevel,
        courseMode: c.courseData.courseMode,
        timeRequired: c.courseData.duration,
        inLanguage: 'fr-FR',
        offers: {
          '@type': 'Offer',
          price: c.courseData.price,
          priceCurrency: c.courseData.priceCurrency,
          availability: 'https://schema.org/InStock',
          url: canonical,
          validFrom: new Date().toISOString().slice(0, 10),
        },
        ...(c.courseData.hasCourseInstance && {
          hasCourseInstance: {
            '@type': 'CourseInstance',
            courseMode: 'blended',
            startDate: c.courseData.hasCourseInstance.startDate,
            endDate: c.courseData.hasCourseInstance.endDate,
            location: { '@type': 'Place', name: c.courseData.hasCourseInstance.location },
          },
        }),
      });
    }

    // BlogPosting / Article
    if (c.articleData) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        '@id': `${canonical}#article`,
        headline: c.articleData.headline,
        description: c.articleData.description,
        image: { '@type': 'ImageObject', url: c.articleData.image || ogImage, width: 1200, height: 630 },
        url: canonical,
        datePublished: c.articleData.datePublished || c.publishedTime,
        dateModified: c.articleData.dateModified || c.modifiedTime || c.articleData.datePublished,
        author: { '@type': 'Person', name: c.articleData.author },
        publisher: {
          '@type': 'Organization',
          '@id': `${SITE_URL}/#organization`,
          name: SITE_NAME,
          logo: { '@type': 'ImageObject', url: `${SITE_URL}/favicon.svg` },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        keywords: c.articleData.keywords || c.keywords,
        inLanguage: 'fr-FR',
      });
    }

    // FAQPage
    if (c.faqData?.length) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: c.faqData.map(({ question, answer }) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      });
    }

    // BreadcrumbList
    const crumbs: Breadcrumb[] = [{ name: 'Accueil', url: SITE_URL }, ...(c.breadcrumbs || [])];
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: b.url,
      })),
    });

    schemas.forEach(schema => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.setAttribute('data-seo', 'true');
      s.textContent = JSON.stringify(schema);
      document.head.appendChild(s);
    });

  }, [JSON.stringify(c)]);

  return null;
}
