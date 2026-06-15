import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
  verifyPiToken,
  ensureProfile,
} from "@/lib/server/piVerify.server";

const TASK_ID_RE = /^[0-9a-f-]{1,40}$/i;

function withDetails(
  payload: { error: string },
  detail: string | undefined,
): Record<string, unknown> {
  if (process.env.ALLOW_DEV_MODE === "true" && detail) {
    return { ...payload, details: detail };
  }
  return payload;
}

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

        const taskId =
          typeof body.taskId === "string"
            ? body.taskId.trim()
            : typeof body.taskId === "number"
              ? String(body.taskId)
              : "";
        if (!taskId || !TASK_ID_RE.test(taskId)) {
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
        const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
        const imageUrlRaw = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
        const imageUrl =
          imageUrlRaw && /^https:\/\//i.test(imageUrlRaw) && imageUrlRaw.length <= 1024
            ? imageUrlRaw
            : null;

        // Verify Pi identity
        const verify = await verifyPiToken(accessToken);
        if (!verify.ok) {
          return Response.json(
            { error: "فشلت مصادقة Pi، يرجى تسجيل الدخول مجددًا" },
            { status: verify.status },
          );
        }
        if (verify.identity.uid !== bidderPiUid) {
          return Response.json({ error: "عدم تطابق الهوية" }, { status: 403 });
        }

        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json({ error: "Service temporarily unavailable" }, { status: 500 });
        }

        try {
          // Make sure profile row exists (FK on bids.bidder_pi_uid)
          const ensured = await ensureProfile(env, verify.identity);
          if (!ensured.ok) {
            return Response.json(
              withDetails({ error: "تعذّر تجهيز ملف المستخدم" }, ensured.detail),
              { status: ensured.status },
            );
          }

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
          const bidRow: Record<string, unknown> = {
            task_id: taskId,
            bidder_pi_uid: bidderPiUid,
            amount: amountNum,
            message: message,
            status: "pending",
          };
          if (imageUrl) bidRow.image_url = imageUrl;

          const insertReq = await fetch(
            `${env.url}/rest/v1/bids`,
            {
              method: "POST",
              headers: { ...adminHeaders(env), "Content-Type": "application/json", "Prefer": "return=representation" },
              body: JSON.stringify(bidRow),
            },
          );
          if (!insertReq.ok) {
            const errText = await insertReq.text();
            console.error("[bids-create] insert failed:", errText);
            return Response.json(
              withDetails({ error: "تعذر حفظ العرض" }, `${insertReq.status} ${errText}`),
              { status: 500 },
            );
          }
          const [newBid] = await insertReq.json();

          return Response.json({ bid: newBid ?? null });
        } catch (err) {
          console.error("[bids-create] error:", err);
          const detail = err instanceof Error ? err.message : String(err);
          return Response.json(
            withDetails({ error: "خطأ في الخادم" }, detail),
            { status: 500 },
          );
        }
      },
    },
  },
});
