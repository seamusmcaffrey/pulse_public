interface Config {
  supabase: {
    url: string;
    anonKey: string;
  };
  oauth: {
    clientId: string;
  };
}

export const config: Config = {
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
  oauth: {
    clientId: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
  },
}; 