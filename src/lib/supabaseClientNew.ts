import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // Visible diagnostic — never logs the values themselves.
  console.error(
    "[supabase] Missing env vars — url present:",
    Boolean(url),
    "anon present:",
    Boolean(anon),
  );
}

export const supabase = createClient(url ?? "", anon ?? "", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
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