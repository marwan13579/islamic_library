/**
 * Unified search engine - searches across all registered content sources.
 * No AI. Pure rule-based local search.
 * @module lib/unified-search
 */

import { normalizeAr } from "./text.js";
import { registry, createSource } from "./search-registry.js";
import { expandAlias, correctSpelling, getIntent, getCategoryKeywords, ALIASES, dialectToFusha } from "./search-aliases.js";
import { wantsCorpora } from "./search-corpora.js";

/**
 * @typedef {object} SearchResult
 * @property {string} id
 * @property {string} type
 * @property {string} category
 * @property {string} icon
 * @property {string} title
 * @property {string} description
 * @property {string} route
 * @property {number} score
 * @property {string} matchType
 * @property {string} sourceId
 * @property {any} [extra]
 */

const MAX_RESULTS = 50;
const MAX_PER_SOURCE = 15;
/** نصّ المدوّدة الكبرى يُمنح نصيبًا أقلّ: سؤالٌ واحد لا يستنزف كلَّه. */
const MAX_PER_DEEP_SOURCE = 8;

/**
 * Normalize and enrich a search query.
 * @param {string} query
 * @returns {{raw: string, normalized: string, aliases: string[], intent: string}}
 */
export function processQuery(query) {
  const raw = String(query || "").trim();
  if (!raw) return { raw: "", normalized: "", aliases: [], intent: "general" };

  // 1. Convert Arabic dialect (Egyptian/Gulf/Levantine) to Fusha BEFORE normalization
  let dialectFixed = dialectToFusha(raw);
  // Also try normalizing first then dialect-mapping for partial matches
  if (dialectFixed === raw) {
    const preNorm = normalizeAr(raw);
    dialectFixed = normalizeAr(dialectToFusha(preNorm));
  }

  let normalized = normalizeAr(dialectFixed);
  const aliases = [];
  
  // Correct spelling
  const words = normalized.split(/\s+/);
  const correctedWords = words.map(w => {
    const corrected = correctSpelling(w);
    if (corrected !== w) {
      aliases.push(corrected);
    }
    return corrected;
  });
  // التطبيع بعد التصحيح لا قبله: جدولُ الإملاء يُعيد الهمزات («اذكار» ←
  // «أذكار»)، والمصادر تقارن الاستعلام بنصوصٍ مطبَّعة، فاستعلامٌ غير مطبَّع
  // يُسقط مطابقةً صحيحة من مصدرٍ بعد آخر.
  normalized = normalizeAr(correctedWords.join(" "));
  
  // Expand aliases
  const expandedAliases = [];
  for (const word of words) {
    const expanded = expandAlias(word);
    if (expanded !== word) {
      expandedAliases.push(expanded);
    }
  }
  
  const intent = getIntent(raw);
  
  return {
    raw,
    normalized,
    aliases: [...aliases, ...expandedAliases],
    intent
  };
}

/**
 * يمرّ على المصادر ويرفع ما يطابق الاستعلام.
 * @param {object} ctx سياق البحث
 * @returns {Promise<object[]>}
 */
async function collectSources(ctx) {
  const { raw, normalized, aliases, intent, categoryFilter, typeFilter, lazy, perSource } = ctx;
  const found = [];

  for (const source of registry.getAll()) {
    if (!source.searchable) continue;
    if (typeFilter && source.type !== typeFilter) continue;
    // المدوّدة الكبرى لا تُفتتح في المرور السريع، ولا يُفتتح غيرُها فيه.
    if (lazy !== Boolean(source.lazy)) continue;

    try {
      const results = await source.search(raw, normalized, { limit: perSource });
      for (const r of results) {
        // Filter by result category
        if (categoryFilter && r.category !== categoryFilter) continue;

        // Boost score for exact matches
        let score = r.score || 0;
        const titleNorm = normalizeAr(r.title || "");
        if (titleNorm === normalized) score += 50;
        else if (titleNorm.includes(normalized)) score += 30;

        // Boost for alias matches
        for (const alias of aliases) {
          if (titleNorm.includes(alias)) score += 20;
        }

        // Boost for intent match
        if (r.type === intent || r.category === intent) score += 15;

        // Boost for keyword match — مصدرٌ بلا `keywords` لا يسقط نتائجه كلّها
        // بسبب حلقةٍ فوق قيمةٍ غير موجودة.
        for (const kw of source.keywords || []) {
          if (normalizeAr(kw).includes(normalized)) score += 10;
        }

        found.push({ ...r, score });
      }
    } catch (e) {
      // مصدرٌ واحد أخفق لا يُسقط البحث.
    }
  }

  return found;
}

/**
 * يدمج نتائج عدّة مرورات بلا تكرار: النتيجة الواحدة قد تأتي من مصدرين.
 * @param {object[][]} batches
 * @returns {object[]}
 */
