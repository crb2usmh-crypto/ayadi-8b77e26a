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

/**
 * Verify a Pi access token via the Pi Platform.
 * Returns the user's uid + username on success.
 */
export async function verifyPiToken(
  rawToken: unknown,
): Promise<VerifyResult> {
  const accessToken = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!accessToken || accessToken.length > 4096) {
    return { ok: false, status: 400, error: "Missing or invalid accessToken" };
  }
  try {
    const res = await fetch("https://api.minepi.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401) {
      return { ok: false, status: 401, error: "Pi authentication failed" };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: 502,
        error: `Pi verification failed (${res.status})`,
      };
    }
    const json = (await res.json()) as { uid?: string; username?: string };
    if (!json?.uid || !json?.username) {
      return { ok: false, status: 502, error: "Invalid Pi user payload" };
    }
    return { ok: true, identity: { uid: json.uid, username: json.username } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pi verification error";
    return { ok: false, status: 500, error: message };
  }
}

export interface SupabaseAdminEnv {
  url: string;
  key: string;
}

export function getSupabaseAdminEnv(): SupabaseAdminEnv | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
): Promise<void> {
  await fetch(`${env.url}/rest/v1/profiles?on_conflict=pi_uid`, {
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