import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
  verifyPiToken,
  ensureProfile,
} from "@/lib/server/piVerify.server";
import type { ProfileRow } from "@/lib/supabase/types";

export const Route = createFileRoute("/api/public/pi-verify")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { accessToken?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const accessToken =
          typeof body.accessToken === "string" ? body.accessToken.trim() : "";
        if (!accessToken) {
          return Response.json({ error: "Missing access token" }, { status: 400 });
        }

        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json({ error: "Service temporarily unavailable" }, { status: 500 });
        }

        try {
          // 1. Verify token + extract identity via shared helper
          const verify = await verifyPiToken(accessToken);
          if (!verify.ok) {
            return Response.json({ error: verify.error }, { status: verify.status });
          }
          const piUser = verify.identity;

          // 2. Ensure profile exists (handles insert + 409 race)
          const ensured = await ensureProfile(env, piUser);
          if (!ensured.ok) {
            console.error("[pi-verify] ensureProfile failed:", ensured.detail);
            const payload: Record<string, unknown> = { error: "تعذر إنشاء ملف المستخدم" };
            if (process.env.ALLOW_DEV_MODE === "true") payload.details = ensured.detail;
            return Response.json(payload, { status: ensured.status });
          }

          // 3. Read the row back
          const profileReq = await fetch(
            `${env.url}/rest/v1/profiles?pi_uid=eq.${encodeURIComponent(piUser.uid)}&select=*&limit=1`,
            { headers: adminHeaders(env) },
          );
          const profiles = (await profileReq.json()) as ProfileRow[];
          const profile = Array.isArray(profiles) ? profiles[0] ?? null : null;

          return Response.json({ verified: true, profile, user: piUser });
        } catch (err) {
          console.error("[pi-verify] error:", err);
          return Response.json({ error: "Server error" }, { status: 500 });
        }
      },
    },
  },
});
