import { createFileRoute } from "@tanstack/react-router";
import {
  verifyPiToken,
  getSupabaseAdminEnv,
  adminHeaders,
  ensureProfile,
} from "@/lib/server/piVerify.server";
import { isValidCountryCode } from "@/lib/data/countries";

/**
 * Updates the authenticated Pi user's profile (onboarding + preferences).
 * Body: {
 *   accessToken: string,
 *   profile: {
 *     full_name?: string, email?: string, address?: string,
 *     country?: string, preferred_lang?: 'ar' | 'en'
 *   }
 * }
 * Any subset of fields may be sent; missing fields are left unchanged.
 * When full_name + email + address + country are all present (either in this
 * request or already on the row), `onboarded_at` is set to now().
 */

const SUPPORTED_LANGS = new Set(["ar", "en"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clamp(v: unknown, min: number, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < min || t.length > max) return null;
  return t;
}

function withDetails(
  payload: { error: string },
  detail: string | undefined,
): Record<string, unknown> {
  if (process.env.ALLOW_DEV_MODE === "true" && detail) {
    return { ...payload, details: detail };
  }
  return payload;
}

export const Route = createFileRoute("/api/public/profile-update")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { accessToken?: unknown; profile?: Record<string, unknown> };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "بيانات غير صالحة" }, { status: 400 });
        }

        const accessToken =
          typeof body.accessToken === "string" ? body.accessToken.trim() : "";
        if (!accessToken || accessToken.length > 4096) {
          return Response.json({ error: "رمز المصادقة مفقود" }, { status: 400 });
        }

        const p = body.profile ?? {};
        const update: Record<string, unknown> = {};

        if (p.full_name !== undefined) {
          const v = clamp(p.full_name, 2, 120);
          if (v === null) {
            return Response.json(
              { error: "الاسم الكامل غير صالح" },
              { status: 400 },
            );
          }
          update.full_name = v;
        }

        if (p.email !== undefined) {
          const v = clamp(p.email, 5, 254);
          if (v === null || !EMAIL_RE.test(v)) {
            return Response.json(
              { error: "البريد الإلكتروني غير صالح" },
              { status: 400 },
            );
          }
          update.email = v.toLowerCase();
        }

        if (p.address !== undefined) {
          const v = clamp(p.address, 3, 300);
          if (v === null) {
            return Response.json(
              { error: "العنوان غير صالح" },
              { status: 400 },
            );
          }
          update.address = v;
        }

        if (p.country !== undefined) {
          if (!isValidCountryCode(p.country)) {
            return Response.json(
              { error: "رمز الدولة غير صالح" },
              { status: 400 },
            );
          }
          update.country = p.country;
        }

        if (p.preferred_lang !== undefined) {
          if (
            typeof p.preferred_lang !== "string" ||
            !SUPPORTED_LANGS.has(p.preferred_lang)
          ) {
            return Response.json(
              { error: "اللغة غير مدعومة" },
              { status: 400 },
            );
          }
          update.preferred_lang = p.preferred_lang;
        }

        if (Object.keys(update).length === 0) {
          return Response.json(
            { error: "لا توجد حقول للتحديث" },
            { status: 400 },
          );
        }

        // Verify Pi identity.
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
        const { uid, username } = verify.identity;

        const env = getSupabaseAdminEnv();
        if (!env) {
          return Response.json(
            { error: "إعدادات الخادم غير مكتملة" },
            { status: 500 },
          );
        }

        // Make sure the profile row exists.
        const ensured = await ensureProfile(env, { uid, username });
        if (!ensured.ok) {
          return Response.json(
            withDetails(
              { error: "تعذّر تجهيز ملف المستخدم" },
              ensured.detail,
            ),
            { status: ensured.status },
          );
        }

        update.updated_at = new Date().toISOString();

        try {
          // Fetch existing row to decide whether to set onboarded_at.
          const lookupRes = await fetch(
            `${env.url}/rest/v1/profiles?pi_uid=eq.${encodeURIComponent(uid)}&select=full_name,email,address,country,onboarded_at&limit=1`,
            { method: "GET", headers: adminHeaders(env) },
          );
          if (!lookupRes.ok) {
            const detail = await lookupRes.text();
            return Response.json(
              withDetails(
                { error: "تعذّر قراءة ملف المستخدم" },
                `${lookupRes.status} ${detail}`,
              ),
              { status: 502 },
            );
          }
          const existing =
            ((await lookupRes.json()) as Array<{
              full_name: string | null;
              email: string | null;
              address: string | null;
              country: string | null;
              onboarded_at: string | null;
            }>)[0] ?? null;

          // Compute the merged "is fully onboarded?" view.
          const merged = {
            full_name:
              (update.full_name as string | undefined) ??
              existing?.full_name ??
              null,
            email:
              (update.email as string | undefined) ?? existing?.email ?? null,
            address:
              (update.address as string | undefined) ??
              existing?.address ??
              null,
            country:
              (update.country as string | undefined) ??
              existing?.country ??
              null,
          };
          const fullyComplete =
            !!merged.full_name &&
            !!merged.email &&
            !!merged.address &&
            !!merged.country;
          if (fullyComplete && !existing?.onboarded_at) {
            update.onboarded_at = new Date().toISOString();
          }

          const patchRes = await fetch(
            `${env.url}/rest/v1/profiles?pi_uid=eq.${encodeURIComponent(uid)}`,
            {
              method: "PATCH",
              headers: adminHeaders(env, "return=representation"),
              body: JSON.stringify(update),
            },
          );

          if (!patchRes.ok) {
            const detail = await patchRes.text();
            console.error(
              "[profile-update] patch failed:",
              patchRes.status,
              detail,
            );
            return Response.json(
              withDetails(
                { error: "تعذّر حفظ ملف المستخدم" },
                `${patchRes.status} ${detail}`,
              ),
              { status: 500 },
            );
          }

          const rows = (await patchRes.json()) as unknown[];
          return Response.json({
            profile: Array.isArray(rows) ? rows[0] : null,
          });
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          console.error("[profile-update] error:", detail);
          return Response.json(
            withDetails({ error: "خطأ في الخادم" }, detail),
            { status: 500 },
          );
        }
      },
    },
  },
});