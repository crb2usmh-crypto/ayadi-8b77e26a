import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  ensureProfile,
  getSupabaseAdminEnv,
  insertNotification,
  verifyPiToken,
} from "@/lib/server/piVerify";

/**
 * Submit (or update) a bid on a task.
 *
 * Body: { accessToken, taskId, amount, message? }
 * Success: 200 { bid }
 * Errors:  400 input | 401 token | 403 own-task / closed | 500 server
 */
export const Route = createFileRoute("/api/public/bids-create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ---- 1. Parse + validate input ----
        let body: {
          accessToken?: unknown;
          taskId?: unknown;
          amount?: unknown;
          message?: unknown;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
        if (!/^[0-9a-f-]{8,40}$/i.test(taskId)) {
          return Response.json({ error: "Invalid taskId" }, { status: 400 });
        }

        const amountNum = Number(body.amount);
        if (!Number.isFinite(amountNum) || amountNum < 0 || amountNum > 1_000_000) {
          return Response.json({ error: "Invalid amount" }, { status: 400 });
        }

        const messageRaw = typeof body.message === "string" ? body.message.trim() : "";
        const message = messageRaw ? messageRaw.slice(0, 2000) : null;

        // ---- 2. Verify Pi token ----
        const verify = await verifyPiToken(body.accessToken);
        if (!verify.ok) {
          return Response.json({ error: verify.error }, { status: verify.status });
        }
        const me = verify.identity;

        // ---- 3. Backend env ----
        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json(
            { error: "Service temporarily unavailable" },
            { status: 500 },
          );
        }

        try {
          // 3a. Ensure profile row exists.
          await ensureProfile(env, me);

          // 3b. Load task to enforce owner check + status.
          const taskRes = await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,owner_pi_uid,status,title,title_en`,
            { headers: adminHeaders(env) },
          );
          if (!taskRes.ok) {
            return Response.json(
              { error: `Task lookup failed (${taskRes.status})` },
              { status: 500 },
            );
          }
          const taskRows = (await taskRes.json()) as Array<{
            id: string;
            owner_pi_uid: string;
            status: string;
            title: string;
            title_en: string | null;
          }>;
          const task = taskRows[0];
          if (!task) {
            return Response.json({ error: "Task not found" }, { status: 404 });
          }
          if (task.owner_pi_uid === me.uid) {
            return Response.json(
              { error: "Cannot bid on your own task" },
              { status: 403 },
            );
          }
          if (task.status !== "open") {
            return Response.json(
              { error: "Task is not open for bidding" },
              { status: 403 },
            );
          }

          // 3c. Upsert bid (one bid per bidder per task).
          const upsertRes = await fetch(
            `${env.url}/rest/v1/bids?on_conflict=task_id,bidder_pi_uid`,
            {
              method: "POST",
              headers: adminHeaders(
                env,
                "resolution=merge-duplicates,return=representation",
              ),
              body: JSON.stringify([
                {
                  task_id: taskId,
                  bidder_pi_uid: me.uid,
                  amount: amountNum,
                  message,
                  status: "pending",
                  updated_at: new Date().toISOString(),
                },
              ]),
            },
          );
          if (!upsertRes.ok) {
            const detail = await upsertRes.text();
            console.error("[bids-create] upsert failed:", upsertRes.status, detail);
            return Response.json(
              { error: `Failed to submit offer (${upsertRes.status})` },
              { status: 500 },
            );
          }
          const rows = (await upsertRes.json()) as unknown[];
          const bid = Array.isArray(rows) ? rows[0] : null;

          // 3d. Recompute offers_count (cheap: COUNT via PostgREST head).
          await fetch(
            `${env.url}/rest/v1/rpc/refresh_task_offers_count`,
            {
              method: "POST",
              headers: adminHeaders(env, "return=minimal"),
              body: JSON.stringify({ p_task_id: taskId }),
            },
          ).catch(() => {
            // RPC is optional — if it doesn't exist, we just leave the
            // counter to be updated by a future migration / job.
          });

          // 3e. Notify task owner.
          await insertNotification(env, {
            recipient_pi_uid: task.owner_pi_uid,
            type: "offer",
            title: "عرض جديد على مهمتك",
            title_en: "New offer on your task",
            body: `${me.username} قدّم عرضًا بقيمة ${amountNum} على "${task.title}".`,
            body_en: `${me.username} offered ${amountNum} on "${task.title_en ?? task.title}".`,
          });

          return Response.json({ bid });
        } catch (err) {
          console.error("[bids-create] error:", err);
          const message = "Server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});