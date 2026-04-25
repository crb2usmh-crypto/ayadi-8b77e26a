import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (anon key, RLS applies).
 *
 * IMPORTANT: We do NOT use Supabase Auth — authentication is handled
 * exclusively via Pi Network (see PiAuthProvider). This client is used
 * only for public READ queries (tasks, profiles). All writes happen on
 * the server (TanStack server routes) using the service-role key.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We use Pi auth, not Supabase auth.
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});