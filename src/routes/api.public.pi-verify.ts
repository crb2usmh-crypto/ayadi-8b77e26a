import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
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
          // استخراج uid من Pi API مباشرة
          const piRes = await fetch("https://api.minepi.com/v2/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!piRes.ok) {
            return Response.json({ error: "Invalid Pi access token" }, { status: 401 });
          }
          const piUser = (await piRes.json()) as { uid: string; username: string };
          const piUid = piUser.uid;
          const username = piUser.username || piUid;

          if (!piUid) {
            return Response.json({ error: "Missing user.uid from Pi API" }, { status: 500 });
          }

          // التحقق من وجود الملف الشخصي
          const profileReq = await fetch(
            `${env.url}/rest/v1/profiles?pi_uid=eq.${encodeURIComponent(piUid)}&select=*`,
            { headers: adminHeaders(env) },
          );
          const profiles = (await profileReq.json()) as ProfileRow[];

          if (!Array.isArray(profiles) || profiles.length === 0) {
            // إنشاء ملف شخصي جديد تلقائياً
            const insertReq = await fetch(
              `${env.url}/rest/v1/profiles`,
              {
                method: "POST",
                headers: {
                  ...adminHeaders(env),
                  "Content-Type": "application/json",
                  "Prefer": "return=representation",
                },
                body: JSON.stringify({
                  pi_uid: piUid,
                  username: username,
                  full_name: username,
                  rating: 0,
                  balance: 0,
                }),
              },
            );
            if (!insertReq.ok) {
              const errText = await insertReq.text();
              console.error("[pi-verify] profile insert failed:", errText);
              return Response.json({ error: "تعذر إنشاء ملف المستخدم" }, { status: 500 });
            }
            const [newProfile] = (await insertReq.json()) as ProfileRow[];
            return Response.json({ verified: true, profile: newProfile, user: piUser });
          }

          return Response.json({ verified: true, profile: profiles[0], user: piUser });
        } catch (err) {
          console.error("[pi-verify] error:", err);
          return Response.json({ error: "Server error" }, { status: 500 });
        }
      },
    },
  },
});
