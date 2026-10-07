/**
 * الموسوعة الإسلامية — تصنيفات المحتوى والعلاقات بين الموضوعات.
 * لا يُولَّد آليًا: يُعدّل يدويًا ليشمل كل أقسام الموقع.
 * @module data/encyclopedia-categories
 */

export const ENCYCLOPEDIA_CATEGORIES = [
  {
    id: "quran",
    title: "القرآن الكريم",
    icon: "📖",
    description: "المصحف الشريف كاملًا مع التلاوة والترجمة والتفسير والبحث",
    color: "emerald",
    route: "30-quran-full.html",
    keywords: ["قرآن", "مصحف", "سور", "آيات", "تلاوة", "حفظ", "ختم", "ورد", "جزء", "حزب", "ربع", "صفحة"],
    related: ["tafsir", "siraj", "tadabbur", "hisn", "adhkar", "prayer", "qibla"]
  },
  {
    id: "tafsir",
    title: "التفسير وعلوم القرآن",
    icon: "📚",
    description: "تفسير الآيات والسور، أسباب النزول، غريب القرآن، الناسخ والمنسوخ",
    color: "emerald",
    route: "35-tafsir.html",
    keywords: ["تفسير", "معنى", "تأويل", "ناسخ", "منسوخ", "غريب", "سبب نزول", "مكي", "مدني"],
    related: ["quran", "siraj", "quran-science", "seerah"]
  },
  {
    id: "hadith",
    title: "الحديث الشريف",
    icon: "📕",
    description: "مختارات من الكتب الستة والأربعين النووية، موثّقة بالراوي والدرجة",
    color: "amber",
    route: "27-hadith.html",
    keywords: ["حديث", "أحاديث", "صحيح", "بخاري", "مسلم", "ترمذي", "نووي", "سنن", "راوي", "درجة"],
    related: ["sunnah", "seerah", "fiqh", "aqeedah", "ethics"]
  },
  {
    id: "sunnah",
    title: "السنة النبوية",
    icon: "🌿",
    description: "أحاديث وأعمال النبي ﷺ وآداب وسنة مؤكدة",
    color: "amber",
    route: "3-arbaeen.html",
    keywords: ["سنة", "سنن", "أربعون", "نووي", "عمل", "آداب"],
    related: ["hadith", "seerah", "fiqh", "ethics"]
  },
  {
    id: "aqeedah",
    title: "العقيدة والتوحيد",
    icon: "☝️",
    description: "التوحيد، الإيمان، أسماء الله الحسنى، الصفات، الملائكة، الكتب، الرسل، اليوم الآخر، القدر",
    color: "indigo",
    route: "src/site/noor.html#manhaj",
    keywords: ["عقيدة", "توحيد", "إيمان", "أسماء الله", "صفات", "ملائكة", "كتب", "رسل", "يوم الآخر", "قدر", "شرك", "نفاق"],
    related: ["fiqh", "seerah", "prophets", "ethics", "quran"]
  },
  {
    id: "names",
    title: "أسماء الله الحسنى",
    icon: "✨",
    description: "الأسماء التسعة والتسعون بمعانيها وأدلتها وشرحها الموثوق",
    color: "indigo",
    route: "5-asmaulhusna.html",
    keywords: ["أسماء الله", "الحسنى", "معاني", "أسماء", "تسعة وتسعين", "أسماء حسنى"],
    related: ["aqeedah", "adhkar", "quran"]
  },
  {
    id: "fiqh",
    title: "الفقه الإسلامي",
    icon: "⚖️",
    description: "الطهارة، الصلاة، الزكاة، الصيام، الحج، المعاملات، الأسرة، المواريث",
    color: "teal",
    route: "src/site/noor.html#sections",
    keywords: ["فقه", "أحكام", "طهارة", "وضوء", "غسل", "صلاة", "زكاة", "صيام", "رمضان", "حج", "عمرة", "زواج", "طلاق", "ميراث", "مواريث", "معاملات", "حلال", "حرام"],
    related: ["aqeedah", "hadith", "seerah", "ibadat", "ethics"]
  },
  {
    id: "ibadat",
    title: "العبادات",
    icon: "🕌",
    description: "كيفية الوضوء والصلاة وأركانها وواجباتها ومبطلاتها",
    color: "teal",
    route: "24-ibadat.html",
    keywords: ["عبادة", "وضوء", "صلاة", "أركان", "واجبات", "سنن", "مبطلات", "طهارة", "غسل", "تيمم"],
    related: ["fiqh", "quran", "hadith", "adhkar"]
  },
  {
    id: "seerah",
    title: "السيرة النبوية",
    icon: "🕌",
    description: "حياة النبي ﷺ من المولد إلى الوفاة، الغزوات، الدعوة، الهجرة",
    color: "amber",
    route: "9-seerah.html",
    keywords: ["سيرة", "سيرة النبي", "مولد", "وحي", "هجرة", "غزوة", "فتح مكة", "حجة الوداع", "وفاة"],
    related: ["hadith", "fiqh", "aqeedah", "prophets", "history"]
  },
  {
    id: "prophets",
    title: "قصص الأنبياء",
    icon: "🌟",
    description: "قصص الأنبياء والرسل عليهم السلام وعبرها ودروسها",
    color: "violet",
    route: "8-qasas-anbiya.html",
    keywords: ["أنبياء", "رسل", "قصص", "آدم", "نوح", "إبراهيم", "موسى", "عيسى", "محمد", "قصة"],
    related: ["seerah", "aqeedah", "quran", "ethics"]
  },
  {
    id: "companions",
    title: "الصحابة والصحابيات",
    icon: "🌿",
    description: "أبرز الصحابة والصحابيات والتابعون، سيرهم ومناقبهم",
    color: "amber",
    route: "9-seerah.html#companions",
    keywords: ["صحابة", "تابعون", "أبو بكر", "عمر", "عثمان", "علي", "طلحة", "الزبير", "عائشة", "فاطمة", "خديجة", "الصحابة", "العشرة المبشرون"],
    related: ["seerah", "hadith", "history", "ethics"]
  },
  {
    id: "adhkar",
    title: "الأذكار والأدعية",
    icon: "🤲",
    description: "أذكار الصباح والمساء والنوم والطعام والسفر وأدعية القرآن والسنة",
    color: "rose",
    route: "25-azkar-shamila.html",
    keywords: ["أذكار", "ذكر", "تسبيح", "تهليل", "تكبير", "تحميد", "دعاء", "أدعية", "استغفار", "توبة", "حوقلة"],
    related: ["quran", "hadith", "prayer", "ethics"]
  },
  {
    id: "ethics",
    title: "الأخلاق والآداب",
    icon: "❤️",
    description: "الصدق، الأمانة، بر الوالدين، الصبر، الشكر، التواضع، الرحمة، العفو",
    color: "rose",
    route: "src/site/noor.html#sections",
    keywords: ["أخلاق", "آداب", "صدق", "أمانة", "بر", "والدين", "صبر", "شكر", "تواضع", "رحمة", "عفو", "إحسان", "مجلس", "كلام", "طعام"],
    related: ["hadith", "fiqh", "seerah", "aqeedah"]
  },
  {
    id: "prayer",
    title: "مواقيت الصلاة والعبادات",
    icon: "🕐",
    description: "مواقيت الصلاة، العد التنازلي، القبلة، التقويم الهجري",
    color: "teal",
    route: "29-prayer-times.html",
    keywords: ["صلاة", "مواقيت", "فجر", "ظهر", "عصر", "مغرب", "عشاء", "أذان", "إقامة", "قبلة", "تقويم", "هجري"],
    related: ["quran", "adhkar", "fiqh", "ibadat"]
  },
  {
    id: "occasions",
    title: "المناسبات والمواسم الإسلامية",
    icon: "🌙",
    description: "رمضان، العشر الأواخر، عيد الفطر، عيد الأضحى، عاشوراء، الجمعة، الأشهر الحرم",
    color: "indigo",
    route: "7-ramadan.html",
    keywords: ["رمضان", "ليلة القدر", "عشر أواخر", "عرفة", "عيد فطر", "عيد أضحى", "عاشوراء", "جمعة", "أشهر حرم", "صيام"],
    related: ["adhkar", "fiqh", "quran", "hadith"]
  },
  {
    id: "history",
    title: "التاريخ الإسلامي",
    icon: "🏛️",
    description: "عصر النبوة، الخلفاء الراشدون، العصور الإسلامية، العلماء، الإنجازات الحضارية",
    color: "stone",
    route: "39-tarikh.html",
    keywords: ["تاريخ", "إسلامي", "نبوة", "خلفاء", "راشدين", "عصور", "علماء", "مدن", "حضارة", "غزوة", "معركة"],
    related: ["seerah", "prophets", "fiqh", "aqeedah"]
  },
  {
    id: "scholars",
    title: "موسوعة العلماء",
    icon: "👳",
    description: "أبرز العلماء عبر العصور، سيرهم، مؤلفاتهم، وتراثهم",
    color: "amber",
    route: "src/site/noor.html#scholars",
    keywords: ["علماء", "عالم", "محدث", "فقيه", "مفسر", "مؤلف", "تراث", "كتب", "scholar"],
    related: ["history", "seerah", "fiqh", "aqeedah", "hadith"]
  },
  {
    id: "terms",
    title: "المصطلحات الإسلامية",
    icon: "📖",
    description: "قاموس إسلامي: تعريف، معنى، أدلة، آيات، أحاديث، مواضيع مرتبطة",
    color: "emerald",
    route: "43-siraj.html",
    keywords: ["مصطلح", "تعريف", "معنى", "مفردة", "غريب", "شرح", "قاموس", "مصطلحات"],
    related: ["quran", "hadith", "fiqh", "aqeedah"]
  },
  {
    id: "qa",
    title: "الأسئلة والأجوبة",
    icon: "❓",
    description: "أسئلة شرعية مصنّفة مصنّفة مصنّفة مصنّفة مصنّفة مصنّفة مصنّفة مصنّفة مصنّفة",
    color: "cyan",
    route: "37-fatwa.html",
    keywords: ["سؤال", "جواب", "فتوى", "سؤال وجواب", "استفسار", "حكم"],
    related: ["fiqh", "aqeedah", "hadith", "ethics"]
  },
  {
    id: "library",
    title: "المكتبة الإسلامية",
    icon: "📚",
    description: "الفتاوى، الخطب، الكتب، المقالات، التفسير الميسر، حصن المسلم، السراج",
    color: "emerald",
    route: "./",
    keywords: ["مكتبة", "كتب", "فتاوى", "خطب", "مقالات", "دروس", "شروحات"],
    related: ["quran", "hadith", "fiqh", "tafsir"]
  },
  {
    id: "lessons",
    title: "الدروس والمحاضرات",
    icon: "🎙️",
    description: "دروس ومحاضرات في القرآن والحديث والعقيدة والفقه والسيرة والأخلاق",
    color: "cyan",
    route: "33-academy.html",
    keywords: ["دروس", "محاضرات", "تعليم", "شرح", "قناة", "يوتيوب", "academy"],
    related: ["quran", "hadith", "fiqh", "seerah", "aqeedah"]
  },
  {
    id: "media",
    title: "القنوات والإذاعات",
    icon: "📻",
    description: "إذاعات قرآنية مباشرة، قنوات تعليمية، قراء، مواد مرئية",
    color: "cyan",
    route: "40-reciters.html",
    keywords: ["إذاعة", "راديو", "قنوات", "يوتيوب", "تلاوة", "بث مباشر", "قراء"],
    related: ["quran", "hadith", "fiqh", "seerah"]
  },
  {
    id: "kids",
    title: "قسم الأطفال",
    icon: "🧒",
    description: "قصص الأنبياء، تعليم الصلاة، الأذكار، الأخلاق، مسابقات",
    color: "violet",
    route: "13-kids-adab.html",
    keywords: ["أطفال", "قصص أطفال", "تعليم", "أخلاق أطفال", "أذكار أطفال"],
    related: ["prophets", "seerah", "ethics", "adhkar", "stories"]
  },
  {
    id: "learning",
    title: "التعلم الإسلامي",
    icon: "🧭",
    description: "مسارات تعلم منظمة للمبتدئين: صلاة، قرآن، عقيدة، فقه، سيرة، أذكار",
    color: "indigo",
    route: "45-learning-paths.html",
    keywords: ["تعلم", "مسار", "مبتدئ", "متوسط", "متقدم", "دورة", "خطوة", "مسار تعلم"],
    related: ["ibadat", "quran", "aqeedah", "fiqh", "seerah", "adhkar"]
  },
  {
    id: "quiz",
    title: "الاختبارات والمسابقات",
    icon: "🧠",
    description: "بنك أسئلة في القرآن والحديث والفقه والسيرة والعقيدة مع تصحيح فوري",
    color: "violet",
    route: "41-quiz.html",
    keywords: ["اختبار", "مسابقة", "سؤال وجواب", "تحدي", "شهادة", "quiz"],
    related: ["quran", "hadith", "fiqh", "seerah", "aqeedah"]
  },
  {
    id: "discover",
    title: "اكتشف شيئًا جديدًا",
    icon: "✨",
    description: "اكتشف آية، حديث، ذكر، دعاء، قصة، عالم، مصطلح، فائدة، موضوع، كتاب، أو درسًا جديدًا",
    color: "violet",
    route: "46-discover.html",
    keywords: ["اكتشف", "جديد", "عشوائي", "مفاجأة", "فائدة", "حكمة", "عالم", "مصطلح"],
    related: ["quran", "hadith", "adhkar", "prophets", "scholars", "terms", "seerah", "lessons"]
  },
  {
    id: "daily",
    title: "دليل المسلم اليومي",
    icon: "🌅",
    description: "لوحة تحكم شخصية: التاريخ الهجري، الصلاة القادمة، مواقيت الصلاة، ورد القرآن، أذكار، آية اليوم، حديث اليوم، ذكر اليوم، مهمة إيمانية",
    color: "amber",
    route: "47-daily-guide.html",
    keywords: ["يومي", "دليل", "لوحة", "تحكم", "شخصية", "صلاة قادمة", "آية اليوم", "حديث اليوم", "ذكر اليوم"],
    related: ["prayer", "quran", "adhkar", "hadith", "occasions"]
  },
  {
    id: "report",
    title: "الإبلاغ عن خطأ",
    icon: "🚨",
    description: "أبلغ عن خطأ نصي، مصدر غير صحيح، رابط لا يعمل، مشكلة تقنية، أو محتوى يحتاج مراجعة",
    color: "red",
    route: "48-report-error.html",
    keywords: ["خطأ", "بلاغ", "إبلاغ", "report", "error", "مشكلة", "تقنية"],
    related: ["library", "quran", "hadith", "fiqh"]
  },
  {
    id: "sources",
    title: "مصادر الموسوعة",
    icon: "📚",
    description: "مصادر القرآن، الحديث، التفسير، الفقه، السيرة، التاريخ، الكتب، العلماء",
    color: "emerald",
    route: "49-sources.html",
    keywords: ["مصادر", "مراجع", "كتب", "مرجع", "source", "مراجع"],
    related: ["quran", "hadith", "tafsir", "fiqh", "seerah", "scholars"]
  },
  {
    id: "jannati",
    title: "جنّتي — حديقة الذكر",
    icon: "🏡",
    description: "حديقة ذكرك: كل ضغطة تسبيح تُسقي الحديقة، مع عدّاد، أذكار، ختمة جماعية، متجر رمزي وشارات ورحلة مداومة",
    color: "green",
    route: "50-jannati.html",
    keywords: ["ذكر", "تسبيح", "حديقة", "جنتي", "جنتي", "عداد", "ختمة", "شارات", "رحلة", "مداومة", "garden", "dhikr"],
    related: ["adhkar", "dhikr", "khatma", "prayer"]
  },
  {
    id: "tools",
    title: "الأدوات الإسلامية",
    icon: "🧰",
    description: "مواقيت الصلاة، القبلة، الزكاة، التسبيح، الختمة، التقويم الهجري",
    color: "teal",
    route: "./",
    keywords: ["أداة", "أدوات", "مواقيت", "قبلة", "زكاة", "تقويم", "عداد", "تسبيح", "ختمة", "ورد"],
    related: ["prayer", "quran", "fiqh", "adhkar"]
  }
];

