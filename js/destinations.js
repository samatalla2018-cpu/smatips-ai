// نظام "الوجهة الديناميكية" — تزيين بصري بحت فقط (صورة + عنوان + لمسة لون خفيفة) يتكيّف تلقائيًا
// مع وجهة المستخدم المُدخَلة في بيانات الرحلة (trip.city / trip.country). لا يغيّر أي بيانات أو
// منطق رحلة، ولا علاقة له بحالة الدفع أو الصلاحيات — تلك تبقى كما هي تمامًا بغضّ النظر عن الوجهة.
//
// ثلاث طبقات للتطابق (الأدق أولًا):
// 1) مدينة/دولة معروفة بدقة ضمن DESTINATION_ALIASES → صورة وهوية خاصة بها (DESTINATION_THEMES).
// 2) دولة معروفة (بلا مدينة محدَّدة ضمن الطبقة الأولى) → ثيم إقليمي مناسب (REGION_THEMES) بدل صورة
//    عامة واحدة لكل شيء — العنوان المعروض يبقى دائمًا النص الحقيقي الذي كتبه المستخدم.
// 3) لا تطابق إطلاقًا (أو لا وجهة بعد) → ثيم SmaTrips الاحتياطي الأنيق (فقط كملاذ أخير).

// تطبيع اسم المدينة/الدولة (عربي أو إنجليزي) إلى مفتاح بحث موحّد: يزيل التشكيل والمسافات الزائدة
// ويوحّد الحروف المتشابهة شكلًا (أ/إ/آ → ا، ى → ي، ة → ه) حتى تتطابق الأشكال المختلفة للكتابة.
function normalizeDestKey(str) {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '') // تشكيل + تطويل
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

