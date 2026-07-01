import { createFileRoute } from "@tanstack/react-router";
import {
  adminHeaders,
  ensureProfile,
  getSupabaseAdminEnv,
  verifyPiToken,
} from "@/lib/server/piVerify.server";

const BOOST_COST = 1; // 1 AYADI
const BOOST_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

export const Route = createFileRoute("/api/public/task-boost")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { accessToken?: unknown; taskId?: unknown };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        const verify = await verifyPiToken(body.accessToken);
        if (!verify.ok) return Response.json({ error: verify.error }, { status: verify.status });

        const taskId =
          typeof body.taskId === "string"
            ? body.taskId.trim()
            : typeof body.taskId === "number"
              ? String(body.taskId)
              : "";
        if (!taskId) return Response.json({ error: "taskId required" }, { status: 400 });

        const env = getSupabaseAdminEnv();
        if (!env) return Response.json({ error: "Service unavailable" }, { status: 500 });

        try {
          await ensureProfile(env, verify.identity);
          const piUid = verify.identity.uid;

          // Check task ownership
          const tRes = await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&select=id,owner_pi_uid,status`,
            { headers: adminHeaders(env) },
          );
          const tasks = (await tRes.json()) as { id: string; owner_pi_uid: string; status: string }[];
          if (!Array.isArray(tasks) || tasks.length === 0) {
            return Response.json({ error: "المهمة غير موجودة" }, { status: 404 });
          }
          if (tasks[0].owner_pi_uid !== piUid) {
            return Response.json({ error: "لست صاحب المهمة" }, { status: 403 });
          }

          // Check & deduct AYADI balance
          const balRes = await fetch(
            `${env.url}/rest/v1/ayadi_balances?pi_uid=eq.${encodeURIComponent(piUid)}&select=*`,
            { headers: adminHeaders(env) },
          );
          const balRows = (await balRes.json()) as { balance: number | string; last_claim_at: string | null }[];
          const currentBal = balRows[0] ? Number(balRows[0].balance) || 0 : 0;
          if (currentBal < BOOST_COST) {
            return Response.json(
              { error: `رصيد AYADI غير كافٍ (مطلوب ${BOOST_COST})`, balance: currentBal },
              { status: 400 },
            );
          }
          const newBal = Number((currentBal - BOOST_COST).toFixed(6));
          const nowIso = new Date().toISOString();
          const upRes = await fetch(
            `${env.url}/rest/v1/ayadi_balances?on_conflict=pi_uid`,
            {
              method: "POST",
              headers: adminHeaders(env, "resolution=merge-duplicates,return=minimal"),
              body: JSON.stringify([
                {
                  pi_uid: piUid,
                  balance: newBal,
                  last_claim_at: balRows[0]?.last_claim_at ?? null,
                  updated_at: nowIso,
                },
              ]),
            },
          );
          if (!upRes.ok) {
            return Response.json({ error: "تعذّر خصم الرصيد" }, { status: 500 });
          }

          const boostedUntil = new Date(Date.now() + BOOST_DURATION_MS).toISOString();
          const boostRes = await fetch(
            `${env.url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}`,
            {
              method: "PATCH",
              headers: adminHeaders(env, "return=minimal"),
              body: JSON.stringify({ boosted_until: boostedUntil }),
            },
          );
          if (!boostRes.ok) {
            // best-effort refund
            await fetch(`${env.url}/rest/v1/ayadi_balances?on_conflict=pi_uid`, {
              method: "POST",
              headers: adminHeaders(env, "resolution=merge-duplicates,return=minimal"),
              body: JSON.stringify([
                { pi_uid: piUid, balance: currentBal, updated_at: nowIso },
              ]),
            });
            return Response.json({ error: "فشل تفعيل الترقية" }, { status: 500 });
          }

          return Response.json({
            ok: true,
            boostedUntil,
            balance: newBal,
            cost: BOOST_COST,
          });
        } catch (err) {
          console.error("[task-boost] error:", err);
          return Response.json({ error: "Server error" }, { status: 500 });
        }
      },
    },
  },
});