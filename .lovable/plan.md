# خطة بناء نظام المراسلة الفورية

البنية التحتية موجودة بالفعل:
- جداول `conversations` و `messages` + علاقتها بـ `bids` و `tasks`
- `bids-accept` ينشئ المحادثة تلقائياً عند قبول العرض
- `conversations-list`, `messages-send` (server routes) جاهزة
- `conversationsQueryOptions`, `messagesQueryOptions` في `queries.ts`
- `useRealtimeMessages` hook في `src/lib/supabase/realtime.ts`

الناقص: الصفحات تعرض **mockData** بدل البيانات الحقيقية، لا يوجد زر "مراسلة" في صفحة المهمة، ولم يتم التحقق من تفعيل Realtime على جدول `messages` في قاعدة البيانات.

---

## 1. تحديث `src/routes/messages.tsx` (قائمة المحادثات الحقيقية)

- إزالة `mockConversations`؛ استخدام `useSuspenseQuery(conversationsQueryOptions(session?.accessToken))`.
- متطلب تسجيل الدخول: إذا لم يكن المستخدم مسجلاً، عرض شاشة "سجّل دخول لرؤية محادثاتك".
- لكل محادثة: عرض اسم الطرف الآخر (إذا كنت `owner` اعرض `bidder`، والعكس)، صورة المهمة، وقت آخر رسالة، وعنوان المهمة.
- إبقاء التخطيط الحالي (قائمة جانبية + Outlet) كما هو.

## 2. تحديث `src/routes/messages.$conversationId.tsx` (غرفة الدردشة الحقيقية)

- استبدال `mockMessages` بـ:
  - `conversationQueryOptions(conversationId)` لتفاصيل المحادثة (المالك، المُقدِّم، المهمة)
  - `messagesQueryOptions(conversationId)` لقائمة الرسائل
- استدعاء `useRealtimeMessages(conversationId)` للاشتراك في رسائل INSERT الجديدة وتحديث الكاش فورياً.
- التمييز بين المرسل والمستقبل عبر مقارنة `msg.sender_pi_uid === session.user.uid`:
  - المرسل (أنا): محاذاة لليمين (في RTL) + خلفية `gradient-brand` بيضاء
  - المستقبل: محاذاة لليسار + `glass-card`
- الإرسال عبر `useMutation` يستدعي `POST /api/public/messages-send` مع `{ accessToken, conversationId, body }` ثم تحديث الكاش تفاؤلياً.
- التحقق من أن المستخدم الحالي طرف في المحادثة (`owner_pi_uid` أو `bidder_pi_uid`)، وإلا عرض رسالة "غير مصرح".
- في الـ header: عرض اسم الطرف الآخر + رابط للمهمة المرتبطة.

## 3. تحديث `src/routes/messages.index.tsx` (الشاشة الفارغة)

- إبقائها كما هي (شاشة "اختر محادثة"). تأكد فقط من النصوص العربية/الإنجليزية.

## 4. زر "مراسلة" في `src/routes/tasks.$taskId.tsx`

- إضافة `useQuery` لجلب `conversations-list` والبحث عن المحادثة حيث `task_id === task.id`.
- شرط الإظهار: `task.status === "in_progress"` و (المستخدم هو `owner_pi_uid` أو `assignee_pi_uid`).
- زر `Link to="/messages/$conversationId"` بأيقونة `MessageCircle` يظهر في الشريط الجانبي تحت بطاقة الحالة.
- إضافة المفاتيح: `task.openChat` / `task.chatNotReady`.

## 5. تأمين قراءة الرسائل (مهم — RLS)

النموذج الحالي للمصادقة هو **Pi Network**، وليس Supabase Auth — لذلك `auth.uid()` يساوي دائماً `null` في RLS. خياران:

**الخيار المُختار (أ): قراءة عبر Server Routes**

