import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  ensureProfile,
  getSupabaseAdminEnv,
  verifyPiToken,
} from "@/lib/server/piVerify.server";

// Server-to-server Pi Platform approval.
// Requires PI_API_KEY env var.

export const Route = createFileRoute("/api/public/payment-approve")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: {
          accessToken?: unknown;
          paymentId?: unknown;
          purpose?: unknown;
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const verify = await verifyPiToken(body.accessToken);
        if (!verify.ok) return Response.json({ error: verify.error }, { status: verify.status });

        const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
        if (!paymentId) return Response.json({ error: "paymentId required" }, { status: 400 });

        const purpose = typeof body.purpose === "string" ? body.purpose : "ads_subscription";
        const apiKey = process.env.PI_API_KEY;
        if (!apiKey) return Response.json({ error: "PI_API_KEY not configured" }, { status: 500 });

        const env = getSupabaseAdminEnv();
        if (!env) return Response.json({ error: "Service unavailable" }, { status: 500 });

        try {
          await ensureProfile(env, verify.identity);

          // Ask Pi Platform for payment details
          const payRes = await fetch(`https://api.minepi.com/v2/payments/${paymentId}`, {
            headers: { Authorization: `Key ${apiKey}` },
          });
          if (!payRes.ok) {
            const txt = await payRes.text();
            console.error("[payment-approve] lookup failed:", payRes.status, txt);
            return Response.json({ error: "Payment lookup failed" }, { status: 502 });
          }
          const pay = (await payRes.json()) as {
            amount: number;
            memo: string;
            user_uid: string;
            metadata?: Record<string, unknown>;
          };
          if (pay.user_uid !== verify.identity.uid) {
            return Response.json({ error: "Payment/user mismatch" }, { status: 403 });
          }

          // Log to pi_payments
          await fetch(`${env.url}/rest/v1/pi_payments?on_conflict=payment_id`, {
            method: "POST",
            headers: adminHeaders(env, "resolution=merge-duplicates,return=minimal"),
            body: JSON.stringify([
              {
                pi_uid: verify.identity.uid,
                payment_id: paymentId,
                amount: pay.amount,
                memo: pay.memo,
                purpose,
                metadata: pay.metadata ?? {},
                status: "approved",
                updated_at: new Date().toISOString(),
              },
            ]),
          });

          // Approve on Pi Platform
          const approveRes = await fetch(
            `https://api.minepi.com/v2/payments/${paymentId}/approve`,
            { method: "POST", headers: { Authorization: `Key ${apiKey}` } },
          );
          if (!approveRes.ok) {
            const txt = await approveRes.text();
            console.error("[payment-approve] approve failed:", approveRes.status, txt);
            return Response.json({ error: "Approve failed" }, { status: 502 });
          }
          return Response.json({ ok: true });
        } catch (err) {
          console.error("[payment-approve] error:", err);
          return Response.json({ error: "Server error" }, { status: 500 });
        }
      },
    },
  },
});