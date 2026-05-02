/**
 * Server-only helpers for Pi access-token verification + Supabase
 * service-role calls. Imported only by /api/public/* server route files.
 * NEVER import from client code (uses process.env).
 */

export interface PiIdentity {
  uid: string;
  username: string;
}

export type VerifyResult =
  | { ok: true; identity: PiIdentity }
  | { ok: false; status: number; error: string };

const DEV_MODE_TOKEN = "dev-mode-token";
const DEV_IDENTITY: PiIdentity = { uid: "dev-user-uid", username: "مطور" };

function isDevModeAllowed(): boolean {
  return process.env.ALLOW_DEV_MODE === "true";
}

/**
 * Verify a Pi access token via the Pi Platform.
 * Returns the user's uid + username on success.
 */
export async function verifyPiToken(
  rawToken: unknown,
): Promise<VerifyResult> {
  const accessToken = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!accessToken || accessToken.length > 4096) {
    return { ok: false, status: 400, error: "Authentication required" };
  }
  // Developer Mode: only honored when explicitly enabled via env var
  // (never in production unless ALLOW_DEV_MODE=true is intentionally set).
  if (accessToken === DEV_MODE_TOKEN) {
    if (isDevModeAllowed()) {
      return { ok: true, identity: DEV_IDENTITY };
    }
    return { ok: false, status: 401, error: "Authentication failed" };
  }
  try {
    const res = await fetch("https://api.minepi.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401) {
      return { ok: false, status: 401, error: "Authentication failed" };
    }
    if (!res.ok) {
      console.error("[piVerify] upstream status:", res.status);
      return { ok: false, status: 502, error: "Authentication service unavailable" };
    }
    const json = (await res.json()) as { uid?: string; username?: string };
    if (!json?.uid || !json?.username) {
      return { ok: false, status: 502, error: "Authentication service unavailable" };
    }
    return { ok: true, identity: { uid: json.uid, username: json.username } };
  } catch (err) {
    console.error("[piVerify] error:", err);
    return { ok: false, status: 500, error: "Authentication failed" };
  }
}

export interface SupabaseAdminEnv {
  url: string;
  key: string;
}

let envLogged = false;

export function getSupabaseAdminEnv(): SupabaseAdminEnv | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!envLogged) {
    envLogged = true;
    console.log(
      "[server-env] SUPABASE_URL present:",
      Boolean(url),
      "| SUPABASE_SERVICE_ROLE_KEY present:",
      Boolean(key),
      "| ALLOW_DEV_MODE:",
      process.env.ALLOW_DEV_MODE === "true",
    );
  }
  if (!url || !key) return null;
  return { url, key };
}

export function adminHeaders(
  env: SupabaseAdminEnv,
  prefer?: string,
): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: env.key,
    Authorization: `Bearer ${env.key}`,
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

/**
 * Ensure a profile row exists for the given Pi identity. Idempotent.
 * Used at every write entry point so foreign keys on profile(pi_uid) work.
 */
export async function ensureProfile(
  env: SupabaseAdminEnv,
  identity: PiIdentity,
): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  try {
    const res = await fetch(`${env.url}/rest/v1/profiles?on_conflict=pi_uid`, {
      method: "POST",
      headers: adminHeaders(env, "resolution=merge-duplicates,return=minimal"),
      body: JSON.stringify([
        {
          pi_uid: identity.uid,
          username: identity.username,
          avatar_seed: identity.username,
          updated_at: new Date().toISOString(),
        },
      ]),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error("[ensureProfile] failed:", res.status, detail);
      return { ok: false, status: res.status, detail };
    }
    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[ensureProfile] error:", detail);
    return { ok: false, status: 500, detail };
  }
}

/**
 * Insert a notification row. Best-effort — failures are logged, not thrown,
 * because notification delivery should not block the primary action.
 */
export async function insertNotification(
  env: SupabaseAdminEnv,
  payload: {
    recipient_pi_uid: string;
    type: "offer" | "message" | "task" | "system";
    title: string;
    title_en?: string;
    body: string;
    body_en?: string;
  },
): Promise<void> {
  try {
    const res = await fetch(`${env.url}/rest/v1/notifications`, {
      method: "POST",
      headers: adminHeaders(env, "return=minimal"),
      body: JSON.stringify([payload]),
    });
    if (!res.ok) {
      console.error("[notification] insert failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[notification] insert error:", err);
  }
}