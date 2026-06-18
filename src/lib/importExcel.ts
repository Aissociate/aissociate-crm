import { supabase } from './supabase';
import type { Contact } from './database.types';

type Row = Record<string, string>;

/**
 * Parse un fichier CSV (virgule, point-virgule ou tabulation) en tableau de lignes-objet.
 * Gère les champs entre guillemets et les séparateurs multiples.
 */
export async function parseSpreadsheet(file: File): Promise<Row[]> {
  const text = await file.text();
  return parseCsv(text);
}

/** Parse un CSV en renvoyant les en-têtes de colonnes ET les lignes (pour le mapping). */
export async function parseSpreadsheetWithHeaders(file: File): Promise<{ headers: string[]; rows: Row[] }> {
  const text = await file.text();
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd().split('\n');
  if (lines.length < 1) return { headers: [], rows: [] };
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const headers = splitLine(lines[0], sep).map((h) => h.trim()).filter(Boolean);
  return { headers, rows: parseCsv(text) };
}

function parseCsv(text: string): Row[] {
  // Normalise les fins de ligne, supprime les lignes vides en fin
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd().split('\n');
  if (lines.length < 2) return [];

  // Détecte le séparateur dominant sur la 1re ligne
  const firstLine = lines[0];
  const sep = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

  const headers = splitLine(firstLine, sep).map((h) => h.trim());

  return lines.slice(1).reduce<Row[]>((acc, line) => {
    if (!line.trim()) return acc;
    const cells = splitLine(line, sep);
    const row: Row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    acc.push(row);
    return acc;
  }, []);
}

// Découpe une ligne CSV en tenant compte des champs entre guillemets
function splitLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; } // guillemet escapé
      else inQuote = !inQuote;
    } else if (ch === sep && !inQuote) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function splitName(full: string): { prenom: string | null; nom: string } {
  const parts = (full ?? '').trim().split(/\s+/);
  if (parts.length <= 1) return { prenom: null, nom: (full ?? '').trim() || '—' };
  return { prenom: parts[0], nom: parts.slice(1).join(' ') };
}

