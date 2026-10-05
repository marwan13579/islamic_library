/**
 * Register all site content with the unified search registry.
 * This file imports data from across the site and registers searchable sources.
 * @module lib/search-content
 */

import { normalizeAr } from "./text.js";
import { registry, createSource, scoreItem } from "./search-registry.js";
import { registerCorporaSources } from "./search-corpora.js";

// ===================== TOOLS / PAGES =====================

const TOOLS = [
  {id:"noor", emoji:"🕌", name:"نور الهدى — المنهج التعليمي", desc:"١٨ قسمًا: المنهج وأعلام السلف، الدروس، السيرة، الأنبياء، الأسماء، الأذكار، الاختبارات والشهادات، وركن الأطفال", cat:"learn", url:"src/site/noor.html"},
  {id:"noorapp", emoji:"📱", name:"بوابة النور — التطبيق", desc:"مصحف وأذكار ومواقيت وإذاعة وزكاة وبطاقات — يعمل بدون إنترنت", cat:"learn", url:"src/app/app.html"},
  {id:"quizbank", emoji:"🧠", name:"الاختبارات والشهادات", desc:"بنك أسئلة بثلاثة أنواع، تحدٍّ أسبوعي، وشهادات إتمام تُرسم على canvas", cat:"learn", url:"src/site/noor.html#quiz"},
  {id:"groupkhatma", emoji:"📚", name:"الختمة الجماعية", desc:"وزّع الأجزاء بين المشاركين وتابع الإنجاز والإهداء", cat:"quran", url:"34-khatma.html"},
  {id:"cardmaker", emoji:"🎴", name:"صانع البطاقات الدعوية", desc:"حوّل أي آية أو حديث أو ذكر لبطاقة صورة قابلة للتحميل والمشاركة", cat:"learn", url:"31-card-maker.html"},
  {id:"quranfull", emoji:"📖", name:"القرآن الكريم", desc:"المصحف كاملًا — سور، أجزاء، بحث، تلاوة، ترجمة وتفسير", cat:"quran", url:"30-quran-full.html"},
  {id:"dailysystem", emoji:"🕌", name:"نظام حياة المسلم", desc:"يومك مرتبط بالصلاة — صلاة، ذكر، وقرآن مع كل وقت", cat:"dhikr", url:"26-daily-system.html"},
  {id:"adhkar", emoji:"🤲", name:"الأذكار الشاملة", desc:"١٢ قسمًا: الصباح، المساء، النوم، بعد الصلاة، الوضوء، الاستغفار وغيرها", cat:"dhikr", url:"25-azkar-shamila.html"},
  {id:"dhikrkit", emoji:"📿", name:"نور الذكر", desc:"أذكار وأدعية وأحاديث في مكان واحد، مع سبحة عدّاد ورابط يُشارك لبلّغ الذكر", cat:"dhikr", url:"1-adhkar.html"},
  {id:"mushaf", emoji:"📖", name:"مُصحَفي", desc:"تتبّع حفظ القرآن الكريم كاملًا", cat:"quran", url:"2-mushaf.html"},
  {id:"hadithcol", emoji:"📕", name:"الحديث الشريف", desc:"مختارات من الكتب الستة، موثّقة بالراوي والدرجة", cat:"quran", url:"27-hadith.html"},
  {id:"arbaeen", emoji:"📜", name:"الأربعون النووية", desc:"٤٢ حديثًا جامعًا بشرح مختصر", cat:"quran", url:"3-arbaeen.html"},
  {id:"salah", emoji:"🕋", name:"تعلّم الصلاة", desc:"دليل خطوة بخطوة للأطفال وحديثي الإسلام", cat:"learn", url:"4-salah.html"},
  {id:"asma", emoji:"ﷲ", name:"أسماء الله الحسنى", desc:"الأسماء التسعة والتسعون بمعانيها", cat:"dhikr", url:"5-asmaulhusna.html"},
  {id:"munasabat", emoji:"🤲", name:"أذكار المناسبات", desc:"السفر، المرض، الهمّ، البيت، الطعام", cat:"dhikr", url:"6-munasabat.html"},
  {id:"ramadan", emoji:"🌙", name:"تقويم رمضان", desc:"دعاء ومهام كل يوم، والعشر الأواخر والعيد", cat:"learn", url:"7-ramadan.html"},
  {id:"anbiya", emoji:"🌟", name:"قصص الأنبياء", desc:"٢٥ نبيًا بقصصهم وعبرها", cat:"stories", url:"8-qasas-anbiya.html"},
  {id:"seerah", emoji:"🕌", name:"السيرة النبوية", desc:"خط زمني لحياة النبي ﷺ", cat:"stories", url:"9-seerah.html"},
  {id:"zakat", emoji:"🧮", name:"حاسبة الزكاة", desc:"احسب زكاة مالك والنصاب تلقائيًا", cat:"calc", url:"10-zakat.html"},
  {id:"hajj", emoji:"🕋", name:"دليل الحج والعمرة", desc:"خطوات المناسك ونصائح عملية", cat:"learn", url:"11-hajj-umrah.html"},
  {id:"mustajab", emoji:"🤲", name:"أوقات الإجابة", desc:"أوقات مستجابة، ودعاء ختم القرآن", cat:"dhikr", url:"12-mustajab.html"},
  {id:"kidsadab", emoji:"🌙", name:"قصص الآداب للأطفال", desc:"سبع قصص قصيرة عن الأخلاق الجميلة", cat:"stories", url:"13-kids-adab.html"},
  {id:"mawarith", emoji:"⚖️", name:"حاسبة المواريث", desc:"أنصبة الورثة في الحالات الشائعة", cat:"calc", url:"14-mawarith.html"},
  {id:"gtasbeeh", emoji:"📿", name:"تسبيح جماعي", desc:"عدّاد منفصل لكل فرد في المجلس", cat:"dhikr", url:"15-tasbeeh-jamai.html"},
  {id:"tadabbur", emoji:"📓", name:"دفتر التدبر", desc:"اكتب خواطرك على آيات القرآن", cat:"quran", url:"16-tadabbur.html"},
  {id:"wird", emoji:"📖", name:"ورد القراءة اليومي", desc:"تابع صفحاتك اليومية من القرآن", cat:"quran", url:"17-wird.html"},
  {id:"noorcompanion", emoji:"🌿", name:"رفيق النور", desc:"تذكير إيماني هادئ يضبطه أنت: الفاصل الزمني ونوع المحتوى والوضع الهادئ", cat:"dhikr", url:"44-noor-companion.html"},
  {id:"qada", emoji:"🌙", name:"متابعة صيام القضاء", desc:"سجّل الأيام الفائتة وتابع قضاءها", cat:"calc", url:"18-qada.html"},
  {id:"visiting", emoji:"🤝", name:"آداب الزيارة والعيادة", desc:"عيادة المريض، العزاء، والتهنئة", cat:"learn", url:"19-adab-ziyara.html"},
  {id:"voiceazkar", emoji:"🎙️", name:"سجّل صوتك بالأذكار", desc:"مسجّل شخصي لصوتك وأنت تذكر الله", cat:"dhikr", url:"20-voice-azkar.html"},
  {id:"ibadat", emoji:"🕌", name:"العبادات — دليل تعليمي", desc:"الوضوء، فرائض وسنن الصلاة، الصيام، والزكاة", cat:"learn", url:"24-ibadat.html"},
  {id:"prayertimes", emoji:"🕐", name:"مواقيت الصلاة", desc:"الفجر إلى العشاء، عدّ تنازلي، طرق حساب ومذاهب متعددة", cat:"calc", url:"29-prayer-times.html"},
  {id:"hijri", emoji:"🌙", name:"التقويم الهجري", desc:"تحويل هجري ↔ ميلادي، المناسبات، والصيام المستحب", cat:"calc", url:"28-hijri.html"},
  {id:"qibla", emoji:"🧭", name:"اتجاه القبلة", desc:"زاوية القبلة من موقعك، وبوصلة حيّة تصحّح انحراف الشمال المغناطيسي", cat:"calc", url:"22-qibla.html"},
  {id:"sitesdir", emoji:"🗂️", name:"دليل المواقع الإسلامية", desc:"١٨ موقع مرجعي بشرح أقسام كل موقع", cat:"books", url:"21-sites-directory.html"},
  {id:"libfatwa", emoji:"⚖️", name:"الفتاوى", desc:"فتاوى موثّقة مصنّفة في العبادات والمعاملات والفقه والآداب", cat:"books", url:"37-fatwa.html"},
  {id:"libtafsir", emoji:"📖", name:"التفسير الميسر", desc:"تفسير كل آية من القرآن الكريم مع معناها — ١١٤ سورة", cat:"books", url:"35-tafsir.html"},
  {id:"libsiraj", emoji:"🪔", name:"السراج في بيان غريب القرآن", desc:"معاني غريب ألفاظ القرآن — ٦١١١ لغوًا في ١١٤ سورة مع نصّ الآية وبحث في الكلمات", cat:"books", url:"43-siraj.html"},
  {id:"libhisn", emoji:"🛡️", name:"حصن المسلم", desc:"أذكار الصباح والمساء والنوم والطعام — ١٣٢ بابًا مع الصوت", cat:"books", url:"36-hisn.html"},
  {id:"libkhutbah", emoji:"🗣️", name:"الخطب", desc:"خطب ودروس في العقيدة والتزكية والأخلاق", cat:"books", url:"38-khutbah.html"},
  {id:"libtarikh", emoji:"🏛️", name:"التاريخ الإسلامي", desc:"أحداث من هجرة النبي ﷺ إلى نهاية الدولة العثمانية", cat:"books", url:"39-tarikh.html"},
  {id:"reciters", emoji:"🎙️", name:"القرّاء والتلاوة والإذاعات", desc:"١٥٨ قارئًا بسورهم وتلاواتهم، وإذاعات مباشرة، وتحميل السور كاملةً بلا إنترنت", cat:"quran", url:"40-reciters.html"},
  {id:"islamicvideos", emoji:"🎬", name:"مكتبة الفيديو الإسلامية", desc:"تعلّم، شاهد، واستفد — قنوات يوتيوب موثّقة مصنّفة بالعمر واللغة والمجال", cat:"books", url:"islamic-videos/"},
  {id:"libquiz", emoji:"🧠", name:"الاختبارات", desc:"٥٨٢٠ سؤالًا في التفسير والفقه والعقيدة والحديث، بتصحيح فوري", cat:"learn", url:"41-quiz.html"},
  {id:"athan", emoji:"🕌", name:"مواقيت الأذان", desc:"الصلوات الخمس بمدينتك، وتنبيه وصوت أذان عند دخول الوقت", cat:"dhikr", url:"42-athan.html"},
];

