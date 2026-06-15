import {
  createContext, useContext, useEffect, useState, useCallback, type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Profile, UserRole } from '@/lib/database.types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  role: UserRole | null;
  isAdmin: boolean;
  isManager: boolean;
  approved: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string, password: string, meta: { nom: string; prenom: string; role?: UserRole },
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    // Diagnostic explicite : révèle le projet Supabase utilisé et l'issue du chargement.
    const projet = import.meta.env.VITE_SUPABASE_URL;
    if (error) {
      console.error('[AISSOCIATE] ❌ Échec chargement profil —', error.message, '| projet:', projet, '| user:', userId);
    } else if (!data) {
      console.warn('[AISSOCIATE] ⚠️ Aucun profil pour ce compte sur CE projet —', projet, '| user:', userId,
        '→ promeus CE compte sur CE projet (SQL editor de', projet + ').');
    } else {
      console.info('[AISSOCIATE] ✅ Profil chargé —', data.email, '| role =', data.role, '| projet:', projet);
    }
    setProfile(data ?? null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        (async () => { await loadProfile(newSession.user.id); })();
      } else {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, meta: { nom: string; prenom: string; role?: UserRole }) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nom: meta.nom, prenom: meta.prenom, role: meta.role ?? 'conseiller' } },
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const role = profile?.role ?? null;
  // Deux modèles de rôle coexistent : `role` (enum) et le flag `is_admin` écrit
  // par le flux du site. La base les aligne désormais (helpers is_admin()/
  // is_manager() honorent les deux, cf. migration align_is_admin_flag) ; on
  // reconnaît donc aussi `is_admin` côté front pour rester cohérent.
  const isAdminFlag = profile?.is_admin === true;
  const isAdmin = role === 'admin' || isAdminFlag;
  const isManager = isAdmin || role === 'directeur_commercial';
  const approved = profile?.approved === true || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        configured: isSupabaseConfigured,
        role,
        isAdmin,
        isManager,
        approved,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
