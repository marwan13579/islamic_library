/**
 * مدوّدة البحث النصّي العميق: آيات المصحف، وحصن المسلم، والتفسير الميسر،
 * ومعاني غريب القرآن.
 *
 * لماذا ملفٌ مستقلّ للمحرّك: هذه المتون كبيرة (٤ ميغابايت)، ولا داعي أن
 * تُحمَّل مع فتح النافذة. بُنيت في `content/corpora/` نصًّا منقّىً للعرض
 * (انظر `scripts/build-search-corpora.cjs`)، ويُحمَّل منها corpusٌ واحد عند
 * الحاجة ويُحفظ في الذاكرة، فكل بحث بعده فوريّ، ويُطبَّع نصُّه مرّةً واحدة
 * عند التحميل لا في كل ضغطة مفتاح.
 *
 * ولا تُحمَّل كلها أولَ بحث: البحث السريع يمرّ على المصادر الصغيرة أولًا، ولا
 * تُفتح المدوّدة إلا إذا دلّ الاستعلام على أنه يبحث في نصٍّ (سورة، آية، معنى
 * كلمة، شرح) أو لم يأتِ من المصادر الصغيرة ما يكفيه.
 *
 * @module lib/search-corpora
 */

import { normalizeAr } from "./text.js";
import { registry, scorePrepared } from "./search-registry.js";

/** صفحاتُ المتون، وهي التي تقرأ معاملات الروابط التي تُبنى لها. */
const QURAN_PAGE = "30-quran-full.html";
const TAFSIR_PAGE = "35-tafsir.html";
const HISN_PAGE = "36-hisn.html";
const SIRAJ_PAGE = "43-siraj.html";

/** @type {Map<string, Promise<any>>} */
const loading = new Map();

/**
 * رابطُ ملف المدوّدة مطلقٌ محسوبٌ من هذا الملف، لا نسبةً إلى الصفحة المفتوحة:
 * فالمكتبةُ تُفتح من `src/site/noor.html` أيضًا، و«content/...» هناك يعني
 * `src/site/content/...` فلا وجود له.
 * @param {string} path مسارٌ داخل `content/corpora/`
 * @returns {string}
 */
function corpusUrl(path) {
  return new URL(`../../content/corpora/${path}`, import.meta.url).href;
}

/** كم جزءًا يُجلَب معًا، فالحزم الصغيرة تخدم استجابةً واحدة. */
const FETCH_CONCURRENCY = 4;

/**
 * يحمّل مدوّدة: بيانها ثم أجزاءها، بأقصى أربعة أجزاءٍ في وقتٍ واحد.
 *
 * المدوّدةُ منقسمةٌ إلى أجزاء لأنّ قاعدة المشروع ألّا يتجاوز ملفٌ في `content/`
 * ستّمئةَ كيلوبايت. تُجمَع الأجزاءُ في الذاكرة بعد تحميلها، فكلُّ بحثٍ بعدها
 * لا يقرأ الشبكة أصلًا.
 * @param {string} name اسم المدوّدة
 * @returns {Promise<{meta: any, rows: any[]}>}
 */
function loadCorpus(name) {
  if (loading.has(name)) return loading.get(name);
  const request = (async () => {
    const head = await fetch(corpusUrl(`${name}/index.json`));
    if (!head.ok) throw new Error(`تعذّر تحميل مدوّدة ${name}`);
    const meta = await head.json();
    const files = meta.files || [];

    /** @type {any[]} */
    const rows = [];
    for (let i = 0; i < files.length; i += FETCH_CONCURRENCY) {
      const batch = files.slice(i, i + FETCH_CONCURRENCY);
      const parts = await Promise.all(batch.map(async (file) => {
        const response = await fetch(corpusUrl(`${name}/${file}`));
        if (!response.ok) throw new Error(`تعذّر تحميل جزء ${file} من ${name}`);
        return response.json();
      }));
      for (const part of parts) rows.push(...part);
    }
    return { meta, rows };
  })();
  loading.set(name, request);
  // فشل التحميل لا يبقى في الذاكرة، فيُحاول البحث التالي من جديد.
  request.catch(() => loading.delete(name));
  return request;
}

/** @param {number} value @returns {string} */
function arNum(value) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

