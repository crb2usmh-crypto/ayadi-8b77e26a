import { createFileRoute } from "@tanstack/react-router";

/**
 * Verifies a Pi Network access token by calling the official Pi Platform API.
 * Docs: https://github.com/pi-apps/pi-platform-docs/blob/master/authentication.md
 *
 * Body: { accessToken: string }
 * Returns: { uid: string, username: string } on success, { error } otherwise.
 */
export const Route = createFileRoute("/api/public/pi-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { accessToken?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const accessToken =
          typeof body.accessToken === "string" ? body.accessToken : null;
        if (!accessToken) {
          return Response.json(
            { error: "Missing accessToken" },
            { status: 400 },
          );
        }

        try {
          const piRes = await fetch("https://api.minepi.com/v2/me", {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!piRes.ok) {
            return Response.json(
              { error: `Pi verification failed (${piRes.status})` },
              { status: 401 },
            );
          }

          const me = (await piRes.json()) as {
            uid?: string;
            username?: string;
          };

          if (!me?.uid || !me?.username) {
            return Response.json(
              { error: "Invalid Pi user payload" },
              { status: 502 },
            );
          }

          return Response.json({ uid: me.uid, username: me.username });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unknown verification error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});