import { describe, expect, it } from 'vitest';
import { nettoyerHtml, titreDuHtml } from './html';
import { imageValide } from './vision';

describe('documents HTML des agents', () => {
  it('retire scripts, cadres, formulaires, attributs d\'événement et URL actives', () => {
    const sale = '<h1 onclick="x()">Devis</h1><script>alert(1)</script><iframe src="https://a"></iframe>'
      + '<a href="javascript:alert(1)">lien</a><img src="x" onerror="alert(1)"><form><input></form>'
      + '<a href="https://ok.fr">ok</a><img src="data:image/png;base64,AAAA">';
    const propre = nettoyerHtml(sale);
    expect(propre).not.toMatch(/script|iframe|onclick|onerror|javascript:|<form|<input/i);
    expect(propre).toContain('<h1>Devis</h1>');
    expect(propre).toContain('href="https://ok.fr"');
    expect(propre).toContain('data:image/png;base64');
  });
  it('garde les styles et le corps d\'un document complet', () => {
    const h = nettoyerHtml('<!doctype html><html><head><title>T</title><style>h1{color:red}</style></head><body><h1>Titre</h1><p>Texte</p></body></html>');
    expect(h).toBe('<style>h1{color:red}</style><h1>Titre</h1><p>Texte</p>');
    expect(nettoyerHtml('<style>@import url(x.css); p{}</style><p>a</p>')).not.toContain('@import');
  });
  it('déduit un titre du premier intitulé', () => {
    expect(titreDuHtml('<style></style><h1>Proposition <b>Dupont</b></h1>')).toBe('Proposition Dupont');
    expect(titreDuHtml('<p>sans titre</p>')).toBe('');
  });
  it('n\'accepte que des images raster en URL data', () => {
    expect(imageValide('data:image/png;base64,iVBORw0KGgo=')).toBeTruthy();
    expect(imageValide('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(imageValide('https://exemple.fr/a.png')).toBeNull();
  });
});
