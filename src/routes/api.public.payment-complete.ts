import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  getSupabaseAdminEnv,
  verifyPiToken,
} from "@/lib/server/piVerify.server";

export const Route = createFileRoute("/api/public/payment-complete")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: {
          accessToken?: unknown;
          paymentId?: unknown;
          txid?: unknown;
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
        const txid = typeof body.txid === "string" ? body.txid.trim() : "";
        const purpose = typeof body.purpose === "string" ? body.purpose : "ads_subscription";
        if (!paymentId || !txid) {
          return Response.json({ error: "paymentId & txid required" }, { status: 400 });
        }

        const apiKey = process.env.PI_API_KEY;
        if (!apiKey) return Response.json({ error: "PI_API_KEY not configured" }, { status: 500 });
        const env = getSupabaseAdminEnv();
        if (!env) return Response.json({ error: "Service unavailable" }, { status: 500 });

        try {
          // Complete on Pi Platform
          const completeRes = await fetch(
            `https://api.minepi.com/v2/payments/${paymentId}/complete`,
            {
              method: "POST",
              headers: {
                Authorization: `Key ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ txid }),
            },
          );
          if (!completeRes.ok) {
            const txt = await completeRes.text();
            console.error("[payment-complete] complete failed:", completeRes.status, txt);
            return Response.json({ error: "Complete failed" }, { status: 502 });
          }

          // Update pi_payments row
          await fetch(
            `${env.url}/rest/v1/pi_payments?payment_id=eq.${encodeURIComponent(paymentId)}`,
            {
              method: "PATCH",
              headers: adminHeaders(env, "return=minimal"),
              body: JSON.stringify({
                txid,
                status: "completed",
                updated_at: new Date().toISOString(),
              }),
            },
          );

          // Provision benefit
          if (purpose === "ads_subscription") {
            const now = Date.now();
            const expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
            const insRes = await fetch(`${env.url}/rest/v1/ads_subscriptions`, {
              method: "POST",
              headers: adminHeaders(env, "return=minimal"),
              body: JSON.stringify([
                {
                  pi_uid: verify.identity.uid,
                  starts_at: new Date(now).toISOString(),
                  expires_at: expiresAt,
                  payment_id: paymentId,
                  txid,
                  amount_pi: 0.01,
                },
              ]),
            });
            if (!insRes.ok) {
              console.error("[payment-complete] sub insert failed:", insRes.status, await insRes.text());
            }
            return Response.json({ ok: true, adFree: true, expiresAt });
          }

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[payment-complete] error:", err);
          return Response.json({ error: "Server error" }, { status: 500 });
        }
      },
    },
  },
});