/**
 * Register all site content with the unified search registry.
 * This file imports data from across the site and registers searchable sources.
 * @module lib/search-content
 */

import { normalizeAr } from "./text.js";
import { registry, createSource } from "./search-registry.js";

// ===================== TOOLS / PAGES =====================

const TOOLS = [
  {id:"noor", emoji:"🕌", name:"نور الهدى — المنهج التعليمي", desc:"١٨ قسمًا: المنهج وأعلام السلف، الدروس، السيرة، الأنبياء، الأسماء، الأذكار، الاختبارات والشهادات، وركن الأطفال", cat:"learn", url:"src/site/noor.html"},
  {id:"noorapp", emoji:"📱", name:"بوابة النور — التطبيق", desc:"مصحف وأذكار ومواقيت وإذاعة وزكاة وبطاقات — يعمل بدون إنترنت", cat:"learn", url:"src/app/app.html"},
  {id:"quizbank", emoji:"🧠", name:"الاختبارات والشهادات", desc:"بنك أسئلة بثلاثة أنواع، تحدٍّ أسبوعي، وشهادات إتمام تُرسم على canvas", cat:"learn", url:"src/site/noor.html#quiz"},
  {id:"groupkhatma", emoji:"📚", name:"الختمة الجماعية", desc:"وزّع الأجزاء بين المشاركين وتابع الإنجاز والإهداء", cat:"quran", url:"34-khatma.html"},
  {id:"radiohub", emoji:"📻", name:"الإذاعات الإسلامية", desc:"بث مباشر لكبار القراء وبرامج التفسير والفتوى", cat:"quran", url:"32-radio-hub.html"},
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
  {id:"libsearch", emoji:"🔎", name:"بحث شامل", desc:"دوّر في الأذكار والأحاديث والأدعية كلها من مكان واحد", cat:"dhikr", url:"23-search.html"},
  {id:"prayertimes", emoji:"🕐", name:"مواقيت الصلاة", desc:"الفجر إلى العشاء، عدّ تنازلي، طرق حساب ومذاهب متعددة", cat:"calc", url:"29-prayer-times.html"},
  {id:"hijri", emoji:"🌙", name:"التقويم الهجري", desc:"تحويل هجري ↔ ميلادي، المناسبات، والصيام المستحب", cat:"calc", url:"28-hijri.html"},
  {id:"qibla", emoji:"🧭", name:"اتجاه القبلة", desc:"زاوية القبلة من موقعك، وبوصلة حيّة تصحّح انحراف الشمال المغناطيسي", cat:"calc", url:"22-qibla.html"},
  {id:"sitesdir", emoji:"🗂️", name:"دليل المواقع الإسلامية", desc:"١٨ موقع مرجعي بشرح أقسام كل موقع", cat:"books", url:"21-sites-directory.html"},
  {id:"libsearch2", emoji:"🔎", name:"البحث في المكتبة", desc:"بحث عربي في ٤٢ ألف عنصر: الفتاوى والخطب والتاريخ والتفسير وحصن المسلم", cat:"books", url:"23-search.html"},
  {id:"libfatwa", emoji:"⚖️", name:"الفتاوى", desc:"فتاوى موثّقة مصنّفة في العبادات والمعاملات والفقه والآداب", cat:"books", url:"37-fatwa.html"},
  {id:"libtafsir", emoji:"📖", name:"التفسير الميسر", desc:"تفسير كل آية من القرآن الكريم مع معناها — ١١٤ سورة", cat:"books", url:"35-tafsir.html"},
  {id:"libsiraj", emoji:"🪔", name:"السراج في بيان غريب القرآن", desc:"معاني غريب ألفاظ القرآن — ٦١١١ لغوًا في ١١٤ سورة مع نصّ الآية وبحث في الكلمات", cat:"books", url:"43-siraj.html"},
  {id:"libhisn", emoji:"🛡️", name:"حصن المسلم", desc:"أذكار الصباح والمساء والنوم والطعام — ١٣٢ بابًا مع الصوت", cat:"books", url:"36-hisn.html"},
  {id:"libkhutbah", emoji:"🗣️", name:"الخطب", desc:"خطب ودروس في العقيدة والتزكية والأخلاق", cat:"books", url:"38-khutbah.html"},
  {id:"libtarikh", emoji:"🏛️", name:"التاريخ الإسلامي", desc:"أحداث من هجرة النبي ﷺ إلى نهاية الدولة العثمانية", cat:"books", url:"39-tarikh.html"},
  {id:"reciters", emoji:"🎙️", name:"القرّاء والتلاوة", desc:"١٥٨ قارئًا و١٧٧ إذاعة، مع تحميل السور كاملةً بلا إنترنت", cat:"quran", url:"40-reciters.html"},
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
  books: "كتب وصوتيات"
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
  { id: "library", title: "المكتبة", description: "الفتاوى والتفسير والخطب والتاريخ", route: "23-search.html", icon: "📚" },
  { id: "prayer", title: "مواقيت الصلاة", description: "أوقات الصلاة والعد التنازلي", route: "29-prayer-times.html", icon: "🕐" },
  { id: "qibla", title: "اتجاه القبلة", description: "زاوية القبلة من موقعك", route: "22-qibla.html", icon: "🧭" },
  { id: "zakat", title: "حاسبة الزكاة", description: "احسب زكاة مالك", route: "10-zakat.html", icon: "🧮" },
  { id: "hijri", title: "التقويم الهجري", description: "تحويل هجري ميلادي", route: "28-hijri.html", icon: "🌙" },
  { id: "reciters", title: "القراء والتلاوة", description: "١٥٨ قارئ و١٧٧ إذاعة", route: "40-reciters.html", icon: "🎙️" },
  { id: "videos", title: "مكتبة الفيديو", description: "قنوات يوتيوب موثّقة", route: "islamic-videos/", icon: "🎬" },
  { id: "radio", title: "الإذاعات الإسلامية", description: "بث مباشر للقراء", route: "32-radio-hub.html", icon: "📻" },
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
 */
export function registerArraySource(id, type, category, icon, title, description, items, getTitle, getDesc, getId, getRoute) {
  registry.register({
    id,
    type,
    category,
    icon,
    title,
    description,
    keywords: [category, type],
    priority: 5,
    async search(query, normalizedQuery, options = {}) {
      const q = normalizedQuery || normalizeAr(query);
      if (!q) return items.slice(0, 20).map((item, idx) => ({
        id: getId ? getId(item) : String(idx),
        type,
        category,
        icon,
        title: getTitle ? getTitle(item) : String(item),
        description: getDesc ? getDesc(item) : "",
        route: getRoute ? getRoute(item) : "#",
        score: 0,
        matchType: "content",
        sourceId: id
      }));
      
      const results = [];
      for (const item of items) {
        const title = normalizeAr(getTitle ? getTitle(item) : String(item));
        const desc = normalizeAr(getDesc ? getDesc(item) : "");
        const allText = `${title} ${desc}`;
        
        if (allText.includes(q)) {
          let score = 0;
          if (title === q) score = 100;
          else if (title.startsWith(q)) score = 80;
          else if (title.includes(q)) score = 60;
          else score = 40;
          
          results.push({
            id: getId ? getId(item) : String(item),
            type,
            category,
            icon,
            title: getTitle ? getTitle(item) : String(item),
            description: getDesc ? getDesc(item) : "",
            route: getRoute ? getRoute(item) : "#",
            score,
            matchType: title === q ? "exact" : title.includes(q) ? "title" : "content",
            sourceId: id
          });
        }
      }
      return results.sort((a, b) => b.score - a.score).slice(0, options.limit || 20);
    }
  });
}

// ===================== REGISTER DATA SOURCES =====================

// This function should be called after data modules are loaded.
// It will be called from the page scripts that have access to the data.

export async function registerDataSources() {
  // Tools and pages are already registered above.
  // Additional data sources will be registered here when their modules are loaded.
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
        return res.results.map(r => {
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
            category: "المكتبة",
            icon,
            title: r.title,
            description: r.summary || "",
            route,
            score: r.score || 0,
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
