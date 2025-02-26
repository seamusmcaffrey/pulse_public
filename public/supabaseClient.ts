import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseConfig = {
  url: 'https://xuypxquhkubappzovinl.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1eXB4cXVoa3ViYXBwem92aW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzMTEzMTUsImV4cCI6MjA1NDg4NzMxNX0.704l61wPoYoVQe7Iu5GvpBDPi8xfVh6eD8HYdfWkliE'
};

declare global {
  interface Window {
    config?: {
      supabase: typeof supabaseConfig;
    };
  }
}

// Get config either from window.config (content script) or direct config (service worker)
const getConfig = () => {
  if (typeof window !== 'undefined' && window.config?.supabase) {
    return window.config.supabase;
  }
  return supabaseConfig;
};

const config = getConfig();
export const supabase = createClient(config.url, config.anonKey);

// Add type checking for the auth methods
export const auth = {
  signInWithIdToken: async ({ provider, token }: { provider: string; token: string }) => {
    try {
      const response = await fetch(`${config.url}/auth/v1/token?grant_type=id_token`, {
        method: 'POST',
        headers: {
          'apikey': config.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider,
          id_token: token
        })
      });

      if (!response.ok) {
        throw new Error('Failed to authenticate with Supabase');
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      console.error('[DEBUG] Supabase auth error:', error);
      return { data: null, error };
    }
  }
}; 