export type CategoryKey =
  | "design"
  | "development"
  | "writing"
  | "delivery"
  | "cleaning"
  | "tutoring"
  | "marketing"
  | "other";

export interface MockUser {
  id: string;
  name: string;
  avatarSeed: string;
  rating: number;
  completedTasks: number;
}

export interface MockTask {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  category: CategoryKey;
  budget: number;
  location: string;
  locationEn: string;
  deadline: string;
  deadlineEn: string;
  imageSeed: string;
  publisher: MockUser;
  offersCount: number;
  postedAt: string;
  featured?: boolean;
}

export interface MockMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  textEn: string;
  createdAt: string;
}

export interface MockConversation {
  id: string;
  participant: MockUser;
  lastMessage: string;
  lastMessageEn: string;
  lastAt: string;
  unread: number;
}

export interface MockNotification {
  id: string;
  type: "offer" | "message" | "task" | "system";
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  createdAt: string;
  read: boolean;
}

export const mockUsers: MockUser[] = [
  { id: "u1", name: "سارة المطيري", avatarSeed: "Sara", rating: 4.9, completedTasks: 47 },
  { id: "u2", name: "محمد العتيبي", avatarSeed: "Mohammed", rating: 4.7, completedTasks: 31 },
  { id: "u3", name: "نورة القحطاني", avatarSeed: "Noura", rating: 5.0, completedTasks: 62 },
  { id: "u4", name: "خالد الشمري", avatarSeed: "Khaled", rating: 4.6, completedTasks: 18 },
  { id: "u5", name: "ريم الزهراني", avatarSeed: "Reem", rating: 4.8, completedTasks: 25 },
  { id: "u6", name: "أحمد الحربي", avatarSeed: "Ahmed", rating: 4.5, completedTasks: 12 },
];

export const currentUser: MockUser = {
  id: "me",
  name: "أنت",
  avatarSeed: "You",
  rating: 4.8,
  completedTasks: 8,
};

