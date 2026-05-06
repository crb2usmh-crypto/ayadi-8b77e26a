import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
} from "@/lib/server/piVerify.server";

export const Route = createFileRoute("/api/public/tasks-delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
        if (!taskId || taskId.length > 64) {
          return Response.json({ error: "معرف المهمة غير صالح" }, { status: 400 });
        }

        const accessToken = body.accessToken;
        if (!accessToken) {
          return Response.json({ error: "Token مفقود" }, { status: 400 });
        }

        const env = getSupabaseAdminEnv();
        if (!env) return Response.json({ error: "Service unavailable" }, { status: 500 });

        // استخراج pi_uid من Pi
        let piUid: string;
        try {
          const piRes = await fetch("https://api.minepi.com/v2/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!piRes.ok) throw new Error("Invalid Pi token");
          const piUser = (await piRes.json()) as { uid: string };
          piUid = piUser.uid;
        } catch {
          return Response.json({ error: "Invalid Pi token" }, { status: 401 });
        }

        // حذف المهمة بشرط أن يكون المستخدم هو المالك
        const delRes = await fetch(
          `${env.url}/rest/v1/tasks?owner_pi_uid=eq.${encodeURIComponent(piUid)}&id=eq.${encodeURIComponent(taskId)}`,
          {
            method: "DELETE",
            headers: adminHeaders(env),
          },
        );

        if (!delRes.ok) {
          return Response.json({ error: "فشل حذف المهمة" }, { status: 500 });
        }

        return Response.json({ success: true });
      },
    },
  },
});