export const CONTENT_RELATIONS = {
  "quran": ["tafsir", "siraj", "tadabbur", "hisn", "adhkar", "prayer", "qibla", "seerah"],
  "tafsir": ["quran", "siraj", "quran-science", "seerah", "hadith"],
  "hadith": ["sunnah", "seerah", "fiqh", "aqeedah", "ethics"],
  "sunnah": ["hadith", "seerah", "fiqh", "ethics"],
  "aqeedah": ["fiqh", "seerah", "prophets", "ethics", "quran", "names"],
  "names": ["aqeedah", "adhkar", "quran"],
  "fiqh": ["aqeedah", "hadith", "seerah", "ibadat", "ethics"],
  "ibadat": ["fiqh", "quran", "hadith", "adhkar"],
  "seerah": ["hadith", "fiqh", "aqeedah", "prophets", "history", "companions"],
  "prophets": ["seerah", "aqeedah", "quran", "ethics"],
  "companions": ["seerah", "hadith", "history", "ethics"],
  "adhkar": ["quran", "hadith", "prayer", "ethics"],
  "ethics": ["hadith", "fiqh", "seerah", "aqeedah"],
  "prayer": ["quran", "adhkar", "fiqh", "ibadat"],
  "occasions": ["adhkar", "fiqh", "quran", "hadith"],
  "history": ["seerah", "prophets", "fiqh", "aqeedah", "scholars"],
  "scholars": ["history", "seerah", "fiqh", "aqeedah", "hadith"],
  "terms": ["quran", "hadith", "fiqh", "aqeedah", "siraj"],
  "qa": ["fiqh", "aqeedah", "hadith", "ethics"],
  "library": ["quran", "hadith", "fiqh", "tafsir"],
  "lessons": ["quran", "hadith", "fiqh", "seerah", "aqeedah"],
  "media": ["quran", "hadith", "fiqh", "seerah"],
  "kids": ["prophets", "seerah", "ethics", "adhkar", "stories"],
  "learning": ["ibadat", "quran", "aqeedah", "fiqh", "seerah"],
  "quiz": ["quran", "hadith", "fiqh", "seerah", "aqeedah"],
  "tools": ["prayer", "quran", "fiqh", "adhkar"]
};

/**
 * البحث في التصنيفات بالمعرف أو العنوان أو الوسوم.
 */
export function findCategory(query) {
  const q = query.trim();
  if (!q) return null;
  const normalized = q.toLowerCase();
  return ENCYCLOPEDIA_CATEGORIES.find(cat =>
    cat.id === normalized ||
    cat.title.includes(q) ||
    cat.keywords.some(kw => kw.includes(q) || q.includes(kw))
  );
}

export function getRelatedCategories(categoryId) {
  return CONTENT_RELATIONS[categoryId] || [];
}
