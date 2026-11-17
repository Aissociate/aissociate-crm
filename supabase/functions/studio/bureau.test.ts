import { describe, expect, it } from 'vitest';
import {
  boitePour, corpsEvenement, corpsLisible, erreurBloquante, markdownVersHtml, messageErreur, nomFichier,
  parametresRecherche, plafondJour, typeLecture, versBoite, type Boite,
} from './bureau';
import { adressesValides, dateHeure, periode } from './agenda';

describe('bureau — comptes', () => {
  it('reconnaît les messageries et leurs zones', () => {
    expect(versBoite({ _id: 'a1', platform: 'linkedin' })).toBeNull();
    expect(versBoite({ _id: 'g1', platform: 'google', email: 'lea@x.fr', scopeAreas: ['email', 'files', 'posting'] }))
      .toMatchObject({ id: 'g1', fournisseur: 'google', adresse: 'lea@x.fr', nom: 'lea@x.fr', zones: ['email', 'files'], a_reconnecter: false });
    expect(versBoite({ _id: 'm1', platform: 'microsoft', username: 'a@b.fr' })?.zones).toEqual(['email', 'calendar', 'files']);
    expect(versBoite({ _id: 'i1', platform: 'imap', email: 'c@d.fr', isActive: false })).toMatchObject({ zones: ['email'], a_reconnecter: true });
  });
  it('choisit la boîte d\'une zone : valide et OAuth d\'abord', () => {
    const b = (id: string, fournisseur: Boite['fournisseur'], zones: Boite['zones'], a_reconnecter = false): Boite =>
      ({ id, fournisseur, adresse: '', nom: id, zones, photo: null, a_reconnecter });
    const liste = [b('imap', 'imap', ['email']), b('casse', 'google', ['email', 'calendar'], true), b('ms', 'microsoft', ['email'])];
    expect(boitePour(liste, 'email')?.id).toBe('ms');
    expect(boitePour(liste, 'calendar')?.id).toBe('casse');
    expect(boitePour(liste, 'files')).toBeNull();
  });
  it('fixe un plafond quotidien prudent', () => {
    expect(plafondJour({ fournisseur: 'google', adresse: 'x@gmail.com' })).toBe(180);
    expect(plafondJour({ fournisseur: 'google', adresse: 'x@societe.re' })).toBe(450);
    expect(plafondJour({ fournisseur: 'microsoft', adresse: 'x@societe.re' })).toBe(900);
    expect(plafondJour({ fournisseur: 'imap', adresse: 'x@ovh.fr' })).toBe(180);
  });
});

describe('bureau — erreurs', () => {
  it('traduit les erreurs Zernio', () => {
    expect(messageErreur({ statut: 402 })).toMatch(/pas encore activé/);
    expect(messageErreur({ statut: 402, code: 'PAYMENT_REQUIRED', data: { reason: 'free_tier_exceeded' } })).toMatch(/comptes supplémentaires/);
    expect(messageErreur({ statut: 412, code: 'account_scope_missing' })).toMatch(/reconnectez/);
    expect(messageErreur({ statut: 429, code: 'email_send_cap_reached' })).toMatch(/Plafond/);
    expect(messageErreur({ statut: 404, data: { reason: 'file_not_granted' } })).toMatch(/Choisir des fichiers Drive/);
    expect(messageErreur(new Error('autre'))).toBe('autre');
    expect(erreurBloquante({ statut: 429 })).toBe(true);
    expect(erreurBloquante({ statut: 500 })).toBe(false);
  });
});

describe('bureau — e-mails', () => {
  it('construit la recherche', () => {
    const q = parametresRecherche('acc', { requete: ' is:unread ', de: 'a@x.fr', non_lus: true, jours: 7, max: 99 }, Date.parse('2026-11-17T00:00:00Z'));
    expect(Object.fromEntries(q)).toEqual({
      accountId: 'acc', limit: '25', searchQueryNative: 'is:unread', from: 'a@x.fr', unread: 'true', after: '2026-11-10T00:00:00.000Z',
    });
    expect(parametresRecherche('acc', {}).get('limit')).toBe('10');
  });
  it('lit le texte nettoyé, sinon le texte, sinon le HTML', () => {
    expect(corpsLisible({ clean: { text: ' Merci ' }, text: 'Merci\n> cité' })).toBe('Merci');
    expect(corpsLisible({ text: 'Texte' })).toBe('Texte');
    expect(corpsLisible({ html: '<p>Bonjour&nbsp;<b>Léa</b></p><script>x</script>' })).toBe('Bonjour Léa');
  });
  it('valide les adresses', () => {
    expect(adressesValides('A@x.fr; b@y.re, a@x.fr')).toEqual(['a@x.fr', 'b@y.re']);
    expect(adressesValides('pas-une-adresse')).toBeNull();
    expect(adressesValides('')).toEqual([]);
  });
});

describe('bureau — fichiers', () => {
  it('lit le nom du fichier téléchargé', () => {
    expect(nomFichier("attachment; filename*=UTF-8''Devis%20%C3%A9t%C3%A9.pdf")).toBe('Devis été.pdf');
    expect(nomFichier('attachment; filename="Plan.xlsx"')).toBe('Plan.xlsx');
    expect(nomFichier(null)).toBe('');
  });
  it('choisit la lecture selon le type', () => {
    expect(typeLecture('text/plain', 'a')).toBe('texte');
    expect(typeLecture('application/octet-stream', 'notes.md')).toBe('texte');
    expect(typeLecture('application/pdf', 'x')).toBe('pdf');
    expect(typeLecture('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'x')).toBe('tableur');
    expect(typeLecture('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x')).toBe('word');
    expect(typeLecture('image/png', 'logo.png')).toBeNull();
  });
  it('convertit le Markdown simple en HTML échappé', () => {
    const h = markdownVersHtml('# Titre\nTexte **gras** <script>\n\n- un\n- deux\n1. premier');
    expect(h).toContain('<h1>Titre</h1>');
    expect(h).toContain('<p>Texte <b>gras</b> &lt;script&gt;</p>');
    expect(h).toContain('<ul><li>un</li><li>deux</li></ul><ol><li>premier</li></ol>');
  });
});

describe('agenda', () => {
  it('normalise les dates et heures', () => {
    expect(dateHeure('2026-11-20T14:30')).toBe('2026-11-20T14:30:00');
    expect(dateHeure('2026-11-20 09:05:10')).toBe('2026-11-20T09:05:10');
    expect(dateHeure('demain 14h')).toBeNull();
  });
  it('calcule la période en heure de La Réunion', () => {
    expect(periode('2026-11-20', '2026-11-21')).toEqual({ min: '2026-11-19T20:00:00.000Z', max: '2026-11-21T19:59:59.000Z' });
    const p = periode(null, null, new Date('2026-11-16T10:00:00Z'));
    expect(p.max).toBe('2026-11-30T10:00:00.000Z');
  });
  it('construit le corps de l\'événement Zernio', () => {
    expect(corpsEvenement('acc', { titre: 'RDV', debut: '2026-11-20T14:30:00', fin: '2026-11-20T15:00:00', participants: ['a@x.fr'] })).toEqual({
      accountId: 'acc', title: 'RDV', start: '2026-11-20T14:30:00+04:00', end: '2026-11-20T15:00:00+04:00',
      timezone: 'Indian/Reunion', participants: [{ email: 'a@x.fr' }],
    });
  });
});
