/**
 * Ask-Search — محرك البحث والإجابة "اسأل الموقع".
 *
 * ينسق بين:
 * - البحث الداخلي (unified-search) ومصادر المحتوى المكتشفة (search-content)
 * - الفهرس الخارجي المسؤول (external-sources)
 * - محرك الإجابة وتجميع المواضيع وإزالة التكرار (answer-engine)
 * - الرسم وخريطة المعرفة الإسلامية (knowledge-graph)
 *
 * بدون AI خارجي أو اتصال بـ APIs خارجية. كل الخوارزميات محلية.
 *
 * @module lib/ask-search
 */

import { searchAll, quickSearch, processQuery } from "./unified-search.js";
import { registerDataSources, registerDiscoveredContent } from "./search-content.js";
import { registry } from "./search-registry.js";
import {
  getActiveSources,
  searchExternalIndex,
  loadExternalIndex,
  getExternalIndexStats,
  getCachedConfig,
  getExternalIndexCache,
  clearExternalIndexCache,
  getSourceById,
  getRateLimit,
  getExternalSourceDiagnostics,
  getExternalIndexDetails,
  getExternalCrawlerHealth,
} from "./external-sources.js";
import {
  assembleAnswer,
  deduplicateResults,
  classifyQuestion,
  textSimilarity,
  detectSubTopics,
  suggestAlternatives,
} from "./answer-engine.js";
import {
  getRelatedTopics,
  expandTopicKeywords,
  topicImportance,
  buildKnowledgeGraph,
} from "./knowledge-graph.js";

let dataSourcesInitialized = false;

/**
 * التأكد من تسجل جميع مصادر المحتوى الداخلي قبلبحث.
 */
async function ensureDataSources() {
  if (dataSourcesInitialized) return;
  try {
    await registerDataSources();
    // Auto-discover any pages/tools not explicitly registered
    try {
      registerDiscoveredContent();
    } catch {
      // Auto-discovery requires DOM; safe to skip in non-browser contexts
    }
    dataSourcesInitialized = true;
  } catch {
    // الاستمرار بما هو متاح
  }
}

/**
 * فحص هل السؤال يحتوي على تصحيح مقترح (هل تقصد).
 * @param {string} raw
 * @param {string} normalized
 * @returns {string|null}
 */
function checkDidYouMean(raw, normalized) {
  const cleanRaw = String(raw || "").trim();
  const cleanNorm = String(normalized || "").trim();
  if (!cleanRaw || !cleanNorm) return null;

  // إذا اختلف النص المطبّع/المصحح عن الأصل اختلافاً واضحاً غير مجرد التشكيل
  const r = cleanRaw.replace(/[ً-ْٰۖ-ۭـ]/g, "");
  if (r !== cleanNorm && Math.abs(r.length - cleanNorm.length) <= 5) {
    return cleanNorm;
  }
  return null;
}

/**
 * بحث كامل مع بناء إجابة منظمة.
 * @param {string} query
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function ask(query, options = {}) {
  const {
    limit = 30,
    category = null,
    includeExternal = true,
    searchMode = "all", // "all" | "internal" | "external"
  } = options;

  await ensureDataSources();

  const { raw, normalized, aliases, intent } = processQuery(query);

  if (!normalized) {
    return {
      answer: assembleAnswer(raw, [], { normalizedQuery: normalized, intent }),
      rawAnswer: [],
      didYouMean: null,
    };
  }

  const didYouMean = checkDidYouMean(raw, normalized);

  // 1. Internal search (إذا كان النمط يسمح)
  let internalResults = [];
  let internalSearchedType = "fast";
  if (searchMode !== "external") {
    const internalResult = await searchAll(query, { limit, category });
    internalResults = internalResult.results || [];
    internalSearchedType = internalResult.deep ? "deep" : "fast";

    // معالجة الأسئلة متعددة الأجزاء (Multi-part questions)
    // مثلاً: "ما الصلاة وشروطها وأركانها ومبطلاتها؟"
    const subTopics = detectSubTopics(normalized);
    if (subTopics.length > 1) {
      const subSearches = await Promise.all(
        subTopics.slice(0, 4).map((sub) => searchAll(sub, { limit: 8, category }).catch(() => ({ results: [] })))
      );
      for (const res of subSearches) {
        if (res && res.results) {
          internalResults.push(...res.results);
        }
      }
    }
  }

  // 2. External search (إذا كان النمط يسمح)
  let externalResults = [];
  if (includeExternal && searchMode !== "internal") {
    try {
      await loadExternalIndex();
      const extCache = getExternalIndexCache();
      if (extCache && (extCache.docs?.length || 0) > 0) {
        externalResults = searchExternalIndex(query, normalized, { limit: 12 });
      }
    } catch {
      // الفهرس الخارجي غير متاح
    }
  }

  // 3. توسيع الكلمات المفتاحية بالرسم المعرفي
  const expandedKeywords = expandTopicKeywords(normalized);

  // 4. الدمج وإزالة التكرار
  const allResults = [...internalResults];
  for (const r of externalResults) {
    const isDup = allResults.some(
      (ir) =>
        textSimilarity(
          `${ir.title} ${ir.summary || ir.description || ""}`,
          `${r.title} ${r.summary || r.description || ""}`
        ) > 0.82
    );
    if (!isDup) allResults.push(r);
  }

  const deduped = deduplicateResults(allResults);

  // 5. بناء الرسم المعرفي بعد إزالة التكرار
  const kg = buildKnowledgeGraph(deduped);

  // 6. تجميع الإجابة المنظمة
  const answer = assembleAnswer(raw, deduped, {
    normalizedQuery: normalized,
    intent,
    searchMode,
  });

  // 7. إرفاق البيانات الوصفية
  answer.expandedKeywords = expandedKeywords.slice(0, 20);
  answer.relatedTopics = getRelatedTopics(normalized);
  answer.knowledgeGraph = kg;
  answer.didYouMean = didYouMean;
  answer.searchMeta = {
    internalSearched: internalSearchedType,
    internalResults: internalResults.length,
    externalResults: externalResults.length,
    dedupedResults: deduped.length,
    graphNodes: kg.nodes.length,
    graphEdges: kg.edges.length,
  };

  return {
    answer,
    rawAnswer: deduped,
    didYouMean,
  };
}

/**
 * بحث سريع للاقتراحات المباشرة أثناء الكتابة.
 */
