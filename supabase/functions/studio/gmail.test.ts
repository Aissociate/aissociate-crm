import { describe, expect, it } from 'vitest';
import { b64, b64url, construireMime, decoderB64url, encoderObjet, extraireCorps } from './gmail';
import { corpsEvenement, dateHeure, periode } from './agenda';
import { adressesValides } from './google';

describe('gmail', () => {
  it('décode le base64 url en UTF-8', () => {
    expect(decoderB64url(b64url('Réponse à « Léa » ✓'))).toBe('Réponse à « Léa » ✓');
  });
  it('préfère le texte brut, sinon le HTML sans balises', () => {
    const p = (mime: string, t: string) => ({ mimeType: mime, body: { data: b64url(t) } });
    expect(extraireCorps({ mimeType: 'multipart/alternative', parts: [p('text/html', '<p>HTML</p>'), p('text/plain', 'Texte')] })).toBe('Texte');
    expect(extraireCorps({ mimeType: 'multipart/mixed', parts: [{ mimeType: 'multipart/alternative', parts: [p('text/html', '<p>Bonjour&nbsp;<b>Léa</b></p><script>x</script>')] }] }))
      .toBe('Bonjour Léa');
  });
  it('encode un objet accentué et construit un MIME de réponse', () => {
    expect(encoderObjet('Devis')).toBe('Devis');
    expect(encoderObjet('Relance — devis')).toBe(`=?UTF-8?B?${b64('Relance — devis')}?=`);
    const m = construireMime({ a: ['a@x.fr'], cc: ['b@y.fr'], objet: 'Re: Devis\nBcc: pirate@z.fr', corps: 'Bonjour,\nMerci.', enReponseA: '<id@mail>' });
    expect(m).toContain('To: a@x.fr\r\nCc: b@y.fr\r\nSubject: Re: Devis Bcc: pirate@z.fr\r\nIn-Reply-To: <id@mail>');
    expect(m).not.toMatch(/\r\nBcc:/); // pas d'injection d'en-tête par l'objet
    expect(m.endsWith(b64('Bonjour,\nMerci.'))).toBe(true);
  });
  it('valide les adresses', () => {
    expect(adressesValides('A@x.fr; b@y.re, a@x.fr')).toEqual(['a@x.fr', 'b@y.re']);
    expect(adressesValides('pas-une-adresse')).toBeNull();
    expect(adressesValides('')).toEqual([]);
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
  it('construit le corps de l\'événement', () => {
    expect(corpsEvenement({ titre: 'RDV', debut: '2026-11-20T14:30:00', fin: '2026-11-20T15:00:00', participants: ['a@x.fr'] })).toEqual({
      summary: 'RDV', start: { dateTime: '2026-11-20T14:30:00', timeZone: 'Indian/Reunion' },
      end: { dateTime: '2026-11-20T15:00:00', timeZone: 'Indian/Reunion' }, attendees: [{ email: 'a@x.fr' }],
    });
  });
});
