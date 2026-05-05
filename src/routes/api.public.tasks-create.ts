import { createFileRoute } from "@tanstack/react-router";
import {
  verifyPiToken,
  getSupabaseAdminEnv,
  adminHeaders,
  ensureProfile,
} from "@/lib/server/piVerify";
import { isValidCountryCode } from "@/lib/data/countries";

/**
 * Creates a new task on behalf of the authenticated Pi user.
 * The caller must include their Pi access token; we verify it with the
 * Pi Platform and use the returned uid as `owner_pi_uid`.
 *
 * Body: {
 *   accessToken: string,
 *   task: {
 *     title: string, description: string, category: string,
 *     budget: number, location?: string, deadline?: string
 *   }
 * }
 */

const VALID_CATEGORIES = [
  "design",
  "development",
  "writing",
  "delivery",
  "cleaning",
  "tutoring",
  "marketing",
  "other",
] as const;

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Only expose internal diagnostics when explicitly enabled (dev/QA). */
function withDetails(
  payload: { error: string },
  detail: string | undefined,
): Record<string, unknown> {
  if (process.env.ALLOW_DEV_MODE === "true" && detail) {
    return { ...payload, details: detail };
  }
  return payload;
}

export const Route = createFileRoute("/api/public/tasks-create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ---- 1. Parse + validate input ----
        let body: { accessToken?: unknown; task?: Record<string, unknown> };
        try {
          body = await request.json();
        } catch {
          return Response.json(
            { error: "بيانات غير صالحة" },
            { status: 400 },
          );
        }

        const accessToken =
          typeof body.accessToken === "string" ? body.accessToken.trim() : "";
        if (!accessToken || accessToken.length > 4096) {
          return Response.json(
            { error: "رمز المصادقة مفقود" },
            { status: 400 },
          );
        }

        const t = body.task ?? {};
        const title = clampStr(t.title, 200);
        const description = clampStr(t.description, 4000);
        const categoryRaw = typeof t.category === "string" ? t.category : "other";
        const category = (VALID_CATEGORIES as readonly string[]).includes(categoryRaw)
          ? categoryRaw
          : "other";
        const budgetNum = Number(t.budget);
        const budget = Number.isFinite(budgetNum) && budgetNum >= 0 ? budgetNum : 0;
        const location = clampStr(t.location, 200);
        const deadline = clampStr(t.deadline, 200);
        const country =
          typeof t.country === "string" && isValidCountryCode(t.country)
            ? t.country
            : null;

        if (!title || !description) {
          return Response.json(
            { error: "العنوان والوصف مطلوبان" },
            { status: 400 },
          );
        }

        // ---- 2. Verify Pi token (centralized helper) ----
        const verify = await verifyPiToken(accessToken);
        if (!verify.ok) {
          const arabic =
            verify.status === 401
              ? "فشلت مصادقة Pi، يرجى تسجيل الدخول مجددًا"
              : verify.status === 502
                ? "خدمة Pi غير متاحة حاليًا"
                : "تعذّر التحقق من الهوية";
          return Response.json({ error: arabic }, { status: verify.status });
        }
        const { uid: piUid, username } = verify.identity;

        // ---- 3. Insert via service-role ----
        const env = getSupabaseAdminEnv();
        if (!env) {
          console.error(
            "[tasks-create] missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
          );
          return Response.json(
            { error: "إعدادات الخادم غير مكتملة" },
            { status: 500 },
          );
        }

        try {
          // Ensure profile exists (FK on tasks.owner_pi_uid -> profiles.pi_uid).
          // CRITICAL: must succeed, otherwise the task INSERT will fail with FK violation.
          const profileResult = await ensureProfile(env, {
            uid: piUid,
            username,
          });
          if (!profileResult.ok) {
            const isLookup = profileResult.detail.startsWith(
              "profile_lookup_failed",
            );
            const arabic = isLookup
              ? "تعذّر التحقق من ملف المستخدم في قاعدة البيانات"
              : "تعذّر إنشاء ملف المستخدم الجديد";
            console.error(
              "[tasks-create] ensureProfile failed:",
              profileResult,
            );
            const status =
              profileResult.status >= 400 && profileResult.status < 600
                ? profileResult.status
                : 500;
            return Response.json(
              withDetails({ error: arabic }, profileResult.detail),
              { status },
            );
          }

          // Insert the task.
          const taskRow: Record<string, unknown> = {
            owner_pi_uid: piUid,
            title,
            description,
            category,
            budget,
            status: "open",
          };
          if (location) taskRow.location = location;
          if (deadline) taskRow.deadline = deadline;
          if (title) taskRow.image_seed = title.slice(0, 32);
          if (country) taskRow.country = country;

          const insertRes = await fetch(`${env.url}/rest/v1/tasks`, {
            method: "POST",
            headers: adminHeaders(env, "return=representation"),
            body: JSON.stringify([taskRow]),
          });

          if (!insertRes.ok) {
            const detail = await insertRes.text();
            console.error(
              "[tasks-create] insert failed:",
              insertRes.status,
              insertRes.statusText,
              detail,
            );
            return Response.json(
              withDetails(
                { error: "تعذّر حفظ المهمة في قاعدة البيانات" },
                `${insertRes.status} ${detail}`,
              ),
              { status: 500 },
            );
          }

          const rows = (await insertRes.json()) as unknown[];
          return Response.json({ task: Array.isArray(rows) ? rows[0] : null });
        } catch (err) {
          console.error("[tasks-create] error:", err);
          const detail = err instanceof Error ? err.message : String(err);
          return Response.json(
            withDetails({ error: "خطأ في الخادم" }, detail),
            { status: 500 },
          );
        }
      },
    },
  },
} as any);