#!/usr/bin/env node
/**
 * Import de la bibliothèque de preuves Qualiopi « organisme » (niveau A).
 *
 * Téléverse les PDF du dossier « Documents produits » (numérotés 1→32) dans le
 * bucket privé `qualiopi`, crée une ligne `documents` (catégorie « qualiopi »)
 * et la rattache à l'indicateur correspondant (préfixe numérique du nom de
 * fichier → numéro d'indicateur).
 *
 * Idempotent : un fichier déjà importé (même titre + catégorie) est ignoré.
 *
 * Usage :
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/import-qualiopi-docs.mjs "<chemin vers Documents produits>" [--dry-run]
 *
 * La clé SERVICE ROLE (jamais l'anon) est requise : l'upload storage et les
 * insertions passent outre la RLS. On la récupère dans le dashboard Supabase
 * (Project Settings > API > service_role). Ne pas la committer.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const dir = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dir) {
  console.error('❌ Indiquez le dossier « Documents produits » en argument.');
  process.exit(1);
}
if (!url || !key) {
  console.error('❌ Variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises.');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

// Récupère récursivement les fichiers d'un dossier.
function walk(d) {
  const out = [];
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// « 6c. Exemple de déroulé.pdf » → 6 ; « 23b. Registre.pdf » → 23.
function indicatorOf(filename) {
  const m = basename(filename).match(/^(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 32 ? n : null;
}

const CONTENT_TYPES = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

async function main() {
  const files = walk(dir).filter((f) => extname(f).toLowerCase() === '.pdf');
  console.log(`📁 ${files.length} PDF trouvé(s) dans ${dir}`);

  let imported = 0, skipped = 0, unmatched = 0;

  for (const file of files) {
    const titre = basename(file);
    const ind = indicatorOf(file);

    // Idempotence : déjà importé ?
    const { data: existing } = await sb.from('documents')
      .select('id').eq('titre', titre).eq('categorie', 'qualiopi').maybeSingle();
    if (existing) { skipped++; continue; }

    if (!ind) { unmatched++; console.log(`  ⚠️  Sans indicateur (ignoré) : ${titre}`); continue; }

    const safe = titre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\- ]+/g, '_');
    const path = `bibliotheque/ind-${ind}/${Date.now()}-${safe}`;

    if (dryRun) {
      console.log(`  → [dry] ${titre}  ⇒ indicateur ${ind}`);
      imported++;
      continue;
    }

    const bytes = readFileSync(file);
    const { error: upErr } = await sb.storage.from('qualiopi').upload(path, bytes, {
      contentType: CONTENT_TYPES[extname(file).toLowerCase()] || 'application/octet-stream', upsert: true,
    });
    if (upErr) { console.error(`  ❌ Upload ${titre} : ${upErr.message}`); continue; }

    const { data: doc, error: insErr } = await sb.from('documents')
      .insert({ titre, categorie: 'qualiopi', fichier_url: path, tags: [`indicateur-${ind}`, 'bibliotheque'] })
      .select().single();
    if (insErr) { console.error(`  ❌ Insert ${titre} : ${insErr.message}`); continue; }

    await sb.from('qualiopi_preuve_document').insert({ indicateur_numero: ind, document_id: doc.id });
    console.log(`  ✅ ${titre}  ⇒ indicateur ${ind}`);
    imported++;
  }

  console.log(`\n🎉 Terminé — ${imported} importé(s), ${skipped} déjà présent(s), ${unmatched} sans indicateur.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
