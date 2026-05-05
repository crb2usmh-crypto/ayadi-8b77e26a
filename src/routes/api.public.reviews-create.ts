import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  ensureProfile,
  getSupabaseAdminEnv,
  insertNotification,
  verifyPiToken,
} from "@/lib/server/piVerify";

/**
 * Submit a review on a completed task.
 *
 * Body: { accessToken, taskId, rating (1-5), comment? }
 * Success: 200 { review, average, count }
 */
export const Route = createFileRoute("/api/public/reviews-create")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: {
          accessToken?: unknown;
          taskId?: unknown;
          rating?: unknown;
          comment?: unknown;
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
        const rating = Number(body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          return Response.json({ error: "Rating must be 1-5" }, { status: 400 });
        }
        const commentRaw = typeof body.comment === "string" ? body.comment.trim() : "";
        const comment = commentRaw ? commentRaw.slice(0, 1000) : null;

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

          // Load task to determine the other party + verify completion.
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
          if (!task) return Response.json({ error: "Task not found" }, { status: 404 });
          if (task.status !== "completed") {
            return Response.json(
              { error: "Task must be completed before reviewing" },
              { status: 409 },
            );
          }

          let revieweeUid: string;
          if (me.uid === task.owner_pi_uid) {
            if (!task.assignee_pi_uid) {
              return Response.json({ error: "No assignee on this task" }, { status: 409 });
            }
            revieweeUid = task.assignee_pi_uid;
          } else if (me.uid === task.assignee_pi_uid) {
            revieweeUid = task.owner_pi_uid;
          } else {
            return Response.json(
              { error: "Only task participants can leave a review" },
              { status: 403 },
            );
          }

          // Insert review (unique(task_id, reviewer_pi_uid) prevents dupes).
          const insRes = await fetch(`${env.url}/rest/v1/reviews`, {
            method: "POST",
            headers: adminHeaders(env, "return=representation"),
            body: JSON.stringify([
              {
                task_id: taskId,
                reviewer_pi_uid: me.uid,
                reviewee_pi_uid: revieweeUid,
                rating,
                comment,
              },
            ]),
          });
          if (insRes.status === 409) {
            return Response.json(
              { error: "You have already reviewed this task" },
              { status: 409 },
            );
          }
          if (!insRes.ok) {
            const detail = await insRes.text();
            console.error("[reviews-create] insert failed:", insRes.status, detail);
            return Response.json(
              { error: `Failed to submit review (${insRes.status})` },
              { status: 500 },
            );
          }
          const insRows = (await insRes.json()) as unknown[];
          const review = Array.isArray(insRows) ? insRows[0] : null;

          // Recompute average for reviewee, then update profiles.rating.
          const aggRes = await fetch(
            `${env.url}/rest/v1/reviews?reviewee_pi_uid=eq.${encodeURIComponent(revieweeUid)}&select=rating`,
            { headers: adminHeaders(env) },
          );
          const aggRows = (await aggRes.json()) as Array<{ rating: number }>;
          const count = aggRows.length;
          const average =
            count === 0
              ? 0
              : Math.round(
                  (aggRows.reduce((s, r) => s + Number(r.rating), 0) / count) * 100,
                ) / 100;

          await fetch(
            `${env.url}/rest/v1/profiles?pi_uid=eq.${encodeURIComponent(revieweeUid)}`,
            {
              method: "PATCH",
              headers: adminHeaders(env, "return=minimal"),
              body: JSON.stringify({
                rating: average,
                updated_at: new Date().toISOString(),
              }),
            },
          ).catch((e) => console.error("[reviews-create] rating update failed:", e));

          // Notify the reviewee.
          await insertNotification(env, {
            recipient_pi_uid: revieweeUid,
            type: "system",
            title: "تلقّيت تقييمًا جديدًا ⭐",
            title_en: "You received a new review ⭐",
            body: `قيّمك ${me.username} بـ ${rating}/5 على "${task.title}".`,
            body_en: `${me.username} rated you ${rating}/5 on "${task.title_en ?? task.title}".`,
          });

          return Response.json({ review, average, count });
        } catch (err) {
          console.error("[reviews-create] error:", err);
          const message = "Server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
} as any);