import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
  verifyPiToken,
} from "@/lib/server/piVerify.server";

const VALID_CATEGORIES = [
  "design",
  "development",
  "writing",
  "delivery",
  "cleaning",
  "tutoring",
  "marketing",
  "other",
];

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export const Route = createFileRoute("/api/public/tasks-update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "بيانات غير صالحة" }, { status: 400 });
        }

        const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
        if (!/^[0-9a-f-]{8,40}$/i.test(taskId)) {
          return Response.json({ error: "معرّف المهمة غير صالح" }, { status: 400 });
        }

        const verify = await verifyPiToken(body.accessToken);
        if (!verify.ok) {
          return Response.json({ error: "فشلت مصادقة Pi" }, { status: verify.status });
        }
        const me = verify.identity;

        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json({ error: "إعدادات الخادم غير مكتملة" }, { status: 500 });
        }

        // ---- بناء بيانات التحديث ----
        const t = body.task ?? {};
        const patch: Record<string, unknown> = {};

        if (t.title !== undefined) {
          const title = clampStr(t.title, 200);
          if (!title) return Response.json({ error: "العنوان لا يمكن أن يكون فارغاً" }, { status: 400 });
          patch.title = title;
          patch.image_seed = title.slice(0, 32);
        }
        if (t.description !== undefined) {
          const description = clampStr(t.description, 4000);
          if (!description) return Response.json({ error: "الوصف لا يمكن أن يكون فارغاً" }, { status: 400 });
          patch.description = description;
        }
        if (t.category !== undefined) {
          const categoryRaw = typeof t.category === "string" ? t.category : "other";
          patch.category = (VALID_CATEGORIES as readonly string[]).includes(categoryRaw) ? categoryRaw : "other";
        }
        if (t.budget !== undefined) {
          const budgetNum = Number(t.budget);
          patch.budget = Number.isFinite(budgetNum) && budgetNum >= 0 ? budgetNum : 0;
        }
        if (t.location !== undefined) {
          patch.location = clampStr(t.location, 200);
        }
        if (t.deadline !== undefined) {
          patch.deadline = clampStr(t.deadline, 200);
        }
        if (t.country !== undefined) {
          patch.country = typeof t.country === "string" && t.country.length === 2 ? t.country.toUpperCase() : null;
        }

        if (Object.keys(patch).length === 0) {
          return Response.json({ error: "لا توجد تغييرات لحفظها" }, { status: 400 });
        }

        // ---- التحقق من ملكية المهمة ----
        const taskRes = await fetch(
          `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,owner_pi_uid,status`,
          { headers: adminHeaders(env) },
        );
        if (!taskRes.ok) return Response.json({ error: "تعذّر قراءة المهمة" }, { status: 500 });
        const taskRows = await taskRes.json();
        const task = taskRows[0];
        if (!task) return Response.json({ error: "المهمة غير موجودة" }, { status: 404 });
        if (task.owner_pi_uid !== me.uid) return Response.json({ error: "ليس لديك صلاحية لتعديل هذه المهمة" }, { status: 403 });
        if (task.status !== "open") return Response.json({ error: "لا يمكن تعديل مهمة قيد التنفيذ أو مكتملة" }, { status: 409 });

        patch.updated_at = new Date().toISOString();

        const updRes = await fetch(
          `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}`,
          {
            method: "PATCH",
            headers: adminHeaders(env, "return=representation"),
            body: JSON.stringify(patch),
          },
        );
        if (!updRes.ok) {
          return Response.json({ error: "تعذّر تحديث المهمة" }, { status: 500 });
        }
        const rows = await updRes.json();
        return Response.json({ task: rows[0] ?? null });
      },
    },
  },
});
