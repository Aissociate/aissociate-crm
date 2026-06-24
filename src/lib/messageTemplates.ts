// Modèles de messages (réponses rapides) — partagés entre la composition
// (Messagerie / fiche contact) et leur gestion dans les Paramètres.
// Stockés dans la table `parametres`, clé « message_templates », valeur { items }.

import { formatDate } from '@/lib/utils';

export type TemplateCanal = 'email' | 'whatsapp' | 'both';

export type MessageTemplate = {
  id: string;
  nom: string;            // libellé affiché dans le sélecteur
  canal: TemplateCanal;   // pour quel canal le modèle est proposé
  sujet?: string;         // objet (e-mail uniquement)
  corps: string;          // corps du message (avec variables {{…}})
};

// Variables substituées à l'insertion du modèle. Renseignées depuis le contact,
// l'expéditeur (conseiller) et l'organisme quand le contexte est connu.
export type TemplateVars = {
  prenom?: string | null;
  nom?: string | null;
  civilite?: string | null;
  fonction?: string | null;
  formation?: string | null;
  conseiller?: string | null;
  organisme?: string | null;
};

// Variables disponibles, pour l'aide affichée dans l'éditeur de modèles.
export const TEMPLATE_PLACEHOLDERS: { token: string; label: string }[] = [
  { token: '{{prenom}}', label: 'Prénom du contact' },
  { token: '{{nom}}', label: 'Nom du contact' },
  { token: '{{civilite}}', label: 'Civilité (M., Mme…)' },
  { token: '{{fonction}}', label: 'Fonction du contact' },
  { token: '{{formation}}', label: 'Formation envisagée' },
  { token: '{{conseiller}}', label: 'Vous (expéditeur)' },
  { token: '{{organisme}}', label: "Nom de l'organisme" },
  { token: '{{date}}', label: "Date du jour" },
];

// Remplace les variables {{…}} connues ; laisse les inconnues intactes.
export function applyTemplateVars(text: string, vars: TemplateVars): string {
  const map: Record<string, string> = {
    prenom: vars.prenom ?? '',
    nom: vars.nom ?? '',
    civilite: vars.civilite ?? '',
    fonction: vars.fonction ?? '',
    formation: vars.formation ?? '',
    conseiller: vars.conseiller ?? '',
    organisme: vars.organisme ?? '',
    date: formatDate(new Date().toISOString()),
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) => {
    const k = key.toLowerCase();
    return k in map ? map[k] : m;
  });
}

// Modèles proposés pour un canal donné (les modèles « both » sont toujours là).
export function templatesForCanal(items: MessageTemplate[], canal: 'email' | 'whatsapp'): MessageTemplate[] {
  return items.filter((t) => t.canal === canal || t.canal === 'both');
}

// Modèles fournis par défaut tant qu'aucun n'a été configuré (Paramètres).
// Ids stables pour des clés React fiables et une persistance propre.
export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl-relance-devis',
    nom: 'Relance devis',
    canal: 'email',
    sujet: 'Votre devis de formation',
    corps: 'Bonjour {{prenom}},\n\nJe me permets de revenir vers vous concernant le devis de formation « {{formation}} » que je vous ai transmis.\n\nJe reste à votre disposition pour toute question ou pour avancer ensemble sur votre projet.\n\nBien cordialement,\n{{conseiller}}\n{{organisme}}',
  },
  {
    id: 'tpl-confirmation-rdv',
    nom: 'Confirmation de rendez-vous',
    canal: 'both',
    sujet: 'Confirmation de notre rendez-vous',
    corps: "Bonjour {{prenom}},\n\nJe vous confirme notre rendez-vous. N'hésitez pas à me prévenir en cas d'empêchement.\n\nÀ très bientôt,\n{{conseiller}}\n{{organisme}}",
  },
  {
    id: 'tpl-demande-pieces',
    nom: 'Demande de pièces',
    canal: 'email',
    sujet: 'Pièces nécessaires à votre dossier de formation',
    corps: 'Bonjour {{prenom}},\n\nAfin de finaliser votre dossier de formation, pourriez-vous me transmettre les pièces suivantes :\n- \n- \n\nJe vous en remercie par avance.\n\nBien cordialement,\n{{conseiller}}\n{{organisme}}',
  },
  {
    id: 'tpl-relance-whatsapp',
    nom: 'Relance courte (WhatsApp)',
    canal: 'whatsapp',
    corps: "Bonjour {{prenom}}, c'est {{conseiller}} de {{organisme}}. Avez-vous pu regarder ma proposition concernant votre projet de formation ? Je reste disponible. Belle journée !",
  },
];
