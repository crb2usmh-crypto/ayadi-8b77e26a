import { createClient } from "@supabase/supabase-js";

function resolveEnv(): { url: string; anon: string } {
  // Browser / client bundle: Vite inlines import.meta.env at build time.
  let url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
  let anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

  // Browser runtime fallback: SSR-injected config on window.
  if ((!url || !anon) && typeof window !== "undefined") {
    const cfg = (window as unknown as {
      __SUPABASE_CONFIG__?: { url?: string; anon?: string };
    }).__SUPABASE_CONFIG__;
    if (cfg) {
      url = url || cfg.url || "";
      anon = anon || cfg.anon || "";
    }
  }

  // Server (Worker) runtime: fall back to process.env so SSR works even if
  // the publish-time build didn't inline the values.
  if ((!url || !anon) && typeof process !== "undefined" && process.env) {
    url = url || (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "");
    anon =
      anon ||
      (process.env.VITE_SUPABASE_ANON_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        process.env.SUPABASE_PUBLISHABLE_KEY ??
        "");
  }
  return { url, anon };
}

// Lazy proxy: don't crash at module load when env vars are missing.
// `createClient("")` throws synchronously, which would break the whole
// SSR Worker entry (every route 500s) — we want a real error only when
// a query actually runs.
let _client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (_client) return _client;
  const { url, anon } = resolveEnv();
  if (!url || !anon) {
    throw new Error(
      "Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).",
    );
  }
  _client = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const value = c[prop];
    return typeof value === "function" ? (value as Function).bind(c) : value;
  },
});

/** Lightweight connection test — counts rows in `tasks`. */
export async function pingSupabase(): Promise<number> {
  const { count, error } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}