import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  ensureProfile,
  getSupabaseAdminEnv,
  insertNotification,
  verifyPiToken,
} from "@/lib/server/piVerify";

/**
 * Accept a bid. Only the task owner can call this.
 *
 * On success:
 *  - Selected bid → status=accepted
 *  - Other bids on same task → status=rejected
 *  - Task → status=in_progress, accepted_bid_id, assignee_pi_uid set
 *  - A new conversation is created between owner and bidder
 *  - Notifications fire for the winner (and rejected bidders)
 *
 * Body: { accessToken, bidId }
 * Success: 200 { conversationId, taskId }
 */
export const Route = createFileRoute("/api/public/bids-accept")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { accessToken?: unknown; bidId?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const bidId = typeof body.bidId === "string" ? body.bidId.trim() : "";
        if (!/^[0-9a-f-]{8,40}$/i.test(bidId)) {
          return Response.json({ error: "Invalid bidId" }, { status: 400 });
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

          // 1. Load bid + task in one trip.
          const bidRes = await fetch(
            `${env.url}/rest/v1/bids?id=eq.${encodeURIComponent(bidId)}` +
              `&select=*,task:tasks!bids_task_id_fkey(id,owner_pi_uid,status,title,title_en)`,
            { headers: adminHeaders(env) },
          );
          const bidRows = (await bidRes.json()) as Array<{
            id: string;
            task_id: string;
            bidder_pi_uid: string;
            amount: number;
            status: string;
            task: {
              id: string;
              owner_pi_uid: string;
              status: string;
              title: string;
              title_en: string | null;
            } | null;
          }>;
          const bid = bidRows[0];
          if (!bid || !bid.task) {
            return Response.json({ error: "Bid not found" }, { status: 404 });
          }
          if (bid.task.owner_pi_uid !== me.uid) {
            return Response.json(
              { error: "Only the task owner can accept offers" },
              { status: 403 },
            );
          }
          if (bid.task.status !== "open") {
            return Response.json(
              { error: "Task is no longer open" },
              { status: 409 },
            );
          }

          // 2. Mark this bid accepted.
          const acceptRes = await fetch(
            `${env.url}/rest/v1/bids?id=eq.${encodeURIComponent(bidId)}`,
            {
              method: "PATCH",
              headers: adminHeaders(env, "return=minimal"),
              body: JSON.stringify({ status: "accepted" }),
            },
          );
          if (!acceptRes.ok) {
            const detail = await acceptRes.text();
            console.error("[bids-accept] accept failed:", acceptRes.status, detail);
            return Response.json({ error: "Failed to accept bid" }, { status: 500 });
          }

          // 3. Reject everything else on this task.
          await fetch(
            `${env.url}/rest/v1/bids?task_id=eq.${encodeURIComponent(bid.task_id)}` +
              `&id=neq.${encodeURIComponent(bidId)}&status=eq.pending`,
            {
              method: "PATCH",
              headers: adminHeaders(env, "return=minimal"),
              body: JSON.stringify({ status: "rejected" }),
            },
          );

          // 4. Update the task.
          await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(bid.task_id)}`,
            {
              method: "PATCH",
              headers: adminHeaders(env, "return=minimal"),
              body: JSON.stringify({
                status: "in_progress",
                accepted_bid_id: bidId,
                assignee_pi_uid: bid.bidder_pi_uid,
              }),
            },
          );

          // 5. Create the conversation (idempotent via UNIQUE on bid_id).
          const convRes = await fetch(
            `${env.url}/rest/v1/conversations?on_conflict=bid_id`,
            {
              method: "POST",
              headers: adminHeaders(
                env,
                "resolution=merge-duplicates,return=representation",
              ),
              body: JSON.stringify([
                {
                  task_id: bid.task_id,
                  bid_id: bidId,
                  owner_pi_uid: me.uid,
                  bidder_pi_uid: bid.bidder_pi_uid,
                },
              ]),
            },
          );
          const convRows = (await convRes.json()) as Array<{ id: string }>;
          const conversationId = convRows[0]?.id;

          // 6. Notify the winner.
          await insertNotification(env, {
            recipient_pi_uid: bid.bidder_pi_uid,
            type: "system",
            title: "تم قبول عرضك 🎉",
            title_en: "Your offer was accepted 🎉",
            body: `قُبل عرضك على "${bid.task.title}". يمكنك بدء المحادثة الآن.`,
            body_en: `Your offer on "${bid.task.title_en ?? bid.task.title}" was accepted.`,
          });

          return Response.json({ conversationId, taskId: bid.task_id });
        } catch (err) {
          console.error("[bids-accept] error:", err);
          const message = "Server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
} as any);