export const mockTasks: MockTask[] = [
  {
    id: "t1",
    title: "تصميم شعار لمتجر إلكتروني",
    titleEn: "Logo design for an online store",
    description:
      "أبحث عن مصمم محترف لتصميم شعار عصري لمتجر ملابس إلكتروني. يجب أن يكون التصميم بسيطاً ومميزاً.",
    descriptionEn:
      "Looking for a professional designer to create a modern logo for an online clothing store. The design should be minimal and distinctive.",
    category: "design",
    budget: 500,
    location: "الرياض",
    locationEn: "Riyadh",
    deadline: "خلال 5 أيام",
    deadlineEn: "Within 5 days",
    imageSeed: "logo-design",
    publisher: mockUsers[0],
    offersCount: 12,
    postedAt: "قبل ساعتين",
    featured: true,
  },
  {
    id: "t2",
    title: "تطوير موقع شخصي بـ React",
    titleEn: "Build a personal website in React",
    description: "أحتاج موقع شخصي بسيط وأنيق يعرض أعمالي ومعلوماتي مع نموذج تواصل.",
    descriptionEn: "I need a simple elegant personal website showcasing my work with a contact form.",
    category: "development",
    budget: 1500,
    location: "جدة",
    locationEn: "Jeddah",
    deadline: "خلال أسبوعين",
    deadlineEn: "Within 2 weeks",
    imageSeed: "react-site",
    publisher: mockUsers[1],
    offersCount: 8,
    postedAt: "قبل 4 ساعات",
    featured: true,
  },
  {
    id: "t3",
    title: "ترجمة مقال تقني من الإنجليزية للعربية",
    titleEn: "Translate a tech article EN→AR",
    description: "مقال تقني بطول 2000 كلمة يحتاج لترجمة احترافية مع مراعاة المصطلحات.",
    descriptionEn: "A 2000-word tech article needs professional translation with attention to terminology.",
    category: "writing",
    budget: 250,
    location: "عن بعد",
    locationEn: "Remote",
    deadline: "خلال 3 أيام",
    deadlineEn: "Within 3 days",
    imageSeed: "translate",
    publisher: mockUsers[2],
    offersCount: 15,
    postedAt: "قبل 6 ساعات",
  },
  {
    id: "t4",
    title: "توصيل طلب من المركز التجاري",
    titleEn: "Deliver an order from the mall",
    description: "أحتاج توصيل طلب صغير من المركز التجاري إلى منزلي خلال اليوم.",
    descriptionEn: "Need a small order delivered from the mall to my home today.",
    category: "delivery",
    budget: 50,
    location: "الدمام",
    locationEn: "Dammam",
    deadline: "اليوم",
    deadlineEn: "Today",
    imageSeed: "delivery",
    publisher: mockUsers[3],
    offersCount: 4,
    postedAt: "قبل ساعة",
  },
  {
    id: "t5",
    title: "تنظيف شقة 3 غرف",
    titleEn: "Clean a 3-bedroom apartment",
    description: "تنظيف شامل لشقة من 3 غرف مع المطبخ والحمامات.",
    descriptionEn: "Full cleaning for a 3-bedroom apartment including kitchen and bathrooms.",
    category: "cleaning",
    budget: 350,
    location: "الرياض",
    locationEn: "Riyadh",
    deadline: "نهاية الأسبوع",
    deadlineEn: "This weekend",
    imageSeed: "cleaning",
    publisher: mockUsers[4],
    offersCount: 6,
    postedAt: "أمس",
  },
  {
    id: "t6",
    title: "دروس خصوصية في الرياضيات",
    titleEn: "Private math tutoring",
    description: "دروس رياضيات لطالب ثانوي 3 مرات أسبوعياً.",
    descriptionEn: "Math tutoring for a high school student, 3 times a week.",
    category: "tutoring",
    budget: 800,
    location: "الرياض",
    locationEn: "Riyadh",
    deadline: "بداية الشهر",
    deadlineEn: "Start of next month",
    imageSeed: "math",
    publisher: mockUsers[5],
    offersCount: 9,
    postedAt: "قبل يومين",
  },
  {
    id: "t7",
    title: "إدارة حسابات السوشيال ميديا لمطعم",
    titleEn: "Manage social media for a restaurant",
    description: "إنشاء محتوى ونشره على إنستجرام وتيك توك لمطعم محلي.",
    descriptionEn: "Create and post content on Instagram and TikTok for a local restaurant.",
    category: "marketing",
    budget: 1200,
    location: "جدة",
    locationEn: "Jeddah",
    deadline: "شهر كامل",
    deadlineEn: "One month",
    imageSeed: "social",
    publisher: mockUsers[0],
    offersCount: 11,
    postedAt: "قبل 3 أيام",
    featured: true,
  },
  {
    id: "t8",
    title: "تصميم بروشور دعائي",
    titleEn: "Design a promotional brochure",
    description: "بروشور من 4 صفحات لشركة عقارية بمواصفات احترافية.",
    descriptionEn: "A 4-page brochure for a real estate company with professional specs.",
    category: "design",
    budget: 400,
    location: "عن بعد",
    locationEn: "Remote",
    deadline: "خلال أسبوع",
    deadlineEn: "Within a week",
    imageSeed: "brochure",
    publisher: mockUsers[1],
    offersCount: 7,
    postedAt: "قبل 5 ساعات",
  },
  {
    id: "t9",
    title: "تطبيق جوال بسيط بـ React Native",
    titleEn: "Simple mobile app in React Native",
    description: "تطبيق قائمة مهام بسيط مع مصادقة Supabase.",
    descriptionEn: "Simple to-do app with Supabase authentication.",
    category: "development",
    budget: 2500,
    location: "عن بعد",
    locationEn: "Remote",
    deadline: "3 أسابيع",
    deadlineEn: "3 weeks",
    imageSeed: "rn-app",
    publisher: mockUsers[2],
    offersCount: 5,
    postedAt: "قبل أسبوع",
  },
  {
    id: "t10",
    title: "كتابة 10 مقالات لمدونة سفر",
    titleEn: "Write 10 articles for a travel blog",
    description: "مقالات بحوالي 800 كلمة عن وجهات سياحية في السعودية.",
    descriptionEn: "~800-word articles about tourist destinations in Saudi Arabia.",
    category: "writing",
    budget: 1000,
    location: "عن بعد",
    locationEn: "Remote",
    deadline: "شهر",
    deadlineEn: "One month",
    imageSeed: "blog",
    publisher: mockUsers[3],
    offersCount: 14,
    postedAt: "قبل 12 ساعة",
  },
  {
    id: "t11",
    title: "تصوير منتجات لمتجر إلكتروني",
    titleEn: "Product photography for online store",
    description: "تصوير 30 منتجاً بخلفية بيضاء بجودة احترافية.",
    descriptionEn: "Photograph 30 products on white background, professional quality.",
    category: "other",
    budget: 900,
    location: "الرياض",
    locationEn: "Riyadh",
    deadline: "خلال 10 أيام",
    deadlineEn: "Within 10 days",
    imageSeed: "photo",
    publisher: mockUsers[4],
    offersCount: 6,
    postedAt: "قبل يوم",
  },
  {
    id: "t12",
    title: "حملة إعلانية على جوجل",
    titleEn: "Google ads campaign",
    description: "إدارة حملة إعلانية لمدة شهر بميزانية 3000 ريال.",
    descriptionEn: "Run a one-month ad campaign with 3000 SAR budget.",
    category: "marketing",
    budget: 700,
    location: "عن بعد",
    locationEn: "Remote",
    deadline: "بداية الأسبوع القادم",
    deadlineEn: "Next week",
    imageSeed: "ads",
    publisher: mockUsers[5],
    offersCount: 3,
    postedAt: "قبل 8 ساعات",
  },
];

