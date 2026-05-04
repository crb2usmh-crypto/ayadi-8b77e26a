import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
} from "@/lib/server/piVerify";
import type { TaskRow } from "@/lib/supabase/types";

export const Route = createFileRoute("/api/public/bids-create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { taskId?: unknown; amount?: unknown; message?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const taskId =
          typeof body.taskId === "string" ? body.taskId.trim() : "";
        if (!taskId || taskId.length > 64) {
          return Response.json({ error: "معرف المهمة غير صالح" }, { status: 400 });
        }

        const amountNum = Number(body.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          return Response.json({ error: "المبلغ غير صالح" }, { status: 400 });
        }

        const message =
          typeof body.message === "string" ? body.message.trim() : "";

        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json({ error: "Service temporarily unavailable" }, { status: 500 });
        }

        try {
          // التحقق من وجود المهمة
          const taskReq = await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,status`,
            { headers: adminHeaders(env) },
          );
          const tasks = (await taskReq.json()) as TaskRow[];
          if (!Array.isArray(tasks) || tasks.length === 0) {
            return Response.json({ error: "المهمة غير موجودة" }, { status: 400 });
          }
          if (tasks[0].status !== "open") {
            return Response.json({ error: "المهمة ليست مفتوحة لتلقي العروض" }, { status: 400 });
          }

          // إنشاء العرض
          const insertReq = await fetch(
            `${env.url}/rest/v1/bids`,
            {
              method: "POST",
              headers: {
                ...adminHeaders(env),
                "Content-Type": "application/json",
                "Prefer": "return=representation",
              },
              body: JSON.stringify({
                task_id: taskId,
                amount: amountNum,
                message: message,
                status: "pending",
              }),
            },
          );
          if (!insertReq.ok) {
            const errText = await insertReq.text();
            console.error("[bids-create] insert failed:", errText);
            return Response.json({ error: "تعذر حفظ العرض" }, { status: 500 });
          }
          const [newBid] = (await insertReq.json()) as any[];

          return Response.json({ bid: newBid ?? null });
        } catch (err) {
          console.error("[bids-create] error:", err);
          return Response.json({ error: "Server error" }, { status: 500 });
        }
      },
    },
  },
});
