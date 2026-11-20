import { describe, expect, it } from 'vitest';
import {
  adresse, authentificationDouteuse, automatique, choisirAgent, corpsUtile, decisions, nomDocument, refLivrable,
  signauxFraude, signerSvix, sujetPropre, typer, verifierSvix,
} from './liaison';

const SECRET = 'whsec_' + btoa('cle-de-test-du-webhook-agentmail');
const AGENTS = [{ id: 'lea', prenom: 'Léa' }, { id: 'hugo', prenom: 'Hugo' }, { id: 'ines', prenom: 'Inès' }];

describe('signature des webhooks (Svix)', () => {
  it('retrouve le vecteur de test publié par Svix', async () => {
    expect(await signerSvix('whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw', 'msg_p5jXN8AQM9LWM0D4loKWxJek', '1614265330', '{"test": 2432232314}'))
      .toBe('g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=');
  });

  it('accepte une signature valide, refuse un corps modifié ou un horodatage ancien', async () => {
    const ts = '1794830000', corps = '{"event_type":"message.received"}';
    const sig = `v1,${await signerSvix(SECRET, 'msg_1', ts, corps)}`;
    const e = { id: 'msg_1', horodatage: ts, signature: `v1,autre ${sig}` };
    expect(await verifierSvix([SECRET], e, corps, 1794830000_000)).toBe(true);
    expect(await verifierSvix([SECRET], e, corps + ' ', 1794830000_000)).toBe(false);
    expect(await verifierSvix([SECRET], e, corps, 1794830000_000 + 6 * 60_000)).toBe(false);
    expect(await verifierSvix(['whsec_' + btoa('autre-cle')], e, corps, 1794830000_000)).toBe(false);
    // Rotation : l'ancien secret reste accepté tant qu'il est listé.
    expect(await verifierSvix(['whsec_' + btoa('nouvelle'), SECRET], e, corps, 1794830000_000)).toBe(true);
  });
});

describe('lecture des messages', () => {
  it("normalise l'adresse et retire la citation", () => {
    expect(adresse('Marie Hoarau <Marie@Exemple.RE>')).toBe('marie@exemple.re');
    expect(corpsUtile('OK pour moi\n\nLe lun. 16 nov. 2026, Studio a écrit :\n> ancien texte')).toBe('OK pour moi');
  });

  it('type les commandes et lit les décisions', () => {
    expect(typer('SUSPENDRE', '')).toBe('SUSPENDRE');
    expect(typer('Re: votre post', 'Reprendre les agents svp')).toBe('REPRENDRE');
    const ref = refLivrable('1a2b3c4d-0000-4000-8000-000000000000');
    expect(ref).toBe('L-1a2b3c4d');
    expect(typer('Re: livrable', `Validé ${ref}, merci`)).toBe('VALIDATION');
    expect(decisions(`VALIDÉ ${ref}\nrefusé L-99aa00bb`)).toEqual([{ statut: 'valide', ref }, { statut: 'refuse', ref: 'L-99aa00bb' }]);
    expect(typer('Posts de la semaine', 'Prépare 3 posts LinkedIn')).toBe('ORDRE');
  });

  it('nomme un document déposé Agent-Titre-Réf-vN, comme les exports du navigateur', () => {
    expect(nomDocument({ agent: 'Hugo', titre: 'Posts réseaux sociaux — 3 actualités IA', id: '88e7c4db-dfeb-4dc7-9d5b-d3b24ba113a9', version: 2 }))
      .toBe('Hugo-Posts-reseaux-sociaux-3-actualites-IA-L-88e7c4db-v2');
    expect(nomDocument({ titre: '', id: '11112222-0000-0000-0000-000000000000' })).toBe('Document-L-11112222-v1');
  });

  it("choisit l'agent par l'objet ou le début du message", () => {
    expect(choisirAgent('[Hugo] posts de la semaine', '', AGENTS, 'lea')).toBe('hugo');
    expect(choisirAgent('Ines : article', '', AGENTS, 'lea')).toBe('ines');
    expect(choisirAgent('Une demande', 'Bonjour Hugo, peux-tu…', AGENTS, 'lea')).toBe('hugo');
    expect(choisirAgent('Une demande', 'Il faut voir avec Hugo', AGENTS, 'lea')).toBe('lea');
    expect(choisirAgent('x', '', AGENTS, 'nora')).toBe('lea'); // défaut hors équipe → premier agent
    expect(sujetPropre('RE: Tr: [Hugo] posts', 'Hugo')).toBe('posts');
  });
});

describe('garde-fous', () => {
  it('détecte la fraude au président', () => {
    expect(signauxFraude('Merci de faire un virement urgent, voici le nouvel IBAN')).toEqual(['coordonnées bancaires', 'virement']);
    expect(signauxFraude('Achète 5 cartes cadeaux Google Play, c’est confidentiel et urgent')).toContain('cartes prépayées');
    expect(signauxFraude('Prépare 3 posts sur nos viennoiseries')).toEqual([]);
  });

  it('ignore retours d’échec et réponses automatiques', () => {
    expect(automatique('MAILER-DAEMON@mail.exemple.re')).toBe(true);
    expect(automatique('marie@exemple.re', { 'Auto-Submitted': 'auto-replied' })).toBe(true);
    expect(automatique('marie@exemple.re', { 'Auto-Submitted': 'no' })).toBe(false);
  });

  it("met en doute un expéditeur mal authentifié", () => {
    expect(authentificationDouteuse({ spf: 'pass', dkim: 'pass', dmarc: 'pass' })).toBe(false);
    expect(authentificationDouteuse({ spf: 'fail', dkim: 'none', dmarc: 'none' })).toBe(true);
    expect(authentificationDouteuse({ spf: 'pass', dkim: 'pass', dmarc: 'fail' })).toBe(true);
    expect(authentificationDouteuse(undefined)).toBe(false);
  });
});
