import { createFileRoute } from "@tanstack/react-router";
import {
  verifyPiToken,
  getSupabaseAdminEnv,
  adminHeaders,
  ensureProfile,
} from "@/lib/server/piVerify";

/**
 * Daily Ayadi-token mining endpoint.
 *
 * Body: { accessToken: string }
 *
 * Behaviour:
 *  - Verifies Pi access token.
 *  - Reads the caller's current balance row (creates one at 0 if missing).
 *  - If 24h have passed since `last_claim_at` (or it's null), credits
 *    +0.002 AYADI, updates `last_claim_at`, inserts a row in `ayadi_claims`,
 *    and returns the new balance + 24h cooldown.
 *  - Otherwise returns the remaining cooldown (ms) and current balance with
 *    HTTP 200 + `claimed: false` so the UI can render the timer.
 */

const REWARD = 0.002;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface BalanceRow {
  pi_uid: string;
  balance: number | string;
  last_claim_at: string | null;
  updated_at: string;
}

export const Route = createFileRoute("/api/public/ayadi-mine")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // ---- 1. Parse body ----
        let body: { accessToken?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        // ---- 2. Verify Pi identity ----
        const verify = await verifyPiToken(body.accessToken);
        if (!verify.ok) {
          return Response.json({ error: verify.error }, { status: verify.status });
        }
        const { uid: piUid, username } = verify.identity;

        // ---- 3. Backend env ----
        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json(
            { error: "Service temporarily unavailable" },
            { status: 500 },
          );
        }

        try {
          await ensureProfile(env, { uid: piUid, username });

          // ---- 4. Fetch current balance row ----
          const getRes = await fetch(
            `${env.url}/rest/v1/ayadi_balances?pi_uid=eq.${encodeURIComponent(piUid)}&select=*`,
            { headers: adminHeaders(env) },
          );
          if (!getRes.ok) {
            const detail = await getRes.text();
            console.error("[ayadi-mine] read failed:", getRes.status, detail);
            return Response.json({ error: "Failed to read balance" }, { status: 500 });
          }
          const rows = (await getRes.json()) as BalanceRow[];
          const existing = rows[0] ?? null;

          const now = Date.now();
          const lastClaimMs = existing?.last_claim_at
            ? new Date(existing.last_claim_at).getTime()
            : 0;
          const elapsed = now - lastClaimMs;

          // ---- 5. Cooldown check ----
          if (existing && elapsed < COOLDOWN_MS) {
            return Response.json({
              claimed: false,
              balance: Number(existing.balance) || 0,
              lastClaimAt: existing.last_claim_at,
              nextClaimInMs: COOLDOWN_MS - elapsed,
              cooldownMs: COOLDOWN_MS,
            });
          }

          // ---- 6. Compute new balance + upsert ----
          const currentBalance = existing ? Number(existing.balance) || 0 : 0;
          const newBalance = Number((currentBalance + REWARD).toFixed(6));
          const claimedAt = new Date(now).toISOString();

          const upsertRes = await fetch(
            `${env.url}/rest/v1/ayadi_balances?on_conflict=pi_uid`,
            {
              method: "POST",
              headers: adminHeaders(
                env,
                "resolution=merge-duplicates,return=representation",
              ),
              body: JSON.stringify([
                {
                  pi_uid: piUid,
                  balance: newBalance,
                  last_claim_at: claimedAt,
                  updated_at: claimedAt,
                },
              ]),
            },
          );
          if (!upsertRes.ok) {
            const detail = await upsertRes.text();
            console.error("[ayadi-mine] upsert failed:", upsertRes.status, detail);
            return Response.json(
              { error: "Failed to update balance" },
              { status: 500 },
            );
          }

          // ---- 7. Log the claim ----
          const logRes = await fetch(`${env.url}/rest/v1/ayadi_claims`, {
            method: "POST",
            headers: adminHeaders(env, "return=minimal"),
            body: JSON.stringify([
              { pi_uid: piUid, amount: REWARD, claimed_at: claimedAt },
            ]),
          });
          if (!logRes.ok) {
            console.error(
              "[ayadi-mine] claim log failed:",
              logRes.status,
              await logRes.text(),
            );
          }

          return Response.json({
            claimed: true,
            balance: newBalance,
            reward: REWARD,
            lastClaimAt: claimedAt,
            nextClaimInMs: COOLDOWN_MS,
            cooldownMs: COOLDOWN_MS,
          });
        } catch (err) {
          console.error("[ayadi-mine] error:", err);
          const message = "Server error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
} as any);