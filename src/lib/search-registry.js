/**
 * Unified search registry for the Islamic Library website.
 * All content sources register here to be searchable from one place.
 * @module lib/search-registry
 */

import { normalizeAr } from "./text.js";

/**
 * @typedef {object} SearchSource
 * @property {string} id
 * @property {string} type
 * @property {string} category
 * @property {string} icon
 * @property {string} title
 * @property {string} description
 * @property {string[]} keywords
 * @property {string[]} aliases
 * @property {string} [route]
 * @property {number} priority
 * @property {boolean} searchable
 * @property {function} search
 */

export class SearchRegistry {
  constructor() {
    /** @type {Map<string, SearchSource>} */
    this.sources = new Map();
    /** @type {Map<string, SearchSource[]>} */
    this.byCategory = new Map();
    /** @type {SearchSource[]} */
    this.all = [];
  }

  /**
   * @param {SearchSource} source
   */
  register(source) {
    // المصادر المسجَّلة باليد لا تمرّ بـ`createSource`، فلا تحمل `searchable`،
    // و`searchAll` يتجاهل كل مصدر لا تحمل هذه العَلَم، فيصير البحث صامتًا بلا
    // نتيجة. فالعَلَم هنا افتراض، ولا يلغيه إلا `searchable: false` صراحةً.
    const entry = { searchable: true, ...source };
    this.sources.set(entry.id, entry);
    if (!this.byCategory.has(entry.category)) {
      this.byCategory.set(entry.category, []);
    }
    this.byCategory.get(entry.category).push(entry);
    this.all.push(entry);
  }

  /**
   * @param {string} id
   * @returns {SearchSource | undefined}
   */
  get(id) {
    return this.sources.get(id);
  }

  /**
   * @param {string} category
   * @returns {SearchSource[]}
   */
  getByCategory(category) {
    return this.byCategory.get(category) || [];
  }

  /**
   * @returns {SearchSource[]}
   */
  getAll() {
    return this.all;
  }
}

export const registry = new SearchRegistry();

/**
 * المصطلحات التي أدخلها المستخدم، بعد التطبيع.
 * @param {string} normalized
 * @returns {string[]}
 */
function termsOf(normalized) {
  return [...new Set(String(normalized || "").split(" ").filter(Boolean))];
}

/**
 * Does one term appear in a text? Partial-word matching, so "سفر" finds
 * "السفر" and "نور" finds "المنور".
 *
 * كان هنا فحصٌ إضافي لكلماتٍ تبدأ بالمصطلح، وهو أبطأُ بلا فائدة: كلمةٌ تبدأ
 * بالمصطلح تحويه بالضرورة، فالفحصُ الثاني لا يضيف شيئًا. وكان يُقسِم النصَّ كلَّه
 * إلى كلمات، فيأخذ ذلك من مطابقةِ آيةٍ واحدة في ستّة آلاف.
 * @param {string} text نصٌّ مطبَّع
 * @param {string} term مصطلح مطبَّع
 * @returns {boolean}
 */
function termHits(text, term) {
  if (!text || !term) return false;
  return text.includes(term);
}

/** أدوات التصريف الخفيفة: لواحق جمعٍ ومفرد، وسوابق تعريفٍ ونسبة. */
const SUFFIXES = ["اتها", "اتهم", "اتك", "ون", "ين", "ان", "وا", "ية", "يه", "ه", "ك", "ي"];
const PREFIXES = ["وال", "بال", "كال", "فال", "ال", "لل", "و", "ف", "ب", "ك", "ل", "س"];

/**
 * جذرٌ تقريبي للكلمة العربية: يُسقط حروف الجرّ والتعريف ثم لواحق الجمع
 * والمفرد. لا يُغني عن معجمٍ صرفٍّ كامل، لكنه يُساوي «الصلوات» و«الصلاة»
 * و«صلاة» في الاستعلام، فالعربية تُكتب الكلمة الواحدة بأشكالٍ كثيرة.
 * @param {string} word كلمةٌ مطبَّعة
 * @returns {string}
 */
function stem(word) {
  let w = String(word || "");
  for (const prefix of PREFIXES) {
    if (w.length - prefix.length >= 3 && w.startsWith(prefix)) {
      w = w.slice(prefix.length);
      break;
    }
  }
  for (const suffix of SUFFIXES) {
    if (w.length - suffix.length >= 3 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length);
      break;
    }
  }
  return w.length >= 3 ? w : word;
}

/** مسافة تحريرٍ بحدّ واحد، للتصحيح الإملائيّ العامل أثناء البحث. */
function withinOneEdit(a, b) {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (long.length - short.length > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (short.length === long.length) {
      i += 1;
      j += 1;
    } else {
      j += 1;
    }
  }
  if (i < short.length || j < long.length) edits += 1;
  return edits <= 1;
}

