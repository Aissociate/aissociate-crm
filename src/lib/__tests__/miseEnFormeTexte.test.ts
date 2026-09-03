import { describe, it, expect } from 'vitest';
import { basculerMarque } from '@/lib/miseEnFormeTexte';
import { linkifyHtml } from '@/lib/linkify';

/** Applique la bascule sur la portion `[` … `]` du texte donné. */
const sur = (avecCrochets: string, marque = '**') => {
  const a = avecCrochets.indexOf('[');
  const b = avecCrochets.indexOf(']') - 1;
  const texte = avecCrochets.replace(/[[\]]/g, '');
  return basculerMarque(texte, a, b, marque);
};

describe('basculerMarque', () => {
  it('encadre la sélection', () => {
    expect(sur('joindre votre [conseiller]')?.texte).toBe('joindre votre **conseiller**');
  });

  it("laisse l'espace de tête hors des marqueurs", () => {
    // Cas du ticket : la sélection emportait l'espace, le marqueur ouvrant
    // atterrissait contre le mot précédent (« conseiller** France Travail** »).
    expect(sur('conseiller[ France Travail]')?.texte).toBe('conseiller **France Travail**');
  });

  it('retire les marqueurs quand ils sont dans la sélection', () => {
    expect(sur('votre [**conseiller**]')?.texte).toBe('votre conseiller');
  });

  it('retire les marqueurs quand ils entourent la sélection', () => {
    expect(sur('votre **[conseiller]**')?.texte).toBe('votre conseiller');
  });

  it('recliquer deux fois revient au texte de départ', () => {
    const un = basculerMarque('votre conseiller', 6, 16, '**');
    expect(un?.texte).toBe('votre **conseiller**');
    // La sélection rendue exclut les marqueurs : la seconde bascule les retire.
    const deux = basculerMarque(un!.texte, un!.debut, un!.fin, '**');
    expect(deux?.texte).toBe('votre conseiller');
  });

  it('ne pose pas de marqueur orphelin sans sélection', () => {
    expect(basculerMarque('votre conseiller', 6, 6, '**')).toBeNull();
    expect(sur('votre [   ]conseiller')).toBeNull();
  });

  it('bascule aussi l\'italique', () => {
    expect(sur('votre [conseiller]', '_')?.texte).toBe('votre _conseiller_');
    expect(sur('votre [_conseiller_]', '_')?.texte).toBe('votre conseiller');
  });

  it('ne se trompe pas en début de texte', () => {
    expect(sur('[Bonjour] à tous')?.texte).toBe('**Bonjour** à tous');
  });

  it('produit un gras effectivement converti à l\'envoi', () => {
    const r = sur('conseiller[ France Travail].');
    expect(linkifyHtml(r!.texte)).toBe('conseiller <strong>France Travail</strong>.');
  });
});
