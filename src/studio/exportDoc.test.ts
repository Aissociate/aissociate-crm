import { describe, expect, it } from 'vitest';
import { analyserEnLigne, analyserMarkdown, documentHtml, lignesEntete, nomFichier } from './exportDoc';

describe('exports Word / PDF du Studio', () => {
  it('découpe une réponse Markdown en blocs', () => {
    const blocs = analyserMarkdown('## Titre\n\nTexte **gras**\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n- un\n- deux\n\n1. a\n2. b\n\n---\n```\ncode\n```');
    expect(blocs.map((b) => b.type)).toEqual(['titre', 'paragraphe', 'tableau', 'liste', 'liste', 'separateur', 'code']);
    const tableau = blocs[2] as Extract<(typeof blocs)[number], { type: 'tableau' }>;
    expect(tableau.rangs).toHaveLength(1);
    expect((blocs[4] as { ordonnee: boolean }).ordonnee).toBe(true);
  });

  it('repère gras, italique et code en ligne', () => {
    expect(analyserEnLigne('a **b** *c* `d`')).toEqual([
      { texte: 'a ' }, { texte: 'b', gras: true }, { texte: ' ' }, { texte: 'c', italique: true }, { texte: ' ' }, { texte: 'd', code: true },
    ]);
  });

  it("échappe le HTML d'une réponse (pas d'injection dans le document imprimé)", () => {
    const html = documentHtml({
      titre: '<b>T</b>', meta: 'm', contenu: '<script>alert(1)</script> **ok**',
      entete: { raison_sociale: 'A & B' }, nomEspace: 'X',
    }, 'https://exemple.re/logo.png?x="1"');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('logo.png?x=&quot;1&quot;');
  });

  it("utilise le nom de l'espace quand la raison sociale manque", () => {
    expect(lignesEntete({}, 'Démo — Les Délices').nom).toBe('Les Délices');
    expect(lignesEntete({ siret: '123', mentions: 'RCS' }, 'X').pied).toBe('X · SIRET 123 · RCS');
  });

  it('propose un nom de fichier propre', () => {
    expect(nomFichier("Relance d'impayé — CE Sucrerie", 'docx')).toMatch(/^relance-d-impaye-ce-sucrerie-\d{4}-\d{2}-\d{2}\.docx$/);
  });
});
