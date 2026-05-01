import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
  verifyPiToken,
} from "@/lib/server/piVerify";

/**
 * List bids on a task. Visible only to the task owner OR a bidder
 * who already submitted an offer on this task.
 *
 * Body: { accessToken, taskId }
 * Success: 200 { bids: BidWithBidder[] }
 */
export const Route = createFileRoute("/api/public/bids-list")({
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
          return Response.json({ bids: [] });
        }

        try {
          // Check that caller is owner or has a bid on this task.
          const taskRes = await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=owner_pi_uid`,
            { headers: adminHeaders(env) },
          );
          const taskRows = (await taskRes.json()) as Array<{ owner_pi_uid: string }>;
          const task = taskRows[0];
          if (!task) {
            return Response.json({ error: "Task not found" }, { status: 404 });
          }

          const isOwner = task.owner_pi_uid === me.uid;

          // Fetch all bids for this task with bidder profile.
          const select = encodeURIComponent(
            "*,bidder:profiles!bids_bidder_pi_uid_fkey(*)",
          );
          const url =
            `${env.url}/rest/v1/bids?task_id=eq.${encodeURIComponent(taskId)}` +
            `&select=${select}&order=created_at.desc`;
          const res = await fetch(url, { headers: adminHeaders(env) });
          if (!res.ok) {
            return Response.json(
              { error: "Failed to load bids" },
              { status: 500 },
            );
          }
          const allBids = (await res.json()) as Array<{
            bidder_pi_uid: string;
            [k: string]: unknown;
          }>;

          // Owner sees everything; non-owner sees only their own bid.
          const visible = isOwner
            ? allBids
            : allBids.filter((b) => b.bidder_pi_uid === me.uid);

          return Response.json({ bids: visible });
        } catch (err) {
          console.error("[bids-list] error:", err);
          const message = "Server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});