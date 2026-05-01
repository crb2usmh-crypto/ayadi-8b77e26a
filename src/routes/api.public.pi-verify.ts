import { createFileRoute } from "@tanstack/react-router";

/**
 * Verifies a Pi Network access token by calling the official Pi Platform API,
 * then upserts the user into the `profiles` table (if Supabase service-role
 * credentials are configured on the server).
 *
 * Body: { accessToken: string }
 * Success: 200 { uid, username, profile? }
 * Failure: 401 invalid token | 400 bad input | 500 server/upstream error
 *
 * Required `profiles` table columns (when persistence is enabled):
 *   id          uuid primary key default gen_random_uuid()
 *   pi_uid      text unique not null
 *   username    text not null
 *   created_at  timestamptz default now()
 *   updated_at  timestamptz default now()
 */
export const Route = createFileRoute("/api/public/pi-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ---- 1. Parse & validate input -----------------------------------
        let body: { accessToken?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const accessToken =
          typeof body.accessToken === "string" ? body.accessToken.trim() : "";
        if (!accessToken || accessToken.length > 4096) {
          return Response.json({ error: "Authentication required" }, { status: 400 });
        }

        // Developer Mode short-circuit (only honored when explicitly enabled).
        if (accessToken === "dev-mode-token") {
          if (process.env.ALLOW_DEV_MODE === "true") {
            return Response.json({
              uid: "dev-user-uid",
              username: "مطور",
              profile: null,
            });
          }
          return Response.json({ error: "Authentication failed" }, { status: 401 });
        }

        // ---- 2. Verify with Pi Platform ----------------------------------
        let me: { uid: string; username: string };
        try {
          const piRes = await fetch("https://api.minepi.com/v2/me", {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (piRes.status === 401) {
            return Response.json({ error: "Authentication failed" }, { status: 401 });
          }
          if (!piRes.ok) {
            console.error("[pi-verify] upstream:", piRes.status);
            return Response.json(
              { error: "Authentication service unavailable" },
              { status: 502 },
            );
          }

          const json = (await piRes.json()) as { uid?: string; username?: string };
          if (!json?.uid || !json?.username) {
            return Response.json({ error: "Authentication service unavailable" }, { status: 502 });
          }
          me = { uid: json.uid, username: json.username };
        } catch (err) {
          console.error("[pi-verify] error:", err);
          return Response.json({ error: "Authentication failed" }, { status: 500 });
        }

        // ---- 3. Persist to `profiles` (best-effort) ----------------------
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        let profile: unknown = null;
        if (supabaseUrl && serviceKey) {
          try {
            // Upsert by pi_uid using PostgREST. `Prefer: resolution=merge-duplicates`
            // requires a unique/PK constraint on the conflict target columns.
            const upsertRes = await fetch(
              `${supabaseUrl}/rest/v1/profiles?on_conflict=pi_uid`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: serviceKey,
                  Authorization: `Bearer ${serviceKey}`,
                  Prefer: "return=representation,resolution=merge-duplicates",
                },
                body: JSON.stringify([
                  {
                    pi_uid: me.uid,
                    username: me.username,
                    updated_at: new Date().toISOString(),
                  },
                ]),
              },
            );

            if (upsertRes.ok) {
              const rows = (await upsertRes.json()) as unknown[];
              profile = Array.isArray(rows) ? rows[0] ?? null : null;
            } else {
              const detail = await upsertRes.text();
              console.error("[pi-verify] profile upsert failed:", upsertRes.status, detail);
            }
          } catch (err) {
            // Don't fail authentication just because persistence failed —
            // the user's identity is already verified by Pi.
            console.error("[pi-verify] profile upsert error:", err);
          }
        } else {
          console.warn(
            "[pi-verify] Skipping profile upsert: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.",
          );
        }

        // ---- 4. Respond --------------------------------------------------
        return Response.json({ uid: me.uid, username: me.username, profile });
      },
    },
  },
});
