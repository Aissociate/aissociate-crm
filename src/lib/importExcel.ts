import { supabase } from './supabase';

type Row = Record<string, string>;

/**
 * Parse un fichier CSV (virgule, point-virgule ou tabulation) en tableau de lignes-objet.
 * Gère les champs entre guillemets et les séparateurs multiples.
 */
export async function parseSpreadsheet(file: File): Promise<Row[]> {
  const text = await file.text();
  return parseCsv(text);
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
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  let importes = 0;
  if (payloads.length) {
    const { data, error } = await supabase.from('candidats')
      .upsert(payloads, { onConflict: 'external_id', ignoreDuplicates: true }).select('id');
    if (error) throw new Error(error.message);
    importes = data?.length ?? 0;
  }
  return { lus: rows.length, importes };
}

export async function importProspectsFile(file: File): Promise<ImportResult> {
  const rows = await parseSpreadsheet(file);
  const skip = new Set(['full_name', 'company_name', 'phone', '', 'email', 'ville', 'lead_status']);

  const { data: cons } = await supabase.from('profiles')
    .select('id').eq('role', 'conseiller').eq('actif', true);
  const conseillers = (cons ?? []).map((c) => c.id);

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
      const owner = conseillers.length ? conseillers[rr++ % conseillers.length] : null;
      return {
        external_id: `pros:${key}`,
        type: 'prospect' as const,
        nom, prenom,
        email: email || null,
        telephone: phone || null,
        notes: notes || null,
        owner_id: owner,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  let importes = 0;
  if (payloads.length) {
    const { data, error } = await supabase.from('contacts')
      .upsert(payloads, { onConflict: 'external_id', ignoreDuplicates: true }).select('id');
    if (error) throw new Error(error.message);
    importes = data?.length ?? 0;
  }
  return { lus: rows.length, importes };
}
