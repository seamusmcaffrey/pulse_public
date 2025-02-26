import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Initialize Supabase client
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function handleAuthCallback() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    throw error;
  }

  if (!session) {
    throw new Error('No session found');
  }

  return {
    user: session.user,
    tokens: {
      access_token: session.access_token,
      refresh_token: session.refresh_token
    }
  };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
} 