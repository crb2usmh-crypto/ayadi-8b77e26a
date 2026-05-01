import { createFileRoute } from "@tanstack/react-router";

/**
 * Returns the authenticated user's notifications.
 *
 * The caller proves their identity by sending a Pi access token, which we
 * verify with the Pi Platform (https://api.minepi.com/v2/me). The resulting
 * pi_uid is then used to fetch notifications via the Supabase service-role
 * key, bypassing RLS but only for that specific recipient.
 *
 * Body: { accessToken: string }
 * Success: 200 { notifications: NotificationRow[] }
 * Errors:  400 bad input | 401 invalid token | 500 server error
 */
export const Route = createFileRoute("/api/public/notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ---- 1. Parse input ----
        let body: { accessToken?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const accessToken =
          typeof body.accessToken === "string" ? body.accessToken.trim() : "";
        if (!accessToken || accessToken.length > 4096) {
          return Response.json({ error: "Missing accessToken" }, { status: 400 });
        }

        // ---- 2. Verify token with Pi ----
        let piUid: string;
        try {
          const piRes = await fetch("https://api.minepi.com/v2/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (piRes.status === 401) {
            return Response.json({ error: "Pi authentication failed" }, { status: 401 });
          }
          if (!piRes.ok) {
            return Response.json(
              { error: `Pi verification failed (${piRes.status})` },
              { status: 502 },
            );
          }
          const json = (await piRes.json()) as { uid?: string };
          if (!json?.uid) {
            return Response.json({ error: "Invalid Pi user payload" }, { status: 502 });
          }
          piUid = json.uid;
        } catch (err) {
          console.error("[pi-verify] error:", err); const message = "Authentication failed";
          return Response.json({ error: message }, { status: 500 });
        }

        // ---- 3. Fetch notifications via service-role ----
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          // Backend not yet wired; return empty list rather than crash.
          console.warn(
            "[notifications] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing.",
          );
          return Response.json({ notifications: [] });
        }

        try {
          const url =
            `${supabaseUrl}/rest/v1/notifications` +
            `?recipient_pi_uid=eq.${encodeURIComponent(piUid)}` +
            `&order=created_at.desc&limit=50`;

          const res = await fetch(url, {
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
            },
          });

          if (!res.ok) {
            const detail = await res.text();
            console.error("[notifications] fetch failed:", res.status, detail);
            return Response.json({ notifications: [] });
          }

          const rows = (await res.json()) as unknown[];
          return Response.json({ notifications: rows });
        } catch (err) {
          console.error("[notifications] error:", err);
          return Response.json({ notifications: [] });
        }
      },
    },
  },
});