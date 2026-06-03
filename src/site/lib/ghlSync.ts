// @ts-nocheck
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface GHLSyncPayload {
  source_table: 'dossiers' | 'contact_requests';
  source_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company?: string;
  source?: string;
  status?: string;
  product_type?: string;
  sector?: string;
  notes?: string;
  tags?: string[];
}

export async function syncLeadToGHL(payload: GHLSyncPayload): Promise<void> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/sync-gohighlevel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      console.warn('[GHL Sync] Echec:', data.error || data.details);
    }
  } catch (err) {
    console.warn('[GHL Sync] Erreur reseau:', err);
  }
}
