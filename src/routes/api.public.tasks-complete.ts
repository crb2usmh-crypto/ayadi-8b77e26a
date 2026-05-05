import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  ensureProfile,
  getSupabaseAdminEnv,
  insertNotification,
  verifyPiToken,
} from "@/lib/server/piVerify";

/**
 * Mark a task as completed. Only the task owner can do this, and the task
 * must currently be in_progress.
 *
 * Body: { accessToken, taskId }
 * Success: 200 { ok: true }
 */
export const Route = createFileRoute("/api/public/tasks-complete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { accessToken?: unknown; taskId?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const taskId = typeof body.taskId === "string" ? body.taskId.trim() : "";
        if (!/^[0-9a-f-]{8,40}$/i.test(taskId)) {
          return Response.json({ error: "Invalid taskId" }, { status: 400 });
        }

        const verify = await verifyPiToken(body.accessToken);
        if (!verify.ok) {
          return Response.json({ error: verify.error }, { status: verify.status });
        }
        const me = verify.identity;

        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json({ error: "Service temporarily unavailable" }, { status: 500 });
        }

        try {
          await ensureProfile(env, me);

          // Load task.
          const taskRes = await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,owner_pi_uid,assignee_pi_uid,status,title,title_en`,
            { headers: adminHeaders(env) },
          );
          const taskRows = (await taskRes.json()) as Array<{
            id: string;
            owner_pi_uid: string;
            assignee_pi_uid: string | null;
            status: string;
            title: string;
            title_en: string | null;
          }>;
          const task = taskRows[0];
          if (!task) {
            return Response.json({ error: "Task not found" }, { status: 404 });
          }
          if (task.owner_pi_uid !== me.uid) {
            return Response.json(
              { error: "Only the task owner can complete the task" },
              { status: 403 },
            );
          }
          if (task.status !== "in_progress") {
            return Response.json(
              { error: "Task is not in progress" },
              { status: 409 },
            );
          }

          // Update status.
          const updRes = await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}`,
            {
              method: "PATCH",
              headers: adminHeaders(env, "return=minimal"),
              body: JSON.stringify({ status: "completed" }),
            },
          );
          if (!updRes.ok) {
            const detail = await updRes.text();
            console.error("[tasks-complete] update failed:", updRes.status, detail);
            return Response.json({ error: "Failed to complete task" }, { status: 500 });
          }

          // Bump assignee's completed_tasks counter (best-effort).
          if (task.assignee_pi_uid) {
            try {
              const profRes = await fetch(
                `${env.url}/rest/v1/profiles?pi_uid=eq.${encodeURIComponent(task.assignee_pi_uid)}&select=completed_tasks`,
                { headers: adminHeaders(env) },
              );
              const profRows = (await profRes.json()) as Array<{ completed_tasks: number }>;
              const current = profRows[0]?.completed_tasks ?? 0;
              await fetch(
                `${env.url}/rest/v1/profiles?pi_uid=eq.${encodeURIComponent(task.assignee_pi_uid)}`,
                {
                  method: "PATCH",
                  headers: adminHeaders(env, "return=minimal"),
                  body: JSON.stringify({
                    completed_tasks: current + 1,
                    updated_at: new Date().toISOString(),
                  }),
                },
              );
            } catch (e) {
              console.error("[tasks-complete] counter bump failed:", e);
            }

            // Notify assignee.
            await insertNotification(env, {
              recipient_pi_uid: task.assignee_pi_uid,
              type: "task",
              title: "تم إنهاء المهمة ✅",
              title_en: "Task completed ✅",
              body: `صاحب المهمة أنهى "${task.title}". يمكنك الآن تقييمه.`,
              body_en: `The owner marked "${task.title_en ?? task.title}" as completed. You can now leave a review.`,
            });
          }

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[tasks-complete] error:", err);
          const message = "Server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
} as any);