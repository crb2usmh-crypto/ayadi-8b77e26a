import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
  verifyPiToken,
} from "@/lib/server/piVerify.server";
import type { TaskRow } from "@/lib/supabase/types";

export const Route = createFileRoute("/api/public/bids-create")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: {
          taskId?: unknown;
          amount?: unknown;
          message?: unknown;
          bidderPiUid?: unknown;
          accessToken?: unknown;
          imageUrl?: unknown;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const taskId =
          typeof body.taskId === "string" ? body.taskId.trim() : "";
        // Tasks use UUID primary keys.
        if (!/^[0-9a-f-]{8,40}$/i.test(taskId)) {
          return Response.json({ error: "معرف المهمة غير صالح" }, { status: 400 });
        }

        const amountNum = Number(body.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) {
          return Response.json({ error: "المبلغ غير صالح" }, { status: 400 });
        }

        const message =
          typeof body.message === "string" ? body.message.trim() : "";

        const imageUrl =
          typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
        if (imageUrl && (imageUrl.length > 1024 || !/^https:\/\//i.test(imageUrl))) {
          return Response.json({ error: "رابط الصورة غير صالح" }, { status: 400 });
        }

        // Verify Pi identity — bidder_pi_uid comes from the verified session,
        // never blindly trusted from the client body.
        const verify = await verifyPiToken(body.accessToken);
        if (!verify.ok) {
          return Response.json(
            { error: "فشلت مصادقة Pi، يرجى تسجيل الدخول مجددًا" },
            { status: verify.status },
          );
        }
        const bidderPiUid = verify.identity.uid;

        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json({ error: "Service temporarily unavailable" }, { status: 500 });
        }

        try {
          // التحقق من وجود المهمة
          const taskReq = await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,status,owner_pi_uid`,
            { headers: adminHeaders(env) },
          );
          const tasks = (await taskReq.json()) as TaskRow[];
          if (!Array.isArray(tasks) || tasks.length === 0) {
            return Response.json({ error: "المهمة غير موجودة" }, { status: 400 });
          }
          if (tasks[0].status !== "open") {
            return Response.json({ error: "المهمة ليست مفتوحة لتلقي العروض" }, { status: 400 });
          }
          if (tasks[0].owner_pi_uid === bidderPiUid) {
            return Response.json(
              { error: "لا يمكنك تقديم عرض على مهمتك" },
              { status: 400 },
            );
          }

          // إنشاء العرض — task_id هو UUID نصي، لا تحوّله لرقم.
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
                bidder_pi_uid: bidderPiUid,
                amount: amountNum,
                message: message,
                image_url: imageUrl || null,
                status: "pending",
              }),
            },
          );
          if (!insertReq.ok) {
            const errText = await insertReq.text();
            console.error("[bids-create] insert failed:", errText);
            const payload: Record<string, unknown> = { error: "تعذر حفظ العرض" };
            if (process.env.ALLOW_DEV_MODE === "true") {
              payload.details = errText;
            }
            return Response.json(payload, { status: 500 });
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
