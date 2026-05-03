# خطة التنفيذ — حزمة Onboarding + الموقع + i18n

## نظرة عامة

ثلاث ميزات مترابطة تشترك في تعديل نفس الجداول/المزوّدات، لذلك تُنفَّذ كحزمة واحدة:

1. **Onboarding إجباري** بعد تسجيل الدخول لجمع `full_name` + `email` + `address` + `country`.
2. **فلترة المهام حسب الدولة** مع مفتاح "كل الدول".
3. **مبدّل لغة محفوظ** في `profiles.preferred_lang` (نفس آلية i18n الحالية موسّعة).

`react-i18next` مُهيّأ بالفعل (`src/lib/i18n/config.ts`) ويدعم `ar`/`en` مع `DirectionProvider` يقلب RTL/LTR — سنبني فوقه.

---

## 1) تغييرات قاعدة البيانات (Migration واحدة)

إضافة أعمدة على `profiles` و `tasks` فقط. لا جداول جديدة.

```sql
alter table public.profiles
  add column if not exists full_name      text,
  add column if not exists email          text,
  add column if not exists address        text,
  add column if not exists country        text,           -- ISO-2 (SA, EG, ...)
  add column if not exists preferred_lang text default 'ar',
  add column if not exists onboarded_at   timestamptz;

alter table public.tasks
  add column if not exists country text;                  -- ISO-2

create index if not exists tasks_country_idx on public.tasks(country);
```

`onboarded_at IS NOT NULL` = المستخدم أكمل البيانات. تُستخدم بوّابةً في الواجهة.

## 2) قائمة الدول

ملف ثابت `src/lib/data/countries.ts` يصدّر مصفوفة `{ code, ar, en, dialCode? }` (~250 دولة، بدون مكتبة خارجية). يُستخدم في كل `<Select>` للدولة.

## 3) مسار خادمي جديد: `src/routes/api.public.profile-update.ts`

`POST { accessToken, profile: { full_name, email, address, country, preferred_lang } }`

- يتحقق من Pi token عبر `verifyPiToken`.
- يستدعي `ensureProfile` (موجود).
- يقوم بـ `PATCH /rest/v1/profiles?pi_uid=eq.<uid>` بـ service-role مع التحقق من:
  - `full_name` (2..120)، `email` بصيغة بريد بسيطة، `address` (3..300)، `country` (ISO-2 ضمن القائمة).
  - عند الإكمال الأول يضع `onboarded_at = now()`.
- يعيد الصف المحدَّث.
- رسائل خطأ عربية + `withDetails` كما في `tasks-create`.

## 4) صفحة Onboarding: `src/routes/onboarding.tsx`

- نموذج بسيط (4 حقول إجبارية): الاسم الكامل، البريد، العنوان، الدولة (Select).
- زر "حفظ ومتابعة" يستدعي `/api/public/profile-update`.
- عند النجاح: `queryClient.invalidateQueries(['profile'])` + `toast.success` + `navigate({ to: '/' })`.
- لا يمكن الخروج منها قبل الحفظ (لا يوجد رابط رجوع).

## 5) بوّابة Onboarding في `AppShell`

تعديل `src/components/layout/AppShell.tsx`:

- استخدام `useQuery(profileQueryOptions(piUid))`.
- منطق التوجيه (مع منع الـ flicker بانتظار `isLoading`):
  - مستخدم بدون session → `/auth` (موجود).
  - session موجود + `profile.onboarded_at == null` + المسار ليس `/auth` ولا `/onboarding` → `navigate('/onboarding')`.
  - مستخدم onboarded يفتح `/onboarding` → إعادة توجيه لـ `/`.

## 6) دعم الدولة في `post-task.tsx`

- جلب `profile.country` كقيمة افتراضية.
- إضافة `<Select>` للدولة في الخطوة 2 (قابل للتغيير).
- إرسال `country` ضمن `task` للمسار الخادمي.
- تحديث `src/routes/api.public.tasks-create.ts`: قبول `country` (تحقق ISO-2 من القائمة) وإدراجه في `taskRow`.
- تحديث `TaskRow` في `src/lib/supabase/types.ts` لإضافة `country: string | null`.