export async function askSuggestions(query, limit = 10) {
  await ensureDataSources();
  return quickSearch(query, limit);
}

/**
 * إعادة ضبط الذاكرة المؤقتة لمحرك البحث.
 */
export function resetAskSearch() {
  clearExternalIndexCache();
}

/**
 * فحص وتشخيص حالة محرك البحث الداخلي والخارجي - Search Quality Dashboard.
 */
export async function getSearchDiagnostics() {
  await ensureDataSources();

  const allSources = registry.getAll();

  // Internal sources stats by category
  const sourcesByCategory = {};
  for (const src of allSources) {
    if (!sourcesByCategory[src.category]) {
      sourcesByCategory[src.category] = { total: 0, searchable: 0, items: 0 };
    }
    sourcesByCategory[src.category].total++;
    if (src.searchable) sourcesByCategory[src.category].searchable++;
    if (src.itemCount) sourcesByCategory[src.category].items += src.itemCount;
  }

  // Calculate coverage per category
  const totalInternalItems = allSources.reduce((sum, s) => sum + (s.itemCount || 0), 0);
  const categories = Object.entries(sourcesByCategory).map(([category, data]) => ({
    category,
    totalSources: data.total,
    searchableSources: data.searchable,
    totalItems: data.items,
    coveragePercent: totalInternalItems > 0 ? Math.round((data.items / totalInternalItems) * 100) : 0,
  }));

  const stats = {
    totalSources: allSources.length,
    searchableSources: allSources.filter((s) => s.searchable).length,
    categories,
    languages: ["ar", "en", "fr", "es", "de", "it", "pt", "nl", "pl", "sv", "no", "da", "fi", "el", "cs", "ro", "hu", "uk", "ru", "tr", "fa", "ur", "bn", "hi", "id", "ms", "zh-CN", "zh-TW", "ja", "ko", "th", "vi", "sw", "ha", "am"],
    externalIndex: null,
    externalDiagnostics: null,
    externalIndexDetails: null,
    crawlerHealth: null,
    externalConfig: null,
  };

  try {
    await loadExternalIndex();
    const extStats = getExternalIndexStats();
    stats.externalIndex = extStats || { status: "empty" };
    
    // Enhanced diagnostics
    stats.externalDiagnostics = getExternalSourceDiagnostics();
    stats.externalIndexDetails = getExternalIndexDetails();
    stats.crawlerHealth = getExternalCrawlerHealth();
  } catch {
    stats.externalIndex = { status: "unavailable" };
    stats.externalDiagnostics = { sources: [], totalDocs: 0, errors: [], activeSources: 0, blockedSources: 0 };
    stats.externalIndexDetails = null;
    stats.crawlerHealth = { status: 'unavailable', issues: ['External index not loaded'], summary: { total: 0, active: 0, blocked: 0, totalDocs: 0 } };
  }

  const config = getCachedConfig();
  if (config && config.sources) {
    stats.externalConfig = {
      totalSources: config.sources.length,
      enabledSources: config.sources.filter((s) => s.enabled).length,
      crawlEnabledSources: config.sources.filter((s) => s.enabled && s.crawl).length,
      sources: config.sources.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        enabled: s.enabled,
        crawl: s.crawl,
        maxPages: s.maxPages,
        rateLimitMs: s.rateLimitMs,
      })),
    };
    const first = getSourceById(config.sources[0].id);
    if (first) stats.sampleRateLimit = getRateLimit(first);
  }

  return stats;
}
