// إعدادات عامة وبيانات مرجعية للتطبيق

const SECTIONS = [
  { id: 'dashboard', path: '/', title: 'الرئيسية', icon: 'home', short: 'الرئيسية', color: 'primary' },
  { id: 'trip', path: '/trip', title: 'بيانات الرحلة', icon: 'passport', short: 'الرحلة', color: 'primary', desc: 'الوجهة، التواريخ، الميزانية ونوع الرحلة' },
  { id: 'itinerary', path: '/itinerary', title: 'جدول الرحلة اليومي', icon: 'calendar', short: 'الجدول', color: 'info', desc: 'خطة يومًا بيوم لكل الأنشطة والمواعيد' },
  { id: 'tasks', path: '/tasks', title: 'المهام', icon: 'check', short: 'المهام', color: 'success', desc: 'كل ما يجب إنجازه قبل السفر وأثناءه' },
  { id: 'packing', path: '/packing', title: 'قائمة أغراض السفر', icon: 'bag', short: 'الأغراض', color: 'accent', desc: 'تأكد أنك لم تنسَ شيئًا' },
  { id: 'places', path: '/places', title: 'الأماكن والخرائط', icon: 'map', short: 'الأماكن', color: 'danger', desc: 'فنادق، مطاعم، معالم وروابط خرائط جوجل' },
  { id: 'weather', path: '/weather', title: 'الطقس', icon: 'cloud', short: 'الطقس', color: 'info', desc: 'حالة الطقس المتوقعة في وجهتك' },
  { id: 'currency', path: '/currency', title: 'تحويل العملات', icon: 'currency', short: 'العملات', color: 'success', desc: 'أسعار صرف محدثة وتحويل فوري' },
  { id: 'plugs', path: '/plugs', title: 'المقابس الكهربائية', icon: 'plug', short: 'المقابس', color: 'accent', desc: 'نوع المقبس والفولتية في بلد الوجهة' },
  { id: 'links', path: '/links', title: 'روابط مفيدة وحجوزات', icon: 'link', short: 'الروابط', color: 'primary', desc: 'تذاكر، حجوزات، تأشيرة وتأمين السفر' },
  { id: 'services', path: '/services', title: 'خدمات موصى بها', icon: 'star', short: 'الخدمات', color: 'accent', desc: 'خدمات مقترحة لتسهيل رحلتك' },
  { id: 'assistant', path: '/assistant', title: 'مساعد السفر الذكي', icon: 'sparkle', short: 'المساعد', color: 'primary', desc: 'اسألني عن رحلتك، جدولك، الطقس، الأماكن أو أي تفاصيل تساعدك أثناء السفر' },
];

const BOTTOM_NAV_IDS = ['dashboard', 'itinerary', 'tasks', 'places', 'more'];

const TRIP_TYPES = ['سياحية', 'عمل', 'عائلية', 'مغامرة', 'شهر عسل', 'دينية', 'علاجية', 'دراسية'];

const PLACE_TYPES = [
  { id: 'hotel', label: 'فندق/إقامة', icon: 'suitcase' },
  { id: 'restaurant', label: 'مطعم', icon: 'star' },
  { id: 'cafe', label: 'كافيه', icon: 'star' },
  { id: 'attraction', label: 'معلم سياحي', icon: 'map' },
  { id: 'activity', label: 'نشاط', icon: 'sparkle' },
  { id: 'shopping', label: 'تسوق', icon: 'bag' },
  { id: 'transport', label: 'مواصلات', icon: 'navigation' },
  { id: 'other', label: 'أخرى', icon: 'info' },
];

const TASK_CATEGORIES = ['قبل السفر', 'أثناء السفر', 'وثائق', 'حجوزات', 'صحة', 'مال', 'أخرى'];

const PACKING_CATEGORIES = ['ملابس', 'إلكترونيات', 'مستحضرات', 'وثائق', 'أدوية', 'أخرى'];

const LINK_CATEGORIES = ['تذاكر طيران', 'حجز فندق', 'تأشيرة', 'تأمين سفر', 'مواصلات', 'أخرى'];

const SERVICE_CATEGORIES = ['اتصالات وإنترنت', 'تأمين', 'نقل ومواصلات', 'جولات سياحية', 'مساعد ذكاء اصطناعي', 'أخرى'];

// قائمة مرجعية مبسطة لأنواع المقابس الكهربائية الشائعة حسب الدولة
const PLUG_REFERENCE = {
  'السعودية': { types: ['G'], voltage: '127/230V', freq: '60Hz' },
  'الإمارات': { types: ['G'], voltage: '230V', freq: '50Hz' },
  'مصر': { types: ['C', 'F'], voltage: '220V', freq: '50Hz' },
  'تركيا': { types: ['C', 'F'], voltage: '230V', freq: '50Hz' },
  'ماليزيا': { types: ['G'], voltage: '240V', freq: '50Hz' },
  'إندونيسيا': { types: ['C', 'F'], voltage: '230V', freq: '50Hz' },
  'فرنسا': { types: ['C', 'E'], voltage: '230V', freq: '50Hz' },
  'ألمانيا': { types: ['C', 'F'], voltage: '230V', freq: '50Hz' },
  'المملكة المتحدة': { types: ['G'], voltage: '230V', freq: '50Hz' },
  'إيطاليا': { types: ['C', 'F', 'L'], voltage: '230V', freq: '50Hz' },
  'إسبانيا': { types: ['C', 'F'], voltage: '230V', freq: '50Hz' },
  'الولايات المتحدة': { types: ['A', 'B'], voltage: '120V', freq: '60Hz' },
  'اليابان': { types: ['A', 'B'], voltage: '100V', freq: '50/60Hz' },
  'الصين': { types: ['A', 'C', 'I'], voltage: '220V', freq: '50Hz' },
  'تايلاند': { types: ['A', 'B', 'C'], voltage: '220V', freq: '50Hz' },
  'قطر': { types: ['G'], voltage: '240V', freq: '50Hz' },
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP', 'TRY', 'MYR', 'IDR', 'THB', 'JPY', 'CNY', 'QAR', 'KWD', 'BHD', 'OMR'];

window.SECTIONS = SECTIONS;
window.BOTTOM_NAV_IDS = BOTTOM_NAV_IDS;
window.TRIP_TYPES = TRIP_TYPES;
window.PLACE_TYPES = PLACE_TYPES;
window.TASK_CATEGORIES = TASK_CATEGORIES;
window.PACKING_CATEGORIES = PACKING_CATEGORIES;
window.LINK_CATEGORIES = LINK_CATEGORIES;
window.SERVICE_CATEGORIES = SERVICE_CATEGORIES;
window.PLUG_REFERENCE = PLUG_REFERENCE;
window.CURRENCIES = CURRENCIES;