## 7) فلترة الصفحة الرئيسية حسب الدولة

في `src/routes/index.tsx`:

- جلب `profile?.country`.
- حالة محلية `showAllCountries` (افتراضي `false`).
- تعديل `filterTasks` (في `queries.ts`) لقبول معامل اختياري `countryFilter`:
  ```ts
  if (countryFilter) tasks = tasks.filter(t => t.country === countryFilter);
  ```
- مفتاح `<Switch>` بجانب فلتر الفئات: عنوان "كل الدول".
- إذا لا يوجد `country` للمستخدم → يعرض الكل تلقائياً (لا فلتر).

## 8) مبدّل اللغة المحفوظ

تعديل `src/components/layout/AppHeader.tsx`:

- `toggleLang` يستمر في تحديث `i18n` و `localStorage` (للضيوف وعدم الـ flicker).
- إضافة: إذا كانت `session` موجودة، استدعاء `/api/public/profile-update` بـ `{ preferred_lang: next }` في الخلفية (fire-and-forget، لا توقف التبديل).
- في `PiAuthProvider` بعد جلب الـ profile (نضيف query صغير) أو في `AppShell` (الذي يجلبه فعلاً): إذا `profile.preferred_lang` يختلف عن `i18n.language`، نطبّقه مرة واحدة عند الدخول.

## 9) i18n: استعداد للتوسّع

البنية الحالية `src/lib/i18n/locales/<lang>.json` كافية. نوثّق نقطة التوسعة بتعليق في `config.ts`:

```ts
// لإضافة لغة جديدة:
//  1) أنشئ src/lib/i18n/locales/<lang>.json
//  2) أضِفها إلى resources و supportedLngs أدناه
//  3) (اختياري) أضِفها إلى DirectionProvider لو كانت RTL
```

ولا توجد لغات جديدة الآن — `ar`/`en` فقط كما طُلب.

إضافة المفاتيح الجديدة لكلا الملفين:
- `onboarding.{title,subtitle,fullName,email,address,country,save,success,emailInvalid,fieldRequired}`
- `home.allCountries`, `home.myCountry`
- `post.country`, `task.country`
- `profile.country`, `profile.lang`

---

## الملفات

```text
NEW:
  src/lib/data/countries.ts
  src/routes/onboarding.tsx
  src/routes/api.public.profile-update.ts
  supabase/migrations/<ts>_profiles_onboarding_and_country.sql

EDIT:
  src/components/layout/AppShell.tsx          (بوّابة onboarding)
  src/components/layout/AppHeader.tsx         (حفظ تفضيل اللغة)
  src/routes/index.tsx                        (Switch + فلتر دولة)
  src/routes/post-task.tsx                    (Select الدولة)
  src/routes/profile.tsx                      (عرض/تعديل الدولة عبر زر "تعديل" يفتح onboarding كنموذج تعديل)
  src/routes/api.public.tasks-create.ts       (قبول country)
  src/lib/supabase/queries.ts                 (filterTasks يدعم country)
  src/lib/supabase/types.ts                   (حقول جديدة في ProfileRow + TaskRow)
  src/lib/i18n/locales/ar.json
  src/lib/i18n/locales/en.json
  src/lib/i18n/config.ts                      (تعليق توسّع فقط)
```

## كيف نتحقق

1. تطبيق الـ migration.
2. مستخدم جديد → بعد تسجيل الدخول يُحوَّل تلقائياً إلى `/onboarding`، ولا يستطيع الوصول لأي صفحة حتى يكمل البيانات.
3. بعد الحفظ → الصفحة الرئيسية تُظهر فقط مهام دولته، مع `Switch` يكشف "كل الدول".
4. نشر مهمة → الدولة محفوظة وتظهر للمستخدمين من نفس الدولة فقط.
5. تبديل اللغة من الهيدر → يحفظ في `profiles.preferred_lang` ويُطبَّق تلقائياً عند تسجيل الدخول من جهاز آخر.
