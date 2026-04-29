import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'wxata-auth',        // unique key prevents conflicts with other Supabase apps
    autoRefreshToken: true,
    detectSessionInUrl: true,        // picks up token_hash from /confirm URL
    flowType: 'pkce',                // more secure, avoids implicit flow race conditions
  },
});
