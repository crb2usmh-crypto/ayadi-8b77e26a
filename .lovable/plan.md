
# خطة تفعيل السوق في "أيادي"

سنبني ثلاث ميزات مترابطة فوق البنية الحالية (Pi Auth + TanStack Start + Supabase service-role من الخادم). كل الكتابات تمر عبر مسارات `/api/public/*` بعد التحقق من `accessToken` من Pi Network — تماماً كما هو الحال مع `tasks-create` و`pi-verify`.

---

## 1. مخطط قاعدة البيانات (SQL Migration)

سنضيف ثلاثة جداول جديدة + توسعة `tasks`:

```sql
-- توسعة جدول tasks
ALTER TABLE public.tasks
  ADD COLUMN accepted_bid_id UUID NULL,
  ADD COLUMN assignee_pi_uid TEXT NULL REFERENCES public.profiles(pi_uid);

-- جدول العروض
CREATE TYPE public.bid_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');

CREATE TABLE public.bids (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  bidder_pi_uid   TEXT NOT NULL REFERENCES public.profiles(pi_uid),
  amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  message         TEXT,
  status          public.bid_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, bidder_pi_uid)  -- عرض واحد لكل مستخدم لكل مهمة
);

-- جدول المحادثات (واحدة لكل عرض مقبول)
CREATE TABLE public.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  bid_id          UUID NOT NULL UNIQUE REFERENCES public.bids(id) ON DELETE CASCADE,
  owner_pi_uid    TEXT NOT NULL REFERENCES public.profiles(pi_uid),
  bidder_pi_uid   TEXT NOT NULL REFERENCES public.profiles(pi_uid),
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول الرسائل
CREATE TABLE public.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_pi_uid    TEXT NOT NULL REFERENCES public.profiles(pi_uid),
  body             TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_created_idx ON public.messages (conversation_id, created_at);

-- FK المتأخر على tasks.accepted_bid_id (بعد إنشاء bids)
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_accepted_bid_fk
  FOREIGN KEY (accepted_bid_id) REFERENCES public.bids(id) ON DELETE SET NULL;

-- RLS: قراءة عامة للعروض/المحادثات/الرسائل، كل الكتابات عبر service_role من الخادم
ALTER TABLE public.bids           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages       ENABLE ROW LEVEL SECURITY;

-- bids: قراءة عامة (لإظهار عدد العروض). لا توجد سياسة كتابة (anon/auth).
CREATE POLICY "bids_public_read" ON public.bids FOR SELECT USING (true);

-- conversations & messages: قراءة عامة مؤقتاً (يمكن تشديدها لاحقاً عبر JWT مخصص).
-- الحماية الفعلية: لا أحد يستطيع الكتابة بدون المرور بـ /api/public/*
CREATE POLICY "conv_public_read"     ON public.conversations FOR SELECT USING (true);
CREATE POLICY "messages_public_read" ON public.messages      FOR SELECT USING (true);

-- تفعيل Realtime على messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
```

> **ملاحظة أمنية**: قراءة الرسائل عامة في هذه المرحلة لأن عميل Supabase في المتصفح يستخدم anon key بدون جلسة. الحماية الحقيقية أن أحداً لا يستطيع **الكتابة** بدون التحقق من Pi token على الخادم. تشديد القراءة (سياسات RLS تربط بـ pi_uid) يحتاج إصدار JWT مخصص — يمكن إضافته في جولة لاحقة.

---

## 2. مسارات الخادم الجديدة (`src/routes/api.public.*`)

كل المسارات تتبع نفس بنية `tasks-create.ts`: تحقق `accessToken` → استدعاء `/v2/me` → تنفيذ العملية بصلاحية service-role.

### `api.public.bids-create.ts` — POST
- المدخلات: `{ accessToken, taskId, amount, message? }` (مع `zod` للتحقق من الحدود).
- يرفض إذا كان `bidder_pi_uid === task.owner_pi_uid` (لا يمكن تقديم عرض على مهمتك).
- يرفض إذا كانت `task.status !== 'open'`.
- يدرج في `bids` مع `ON CONFLICT (task_id, bidder_pi_uid)` للتحديث (تعديل العرض).
- يزيد `tasks.offers_count` (أو يُحسب تلقائياً عبر تريغر — سنستخدم RPC بسيطة).
- يُدرج إشعاراً لمالك المهمة في `notifications`.

