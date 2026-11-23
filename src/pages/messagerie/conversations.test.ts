import { describe, expect, it } from 'vitest';
import type { Candidat, Contact, Email, Formateur } from '@/lib/database.types';
import {
  emailAddr, expediteurDuMessage, fwdSubject, interlocuteurDe, parseDisplayName, reSubject,
  regrouperConversations,
} from './conversations';

const mail = (e: Partial<Email>) => ({
  id: 'm', direction: 'entrant', canal: 'email', expediteur: 'Jean Dupont <jean@ex.fr>', destinataires: [],
  sujet: 'Devis', corps: '', contact_id: null, owner_id: null, lu: true, statut: 'recu',
  sent_at: null, created_at: '2026-11-01T10:00:00Z', ...e,
}) as Email;
const jean = { id: 'c1', prenom: 'Jean', nom: 'Dupont', email: 'JEAN@ex.fr', telephone: '06 92 00 00 01', owner_id: 'u1' } as Contact;
const peer = (e: Email) => interlocuteurDe(e, [jean], [{ id: 'f1', prenom: 'Fa', nom: 'Bre', email: 'fa@ex.fr' } as Formateur], [] as Candidat[]);

describe('objets et adresses', () => {
  it('extrait l\'adresse nue et le nom affiché', () => {
    expect(emailAddr('Jean Dupont <Jean@Ex.fr>')).toBe('jean@ex.fr');
    expect(parseDisplayName('"Jean Dupont" <j@d.fr>')).toEqual({ prenom: 'Jean', nom: 'Dupont' });
    expect(parseDisplayName('j@d.fr')).toEqual({ prenom: '', nom: '' });
  });
  it('n\'empile pas les préfixes de réponse et de transfert', () => {
    expect(reSubject('RE: Devis')).toBe('RE: Devis');
    expect(reSubject('Devis')).toBe('Re: Devis');
    expect(fwdSubject('Re: Devis')).toBe('Fwd: Re: Devis');
    expect(fwdSubject('TR: Devis')).toBe('TR: Devis');
  });
});

describe('interlocuteurDe', () => {
  it('réunit e-mail et WhatsApp d\'un même contact sous la même clé', () => {
    expect(peer(mail({})).key).toBe('contact:c1');
    expect(peer(mail({ canal: 'whatsapp', expediteur: '+262 692 00 00 01' })).key).toBe('wa:262692000001');
    expect(peer(mail({ canal: 'whatsapp', expediteur: '0692000001' })).key).toBe('contact:c1');
  });
  it('reconnaît un formateur, sinon retombe sur l\'adresse', () => {
    expect(peer(mail({ expediteur: 'fa@ex.fr' }))).toMatchObject({ key: 'formateur:f1', kind: 'formateur' });
    expect(peer(mail({ expediteur: 'inconnu@ex.fr' }))).toMatchObject({ key: 'addr:inconnu@ex.fr', kind: null });
  });
});

describe('regrouperConversations', () => {
  const data = [
    mail({ id: '1', created_at: '2026-11-01T10:00:00Z', lu: false }),
    mail({ id: '2', direction: 'sortant', expediteur: null, destinataires: ['jean@ex.fr'], created_at: '2026-11-02T10:00:00Z', owner_id: 'u2' }),
    mail({ id: '3', expediteur: 'inconnu@ex.fr', created_at: '2026-11-03T10:00:00Z' }),
  ];
  const convos = (chrono = false, closes: string[] = []) => regrouperConversations({
    data, chrono, closedKeys: new Set(closes), oppByContact: new Map([['c1', 'gagne']]), resolvePeer: peer,
  });

  it('regroupe par interlocuteur, plus récent d\'abord', () => {
    const [a, b] = convos();
    expect(a).toMatchObject({ key: 'addr:inconnu@ex.fr', matched: false, hasInbound: true, answered: false });
    expect(b).toMatchObject({ key: 'contact:c1', matched: true, unread: true, answered: true, oppStage: 'gagne' });
    expect(b.emails.map((e) => e.id)).toEqual(['2', '1']);
    expect([...b.owners].sort()).toEqual(['u1', 'u2']);
  });
  it('inverse l\'ordre en mode chronologique et marque les discussions closes', () => {
    const [a] = convos(true, ['contact:c1']);
    expect(a).toMatchObject({ key: 'contact:c1', closed: true });
    expect(a.emails.map((e) => e.id)).toEqual(['1', '2']);
  });
});

describe('expediteurDuMessage', () => {
  const nom = (id: string | null) => (id === 'u1' ? 'Léa Martin' : null);
  it('distingue IA, envoi automatique et utilisateur, y compris sans colonne origine', () => {
    expect(expediteurDuMessage(mail({ origine: 'ia_studio', origine_libelle: 'Sam' }), nom)).toEqual({ origine: 'ia_studio', label: 'Sam' });
    expect(expediteurDuMessage(mail({ owner_id: 'u1' }), nom)).toEqual({ origine: 'utilisateur', label: 'Léa Martin' });
    expect(expediteurDuMessage(mail({}), nom)).toEqual({ origine: 'automatique', label: 'Envoi automatique' });
  });
});
