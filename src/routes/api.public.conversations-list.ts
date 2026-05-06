import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
  verifyPiToken,
} from "@/lib/server/piVerify.server";

/**
 * List conversations the caller is a participant in (owner or bidder).
 * Body: { accessToken }
 * Success: 200 { conversations }
 */
export const Route = createFileRoute("/api/public/conversations-list")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { accessToken?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const verify = await verifyPiToken(body.accessToken);
        if (!verify.ok) {
          return Response.json({ error: verify.error }, { status: verify.status });
        }
        const me = verify.identity;

        const env = getSupabaseAdminEnv();
        if (!env) return Response.json({ conversations: [] });

        try {
          const select = encodeURIComponent(
            "*,task:tasks!conversations_task_id_fkey(id,title,title_en,image_seed)," +
              "owner:profiles!conversations_owner_pi_uid_fkey(*)," +
              "bidder:profiles!conversations_bidder_pi_uid_fkey(*)",
          );
          const filter =
            `or=(owner_pi_uid.eq.${encodeURIComponent(me.uid)},` +
            `bidder_pi_uid.eq.${encodeURIComponent(me.uid)})`;
          const url =
            `${env.url}/rest/v1/conversations?${filter}` +
            `&select=${select}&order=last_message_at.desc.nullslast&limit=100`;

          const res = await fetch(url, { headers: adminHeaders(env) });
          if (!res.ok) {
            return Response.json({ conversations: [] });
          }
          const conversations = (await res.json()) as unknown[];
          return Response.json({ conversations });
        } catch (err) {
          console.error("[conversations-list] error:", err);
          return Response.json({ conversations: [] });
        }
      },
    },
  },
} as any);