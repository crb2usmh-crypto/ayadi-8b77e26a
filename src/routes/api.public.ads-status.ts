import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
  verifyPiToken,
} from "@/lib/server/piVerify.server";

export const Route = createFileRoute("/api/public/ads-status")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { accessToken?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const verify = await verifyPiToken(body.accessToken);
        if (!verify.ok) {
          return Response.json({ error: verify.error }, { status: verify.status });
        }
        const env = getSupabaseAdminEnv();
        if (!env) return Response.json({ adFree: false, expiresAt: null });
        try {
          const nowIso = new Date().toISOString();
          const url = `${env.url}/rest/v1/ads_subscriptions?pi_uid=eq.${encodeURIComponent(
            verify.identity.uid,
          )}&expires_at=gt.${encodeURIComponent(nowIso)}&select=expires_at&order=expires_at.desc&limit=1`;
          const res = await fetch(url, { headers: adminHeaders(env) });
          if (!res.ok) return Response.json({ adFree: false, expiresAt: null });
          const rows = (await res.json()) as { expires_at: string }[];
          if (Array.isArray(rows) && rows.length > 0) {
            return Response.json({ adFree: true, expiresAt: rows[0].expires_at });
          }
          return Response.json({ adFree: false, expiresAt: null });
        } catch (err) {
          console.error("[ads-status] error:", err);
          return Response.json({ adFree: false, expiresAt: null });
        }
      },
    },
  },
});