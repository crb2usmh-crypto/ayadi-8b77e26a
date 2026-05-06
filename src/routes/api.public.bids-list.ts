import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
} from "@/lib/server/piVerify.server";
import type { BidRow, ProfileRow } from "@/lib/supabase/types";

export const Route = createFileRoute("/api/public/bids-list")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { taskId?: unknown };
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

        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json({ error: "Service temporarily unavailable" }, { status: 500 });
        }

        try {
          // جلب العروض للمهمة
          const bidsReq = await fetch(
            `${env.url}/rest/v1/bids?task_id=eq.${encodeURIComponent(taskId)}&select=*&order=created_at.asc`,
            { headers: adminHeaders(env) },
          );
          const rawBids = await bidsReq.json();
          const bids = Array.isArray(rawBids) ? (rawBids as BidRow[]) : [];

          // جلب ملفات تعريف مقدمي العروض
          const piUids = Array.from(new Set(bids.map((b) => b.bidder_pi_uid)));
          let profilesMap = new Map<string, ProfileRow>();
          if (piUids.length > 0) {
            const inList = piUids.map((u) => `"${u.replace(/"/g, "")}"`).join(",");
            const profReq = await fetch(
              `${env.url}/rest/v1/profiles?pi_uid=in.(${encodeURIComponent(inList)})&select=*`,
              { headers: adminHeaders(env) },
            );
            const rawProfs = await profReq.json();
            const profiles = Array.isArray(rawProfs) ? (rawProfs as ProfileRow[]) : [];
            profilesMap = new Map(profiles.map((p) => [p.pi_uid, p]));
          }

          const enrichedBids = bids.map((bid) => ({
            ...bid,
            bidder: profilesMap.get(bid.bidder_pi_uid) ?? null,
          }));

          return Response.json({ bids: enrichedBids });
        } catch (err) {
          console.error("[bids-list] error:", err);
          return Response.json({ error: "Server error" }, { status: 500 });
        }
      },
    },
  },
} as any);
