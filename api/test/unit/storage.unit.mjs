import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.JWT_SECRET ??= 'secret-de-test-suffisamment-long-0123456789';
process.env.AUTHENTICATOR_PASSWORD ??= 'x';
process.env.AUTH_ADMIN_PASSWORD ??= 'x';
process.env.STORAGE_DIR ??= '/data/storage';
const { checkName } = await import('../../src/storage/routes.js');
const { objectPath } = await import('../../src/storage/files.js');
const { pool } = await import('../../src/db.js');

test('noms d\'objets : traversée de répertoire et caractères refusés', () => {
  for (const ok of ['a.pdf', 'dossier/sous dossier/Fichier (1).pdf', 'contacts/123/cv_2026-11.docx', "a'b&c=d;e:f+g,h?i.txt"]) assert.equal(checkName(ok), ok);
  for (const bad of ['', '/abs.pdf', 'a/', '../secret', 'a/../../etc/passwd', 'a/./b', 'a//b', '..', 'a' + String.fromCharCode(92) + 'b', 'a' + String.fromCharCode(0) + 'b', 'é.pdf', 'a\nb', 'x'.repeat(1025), null, undefined, 42, 'a/%2e%2e/b', 'a<script>']) {
    assert.throws(() => checkName(bad), (e) => e.status === 400, String(bad).slice(0, 30));
  }
});

test('chemin disque : uniquement bucket valide + uuid', () => {
  const id = '11111111-2222-3333-4444-555555555555';
  assert.match(objectPath('documents', id).replaceAll(String.fromCharCode(92), '/'), /\/data\/storage\/documents\/11111111-2222-3333-4444-555555555555$/);
  for (const [b, i] of [['../etc', id], ['documents', '../../etc/passwd'], ['documents', 'x'], ['Docs', id], ['a/b', id], ['', id], ['.tmp', id]]) {
    assert.throws(() => objectPath(b, i), (e) => e.status === 400, `${b} ${i}`);
  }
});

test.after(() => pool.end());
