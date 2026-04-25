## 🎨 التوجيه الإبداعي (Creative Brief)

### نظام الألوان — Royal Purple + Glassmorphism
**الوضع الفاتح (Light Mode):**
- `--background`: `#FAFAFF` (أبيض بنفسجي خفيف)
- `--foreground`: `#1A0B2E` (بنفسجي داكن جداً للنص)
- `--primary`: `#6D28D9` (بنفسجي ملكي - violet-700)
- `--primary-glow`: `#A78BFA` (violet-400 للتدرجات)
- `--accent`: `#EC4899` (وردي للتباين)
- `--card`: `rgba(255, 255, 255, 0.6)` (زجاجي شفاف)
- `--border`: `rgba(168, 139, 250, 0.2)` (حدود بنفسجية شفافة)

**الوضع الداكن (Dark Mode):**
- `--background`: `#0A0418` (بنفسجي ليلي عميق)
- `--foreground`: `#F5F3FF` (أبيض بنفسجي)
- `--primary`: `#A78BFA` (violet-400)
- `--card`: `rgba(30, 20, 60, 0.5)` (زجاجي داكن)
- `--border`: `rgba(167, 139, 250, 0.15)`

**التدرجات المخصصة لكل صفحة (CSS Custom Properties):**
```css
--gradient-page-home: linear-gradient(135deg, #F9FAFB 0%, #EEF2FF 50%, #F5F3FF 100%);
--gradient-page-tasks: linear-gradient(135deg, #FFF7ED 0%, #FEF3C7 100%);
--gradient-page-detail: linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%);
--gradient-page-profile: linear-gradient(135deg, #FAE8FF 0%, #F3E8FF 100%);
--gradient-brand: linear-gradient(135deg, #6D28D9 0%, #EC4899 100%);
--gradient-glass: linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.3) 100%);
--shadow-glass: 0 8px 32px 0 rgba(109, 40, 217, 0.15);
--shadow-glow: 0 0 40px rgba(167, 139, 250, 0.4);
```

كلاسات Tailwind v4 مخصصة: `bg-gradient-page-home`, `bg-gradient-page-tasks`, `bg-gradient-page-detail`, `bg-gradient-page-profile`, `bg-gradient-brand`, `glass-card`.

### الخطوط (Typography)
- **العناوين**: Outfit (700, 600) — للنصوص الإنجليزية
- **الجسم**: Figtree (400, 500) — للنصوص الإنجليزية
- **العربية**: Tajawal أو IBM Plex Sans Arabic كبديل تلقائي عبر `font-family` fallback chain
- التحميل عبر `@fontsource/outfit`, `@fontsource/figtree`, `@fontsource/tajawal`

### الحركات (Animations)
- **مدة سريعة**: 0.3s `ease-out` لانتقالات الصفحات
- **fadeInUp**: `translateY(20px) → 0, opacity 0 → 1`
- **slideInRight**: للوحات المنزلقة الجانبية
- **scaleIn**: للحوارات (0.95 → 1)
- **ripple**: تأثير موجة عند النقر على الأزرار
- **hover lift**: `hover:scale-[1.02] hover:-translate-y-1` للبطاقات
- **glow pulse**: نبض ضوئي على الأزرار الأساسية
- **confetti**: عند إتمام مهمة (مكتبة canvas-confetti)

### المنهج البصري
- **Glassmorphism في كل مكان**: `backdrop-blur-xl bg-white/30 border border-white/20`
- **Gradient orbs** خلفية كل صفحة: دوائر بنفسجية ضبابية متحركة
- **Border radius**: كبير وناعم — `rounded-2xl` للبطاقات، `rounded-full` للأزرار العائمة
- **Spacing**: مريح ومتنفس — `p-6, gap-4` كقاعدة
- **Iconography**: Lucide icons بأحجام `size-5` للواجهة، `size-6` للأزرار العائمة

---

## 📦 المراحل التفصيلية للتنفيذ

### المرحلة 1: البنية التحتية والتصميم
1. **تثبيت الحزم**:
   - `framer-motion` — للحركات
   - `react-i18next` + `i18next` + `i18next-browser-languagedetector` — للترجمة
   - `canvas-confetti` + `@types/canvas-confetti` — لتأثير الاحتفال
   - `@fontsource/outfit`, `@fontsource/figtree`, `@fontsource/tajawal`
   - shadcn components: `dropdown-menu`, `sheet`, `dialog`, `badge`, `skeleton` (موجودة بالفعل)

