import { describe, expect, it } from 'vitest';
import { dateProgramme, heureLisible, jourLisible, phraseEtat, presenter } from './decision';

// Mardi 24 novembre 2026, 12 h à La Réunion.
const maintenant = new Date('2026-11-24T08:00:00Z');

describe('présentation d\'une décision', () => {
  it("nomme le bouton par l'effet d'un e-mail", () => {
    expect(presenter({ type_action: 'gmail_envoyer', action: { a: ['a@x.re'] } })).toMatchObject({ portee: 'Envoi à 1 destinataire', bouton: "Envoyer l'e-mail" });
    expect(presenter({ type_action: 'gmail_envoyer', action: { a: ['a@x.re', 'b@x.re'], cc: ['c@x.re'] } }))
      .toMatchObject({ portee: 'Envoi à 3 destinataires', bouton: 'Envoyer aux 3 destinataires' });
    expect(presenter({ type_action: 'mailing_envoyer', action: { destinataires: 212 } })).toMatchObject({ portee: 'Envoi à 212 abonnés', bouton: 'Envoyer aux 212 abonnés' });
  });

  it('distingue publier maintenant et programmer', () => {
    expect(presenter({ type_action: 'reseaux_publier', action: { texte: 'Bonjour' } }, maintenant))
      .toMatchObject({ portee: 'Publication publique', bouton: 'Publier maintenant' });
    const p = presenter({ type_action: 'reseaux_publier', action: { programme: '2026-11-27 18:00' } }, maintenant);
    expect(p).toMatchObject({ portee: 'Publication publique', bouton: 'Programmer pour vendredi', fait: 'Publication programmée pour vendredi à 18 h.' });
    // Date programmée déjà passée : la publication partirait tout de suite, le bouton le dit.
    expect(presenter({ type_action: 'reseaux_publier', action: { programme: '2026-11-20 18:00' } }, maintenant).bouton).toBe('Publier maintenant');
  });

  it('dit la portée des autres actions', () => {
    expect(presenter({ type_action: 'agenda_creer', action: { participants: ['a@x.re', 'b@x.re'] } })).toMatchObject({ portee: 'Invitation à 2 personnes' });
    expect(presenter({ type_action: 'agenda_creer', action: {} })).toMatchObject({ portee: 'Votre agenda', bouton: 'Créer le rendez-vous' });
    expect(presenter({ type_action: 'drive_creer_document', action: {} }).bouton).toBe('Créer le document');
    expect(presenter({ type_action: 'routine_activer', action: { tache_id: 'x' } })).toMatchObject({ portee: 'Votre routine', bouton: 'Mettre en route' });
    expect(presenter({ type_action: 'reseaux_repondre_commentaire', action: {} }).portee).toBe('Réponse publique');
    expect(presenter({ type_action: 'app_blog_article', action: {} }).portee).toBe('Publication sur votre site');
  });

  it("n'annonce aucune portée pour un simple texte, et reste prudent sur une action inconnue", () => {
    expect(presenter({ type_action: null })).toEqual({ portee: null, bouton: 'Valider', fait: 'Validé.' });
    expect(presenter({ format: 'html' }).bouton).toBe('Valider le document');
    expect(presenter({ type_action: 'action_future', action: {} })).toMatchObject({ portee: 'Action dans vos outils', bouton: 'Valider et lancer' });
  });
});

describe('dates lisibles (heure de La Réunion)', () => {
  it('nomme le jour comme on le dirait', () => {
    expect(jourLisible(new Date('2026-11-24T15:00:00Z'), maintenant)).toBe("aujourd'hui");
    expect(jourLisible(new Date('2026-11-24T21:00:00Z'), maintenant)).toBe('demain'); // 1 h du matin le 25 à La Réunion
    expect(jourLisible(dateProgramme('2026-11-27 18:00')!, maintenant)).toBe('vendredi');
    expect(jourLisible(dateProgramme('2026-12-15 09:00')!, maintenant)).toBe('le 15 décembre');
  });
  it('écrit l\'heure à la française', () => {
    expect(heureLisible(dateProgramme('2026-11-27 18:00')!)).toBe('18 h');
    expect(heureLisible(dateProgramme('2026-11-27 09:30')!)).toBe('9 h 30');
  });
});

describe("phrase d'état", () => {
  it('dit en une ligne ce qui est attendu', () => {
    expect(phraseEtat(0)).toBe('Aucune décision en attente : tout est fait.');
    expect(phraseEtat(1)).toBe('Une décision vous attend, le reste est fait.');
    expect(phraseEtat(3)).toBe('Trois décisions vous attendent, le reste est fait.');
    expect(phraseEtat(14)).toBe('14 décisions vous attendent, le reste est fait.');
  });
});
