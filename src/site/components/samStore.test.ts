import { describe, expect, it } from 'vitest';
import { decouper, lienEssai } from './samStore';

describe('decouper', () => {
  it('rend cliquable un lien du site, sans la ponctuation finale', () => {
    const b = decouper('Remplissez https://aissociate.re/studio/demarrer. Merci');
    expect(b[1]).toEqual({ t: 'lien', v: 'aissociate.re/studio/demarrer', href: '/studio/demarrer', interne: true });
    expect(b[2]).toEqual({ t: 'texte', v: '.' });
  });
  it('reconnaît un lien sans protocole, un lien externe, un e-mail et un téléphone', () => {
    expect(decouper('voir aissociate.re/formations')[1]).toMatchObject({ t: 'lien', href: '/formations', interne: true });
    expect(decouper('https://example.com/a?b=1')[0]).toMatchObject({ t: 'lien', href: 'https://example.com/a?b=1', interne: false });
    expect(decouper('contact@aissociate.re')[0]).toMatchObject({ href: 'mailto:contact@aissociate.re' });
    expect(decouper('appelez le 06 92 24 68 60')[1]).toMatchObject({ href: 'tel:+262692246860' });
  });
  it('rend le gras et laisse le reste du texte intact', () => {
    expect(decouper('a **b** c')).toEqual([{ t: 'texte', v: 'a ' }, { t: 'gras', v: 'b' }, { t: 'texte', v: ' c' }]);
  });
  it('propose le bouton d\'essai quand le lien du questionnaire est cité', () => {
    expect(lienEssai('sur https://aissociate.re/studio/demarrer')).toBe('/studio/demarrer?depuis=sam');
    expect(lienEssai('bonjour')).toBeNull();
  });
});
