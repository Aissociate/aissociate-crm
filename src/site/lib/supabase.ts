// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name?: string | null;
  role: 'fixer' | 'closer' | 'admin' | 'manager' | null;
  status: 'new_user' | 'pending_quiz' | 'pending_audio' | 'validated' | 'active' | 'rejected';
  experience: string | null;
  availability: string | null;
  motivation: string | null;
  framework_accepted_at: string | null;
  training_completed_at: string | null;
  validated_at: string | null;
  activated_at: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Application = {
  id: string;
  profile_id: string;
  role_desired: 'fixer' | 'closer';
  experience: string;
  availability: string;
  motivation: string;
  ethical_framework_accepted: boolean;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
};

export type TrainingProgress = {
  id: string;
  profile_id: string;
  module_common_completed: boolean;
  module_role_completed: boolean;
  quiz_score: number;
  quiz_passed: boolean;
  test_call_url: string | null;
  test_call_validated: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
