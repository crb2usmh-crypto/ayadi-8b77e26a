import { createFileRoute } from "@tanstack/react-router";
import { adminHeaders, getSupabaseAdminEnv } from "@/lib/server/piVerify";

export const Route = createFileRoute("/api/public/bids-create")({
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

        const amountNum = Number(body.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          return Response.json({ error: "المبلغ غير صالح" }, { status: 400 });
        }

        const bidderPiUid = typeof body.bidderPiUid === "string" ? body.bidderPiUid.trim() : "";
        if (!bidderPiUid || bidderPiUid.length > 256) {
          return Response.json({ error: "معرف مقدم العرض غير صالح" }, { status: 400 });
        }

        const message = typeof body.message === "string" ? body.message.trim() : "";

        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json({ error: "Service temporarily unavailable" }, { status: 500 });
        }

        try {
          // 1. تحقق من وجود المهمة
          const taskReq = await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,status,owner_pi_uid`,
            { headers: adminHeaders(env) },
          );
          const tasks = await taskReq.json();
          if (!Array.isArray(tasks) || tasks.length === 0) {
            return Response.json({ error: "المهمة غير موجودة" }, { status: 400 });
          }
          const task = tasks[0];
          if (task.status !== "open") {
            return Response.json({ error: "المهمة ليست مفتوحة لتلقي العروض" }, { status: 400 });
          }
          if (task.owner_pi_uid === bidderPiUid) {
            return Response.json({ error: "لا يمكنك تقديم عرض على مهمتك الخاصة" }, { status: 400 });
          }

          // 2. أدخل العرض
          const insertReq = await fetch(
            `${env.url}/rest/v1/bids`,
            {
              method: "POST",
              headers: { ...adminHeaders(env), "Content-Type": "application/json", "Prefer": "return=representation" },
              body: JSON.stringify({
                task_id: Number(taskId),
                bidder_pi_uid: bidderPiUid,
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
          const [newBid] = await insertReq.json();

          return Response.json({ bid: newBid ?? null });
        } catch (err) {
          console.error("[bids-create] error:", err);
          return Response.json({ error: "Server error" }, { status: 500 });
        }
      },
    },
  },
});
