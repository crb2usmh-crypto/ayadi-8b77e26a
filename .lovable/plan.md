## التشخيص

- المسار `src/routes/api.public.tasks-create.ts` يستدعي `ensureProfile` التي تنفّذ `upsert` بـ `Prefer: resolution=merge-duplicates,return=minimal` على `profiles?on_conflict=pi_uid`.
- إذا فشل الـ upsert (بسبب قيد NOT NULL، عمود مفقود مثل `display_name`، أو سياسة RLS تمنع حتى service-role في حالة شاذة)، يرجع المسار رسالة عامة "تعذّر إنشاء ملف المستخدم" بدون سبب.
- الحل المطلوب: استبدال نمط "upsert الأعمى" بنمط **check-then-insert**: أولاً قراءة الصف بـ `pi_uid`، وإن لم يوجد إنشاؤه بـ service role مع تمرير تفاصيل الخطأ إلى الواجهة عند الفشل.

## التغييرات المخطّط لها

### 1) `src/lib/server/piVerify.ts` — إعادة كتابة `ensureProfile`

استبدال upsert بآلية ثلاث خطوات واضحة، كل خطوة لها رسالة خطأ مميّزة:

1. **GET** على `${url}/rest/v1/profiles?pi_uid=eq.<uid>&select=pi_uid&limit=1` بـ service-role.
   - فشل الشبكة/الاستعلام → `{ ok:false, status:502, detail:"profile_lookup_failed: <body>" }`.
2. إذا الصف موجود → `{ ok:true, created:false }` فورًا.
3. خلاف ذلك **POST** على `${url}/rest/v1/profiles` (بدون `on_conflict`) مع `Prefer: return=minimal` ومحتوى:
   ```json
   { "pi_uid": uid, "username": username, "avatar_seed": username, "updated_at": "<iso>" }
   ```
   - عند 409 (تنافس متزامن) نعتبره نجاح: `{ ok:true, created:true }`.
   - عند أي خطأ آخر نقرأ الـ body كنص ونرجعه: `{ ok:false, status, detail:"profile_insert_failed: <code> <message> <hint>" }` بعد محاولة `JSON.parse` لاستخراج `code/message/hint` من PostgREST.
4. كتلة `try/catch` خارجية ترجع `status:500` مع رسالة الاستثناء.

التوقيع الجديد: `Promise<{ ok:true; created:boolean } | { ok:false; status:number; detail:string }>`. المستدعون الآخرون (إن وُجدوا) لن يتأثروا لأن خاصية `ok` تبقى الأساس.

### 2) `src/routes/api.public.tasks-create.ts` — تحسين رسائل الخطأ

تعديل قسم فحص نتيجة `ensureProfile` ليفرّق بين أسباب الفشل:

```ts
const profileResult = await ensureProfile(env, { uid: piUid, username });
if (!profileResult.ok) {
  const isLookup = profileResult.detail.startsWith("profile_lookup_failed");
  const arabic = isLookup
    ? "تعذّر التحقق من ملف المستخدم في قاعدة البيانات"
    : "تعذّر إنشاء ملف المستخدم الجديد";
  console.error("[tasks-create] ensureProfile failed:", profileResult);
  return Response.json(
    withDetails({ error: arabic }, profileResult.detail),
    { status: profileResult.status >= 400 && profileResult.status < 600 ? profileResult.status : 500 },
  );
}
```

`withDetails` كما هو يُلحق `details` فقط حين `ALLOW_DEV_MODE === "true"`، فيرى المطوّر السبب الدقيق (`column "X" violates not-null constraint` مثلًا) بدون كشفه في الإنتاج.

### 3) عدم تغيير المخطط

- لا migrations.
- لا تغيير على `tasks.owner_pi_uid` ولا على RLS.
- لا تغيير على `src/routes/post-task.tsx` — يعرض بالفعل الرسالة العربية + `details` من الاستجابة.

## الملفات التي ستُعدَّل

```text
src/lib/server/piVerify.ts              (إعادة كتابة ensureProfile: lookup → insert)
src/routes/api.public.tasks-create.ts   (رسائل خطأ مفصّلة حسب نوع الفشل)
```

## كيف نتحقق

1. تفعيل `ALLOW_DEV_MODE=true` مؤقتًا في أسرار المشروع.
2. تسجيل الدخول كمطوّر ونشر مهمة:
   - **النجاح**: تُنشأ صفحة المهمة وتُحفظ، ويُسجَّل في خادم `[ensureProfile] created profile for <uid>`.
   - **الفشل**: تظهر رسالة عربية محددة + `details` تحدد العمود/القيد الذي تسبب بالفشل، فنعالجه فورًا.
3. بعد التأكد، تعطيل `ALLOW_DEV_MODE` في الإنتاج.