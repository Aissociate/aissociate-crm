// Ce que dit le site public aissociate.re : présentation et offre du Studio IA,
// autres services, pages et liens à donner aux prospects.
//
// Source unique, partagée par « Sam » (bulle du site, `studio-demo`) et par
// l'assistant IA du CRM (outil `site_web`), pour qu'ils tiennent le même discours.
// L'offre chiffrée vient de supabase/functions/studio/contrats.ts (la même que
// le site et la facturation) : ne jamais recopier un prix ici.
import { bulletin, COMPTEURS, CONTRATS, INTEGRATION_HT, INTERRUPTEURS, normaliser } from "../studio/contrats.ts";

export const SITE = "https://aissociate.re";
/** Questionnaire d'inscription au Studio IA (Stage gratuit). */
export const LIEN_INSCRIPTION_STUDIO = `${SITE}/studio/demarrer`;

const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} €`;

/** Grille des contrats, montants calculés ici (jamais par le modèle). */
export const GRILLE_CONTRATS = CONTRATS.map((c) => {
  const cdi = c.prix ? bulletin(normaliser({ contrat: c.id, cdi: true })) : null;
  return `- ${c.nom} : ${c.prix ? `${eur(c.prix)} HT par mois en CDD` : "gratuit, sans limite de durée"}${cdi ? ` (en CDI annuel : ${eur(cdi.annuel_ht ?? 0)} HT pour l'année, soit ${eur(cdi.mensuel_ht)} par mois)` : ""}. ${c.points.join(" ; ")}.`;
}).join("\n");
export const AVENANTS = [...COMPTEURS, ...INTERRUPTEURS].map((a) => `- ${a.nom} : ${eur(a.prix)} HT ${a.unite}`).join("\n");

export const STUDIO_PRESENTATION = `Une équipe d'agents IA spécialistes, configurés pour l'entreprise du client (sa fiche, ses tarifs, sa charte, ses contenus validés), accessibles dans un espace privé avec identifiant et mot de passe.
- Léa, assistante générale : e-mails, synthèses de documents, organisation de la semaine.
- Hugo, marketing et réseaux sociaux : posts (Facebook, Instagram, LinkedIn), calendrier éditorial, visuels et courtes vidéos générés par IA.
- Sam, commercial et prospection : séquences de prospection, scripts d'appel, réponses aux objections.
- Inès, SEO et contenus web : articles optimisés, mots-clés, audit de page.
- Maël, administratif et juridique : modèles de CGV, relances d'impayés, check-list RGPD (modèles à faire valider par un professionnel du droit).
- Nora, RH et formation : annonces, grilles d'entretien, financements de formation (FAF, OPCO, CPF).
Chaque agent a des missions cadrées ; hors de son métier, il passe la main au bon collègue. Les agents préparent, le client valide : rien ne part sans son accord. Connecteurs mis en place avec le client : Gmail/Google, Outlook, messagerie SMTP, Facebook, Instagram, LinkedIn, TikTok.`;

export const STUDIO_OFFRE = `- Le nombre d'agents est illimité dans tous les contrats : le client paie le temps de travail (1 heure = 20 actions d'agent) et les badges d'accès à ses outils (1 badge = 1 outil relié : messagerie, agenda, réseau social, logiciel…).
- Tout commence par le Stage, gratuit, sans carte bancaire et sans limite de durée : le prospect remplit le questionnaire sur ${LIEN_INSCRIPTION_STUDIO}, son espace s'ouvre aussitôt et ses identifiants arrivent par e-mail. Il signe un contrat depuis son espace quand il veut ; rien n'est facturé automatiquement.
- Les contrats, à reprendre tels quels (ne recalcule jamais toi-même) :
${GRILLE_CONTRATS}
- CDD = mensuel sans engagement, résiliable à tout moment. CDI = engagement d'un an réglé en une fois, 12 mois pour le prix de 10.
- Avenants modifiables à tout moment :
${AVENANTS}
- Parcours d'intégration (facultatif) : ${eur(INTEGRATION_HT)} HT une fois, une demi-journée avec un formateur qui branche les outils et forme l'équipe, finançable par l'OPCO.
- Le Temps plein est le contrat le plus choisi ; recommande le plus petit contrat qui couvre le besoin réel du prospect.`;

export const AUTRES_SERVICES = `- Formations à l'intelligence artificielle, certifiées Qualiopi, finançables selon la situation (CPF, OPCO, France Travail, FAF) : catalogue sur ${SITE}/formations, financements sur ${SITE}/aides-formation.
- Assistance et chatbots IA : ${SITE}/assistance. Développement d'agents IA et d'automatisations sur mesure : ${SITE}/developpement.`;

/** Pages publiques utiles à citer dans un message (liens à écrire en entier). */
export const PAGES_SITE: { url: string; titre: string; usage: string }[] = [
  { url: `${SITE}/`, titre: "Studio IA (page d'accueil)", usage: "présenter l'équipe d'agents IA et l'offre" },
  { url: LIEN_INSCRIPTION_STUDIO, titre: "Inscription au Studio IA", usage: "lien d'inscription : questionnaire qui ouvre le Stage gratuit, identifiants envoyés par e-mail" },
  { url: `${SITE}/formulaire`, titre: "Parlez-nous de votre projet", usage: "formulaire de demande de rappel par un conseiller (tous services)" },
  { url: `${SITE}/contact`, titre: "Contactez-nous", usage: "coordonnées et prise de contact" },
  { url: `${SITE}/formation-ia`, titre: "Formation en intelligence artificielle à La Réunion", usage: "présentation de l'organisme de formation (Qualiopi)" },
  { url: `${SITE}/formations`, titre: "Catalogue des formations", usage: "programmes, durées, modalités" },
  { url: `${SITE}/aides-formation`, titre: "Financer sa formation", usage: "CPF, OPCO, France Travail, FAF" },
  { url: `${SITE}/assistance`, titre: "Assistance et assistants IA", usage: "chatbots et assistance IA pour les entreprises" },
  { url: `${SITE}/developpement`, titre: "Développement d'agents IA sur mesure", usage: "projets d'automatisation sur mesure" },
  { url: `${SITE}/affiliation`, titre: "Affiliation", usage: "recommander le Studio IA : 30 % la première année, puis 10 % tant que le client reste" },
  { url: `${SITE}/affiliation/test`, titre: "Commercial indépendant (H/F) Agents IA", usage: "test de recrutement des commerciaux indépendants" },
  { url: `${SITE}/blog`, titre: "Blog", usage: "articles" },
];

export type SujetSite = "studio" | "services" | "liens" | "tout";

/** Texte renvoyé à l'assistant du CRM par l'outil `site_web`. */
export function connaissanceSite(sujet: SujetSite = "tout"): string {
  const blocs: string[] = [];
  if (sujet === "studio" || sujet === "tout") {
    blocs.push(`## Studio IA\n${STUDIO_PRESENTATION}\n\n## Offre du Studio IA (montants HT)\n${STUDIO_OFFRE}`);
  }
  if (sujet === "services" || sujet === "tout") blocs.push(`## Autres services d'Aissociate\n${AUTRES_SERVICES}`);
  if (sujet === "liens" || sujet === "studio" || sujet === "tout") {
    blocs.push(`## Pages du site (liens à écrire en entier)\n${PAGES_SITE.map((p) => `- ${p.titre} : ${p.url} — ${p.usage}`).join("\n")}`);
  }
  return blocs.join("\n\n");
}
