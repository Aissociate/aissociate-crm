import { supabase } from './supabase';

type Row = Record<string, string>;

/** Lit la 1re feuille d'un fichier .xlsx / .xls / .csv en lignes objet.
 *  xlsx est chargé dynamiquement pour ne pas alourdir le bundle initial. */
export async function parseSpreadsheet(file: File): Promise<Row[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: '', raw: false });
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

// Récupère une valeur quel que soit le libellé exact de colonne (tolérant).
function pick(row: Row, ...keys: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = keys.map(norm);
  for (const [k, v] of Object.entries(row)) {
    if (wanted.includes(norm(k))) return String(v ?? '').trim();
  }
  return '';
}

export interface ImportResult { lus: number; importes: number }

/** Importe des candidatures (« Chargé de formation ») depuis un fichier. */
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
    // ignoreDuplicates : n'insère que les NOUVEAUX (ne réécrit pas les existants)
    const { data, error } = await supabase.from('candidats')
      .upsert(payloads, { onConflict: 'external_id', ignoreDuplicates: true }).select('id');
    if (error) throw new Error(error.message);
    importes = data?.length ?? 0;
  }
  return { lus: rows.length, importes };
}

/** Importe des prospects depuis un fichier ; commentaires conservés en notes. */
export async function importProspectsFile(file: File, ownerId: string | null): Promise<ImportResult> {
  const rows = await parseSpreadsheet(file);
  const skip = new Set(['full_name', 'company_name', 'phone', '', 'email', 'ville', 'lead_status']);

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
      return {
        external_id: `pros:${key}`,
        type: 'prospect' as const,
        nom, prenom,
        email: email || null,
        telephone: phone || null,
        notes: notes || null,
        owner_id: ownerId,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  let importes = 0;
  if (payloads.length) {
    // ignoreDuplicates : préserve les affectations déjà faites lors des ré-imports
    const { data, error } = await supabase.from('contacts')
      .upsert(payloads, { onConflict: 'external_id', ignoreDuplicates: true }).select('id');
    if (error) throw new Error(error.message);
    importes = data?.length ?? 0;
  }
  return { lus: rows.length, importes };
}
