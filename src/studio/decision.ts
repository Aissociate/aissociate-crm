// Écran « Aujourd'hui » : comment une décision se présente au dirigeant.
// Le bouton principal dit l'effet (« Envoyer à 2 destinataires »), la pastille dit la
// portée (« Publication publique »). Tout est déduit de l'action portée par le
// livrable : rien n'est inventé. Module pur (testé).

export type Decidable = { type_action?: string | null; action?: unknown; format?: string | null };
export type Presentation = {
  /** Portée de la décision, affichée avec un cadenas ; null pour un simple texte à relire. */
  portee: string | null;
  /** Libellé du bouton principal. */
  bouton: string;
  /** Phrase de confirmation une fois l'action partie. */
  fait: string;
};

const s = (n: number) => (n > 1 ? 's' : '');
const tableau = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Date programmée (« AAAA-MM-JJ HH:MM », heure de La Réunion si aucun fuseau n'est écrit). */
export function dateProgramme(brut: unknown): Date | null {
  if (typeof brut !== 'string' || !brut.trim()) return null;
  const iso = brut.trim().replace(' ', 'T');
  const d = new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}${iso.length <= 16 ? ':00' : ''}+04:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const REUNION = 'Indian/Reunion';
const jourCle = (d: Date) => d.toLocaleDateString('fr-CA', { timeZone: REUNION });

/** « aujourd'hui », « demain », « vendredi » dans la semaine, sinon « le 12 décembre » (heure de La Réunion). */
export function jourLisible(date: Date, maintenant = new Date()): string {
  const ecart = Math.round((Date.parse(jourCle(date)) - Date.parse(jourCle(maintenant))) / 86_400_000);
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return 'demain';
  if (ecart > 1 && ecart < 7) return date.toLocaleDateString('fr-FR', { timeZone: REUNION, weekday: 'long' });
  return `le ${date.toLocaleDateString('fr-FR', { timeZone: REUNION, day: 'numeric', month: 'long' })}`;
}

export const heureLisible = (date: Date) => date.toLocaleTimeString('fr-FR', { timeZone: REUNION, hour: 'numeric', minute: '2-digit' })
  .replace(':', ' h ').replace(/ h 00$/, ' h');

export function presenter(l: Decidable, maintenant = new Date()): Presentation {
  const a = (l.action ?? {}) as Record<string, unknown>;
  switch (l.type_action) {
    case 'gmail_envoyer': {
      const n = tableau(a.a).length + tableau(a.cc).length;
      return n > 1
        ? { portee: `Envoi à ${n} destinataires`, bouton: `Envoyer aux ${n} destinataires`, fait: `E-mail envoyé aux ${n} destinataires.` }
        : { portee: 'Envoi à 1 destinataire', bouton: "Envoyer l'e-mail", fait: 'E-mail envoyé.' };
    }
    case 'mailing_envoyer': {
      const n = Number(a.destinataires) || 0;
      return { portee: `Envoi à ${n} abonné${s(n)}`, bouton: n ? `Envoyer aux ${n} abonné${s(n)}` : 'Envoyer le mailing', fait: 'Mailing mis en file : les envois partent par lots.' };
    }
    case 'reseaux_publier': {
      const quand = dateProgramme(a.programme);
      return quand && quand > maintenant
        ? { portee: 'Publication publique', bouton: `Programmer pour ${jourLisible(quand, maintenant)}`, fait: `Publication programmée pour ${jourLisible(quand, maintenant)} à ${heureLisible(quand)}.` }
        : { portee: 'Publication publique', bouton: 'Publier maintenant', fait: 'Publication envoyée.' };
    }
    case 'reseaux_repondre_commentaire':
      return { portee: 'Réponse publique', bouton: 'Publier la réponse', fait: 'Réponse publiée.' };
    case 'reseaux_envoyer_message':
      return { portee: 'Message privé', bouton: 'Envoyer le message', fait: 'Message envoyé.' };
    case 'app_message':
      return { portee: 'Message WhatsApp', bouton: 'Envoyer le message', fait: 'Message envoyé.' };
    case 'agenda_creer': {
      const n = tableau(a.participants).length;
      return n
        ? { portee: `Invitation à ${n} personne${s(n)}`, bouton: n > 1 ? `Créer et inviter ${n} personnes` : 'Créer et envoyer l\'invitation', fait: 'Rendez-vous créé, invitations envoyées.' }
        : { portee: 'Votre agenda', bouton: 'Créer le rendez-vous', fait: 'Rendez-vous créé dans votre agenda.' };
    }
    case 'drive_creer_document':
      return { portee: 'Dépôt dans vos fichiers', bouton: 'Créer le document', fait: 'Document créé dans votre espace de fichiers.' };
    case 'app_blog_article':
      return { portee: 'Publication sur votre site', bouton: "Déposer l'article", fait: 'Article déposé sur votre site.' };
    case 'app_youtube_video':
      return { portee: 'Publication publique', bouton: 'Mettre la vidéo en ligne', fait: 'Vidéo envoyée à YouTube.' };
    case 'app_crm_contact':
      return { portee: 'Votre CRM', bouton: 'Créer le contact', fait: 'Contact créé dans votre CRM.' };
    case 'app_crm_note':
      return { portee: 'Votre CRM', bouton: 'Ajouter la note', fait: 'Note ajoutée dans votre CRM.' };
    case 'routine_activer':
      return { portee: 'Votre routine', bouton: 'Mettre en route', fait: 'Routine en route : ses envois attendront toujours votre feu vert.' };
    default:
      // Livrable sans action : un texte ou un document à relire, rien ne part de lui-même.
      return l.type_action
        ? { portee: 'Action dans vos outils', bouton: 'Valider et lancer', fait: 'Action exécutée.' }
        : { portee: null, bouton: l.format === 'html' ? 'Valider le document' : 'Valider', fait: 'Validé.' };
  }
}

const NOMBRES = ['Aucune', 'Une', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix'];

/** Phrase d'état sous le « Bonjour » : ce qu'on attend du dirigeant, en une ligne. */
export function phraseEtat(n: number): string {
  if (n <= 0) return 'Aucune décision en attente : tout est fait.';
  if (n === 1) return 'Une décision vous attend, le reste est fait.';
  return `${NOMBRES[n] ?? n} décisions vous attendent, le reste est fait.`;
}