2. **تحديث `src/styles.css`**:
   - استبدال نظام الألوان الافتراضي بنظام Royal Purple OKLCH
   - إضافة كل تدرجات الصفحات كـ CSS variables
   - إضافة كلاسات `.glass-card`, `.glass-header`, `.gradient-text`, `.ripple-effect`
   - تعريف `@keyframes` للحركات المخصصة (orb-float, glow-pulse, ripple)
   - إضافة `font-family` chains مع fallback عربي

3. **تحديث `src/router.tsx`**:
   - تكوين `QueryClient` مع TanStack Query (للـ mock data hooks)
   - تمرير context للـ root

### المرحلة 2: نظام الترجمة و RTL
4. **إنشاء `src/lib/i18n/config.ts`**:
   - تكوين i18next بمفاتيح `ar` و `en`
   - LanguageDetector مع تخزين في localStorage
   - تحديث `document.documentElement.dir` و `lang` تلقائياً

5. **إنشاء `src/lib/i18n/locales/ar.json` و `en.json`**:
   - مفاتيح كاملة لكل النصوص: nav, common, home, tasks, profile, auth, messages

6. **إنشاء `src/components/providers/DirectionProvider.tsx`**:
   - تغليف `@radix-ui/react-direction` DirectionProvider
   - مزامنة مع i18n

7. **إنشاء `src/components/providers/ThemeProvider.tsx`**:
   - إدارة dark/light mode عبر class على `<html>`
   - تخزين في localStorage

### المرحلة 3: البيانات الوهمية (Mock Data)
8. **إنشاء `src/lib/mockData.ts`**:
   - `mockTasks`: 12 مهمة بفئات متنوعة (تصميم، برمجة، ترجمة، توصيل، تنظيف)
   - `mockUsers`: 6 مستخدمين بصور avatar
   - `mockConversations`: 5 محادثات
   - `mockMessages`: رسائل لكل محادثة
   - `mockNotifications`: 8 إشعارات

9. **إنشاء `src/hooks/useMockTasks.ts`** و `useMockMessages.ts`:
   - hooks بسيطة تعيد البيانات مع تأخير محاكاة

### المرحلة 4: مكونات التخطيط (Layout)
10. **إنشاء `src/components/layout/AppHeader.tsx`**:
    - شريط علوي ثابت `sticky top-0 z-40` مع `backdrop-blur-xl`
    - شعار "أيادي" مع أيقونة `Hand` من lucide
    - زر الإشعارات (يفتح Sheet جانبي)
    - زر تبديل اللغة (AR/EN) مع أيقونة `Globe`
    - زر تبديل الوضع (`Sun`/`Moon`)
    - DropdownMenu لقائمة المستخدم (Avatar)

11. **إنشاء `src/components/layout/NotificationsPanel.tsx`**:
    - Sheet ينزلق من الجانب
    - قائمة إشعارات مع timestamps نسبية

12. **إنشاء `src/components/layout/FloatingSidebar.tsx`**:
    - أيقونات دائرية عائمة على الجانب (يمين في RTL، يسار في LTR)
    - `position: fixed` مع `top-1/2 -translate-y-1/2`
    - tooltips تظهر عند hover
    - Framer Motion: stagger animation للأيقونات
    - مخفي على الجوال (`hidden md:flex`)

13. **إنشاء `src/components/layout/BottomNavigation.tsx`**:
    - شريط سفلي للجوال فقط (`md:hidden`)
    - 5 أيقونات: home, search, add (مميز), messages, profile
    - زر الإضافة في المنتصف بحجم أكبر مع gradient

14. **إنشاء `src/components/layout/AppShell.tsx`**:
    - يجمع AppHeader + FloatingSidebar + BottomNavigation + Outlet
    - يطبق الـ background gradient حسب المسار الحالي
    - GradientOrbs في الخلفية

15. **إنشاء `src/components/layout/PageTransition.tsx`**:
    - يغلف محتوى الصفحة بـ `AnimatePresence` و `motion.div`
    - fadeInUp بمدة 0.3s

16. **إنشاء `src/components/layout/GradientOrbs.tsx`**:
    - دوائر بنفسجية ضبابية متحركة في الخلفية (decorative)

