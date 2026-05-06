import { createFileRoute } from "@tanstack/react-router";
import {
  verifyPiToken,
  getSupabaseAdminEnv,
  adminHeaders,
} from "@/lib/server/piVerify.server";

/**
 * Returns the current Ayadi-token balance, cooldown status, and the
 * 5 most recent mining claims for the authenticated Pi user.
 *
 * Body: { accessToken: string }
 */

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface BalanceRow {
  pi_uid: string;
  balance: number | string;
  last_claim_at: string | null;
}

interface ClaimRow {
  id: string;
  pi_uid: string;
  amount: number | string;
  claimed_at: string;
}

export const Route = createFileRoute("/api/public/ayadi-balance")({
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
        const piUid = verify.identity.uid;

        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json({
            balance: 0,
            lastClaimAt: null,
            nextClaimInMs: 0,
            cooldownMs: COOLDOWN_MS,
            claims: [],
          });
        }

        try {
          const [balRes, claimsRes] = await Promise.all([
            fetch(
              `${env.url}/rest/v1/ayadi_balances?pi_uid=eq.${encodeURIComponent(piUid)}&select=*`,
              { headers: adminHeaders(env) },
            ),
            fetch(
              `${env.url}/rest/v1/ayadi_claims?pi_uid=eq.${encodeURIComponent(piUid)}` +
                `&order=claimed_at.desc&limit=5&select=*`,
              { headers: adminHeaders(env) },
            ),
          ]);

          const bal = balRes.ok ? ((await balRes.json()) as BalanceRow[]) : [];
          const claims = claimsRes.ok ? ((await claimsRes.json()) as ClaimRow[]) : [];

          const row = bal[0] ?? null;
          const balance = row ? Number(row.balance) || 0 : 0;
          const lastClaimAt = row?.last_claim_at ?? null;
          const lastMs = lastClaimAt ? new Date(lastClaimAt).getTime() : 0;
          const elapsed = Date.now() - lastMs;
          const nextClaimInMs =
            !lastClaimAt || elapsed >= COOLDOWN_MS ? 0 : COOLDOWN_MS - elapsed;

          return Response.json({
            balance,
            lastClaimAt,
            nextClaimInMs,
            cooldownMs: COOLDOWN_MS,
            claims: claims.map((c) => ({
              id: c.id,
              amount: Number(c.amount) || 0,
              claimed_at: c.claimed_at,
            })),
          });
        } catch (err) {
          console.error("[ayadi-balance] error:", err);
          const message = "Server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
} as any);