function notesFrom(row: Row, skip: Set<string>): string {
  return Object.entries(row)
    .filter(([k, v]) => k && !skip.has(k) && v && String(v).trim())
    .map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\?+/g, '?').trim()} : ${String(v).trim()}`)
    .join('\n');
}

function pick(row: Row, ...keys: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = keys.map(norm);
  for (const [k, v] of Object.entries(row)) {
    if (wanted.includes(norm(k))) return String(v ?? '').trim();
  }
  return '';
}

export interface ImportResult { lus: number; importes: number }

// ── Import CSV avec mapping de colonnes ──────────────────────────────────────

/** Champs cibles d'un contact mappables depuis un CSV. */
export const CONTACT_IMPORT_FIELDS = [
  { key: 'nom_complet', label: 'Nom complet (à découper en prénom + nom)' },
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prénom' },
  { key: 'email', label: 'E-mail' },
  { key: 'telephone', label: 'Téléphone' },
  { key: 'ville', label: 'Ville' },
  { key: 'fonction', label: 'Fonction' },
  { key: 'statut_prospect', label: 'Statut du contact' },
  { key: 'formation_envisagee', label: 'Formation envisagée' },
  { key: 'besoin_resume', label: 'Besoin / résumé' },
  { key: 'tags', label: 'Tags (séparés par , ou ;)' },
  { key: 'notes', label: 'Notes' },
] as const;

export type ContactFieldKey = (typeof CONTACT_IMPORT_FIELDS)[number]['key'];
export type ColumnMapping = Partial<Record<ContactFieldKey, string>>;

const FIELD_SYNONYMS: Record<ContactFieldKey, string[]> = {
  nom_complet: ['nom complet', 'full name', 'fullname', 'name', 'contact', 'nom et prenom'],
  nom: ['nom', 'last name', 'lastname', 'surname', 'famille'],
  prenom: ['prenom', 'prénom', 'first name', 'firstname'],
  email: ['email', 'e-mail', 'mail', 'courriel', 'adresse email'],
  telephone: ['telephone', 'téléphone', 'phone', 'tel', 'mobile', 'portable', 'gsm', 'phone number'],
  ville: ['ville', 'city', 'commune', 'localite'],
  fonction: ['fonction', 'poste', 'job', 'job title', 'title', 'titre', 'role'],
  statut_prospect: ['statut', 'status', 'statut prospect', 'statut contact', 'etat', 'état', 'stage', 'lead status'],
  formation_envisagee: ['formation', 'formation envisagee', 'formation envisagée', 'interet', 'intérêt', 'produit'],
  besoin_resume: ['besoin', 'besoin resume', 'résumé', 'message', 'demande', 'commentaire', 'note interesse'],
  tags: ['tags', 'tag', 'etiquettes', 'étiquettes', 'labels', 'segment'],
  notes: ['notes', 'note', 'remarques', 'commentaires', 'observations'],
};

const normHeader = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Devine un mapping initial colonne CSV → champ contact, par nom d'en-tête. */
export function guessMapping(headers: string[]): ColumnMapping {
  const map: ColumnMapping = {};
  for (const field of CONTACT_IMPORT_FIELDS) {
    const syns = FIELD_SYNONYMS[field.key].map(normHeader);
    const hit = headers.find((h) => syns.includes(normHeader(h)));
    if (hit) map[field.key] = hit;
  }
  // Si "nom complet" et "nom" tombent sur la même colonne, on privilégie "nom complet".
  if (map.nom_complet && map.nom === map.nom_complet) delete map.nom;
  return map;
}

/** Importe des contacts depuis des lignes CSV selon un mapping de colonnes. */
export async function importContactsMapped(
  rows: Row[], mapping: ColumnMapping, opts: { ownerId?: string | null } = {},
): Promise<ImportResult> {
  const get = (r: Row, key: ContactFieldKey): string => {
    const col = mapping[key];
    return col ? String(r[col] ?? '').trim() : '';
  };

  const byKey = new Map<string, Partial<Contact>>();
  for (const r of rows) {
    let nom = get(r, 'nom');
    let prenom = get(r, 'prenom');
    if (!nom) {
      const full = get(r, 'nom_complet');
      if (full) { const s = splitName(full); nom = s.nom; prenom = prenom || (s.prenom ?? ''); }
    }
    if (!nom) continue; // ligne sans nom -> ignorée

    const email = get(r, 'email');
    const phone = get(r, 'telephone');
    const tagsStr = get(r, 'tags');
    const tags = tagsStr ? tagsStr.split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [];
    const key = (email || phone || `${prenom} ${nom}`).toLowerCase().trim();

    byKey.set(`csv:${key}`, {
      external_id: `csv:${key}`,
      type: 'prospect' as const,
      nom, prenom: prenom || null,
      email: email || null, telephone: phone || null,
      ville: get(r, 'ville') || null,
      fonction: get(r, 'fonction') || null,
      statut_prospect: get(r, 'statut_prospect') || null,
      formation_envisagee: get(r, 'formation_envisagee') || null,
      besoin_resume: get(r, 'besoin_resume') || null,
      notes: get(r, 'notes') || null,
      tags,
      owner_id: opts.ownerId ?? null,
      metadata: r,
    });
  }

  const payloads = [...byKey.values()];
  let importes = 0;
  if (payloads.length) {
    const { data, error } = await supabase.from('contacts')
      .upsert(payloads, { onConflict: 'external_id', ignoreDuplicates: false }).select('id');
    if (error) throw new Error(error.message);
    importes = data?.length ?? 0;
  }
  return { lus: rows.length, importes };
}

export async function importCandidatsFile(file: File): Promise<ImportResult> {
  const rows = await parseSpreadsheet(file);

  let { data: offre } = await supabase.from('offres_recrutement')
    .select('id').ilike('titre', 'Chargé de formation%').maybeSingle();
  if (!offre) {
    const ins = await supabase.from('offres_recrutement')
      .insert({ titre: 'Chargé de formation', statut: 'ouverte' }).select('id').single();
    offre = ins.data;
  }

  const skip = new Set([
    'id', 'created_time', 'ad_id', 'ad_name', 'adset_id', 'adset_name',
    'campaign_id', 'campaign_name', 'form_id', 'form_name', 'is_organic',
    'platform', 'email', 'full_name', 'phone_number', 'lead_status',
  ]);

  const payloads = rows
    .map((r) => {
      const fullName = pick(r, 'full_name', 'nom complet', 'name', 'nom');
      const id = pick(r, 'id', 'lead_id');
      if (!fullName || fullName.startsWith('<') || /test lead/i.test(JSON.stringify(r))) return null;
      const { prenom, nom } = splitName(fullName);
      return {
        external_id: id ? `meta:${id}` : `cand:${(pick(r, 'email', 'phone_number') || fullName).toLowerCase()}`,
        offre_id: offre?.id ?? null,
        nom, prenom,
        email: pick(r, 'email') || null,
        telephone: pick(r, 'phone_number', 'phone', 'telephone') || null,
        statut: 'recu' as const,
        notes: notesFrom(r, skip) || null,
        metadata: r,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  let importes = 0;
  if (payloads.length) {
    const { data, error } = await supabase.from('candidats')
      .upsert(payloads, { onConflict: 'external_id', ignoreDuplicates: false }).select('id');
    if (error) throw new Error(error.message);
    importes = data?.length ?? 0;
  }
  return { lus: rows.length, importes };
}

export async function importProspectsFile(file: File, forcedOwnerId?: string): Promise<ImportResult> {
  const rows = await parseSpreadsheet(file);
  const skip = new Set(['full_name', 'company_name', 'phone', '', 'email', 'ville', 'lead_status']);

  // Si forcedOwnerId (import manuel depuis l'UI), tous les prospects vont à cet utilisateur.
  // Sinon (import auto/cron), répartition round-robin sur les conseillers actifs.
  let conseillers: string[] = [];
  if (!forcedOwnerId) {
    const { data: cons } = await supabase.from('profiles')
      .select('id').eq('role', 'conseiller').eq('actif', true);
    conseillers = (cons ?? []).map((c) => c.id);
  }

  let rr = 0;
  const payloads = rows
    .map((r) => {
      const fullName = pick(r, 'full_name', 'nom complet', 'name', 'nom');
      if (!fullName || fullName.toLowerCase() === 'full_name') return null;
      const { prenom, nom } = splitName(fullName);
      const entete: string[] = [];
      const company = pick(r, 'company_name', 'entreprise', 'société', 'societe');
      const ville = pick(r, 'ville', 'city');
      if (company) entete.push(`Entreprise : ${company}`);
      if (ville) entete.push(`Ville : ${ville}`);
      const commentaires = notesFrom(r, skip);
      const notes = [entete.join('\n'), commentaires].filter(Boolean).join('\n');
      const email = pick(r, 'email');
      const phone = pick(r, 'phone', 'telephone', 'téléphone');
      const key = (email || phone || fullName).toLowerCase().trim();
      const owner = forcedOwnerId ?? (conseillers.length ? conseillers[rr++ % conseillers.length] : null);
      return {
        external_id: `pros:${key}`,
        type: 'prospect' as const,
        nom, prenom,
        email: email || null,
        telephone: phone || null,
        notes: notes || null,
        owner_id: owner,
        metadata: r,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  let importes = 0;
  if (payloads.length) {
    const { data, error } = await supabase.from('contacts')
      .upsert(payloads, { onConflict: 'external_id', ignoreDuplicates: false }).select('id');
    if (error) throw new Error(error.message);
    importes = data?.length ?? 0;
  }
  return { lus: rows.length, importes };
}