/** نصٌّ بلا مسافات: «ابوبكر» و«أبو بكر» كتابةٌ واحدة. */
function squeeze(text) {
  return String(text || "").replace(/ /g, "");
}

/** كم كلمةً من العنوان يُفحص بالتصحيح الإملائيّ، فلا يُثقل نصٌّ طويل. */
const FUZZY_TITLE_WORDS = 14;

/**
 * مطابقةٌ مرنة في عنوان: بادئة الكلمة، وجذرٌ تقريبي يُساوي «الصلوات»
 * بـ«الصلاة»، وكتابةٌ متّصلة تُساوي «ابوبكر» بـ«أبو بكر»، وخطأٌ بحرفٍ واحد
 * يجعل «الصلاه» تجد «الصلاة».
 *
 * المرونة للعناوين وحدها: العنوان هو ما يكتبه صاحبُ الأداة أو اسمُ السورة،
 * ونصٌّ من ستّة آلاف آيةٍ يُفحص بالتصحيح الإملائيّ كلُّ بحثٍ يبطئه.
 * @param {string} text نصٌّ مطبَّع
 * @param {string} term مصطلح مطبَّع
 * @returns {boolean}
 */
function termHitsLoose(text, term) {
  if (termHits(text, term)) return true;
  if (!text || term.length < 4) return false;

  // «ابوبكر» في «أبو بكر الصديق»: المقارنة بلا مسافاتٍ تطابق الكتابةَ
  // المتّصلة، وهي كثيرةٌ في الاستعلامات المُدخَلة بزربة واحدة.
  if (squeeze(text).includes(squeeze(term))) return true;

  const root = stem(term);
  const words = text.split(" ");
  for (let i = 0; i < words.length && i < FUZZY_TITLE_WORDS; i += 1) {
    const word = stem(words[i]);
    if (!word) continue;
    if (word === root) return true;
    if (term.length >= 5 && withinOneEdit(word, term)) return true;
  }
  return false;
}

/**
 * مطابقةٌ مرنة في نصٍّ طويل: بادئة الكلمة أو جذرُها. بلا تصحيحٍ إملائيّ
 * محسوبٍ حرفًا حرفًا، فذلك يحتاج تقسيمَ كل سطرٍ من الستة آلاف في كل بحث.
 * @param {string} text نصٌّ مطبَّع
 * @param {string} term مصطلح مطبَّع
 * @returns {boolean}
 */
function termHitsBody(text, term) {
  if (termHits(text, term)) return true;
  if (!text || term.length < 4) return false;
  const root = stem(term);
  return root !== term && text.includes(root);
}

/**
 * Elements of an item prepared once, so a corpus of 6236 rows is normalised a
 * single time instead of on every keystroke.
 * @param {{title?: string, name?: string, aliases?: string[], description?: string, desc?: string, text?: string, keywords?: string[] | string}} item
 * @returns {{titles: string[], desc: string, keywords: string}}
 */
export function prepareItem(item) {
  const titles = [normalizeAr(item?.title || item?.name || "")];
  for (const alias of item?.aliases || []) {
    const text = normalizeAr(alias);
    if (text) titles.push(text);
  }
  const keywords = Array.isArray(item?.keywords)
    ? item.keywords.join(" ")
    : String(item?.keywords || "");
  return {
    titles,
    desc: normalizeAr(item?.description || item?.desc || item?.text || ""),
    keywords: normalizeAr(keywords),
  };
}

/**
 * Score an item whose fields are already normalised.
 * @param {{titles: string[], desc: string, keywords: string}} prepared
 * @param {string} query الاستعلام المطبَّع
 * @returns {{score: number, matchType: string} | null}
 */
export function scorePrepared(prepared, query) {
  const phrase = String(query || "").trim();
  const terms = termsOf(phrase);
  if (!terms.length) return null;

  let best = null;
  for (const title of prepared.titles) {
    const hit = scoreAgainst(title, prepared.desc, prepared.keywords, phrase, terms);
    if (hit && (!best || hit.score > best.score)) best = hit;
  }
  if (!best) return null;

  // كلماتٌ أكثر = أدقّ، فتُرفع الدرجة قليلًا حتى لا تغلب نتيجة كلمتين نتيجة
  // سؤالٍ واحد، ويبقى الفارق محسوسًا.
  return { score: best.score + Math.min(terms.length - 1, 4), matchType: best.matchType };
}

