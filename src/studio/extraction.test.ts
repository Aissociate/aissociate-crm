// Tests des helpers purs de extraction.ts : extension, texteDeBalises,
// texteRtf, ordreNaturel. On ne teste pas extraireTexte (charge des
// bibliothèques via esm.sh, pas joignable hors navigateur).
import { describe, expect, it } from 'vitest';
import { extension, FORMATS_DOCUMENTS, ordreNaturel, TAILLE_MAX, texteDeBalises, texteRtf } from './extraction';

describe('extension', () => {
  it('retourne la dernière partie après le point en minuscules', () => {
    expect(extension('rapport.PDF')).toBe('pdf');
    expect(extension('dossier/fichier.DocX')).toBe('docx');
    expect(extension('a.b.c.MD')).toBe('md');
  });
  it('retourne le nom complet (en minuscules) quand il n\'y a pas de point', () => {
    // split('.').pop() d'une chaîne sans '.' retourne la chaîne elle-même.
    expect(extension('README')).toBe('readme');
  });
});

describe('texteDeBalises', () => {
  it('retire les balises HTML et décode les entités courantes', () => {
    const out = texteDeBalises('<p>Un <b>deux</b> &amp; trois &lt;x&gt; &quot;ok&quot;</p>');
    expect(out).toBe('Un deux & trois <x> "ok"');
  });
  it('transforme les fermetures de bloc en saut de ligne', () => {
    const out = texteDeBalises('<p>a</p><p>b</p><div>c</div>');
    expect(out).toBe('a\nb\nc');
  });
  it('retire entièrement le contenu des blocs <script> et <style>', () => {
    const out = texteDeBalises('avant<script>alert(1)</script>après<style>.x{}</style>');
    expect(out).toContain('avant');
    expect(out).toContain('après');
    expect(out).not.toContain('alert(1)');
    expect(out).not.toContain('.x{}');
  });
  it('compacte les espaces et saute les lignes vides en trop', () => {
    expect(texteDeBalises('<p>a   b</p>\n\n\n<p>c</p>')).toBe('a b\n\nc');
  });
  it('décode &nbsp;, &apos; et &#39;', () => {
    expect(texteDeBalises('l&apos;été &#39;26&nbsp;avec')).toBe("l'été '26 avec");
  });
});

describe('texteRtf', () => {
  it('convertit \\par en saut de ligne et retire les commandes', () => {
    const out = texteRtf('{\\rtf1\\ansi Bonjour\\par le monde\\par}');
    expect(out.replace(/\s+/g, ' ')).toContain('Bonjour');
    expect(out).toContain('le monde');
    expect(out).not.toMatch(/\\par|\\rtf/);
  });
  it('décode les séquences hexadécimales \\\'XX', () => {
    // \'e9 == é
    const out = texteRtf("caf\\'e9");
    expect(out).toContain('café');
  });
  it('retire les groupes de contrôle {\\*…}', () => {
    expect(texteRtf('A{\\*\\fonttbl X}B')).not.toContain('fonttbl');
  });
});

describe('ordreNaturel', () => {
  it('trie slide2 avant slide10 (ordre numérique, pas lexicographique)', () => {
    const noms = ['ppt/slides/slide10.xml', 'ppt/slides/slide2.xml', 'ppt/slides/slide1.xml'];
    expect([...noms].sort(ordreNaturel)).toEqual([
      'ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'ppt/slides/slide10.xml',
    ]);
  });
  it('place à zéro les entrées sans numéro', () => {
    expect([...['x.xml', 'slide3.xml']].sort(ordreNaturel)).toEqual(['x.xml', 'slide3.xml']);
  });
});

describe('constantes exportées', () => {
  it('FORMATS_DOCUMENTS contient au moins PDF et DOCX', () => {
    expect(FORMATS_DOCUMENTS).toContain('.pdf');
    expect(FORMATS_DOCUMENTS).toContain('.docx');
  });
  it('TAILLE_MAX est de 15 Mo', () => {
    expect(TAILLE_MAX).toBe(15e6);
  });
});
