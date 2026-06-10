## فحص شامل وإصلاح اتصال Supabase

### الوضع الحالي (نتائج الاستكشاف)

- **المتغيرات السرية الموجودة**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PI_API_KEY` ✓
- **`vite.config.ts`** يحقن `SUPABASE_URL`/`SUPABASE_ANON_KEY` إلى `import.meta.env.VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY` وقت البناء ✓
- **`src/lib/supabaseClient.ts`** يقرأ `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` ✓
- **المصادقة عبر Pi Network فقط** — لا توجد Supabase Auth، وكل عمليات الكتابة تمر عبر Server Routes تستخدم `SERVICE_ROLE_KEY` ✓
- **لا توجد أي `supabase.from()` في كود العميل** — العميل يستدعي `/api/public/*` فقط، لذا فحص استعلامات العميل غير ذي صلة هنا
- **مجلد `supabase/migrations/`** يحتوي ملفي ترحيل فقط (المخطط الأصلي تم تطبيقه خارج المشروع)، ولا توجد عندي صلاحية psql لفحص الجداول/السياسات/الفهارس مباشرةً

### ما سأنفذه

#### 1) لوغات تشخيص للمتغيرات (مؤقتة)
- إضافة `console.log` آمن (يطبع `present: true/false` فقط، لا قيم) في `PiAuthProvider` (عميل) وفي `piVerify.server.ts` (موجود جزئياً — توسيعه ليشمل `VITE_*` على العميل).

#### 2) تقوية معالجة الأخطاء في Server Routes
- لف كل استدعاء `fetch` نحو `${env.url}/rest/v1/...` في `try/catch` صريح في الراوتات التي تفتقر إليه: `api.public.tasks-create`, `tasks-update`, `tasks-delete`, `tasks-complete`, `bids-accept`, `bids-list`, `messages-send`, `messages-list`, `reviews-create`, `notifications`, `profile-update`, `ayadi-balance`, `ayadi-mine`.
- توحيد رسائل الخطأ بالعربية + إرجاع `details` فقط عند `ALLOW_DEV_MODE=true`.
- التحقق من أسماء الجداول/الأعمدة المستخدمة في كل راوت ومطابقتها مع `src/lib/supabase/types.ts`.

#### 3) Migration جديد — RLS + Grants + Triggers + Indexes

ملف ترحيل واحد `supabase/migrations/<timestamp>_connection_hardening.sql` يقوم بـ:

**أ) GRANTs على الجداول العامة** (شرط ضروري لـ Data API):
```text
profiles, tasks, bids, messages, conversations, notifications,
reviews, ayadi_balances, ayadi_claims
```
- `GRANT ALL ... TO service_role` لكل الجداول (يضمن نجاح Server Routes).
- `GRANT SELECT TO anon` فقط على `profiles` و`tasks` (القراءات العامة).
- `GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated` على الجداول القابلة للقراءة العامة.

**ب) RLS** (idempotent، باستخدام `drop policy if exists` ثم `create policy`):
- `profiles`: SELECT عام، أي كتابة عبر service_role فقط (deny anon/authenticated writes).
- `tasks`: SELECT عام للحالة `open|in_progress|completed`، كتابة عبر service_role.
- `bids`, `messages`, `conversations`, `notifications`, `reviews`, `ayadi_balances`, `ayadi_claims`: deny anon/authenticated مباشرةً (نمط `using(false)`) — كل الوصول عبر service_role في Server Routes.

**ج) Triggers** (إنشاء إن لم توجد):
- `handle_new_bid` → ينشئ سجل `notifications` لصاحب المهمة عند إدراج عرض جديد.
- `handle_new_message` → ينشئ إشعار للطرف المستقبل عند إدراج رسالة.
- ملاحظة: `handle_new_user` غير مطلوب لأن لا توجد `auth.users` — `ensureProfile` في Server Route يتكفل بإنشاء الـ profile.
- كل التريغرز `security definer` مع `search_path=public`، ولا ترفع أخطاء قاتلة (كتابة الإشعار best-effort داخل `begin/exception when others then null/end`).

**د) Indexes** (`create index if not exists`):
- `profiles(pi_uid)` (موجود غالباً كـ unique، نتأكد فقط)
- `tasks(owner_pi_uid)`, `tasks(status)`, `tasks(created_at desc)`, `tasks(category)`
- `bids(task_id)`, `bids(bidder_pi_uid)`, `bids(status)`
- `messages(conversation_id, created_at desc)`, `messages(task_id)`
- `conversations(task_id)`, `conversations(participant_a_pi_uid)`, `conversations(participant_b_pi_uid)`
- `notifications(recipient_pi_uid, created_at desc)`
- `reviews(task_id)`, `reviews(reviewee_pi_uid)`
- `ayadi_balances(pi_uid)`, `ayadi_claims(pi_uid, created_at desc)`

كل العبارات `if not exists` / `if exists` لتكون آمنة على قاعدة بيانات موجودة.

#### 4) تنظيف بعد التحقق
- إزالة `console.log` التشخيصية بعد أن يؤكد المستخدم أن المتغيرات تظهر بشكل صحيح (نتركها مغلفة بـ `if (import.meta.env.DEV)` كي لا تتسرب للإنتاج).

### ما لن أفعله ولماذا
- **لن أعدّل أي ملف Migration موجود** (للقراءة فقط).
- **لن أُفعّل سياسات INSERT للمستخدمين العاديين على الجداول الحساسة** — معمارية التطبيق تعتمد كلياً على Service Role من جانب الخادم بعد تحقق Pi، وفتح RLS للكتابة المباشرة يخالف هذا النموذج الأمني.
- **لن أفحص استعلامات `supabase.from()` في العميل** لأنها غير موجودة (كل شيء يمر عبر `/api/public/*`).

### المخاطر
- لا أستطيع التحقق من السكيمة الفعلية قبل تطبيق الـ migration؛ سأستخدم `if exists`/`if not exists` لتفادي الفشل على أعمدة/جداول غير موجودة.
- إذا كانت Triggers موجودة بالفعل بنفس الاسم، الـ migration سيستخدم `create or replace function` + `drop trigger if exists` ثم `create trigger`.
