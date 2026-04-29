## الخطة: نظام التقييم في "أيادي"

ملاحظة مهمة: المهام حاليًا تنتقل من `open` → `in_progress` فقط (عبر قبول العرض). لا يوجد إجراء يحوّل المهمة إلى `completed`. بدون ذلك، شرط ظهور قسم التقييم لن يتحقق أبدًا. لذلك أُضيف خطوة "إنهاء المهمة" قبل خطوة التقييم.

---

### 1) قاعدة البيانات (Migration)

إنشاء جدول `reviews`:

```sql
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_pi_uid text not null,
  reviewee_pi_uid text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (task_id, reviewer_pi_uid)  -- كل مستخدم يقيّم مرة واحدة لكل مهمة
);

create index reviews_reviewee_idx on public.reviews(reviewee_pi_uid, created_at desc);
create index reviews_task_idx on public.reviews(task_id);

alter table public.reviews enable row level security;

-- قراءة عامة (متوافق مع نمط profiles/tasks الحالي)
create policy "reviews_select_all" on public.reviews
  for select to anon, authenticated using (true);

-- الكتابة: عبر service-role فقط من خلال /api/public/reviews-create
-- (المصادقة هي Pi Network وليست Supabase auth، لذلك لا توجد سياسة insert للعميل)
```

ملاحظة: الكتابة تتم حصرًا من خادم TanStack باستخدام service-role بعد التحقق من Pi access token — تمامًا كما تعمل bids/messages/notifications.

تحديث متوسط التقييم على `profiles.rating` بعد كل تقييم جديد عبر استعلام جانب الخادم (اختيار: تحديث مباشر من API بعد الإدراج، بدون تريغرات DB حفاظًا على البساطة).

---

### 2) إنهاء المهمة (متطلب مسبق للتقييم)

**Endpoint جديد**: `src/routes/api.public.tasks-complete.ts`
- Body: `{ accessToken, taskId }`
- شروط: المتصل = صاحب المهمة، الحالة الحالية = `in_progress`.
- التأثير: `tasks.status = "completed"` + إشعار للمنفذ + زيادة `profiles.completed_tasks` للمنفذ.

**واجهة**: في `src/routes/tasks.$taskId.tsx`، إذا كانت `status === "in_progress"` و`isOwner`، إظهار زر "إنهاء المهمة" (مع AlertDialog للتأكيد).

---

### 3) Endpoints التقييم

**`src/routes/api.public.reviews-create.ts`** (POST)
- Body: `{ accessToken, taskId, rating (1-5), comment? }`
- تحقّق:
  - المهمة موجودة وحالتها `completed`.
  - المتصل إما `owner_pi_uid` أو `assignee_pi_uid` للمهمة.
  - `reviewee` يُحدد تلقائيًا = الطرف الآخر.
  - `unique(task_id, reviewer_pi_uid)` يمنع التكرار (نُرجع 409 إذا حدث).
- بعد الإدراج: حساب متوسط جديد لـ `reviewee` وتحديث `profiles.rating`.
- إرسال إشعار للمُقيَّم.

**`src/routes/api.public.reviews-list.ts`** (POST)
- Body: `{ revieweePiUid, limit? }` — قراءة عامة، لا تتطلب مصادقة.
- يُرجع قائمة `ReviewWithReviewer[]` (آخر N، افتراضي 10) + `average` + `count`.

**`src/routes/api.public.reviews-for-task.ts`** (POST)
- Body: `{ accessToken, taskId }` — يُرجع المراجعات على هذه المهمة + علم `myReviewSubmitted` لتحديد ما إذا كان المتصل قد قيّم بالفعل.

---

### 4) الأنواع والاستعلامات (Frontend)

**`src/lib/supabase/types.ts`**: إضافة
```ts
export interface ReviewRow { id; task_id; reviewer_pi_uid; reviewee_pi_uid; rating; comment; created_at; }
export interface ReviewWithReviewer extends ReviewRow { reviewer: ProfileRow | null; }
```

**`src/lib/supabase/queries.ts`**: إضافة
- `reviewsForUserQueryOptions(piUid)` — يستدعي `/api/public/reviews-list`.
- `reviewsForTaskQueryOptions(taskId, accessToken)` — يستدعي `/api/public/reviews-for-task`.

