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
  'جده': 'jeddah', 'jeddah': 'jeddah', 'جدة': 'jeddah', 'jedda': 'jeddah',
  'الرياض': 'riyadh', 'riyadh': 'riyadh',
  'العلا': 'alula', 'alula': 'alula', 'العُلا': 'alula', 'al ula': 'alula',

  // الإمارات — ملاحظة: "الإمارات" (الدولة) لم تعُد تُطابَق مباشرةً مع دبي هنا (كانت تجعل أي مدينة
  // إماراتية أخرى بلا اسم خاص بها، كالشارقة، تظهر خطأً باسم/صورة دبي) — تُركت للطبقة الإقليمية أدناه.
  'دبي': 'dubai', 'dubai': 'dubai',
  'ابوظبي': 'abudhabi', 'abu dhabi': 'abudhabi', 'أبوظبي': 'abudhabi',

  // عُمان/الأردن — "مسقط" محدَّدة بلا أي لبس فتُضاف هنا مباشرة. أما "عمان" وحدها (بلا تشكيل مضمون
  // في كتابة المستخدم الفعلية) فقد تعني إما العاصمة الأردنية (عمّان) أو سلطنة عُمان — لا تُدرَج هنا
  // كي لا نخمّن خطأً؛ الطبقة الديناميكية أدناه تفصل بينهما باستخدام حقل الدولة المرافق (مثال:
  // "عمان" + "الأردن" → مدينة عمّان تحديدًا)، والإنجليزية "Amman" غير الملبوسة تبقى تطابقًا مباشرًا.
  'مسقط': 'muscat', 'muscat': 'muscat',
  'amman': 'amman',

  // تركيا — أُزيلت "تركيا/turkey" كتطابق مباشر مع إسطنبول (كانت تجعل أي مدينة تركية أخرى بلا اسم
  // خاص بها، مثل كابادوكيا، تظهر خطأً باسم/صورة إسطنبول)، وكذلك "أنطاليا" التي هي مدينة مختلفة
  // تمامًا عن إسطنبول ولا يصح إظهار صورتها. كلتاهما تُركتا للطبقتين الإقليمية/الديناميكية أدناه.
  'اسطنبول': 'istanbul', 'istanbul': 'istanbul',
  'طرابزون': 'trabzon', 'trabzon': 'trabzon',

  // فرنسا / بريطانيا
  'باريس': 'paris', 'paris': 'paris',
  'لندن': 'london', 'london': 'london',

  // إيطاليا
  'البندقيه': 'venice', 'venice': 'venice',
  'روما': 'rome', 'rome': 'rome',
  'ميلانو': 'milan', 'milan': 'milan', 'ميلان': 'milan',

  // النمسا وسويسرا
  'فيينا': 'vienna', 'vienna': 'vienna',
  'زيلامسي': 'zellamsee', 'zell am see': 'zellamsee', 'zellamsee': 'zellamsee',
  'انترلاكن': 'interlaken', 'interlaken': 'interlaken',
  'جنيف': 'geneva', 'geneva': 'geneva',
  'زيورخ': 'zurich', 'zurich': 'zurich', 'زيوريخ': 'zurich',

  // هولندا وإسبانيا
  'امستردام': 'amsterdam', 'amsterdam': 'amsterdam',
  'برشلونه': 'barcelona', 'barcelona': 'barcelona',
  'مدريد': 'madrid', 'madrid': 'madrid',

  // البلقان والقوقاز
  'سراييفو': 'sarajevo', 'sarajevo': 'sarajevo', 'البوسنه': 'sarajevo', 'bosnia': 'sarajevo',
  'باكو': 'baku', 'baku': 'baku', 'اذربيجان': 'baku', 'azerbaijan': 'baku',
  'تبليسي': 'tbilisi', 'tbilisi': 'tbilisi', 'جورجيا': 'tbilisi',

  // اليونان — أُزيلت "اليونان/greece" (الدولة) وكذلك "أثينا/Athens" من هذا المفتاح: أثينا مدينة
  // حقيقية مختلفة تمامًا عن سانتوريني ولا يصح إظهار صورتها؛ كلتاهما تُركتا للطبقتين أدناه.
  'سانتوريني': 'santorini', 'santorini': 'santorini',

  // مصر
  'مصر': 'egypt', 'egypt': 'egypt', 'القاهره': 'egypt', 'cairo': 'egypt',
  'الاقصر': 'egypt', 'luxor': 'egypt', 'اسوان': 'egypt', 'aswan': 'egypt', 'الجيزه': 'egypt', 'giza': 'egypt',
  'شرم الشيخ': 'sharm', 'sharm el sheikh': 'sharm', 'sharm': 'sharm', 'شرم': 'sharm',

  // المغرب — أُزيلت "المغرب/morocco" (الدولة) من هذا المفتاح لنفس السبب (كانت تجعل طنجة/فاس/الدار
  // البيضاء بلا اسم خاص بها تظهر خطأً باسم/صورة مراكش) — تُركت للطبقتين الإقليمية/الديناميكية أدناه.
  'مراكش': 'marrakech', 'marrakech': 'marrakech',

  // جنوب/جنوب شرق آسيا
  // "بانكوك" أُزيلت عمدًا من هذه المجموعة: هي عاصمة/مدينة كبرى وليست وجهة شاطئية مثل بقية القائمة،
  // فتُترك للطبقة الديناميكية أدناه لتُحضر صورتها الخاصة (معبد/أفق المدينة) بدل صورة شاطئ عامة.
  'المالديف': 'maldives', 'maldives': 'maldives',
  'تايلاند': 'thailand', 'thailand': 'thailand', 'بوكيت': 'thailand', 'phuket': 'thailand', 'كرابي': 'thailand', 'krabi': 'thailand',
  'كوالالمبور': 'kualalumpur', 'kuala lumpur': 'kualalumpur',
  'بالي': 'bali', 'bali': 'bali', 'اندونيسيا': 'bali', 'indonesia': 'bali',
  'الهند': 'india', 'india': 'india', 'اجرا': 'india', 'agra': 'india', 'دلهي': 'india', 'delhi': 'india',

  // شرق آسيا وأفريقيا وأمريكا — إضافات مُتحقَّق منها لتغطية أمثلة عالمية صريحة
  'طوكيو': 'tokyo', 'tokyo': 'tokyo',
  'زنجبار': 'zanzibar', 'zanzibar': 'zanzibar',
  'سيشل': 'seychelles', 'سيشيل': 'seychelles', 'seychelles': 'seychelles',
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
  // صورة المرجع التي زوّدتنا بها إدارة SmaTrips مباشرة (وليست من Unsplash) — محفوظة محليًا في
  // assets/hero/maldives-default.jpg (JPEG محسَّن، 284KB بدل 2.3MB الأصلية) بدل رابط خارجي.
  maldives: { label: 'جزر المالديف', mood: 'مياه فيروزية وهدوء استوائي', heroImage: '/assets/hero/maldives-default.jpg', cardImage: '/assets/hero/maldives-default.jpg', tint: '#2FA79A' },
  thailand: { label: 'تايلاند', mood: 'شواطئ استوائية وقوارب تقليدية', heroImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=480&auto=format&fit=crop', tint: '#2FA79A' },
  kualalumpur: { label: 'كوالالمبور', mood: 'أبراج شاهقة وسط الغابات الاستوائية', heroImage: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?q=80&w=480&auto=format&fit=crop', tint: '#2E8C80' },
  bali: { label: 'بالي', mood: 'مياه فيروزية وشواطئ استوائية ساحرة', heroImage: 'https://images.unsplash.com/photo-1573790387438-4da905039392?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1573790387438-4da905039392?q=80&w=480&auto=format&fit=crop', tint: '#2FA79A' },
  india: { label: 'الهند', mood: 'عمارة مغولية آسرة', heroImage: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=480&auto=format&fit=crop', tint: '#C9773E' },
  muscat: { label: 'مسقط', mood: 'كورنيش عُماني أصيل بين الجبال والبحر', heroImage: 'https://images.unsplash.com/photo-1763377220339-de687c3efad4?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1763377220339-de687c3efad4?q=80&w=480&auto=format&fit=crop', tint: '#2E8C80' },
  amman: { label: 'عمّان', mood: 'مدينة الجبال السبعة وعراقة رومانية', heroImage: 'https://images.unsplash.com/photo-1604157886233-08985afc49e9?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1604157886233-08985afc49e9?q=80&w=480&auto=format&fit=crop', tint: '#B8763E' },
  tokyo: { label: 'طوكيو', mood: 'أضواء حديثة وعراقة يابانية', heroImage: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?q=80&w=480&auto=format&fit=crop', tint: '#4A5A7A' },
  zanzibar: { label: 'زنجبار', mood: 'شواطئ استوائية وهدوء أفريقي أصيل', heroImage: 'https://images.unsplash.com/photo-1549035092-33b2937b075a?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1549035092-33b2937b075a?q=80&w=480&auto=format&fit=crop', tint: '#2FA79A' },
  seychelles: { label: 'سيشل', mood: 'صخور غرانيتية ومياه فيروزية ساحرة', heroImage: 'https://images.unsplash.com/photo-1621329724906-1645709cfcc3?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1621329724906-1645709cfcc3?q=80&w=480&auto=format&fit=crop', tint: '#2FA79A' },
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
  'المغرب': 'northAfrica', 'morocco': 'northAfrica',

  'ارمينيا': 'caucasus', 'armenia': 'caucasus',

  'فيتنام': 'seAsia', 'vietnam': 'seAsia',
  'سنغافوره': 'seAsia', 'singapore': 'seAsia',
  'الفلبين': 'seAsia', 'philippines': 'seAsia',
  'كمبوديا': 'seAsia', 'cambodia': 'seAsia',
  'لاوس': 'seAsia', 'laos': 'seAsia',
  'ماليزيا': 'seAsia', 'malaysia': 'seAsia',

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

  // دول لها ثيم مدينة مميّزة (أدناه) كانت سابقًا Alias مباشر لمدينة محدَّدة ضمن الطبقة الأولى —
  // نُقلت إلى هنا (طبقة إقليمية) بعد إصلاح خطأ إظهار مدينة أخرى في نفس الدولة بصورة/اسم خاطئين
  // (راجع التعليقات أعلى DESTINATION_ALIASES). تحافظ نفس الصورة على تجربة من يكتب اسم الدولة فقط
  // بلا مدينة محدَّدة تمامًا كما كانت، بينما أي مدينة أخرى تحصل الآن على صورتها الخاصة عبر الطبقة
  // الديناميكية بدل مدينة أخرى مختلفة تمامًا.
  'تركيا': 'turkeyGeneric', 'turkey': 'turkeyGeneric',
  'فرنسا': 'franceGeneric', 'france': 'franceGeneric',
  'بريطانيا': 'britainGeneric', 'britain': 'britainGeneric', 'المملكه المتحده': 'britainGeneric', 'uk': 'britainGeneric', 'انجلترا': 'britainGeneric', 'england': 'britainGeneric',
  'ايطاليا': 'italyGeneric', 'italy': 'italyGeneric',
  'النمسا': 'austriaGeneric', 'austria': 'austriaGeneric',
  'سويسرا': 'switzerlandGeneric', 'switzerland': 'switzerlandGeneric',
  'هولندا': 'netherlandsGeneric', 'netherlands': 'netherlandsGeneric',
  'اسبانيا': 'spainGeneric', 'spain': 'spainGeneric',
  'اليونان': 'greeceGeneric', 'greece': 'greeceGeneric',
};

// ملاحظة مهمة (إصلاح خطأ سابق): كانت صور gulf/levant/northAfrica هنا صورًا خاطئة تمامًا لا تمثّل
// المنطقة إطلاقًا (gulf كانت صورة الكعبة المشرّفة بمكة تحديدًا — غير مناسبة كصورة عامة لدول أخرى
// كالكويت/قطر/عُمان، وlevant كانت صورة لعبة "ليغو" لسيارة (Batmobile) بلا أي علاقة بالمنطقة، وكانت
// northAfrica تُعيد استخدام صورة "الهند" نفسها بالخطأ). استُبدلت الثلاث بصور مُتحقَّق منها فعليًا.
const REGION_THEMES = {
  gulf: { mood: 'أجواء خليجية عصرية', heroImage: 'https://images.unsplash.com/photo-1609229862559-88fc0ac257ad?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1609229862559-88fc0ac257ad?q=80&w=480&auto=format&fit=crop', tint: '#2E8C80' },
  levant: { mood: 'عمارة شرقية أصيلة', heroImage: 'https://images.unsplash.com/photo-1604157886233-08985afc49e9?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1604157886233-08985afc49e9?q=80&w=480&auto=format&fit=crop', tint: '#B8763E' },
  northAfrica: { mood: 'صحراء وتراث عريق', heroImage: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?q=80&w=480&auto=format&fit=crop', tint: '#C9773E' },
  caucasus: { mood: 'وديان جبلية وطابع أوروبي شرقي', heroImage: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?q=80&w=480&auto=format&fit=crop', tint: '#B8763E' },
  seAsia: { mood: 'طبيعة استوائية خضراء', heroImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=480&auto=format&fit=crop', tint: '#2FA79A' },
  europe: { mood: 'عمارة أوروبية كلاسيكية', heroImage: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=480&auto=format&fit=crop', tint: '#4A5A7A' },

  // ثيمات دول (طبقة إقليمية) — نفس صور المدن المُنسَّقة أعلاه تمامًا (بلا أي تغيير في الصورة نفسها؛
  // فقط انتقلت من "تطابق مؤكَّد" إلى "خلفية إقليمية" حتى لا تُنسَب خطأً لمدينة أخرى مختلفة تمامًا).
  turkeyGeneric: { mood: 'بين قارتين وحكايا عثمانية', heroImage: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?q=80&w=480&auto=format&fit=crop', tint: '#B8763E' },
  franceGeneric: { mood: 'مساءات فرنسية دافئة', heroImage: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?q=80&w=480&auto=format&fit=crop', tint: '#8B7CC4' },
  britainGeneric: { mood: 'عراقة بريطانية أصيلة', heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=480&auto=format&fit=crop', tint: '#4A5A7A' },
  italyGeneric: { mood: 'عمارة إيطالية كلاسيكية', heroImage: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?q=80&w=480&auto=format&fit=crop', tint: '#4FA0A6' },
  austriaGeneric: { mood: 'موسيقى كلاسيكية وعمارة إمبراطورية', heroImage: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?q=80&w=480&auto=format&fit=crop', tint: '#8B7CC4' },
  switzerlandGeneric: { mood: 'جبال الألب وهواء نقي', heroImage: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=480&auto=format&fit=crop', tint: '#3E7FBF' },
  netherlandsGeneric: { mood: 'قنوات هادئة ودراجات في كل مكان', heroImage: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?q=80&w=480&auto=format&fit=crop', tint: '#C99A3E' },
  spainGeneric: { mood: 'شمس البحر المتوسط وعمارة أصيلة', heroImage: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=480&auto=format&fit=crop', tint: '#C9773E' },
  greeceGeneric: { mood: 'أبيض وأزرق فوق بحر إيجه', heroImage: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200&auto=format&fit=crop', cardImage: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=480&auto=format&fit=crop', tint: '#3E7FBF' },
};

// وجهة افتراضية أنيقة (بهوية SmaTrips الفيروزية) — ملاذ أخير فقط، عندما لا تُعرف الوجهة إطلاقًا
// (لا مدينة ولا دولة) أو لم تُحدَّد بعد.
const FALLBACK_DESTINATION_THEME = {
  label: '',
  mood: 'رحلتك القادمة تبدأ من هنا',
  heroImage: 'https://images.unsplash.com/photo-1536851452588-6f2f913bc1f1?q=80&w=1200&auto=format&fit=crop',
  cardImage: 'https://images.unsplash.com/photo-1536851452588-6f2f913bc1f1?q=80&w=480&auto=format&fit=crop',
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

// =================== طبقة رابعة (ديناميكية): توسيع التغطية عالميًا بلا Hardcoding ===================
// تُستدعى فقط عندما تفشل الطبقة الأولى الدقيقة أعلاه (لا مدينة/دولة معروفة ضمن DESTINATION_ALIASES)
// — لا تُستدعى إطلاقًا لأي وجهة من الوجهات المُنسَّقة يدويًا، فصورها الحالية لا تتأثر بهذا القسم
// بأي شكل. تجلب صورة الغلاف (thumbnail) الحقيقية لمقالة ويكيبيديا الخاصة بالمدينة/الدولة عبر
// Wikipedia API الرسمي والمجاني (بلا مفتاح API، وبلا أي كلفة أو تسجيل) بدل صورة مخزون عامة قد لا
// تُمثّل المكان إطلاقًا. تعمل بشكل غير متزامن تمامًا (لا تُبطئ عرض الصفحة أو إنشاء الرحلة أبدًا):
// الصورة الفورية المعروضة تبقى دائمًا الاحتياطية المتزامنة أعلاه (منطقة/محايدة)، ثم تُستبدَل الصورة
// في مكانها بهدوء إن وُجدت صورة أدق لاحقًا (بنفس أسلوب liveUpdateOnboardingHero/liveUpdateTripDetails
// الحيّ الموجود مسبقًا في trip.js)، بلا أي Layout Shift (نفس عنصر <img> بنفس أبعاد CSS الثابتة).

const DYNAMIC_DEST_IMG_CACHE_KEY = 'smatrips.destImgCache.v1';

// أنماط ملفات معروفة بأنها ليست صورة مكان حقيقية: أعلام/شعارات النبالة/خرائط/رموز توضيحية/شعارات،
// بالإضافة إلى Montage/Collage الصريحة (عدة صور مُجمَّعة في شبكة واحدة بحدود بيضاء) — امتداد .svg
// شبه دائمًا علم أو رمز وليس صورة فوتوغرافية حقيقية للمكان.
// ملاحظة: صور SVG المصغَّرة عبر Wikimedia تُرسَم كـ PNG لكن الامتداد الأصلي يبقى ظاهرًا في المسار
// بصيغة ".svg.png" (وليس ".svg" فقط في نهاية الرابط) — لذا نفحص وجود ".svg" في أي موضع بالمسار.
const BAD_WIKI_IMAGE_PATTERN = /flag_of|coat_of_arms|blank_map|locator|_map[._]|seal_of|emblem_of|\blogo\b|montage|_coll[._]|collage|al_asimah|governorate|\.svg/i;

function loadDynamicDestImageCache() {
  try { return JSON.parse(localStorage.getItem(DYNAMIC_DEST_IMG_CACHE_KEY)) || {}; } catch { return {}; }
}
function saveDynamicDestImageCache(cache) {
  try { localStorage.setItem(DYNAMIC_DEST_IMG_CACHE_KEY, JSON.stringify(cache)); } catch { /* تخزين ممتلئ/وضع خاص — تجاهل، لا يوقف الميزة */ }
}

// تقبل فقط صورة تبدو Landscape حقيقية: أبعاد معروفة، ليست علمًا/خريطة/شعارًا/Montage، وليست بورتريه
// حادًّا (النسبة الأكثر شيوعًا في الصور المُجمَّعة التي لا تحمل اسمًا يفضحها في الملف نفسه).
function isAcceptableWikiThumb(thumb) {
  if (!thumb || !thumb.source || !thumb.width || !thumb.height) return false;
  if (BAD_WIKI_IMAGE_PATTERN.test(thumb.source)) return false;
  if (thumb.height > thumb.width * 1.35) return false;
  return true;
}

async function wikipediaSearchTitle(query, lang) {
  const api = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
  const res = await fetch(api);
  if (!res.ok) return null;
  const data = await res.json();
  return (data && data.query && data.query.search && data.query.search[0] && data.query.search[0].title) || null;
}

// prop=pageimages|pageprops عبر action=query (وليس REST summary) تحديدًا لأنه يسمح بطلب مقاس
// Thumbnail عشوائي (pithumbsize) بلا القيود على "المقاسات المسموحة فقط" في روابط thumb.wikimedia.org
// المباشرة، ويعيد أيضًا pageprops.disambiguation لاستبعاد صفحات التوضيح (مثل "عمان" بلا سياق دولة).
async function wikipediaPageImage(title, lang, size) {
  const api = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageimages|pageprops&piprop=thumbnail&pithumbsize=${size}&titles=${encodeURIComponent(title)}&format=json&origin=*`;
  const res = await fetch(api);
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data && data.query && data.query.pages;
  const page = pages && Object.values(pages)[0];
  if (!page) return null;
  return { thumb: page.thumbnail || null, disambiguation: !!(page.pageprops && page.pageprops.disambiguation) };
}

async function fetchWikipediaImageForQuery(query, lang) {
  const title = await wikipediaSearchTitle(query, lang);
  if (!title) return null;
  const page = await wikipediaPageImage(title, lang, 1200);
  if (!page || page.disambiguation) return null;
  if (!isAcceptableWikiThumb(page.thumb)) return null;
  return page.thumb.source;
}

// ترتيب المحاولات: مدينة+دولة معًا أولًا (الأدق لفكّ أي لبس، مثل "عمان" + "الأردن" ← مدينة عمّان
// تحديدًا، أو "طرابلس" + "لبنان" بدل طرابلس ليبيا)، ثم المدينة وحدها، ثم الدولة وحدها إن لم تُذكر
// مدينة إطلاقًا — بلغة المستخدم أولًا (عربي إن كتب عربيًا) ثم الإنجليزية كمحاولة أخيرة فقط.
async function resolveDynamicDestinationImage(cityRaw, countryRaw) {
  const city = (cityRaw || '').trim();
  const country = (countryRaw || '').trim();
  if (!city && !country) return null;

  const cacheKey = normalizeDestKey(`${city}|${country}`);
  const cache = loadDynamicDestImageCache();
  if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) return cache[cacheKey];

  const hasArabic = /[؀-ۿ]/.test(city || country);
  const langs = hasArabic ? ['ar', 'en'] : ['en'];
  const sameCityCountry = city && country && normalizeDestKey(city) === normalizeDestKey(country);

  // بناء قائمة محاولات مناسبة لكل لغة على حدة (وليست نصًّا واحدًا مشتركًا) حتى لا نخلط عربيًا
  // بإنجليزي داخل الاستعلام نفسه — استعلام مُختلَط اللغة (نص عربي + كلمة إنجليزية) أثبت أنه غير
  // مستقر في ترتيب نتائج بحث ويكيبيديا (يُطابق أحيانًا صفحة مختلفة تمامًا بين محاولتين متطابقتين)،
  // لذا يبقى كل استعلام أحاديّ اللغة تمامًا. مدينة تحمل اسم دولتها نفسه (الكويت، سنغافورة...) —
  // المقالة الافتراضية لهذا الاسم في ويكيبيديا غالبًا صفحة الدولة (وصورتها الرئيسية غالبًا العلم،
  // تُرفض أدناه) وليست صفحة المدينة تحديدًا؛ نطلب صراحةً نسخة "العاصمة" أولًا بالعربية لتفادي هذا
  // الالتباس (بالإنجليزية لا حاجة لذلك: "Kuwait City"/"Singapore City" نص إنجليزي صرف أصلًا).
  function queriesForLang(lang) {
    const list = [];
    if (sameCityCountry && lang === 'ar') list.push(`${city} العاصمة`);
    if (sameCityCountry && lang === 'en' && /^[\x00-\x7F]*$/.test(city)) list.push(`${city} City`);
    if (city && country && !sameCityCountry) list.push(`${city}, ${country}`);
    if (city) list.push(city);
    if (!city && country) list.push(country);
    return list;
  }

  let found = null;
  for (const lang of langs) {
    for (const q of queriesForLang(lang)) {
      try {
        found = await fetchWikipediaImageForQuery(q, lang);
      } catch {
        found = null; // فشل شبكة — جرّب المحاولة التالية بدل كسر الميزة بالكامل
      }
      if (found) break;
    }
    if (found) break;
  }

  cache[cacheKey] = found || null;
  saveDynamicDestImageCache(cache);
  return found;
}

// تُحدِّث كل عناصر <img> المعروضة حاليًا والمخصَّصة لصورة الوجهة (معلَّمة بـ data-dest-role) —
// hero (البانرات الكبيرة) وcard (بطاقات أصغر) — بلا أي Layout Shift لأن الأبعاد ثابتة عبر CSS
// (object-fit: cover) بغضّ النظر عن نسبة أبعاد الصورة الجديدة نفسها.
function applyDynamicDestinationImage(url) {
  if (!url || typeof document === 'undefined') return;
  document.querySelectorAll('[data-dest-role="hero"], [data-dest-role="card"]').forEach((img) => {
    if (img.src !== url) img.src = url;
  });
}

let _destImgUpgradeTimer = null;
// رقم جيل مُتزايد: كل نداء جدولة جديد يحصل على رقم أحدث. عند انتهاء الانتظار الشبكي، تُطبَّق
// النتيجة فقط إن كانت لا تزال الأحدث — هذا يحل مشكلة الكتابة السريعة (تغيير الوجهة أثناء انتظار
// نتيجة بحث سابقة) دون الاعتماد على store.getTrip() الذي لا يتحدّث إلا بعد حفظ فعلي للنموذج، بينما
// هذه الميزة تعمل حتى أثناء الكتابة الحيّة قبل أي حفظ (raceCondition-safe بلا حاجة لمقارنة تخزين).
let _destImgUpgradeGeneration = 0;
// يُستدعى من صفحات العرض (trip.js/trips.js) بعد كل عرض/تحديث حيّ لبيانات الرحلة. مُهمَّل (debounced)
// حتى لا يُطلق طلب شبكة عند كل ضغطة مفتاح أثناء الكتابة — ينتظر استقرار الكتابة أولًا.
function scheduleDestinationImageUpgrade(trip) {
  if (typeof window === 'undefined') return;
  if (_destImgUpgradeTimer) clearTimeout(_destImgUpgradeTimer);
  const snapshot = { city: (trip && trip.city) || '', country: (trip && trip.country) || '' };
  const myGeneration = ++_destImgUpgradeGeneration;
  _destImgUpgradeTimer = setTimeout(() => { runDestinationImageUpgrade(snapshot, myGeneration); }, 600);
}

async function runDestinationImageUpgrade(trip, generation) {
  if (!trip || (!trip.city && !trip.country)) return;
  // تطابق مؤكَّد بالفعل (الطبقة الأولى) — لا حاجة لأي بحث ديناميكي، ولا نلمس صورته إطلاقًا
  if (getDestinationTheme(trip).key) return;

  const url = await resolveDynamicDestinationImage(trip.city, trip.country);
  if (!url) return;

  // إن حدث نداء جدولة جديد أثناء انتظار الشبكة (كتابة لاحقة غيّرت الوجهة)، هذا الجيل لم يعد
  // الأحدث — تجاهل النتيجة ولا تستبدل الصورة المعروضة حاليًا بصورة قد لا تخص الوجهة الحالية فعليًا
  if (generation !== _destImgUpgradeGeneration) return;

  applyDynamicDestinationImage(url);
}

window.scheduleDestinationImageUpgrade = scheduleDestinationImageUpgrade;