/** @param {string} value @returns {string} */
function cut(value, length = 170) {
  const text = String(value || "").trim();
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

/**
 * هل لمصطلحٍ ما موضعٌ في نصٍّ مطبَّع؟ ببدايةِ كلمةٍ تكفي: «نور» تجد «النور».
 * @param {string} text نصٌّ مطبَّع
 * @param {string} term مصطلحٌ مطبَّع
 * @returns {boolean}
 */
function termIn(text, term) {
  if (!text || !term) return false;
  if (text.includes(term)) return true;
  if (term.length < 3) return false;
  return text.split(" ").some((word) => word.startsWith(term));
}

/**
 * يحضّر عنصرًا للمطابقة مرّةً واحدة: العنوان وأسماؤه البديلة على نصٍّ مطبَّع،
 * ونصّه الأصلي محفوظٌ للعرض كما هو فلا يُشوَّه التشكيل.
 * @param {{title: string, aliases?: string[], keywords?: string}} item
 * @returns {{titles: string[], desc: string, keywords: string}}
 */
function preparedOf(item) {
  const desc = normalizeAr(item.aliases?.[0] || "");
  return {
    titles: [normalizeAr(item.title || ""), ...(item.aliases || []).map(normalizeAr)],
    desc,
    keywords: normalizeAr(item.keywords || ""),
  };
}

/* ------------------------------------------------------------- آيات المصحف */

/** @type {Promise<any>|null} */
let quranRows = null;

/** @returns {Promise<{rows: any[], juzStart: any[], surahs: any[]}>} */
function quranData() {
  if (!quranRows) {
    quranRows = loadCorpus("quran").then(({ meta, rows: raw }) => {
      const rows = raw.map((row) => {
        const [surah, ayah, juz, page, hizb, surahName, text] = row;
        return {
          // الاسم مطبَّعٌ كذلك: «البقرة» تُكتب في الاستعلام «البقره» بعد
          // التطبيع، فالمقارنةُ بنصٍّ خام تفشل وتضيع رفعةُ الآية المطلوبة.
          meta: { surah, ayah, juz, page, hizb, surahName, surahNameNorm: normalizeAr(surahName), text },
          prepared: preparedOf({
            title: `${surahName}:${ayah}`,
            aliases: [text],
            keywords: `${surahName} ${arNum(surah)} ${arNum(ayah)} ${arNum(juz)} ${arNum(page)} ${arNum(hizb)}`,
          }),
        };
      });
      return { rows, juzStart: meta.juzStart || [], surahs: meta.surahs || [] };
    });
    quranRows.catch(() => { quranRows = null; });
  }
  return quranRows;
}

/** رقمٌ في آخر الاستعلام: «البقرة ٢٥٥» و«سورة الملك 3». */
const TRAILING_NUMBER = /\s(\d{1,4})$/;

function registerQuranCorpus() {
  registry.register({
    id: "corpusQuran",
    type: "ayah",
    category: "آيات",
    icon: "📖",
    title: "آيات القرآن",
    description: "نصّ المصحف كاملًا — ابحث بلفظٍ من آية",
    keywords: ["قرآن", "مصحف", "آية", "آيات", "سورة", "كلمة", "جزء", "صفحة", "حزب"],
    priority: 9,
    lazy: true,
    corpus: "quran",
    async search(query, normalizedQuery, options = {}) {
      const q = normalizedQuery || normalizeAr(query);
      if (!q) return [];
      const limit = options.limit || 20;
      const { rows, juzStart, surahs } = await quranData();

      const wantedAyah = TRAILING_NUMBER.exec(q);
      const results = [];

      for (const row of rows) {
        const hit = scorePrepared(row.prepared, q);
        if (!hit) continue;
        let score = hit.score;
        // «البقرة ٢٥٥» ليست سؤالًا عن كلمة بل عن موضع بعينه، فترتفع الآيةُ
        // المطلوبة فوق كلّ ما يشاركها في لفظها — ومنه ذكرُ آية الكرسي في
        // أذكار الصباح، وهو مطابقٌ في النصّ لكنه ليس الموضع المطلوب. ولا يُرفع
        // رقمٌ في سورةٍ لم يسمّها المستخدم، وإلّا رفع كلُّ آيةٍ رقمُها ٣ فوق
        // كل شيء.
        if (wantedAyah && Number(wantedAyah[1]) === row.meta.ayah
            && termIn(q, row.meta.surahNameNorm)) score += 130;
        results.push({
          id: `ayah-${row.meta.surah}-${row.meta.ayah}`,
          type: "ayah",
          category: "آيات",
          icon: "📖",
          title: `سورة ${row.meta.surahName}: ${arNum(row.meta.ayah)}`,
          description: cut(row.meta.text),
          route: `${QURAN_PAGE}?s=${row.meta.surah}&a=${row.meta.ayah}`,
          where: `الجزء ${arNum(row.meta.juz)} · الصفحة ${arNum(row.meta.page)}`,
          score,
          matchType: hit.matchType,
          sourceId: "corpusQuran",
        });
      }

// «الجزء ١٨» و«صفحة ٣٠٤» و«حزب ٥٦»: مواضعُ المصحف بالسؤال. بلا `\b`
      // في النمط، لأنّ التطابق يجري على نصٍّ عربيّ مطبَّع لا على JavaScript،
      // وحدُّ الكلمة `\b` في الحروف العربية لا يقوم مقامه.
      const place = /(?:^| )ال?(جزء|صفحه|حزب) (\d{1,4})$/.exec(q);
      if (place) {
        const kind = place[1] === "جزء" ? "juz" : place[1] === "صفحه" ? "page" : "hizb";
        const value = Number(place[2]);
        for (const row of rows) {
          if (row.meta[kind] !== value) continue;
          results.push({
            id: `${kind}-${row.meta.surah}-${row.meta.ayah}`,
            type: "ayah",
            category: "آيات",
            icon: kind === "juz" ? "🗂️" : kind === "page" ? "📄" : "🔖",
            title: kind === "juz"
              ? `الجزء ${arNum(value)} — ${row.meta.surahName}`
              : kind === "page"
                ? `صفحة ${arNum(value)} — ${row.meta.surahName}`
                : `حزب ${arNum(value)} — ${row.meta.surahName}`,
            description: `يبدأ من الآية ${arNum(row.meta.ayah)}`,
            route: `${QURAN_PAGE}?s=${row.meta.surah}&a=${row.meta.ayah}`,
            score: 120,
            matchType: "exact",
            sourceId: "corpusQuran",
          });
          break;
        }
      }

      // بداية كل جزء: «بداية الجزء ١٨».
      if (/بدايه/.test(q)) {
        const asked = / (\d{1,2})$/.exec(q);
        for (const [juz, at] of juzStart) {
          if (asked && Number(asked[1]) !== juz) continue;
          const [surahName, ayah] = String(at).split(":");
          results.push({
            id: `juz-start-${juz}`,
            type: "ayah",
            category: "آيات",
            icon: "🗂️",
            title: `بداية الجزء ${arNum(juz)}`,
            description: `سورة ${surahName} — الآية ${arNum(Number(ayah))}`,
            route: `${QURAN_PAGE}?s=${surahNoOf(surahs, surahName)}&a=${ayah}`,
            score: 110,
            matchType: "exact",
            sourceId: "corpusQuran",
          });
        }
      }

      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  });
}

/** @param {any[]} surahs @param {string} name @returns {number} */
function surahNoOf(surahs, name) {
  const found = surahs.find((row) => row[1] === name);
  return found ? found[0] : 1;
}

/* ------------------------------------------------- تفسير الميسر وغريب القرآن */

/** @type {Promise<any>|null} */
let tafsirRows = null;

/** @returns {Promise<any[]>} */
function tafsirData() {
  if (!tafsirRows) {
    tafsirRows = loadCorpus("tafsir").then(({ rows }) =>
      rows.map(([surah, ayah, surahName, text]) => ({
        meta: { surah, ayah, surahName, text },
        prepared: preparedOf({
          title: `${surahName}:${ayah}`,
          aliases: [text],
          keywords: `${surahName} ${arNum(surah)} ${arNum(ayah)}`,
        }),
      })));
    tafsirRows.catch(() => { tafsirRows = null; });
  }
  return tafsirRows;
}

function registerTafsirCorpus() {
  registry.register({
    id: "corpusTafsir",
    type: "tafsir",
    category: "تفسير",
    icon: "📚",
    title: "التفسير الميسر",
    description: "معنى كل آية من القرآن الكريم",
    keywords: ["تفسير", "معنى", "شرح", "بيان", "فسر", "توضيح"],
    priority: 9,
    lazy: true,
    corpus: "tafsir",
    async search(query, normalizedQuery, options = {}) {
      const q = normalizedQuery || normalizeAr(query);
      if (!q) return [];
      const limit = options.limit || 20;
      const rows = await tafsirData();
      const results = [];
      for (const row of rows) {
        const hit = scorePrepared(row.prepared, q);
        if (!hit) continue;
        results.push({
          id: `tafsir-${row.meta.surah}-${row.meta.ayah}`,
          type: "tafsir",
          category: "تفسير",
          icon: "📚",
          title: `تفسير ${row.meta.surahName}: ${arNum(row.meta.ayah)}`,
          description: cut(row.meta.text, 220),
          route: `${TAFSIR_PAGE}?s=${row.meta.surah}`,
          score: hit.score,
          matchType: hit.matchType,
          sourceId: "corpusTafsir",
        });
      }
      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  });
}

/** @type {Promise<any>|null} */
let sirajRows = null;

/** @returns {Promise<any[]>} */
function sirajData() {
  if (!sirajRows) {
    sirajRows = loadCorpus("siraj").then(({ rows }) =>
      rows.map(([surah, ayah, word, meaning]) => ({
        meta: { surah, ayah, word, meaning },
        prepared: preparedOf({
          title: word,
          aliases: [word, meaning],
          keywords: `${word} ${meaning}`,
        }),
      })));
    sirajRows.catch(() => { sirajRows = null; });
  }
  return sirajRows;
}

function registerSirajCorpus() {
  registry.register({
    id: "corpusSiraj",
    type: "siraj",
    category: "معاني",
    icon: "🪔",
    title: "معاني غريب القرآن",
    description: "معنى كل لفظٍ غريب في القرآن مع موضع وروده",
    keywords: ["معنى", "غريب", "معاني", "لغة", "سراج", "كلمة", "لفظ", "معجم"],
    priority: 9,
    lazy: true,
    corpus: "siraj",
    async search(query, normalizedQuery, options = {}) {
      const q = normalizedQuery || normalizeAr(query);
      if (!q) return [];
      const limit = options.limit || 20;
      const rows = await sirajData();
      const results = [];
      for (const row of rows) {
        const hit = scorePrepared(row.prepared, q);
        if (!hit) continue;
        results.push({
          id: `siraj-${row.meta.surah}-${row.meta.ayah}-${row.meta.word}`,
          type: "siraj",
          category: "معاني",
          icon: "🪔",
          title: row.meta.word,
          description: cut(row.meta.meaning, 220),
          route: row.meta.ayah
            ? `${SIRAJ_PAGE}?s=${row.meta.surah}&w=${encodeURIComponent(row.meta.word)}`
            : `${SIRAJ_PAGE}?s=${row.meta.surah}`,
          where: row.meta.ayah ? `سورة ${arNum(row.meta.surah)} — الآية ${arNum(row.meta.ayah)}` : `سورة ${arNum(row.meta.surah)}`,
          score: hit.score,
          matchType: hit.matchType,
          sourceId: "corpusSiraj",
        });
      }
      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  });
}

/* --------------------------------------------------------------- حصن المسلم */

/** @type {Promise<any>|null} */
let hisnRows = null;

/** @returns {Promise<{items: any[], babs: any[]}>} */
function hisnData() {
  if (!hisnRows) {
    hisnRows = loadCorpus("hisn").then(({ meta, rows }) => ({
      babs: (meta.babs || []).map(([no, title, count]) => ({ no, title, count })),
      items: rows.map(([bab, text]) => ({
        meta: { bab, text },
        prepared: preparedOf({ title: text, aliases: [text] }),
      })),
    }));
    hisnRows.catch(() => { hisnRows = null; });
  }
  return hisnRows;
}

function registerHisnCorpus() {
  registry.register({
    id: "corpusHisn",
    type: "dhikr",
    category: "أذكار",
    icon: "🛡️",
    title: "نصوص حصن المسلم",
    description: "ألفان وأربعون ذكرًا بنصوصها الكاملة",
    keywords: ["حصن المسلم", "أذكار", "ذكر", "دعاء", "أذكار الصباح", "أذكار النوم"],
    priority: 9,
    lazy: true,
    corpus: "hisn",
    async search(query, normalizedQuery, options = {}) {
      const q = normalizedQuery || normalizeAr(query);
      if (!q) return [];
      const limit = options.limit || 20;
      const { items, babs } = await hisnData();
      const results = [];

      // عنوان الباب نفسه («أذكار النوم») أولى من ذكرٍّ داخله.
      for (const bab of babs) {
        const hit = scorePrepared(preparedOf({ title: bab.title }), q);
        if (!hit) continue;
        results.push({
          id: `hisn-bab-${bab.no}`,
          type: "dhikr",
          category: "أذكار",
          icon: "🛡️",
          title: bab.title,
          description: `${arNum(bab.count)} ذكرًا في باب ${arNum(bab.no)} من حصن المسلم`,
          route: `${HISN_PAGE}?no=${bab.no}`,
          score: hit.score + 12,
          matchType: hit.matchType,
          sourceId: "corpusHisn",
        });
      }

      items.forEach((row, index) => {
        const hit = scorePrepared(row.prepared, q);
        if (!hit) return;
        const bab = babs.find((b) => b.no === row.meta.bab);
        results.push({
          // المعرّف من موقعه في المدوّدة لا من عدد النتائج: أبوابُ حصن
          // المسلم تُضاف أولًا، فيتغيّر العدد بالاستعلام.
          id: `hisn-${row.meta.bab}-${index}`,
          type: "dhikr",
          category: "أذكار",
          icon: "🤲",
          title: cut(row.meta.text, 90),
          description: bab ? bab.title : "",
          route: `${HISN_PAGE}?no=${row.meta.bab}`,
          score: hit.score,
          matchType: hit.matchType,
          sourceId: "corpusHisn",
        });
      });
      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    },
  });
}

/* ------------------------------------------------------------------ التسجيل */

let registered = false;

/**
 * يسجّل مصادر المدوّدة الأربعة. التسجيل لا يجلب شيئًا: كل مصدر يقرأ مدوّدته
 * عند أوّل بحث يمرّ عليه، ومن لم يُبحث فيه لم يُحمَّل.
 * @returns {void}
 */
export function registerCorporaSources() {
  if (registered) return;
  registered = true;
  registerQuranCorpus();
  registerTafsirCorpus();
  registerSirajCorpus();
  registerHisnCorpus();
}

/**
 * يحمّل مدوّدةً بعينها مسبقًا (وعدٌ لا يُرفض خطأً حتى لا يُسقط بناءً).
 * @param {string} name
 * @returns {Promise<void>}
 */
export function prefetchCorpus(name) {
  return loadCorpus(name)
    .then(() => {
      switch (name) {
        case "quran": return quranData();
        case "tafsir": return tafsirData();
        case "siraj": return sirajData();
        case "hisn": return hisnData();
        default: return null;
      }
    })
    .catch(() => {});
}

/**
 * إشاراتٌ تدلّ على أن الاستعلام يبحث في نصٍّ يستحقّ فتح المدوّدة: لفظٌ من آية،
 * أو معنى كلمة، أو شرح آية، أو سؤالٌ طويل. وما عداها يبقى البحث على المصادر
 * الصغيرة وحدها، فيُرى فورًا.
 */
const DEEP_HINTS = [
  "ايه", "ايات", "كلمه", "معني", "معاني", "غريب", "معجم", "سراج",
  "شرح", "تفسير", "مفهوم", "بدايه", "جزء", "صفحه", "حزب",
  "علامه", "رسم", "عجم", "لفظ", "فسر",
];

/**
 * هل يستحقّ هذا الاستعلام فتح المدوّدة قبل أن يُعرض شيء؟
 * @param {string} normalized استعلامٌ مطبَّع
 * @param {number} fastCount ما وجده البحث السريع
 * @returns {boolean}
 */
export function wantsCorpora(normalized, fastCount = 0) {
  const q = String(normalized || "");
  if (q.length < 3) return false;
  // لفظٌ يدلّ على نصٍّ: آية، معنى كلمة، شرح، موضع في المصحف.
  if (DEEP_HINTS.some((hint) => q.includes(hint))) return true;
  // «البقرة ٢٥٥» و«الحج ٣»: اسمٌ ورقم، وهو سؤالٌ عن موضعٍ في المصحف لا عن
  // كلمةٍ في فهرس.
  if (/ \d{1,4}$/.test(q)) return true;
  // سؤالٌ مطوّل، فالغالب أن يريد جوابًا من النصّ لا اسمًا من الفهرس.
  if (q.split(" ").length >= 4) return true;
  // بغير إشاراتٍ وبنتائجٍ كافية، لا يُحمَّل شيء: البحث يبقى فوريًّا.
  return fastCount < 3;
}