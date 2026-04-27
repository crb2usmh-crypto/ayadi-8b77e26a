
## السياق

البنية التحتية للعروض **جاهزة بالكامل من الجولة السابقة**:

- ✅ جدول `bids` في Supabase + `tasks.accepted_bid_id` و `assignee_pi_uid`
- ✅ `POST /api/public/bids-create` — إنشاء/تحديث عرض مع التحقق من Pi token
- ✅ `POST /api/public/bids-list` — جلب العروض (المالك يرى الكل، المزايد يرى عرضه فقط)
- ✅ `POST /api/public/bids-accept` — قبول عرض → تغيير حالة المهمة لـ `in_progress` ورفض الباقي
- ✅ `bidsForTaskQueryOptions(taskId, accessToken)` في `queries.ts`

**الناقص فقط**: ربط واجهة المستخدم في `src/routes/tasks.$taskId.tsx`. النموذج الحالي للعرض موجود لكنه يطلق confetti فقط بدون استدعاء API. المراسلة **خارج النطاق** كما طلبت.

---

## التغييرات المطلوبة

### 1. `src/routes/tasks.$taskId.tsx` — ربط زر "تقديم عرض" بـ API

- استيراد `usePiAuth` و `useMutation` و `useQueryClient`
- قراءة الجلسة: إذا لم يكن هناك `session` → إخفاء زر "قدّم عرضك" واستبداله برسالة "سجّل دخولك بـ Pi لتقديم عرض" + رابط `/auth`
- إذا كان `session.user.uid === task.owner_pi_uid` → إخفاء الزر (المالك لا يقدم عرضاً على مهمته)
- إذا كانت `task.status !== "open"` → إخفاء الزر وإظهار شارة "المهمة لم تعد مفتوحة"
- تحويل `handleSubmitOffer` لاستخدام `useMutation` يستدعي:
  ```ts
  fetch("/api/public/bids-create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: session.accessToken,
      taskId: task.id,
      amount: Number(amount),
      message: message || undefined,
    }),
  })
  ```
- ربط حقول `Input` و `Textarea` بـ `useState` (`amount`, `message`) بدلاً من `defaultValue` غير المُتحكَم به
- عند النجاح: `confetti` + `toast.success` + `queryClient.invalidateQueries({ queryKey: ["bids", task.id] })` + `router.invalidate()` لتحديث `offers_count`
- عند الفشل: `toast.error(error.message)` + إبقاء النافذة مفتوحة

### 2. `src/routes/tasks.$taskId.tsx` — قسم جديد "العروض المقدمة" (للمالك فقط)

أسفل الوصف، أضف قسماً يظهر فقط إذا `session?.user.uid === task.owner_pi_uid`:

- استخدام `useQuery(bidsForTaskQueryOptions(task.id, session.accessToken))`
- عرض القائمة كبطاقات (`glass-card`) لكل عرض:
  - صورة المزايد (`getAvatarUrl(bidder.avatar_seed)`) + اسمه + تقييمه
  - المبلغ المعروض + العملة
  - الرسالة (إن وُجدت)
  - شارة الحالة: `pending` → "قيد المراجعة" / `accepted` → "مقبول ✓" / `rejected` → "مرفوض"
  - زر **"قبول"** يظهر فقط إذا `bid.status === "pending"` و `task.status === "open"`
- عند النقر على "قبول":
  ```ts
  fetch("/api/public/bids-accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: session.accessToken, bidId: bid.id }),
  })
  ```
- استخدام `AlertDialog` كتأكيد قبل الإرسال ("هل تريد قبول هذا العرض؟ سيتم رفض باقي العروض تلقائياً.")
- عند النجاح: `toast.success("تم قبول العرض")` + إبطال كاش العروض والمهمة
- حالات فارغة: "لا توجد عروض حتى الآن" مع أيقونة

### 3. `src/lib/i18n/locales/ar.json` و `en.json` — مفاتيح ترجمة جديدة

إضافة تحت `task`:

```json
"loginToBid": "سجّل دخولك بـ Pi لتقديم عرض",
"taskClosed": "هذه المهمة لم تعد مفتوحة",
"ownTaskHint": "لا يمكنك تقديم عرض على مهمتك",
"submitting": "جارٍ الإرسال...",
"offers Section": "العروض المقدمة",
"noOffers": "لا توجد عروض حتى الآن",
"acceptOffer": "قبول",
"acceptConfirmTitle": "قبول هذا العرض؟",
"acceptConfirmDesc": "ستتغير حالة المهمة إلى \"قيد التنفيذ\" وسيُرفض باقي العروض تلقائياً.",
"acceptSuccess": "تم قبول العرض بنجاح 🎉",
"bidStatus": {
  "pending": "قيد المراجعة",
  "accepted": "مقبول",
  "rejected": "مرفوض"
},
"taskStatus": {
  "open": "مفتوحة",
  "in_progress": "قيد التنفيذ",
  "completed": "مكتملة",
  "cancelled": "ملغاة"
}
```

والمكافئ بالإنجليزية.

---

## ما هو خارج النطاق (كما طلبت)

- ❌ **لا** بناء واجهة المراسلة (موجودة backend لكنها لن تُربط بـ UI الآن)
- ❌ **لا** إعادة توجيه إلى المحادثة بعد قبول العرض — فقط toast + تحديث الواجهة
- ❌ **لا** تعديل على schema قاعدة البيانات (كل شيء جاهز)
- ❌ **لا** API routes جديدة

---

## الملفات التي ستُعدَّل

| الملف | نوع التعديل |
|---|---|
| `src/routes/tasks.$taskId.tsx` | تعديل رئيسي — ربط النموذج + إضافة قسم العروض |
| `src/lib/i18n/locales/ar.json` | إضافة مفاتيح |
| `src/lib/i18n/locales/en.json` | إضافة مفاتيح |

لا ملفات جديدة. لا migrations.

---

## معايير القبول

1. مستخدم غير مسجّل يفتح المهمة → يرى "سجّل دخولك بـ Pi" بدلاً من زر العرض.
2. مستخدم مسجّل (غير المالك) يضغط "قدّم عرضك" → نافذة → إدخال المبلغ والرسالة → إرسال → toast نجاح → سطر `offers_count` يزيد.
3. مالك المهمة يفتح صفحته → يرى قسم "العروض المقدمة" مع كل العروض وأزرار "قبول".
4. الضغط على "قبول" → تأكيد → بعد النجاح: حالة المهمة تصبح `in_progress`، العرض المقبول يحمل شارة "مقبول"، الباقي "مرفوض"، وزر "قدّم عرضك" يختفي للجميع.
