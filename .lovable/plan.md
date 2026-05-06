# خطة معالجة طلبات تطبيق "أيادي"

## 1) إصلاح خطأ "تعذّر حفظ العرض"

**السبب الجذري:** في `src/routes/api.public.bids-create.ts` السطر 69 يحوّل معرّف المهمة إلى رقم: `task_id: Number(taskId)`. لكن معرّفات المهام في Supabase هي UUID نصيّة، فيصبح `task_id = NaN` ويفشل الإدراج بصمت برسالة عربية عامة.

**الإصلاح:**
- استبدال `task_id: Number(taskId)` بـ `task_id: taskId` (سلسلة نصية).
- تعزيز التحقق من صيغة UUID (regex `^[0-9a-f-]{8,40}$/i`) كما في `tasks-update`.
- إضافة التحقق من جلسة Pi عبر `verifyPiToken(accessToken)` ومطابقة `bidderPiUid` مع هوية الجلسة (حماية ضد الانتحال).
- منع المالك من المزايدة على مهمته.
- تمرير تفاصيل الخطأ من PostgREST في وضع التطوير (مثل ما يفعله `profile-update`) لتسهيل التشخيص.
- بقاء الواجهة (`tasks.$taskId.tsx`) كما هي — `String(task.id)` صحيح بالفعل.

## 2) تشغيل زر "تعديل" للمهمة والملف الشخصي

**حالة التعديل في صفحة المهمة:** زر التعديل موجود بالفعل في `OwnerActions` ويستخدم `Link to="/tasks/$taskId/edit"` بشكل صحيح، وملف `tasks.$taskId.edit.tsx` موجود ويعمل. لا حاجة لتغيير سوى:
- التأكد من تمرير `taskId` كسلسلة في `params={{ taskId }}` (موجود).
- إضافة مفاتيح ترجمة إن لزم.

**أيقونة التعديل في الملف الشخصي:** زر "تعديل" موجود حالياً في `profile.tsx` لكنه بدون رابط. سيتم:
- ربطه بصفحة `/onboarding` (التي تعمل أيضاً كصفحة "تعديل البيانات" وتدعم القيم الموجودة مسبقاً).
- إضافة `<Link to="/onboarding">` حول الزر.

## 3) رفع صورة اختيارية للعرض

**التغييرات على قاعدة البيانات (Migration):**
- إنشاء bucket تخزين `bid-images` (عام للقراءة).
- إضافة عمود `image_url text` إلى جدول `bids`.
- سياسات RLS:
  - أي مستخدم مصادق عليه يستطيع رفع صورة في bucket `bid-images`.
  - القراءة العامة (لعرضها لصاحب المهمة).

**الواجهة (`tasks.$taskId.tsx` Dialog تقديم العرض):**
- إضافة حقل `<Input type="file" accept="image/*">` اختياري داخل النموذج.
- عند الإرسال: إن وُجدت صورة، رفعها أولاً إلى Supabase Storage عبر `supabase.storage.from('bid-images').upload(...)`، ثم تمرير `imageUrl` ضمن جسم `bids-create`.

**الخادم (`api.public.bids-create.ts`):**
- قبول حقل `imageUrl` اختياري (string، حد أقصى 1024 محرف، يبدأ بـ `https://`).
- إدراجه في صف `bids` كـ `image_url`.

**العرض:** إظهار الصورة (إن وجدت) داخل قائمة العروض في `BidsSection` لصاحب المهمة.

## 4) صورة رمزية للملف الشخصي (Avatar)

**قاعدة البيانات:**
- إنشاء bucket `avatars` (عام).
- إضافة عمود `avatar_url text` إلى جدول `profiles` (إن لم يكن موجوداً — `getAvatarUrl` يعتمد حالياً على `avatar_seed`).
- سياسات RLS: المستخدم يرفع/يحدّث ملف باسم `{pi_uid}.{ext}` فقط؛ القراءة عامة.

**الواجهة (`profile.tsx`):**
- زر/أيقونة كاميرا فوق `<Avatar>` يفتح اختيار ملف.
- بعد الاختيار: رفع إلى `avatars/{pi_uid}-{timestamp}.{ext}`.
- استدعاء `api/public/profile-update` مع `profile.avatar_url = publicUrl`.
- عرض `avatar_url` إن وُجد، وإلا الرجوع إلى `getAvatarUrl(avatar_seed)`.

**الخادم (`api.public.profile-update.ts`):** قبول حقل `avatar_url` ضمن المخطط (validation: https URL، حد أقصى 1024 محرف).

## 5) تقسيم حقل العنوان في Onboarding

**الواجهة (`onboarding.tsx`):**
- استبدال `Textarea` الواحد للعنوان بأربع حقول `Input` منفصلة:
  - `street` — الشارع/الحي
  - `city` — المدينة
  - `state` — الولاية/المقاطعة
  - `postal_code` — الرمز البريدي
- عند التحميل لمستخدم لديه `address` سابق: ملء `street` بالقيمة الكاملة كاحتياط (لأن الحفظ القديم كان نصاً واحداً)، أو تركها فارغة وعرض القيمة الحالية أسفل الحقول.
- عند الإرسال: تجميع القيم في سلسلة واحدة:
  ```
  address = `${street}، ${city}، ${state} ${postal_code}`.replace(/،\s*،/g, '،').trim()
  ```
  وإرسالها في حقل `address` كما هو متوقع من الخادم — لا حاجة لتغيير المخطط أو الـAPI.
- إضافة مفاتيح ترجمة عربية/إنجليزية: `onboarding.street`, `onboarding.city`, `onboarding.state`, `onboarding.postalCode`.

## التفاصيل التقنية (للمراجعة)

**ملفات سيتم تعديلها:**
- `src/routes/api.public.bids-create.ts` — إصلاح UUID + تحقق Pi + دعم `imageUrl`.
- `src/routes/api.public.profile-update.ts` — قبول `avatar_url`.
- `src/routes/tasks.$taskId.tsx` — حقل رفع الصورة في dialog العرض + عرضها في BidsSection.
- `src/routes/profile.tsx` — ربط زر "تعديل" بـ `/onboarding` + مكوّن رفع Avatar.
- `src/routes/onboarding.tsx` — تقسيم العنوان لأربعة حقول.
- `src/lib/i18n/locales/ar.json` و `en.json` — مفاتيح جديدة.
- `src/lib/supabase/types.ts` — إضافة `avatar_url` و `image_url` للأنواع.

**Migration جديد** (عبر أداة الترحيل):
- `create bucket bid-images public`
- `create bucket avatars public`
- `alter table bids add column image_url text`
- `alter table profiles add column avatar_url text` (إذا لم يكن موجوداً)
- سياسات RLS للـbuckets

**ملاحظة على hydration error الحالي:** خطأ "Hydration failed" في `FullScreenLoader` (تبديل ar/en بين الخادم والعميل) خارج نطاق هذا الطلب وسيُترك كما هو.