// أسماء عربية/إنجليزية شائعة (مدينة أو دولة) تُطابَق بمفتاح ثيم الوجهة في DESTINATION_THEMES —
// قائمة موسّعة تغطي أشهر وجهات المسافر الخليجي تحديدًا (خليجية + أوروبية + آسيوية + إقليمية).
const DESTINATION_ALIASES = {
  // السعودية
  'جده': 'jeddah', 'jeddah': 'jeddah', 'جدة': 'jeddah',
  'الرياض': 'riyadh', 'riyadh': 'riyadh',
  'العلا': 'alula', 'alula': 'alula', 'العُلا': 'alula',

  // الإمارات
  'دبي': 'dubai', 'dubai': 'dubai',
  'ابوظبي': 'abudhabi', 'abu dhabi': 'abudhabi', 'أبوظبي': 'abudhabi',
  'الامارات': 'dubai', 'uae': 'dubai', 'الإمارات': 'dubai',

  // تركيا
  'اسطنبول': 'istanbul', 'istanbul': 'istanbul',
  'طرابزون': 'trabzon', 'trabzon': 'trabzon',
  'انطاليا': 'istanbul', 'antalya': 'istanbul',
  'تركيا': 'istanbul', 'turkey': 'istanbul',

  // فرنسا / بريطانيا
  'باريس': 'paris', 'paris': 'paris', 'فرنسا': 'paris', 'france': 'paris',
  'لندن': 'london', 'london': 'london', 'بريطانيا': 'london', 'britain': 'london',
  'المملكه المتحده': 'london', 'uk': 'london', 'انجلترا': 'london', 'england': 'london',

  // إيطاليا
  'البندقيه': 'venice', 'venice': 'venice',
  'روما': 'rome', 'rome': 'rome',
  'ميلانو': 'milan', 'milan': 'milan', 'ميلان': 'milan',
  'ايطاليا': 'venice', 'italy': 'venice',

  // النمسا وسويسرا
  'فيينا': 'vienna', 'vienna': 'vienna', 'النمسا': 'vienna', 'austria': 'vienna',
  'زيلامسي': 'zellamsee', 'zell am see': 'zellamsee', 'zellamsee': 'zellamsee',
  'انترلاكن': 'interlaken', 'interlaken': 'interlaken',
  'جنيف': 'geneva', 'geneva': 'geneva',
  'زيورخ': 'zurich', 'zurich': 'zurich', 'زيوريخ': 'zurich',
  'سويسرا': 'interlaken', 'switzerland': 'interlaken',

  // هولندا وإسبانيا
  'امستردام': 'amsterdam', 'amsterdam': 'amsterdam', 'هولندا': 'amsterdam', 'netherlands': 'amsterdam',
  'برشلونه': 'barcelona', 'barcelona': 'barcelona',
  'مدريد': 'madrid', 'madrid': 'madrid',
  'اسبانيا': 'barcelona', 'spain': 'barcelona',

  // البلقان والقوقاز
  'سراييفو': 'sarajevo', 'sarajevo': 'sarajevo', 'البوسنه': 'sarajevo', 'bosnia': 'sarajevo',
  'باكو': 'baku', 'baku': 'baku', 'اذربيجان': 'baku', 'azerbaijan': 'baku',
  'تبليسي': 'tbilisi', 'tbilisi': 'tbilisi', 'جورجيا': 'tbilisi',

  // اليونان
  'سانتوريني': 'santorini', 'santorini': 'santorini', 'اليونان': 'santorini', 'greece': 'santorini', 'اثينا': 'santorini', 'athens': 'santorini',

  // مصر
  'مصر': 'egypt', 'egypt': 'egypt', 'القاهره': 'egypt', 'cairo': 'egypt',
  'الاقصر': 'egypt', 'luxor': 'egypt', 'اسوان': 'egypt', 'aswan': 'egypt', 'الجيزه': 'egypt', 'giza': 'egypt',
  'شرم الشيخ': 'sharm', 'sharm el sheikh': 'sharm', 'sharm': 'sharm', 'شرم': 'sharm',

  // المغرب
  'مراكش': 'marrakech', 'marrakech': 'marrakech', 'المغرب': 'marrakech', 'morocco': 'marrakech',

  // جنوب/جنوب شرق آسيا
  'المالديف': 'maldives', 'maldives': 'maldives',
  'تايلاند': 'thailand', 'thailand': 'thailand', 'بوكيت': 'thailand', 'phuket': 'thailand', 'بانكوك': 'thailand', 'bangkok': 'thailand', 'كرابي': 'thailand', 'krabi': 'thailand',
  'كوالالمبور': 'kualalumpur', 'kuala lumpur': 'kualalumpur', 'ماليزيا': 'kualalumpur', 'malaysia': 'kualalumpur',
  'بالي': 'bali', 'bali': 'bali', 'اندونيسيا': 'bali', 'indonesia': 'bali',
  'الهند': 'india', 'india': 'india', 'اجرا': 'india', 'agra': 'india', 'دلهي': 'india', 'delhi': 'india',
};

