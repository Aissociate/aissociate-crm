// Contacts — constantes, valeurs initiales des formulaires et contact créé depuis la Messagerie.
import { ymdLocal, prochaineHeureOuvrable } from '@/lib/utils';
import type { Contact, ContactType } from '@/lib/database.types';

export const TODAY = new Date().toISOString().slice(0, 10);

export const REFRESH_MS = 5 * 60 * 1000; // rafraîchissement auto des prospects (5 min)

export const TYPES: ContactType[] = ['prospect', 'contact', 'apprenant', 'contact_entreprise', 'contact_financeur', 'formateur', 'encadrement'];

// Types de demande du formulaire public (/formulaire) — repris dans la saisie interne.
export const REQUEST_TYPE_GROUPS: { label: string; options: string[] }[] = [
  { label: 'Formations CPF', options: ["Création de contenus rédactionnels et visuels par l'IA générative"] },
  { label: 'Formations OPCO', options: [
    'Introduction aux IA pour les PME', 'Automatisation des process des PME',
    "L'IA pour optimiser la relation client", "L'IA pour optimiser le marketing et la communication",
    "L'IA pour optimiser la prospection commerciale", "L'IA pour optimiser les ressources humaines",
    'Apprenez à maîtriser les marchés publics avec lemarchepublic.fr',
  ] },
  { label: 'Services', options: ['Assistance IA', 'Développement sur mesure', 'Employé virtuel'] },
];

export const empty = (): Partial<Contact> => ({
  type: 'prospect', civilite: '', nom: '', prenom: '', email: '',
  telephone: '', fonction: '', entreprise_id: null, financeur_id: null, rgpd_consent: false, notes: '', tags: [],
});

export const emptyIntake = () => ({ firstName: '', lastName: '', email: '', phone: '', company: '', requestType: '', message: '' });

// ── Contact créé depuis la Messagerie (ticket « lien vers fiche dans contacts ») ──
// Données transmises par la page Messagerie via l'état de navigation.
export type MailSeed = { sujet: string | null; recuLe: string | null };
export type NouveauContactState = {
  email: string; prenom: string; nom: string; telephone: string;
  actionsMessagerie: MailSeed;
};

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** Les deux actions demandées à la création d'un contact depuis un mail entrant. */
export function seedActionsFromMail(contactId: string, seed: MailSeed) {
  const recu = seed.recuLe ? new Date(seed.recuLe) : new Date();
  const suite = prochaineHeureOuvrable();
  return [
    {
      contact_id: contactId, date_action: ymdLocal(recu), heure_action: `${pad2(recu.getHours())}:${pad2(recu.getMinutes())}`,
      type: 'email', faite: true,
      description: `E-mail entrant reçu${seed.sujet ? ` : ${seed.sujet}` : ''}`,
    },
    {
      contact_id: contactId, date_action: suite.date, heure_action: suite.heure,
      type: 'email', faite: false,
      description: 'Répondre à l\'e-mail entrant (première heure ouvrable)',
    },
  ];
}
