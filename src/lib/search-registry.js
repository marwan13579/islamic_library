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
 * Does one term hit a text, allowing a word prefix so "سفر" finds "السفر".
 * @param {string} text نصٌّ مطبَّع
 * @param {string} term مصطلح مطبَّع
 * @returns {boolean}
 */
function termHits(text, term) {
  if (!text) return false;
  if (text.includes(term)) return true;
  if (term.length < 3) return false;
  return text.split(" ").some((word) => word.startsWith(term));
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
  const terms = termsOf(phrase);
  if (!terms.length) return null;

  const desc = normalizeAr(item?.description || item?.desc || item?.text || "");
  const keywords = normalizeAr((item?.keywords || []).join(" "));
  const titles = [normalizeAr(item?.title || item?.name || "")];
  for (const alias of item?.aliases || []) {
    const text = normalizeAr(alias);
    if (text) titles.push(text);
  }

  let best = null;
  for (const title of titles) {
    const hit = scoreAgainst(title, desc, keywords, phrase, terms);
    if (hit && (!best || hit.score > best.score)) best = hit;
  }
  if (!best) return null;

  // كلماتٌ أكثر = أدقّ، فتُرفع الدرجة قليلًا حتى لا تغلب نتيجة كلمتين نتيجة
  // سؤالٍ واحد، ويبقى الفارق محسوسًا.
  return { score: best.score + Math.min(terms.length - 1, 4), matchType: best.matchType };
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
  const inTitle = terms.filter((term) => termHits(title, term)).length;
  const inRest = terms.filter((term) => termHits(desc, term) || termHits(keywords, term)).length;
  if (inTitle + inRest < terms.length) return null;

  const joined = terms.join(" ");
  const whole = title === phrase || title === joined;
  let score;
  if (whole) score = 100;
  else if (title.startsWith(phrase)) score = 80;
  else if (title.includes(phrase)) score = 65;
  else if (inTitle === terms.length) score = 55;
  else if (phrase.includes(" ") && `${title} ${desc}`.includes(phrase)) score = 45;
  else if (inTitle > 0) score = 40;
  else score = 25;

  const matchType = whole ? "exact" : title.includes(phrase) || inTitle === terms.length
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