const toolCategoryMap = {
  learn: "تعليم",
  quran: "قرآن",
  dhikr: "أذكار",
  stories: "قصص",
  calc: "حاسبات",
  books: "كتب"
};

registry.register({
  id: "tools",
  type: "tools",
  category: "أدوات",
  icon: "🛠️",
  title: "الأدوات",
  description: "جميع أدوات الموقع الإسلامية",
  keywords: ["أداة", "أدوات", "مواقيت", "صلاة", "قبلة", "زكاة", "تقويم", "عداد", "تسبيح", "قرآن", "أذكار", "أدعية"],
  priority: 10,
  async search(query, normalizedQuery, options = {}) {
    const q = normalizedQuery || normalizeAr(query);
    if (!q) return TOOLS.slice(0, 20).map(t => ({
      id: t.id,
      type: "tool",
      category: toolCategoryMap[t.cat] || t.cat,
      icon: t.emoji,
      title: t.name,
      description: t.desc,
      route: t.url,
      score: 0,
      matchType: "content",
      sourceId: "tools"
    }));
    
    const results = [];
    for (const t of TOOLS) {
      const title = normalizeAr(t.name);
      const desc = normalizeAr(t.desc);
      const keywords = t.cat;
      
      if (title.includes(q) || desc.includes(q) || keywords.includes(q)) {
        let score = 0;
        if (title === q) score = 100;
        else if (title.startsWith(q)) score = 80;
        else if (title.includes(q)) score = 60;
        else if (desc.includes(q)) score = 40;
        else score = 20;
        
        results.push({
          id: t.id,
          type: "tool",
          category: toolCategoryMap[t.cat] || t.cat,
          icon: t.emoji,
          title: t.name,
          description: t.desc,
          route: t.url,
          score,
          matchType: title === q ? "exact" : title.includes(q) ? "title" : "content",
          sourceId: "tools"
        });
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, options.limit || 20);
  }
});

// ===================== PAGES =====================

const PAGES = [
  { id: "home", title: "الصفحة الرئيسية", description: "المكتبة الإسلامية - رفيق المسلم اليومي", route: "index.html", icon: "🏠" },
  { id: "quran", title: "القرآن الكريم", description: "المصحف كاملًا مع البحث والتلاوة", route: "30-quran-full.html", icon: "📖" },
  { id: "hadith", title: "الحديث الشريف", description: "مختارات من الكتب الستة", route: "27-hadith.html", icon: "📕" },
  { id: "adhkar", title: "الأذكار الشاملة", description: "أذكار الصباح والمساء والنوم", route: "25-azkar-shamila.html", icon: "🤲" },
  { id: "dhikr", title: "نور الذكر", description: "أذكار وأدعية وأحاديث", route: "1-adhkar.html", icon: "📿" },
  { id: "library", title: "المكتبة", description: "الفتاوى والتفسير والخطب والتاريخ", route: "./", icon: "📚" },
  { id: "prayer", title: "مواقيت الصلاة", description: "أوقات الصلاة والعد التنازلي", route: "29-prayer-times.html", icon: "🕐" },
  { id: "qibla", title: "اتجاه القبلة", description: "زاوية القبلة من موقعك", route: "22-qibla.html", icon: "🧭" },
  { id: "zakat", title: "حاسبة الزكاة", description: "احسب زكاة مالك", route: "10-zakat.html", icon: "🧮" },
  { id: "hijri", title: "التقويم الهجري", description: "تحويل هجري ميلادي", route: "28-hijri.html", icon: "🌙" },
  { id: "reciters", title: "القرّاء والتلاوة والإذاعات", description: "١٥٨ قارئًا و١٧٩ إذاعة", route: "40-reciters.html", icon: "🎙️" },
  { id: "videos", title: "مكتبة الفيديو", description: "قنوات يوتيوب موثّقة", route: "islamic-videos/", icon: "🎬" },
  { id: "radio", title: "الإذاعات الإسلامية", description: "بث مباشر للقراء", route: "40-reciters.html#radio", icon: "📻" },
  { id: "tafsir", title: "التفسير الميسر", description: "تفسير كل آية من القرآن", route: "35-tafsir.html", icon: "📖" },
  { id: "hisn", title: "حصن المسلم", description: "أذكار الصباح والمساء والنوم", route: "36-hisn.html", icon: "🛡️" },
  { id: "seerah", title: "السيرة النبوية", description: "خط زمني لحياة النبي", route: "9-seerah.html", icon: "🕌" },
  { id: "prophets", title: "قصص الأنبياء", description: "٢٥ نبيًا بقصصهم", route: "8-qasas-anbiya.html", icon: "🌟" },
  { id: "asma", title: "أسماء الله الحسنى", description: "التسعة والتسعون اسمًا", route: "5-asmaulhusna.html", icon: "ﷲ" },
  { id: "salah", title: "تعلم الصلاة", description: "دليل خطوة بخطوة", route: "4-salah.html", icon: "🕋" },
  { id: "hajj", title: "دليل الحج والعمرة", description: "خطوات المناسك", route: "11-hajj-umrah.html", icon: "🕋" },
  { id: "mawarith", title: "حاسبة المواريث", description: "أنصبة الورثة", route: "14-mawarith.html", icon: "⚖️" },
  { id: "khatma", title: "الختمة الجماعية", description: "وزّع الأجزاء وتابع الإنجاز", route: "34-khatma.html", icon: "📚" },
  { id: "siraj", title: "السراج في غريب القرآن", description: "معاني غريب ألفاظ القرآن", route: "43-siraj.html", icon: "🪔" },
  { id: "kids", title: "قصص الآداب للأطفال", desc: "سبع قصص عن الأخلاق", route: "13-kids-adab.html", icon: "🌙" },
  { id: "noor", title: "رفيق النور", desc: "تذكير إيماني هادئ", route: "44-noor-companion.html", icon: "🌿" },
  { id: "quiz", title: "الاختبارات", desc: "٥٨٢٠ سؤالًا", route: "41-quiz.html", icon: "🧠" },
];

registry.register({
  id: "pages",
  type: "page",
  category: "صفحات",
  icon: "📄",
  title: "الصفحات",
  description: "جميع صفحات الموقع",
  keywords: ["صفحة", "صفحات", "رئيسية", "about", "عن", "سياسة"],
  priority: 5,
  async search(query, normalizedQuery, options = {}) {
    const q = normalizedQuery || normalizeAr(query);
    if (!q) return PAGES.slice(0, 15).map(p => ({
      id: p.id,
      type: "page",
      category: "صفحات",
      icon: p.icon,
      title: p.title,
      description: p.description,
      route: p.route,
      score: 0,
      matchType: "content",
      sourceId: "pages"
    }));
    
    const results = [];
    for (const p of PAGES) {
      const title = normalizeAr(p.title);
      const desc = normalizeAr(p.description);
      
      if (title.includes(q) || desc.includes(q)) {
        let score = 0;
        if (title === q) score = 100;
        else if (title.startsWith(q)) score = 80;
        else if (title.includes(q)) score = 60;
        else score = 40;
        
        results.push({
          id: p.id,
          type: "page",
          category: "صفحات",
          icon: p.icon,
          title: p.title,
          description: p.description,
          route: p.route,
          score,
          matchType: title === q ? "exact" : "title",
          sourceId: "pages"
        });
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, options.limit || 15);
  }
});

// ===================== DYNAMIC REGISTRATION HELPERS =====================

/**
 * Register a simple array of items as a search source.
 * @param {string} id
 * @param {string} type
 * @param {string} category
 * @param {string} icon
 * @param {string} title
 * @param {string} description
 * @param {Array} items
 * @param {function} [getTitle]
 * @param {function} [getDesc]
 * @param {function} [getId]
 * @param {function} [getRoute]
 * @param {number} [priority] أفضلية المصدر في الترتيب النهائي
 */
export function registerArraySource(id, type, category, icon, title, description, items, getTitle, getDesc, getId, getRoute, priority = 5) {
  registry.register({
    id,
    type,
    category,
    icon,
    title,
    description,
    keywords: [category, type],
    priority,
    async search(query, normalizedQuery, options = {}) {
      const q = normalizedQuery || normalizeAr(query);
      const describe = (item) => {
        const body = getDesc ? getDesc(item) : "";
        // اسم المجموعة جزءٌ من وصف العنصر: به يُطابَق «أذكار الصباح» على ذكرٍّ
        // نصّه لا يذكر الصباح، وبه يعرف المستخدم أين وقع.
        const group = [item?.category, item?.cat].find((v) => typeof v === "string" && v.trim());
        return group ? `${body ? `${body} — ` : ""}${group}` : body;
      };
      if (!q) return items.slice(0, 20).map((item, idx) => ({
        id: getId ? getId(item) : String(idx),
        type,
        category,
        icon,
        title: getTitle ? getTitle(item) : String(item),
        description: describe(item),
        route: getRoute ? getRoute(item) : "#",
        score: 0,
        matchType: "content",
        sourceId: id
      }));
      
      const results = [];
      for (const item of items) {
        const title = getTitle ? getTitle(item) : String(item);
        const description = describe(item);
        const hit = scoreItem({ title, description, aliases: item?.aliases }, q);
        if (!hit) continue;
        results.push({
          id: getId ? getId(item) : String(item),
          type,
          category,
          icon,
          title,
          description,
          route: getRoute ? getRoute(item) : "#",
          score: hit.score + priority,
          matchType: hit.matchType,
          sourceId: id
        });
      }
      return results.sort((a, b) => b.score - a.score).slice(0, options.limit || 20);
    }
  });
}

// ===================== REGISTER DATA SOURCES =====================

/**
 * رابطُ ملف محتوى مطلقٌ محسوبٌ من هذه الوحدة، لا نسبةً إلى الصفحة المفتوحة:
 * فبعض الصفحات في مجلّدات (`src/site/`)، و«content/...» هناك يعني
 * `src/site/content/...` فلا وجود له.
 * @param {string} rel مسارٌ داخل `content/`
 * @returns {string}
 */
function contentUrl(rel) {
  return new URL(`../../${rel}`, import.meta.url).href;
}

/** @type {Promise<void>|null} */
let dataSourcesReady = null;

/**
 * Import one data module, or hand back an empty value if it will not load.
 * @param {string} path مسار الوحدة نسبةً إلى هذا الملف
 * @param {string} key اسم التصدير المطلوب
 * @returns {Promise<any>}
 */
async function loadData(path, key) {
  try {
    const mod = await import(/* @vite-ignore */ path);
    const value = mod[key];
    return Array.isArray(value) || (value && typeof value === "object") ? value : [];
  } catch {
    return [];
  }
}

/**
 * The data sources every page can search, registered once per page.
 *
 * They used to live in `index.html`, so the other 44 pages that mount the search
 * modal only had three sources (tools, pages, library) and searching an adhkar,
 * a dua or a scholar name there returned nothing. Registration lives here now,
 * behind a cached promise that the modal awaits on its first search, so coverage
 * no longer depends on which page opened it.
 *
 * @returns {Promise<void>}
 */
export function registerDataSources() {
  if (dataSourcesReady) return dataSourcesReady;

  dataSourcesReady = (async () => {
    // كل وحدة مستقلة: ملفٌ واحد مفقود أو معطوب يُسقط مصدره وحده، لا البحث
    // كلّه. والوعد يُخزَّن بعد نجاحه، فإن أخفق يُحاول البحث التالي من جديد.
    const [hadiths, adhkar, duas, appDuas, scholars, prophets, names99, seerah,
      lessons, extraLessons, manhaj, kids, qa, sayings, channels, questions,
      appAthkar, dailyVerses, dailyHadiths, appWisdom, cities, hijriEvents,
      stations, liveRadio, sections] = await Promise.all([
      loadData("../data/hadiths.js", "HADITHS"),
      loadData("../data/adhkar.js", "ADHKAR"),
      loadData("../data/duas.js", "DUAS"),
      loadData("../data/app-duas.js", "APP_DUAS"),
      loadData("../data/scholars.js", "SCHOLARS"),
      loadData("../data/prophets.js", "PROPHETS"),
      loadData("../data/names99.js", "NAMES99"),
      loadData("../data/seerah.js", "SEERAH"),
      loadData("../data/lessons.js", "LESSONS"),
      loadData("../data/lessons-extra.js", "EXTRA_LESSONS"),
      loadData("../data/manhaj-lessons.js", "MANHAJ_LESSONS"),
      loadData("../data/kids.js", "KIDS"),
      loadData("../data/qa.js", "QA"),
      loadData("../data/sayings.js", "SAYINGS"),
      loadData("../data/islamic-channels.js", "CHANNELS"),
      loadData("../data/question-bank.js", "QUESTION_BANK"),
      loadData("../data/app-athkar.js", "ATHKAR_DATA"),
      loadData("../data/daily.js", "DAILY_VERSES"),
      loadData("../data/daily.js", "DAILY_HADITHS"),
      loadData("../data/app-daily.js", "APP_DAILY_WISDOM"),
      loadData("../data/cities.js", "CITY_NAMES_AR"),
      loadData("../data/hijri-events.js", "HIJRI_EVENTS"),
      loadData("../data/radio.js", "RADIO_STATIONS"),
      loadData("../data/radio-live.js", "LIVE_STATIONS"),
      loadData("../site/sections.js", "SECTIONS"),
    ]);

    // المفاتيح تُؤخذ من الكائن نفسه لا من ثوابت مصاحبة، فلا يحتاج هذا الملف
    // استيرادًا إضافيًّا لكل مجموعة.
    const adhkarItems = Object.entries(adhkar).flatMap(([key, group]) =>
      (group?.items || []).map((item, idx) => ({
        ...item,
        category: group?.title || "",
        id: `${key}-${idx}`,
      })));
    const duaItems = Object.entries(duas).flatMap(([key, group]) =>
      (group?.items || []).map((item, idx) => ({
        ...item,
        category: group?.title || "",
        id: `${key}-${idx}`,
      })));

    registerArraySource(
      "hadiths", "hadith", "حديث", "📕", "الأحاديث", "الأحاديث النبوية الشريفة",
      hadiths,
      (h) => h.title,
      (h) => `${h.text} ${h.ref || ""}`,
      (h) => String(h.id),
      (h) => `27-hadith.html#hadith-${h.id}`,
    );

    registerArraySource(
      "adhkar", "dhikr", "أذكار", "🤲", "الأذكار", "الأذكار والأدعية",
      adhkarItems,
      (item) => item.txt || "",
      (item) => `${item.src || ""} ${item.count ? `(${item.count}×)` : ""}`,
      (item) => item.id,
      () => "25-azkar-shamila.html",
    );

    registerArraySource(
      "duas", "dua", "أدعية", "🤲", "أدعية المناسبات", "دعاء السفر والمرض والهمّ والطعام",
      duaItems,
      (item) => item.txt || "",
      (item) => `${item.src || ""} ${item.category || ""}`,
      (item) => item.id,
      () => "6-munasabat.html",
    );

    registerArraySource(
      "appduas", "dua", "أدعية", "🤲", "أدعية التطبيق", "أدعية صلاة الاستخارة والهمّ والحج",
      appDuas,
      (item) => item.title || "",
      (item) => `${item.text || ""} ${item.ref || ""}`,
      (item) => String(item.title || item.cat || "").slice(0, 40),
      () => "src/app/app.html#dua",
    );

    registerArraySource(
      "scholars", "scholar", "علماء", "👤", "أعلام السلف", "علماء وأعلام السلف",
      scholars,
      (s) => s.name,
      (s) => `${s.bio || ""} ${s.tag || ""} ${s.era || ""}`,
      (s) => String(s.name),
      () => "src/site/noor.html#scholars",
    );

    registerArraySource(
      "prophets", "prophet", "قصص", "🌟", "قصص الأنبياء", "قصص الأنبياء والرسل",
      prophets,
      (p) => p.title,
      (p) => `${p.desc || ""} ${p.story || ""}`,
      (p) => String(p.title),
      () => "8-qasas-anbiya.html",
    );

    registerArraySource(
      "names", "name", "أسماء الله", "ﷲ", "أسماء الله الحسنى", "الأسماء الحسنى ومعانيها",
      names99,
      (n) => n.n,
      (n) => n.m,
      (n) => String(n.n),
      () => "5-asmaulhusna.html",
    );

    registerArraySource(
      "seerah", "seerah", "سيرة", "🕌", "السيرة النبوية", "محطات من حياة النبي ﷺ",
      seerah,
      (s) => s.title,
      (s) => `${s.desc || ""} ${s.year || ""}`,
      (s) => String(s.title),
      () => "9-seerah.html",
    );

    registerArraySource(
      "lessons", "lesson", "تعليم", "📚", "الدروس الفقهية", "دروس الطهارة والأحكام والآداب",
      [...lessons, ...extraLessons],
      (l) => l.title,
      (l) => `${l.desc || ""} ${l.cat || ""}`,
      (l) => String(l.id ?? l.title),
      (l) => `src/site/noor.html#lesson/${l.id}`,
    );

    registerArraySource(
      "manhaj", "lesson", "منهج", "📖", "منهج سلف الأمة", "دروس منهجية في العقيدة والأصول",
      manhaj,
      (l) => l.title,
      (l) => `${l.desc || ""} ${l.cat || ""}`,
      (l) => l.id,
      (l) => `src/site/noor.html#lesson/${l.id}`,
    );

    registerArraySource(
      "kids", "kids", "أطفال", "🧒", "ركن الأطفال", "دروس وقصص مبسطة للصغار",
      kids,
      (k) => `${k.emoji || ""} ${k.title}`,
      (k) => `${k.desc || ""} ${k.age || ""}`,
      (k) => String(k.title),
      () => "src/site/noor.html#kids",
    );

    registerArraySource(
      "qa", "qa", "أسئلة", "❓", "أسئلة وأجوبة", "أسئلة شائعة عن المنهج والمحتوى",
      qa,
      (item) => item.q,
      (item) => item.a,
      (item) => String(item.q).slice(0, 40),
      () => "src/site/noor.html#qa",
    );

    registerArraySource(
      "sayings", "saying", "أقوال", "❝", "أقوال السلف", "أقوال مختارة لعلماء السلف",
      sayings,
      (s) => s.txt,
      (s) => `${s.author || ""} ${s.src || ""}`,
      (s) => String(s.txt).slice(0, 40),
      () => "src/site/noor.html#sayings",
    );

    registerArraySource(
      "channels", "channel", "فيديو", "🎬", "قنوات مصنّفة", "قنوات يوتيوب موثّقة ومعتمدة",
      channels,
      (c) => c.nameAr || c.nameEn || "",
      (c) => `${c.descriptionAr || c.descriptionEn || ""} ${(c.keywords || []).join(" ")}`,
      (c) => String(c.id),
      () => "islamic-videos/index.html",
    );

    // بنك الأسئلة: أسئلةٌ في مجموعات، لا سطورًا متفرّقة.
    const questionRows = Object.values(questions || {}).flatMap((group) =>
      (group?.questions || []).map((item, idx) => ({
        ...item,
        group: group?.title || "",
        id: `${group?.key || "q"}-${idx}`,
      })));

    registerArraySource(
      "questions", "quiz", "اختبارات", "🧠", "بنك الأسئلة", "أسئلة الفقه والعقيدة والتاريخ واللغة",
      questionRows,
      (item) => item.q || item.d || "",
      (item) => `${item.q || ""} ${(item.o || []).join(" ")} ${item.e || ""} ${item.group || ""}`,
      (item) => item.id,
      () => "src/site/noor.html#quiz",
    );

    // أذكار التطبيق: مجموعاتٌ بأبنائها، والذكر عنوانه نصُّه.
    const appAthkarItems = (Array.isArray(appAthkar) ? appAthkar : []).flatMap((group, gi) =>
      (group?.items || []).map((item, idx) => ({
        text: item.text || item.t || "",
        category: group?.category || "",
        id: `${gi}-${idx}`,
      })));

    registerArraySource(
      "appathkar", "dhikr", "أذكار", "🤲", "أذكار التطبيق", "أذكار بوابة النور",
      appAthkarItems,
      (item) => item.text,
      (item) => item.category,
      (item) => item.id,
      () => "src/app/app.html#tab/athkar",
    );

    registerArraySource(
      "daily", "verse", "آيات", "📅", "آيات وأحكام يومية", "آياتٌ وحديثٌ يُتلى كل يوم",
      [
        ...(Array.isArray(dailyVerses) ? dailyVerses : []).map((item, idx) => ({
          text: item.ayah || "",
          ref: item.ref || "",
          id: `verse-${idx}`,
        })),
        ...(Array.isArray(dailyHadiths) ? dailyHadiths : []).map((item, idx) => ({
          text: item.text || "",
          ref: item.src || item.ref || "",
          id: `hadith-${idx}`,
        })),
        ...(Array.isArray(appWisdom) ? appWisdom : []).map((item, idx) => ({
          text: item.text || item.t || "",
          ref: item.ref || item.author || "",
          id: `wisdom-${idx}`,
        })),
      ],
      (item) => item.text,
      (item) => item.ref,
      (item) => item.id,
      () => "26-daily-system.html",
    );

    // المدن: اسمُها يوصل إلى مواقيت الصلاة والقبلة فيها، فالسؤال عنها سؤالٌ
    // عن أداة لا عن نصّ.
    registerArraySource(
      "cities", "city", "مدن", "🏙️", "المدن", "مدنٌ مواقيتُها وقبلتُها محفوظة",
      Object.values(cities || {}),
      (name) => name,
      () => "مواقيت الصلاة والقبلة",
      (name) => String(name),
      () => "29-prayer-times.html",
    );

    registerArraySource(
      "hijri", "event", "مناسبات", "🌙", "المناسبات الهجرية", "أعيادٌ ومناسباتٌ وصيامٌ مستحب",
      Array.isArray(hijriEvents) ? hijriEvents : [],
      (item) => item.title,
      (item) => item.date || "",
      (item) => String(item.title),
      () => "28-hijri.html",
    );

    registerArraySource(
      "stations", "radio", "إذاعة", "📻", "محطات الإذاعة", "إذاعاتٌ ومحطاتٌ في صفحة القرّاء والتلاوة",
      Array.isArray(stations) ? stations : [],
      (item) => item.name,
      (item) => item.cat || item.category || "",
      (item) => String(item.name),
      () => "40-reciters.html#radio",
    );

    /* المحطات المفحوصة تُبحث مثل غيرها، فمن كتب اسمَ شيخٍ لم يرد في بيان
       محطات التطبيق وجد بثَّه. */
    registerArraySource(
      "liveradio", "radio", "إذاعة", "📻", "إذاعاتٌ مفحوصة", "محطاتٌ ثبت عملُها حيًّا",
      Array.isArray(liveRadio) ? liveRadio : [],
      (item) => item.name,
      (item) => item.category || "",
      (item) => String(item.link || item.name),
      () => "40-reciters.html#radio",
    );

    registerArraySource(
      "sections", "section", "أقسام", "🧭", "أقسام الموقع", "أقسامُ نور الهدى ومنهجُه",
      Array.isArray(sections) ? sections : [],
      (item) => item.title,
      (item) => item.blurb || "",
      (item) => String(item.id),
      (item) => `src/site/noor.html#${item.id}`,
    );

    registerCorporaSources();
    await registerJsonSources();
  })();

  return dataSourcesReady;
}

/**
 * Sources that live in JSON on disk rather than in a data module: the 114 surah
 * names, the reciters, and the radio stations. A missing or slow file only
 * removes its own source, never the others.
 *
 * @returns {Promise<void>}
 */
async function registerJsonSources() {
  const files = [
    ["content/surahs.json", "surahs", "quran", "قرآن", "📖", "سور القرآن", "سور القرآن الكريم", "30-quran-full.html", (s) => `${s.verses} آية`, 12],
    ["content/reciters.json", "reciters", "reciter", "قرّاء", "🎙️", "القرّاء", "قرّاء القرآن وتلاواتهم", "40-reciters.html", (r) => `${r.riwaya || ""} ${r.letter || ""}`.trim(), 4, (r) => r.riwaya || ""],
    ["content/radio.json", "radio", "radio", "إذاعة", "📻", "الإذاعات", "إذاعات إسلامية مباشرة", "40-reciters.html#radio", (r) => r.category || "", 4],
  ];

  await Promise.all([
    ...files.map((file) => registerJsonSource(...file)),
    registerAzkarShamila(),
  ]);
}

/** «سورة ١٨» بأرقامها العربية والإنجليزية: المطابقة تجري على نصٍّ مطبَّع. */
const SURAH_BY_NO = /(?:^| )(?:سوره|سورة) (\d{1,3})$/;

/**
 * A JSON file registered as a flat searchable list.
 * @returns {Promise<void>}
 */
async function registerJsonSource(file, id, type, category, icon, title, description, page, describe, priority = 4, label = null) {
  if (registry.get(id)) return;
  let rows = [];
  try {
    const response = await fetch(contentUrl(file));
    if (!response.ok) return;
    const json = await response.json();
    rows = Array.isArray(json) ? json : (json[id] || json.reciters || json.stations || []);
  } catch {
    return;
  }
  if (!rows.length) return;

  // قارئٌ واحد له رواياتٌ عدّة فيُكرَّر اسمه في الملف، فتظهر النتائج cinco
  // مرّات بالاسم نفسه. يُضاف الرواية إلى العنوان عند التكرار، ويُترك
  // الوصف فارغًا فيه بدل أن يقول مرّتين ما قاله العنوان.
  const nameCounts = new Map();
  for (const row of rows) {
    const name = row.name || row.nameAr || "";
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  }

  registry.register({
    id,
    type,
    category,
    icon,
    title,
    description,
    keywords: [category, title],
    priority,
    async search(query, normalizedQuery, options = {}) {
      const q = normalizedQuery || normalizeAr(query);
      if (!q) return [];
      const limit = options.limit || 20;
      const results = [];
      for (const row of rows) {
        const name = row.name || row.nameAr || "";
        const detail = (describe(row) || "").trim();
        const suffix = (label ? (label(row) || "") : detail).trim();
        const repeated = nameCounts.get(name) > 1 && Boolean(suffix);
        const item = {
          id: String(row.no ?? row.id ?? name),
          type: type === "quran" ? "surah" : type,
          category,
          icon,
          // السورة تُعرض باسمها مع «سورة» وتُطابَق باسمها المجرّد أيضًا:
          // «سورة الملك» و«الملك» اسمان لها، والأول أدقّ في البحث.
          title: type === "quran" ? `سورة ${name}` : repeated ? `${name} — ${suffix}` : name,
          aliases: type === "quran" ? [name] : [],
          description: repeated ? "" : detail,
          route: type === "quran" ? `${page}#surah-${row.no}` : page,
        };
        // «سورة ١٨» و«سوره 18»: السورة برقمها، وهي أرقامٌ نعرفها، فلا يُترك
        // الهاتفُ يبحث عنها باسمٍ لا يعرفه. ويُفحص قبل المطابقة لا بعدها:
        // فالرقمُ ليس كلمةً في العنوان، فالمطابقةُ كانت تُسقطه قبل أن يُرى.
        const byNumber = type === "quran" && SURAH_BY_NO.exec(q);
        if (byNumber) {
          if (Number(byNumber[1]) !== row.no) continue;
          results.push({
            ...item,
            // فوق كل ما يبلغه غيرها: الموضعُ المطلوب هو الجواب لا غير.
            score: 160,
            matchType: "exact",
            sourceId: id,
            route: `${page}?s=${row.no}&a=1`
          });
          continue;
        }

        const hit = scoreItem(item, q);
        if (!hit) continue;
        if (type === "quran" && normalizeAr(row.nameEn || "").includes(q)) {
          item.title = `سورة ${name} — ${row.nameEn}`;
        }
        results.push({
          ...item,
          score: hit.score + priority,
          matchType: hit.matchType,
          sourceId: id
        });
      }
      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  });
}

/**
 * The comprehensive adhkar of `content/azkar.json`: six groups of dhikr whose
 * titles carry the group name ("أذكار الصباح - …"), so the group words match
 * even when the dhikr text itself never says them.
 *
 * Each group also produces one section result, because searching a section name
 * should land on that section and not on one arbitrary dhikr inside it.
 *
 * @returns {Promise<void>}
 */
async function registerAzkarShamila() {
  if (registry.get("azkarShamila")) return;
  let groups = [];
  try {
    const response = await fetch(contentUrl("content/azkar.json"));
    if (!response.ok) return;
    groups = await response.json();
  } catch {
    return;
  }
  if (!Array.isArray(groups)) return;

  const PAGE = "25-azkar-shamila.html";
  // The page opens a section from the hash, but under its own ids, not the keys
  // of this file. Only the groups the page names get a deep link.
  const HASHES = {
    morning: "sabah",
    evening: "masaa",
    sleeping: "nawm",
    food: "taam",
    prayer: "salah_ba3d",
  };

  const sections = groups.map((group) => ({
    id: `section-${group.key || ""}`,
    label: group.category || group.key || "",
    count: (group.array || []).length,
    route: `${PAGE}${HASHES[group.key] ? `#${HASHES[group.key]}` : ""}`,
  })).filter((section) => section.label);

  const rows = groups.flatMap((group) => {
    const route = `${PAGE}${HASHES[group.key] ? `#${HASHES[group.key]}` : ""}`;
    return (group.array || []).map((item, idx) => ({
      id: `${group.key || ""}-${item.id ?? idx}`,
      group: group.category || group.key || "",
      title: item.title || "",
      text: item.adhkar || "",
      note: item.description || "",
      route,
    }));
  });
  if (!rows.length) return;

  const count = (n) => new Intl.NumberFormat("ar-EG").format(n);

  registry.register({
    id: "azkarShamila",
    type: "dhikr",
    category: "أذكار",
    icon: "🤲",
    title: "الأذكار الشاملة",
    description: "الصباح والمساء والنوم والطعام وبعد الصلاة والتسابيح",
    keywords: ["أذكار", "ذكر", "تسبيح", "تسابيح", "أدعية"],
    priority: 8,
    async search(query, normalizedQuery, options = {}) {
      const q = normalizedQuery || normalizeAr(query);
      if (!q) return [];
      const limit = options.limit || 20;
      const results = [];
      for (const section of sections) {
        const item = {
          id: section.id,
          type: "dhikr",
          category: "أذكار",
          icon: "🤲",
          title: section.label,
          description: `${count(section.count)} ذكرًا في الأذكار الشاملة`,
          route: section.route,
        };
        const hit = scoreItem(item, q);
        if (!hit) continue;
        results.push({
          ...item,
          score: hit.score + 8,
          matchType: hit.matchType,
          sourceId: "azkarShamila",
        });
      }
      for (const row of rows) {
        const item = {
          id: row.id,
          type: "dhikr",
          category: "أذكار",
          icon: "🤲",
          title: row.title,
          // اسم المجموعة في نصّ المطابقة لا في الوصف المعروض: هو ما يجعل
          // «أذكار الصباح» تصل إلى ذكرٍّ لا يذكر الصباح.
          description: `${row.text} ${row.note} ${row.group}`.trim(),
          route: row.route,
        };
        const hit = scoreItem(item, q);
        if (!hit) continue;
        results.push({
          ...item,
          description: `${row.group}${row.note ? ` — ${row.note}` : ""}`,
          score: hit.score,
          matchType: hit.matchType,
          sourceId: "azkarShamila",
        });
      }
      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  });
}

// ===================== LIBRARY CONTENT =====================

const TYPE_LABELS = {
  fatwa: "فتاوى",
  tafsir: "تفسير",
  hisn: "حصن المسلم",
  khutbahs: "خطب",
  history: "تاريخ",
  quiz: "اختبارات",
};

const TYPE_ICONS = {
  fatwa: "⚖️",
  tafsir: "📖",
  hisn: "🛡️",
  khutbahs: "🗣️",
  history: "🏛️",
  quiz: "🧠",
};

/** الفئات التي تُسمّي بها المكتبةُ نتائجها، فهي فئاتٌ لا مصادر. */
export const LIBRARY_CATEGORIES = Object.values(TYPE_LABELS);

/**
 * كل فئةٍ يمكن أن تُظهرها النتائج: فئات المصادر، وفئات المكتبة.
 * شريطُ التبويبات في النافذة يُبنى منها، فتبويبٌ لفئةٍ لا تُنتجها نتيجةٌ أبدًا
 * لا يمكن أن يبقى في الشريط مُعطِّلَ التصفية.
 * @returns {string[]}
 */
export function resultCategories() {
  return [...new Set([
    // المصادر «المظلّة» تُسمّي نتائجها بنفسها (المكتبة)، فهي ليست فئةً.
    ...registry.getAll().filter((s) => !s.umbrella).map((source) => source.category),
    // الأدوات تُصنَّف كلٌّ منها على حدة («كتب» و«حاسبات»)، ففئتُها ليست
    // «أدوات» وحدها، وإلّا صارت فئاتٌ ظاهرة في الشريط بلا ما يُنتجها.
    ...Object.values(toolCategoryMap),
    ...LIBRARY_CATEGORIES,
  ])];
}

const TYPE_PAGES = {
  fatwa: "37-fatwa.html",
  tafsir: "35-tafsir.html",
  hisn: "36-hisn.html",
  khutbahs: "38-khutbah.html",
  history: "39-tarikh.html",
  quiz: "41-quiz.html",
};

try {
  const librarySearch = (await import("./search.js")).search;
  registry.register({
    id: "library",
    type: "library",
    category: "المكتبة",
    // المصدر «المظلّة»: كل نتيجة من المكتبة تُسمّى بنوعها (فتاوى، تفسير، خطب)،
    // فلا نتيجة واحدة تحمل اسم «المكتبة». فهي مظلّةٌ لا فئة، وفئاتها هي
    //فئاتُها.
    umbrella: true,
    icon: "📚",
    title: "المكتبة",
    description: "الفتاوى، التفسير، الخطب، التاريخ، الاختبارات، حصن المسلم، السراج",
    keywords: ["مكتبة", "كتب", "فتاوى", "تفسير", "خطب", "تاريخ", "اختبار", "حصن المسلم", "سراج"],
    priority: 5,
    async search(query, normalizedQuery, options = {}) {
      const q = normalizedQuery || query;
      if (!q) return [];
      try {
        const res = await librarySearch(q, { limit: options.limit || 20 });
        // درجات محرّك المكتبة بمقياسه (بالآلاف)، ودرجات بقية المصادر ٠–١٠٠.
        // بلا تقريب كانت نتيجةٌ واحدة من المكتبة تطغى على كل ما عداها مهما
        // كانت أضعف مطابقةً. فتسحب الدرجة إلى النطاق نفسه: النصيبُ يبقى بين
        // ٢٠ و٧٠ — محتواها أغزرُ من غيرها، لكن مطابقةُ اسمٍ تامّةً في مصدرٍ
        // صغير يجب أن تعلوها، وإلّا ابتلع الفتاوىُ سؤالَ «الزكاة» عن حاسبة
        // الزكاة وكلَّ مَن سأل عن أي شيء.
        const top = Math.max(1, ...res.results.map((r) => r.score || 0));
        const weak = 20;
        const seen = new Set();
        return res.results
          .filter((r) => {
            const key = `${r.type}|${r.id}|${r.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((r) => {
          const label = TYPE_LABELS[r.type] || r.type;
          const icon = TYPE_ICONS[r.type] || "📄";
          const page = TYPE_PAGES[r.type];
          let route = page || "#";
          if (r.type === "tafsir" && r.extra && Array.isArray(r.extra) && r.extra[0]) {
            route = `35-tafsir.html?s=${encodeURIComponent(r.extra[0])}`;
          } else if (r.type === "hisn" && r.id) {
            const bab = /^hisn-(\d+)$/.exec(r.id);
            if (bab) route = `36-hisn.html?no=${encodeURIComponent(bab[1])}`;
          } else if (!page) {
            route = `reader.html?type=${encodeURIComponent(r.type)}&id=${encodeURIComponent(r.id)}`;
          }
          return {
            id: r.id,
            type: r.type,
            // الفئة من نوع النصّ نفسه لا "المكتبة" كلّها: فتبويب «الفتاوى»
            // و«التفسير» و«التاريخ» صار له ما يُصفّي به، بدل أن يجيب "لا نتائج"
            // مهما نصّ عليه المستخدم.
            category: label,
            icon,
            title: r.title,
            description: r.summary || "",
            route,
            score: weak + (70 - weak) * ((r.score || 0) / top),
            matchType: "content",
            sourceId: "library"
          };
        });
      } catch (e) {
        return [];
      }
    }
  });
} catch (e) {
  // Library search not available
}
