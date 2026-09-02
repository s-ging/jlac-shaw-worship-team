// src/lib/auth.ts
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from './types';

// ---- State (reactive) ----
let session = $state<Session | null>(null);
let user = $state<User | null>(null);
let profile = $state<Profile | null>(null);
let loading = $state(true);

// ---- Init ----
export async function initAuth() {
  loading = true;
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  session = currentSession;
  user = currentSession?.user || null;
  if (user) await fetchProfile(user.email!);
  loading = false;

  supabase.auth.onAuthStateChange((_event, newSession) => {
    session = newSession;
    user = newSession?.user || null;
    if (user) fetchProfile(user.email!);
    else profile = null;
  });
}

// ---- Sign in ----
export async function signInWithGoogle() {
  // If you're using the built-in Google provider:
  const provider = 'custom:google';
  // If you're using a custom provider (like 'custom:google'), use that string:
  // const provider = 'custom:google';

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

// ---- Sign out ----
export async function signOut() {
  await supabase.auth.signOut();
  session = null;
  user = null;
  profile = null;
}

// ---- Fetch profile ----
async function fetchProfile(email: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();
  if (!error && data) profile = data as Profile;
}

// ---- Exported reactive getters ----
export function useAuth() {
  return {
    get session() { return session; },
    get user() { return user; },
    get profile() { return profile; },
    get loading() { return loading; },
    get isAuthenticated() { return !!user; },
    get isWorshipLeader() { return profile?.is_worship_leader || false; },
    get isSuperAdmin() { return profile?.is_superadmin || false; },
    signInWithGoogle,
    signOut,
    initAuth,
  };
}