import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
  verifyPiToken,
} from "@/lib/server/piVerify";

/**
 * Delete a task. Only the task owner can delete it, and only when the
 * task is still "open" (not in_progress / completed / cancelled).
 *
 * Body: { accessToken, taskId }
 * Success: 200 { ok: true }
 */
export const Route = createFileRoute("/api/public/tasks-delete")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { accessToken?: unknown; taskId?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "بيانات غير صالحة" },
            { status: 400 },
          );
        }

        const taskId =
          typeof body.taskId === "string" ? body.taskId.trim() : "";
        if (!/^[0-9a-f-]{8,40}$/i.test(taskId)) {
          return Response.json(
            { error: "معرّف المهمة غير صالح" },
            { status: 400 },
          );
        }

        const verify = await verifyPiToken(body.accessToken);
        if (!verify.ok) {
          const arabic =
            verify.status === 401
              ? "فشلت مصادقة Pi، يرجى تسجيل الدخول مجددًا"
              : verify.status === 502
                ? "خدمة Pi غير متاحة حاليًا"
                : "تعذّر التحقق من الهوية";
          return Response.json({ error: arabic }, { status: verify.status });
        }
        const me = verify.identity;

        const env = getSupabaseAdminEnv();
        if (!env) {
          console.error(
            "[tasks-delete] missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
          );
          return Response.json(
            { error: "إعدادات الخادم غير مكتملة" },
            { status: 500 },
          );
        }

        try {
          // Load task to verify ownership + status.
          const taskRes = await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,owner_pi_uid,status`,
            { headers: adminHeaders(env) },
          );
          if (!taskRes.ok) {
            const detail = await taskRes.text();
            console.error(
              "[tasks-delete] task lookup failed:",
              taskRes.status,
              detail,
            );
            return Response.json(
              { error: "تعذّر قراءة المهمة" },
              { status: 500 },
            );
          }
          const taskRows = (await taskRes.json()) as Array<{
            id: string;
            owner_pi_uid: string;
            status: string;
          }>;
          const task = taskRows[0];
          if (!task) {
            return Response.json(
              { error: "المهمة غير موجودة" },
              { status: 404 },
            );
          }
          if (task.owner_pi_uid !== me.uid) {
            return Response.json(
              { error: "ليس لديك صلاحية لحذف هذه المهمة" },
              { status: 403 },
            );
          }
          if (task.status !== "open") {
            return Response.json(
              {
                error:
                  "لا يمكن حذف مهمة قيد التنفيذ أو مكتملة",
              },
              { status: 409 },
            );
          }

          // Delete the task.
          const delRes = await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}`,
            {
              method: "DELETE",
              headers: adminHeaders(env, "return=minimal"),
            },
          );
          if (!delRes.ok) {
            const detail = await delRes.text();
            console.error(
              "[tasks-delete] delete failed:",
              delRes.status,
              detail,
            );
            return Response.json(
              { error: "تعذّر حذف المهمة" },
              { status: 500 },
            );
          }

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[tasks-delete] error:", err);
          return Response.json(
            { error: "خطأ في الخادم" },
            { status: 500 },
          );
        }
      },
    },
  },
});
