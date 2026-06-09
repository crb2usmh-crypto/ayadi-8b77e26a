import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (anon key, RLS applies).
 *
 * IMPORTANT: We do NOT use Supabase Auth — authentication is handled
 * exclusively via Pi Network (see PiAuthProvider). This client is used
 * only for public READ queries (tasks, profiles). All writes happen on
 * the server (TanStack server routes) using the service-role key.
 *
 * The client is created lazily so missing env vars at SSR/module-init time
 * do not crash the whole app — they only fail at actual use sites.
 */
function readEnv(name: string): string | undefined {
  const fromVite =
    (import.meta as { env?: Record<string, string | undefined> }).env?.[name];
  if (fromVite) return fromVite;
  if (typeof process !== "undefined" && process.env) {
    return process.env[name] ?? process.env[name.replace(/^VITE_/, "")];
  }
  return undefined;
}

let cached: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cached) return cached;
  const url = readEnv("VITE_SUPABASE_URL");
  const anon = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!url || !anon) {
    throw new Error(
      "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.",
    );
  }
  cached = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}

// Proxy so existing `supabase.from(...)` call sites keep working but creation
// is deferred until first access.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});