export const mockConversations: MockConversation[] = [
  {
    id: "c1",
    participant: mockUsers[0],
    lastMessage: "تمام، سأرسل لك المسودة الأولى غداً.",
    lastMessageEn: "Sure, I'll send you the first draft tomorrow.",
    lastAt: "10:42",
    unread: 2,
  },
  {
    id: "c2",
    participant: mockUsers[1],
    lastMessage: "هل يمكنك تخفيض السعر قليلاً؟",
    lastMessageEn: "Can you lower the price a bit?",
    lastAt: "أمس",
    unread: 0,
  },
  {
    id: "c3",
    participant: mockUsers[2],
    lastMessage: "شكراً جزيلاً، العمل ممتاز!",
    lastMessageEn: "Thanks a lot, great work!",
    lastAt: "أمس",
    unread: 0,
  },
  {
    id: "c4",
    participant: mockUsers[3],
    lastMessage: "متى يمكننا البدء؟",
    lastMessageEn: "When can we start?",
    lastAt: "الإثنين",
    unread: 1,
  },
];

export const mockMessages: Record<string, MockMessage[]> = {
  c1: [
    { id: "m1", conversationId: "c1", senderId: "u1", text: "السلام عليكم، رأيت عرضك على المهمة.", textEn: "Hi, I saw your offer on the task.", createdAt: "10:30" },
    { id: "m2", conversationId: "c1", senderId: "me", text: "وعليكم السلام، نعم متى نبدأ؟", textEn: "Hi! Yes, when can we start?", createdAt: "10:35" },
    { id: "m3", conversationId: "c1", senderId: "u1", text: "أحتاج تفاصيل إضافية أولاً.", textEn: "I need more details first.", createdAt: "10:40" },
    { id: "m4", conversationId: "c1", senderId: "u1", text: "تمام، سأرسل لك المسودة الأولى غداً.", textEn: "Sure, I'll send you the first draft tomorrow.", createdAt: "10:42" },
  ],
  c2: [
    { id: "m5", conversationId: "c2", senderId: "u2", text: "السعر مرتفع قليلاً.", textEn: "The price is a bit high.", createdAt: "أمس" },
    { id: "m6", conversationId: "c2", senderId: "u2", text: "هل يمكنك تخفيض السعر قليلاً؟", textEn: "Can you lower the price a bit?", createdAt: "أمس" },
  ],
  c3: [
    { id: "m7", conversationId: "c3", senderId: "u3", text: "شكراً جزيلاً، العمل ممتاز!", textEn: "Thanks a lot, great work!", createdAt: "أمس" },
  ],
  c4: [
    { id: "m8", conversationId: "c4", senderId: "u4", text: "متى يمكننا البدء؟", textEn: "When can we start?", createdAt: "الإثنين" },
  ],
};

export const mockNotifications: MockNotification[] = [
  { id: "n1", type: "offer", title: "عرض جديد", titleEn: "New offer", body: "تلقيت عرضاً جديداً على مهمة تصميم الشعار", bodyEn: "You received a new offer on your logo design task", createdAt: "قبل 5 دقائق", read: false },
  { id: "n2", type: "message", title: "رسالة جديدة", titleEn: "New message", body: "سارة المطيري أرسلت لك رسالة", bodyEn: "Sara sent you a message", createdAt: "قبل 20 دقيقة", read: false },
  { id: "n3", type: "task", title: "مهمة قريبة", titleEn: "Task nearby", body: "مهمة جديدة في منطقتك تطابق اهتماماتك", bodyEn: "A new task in your area matches your interests", createdAt: "قبل ساعة", read: false },
  { id: "n4", type: "system", title: "تم قبول عرضك 🎉", titleEn: "Your offer was accepted 🎉", body: "محمد العتيبي قبل عرضك على المهمة", bodyEn: "Mohammed accepted your offer", createdAt: "قبل 3 ساعات", read: true },
  { id: "n5", type: "system", title: "تذكير", titleEn: "Reminder", body: "موعد تسليم المهمة بعد يومين", bodyEn: "Task deadline in 2 days", createdAt: "أمس", read: true },
];

export function getAvatarUrl(seed: string, size = 96) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

export function getTaskImage(seed: string, w = 800, h = 500) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

export const categoryKeys: CategoryKey[] = [
  "design",
  "development",
  "writing",
  "delivery",
  "cleaning",
  "tutoring",
  "marketing",
  "other",
];