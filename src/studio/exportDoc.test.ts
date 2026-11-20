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

  it('nomme un livrable Agent-Titre-Réf-vN', () => {
    expect(nomFichier({ agent: 'Hugo', titre: 'Posts réseaux sociaux — 3 actualités IA', id: '88e7c4db-dfeb-4dc7-9d5b-d3b24ba113a9', version: 2 }, 'pdf'))
      .toBe('Hugo-Posts-reseaux-sociaux-3-actualites-IA-L-88e7c4db-v2.pdf');
    expect(nomFichier({ agent: 'Léa', titre: 'Plan', id: '11112222-0000-0000-0000-000000000000' }, 'doc')).toBe('Lea-Plan-L-11112222-v1.doc');
  });
  it('date un document sans livrable, et tient sans titre ni agent', () => {
    const date = new Date('2026-11-21T08:00:00Z');
    expect(nomFichier({ agent: 'Théo', titre: "Relance d'impayé — CE Sucrerie", date }, 'docx')).toBe('Theo-Relance-d-impaye-CE-Sucrerie-2026-11-21.docx');
    expect(nomFichier({ titre: '—', date }, 'pdf')).toBe('Document-2026-11-21.pdf');
  });
});
