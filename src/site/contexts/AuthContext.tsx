// @ts-nocheck
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

type AdminViewRole = 'admin' | 'fixer' | 'closer' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  adminMode: boolean;
  adminViewRole: AdminViewRole;
  setAdminViewRole: (role: AdminViewRole) => void;
  toggleAdminMode: () => void;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminMode, setAdminMode] = useState(false);
  const [adminViewRole, setAdminViewRole] = useState<AdminViewRole>(null);

  const toggleAdminMode = () => {
    setAdminMode(!adminMode);
    if (!adminMode) {
      console.log('🔓 Mode Admin activé');
    } else {
      console.log('🔒 Mode Admin désactivé');
    }
  };

  const fetchProfile = async (userId: string) => {
    console.log('📥 Fetching profile for user:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching profile:', error);
      console.error('Error details:', error);
    }

    if (data) {
      console.log('✅ Profile loaded:', data);
      console.log('✅ is_admin value:', data.is_admin);
      setProfile(data as Profile);
    } else {
      console.log('⚠️ No profile found for user:', userId);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser && currentUser.id === userId) {
        console.log('🔧 Creating missing profile for user:', userId);
        const { error: createError } = await supabase.from('profiles').insert({
          id: userId,
          email: currentUser.email!,
          status: 'new_user',
        });

        if (createError) {
          console.error('❌ Error creating profile:', createError);
          setProfile(null);
        } else {
          console.log('✅ Profile created successfully');
          await fetchProfile(userId);
        }
      } else {
        setProfile(null);
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
        setLoading(false);
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setLoading(true);
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    console.log('📝 Starting sign up for:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('❌ Sign up error:', error);
      return { error };
    }

    if (data.user) {
      console.log('✅ User created:', data.user.id);

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email!,
        status: 'new_user',
      });

      if (profileError) {
        console.error('❌ Profile creation error:', profileError);
        return { error: profileError };
      }

      console.log('✅ Profile created in database');

      await new Promise(resolve => setTimeout(resolve, 500));

      await fetchProfile(data.user.id);
      console.log('✅ Profile loaded after sign up');
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Starting sign in for:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Sign in error:', error);
      return { error };
    }

    if (data.user) {
      console.log('✅ User logged in:', data.user.id);
      await fetchProfile(data.user.id);
    }

    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setAdminViewRole(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      adminMode,
      adminViewRole,
      setAdminViewRole,
      toggleAdminMode,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
