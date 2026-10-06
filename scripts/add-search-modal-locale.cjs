/**
 * يضيف مفاتيح نافذة البحث الشامل إلى وحدة search في ar/en،
 * ثم يزامنها لكل اللغات الأخرى من الإنجليزية كقاعدة آمنة.
 * @scripts/add-search-modal-locale.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const NEW_KEYS = {
  ar: {
    all: "الكل",
    clear: "مسح",
    browseEncyclopedia: "تصفّح الموسوعة",
    tryExample: "جرّب البحث بكلمات أخرى مثل: قرآن، أذكار، حديث، زكاة",
    hintKeys: "Ctrl+K أو / للبحث",
    hintEsc: "Esc للإغلاق",
    relaxedSearch: "واسع البحث بكلمات الاستعلام...",
    searchingCorpus: "يبحث في نصوص القرآن والحديث...",
    open: "فتح",
    titleMatch: "مطابقة العنوان",
    keywordMatch: "مطابقة الكلمة المفتاحية",
    contentMatch: "مطابقة المحتوى",
    categoryMatch: "مطابقة التصنيف",
    relaxedMatch: "بكلمة من سؤالك",
    suggestionMatch: "اقتراح",
    libraryMatch: "مطابقة في المكتبة",
    noResultsInline: "لا نتائج مطابقة.",
    lastSearches: "آخر عمليات البحث",
    fVerses: "آيات المصحف",
    fMeanings: "معاني الكلمات",
    fDuas: "الأدعية",
    fRadio: "الإذاعات",
    fBooks: "الكتب",
    fKhutb: "الخطب",
    fHisn: "حصن المسلم",
    fTests: "الاختبارات",
    fQa: "أسئلة وأجوبة",
    fLessons: "الدروس",
    fMethod: "المنهج",
    fScholars: "العلماء",
    fNames: "أسماء الله",
    fSalaf: "أقوال السلف",
    fKids: "الأطفال",
    fStories: "القصص والأنبياء",
    fEvents: "المناسبات",
    fCalculators: "الحاسبات",
    fCities: "المدن",
    fSections: "الأقسام",
    fPages: "الصفحات"
  },
  en: {
    all: "All",
    clear: "Clear",
    browseEncyclopedia: "Browse the encyclopedia",
    tryExample: "Try other keywords such as: Quran, Dhikr, Hadith, Zakat",
    hintKeys: "Ctrl+K or / to search",
    hintEsc: "Esc to close",
    relaxedSearch: "Broadening search with query words...",
    searchingCorpus: "Searching Quran and Hadith texts...",
    open: "Open",
    titleMatch: "Title match",
    keywordMatch: "Keyword match",
    contentMatch: "Content match",
    categoryMatch: "Category match",
    relaxedMatch: "Matched by a word from your query",
    suggestionMatch: "Suggestion",
    libraryMatch: "Library match",
    noResultsInline: "No matching results.",
    lastSearches: "Recent searches",
    fVerses: "Quran verses",
    fMeanings: "Word meanings",
    fDuas: "Supplications",
    fRadio: "Radio",
    fBooks: "Books",
    fKhutb: "Sermons",
    fHisn: "Hisn al-Muslim",
    fTests: "Quizzes",
    fQa: "Q&A",
    fLessons: "Lessons",
    fMethod: "Curriculum",
    fScholars: "Scholars",
    fNames: "Names of Allah",
    fSalaf: "Sayings of the Salaf",
    fKids: "Kids",
    fStories: "Stories & Prophets",
    fEvents: "Occasions",
    fCalculators: "Calculators",
    fCities: "Cities",
    fSections: "Sections",
    fPages: "Pages"
  }
};

for (const [locale, keys] of Object.entries(NEW_KEYS)) {
  const file = path.join(ROOT, 'locales', locale, 'search.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let added = 0;
  for (const [k, v] of Object.entries(keys)) {
    if (data.search[k] === undefined) { data.search[k] = v; added++; }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`${locale}: added ${added} key(s)`);
}

/* مزامنة الوحدة لكل اللغات الأخرى: مفتاحٌ غير موجود يُملأ من الإنجليزية. */
const locales = fs.readdirSync(path.join(ROOT, 'locales'))
  .filter(d => fs.statSync(path.join(ROOT, 'locales', d)).isDirectory())
  .filter(d => d !== 'ar' && d !== 'en');
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'en', 'search.json'), 'utf-8'));
for (const locale of locales) {
  const file = path.join(ROOT, 'locales', locale, 'search.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let added = 0;
  for (const [k, v] of Object.entries(en.search)) {
    if (data.search[k] === undefined) { data.search[k] = v; added++; }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`${locale}: synced ${added} key(s)`);
}