// مفاتيح الوجهات وبيانات كل منها: صورة كبيرة (Hero)، صورة بطاقة (أصغر)، عنوان عربي، ولمسة لون
// خفيفة جدًا تُستخدم فقط في شارة صغيرة (eyebrow) — الهوية اللونية الأساسية لـ SmaTrips (الفيروزي
// والذهبي) تبقى ثابتة في كل مكان آخر (الأزرار، البطاقات...)، فلا "تُستبدل" هوية العلامة بالوجهة.
const DESTINATION_THEMES = {
  jeddah: { label: 'جدة', mood: 'كورنيش يطل على البحر الأحمر', heroImage: 'https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?q=80&w=480&auto=format&fit=crop', tint: '#0F766E' },
  riyadh: { label: 'الرياض', mood: 'أفق حديث في قلب الجزيرة العربية', heroImage: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?q=80&w=480&auto=format&fit=crop', tint: '#B8763E' },
  alula: { label: 'العلا', mood: 'صخور رملية عمرها آلاف السنين', heroImage: 'https://images.unsplash.com/photo-1517840901100-8179e982acb7?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1517840901100-8179e982acb7?q=80&w=480&auto=format&fit=crop', tint: '#C9773E' },
  dubai: { label: 'دبي', mood: 'أفق حديث على ساحل الخليج', heroImage: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?q=80&w=480&auto=format&fit=crop', tint: '#2E8C80' },
  abudhabi: { label: 'أبوظبي', mood: 'عمارة فخمة وهدوء ساحلي', heroImage: 'https://images.unsplash.com/photo-1512632578888-169bbbc64f33?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1512632578888-169bbbc64f33?q=80&w=480&auto=format&fit=crop', tint: '#2E8C80' },
  istanbul: { label: 'إسطنبول', mood: 'بين قارتين وحكايا عثمانية', heroImage: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=480&auto=format&fit=crop', tint: '#B8763E' },
  trabzon: { label: 'طرابزون', mood: 'جبال خضراء وسواحل البحر الأسود', heroImage: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?q=80&w=480&auto=format&fit=crop', tint: '#2FA79A' },
  paris: { label: 'باريس', mood: 'مساءات باريسية دافئة', heroImage: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=480&auto=format&fit=crop', tint: '#8B7CC4' },
  london: { label: 'لندن', mood: 'عراقة بريطانية وسط ضجيج المدينة', heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=480&auto=format&fit=crop', tint: '#4A5A7A' },
  venice: { label: 'إيطاليا', mood: 'قنوات مائية وعمارة كلاسيكية', heroImage: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=480&auto=format&fit=crop', tint: '#4FA0A6' },
  rome: { label: 'روما', mood: 'تاريخ عريق في كل زاوية', heroImage: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=480&auto=format&fit=crop', tint: '#C9773E' },
  milan: { label: 'ميلانو', mood: 'أناقة إيطالية وعمارة راقية', heroImage: 'https://images.unsplash.com/photo-1610016302534-6f67f1c968d8?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1610016302534-6f67f1c968d8?q=80&w=480&auto=format&fit=crop', tint: '#4A5A7A' },
  vienna: { label: 'فيينا', mood: 'موسيقى كلاسيكية وعمارة إمبراطورية', heroImage: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?q=80&w=480&auto=format&fit=crop', tint: '#8B7CC4' },
  zellamsee: { label: 'زيلامسي', mood: 'بحيرة جبلية وهواء نمساوي نقي', heroImage: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?q=80&w=480&auto=format&fit=crop', tint: '#3E7FBF' },
  interlaken: { label: 'إنترلاكن', mood: 'بين بحيرتين وسط جبال الألب', heroImage: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=480&auto=format&fit=crop', tint: '#3E7FBF' },
  geneva: { label: 'جنيف', mood: 'أناقة سويسرية على ضفاف البحيرة', heroImage: 'https://images.unsplash.com/photo-1573108724029-4c46571d6490?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1573108724029-4c46571d6490?q=80&w=480&auto=format&fit=crop', tint: '#3E7FBF' },
  zurich: { label: 'زيورخ', mood: 'نظام سويسري وسط الطبيعة', heroImage: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?q=80&w=480&auto=format&fit=crop', tint: '#3E7FBF' },
  amsterdam: { label: 'أمستردام', mood: 'قنوات هادئة ودراجات في كل مكان', heroImage: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?q=80&w=480&auto=format&fit=crop', tint: '#C99A3E' },
  barcelona: { label: 'برشلونة', mood: 'عمارة غاودي الساحرة وشمس البحر المتوسط', heroImage: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=480&auto=format&fit=crop', tint: '#C9773E' },
  madrid: { label: 'مدريد', mood: 'نبض إسباني أصيل', heroImage: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?q=80&w=480&auto=format&fit=crop', tint: '#C9773E' },
  sarajevo: { label: 'سراييفو', mood: 'مزيج شرقي أوروبي أصيل', heroImage: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?q=80&w=480&auto=format&fit=crop', tint: '#4FA0A6' },
  baku: { label: 'باكو', mood: 'برج اللهب وعمارة مستقبلية', heroImage: 'https://images.unsplash.com/photo-1583417267826-aebc4d1542e1?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1583417267826-aebc4d1542e1?q=80&w=480&auto=format&fit=crop', tint: '#2E8C80' },
  tbilisi: { label: 'تبليسي', mood: 'وادٍ جبلي وبيوت قديمة ساحرة', heroImage: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?q=80&w=480&auto=format&fit=crop', tint: '#B8763E' },
  santorini: { label: 'سانتوريني', mood: 'أبيض وأزرق فوق منحدرات بحر إيجه', heroImage: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=480&auto=format&fit=crop', tint: '#3E7FBF' },
  egypt: { label: 'مصر', mood: 'رمال ذهبية وتاريخ عريق', heroImage: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=480&auto=format&fit=crop', tint: '#C99A3E' },
  sharm: { label: 'شرم الشيخ', mood: 'مياه فيروزية صافية وشعاب مرجانية', heroImage: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?q=80&w=480&auto=format&fit=crop', tint: '#2FA79A' },
  marrakech: { label: 'مراكش', mood: 'أسواق نابضة وعمارة مغربية أصيلة', heroImage: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?q=80&w=480&auto=format&fit=crop', tint: '#C9773E' },
  maldives: { label: 'جزر المالديف', mood: 'مياه فيروزية وهدوء استوائي', heroImage: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?q=80&w=480&auto=format&fit=crop', tint: '#2FA79A' },
  thailand: { label: 'تايلاند', mood: 'شواطئ استوائية وقوارب تقليدية', heroImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=480&auto=format&fit=crop', tint: '#2FA79A' },
  kualalumpur: { label: 'كوالالمبور', mood: 'أبراج شاهقة وسط الغابات الاستوائية', heroImage: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=480&auto=format&fit=crop', tint: '#2E8C80' },
  bali: { label: 'بالي', mood: 'مياه فيروزية وشواطئ استوائية ساحرة', heroImage: 'https://images.unsplash.com/photo-1573790387438-4da905039392?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1573790387438-4da905039392?q=80&w=480&auto=format&fit=crop', tint: '#2FA79A' },
  india: { label: 'الهند', mood: 'عمارة مغولية آسرة', heroImage: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=480&auto=format&fit=crop', tint: '#C9773E' },
};

// طبقة ثانية: دولة معروفة بلا مدينة محدَّدة ضمن DESTINATION_ALIASES أعلاه → مفتاح منطقة إقليمية.
// هذه ليست هويات مدن بعينها، بل صور/أجواء عامة مناسبة للمنطقة حتى لا تظهر نفس الصورة الواحدة
// لكل وجهة غير مُدرجة صراحةً — العنوان المعروض للمستخدم يبقى دائمًا نص رحلته الحقيقي.
const COUNTRY_REGION_MAP = {
  'الكويت': 'gulf', 'kuwait': 'gulf',
  'البحرين': 'gulf', 'bahrain': 'gulf',
  'قطر': 'gulf', 'qatar': 'gulf',
  'عمان': 'gulf', 'oman': 'gulf', 'عُمان': 'gulf',
  'السعوديه': 'gulf', 'saudi arabia': 'gulf', 'ksa': 'gulf', 'السعودية': 'gulf',

  'الاردن': 'levant', 'jordan': 'levant',
  'لبنان': 'levant', 'lebanon': 'levant',
  'سوريا': 'levant', 'syria': 'levant',
  'فلسطين': 'levant', 'palestine': 'levant',

  'تونس': 'northAfrica', 'tunisia': 'northAfrica',
  'الجزائر': 'northAfrica', 'algeria': 'northAfrica',

  'ارمينيا': 'caucasus', 'armenia': 'caucasus',

  'فيتنام': 'seAsia', 'vietnam': 'seAsia',
  'سنغافوره': 'seAsia', 'singapore': 'seAsia',
  'الفلبين': 'seAsia', 'philippines': 'seAsia',
  'كمبوديا': 'seAsia', 'cambodia': 'seAsia',
  'لاوس': 'seAsia', 'laos': 'seAsia',

  'المانيا': 'europe', 'germany': 'europe',
  'بلجيكا': 'europe', 'belgium': 'europe',
  'البرتغال': 'europe', 'portugal': 'europe',
  'ايرلندا': 'europe', 'ireland': 'europe',
  'السويد': 'europe', 'sweden': 'europe',
  'النرويج': 'europe', 'norway': 'europe',
  'الدنمارك': 'europe', 'denmark': 'europe',
  'بولندا': 'europe', 'poland': 'europe',
  'التشيك': 'europe', 'czechia': 'europe', 'czech republic': 'europe',
  'المجر': 'europe', 'hungary': 'europe',
};

const REGION_THEMES = {
  gulf: { mood: 'أجواء خليجية عصرية', heroImage: 'https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?q=80&w=480&auto=format&fit=crop', tint: '#2E8C80' },
  levant: { mood: 'عمارة شرقية أصيلة', heroImage: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?q=80&w=480&auto=format&fit=crop', tint: '#B8763E' },
  northAfrica: { mood: 'صحراء وتراث عريق', heroImage: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=480&auto=format&fit=crop', tint: '#C9773E' },
  caucasus: { mood: 'وديان جبلية وطابع أوروبي شرقي', heroImage: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?q=80&w=480&auto=format&fit=crop', tint: '#B8763E' },
  seAsia: { mood: 'طبيعة استوائية خضراء', heroImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=480&auto=format&fit=crop', tint: '#2FA79A' },
  europe: { mood: 'عمارة أوروبية كلاسيكية', heroImage: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=480&auto=format&fit=crop', tint: '#4A5A7A' },
};

// وجهة افتراضية أنيقة (بهوية SmaTrips الفيروزية) — ملاذ أخير فقط، عندما لا تُعرف الوجهة إطلاقًا
// (لا مدينة ولا دولة) أو لم تُحدَّد بعد.
const FALLBACK_DESTINATION_THEME = {
  label: '',
  mood: 'رحلتك القادمة تبدأ من هنا',
  heroImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop',
  cardImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=480&auto=format&fit=crop',
  tint: '#0F766E',
  isFallback: true,
};

// يبحث عن أول تطابق بين النص المُدخل (مدينة أو دولة) وقائمة الأسماء المعروفة بدقة
function resolveDestinationKey(...names) {
  for (const raw of names) {
    const norm = normalizeDestKey(raw);
    if (norm && DESTINATION_ALIASES[norm]) return DESTINATION_ALIASES[norm];
  }
  return null;
}

// يبحث عن تطابق دولة ضمن الطبقة الإقليمية (تُستخدم فقط عند فشل التطابق الدقيق أعلاه)
function resolveRegionKey(...names) {
  for (const raw of names) {
    const norm = normalizeDestKey(raw);
    if (norm && COUNTRY_REGION_MAP[norm]) return COUNTRY_REGION_MAP[norm];
  }
  return null;
}

// نقطة الدخول الرئيسية: تُعيد ثيم الوجهة المناسب لبيانات رحلة معيّنة (trip.city/trip.country).
// الأولوية: مدينة/دولة مطابقة بدقة ← منطقة إقليمية مناسبة ← ثيم SmaTrips الاحتياطي. العنوان
// المعروض (title) يبقى دائمًا مبنيًا من نص المستخدم الحقيقي، وليس من اسم الثيم — لا تُستخدم أبدًا
// كمصدر لأي قرار وظيفي أو صلاحية.
function getDestinationTheme(trip) {
  if (!trip) return { key: null, ...FALLBACK_DESTINATION_THEME };

  const exactKey = resolveDestinationKey(trip.city, trip.country);
  if (exactKey && DESTINATION_THEMES[exactKey]) return { key: exactKey, ...DESTINATION_THEMES[exactKey] };

  const regionKey = resolveRegionKey(trip.city, trip.country);
  if (regionKey && REGION_THEMES[regionKey]) {
    return { key: null, region: regionKey, label: '', ...REGION_THEMES[regionKey], isFallback: false };
  }

  return { key: null, ...FALLBACK_DESTINATION_THEME };
}

window.getDestinationTheme = getDestinationTheme;
window.DESTINATION_THEMES = DESTINATION_THEMES;
