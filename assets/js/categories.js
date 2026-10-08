/* ==========================================================
   Domains Rating — التصنيفات
   لإضافة/تعديل تصنيف: عدّل هذه القائمة فقط، وكل الصفحات تتحدث تلقائياً.
   id: معرّف ثابت (لا تغيّره بعد جمع البيانات) — title: العنوان الإبداعي
   base: اسم التصنيف الأصلي (يظهر في لوحة الإدارة) — optional: يسمح بـ "لم أجرّب"
   ========================================================== */
window.DOMAINS_ICONS = {
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  quiet: '<path d="M3 14v-3a9 9 0 0118 0v3"/><rect x="2.5" y="13" width="4.5" height="7" rx="1.5"/><rect x="17" y="13" width="4.5" height="7" rx="1.5"/>',
  thermo: '<path d="M14 14.8V5a2 2 0 10-4 0v9.8a4 4 0 104 0z"/><path d="M12 9v7"/>',
  light: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0012 3z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18h2"/>',
  megaphone: '<path d="M3 10v4a1 1 0 001 1h3l6 4V5L7 9H4a1 1 0 00-1 1z"/><path d="M17 8.5a5 5 0 010 7"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>',
  training: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/>',
  event: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  project: '<path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/>',
  volunteer: '<path d="M7 11V6a2 2 0 014 0v4M11 9V4a2 2 0 014 0v6M15 8a2 2 0 014 0v6a7 7 0 01-7 7h-1a7 7 0 01-6-3.5L3 14a2 2 0 013.4-2l.6 1"/>'
};

window.DOMAINS_GROUPS = [
  {
    id: "place",
    step: "المكان",
    title: "المكان من حولك",
    subtitle: "المساحة التي تدرس وتبدع فيها — كيف كانت اليوم؟",
    items: [
      { id: "clean",   icon: "sparkle", base: "نظافة المكان",  title: "لمعة المكان",        hint: "نظافة القاعات والطاولات والمطبخ والمرافق." },
      { id: "quiet",   icon: "quiet",   base: "هدوء المكان",   title: "مساحة للتركيز",      hint: "هل ساعدك هدوء القاعة على التركيز والإنجاز؟" },
      { id: "comfort", icon: "thermo",  base: "بيئة المكان",   title: "دفء وراحة",          hint: "التدفئة والتهوية وراحة المقاعد والأجواء العامة." },
      { id: "light",   icon: "light",   base: "ضبط الإضاءة",   title: "إضاءة تريح عينيك",   hint: "هل الإضاءة مناسبة للقراءة والعمل لساعات؟" }
    ]
  },
  {
    id: "team",
    step: "الفريق",
    title: "الفريق والتنظيم",
    subtitle: "الناس والنظام اللذان يجعلان دومينز مكاناً مختلفاً.",
    items: [
      { id: "staff", icon: "heart", base: "التعامل مع الطلاب", title: "روح الفريق",  hint: "لطف الفريق واحترامه وسرعة مساعدته لك." },
      { id: "order", icon: "clock", base: "انضباط المكان",     title: "نظام ودقّة",  hint: "الالتزام بالمواعيد والحجوزات وقواعد المكان." }
    ]
  },
  {
    id: "digital",
    step: "الرقمي",
    title: "رحلتك الرقمية",
    subtitle: "من تحميل التطبيق إلى ما تراه منا على السوشيال ميديا.",
    items: [
      { id: "app_install", icon: "download",  base: "سهولة تحميل التطبيق", title: "البداية مع التطبيق", hint: "سهولة إيجاد التطبيق وتحميله وإنشاء الحساب.", optional: true },
      { id: "app_overall", icon: "phone",     base: "التطبيق بشكل عام",    title: "تجربة التطبيق",      hint: "الحجز والوضوح والسرعة داخل التطبيق.",       optional: true },
      { id: "social",      icon: "megaphone", base: "محتوى السوشيال ميديا", title: "دومينز أونلاين",     hint: "هل محتوانا على المنصات مفيد وملهم ويستحق المتابعة؟", optional: true }
    ]
  }
];

/* المسارات الأساسية — يختار الطالب ما شارك فيه ويقيّمه */
window.DOMAINS_TRACKS = [
  { id: "training",  icon: "training",  title: "تدريب",  question: "كيف كان التدريب؟",  placeholder: "اسم التدريب (اختياري)" },
  { id: "event",     icon: "event",     title: "فعالية", question: "كيف كانت الفعالية؟", placeholder: "اسم الفعالية (اختياري)" },
  { id: "project",   icon: "project",   title: "مشروع",  question: "كيف كانت تجربتك في المشروع؟",  placeholder: "اسم المشروع (اختياري)" },
  { id: "volunteer", icon: "volunteer", title: "تطوع",   question: "كيف كانت تجربة التطوع؟",   placeholder: "مجال التطوع (اختياري)" }
];

/* سبب الزيارة */
window.DOMAINS_VISIT = [
  { id: "study",     title: "دراسة" },
  { id: "training",  title: "تدريب" },
  { id: "event",     title: "فعالية" },
  { id: "project",   title: "مشروع" },
  { id: "volunteer", title: "تطوع" }
];

window.DOMAINS_SCALE = [
  { v: 1, label: "ضعيف" },
  { v: 2, label: "مقبول" },
  { v: 3, label: "جيد" },
  { v: 4, label: "جيد جداً" },
  { v: 5, label: "ممتاز" }
];

window.domainsIcon = function (name, cls) {
  return '<svg class="' + (cls || "ico") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (window.DOMAINS_ICONS[name] || "") + "</svg>";
};

window.domainsAllItems = function () {
  return window.DOMAINS_GROUPS.reduce(function (a, g) { return a.concat(g.items); }, []);
};
