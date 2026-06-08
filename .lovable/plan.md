## خطة الإصلاح الشامل

### 1) إصلاح "تعذّر حفظ العرض" (`api.public.bids-create.ts`)
- **السبب:** السطر `task_id: Number(taskId)` يحوّل UUID النصّي إلى `NaN`، فيرفض Postgres الإدراج.
- **الإصلاح:**
  - استبدال `Number(taskId)` بـ `taskId` كسلسلة (UUID).
  - التحقق من صيغة UUID عبر regex.
  - إضافة `verifyPiToken(accessToken)` ومطابقة `identity.uid === bidderPiUid`.
  - استدعاء `ensureProfile` قبل الإدراج (لتفادي خطأ FK).
  - عند فشل الإدراج، إرجاع تفاصيل PostgREST عندما `ALLOW_DEV_MODE=true` (نفس نمط `tasks-create`).

### 2) إصلاح "تعذّر إنشاء ملف المستخدم" (`api.public.pi-verify.ts`)
- **السبب المحتمل:** الإدراج يمرّر أعمدة قد لا توجد في جدول `profiles` (`full_name`, `rating`, `balance`) → 400/PGRST204.
- **الإصلاح:**
  - استبدال الإدراج اليدوي بـ `ensureProfile(env, identity)` من `piVerify.server.ts` (يدرج فقط `pi_uid`, `username`, `avatar_seed`, `updated_at` ويتعامل مع 409).
  - بعد `ensureProfile.ok`، إعادة قراءة الصف عبر `select=*` وإرجاعه.
  - رسائل عربية مع `details` في وضع التطوير.

### 3) صفحة تعديل الملف الشخصي `/profile/edit`
- **ملف جديد:** `src/routes/profile.edit.tsx` (URL: `/profile/edit`).
- نموذج يحتوي: `username`، `avatar` (رفع إلى bucket `avatars`)، `address`، `country` (Select من `COUNTRIES`).
- تعبئة افتراضية من `profileQueryOptions(piUid)`.
- عند الحفظ: استدعاء `api/public/profile-update` ثم `queryClient.invalidateQueries` والعودة إلى `/profile`.
- في `profile.tsx`: تحويل زر "تعديل" إلى `<Link to="/profile/edit">` (بدلاً من `/onboarding`).
- إضافة مفاتيح ترجمة `profile.editTitle`, `profile.save` في `ar.json` و `en.json`.

### 4) حقل الموعد النهائي يقبل أي نص
- الواجهة (`post-task.tsx`) تستخدم `<Input>` نصياً بالفعل — جيد.
- التحقق في `tasks-create.ts` يستخدم `clampStr(t.deadline, 200)` — جيد.
- **الإجراء:** التأكد من أن عمود `tasks.deadline` نوعه `text` (وليس `date`). إذا كان `date`/`timestamp`، إنشاء migration لتحويله إلى `text` لقبول أي صيغة (مثل "خلال أسبوع"، "2026-07-01"، "نهاية الشهر").
- تحديث `placeholder` ليوضّح: "أي صيغة، مثل: خلال أسبوع، 2026-07-01".

### 5) مزامنة GitHub
- مزامنة Lovable ↔ GitHub تلقائية بالكامل عند ربط المستودع — جميع التغييرات تُدفع تلقائياً بعد كل تعديل.
- لا حاجة لأي إجراء يدوي. إذا لم يكن المستودع مربوطاً، يمكن للمستخدم ربطه عبر قائمة (+) → GitHub → Connect project.

### الملفات المُعدّلة
- `src/routes/api.public.bids-create.ts` (إصلاح UUID + Pi verify + ensureProfile)
- `src/routes/api.public.pi-verify.ts` (استخدام ensureProfile)
- `src/routes/profile.edit.tsx` (ملف جديد)
- `src/routes/profile.tsx` (ربط زر التعديل)
- `src/routes/post-task.tsx` (تحسين placeholder فقط)
- `src/lib/i18n/locales/ar.json` و `en.json`
- Migration: `alter table tasks alter column deadline type text` (إن لزم)
