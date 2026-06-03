// @ts-nocheck
import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product' | 'course';
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  courseData?: {
    name: string;
    description: string;
    provider: string;
    duration: string;
    price: string;
    priceCurrency: string;
    educationalLevel: string;
    courseMode: string[];
    hasCourseInstance?: {
      startDate: string;
      endDate: string;
      location: string;
    };
  };
  organizationData?: {
    name: string;
    description: string;
    url: string;
    logo: string;
    telephone?: string;
    email?: string;
    address?: {
      streetAddress: string;
      addressLocality: string;
      postalCode: string;
      addressCountry: string;
    };
  };
}

const defaultProps = {
  title: 'Formation IA Générative - Création de Contenus par Intelligence Artificielle | Qualiopi',
  description: 'Formation certifiée Qualiopi en Intelligence Artificielle Générative. Maîtrisez ChatGPT, DALL-E et les outils IA en 3 jours. Financement OPCO, CPF, France Travail. Formation en présentiel, distanciel ou hybride.',
  keywords: 'formation intelligence artificielle, formation IA, ChatGPT formation, DALL-E, IA générative, formation Qualiopi, formation CPF IA, formation OPCO intelligence artificielle, création contenu IA, prompt engineering, formation ChatGPT entreprise, formation professionnelle IA, intelligence artificielle formation professionnelle',
  image: 'https://storage.googleapis.com/msgsndr/QgFd2CSdLClLqXBncDm0/media/65f8015e1a9195ba3d84f818.jpeg',
  url: 'https://votre-domaine.fr',
  type: 'website' as const,
};

export default function SEO(props: SEOProps) {
  const config = { ...defaultProps, ...props };

  useEffect(() => {
    document.title = config.title;

    const metaTags = [
      { name: 'description', content: config.description },
      { name: 'keywords', content: config.keywords },
      { name: 'robots', content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' },
      { name: 'googlebot', content: 'index, follow' },
      { name: 'bingbot', content: 'index, follow' },
      { name: 'language', content: 'French' },
      { name: 'geo.region', content: 'FR' },
      { name: 'geo.placename', content: 'France' },

      { property: 'og:type', content: config.type },
      { property: 'og:title', content: config.title },
      { property: 'og:description', content: config.description },
      { property: 'og:image', content: config.image },
      { property: 'og:url', content: config.url },
      { property: 'og:site_name', content: 'Formation IA Générative' },
      { property: 'og:locale', content: 'fr_FR' },

      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: config.title },
      { name: 'twitter:description', content: config.description },
      { name: 'twitter:image', content: config.image },

      { name: 'format-detection', content: 'telephone=no' },
      { name: 'theme-color', content: '#0f172a' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    ];

    if (config.author) {
      metaTags.push({ name: 'author', content: config.author });
      metaTags.push({ property: 'article:author', content: config.author });
    }

    if (config.publishedTime) {
      metaTags.push({ property: 'article:published_time', content: config.publishedTime });
    }

    if (config.modifiedTime) {
      metaTags.push({ property: 'article:modified_time', content: config.modifiedTime });
      metaTags.push({ property: 'og:updated_time', content: config.modifiedTime });
    }

    metaTags.forEach(({ name, property, content }) => {
      const selector = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
      let element = document.querySelector(selector) as HTMLMetaElement;

      if (!element) {
        element = document.createElement('meta');
        if (name) element.setAttribute('name', name);
        if (property) element.setAttribute('property', property);
        document.head.appendChild(element);
      }

      element.setAttribute('content', content);
    });

    const linkTags = [
      { rel: 'canonical', href: config.url },
    ];

    linkTags.forEach(({ rel, href }) => {
      let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;

      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }

      element.setAttribute('href', href);
    });

    const existingJsonLd = document.querySelectorAll('script[type="application/ld+json"]');
    existingJsonLd.forEach(script => script.remove());

    const jsonLdScripts: object[] = [];

    if (config.organizationData) {
      const orgSchema = {
        '@context': 'https://schema.org',
        '@type': 'EducationalOrganization',
        name: config.organizationData.name,
        description: config.organizationData.description,
        url: config.organizationData.url,
        logo: config.organizationData.logo,
        sameAs: [],
        ...(config.organizationData.telephone && { telephone: config.organizationData.telephone }),
        ...(config.organizationData.email && { email: config.organizationData.email }),
        ...(config.organizationData.address && {
          address: {
            '@type': 'PostalAddress',
            streetAddress: config.organizationData.address.streetAddress,
            addressLocality: config.organizationData.address.addressLocality,
            postalCode: config.organizationData.address.postalCode,
            addressCountry: config.organizationData.address.addressCountry,
          },
        }),
      };
      jsonLdScripts.push(orgSchema);
    }

    if (config.courseData) {
      const courseSchema = {
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: config.courseData.name,
        description: config.courseData.description,
        provider: {
          '@type': 'Organization',
          name: config.courseData.provider,
          sameAs: config.url,
        },
        educationalLevel: config.courseData.educationalLevel,
        courseMode: config.courseData.courseMode,
        timeRequired: config.courseData.duration,
        offers: {
          '@type': 'Offer',
          price: config.courseData.price,
          priceCurrency: config.courseData.priceCurrency,
          availability: 'https://schema.org/InStock',
          url: config.url,
          validFrom: new Date().toISOString(),
        },
        ...(config.courseData.hasCourseInstance && {
          hasCourseInstance: {
            '@type': 'CourseInstance',
            courseMode: 'blended',
            startDate: config.courseData.hasCourseInstance.startDate,
            endDate: config.courseData.hasCourseInstance.endDate,
            location: {
              '@type': 'Place',
              name: config.courseData.hasCourseInstance.location,
            },
          },
        }),
      };
      jsonLdScripts.push(courseSchema);
    }

    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Accueil',
          item: config.url,
        },
      ],
    };
    jsonLdScripts.push(breadcrumbSchema);

    const websiteSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Formation IA Générative',
      url: config.url,
      description: config.description,
      inLanguage: 'fr-FR',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${config.url}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    };
    jsonLdScripts.push(websiteSchema);

    jsonLdScripts.forEach(schema => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(schema, null, 2);
      document.head.appendChild(script);
    });

    const htmlTag = document.documentElement;
    htmlTag.setAttribute('lang', 'fr');

  }, [config]);

  return null;
}
