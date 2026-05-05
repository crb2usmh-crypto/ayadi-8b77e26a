import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
  verifyPiToken,
} from "@/lib/server/piVerify";
import type { ProfileRow, ReviewRow } from "@/lib/supabase/types";

/**
 * Reviews submitted on a given task, plus a flag indicating whether the
 * caller has already submitted a review for it. Auth required so we can
 * compute `myReviewSubmitted`.
 *
 * Body: { accessToken, taskId }
 * Success: 200 { reviews, myReviewSubmitted }
 */
export const Route = createFileRoute("/api/public/reviews-for-task")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
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
          const listRes = await fetch(
            `${env.url}/rest/v1/reviews?task_id=eq.${encodeURIComponent(taskId)}&select=*&order=created_at.desc`,
            { headers: adminHeaders(env) },
          );
          const reviewRows = (await listRes.json()) as ReviewRow[];

          const uids = Array.from(new Set(reviewRows.map((r) => r.reviewer_pi_uid)));
          let profMap = new Map<string, ProfileRow>();
          if (uids.length > 0) {
            const inList = uids.map((u) => `"${u.replace(/"/g, "")}"`).join(",");
            const profRes = await fetch(
              `${env.url}/rest/v1/profiles?pi_uid=in.(${encodeURIComponent(inList)})&select=*`,
              { headers: adminHeaders(env) },
            );
            const profs = (await profRes.json()) as ProfileRow[];
            profMap = new Map(profs.map((p) => [p.pi_uid, p]));
          }

          const reviews = reviewRows.map((r) => ({
            ...r,
            reviewer: profMap.get(r.reviewer_pi_uid) ?? null,
          }));

          const myReviewSubmitted = reviewRows.some(
            (r) => r.reviewer_pi_uid === me.uid,
          );

          return Response.json({ reviews, myReviewSubmitted });
        } catch (err) {
          console.error("[reviews-for-task] error:", err);
          const message = "Server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
} as any);