function mergeBatches(batches) {
  const seen = new Set();
  const merged = [];
  for (const batch of batches) {
    for (const r of batch) {
      const key = `${r.sourceId}|${r.id || r.title}|${r.route}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
  }
  return merged;
}

/**
 * Search all registered sources.
 *
 * البحث على مرحلتين: المصادر الصغيرة أولًا فهي فورية، ثمّ مدوّدة النصوص
 * الكبيرة إن دلّ الاستعلام على نصٍّ أو لم تكفِ الأولى. فإن لم يُعثر على شيء
 * يُعاد البحث بكلمات الاستعلام مفردةً، فقد أخطأ المستخدم كلمةً واحدة أو كان
 * يبحث عن الشيء باسمٍ آخر.
 *
 * @param {string} query
 * @param {{limit?: number, category?: string, type?: string, onPhase?: function(string): void}} [options]
 * @returns {Promise<{results: SearchResult[], categories: string[], intent: string, deep: boolean}>}
 */
export async function searchAll(query, options = {}) {
  const { raw, normalized, aliases, intent } = processQuery(query);

  if (!normalized) {
    return { results: [], categories: [], intent: "general", deep: false };
  }

  const limit = options.limit || MAX_RESULTS;
  const base = {
    raw,
    normalized,
    aliases,
    intent,
    categoryFilter: options.category || null,
    typeFilter: options.type || null,
  };

  const batches = [];
  batches.push(await collectSources({ ...base, lazy: false, perSource: MAX_PER_SOURCE }));

  let deep = false;
  if (wantsCorpora(normalized, batches[0].length)) {
    deep = true;
    if (typeof options.onPhase === "function") options.onPhase("deep");
    batches.push(await collectSources({ ...base, lazy: true, perSource: MAX_PER_DEEP_SOURCE }));
  }

  let sorted = mergeBatches(batches).sort((a, b) => b.score - a.score);

  // لفظٌ زائدٌ واحد لا ينبغي أن يُسقط كلَّ شيء، فيُعاد البحث بكلمات الاستعلام
  // مفردةً وتُخفض درجة ما يُوجد منها حتى يبقى الشرطُ الكليّ في الصدارة.
  const words = [...new Set(normalized.split(" "))].filter((w) => w.length >= 3);
  if (!sorted.length && words.length > 1) {
    if (typeof options.onPhase === "function") options.onPhase("relaxed");
    const relaxed = await Promise.all(words.slice(0, 4).map((word) =>
      collectSources({ ...base, normalized: word, lazy: false, perSource: MAX_PER_SOURCE })));
    sorted = mergeBatches(relaxed)
      .map((r) => ({ ...r, score: r.score * 0.6, matchType: "relaxed" }))
      .sort((a, b) => b.score - a.score);
  }

  return {
    results: sorted.slice(0, limit),
    categories: [...new Set(sorted.map((r) => r.category))],
    intent,
    deep,
  };
}

/**
 * Quick search for suggestions (faster, less thorough).
 * @param {string} query
 * @param {number} [limit]
 * @returns {Promise<SearchResult[]>}
 */
export async function quickSearch(query, limit = 10) {
  const { raw, normalized } = processQuery(query);
  if (!normalized) return [];
  
  const results = [];
  const seen = new Set();
  
  for (const source of registry.getAll()) {
    if (!source.searchable) continue;
    try {
      const items = await source.search(raw, normalized, { limit: Math.ceil(limit / registry.getAll().length) });
      for (const r of items) {
        const key = `${r.sourceId}-${r.id || r.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(r);
      }
    } catch (e) {
      // Skip
    }
  }
  
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Get smart suggestions based on time, usage, and context.
 * @returns {Promise<SearchResult[]>}
 */
export async function getSmartSuggestions() {
  const suggestions = [];
  const now = new Date();
  const hour = now.getHours();
  
  // Time-based suggestions
  if (hour >= 5 && hour < 12) {
    suggestions.push({
      id: "suggestion-morning",
      type: "suggestion",
      category: "اقتراح",
      icon: "🌅",
      title: "أذكار الصباح",
      description: "أذكار الصباح والمساء",
      route: "25-azkar-shamila.html",
      score: 100,
      matchType: "suggestion",
      sourceId: "smart"
    });
  } else if (hour >= 17 && hour < 20) {
    suggestions.push({
      id: "suggestion-evening",
      type: "suggestion",
      category: "اقتراح",
      icon: "🌇",
      title: "أذكار المساء",
      description: "أذكار المساء والنوم",
      route: "25-azkar-shamila.html",
      score: 100,
      matchType: "suggestion",
      sourceId: "smart"
    });
  }
  
  if (hour >= 21 || hour < 5) {
    suggestions.push({
      id: "suggestion-night",
      type: "suggestion",
      category: "اقتراح",
      icon: "🌙",
      title: "أذكار النوم",
      description: "أذكار قبل النوم",
      route: "25-azkar-shamila.html",
      score: 100,
      matchType: "suggestion",
      sourceId: "smart"
    });
  }
  
  // Always useful suggestions
  suggestions.push({
    id: "suggestion-quran",
    type: "suggestion",
    category: "اقتراح",
    icon: "📖",
    title: "القرآن الكريم",
    description: "اقرأ من المصحف الشريف",
    route: "30-quran-full.html",
    score: 90,
    matchType: "suggestion",
    sourceId: "smart"
  });
  
  suggestions.push({
    id: "suggestion-prayer",
    type: "suggestion",
    category: "اقتراح",
    icon: "🕐",
    title: "مواقيت الصلاة",
    description: "تعرف على وقت الصلاة القادمة",
    route: "29-prayer-times.html",
    score: 85,
    matchType: "suggestion",
    sourceId: "smart"
  });
  
  return suggestions;
}