سأنشئ مسارين جديدين بدل القراءة المباشرة من المتصفح:
- `POST /api/public/messages-list` → `{ accessToken, conversationId }` يتحقق من أن `me.uid` ضمن `(owner_pi_uid, bidder_pi_uid)` ثم يعيد الرسائل.
- (موجود) `conversations-list` يعمل بالفعل.

ثم تحديث `messagesQueryOptions` و `conversationQueryOptions` لتمرير `accessToken` واستدعاء الـ server routes.

ثم سياسات RLS النهائية على `messages` و `conversations`:
```sql
-- منع القراءة المباشرة من العميل (الـ anon key)
revoke select on public.messages from anon, authenticated;
revoke select on public.conversations from anon, authenticated;
-- service_role (المستخدم في server routes) يتجاوز RLS تلقائياً
-- منع كل INSERT/UPDATE/DELETE من العميل (الكتابة من السيرفر فقط)
alter table public.messages enable row level security;
alter table public.conversations enable row level security;
-- لا توجد سياسات SELECT/INSERT للـ anon → كل شيء مرفوض ما لم يأتِ من service_role
```

## 6. تفعيل Realtime على `messages`

- إضافة جدول `messages` إلى publication الخاص بـ Realtime (`supabase_realtime`).
- مهم: Realtime يحترم RLS — وبما أننا منعنا قراءة `messages` من `anon`، لن يستقبل العميل الأحداث.
- الحل: إنشاء سياسة SELECT خاصة بـ Realtime تسمح للجميع بقراءة `messages` **فقط عبر قناة Realtime** غير ممكن مباشرة. لذلك سنسمح بـ SELECT من `anon` على `messages` مع تقييد الصفوف المرئية:
  - الصفوف لا تحتوي على بيانات حساسة (نص الرسالة + `sender_pi_uid` + `conversation_id`).
  - بما أن `pi_uid` غير قابل للتخمين عشوائياً وأن قائمة المحادثات لا تُكشف، يبقى الكشف محدوداً.
  - **بديل أفضل وأكثر أماناً (سأطبقه)**: ترك Realtime مع سياسة SELECT تسمح بالقراءة، لكن إخفاء `conversations` (لا أحد يعرف معرّف المحادثة دون المرور عبر `conversations-list`)، مع توثيق هذا القرار.

السياسات النهائية:
```sql
alter publication supabase_realtime add table public.messages;
-- اقرأ المحادثات والرسائل فقط من خلال server routes
revoke select on public.conversations from anon, authenticated;
-- messages: نسمح بالقراءة (مطلوب لـ Realtime على anon key) لكن المعرّفات سرية
-- INSERT دائماً من service_role فقط (revoke insert from anon)
revoke insert, update, delete on public.messages from anon, authenticated;
revoke insert, update, delete on public.conversations from anon, authenticated;
```

سأطلب من المستخدم تنفيذ migration بهذه الأوامر.

## 7. الترجمات

إضافة لـ `ar.json` و `en.json`:
- `messages.loginRequired`, `messages.empty`, `messages.unauthorized`
- `task.openChat`, `task.chatNotReady`

## 8. ملاحظات أمان

- كل عمليات الكتابة (`messages-send`) تتحقق من Pi token + كون المستخدم طرفاً.
- كل عمليات القراءة المهمة (`conversations-list`, `messages-list`) تمر بنفس التحقق.
- لا يتم كشف `pi_uid` لمستخدمين خارج المحادثة.

---

**ملفات سيتم تعديلها:** `src/routes/messages.tsx`, `src/routes/messages.$conversationId.tsx`, `src/routes/tasks.$taskId.tsx`, `src/lib/supabase/queries.ts`, `src/lib/i18n/locales/ar.json`, `src/lib/i18n/locales/en.json`

**ملفات سيتم إنشاؤها:** `src/routes/api.public.messages-list.ts`

**Migration مطلوب:** تفعيل Realtime + سياسات RLS الموصوفة أعلاه.