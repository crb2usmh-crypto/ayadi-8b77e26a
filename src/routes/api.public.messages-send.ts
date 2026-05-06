import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  ensureProfile,
  getSupabaseAdminEnv,
  insertNotification,
  verifyPiToken,
} from "@/lib/server/piVerify.server";

/**
 * Send a message inside a conversation. Caller must be one of the
 * two participants (owner or bidder).
 *
 * Body: { accessToken, conversationId, body }
 * Success: 200 { message }
 */
export const Route = createFileRoute("/api/public/messages-send")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let payload: {
          accessToken?: unknown;
          conversationId?: unknown;
          body?: unknown;
        };
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const conversationId =
          typeof payload.conversationId === "string" ? payload.conversationId.trim() : "";
        if (!/^[0-9a-f-]{8,40}$/i.test(conversationId)) {
          return Response.json({ error: "Invalid conversationId" }, { status: 400 });
        }

        const text = typeof payload.body === "string" ? payload.body.trim() : "";
        if (!text) {
          return Response.json({ error: "Empty message" }, { status: 400 });
        }
        if (text.length > 4000) {
          return Response.json({ error: "Message too long" }, { status: 400 });
        }

        const verify = await verifyPiToken(payload.accessToken);
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

          // 1. Verify caller is in the conversation.
          const convRes = await fetch(
            `${env.url}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}` +
              `&select=id,owner_pi_uid,bidder_pi_uid`,
            { headers: adminHeaders(env) },
          );
          const convRows = (await convRes.json()) as Array<{
            id: string;
            owner_pi_uid: string;
            bidder_pi_uid: string;
          }>;
          const conv = convRows[0];
          if (!conv) {
            return Response.json({ error: "Conversation not found" }, { status: 404 });
          }
          const isOwner = conv.owner_pi_uid === me.uid;
          const isBidder = conv.bidder_pi_uid === me.uid;
          if (!isOwner && !isBidder) {
            return Response.json({ error: "Not a participant" }, { status: 403 });
          }

          // 2. Insert message.
          const insertRes = await fetch(`${env.url}/rest/v1/messages`, {
            method: "POST",
            headers: adminHeaders(env, "return=representation"),
            body: JSON.stringify([
              {
                conversation_id: conversationId,
                sender_pi_uid: me.uid,
                body: text,
              },
            ]),
          });
          if (!insertRes.ok) {
            const detail = await insertRes.text();
            console.error("[messages-send] insert failed:", insertRes.status, detail);
            return Response.json({ error: "Failed to send" }, { status: 500 });
          }
          const rows = (await insertRes.json()) as unknown[];
          const message = Array.isArray(rows) ? rows[0] : null;

          // 3. Bump conversation last_message_at.
          await fetch(
            `${env.url}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`,
            {
              method: "PATCH",
              headers: adminHeaders(env, "return=minimal"),
              body: JSON.stringify({ last_message_at: new Date().toISOString() }),
            },
          );

          // 4. Notify the other participant.
          const recipient = isOwner ? conv.bidder_pi_uid : conv.owner_pi_uid;
          await insertNotification(env, {
            recipient_pi_uid: recipient,
            type: "message",
            title: "رسالة جديدة",
            title_en: "New message",
            body: `${me.username}: ${text.slice(0, 80)}`,
            body_en: `${me.username}: ${text.slice(0, 80)}`,
          });

          return Response.json({ message });
        } catch (err) {
          console.error("[messages-send] error:", err);
          const m = "Server error";
          return Response.json({ error: m }, { status: 500 });
        }
      },
    },
  },
});