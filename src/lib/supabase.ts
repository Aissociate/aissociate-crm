import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * `true` tant que les variables Supabase ne sont pas renseignees.
 * Permet a l'app de s'afficher (ecran de configuration) au lieu de planter
 * au demarrage dans Bolt avant le branchement Supabase.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient<Database>(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
