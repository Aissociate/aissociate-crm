import { describe, expect, it } from 'vitest';
import { corpsMultipart, echapperQ, formatLecture, markdownVersHtml, requeteDossier, requeteRecherche } from './drive';

describe('drive — requêtes', () => {
  it('échappe apostrophes et barres obliques inverses', () => {
    expect(echapperQ("l'offre \\ 2026")).toBe("l\\'offre \\\\ 2026");
  });
  it('cherche par nom ou contenu, hors corbeille', () => {
    expect(requeteRecherche(" devis d'avril ")).toBe("(name contains 'devis d\\'avril' or fullText contains 'devis d\\'avril') and trashed = false");
  });
  it('liste un dossier ou tout le Drive', () => {
    expect(requeteDossier('abc')).toBe("'abc' in parents and trashed = false");
    expect(requeteDossier(null)).toBe('trashed = false');
    // Une injection dans l'id reste enfermée dans la chaîne.
    expect(requeteDossier("x' or name contains '")).toBe("'x\\' or name contains \\'' in parents and trashed = false");
  });
});

describe('drive — lecture', () => {
  it('exporte les formats Google, lit le texte, refuse le binaire', () => {
    expect(formatLecture('application/vnd.google-apps.document')).toEqual({ export: 'text/plain' });
    expect(formatLecture('application/vnd.google-apps.spreadsheet')).toEqual({ export: 'text/csv' });
    expect(formatLecture('text/markdown')).toEqual({ direct: true });
    expect(formatLecture('application/pdf')).toEqual({ illisible: true });
  });
});

describe('drive — création', () => {
  it('convertit le Markdown simple en HTML échappé', () => {
    const h = markdownVersHtml('# Titre\nTexte **gras** <script>\n\n- un\n- deux\n1. premier');
    expect(h).toContain('<h1>Titre</h1>');
    expect(h).toContain('<p>Texte <b>gras</b> &lt;script&gt;</p>');
    expect(h).toContain('<ul><li>un</li><li>deux</li></ul><ol><li>premier</li></ol>');
  });
  it('assemble un corps multipart/related', () => {
    const c = corpsMultipart({ name: 'Doc' }, '<p>x</p>', 'F');
    expect(c.startsWith('--F\r\nContent-Type: application/json')).toBe(true);
    expect(c).toContain('{"name":"Doc"}');
    expect(c.endsWith('--F--\r\n')).toBe(true);
  });
});
