import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
} from "@/lib/server/piVerify.server";
import type { ProfileRow, ReviewRow } from "@/lib/supabase/types";

/**
 * Public list of reviews received by a user, plus average + count.
 * No auth required (reviews are public).
 *
 * Body: { revieweePiUid, limit? }
 * Success: 200 { reviews, average, count }
 */
export const Route = createFileRoute("/api/public/reviews-list")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { revieweePiUid?: unknown; limit?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const revieweePiUid =
          typeof body.revieweePiUid === "string" ? body.revieweePiUid.trim() : "";
        if (!revieweePiUid || revieweePiUid.length > 256) {
          return Response.json({ error: "Invalid revieweePiUid" }, { status: 400 });
        }
        const limitNum = Number(body.limit);
        const limit = Number.isFinite(limitNum) && limitNum > 0 && limitNum <= 50
          ? Math.floor(limitNum)
          : 10;

        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json({ error: "Service temporarily unavailable" }, { status: 500 });
        }

        try {
          // Aggregate (count + average) over the full set.
          const aggRes = await fetch(
            `${env.url}/rest/v1/reviews?reviewee_pi_uid=eq.${encodeURIComponent(revieweePiUid)}&select=rating`,
            { headers: adminHeaders(env) },
          );
          const rawAgg = await aggRes.json();
          const aggRows = Array.isArray(rawAgg) ? (rawAgg as Array<{ rating: number }>) : [];
          const count = aggRows.length;
          const average =
            count === 0
              ? 0
              : Math.round(
                  (aggRows.reduce((s, r) => s + Number(r.rating), 0) / count) * 100,
                ) / 100;

          // Latest N reviews.
          const listRes = await fetch(
            `${env.url}/rest/v1/reviews?reviewee_pi_uid=eq.${encodeURIComponent(revieweePiUid)}` +
              `&select=*&order=created_at.desc&limit=${limit}`,
            { headers: adminHeaders(env) },
          );
          const rawList = await listRes.json();
          const reviewRows = Array.isArray(rawList) ? (rawList as ReviewRow[]) : [];

          // Attach reviewer profiles.
          const uids = Array.from(new Set(reviewRows.map((r) => r.reviewer_pi_uid)));
          let profMap = new Map<string, ProfileRow>();
          if (uids.length > 0) {
            const inList = uids.map((u) => `"${u.replace(/"/g, "")}"`).join(",");
            const profRes = await fetch(
              `${env.url}/rest/v1/profiles?pi_uid=in.(${encodeURIComponent(inList)})&select=*`,
              { headers: adminHeaders(env) },
            );
            const rawProfs = await profRes.json();
            const profs = Array.isArray(rawProfs) ? (rawProfs as ProfileRow[]) : [];
            profMap = new Map(profs.map((p) => [p.pi_uid, p]));
          }

          const reviews = reviewRows.map((r) => ({
            ...r,
            reviewer: profMap.get(r.reviewer_pi_uid) ?? null,
          }));

          return Response.json({ reviews, average, count });
        } catch (err) {
          console.error("[reviews-list] error:", err);
          const message = "Server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