/**
 * Score one item against the query: all terms must hit, and the closer they sit
 * to the title and to each other the higher it scores.
 *
 * The old rule was a single `allText.includes(query)`, which answered "الزكاة"
 * but missed "دعاء السفر" whenever the exact phrase was absent. Requiring every
 * term and prefix-matching each one widens recall without widening noise, since
 * an item that misses any term is dropped.
 *
 * `aliases` are alternative names scored like the title itself — a surah is
 * "الملك" but is also written "سورة الملك", and both queries should find it
 * with the same confidence.
 *
 * @param {{title?: string, aliases?: string[], description?: string, keywords?: string[]}} item
 * @param {string} query الاستعلام المطبَّع
 * @returns {{score: number, matchType: string} | null} null عند عدم المطابقة
 */
export function scoreItem(item, query) {
  const phrase = String(query || "").trim();
  if (!phrase) return null;
  return scorePrepared(prepareItem(item), phrase);
}

/**
 * Score one candidate title of an item.
 * @param {string} title نصٌّ مطبَّع
 * @param {string} desc
 * @param {string} keywords
 * @param {string} phrase
 * @param {string[]} terms
 * @returns {{score: number, matchType: string} | null}
 */
function scoreAgainst(title, desc, keywords, phrase, terms) {
  const strictTitle = terms.filter((term) => termHits(title, term)).length;
  const strictRest = terms.filter((term) => termHits(desc, term) || termHits(keywords, term)).length;
  const strict = strictTitle + strictRest;
  if (strict >= terms.length) return rankAgainst(title, desc, phrase, terms, strictTitle, true);

  const looseTitle = terms.filter((term) => termHitsLoose(title, term)).length;
  const looseRest = terms.filter((term) =>
    termHitsBody(desc, term) || termHitsBody(keywords, term)).length;
  // المطابقةُ المرنة تبدأُ بالمطابقة الدقيقة، فلا تُجمعان: جمعُهما كان يعدّ
  // المصطلحَ الواحد مرّتين، فصار استعلامٌ فيه لفظٌ زائد يمرّ كأنّه مطابق.
  const hits = Math.max(strictTitle, looseTitle) + Math.max(strictRest, looseRest);
  if (hits < terms.length) return null;

  // المطابقة المرنة تُقبل، لكن العنوان الدقيق يقدّم عليها: مطابقةٌ بخطأٍ
  // إملائيّ أو بجذرٍ تقريبي تُحسَب بنصف قيمتها، فلا تُخفي المطابقة الصحيحة.
  return rankAgainst(title, desc, phrase, terms, looseTitle, false);
}

/**
 * يرتّب عنصرًا بقوّة مطابقته في العنوان.
 * @param {string} title نصٌّ مطبَّع
 * @param {string} desc
 * @param {string} phrase
 * @param {string[]} terms
 * @param {number} titleShare كم مصطلحًا أصاب العنوان
 * @param {boolean} exactish مطابقةٌ دقيقة بلا تجذيرٍ ولا تصحيح
 * @returns {{score: number, matchType: string}}
 */
function rankAgainst(title, desc, phrase, terms, titleShare, exactish) {
  const joined = terms.join(" ");
  const whole = title === phrase || title === joined;
  let score;
  if (whole) score = 100;
  else if (title.startsWith(phrase)) score = 80;
  else if (title.includes(phrase)) score = 65;
  else if (titleShare === terms.length) score = 55;
  else if (phrase.includes(" ") && `${title} ${desc}`.includes(phrase)) score = 45;
  else if (titleShare > 0) score = 40;
  else score = 25;
  if (!exactish) score = Math.round(score * 0.55);

  const matchType = whole ? "exact" : title.includes(phrase) || titleShare === terms.length
    ? "title"
    : "content";
  return { score, matchType };
}

/**
 * Helper to create a search source from a simple config.
 * @param {object} config
 * @returns {SearchSource}
 */
export function createSource(config) {
  return {
    id: config.id,
    type: config.type || "item",
    category: config.category || "عام",
    icon: config.icon || "📄",
    title: config.title,
    description: config.description || "",
    keywords: config.keywords || [],
    aliases: config.aliases || [],
    route: config.route || null,
    priority: config.priority || 0,
    searchable: config.searchable !== false,
    async search(query, normalizedQuery, options = {}) {
      if (!this.searchable) return [];
      const items = await config.getItems ? config.getItems() : [];
      const q = normalizedQuery || normalizeAr(query);
      if (!q) return items.slice(0, 20).map(item => ({
        ...item,
        sourceId: this.id,
        score: 0
      }));
      
      const results = [];
      for (const item of items) {
        const hit = scoreItem(item, q);
        if (!hit) continue;
        results.push({
          ...item,
          sourceId: this.id,
          score: hit.score + this.priority,
          matchType: hit.matchType
        });
      }
      
      return results.sort((a, b) => b.score - a.score).slice(0, options.limit || 20);
    }
  };
}
