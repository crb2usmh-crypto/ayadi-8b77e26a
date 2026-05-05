## خطة: حذف وتعديل المهام في "أيادي"

سأضيف إمكانية حذف المهام وتعديلها مع القيود المطلوبة (المالك فقط، حالة "مفتوحة" فقط).

### 1. مسارات الخادم (Server Routes)

**`src/routes/api.public.tasks-delete.ts`** (جديد)
- استقبال `{ accessToken, taskId }` عبر POST.
- التحقق من رمز Pi باستخدام `verifyPiToken` من `@/lib/server/piVerify`.
- جلب المهمة من Supabase عبر `SUPABASE_SERVICE_ROLE_KEY` والتحقق من:
  - `owner_pi_uid === piUid` → وإلا 403 ("ليس لديك صلاحية لحذف هذه المهمة").
  - `status === "open"` → وإلا 409 ("لا يمكن حذف مهمة قيد التنفيذ أو مكتملة").
- تنفيذ `DELETE` على `/rest/v1/tasks?id=eq.{taskId}`.
- إرجاع `{ success: true }`.

**`src/routes/api.public.tasks-update.ts`** (جديد)
- استقبال `{ accessToken, taskId, task: {...} }` عبر POST.
- نفس تحققات Pi + الملكية + الحالة "مفتوحة".
- التحقق من الحقول (نفس قواعد `tasks-create`): `title`, `description`, `category`, `budget`, `location`, `deadline`, `country` — كلها اختيارية في PATCH جزئي مع نفس قيود الطول.
- تنفيذ `PATCH` على `/rest/v1/tasks?id=eq.{taskId}` مع `Prefer: return=representation`.
- إرجاع `{ task }`.

كلاهما يستخدم `adminHeaders` من `piVerify.ts` ويعرض الأخطاء بالعربية مع `withDetails` المُحكم بـ `ALLOW_DEV_MODE`.

### 2. صفحة تعديل المهمة

**`src/routes/tasks.$taskId.edit.tsx`** (جديد) — مسار `/tasks/$taskId/edit`
- في `loader`: تحميل المهمة عبر `taskQueryOptions`.
- في المكوّن: التحقق من أن المستخدم مالك وأن الحالة `open`؛ وإلا `toast.error` + `navigate` للرجوع لصفحة التفاصيل.
- نموذج بنفس حقول `post-task.tsx` (عنوان، فئة، وصف، ميزانية، موقع، دولة، موعد نهائي) لكن مملوء مسبقاً ببيانات المهمة الحالية.
- زر "حفظ التغييرات" → POST إلى `/api/public/tasks-update`.
- عند النجاح: `invalidateQueries(["tasks"])` + `toast.success("تم تحديث المهمة بنجاح")` + `navigate({ to: "/tasks/$taskId", params: { taskId } })`.

ملاحظة: حقل "الوسوم" المذكور في الطلب غير موجود في الـ schema الحالي (`TaskRow` لا يحتوي على `tags`)، لذا سأكتفي بالحقول القابلة للتعديل فعلياً. إضافة الوسوم لاحقاً تتطلب migration للـ DB.

### 3. تعديلات صفحة تفاصيل المهمة

**`src/routes/tasks.$taskId.tsx`**
- إضافة قسم "إجراءات المالك" في الـ aside، يظهر فقط عند `isLoggedIn && isOwner && task.status === "open"`:
  - زر **"تعديل المهمة"** (`Pencil`) → `<Link to="/tasks/$taskId/edit">`.
  - زر **"حذف المهمة"** (`variant="destructive"`, `Trash2`) ملفوف بـ `AlertDialog`:
    - العنوان: "هل أنت متأكد من حذف هذه المهمة؟"
    - الوصف: "لا يمكن التراجع عن هذا الإجراء."
    - أزرار: "إلغاء" / "حذف".
    - عند التأكيد: `useMutation` يستدعي `/api/public/tasks-delete`، ثم `invalidateQueries(["tasks"])` + `toast.success("تم حذف المهمة بنجاح")` + `navigate({ to: "/" })`.

### 4. الترجمات

إضافة مفاتيح إلى `src/lib/i18n/locales/ar.json` و `en.json`:
- `task.editTask`, `task.deleteTask`
- `task.deleteConfirmTitle`, `task.deleteConfirmDesc`
- `task.deleteSuccess`, `task.updateSuccess`
- `task.editPageTitle`, `task.saveChanges`, `task.saving`
- `common.cancel`, `common.delete` (إذا لم تكن موجودة)

### الملفات المتأثرة

- جديد: `src/routes/api.public.tasks-delete.ts`
- جديد: `src/routes/api.public.tasks-update.ts`
- جديد: `src/routes/tasks.$taskId.edit.tsx`
- تعديل: `src/routes/tasks.$taskId.tsx` (أزرار المالك + AlertDialog)
- تعديل: `src/lib/i18n/locales/ar.json` و `en.json`

### الأمان

- جميع التحققات (الملكية + الحالة) تتم على الخادم بعد التحقق من رمز Pi، وليس على العميل فقط.
- إخفاء الأزرار في الواجهة هو UX فقط؛ الخادم يرفض أي طلب غير مصرّح به برمز 403/409.
