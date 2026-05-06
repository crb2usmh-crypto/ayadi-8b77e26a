import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
  verifyPiToken,
} from "@/lib/server/piVerify.server";

/**
 * List messages of a conversation. Caller MUST be one of the two
 * participants (owner or bidder). All access is gated by the Pi
 * access token; the messages table is otherwise inaccessible from
 * the browser anon key (see RLS).
 *
 * Body: { accessToken, conversationId }
 * Success: 200 { messages, conversation }
 */
export const Route = createFileRoute("/api/public/messages-list")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let payload: { accessToken?: unknown; conversationId?: unknown };
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const conversationId =
          typeof payload.conversationId === "string"
            ? payload.conversationId.trim()
            : "";
        if (!/^[0-9a-f-]{8,40}$/i.test(conversationId)) {
          return Response.json({ error: "Invalid conversationId" }, { status: 400 });
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
          // 1. Load conversation (with participants + task + profiles).
          const select = encodeURIComponent(
            "*,task:tasks!conversations_task_id_fkey(id,title,title_en,image_seed)," +
              "owner:profiles!conversations_owner_pi_uid_fkey(*)," +
              "bidder:profiles!conversations_bidder_pi_uid_fkey(*)",
          );
          const convRes = await fetch(
            `${env.url}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}` +
              `&select=${select}`,
            { headers: adminHeaders(env) },
          );
          const convRows = (await convRes.json()) as Array<{
            id: string;
            owner_pi_uid: string;
            bidder_pi_uid: string;
            [k: string]: unknown;
          }>;
          const conversation = convRows[0];
          if (!conversation) {
            return Response.json({ error: "Conversation not found" }, { status: 404 });
          }
          if (
            conversation.owner_pi_uid !== me.uid &&
            conversation.bidder_pi_uid !== me.uid
          ) {
            return Response.json({ error: "Not a participant" }, { status: 403 });
          }

          // 2. Fetch messages.
          const msgRes = await fetch(
            `${env.url}/rest/v1/messages?conversation_id=eq.${encodeURIComponent(conversationId)}` +
              `&select=*&order=created_at.asc&limit=500`,
            { headers: adminHeaders(env) },
          );
          if (!msgRes.ok) {
            return Response.json(
              { error: "Failed to load messages" },
              { status: 500 },
            );
          }
          const messages = (await msgRes.json()) as unknown[];

          return Response.json({ conversation, messages });
        } catch (err) {
          console.error("[messages-list] error:", err);
          const m = "Server error";
          return Response.json({ error: m }, { status: 500 });
        }
      },
    },
  },
});