### `api.public.bids-accept.ts` — POST
- المدخلات: `{ accessToken, bidId }`.
- يتحقق أن المتصل هو **مالك** المهمة عبر مطابقة `tasks.owner_pi_uid` مع `me.uid`.
- يتحقق أن `tasks.status === 'open'` و `tasks.accepted_bid_id IS NULL`.
- في معاملة (عبر استدعاءات PostgREST متتابعة):
  1. تحديث `bids.status = 'accepted'` للعرض المختار.
  2. تحديث بقية عروض نفس المهمة إلى `rejected`.
  3. تحديث `tasks`: `status = 'in_progress'`, `accepted_bid_id`, `assignee_pi_uid`.
  4. إنشاء صف في `conversations` يربط (task_id, bid_id, owner, bidder).
  5. إضافة إشعارَين: واحد لمقدم العرض ("قُبل عرضك")، وواحد لكل من تم رفضه (اختياري).
- يعيد `{ conversationId }` ليُوجَّه المالك مباشرةً للمحادثة.

### `api.public.bids-list.ts` — POST
- المدخلات: `{ accessToken, taskId }`.
- يعيد قائمة العروض مع بيانات `bidder` (join مع `profiles`).
- يعيد فقط للمالك أو لمقدم العرض نفسه (التصفية على الخادم بعد التحقق من الهوية).

### `api.public.messages-send.ts` — POST
- المدخلات: `{ accessToken, conversationId, body }` (طول 1..4000).
- يتحقق أن `me.uid` هو إما `owner_pi_uid` أو `bidder_pi_uid` للمحادثة.
- يدرج رسالة + يحدّث `conversations.last_message_at`.
- يُدرج إشعاراً للطرف الآخر.

### `api.public.conversations-list.ts` — POST
- المدخلات: `{ accessToken }`.
- يعيد كل المحادثات حيث `me.uid` طرف فيها، مع آخر رسالة وبيانات الطرف الآخر.

---

## 3. طبقة البيانات (`src/lib/supabase/`)

### تحديث `types.ts`
إضافة `BidRow`, `BidStatus`, `ConversationRow`, `ConversationWithParticipants`, `MessageRow`. توسعة `TaskRow` بـ `accepted_bid_id`, `assignee_pi_uid`.

### تحديث `queries.ts`
- `bidsByTaskQueryOptions(taskId, accessToken)` → `useQuery` يستدعي `/api/public/bids-list`.
- `conversationsQueryOptions(accessToken)` → قائمة المحادثات.
- `messagesQueryOptions(conversationId)` → قراءة مباشرة من `supabase.from('messages')` (RLS عامة للقراءة).
- `conversationQueryOptions(conversationId)` → جلب صف المحادثة + أطرافها.

### ملف جديد `src/lib/supabase/realtime.ts`
hook مخصص `useRealtimeMessages(conversationId)`:
```ts
useEffect(() => {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          queryClient.setQueryData(['messages', conversationId], (old) =>
            [...(old ?? []), payload.new as MessageRow]
          );
        })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [conversationId]);
```

---

## 4. تعديلات الواجهة

### `src/routes/tasks.$taskId.tsx`
- استبدال `Dialog` الحالي (الذي يستدعي `fireConfetti` فقط) بنموذج فعلي يستدعي `/api/public/bids-create`.
- إخفاء زر "تقديم عرض" إذا كان `session.user.uid === task.owner_pi_uid` أو لم تكن هناك جلسة.
- إذا كان المستخدم هو المالك: عرض **قسم جديد "العروض المقدمة"** يحت السايدبار (بطاقات صغيرة فيها صورة المتقدم + اسمه + المبلغ + الرسالة + زر "قبول"). الزر يستدعي `/api/public/bids-accept` ثم يوجّه إلى `/messages/$conversationId`.
- إذا كان المستخدم هو مقدم العرض: عرض شارة "عرضك قيد المراجعة" أو "قُبل عرضك" مع زر للذهاب للمحادثة.