---

### 5) مكوّن التقييم التفاعلي

**`src/components/common/StarRating.tsx`** (جديد):
- Props: `value, onChange?, size?, readonly?`.
- 5 أيقونات `Star` من lucide-react مع hover state و aria-labels.
- يدعم RTL.

**`src/components/common/ReviewForm.tsx`** (جديد):
- يستخدم `StarRating` + `Textarea` للتعليق + زر إرسال.
- يستدعي `/api/public/reviews-create` عبر `useMutation`.
- بعد النجاح: confetti + toast + invalidate queries.

**`src/components/common/ReviewsList.tsx`** (جديد):
- يعرض avatar + اسم المُقيِّم + النجوم + التعليق + التاريخ.

---

### 6) دمج في صفحة المهمة `tasks.$taskId.tsx`

داخل العمود الرئيسي (md:col-span-2)، إضافة `<ReviewSection />` يظهر فقط إذا:
- `task.status === "completed"` و
- المتصل = owner أو assignee.

السلوك:
- تحميل `reviewsForTaskQueryOptions`.
- إذا `myReviewSubmitted === false` → عرض `<ReviewForm taskId={task.id} revieweePiUid={otherParty} />`.
- إذا `true` → عرض رسالة "شكرًا، تم إرسال تقييمك".
- أسفل ذلك: عرض المراجعات المُقدَّمة على هذه المهمة (إن وُجدت).

كذلك إضافة زر "إنهاء المهمة" في sidebar (إذا `isOwner && status === "in_progress"`).

---

### 7) دمج في صفحة الملف الشخصي `profile.tsx`

- استبدال `rating` المعروض حاليًا (الذي يأتي من `profiles.rating`) بقيمة محسوبة من `reviewsForUserQueryOptions(piUid)` (`average` + `count`).
- عرض عدد المراجعات بجانب المتوسط: مثلًا "4.7 ★ (12 تقييم)".
- في تبويب `reviews` (موجود لكنه فارغ حاليًا): عرض `<ReviewsList reviews={reviews} />` بدلًا من `EmptyMsg`.

---

### 8) ترجمات

إضافة مفاتيح في `src/lib/i18n/locales/ar.json` و`en.json`:
- `task.completeTask`, `task.completeConfirmTitle/Desc`, `task.completed`.
- `review.title`, `review.rateOther`, `review.placeholder`, `review.submit`, `review.submitting`, `review.thanks`, `review.alreadyReviewed`, `review.noReviews`, `review.ratingRequired`, `review.count`.

---

### الملفات المتأثرة

**جديدة:**
- migration: `supabase/migrations/<timestamp>_reviews.sql`
- `src/routes/api.public.tasks-complete.ts`
- `src/routes/api.public.reviews-create.ts`
- `src/routes/api.public.reviews-list.ts`
- `src/routes/api.public.reviews-for-task.ts`
- `src/components/common/StarRating.tsx`
- `src/components/common/ReviewForm.tsx`
- `src/components/common/ReviewsList.tsx`

**معدّلة:**
- `src/lib/supabase/types.ts`
- `src/lib/supabase/queries.ts`
- `src/routes/tasks.$taskId.tsx`
- `src/routes/profile.tsx`
- `src/lib/i18n/locales/{ar,en}.json`

---

### تفاصيل أمنية

- جميع عمليات الكتابة تمر عبر endpoints تتحقق من Pi access token عبر `verifyPiToken` (نفس النمط الحالي).
- `unique(task_id, reviewer_pi_uid)` يمنع تكرار التقييمات على مستوى DB.
- `rating` مقيّد بين 1-5 على مستوى DB (`check`).
- `comment` محدود بـ 1000 حرف.
- RLS: قراءة عامة فقط، الكتابة عبر service-role من الخادم — لا يوجد منفذ كتابة من المتصفح مباشرة.
- يتم التأكد من أن المُقيِّم طرف فعلي في المهمة (owner أو assignee) قبل القبول.

---

### ملاحظة للمستخدم

سأقوم بإنشاء migration للجدول الجديد، وستحتاج للموافقة على تشغيله عند طلب ذلك. باقي التغييرات (الكود) ستُطبَّق تلقائيًا بعد موافقتك على هذه الخطة.