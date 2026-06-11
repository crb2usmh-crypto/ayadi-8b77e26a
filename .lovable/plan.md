## إعادة بناء اتصال Supabase

### الوضع الحالي (من الفحص)
- العميل الحالي: `src/lib/supabaseClient.ts` يستخدم `Proxy` كسول مع `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — يعمل لكنه معقد.
- `vite.config.ts` يحقن `SUPABASE_URL/ANON_KEY` (السرية) إلى متغيرات `VITE_*` وقت البناء ✓
- كل عمليات الكتابة تمر عبر `src/routes/api.public.*.ts` باستخدام `SERVICE_ROLE_KEY` عبر `fetch` مباشر إلى REST API — لا تستخدم `@supabase/supabase-js` على الخادم.
- العميل (`supabase.from(...)`) مستخدم في: `src/lib/supabase/queries.ts` و`src/lib/supabase/realtime.ts` فقط.

### الخطة

#### 1) إنشاء `src/lib/supabaseClientNew.ts`
عميل بسيط ومباشر (بدون Proxy)، يُنشأ مرة واحدة وقت تحميل الموديل:
```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  console.error("[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url ?? "", anon ?? "", {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export async function pingSupabase() {
  const { count, error } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}
```

#### 2) تحديث المستوردين
- `src/lib/supabase/queries.ts`: تغيير `from "@/lib/supabaseClient"` → `"@/lib/supabaseClientNew"`.
- `src/lib/supabase/realtime.ts`: نفس التغيير.
- لا تغييرات على Server Routes (لا تستورد العميل أصلاً — تستخدم `fetch` مع `SERVICE_ROLE_KEY`).
- لا تغييرات على `PiAuthProvider` (لا يستورد Supabase client).

#### 3) اختبار الاتصال في `src/routes/index.tsx`
- في أعلى `HomePage`، إضافة `useQuery` يستدعي `pingSupabase()` ويعرض شريطًا صغيرًا أعلى الصفحة:
  - نجاح: `✓ Supabase: N مهمة` (أخضر فاتح)
  - فشل: `✗ خطأ في الاتصال: <message>` (أحمر)
- `staleTime: 60_000` لتجنب الجلب المتكرر. شريط مؤقت — سيُزال بعد التأكيد.

#### 4) تنظيف
- حذف `src/lib/supabaseClient.ts` بعد التأكد من عدم وجود مستوردين له.
- إزالة `console.log` التشخيصية في `PiAuthProvider` (تركها مغلفة بـ `import.meta.env.DEV`).

### ملاحظات
- لن أعدّل Server Routes — اتصالها بالـ REST API مباشر ولا يستخدم `supabase-js`.
- العميل الجديد ينشئ الاتصال فورًا (لا lazy proxy) — إذا كانت متغيرات البيئة مفقودة سيُسجَّل خطأ واضح في الـ console ويفشل الاستعلام برسالة مفهومة بدل crash.
- الشريط التشخيصي مؤقت؛ سأطلب منك إزالته بعد التأكد.

### الملفات المتأثرة
- جديد: `src/lib/supabaseClientNew.ts`
- معدّل: `src/lib/supabase/queries.ts`, `src/lib/supabase/realtime.ts`, `src/routes/index.tsx`
- محذوف: `src/lib/supabaseClient.ts`