### `src/routes/messages.tsx` (قائمة المحادثات)
- إزالة `mockConversations` بالكامل والاستبدال بـ `useQuery(conversationsQueryOptions(accessToken))`.
- بطاقة المحادثة: صورة الطرف الآخر (المالك يرى المنفذ، والعكس)، عنوان المهمة، آخر رسالة، توقيت.

### `src/routes/messages.$conversationId.tsx`
- إزالة `mockMessages` و `mockConversations`.
- `loader` يستخدم `ensureQueryData(messagesQueryOptions(conversationId))` + `conversationQueryOptions`.
- المكون يستخدم `useSuspenseQuery` للرسائل، ويفعّل `useRealtimeMessages(conversationId)` لاستقبال الرسائل الجديدة فوراً.
- نموذج الإرسال يستدعي `/api/public/messages-send` (مع تحديث متفائل: إضافة الرسالة محلياً قبل وصول حدث Realtime، مع `id` مؤقت يُستبدل عند وصول الـ payload الفعلي).
- التمييز بين `senderId === session.user.uid` و الطرف الآخر بدلاً من `"me"` الثابتة.

### تحديثات صغيرة
- `src/components/layout/NotificationsPanel.tsx`: لا تغيير في الكود لكن ستظهر أنواع جديدة من الإشعارات (`offer`, `message`) بفضل التحديثات الخلفية.
- `src/lib/i18n/locales/{ar,en}.json`: إضافة مفاتيح جديدة:
  - `task.offersList`, `task.acceptOffer`, `task.acceptedBy`, `task.bidPending`, `task.cantBidOwn`, `task.openChat`
  - `messages.newMessage`, `messages.empty`

---

## 5. ملفات سيتم إنشاؤها / تعديلها

**جديدة**:
- `supabase/migrations/<timestamp>_marketplace_schema.sql` (سيُنفّذ عبر أداة الترحيل)
- `src/routes/api.public.bids-create.ts`
- `src/routes/api.public.bids-accept.ts`
- `src/routes/api.public.bids-list.ts`
- `src/routes/api.public.messages-send.ts`
- `src/routes/api.public.conversations-list.ts`
- `src/lib/supabase/realtime.ts`

**معدّلة**:
- `src/lib/supabase/types.ts` — أنواع جديدة + توسعة `TaskRow`.
- `src/lib/supabase/queries.ts` — query options جديدة.
- `src/routes/tasks.$taskId.tsx` — نموذج العرض الفعلي + قسم العروض للمالك.
- `src/routes/messages.tsx` — قائمة محادثات حقيقية.
- `src/routes/messages.$conversationId.tsx` — رسائل حقيقية + Realtime.
- `src/lib/i18n/locales/ar.json` & `en.json` — مفاتيح جديدة.

**محذوفة/مهملة**: لن نلمس `src/lib/mockData.ts` — يبقى كملف غير مستخدم (يمكن حذفه لاحقاً عند تأكيد عدم وجود استيرادات متبقية).

---

## 6. الإجراءات المطلوبة من المستخدم

1. **الموافقة على الـ migration** عند تشغيلها (سأعرضها قبل التنفيذ).
2. **التحقق من تفعيل Realtime** في لوحة Supabase → Database → Replication → publication `supabase_realtime` يحتوي `messages` (الـ migration يفعل ذلك تلقائياً، لكن يستحسن التأكد).
3. لا أسرار جديدة مطلوبة — `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` موجودة بالفعل.

---

## 7. خارج النطاق (لجولة لاحقة)

- المدفوعات عبر Pi (تحويل المبلغ بعد إكمال المهمة).
- إنهاء المهمة + تقييم الطرفين.
- قراءة محادثات/رسائل محصورة بأطرافها عبر RLS مع JWT مخصص (حالياً القراءة عامة، الكتابة محمية).
- تعديل العرض بعد تقديمه (موجود تقنياً عبر UPSERT لكن بدون UI).
- إشعارات Push داخل Pi Browser.