### المرحلة 5: المكونات المشتركة
17. **إنشاء `src/components/common/TaskCard.tsx`**:
    - بطاقة glassmorphism مع hover lift
    - عنوان، فئة (Badge)، موقع، سعر، صورة المُعلِن، عدد العروض
    - زر "عرض التفاصيل" يستخدم Link

18. **إنشاء `src/components/common/RippleButton.tsx`**:
    - يغلف Button مع تأثير ripple عند النقر

19. **إنشاء `src/components/common/PageHeader.tsx`**:
    - عنوان الصفحة + وصف + زر اختياري

20. **إنشاء `src/components/common/EmptyState.tsx`** و **`LoadingSkeleton.tsx`**

### المرحلة 6: الصفحات (Routes)
21. **تحديث `src/routes/__root.tsx`**:
    - تغليف بـ ThemeProvider + DirectionProvider + QueryClientProvider + I18nextProvider
    - إضافة `<Toaster />` من sonner
    - notFoundComponent محسّن بالعربية

22. **استبدال `src/routes/index.tsx`** بالصفحة الرئيسية:
    - AppShell + Hero section مع gradient brand text
    - شريط بحث بارز
    - فلاتر فئات (chips أفقية قابلة للتمرير)
    - شبكة بطاقات المهام (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)

23. **إنشاء `src/routes/tasks.$taskId.tsx`**:
    - عنوان كبير + parallax على الصورة عند التمرير
    - تفاصيل الميزانية، الموعد، الموقع
    - وصف كامل
    - قسم "تقديم عرض" مع نموذج
    - معلومات صاحب المهمة (Card)

24. **إنشاء `src/routes/post-task.tsx`**:
    - نموذج متعدد الخطوات (3 خطوات): تفاصيل → موقع وميزانية → مراجعة
    - شريط تقدم متحرك
    - عند النشر: تأثير confetti + toast نجاح

25. **إنشاء `src/routes/profile.tsx`**:
    - رأس الملف الشخصي (banner + avatar كبير)
    - إحصائيات (مهام منشورة، مهام منجزة، تقييم)
    - Tabs: مهامي | عروضي | المراجعات
    - زر تعديل الملف

26. **إنشاء `src/routes/messages.tsx`**:
    - layout بـ Outlet
    - قائمة المحادثات على الجانب (في الديسكتوب) / كاملة (في الجوال)

27. **إنشاء `src/routes/messages.$conversationId.tsx`**:
    - واجهة دردشة كاملة
    - فقاعات رسائل بـ glassmorphism
    - input سفلي مع زر إرسال

28. **إنشاء صفحات المصادقة**:
    - `src/routes/auth.tsx` (layout بسيط مع gradient)
    - `src/routes/auth.login.tsx`
    - `src/routes/auth.signup.tsx`
    - `src/routes/auth.forgot-password.tsx`
    - `src/routes/auth.reset-password.tsx`
    - كلها تستخدم `supabase.auth` من العميل الموجود
    - بطاقة zugjajية مركزية مع نموذج

### المرحلة 7: اللمسات الأخيرة
29. **استيراد الخطوط في `src/router.tsx`** (أو ملف entry):
    - `import "@fontsource/outfit/400.css"` إلخ.

30. **اختبار الـ build** والتأكد من عدم وجود أخطاء TypeScript.

---

## 📋 ملخص الملفات الجديدة (~30 ملف)
- `src/lib/i18n/` (3 ملفات)
- `src/lib/mockData.ts`
- `src/components/providers/` (2 ملف)
- `src/components/layout/` (7 ملفات)
- `src/components/common/` (4 ملفات)
- `src/hooks/` (2 ملف)
- `src/routes/` (~12 ملف route)

## ⚠️ ملاحظات مهمة
- **بدون قاعدة بيانات**: جميع البيانات mock في الذاكرة (حسب طلب المستخدم)
- **المصادقة فقط** ستستخدم Supabase الموجود (signUp/signIn)
- **لا حاجة لجدول profiles** الآن — يمكن إضافته لاحقاً
- نظام الألوان الجديد سيستبدل القيم الافتراضية بالكامل في `styles.css`
- جميع النصوص ستُكتب بمفاتيح i18n منذ البداية لتجنب إعادة العمل

هل توافق على هذه الخطة لأبدأ التنفيذ؟