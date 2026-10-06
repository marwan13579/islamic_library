/**
 * Ask-Search — محرك البحث والإجابة "اسأل الموقع".
 *
 * ينسق بين:
 * - البحث الداخلي (unified-search)
 * - الفهرس الخارجي (external-sources)
 * - محرك الإجابة (answer-engine)
 * - الرسم المعرفي (knowledge-graph)
 *
 * @module lib/ask-search
 */

import { searchAll, quickSearch, processQuery } from "./unified-search.js";
import { getActiveSources, searchExternalIndex, loadExternalIndex, getExternalIndexStats, getCachedConfig, clearExternalIndexCache } from "./external-sources.js";
import { assembleAnswer, deduplicateResults, classifyQuestion, textSimilarity, suggestAlternatives } from "./answer-engine.js";
import { getRelatedTopics, expandTopicKeywords, topicImportance, buildKnowledgeGraph } from "./knowledge-graph.js";

/**
 * بحث كامل مع بناء إجابة.
 * @param {string} query
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function ask(query, options = {}) {
  const {
    limit = 30,
    category = null,
    includeExternal = true,
  } = options;

  const { raw, normalized, aliases, intent } = processQuery(query);

  if (!normalized) {
    return {
      answer: assembleAnswer(raw, [], { normalizedQuery: normalized, intent }),
      rawAnswer: null,
    };
  }

  // 1. Internal search
  const internalResult = await searchAll(query, { limit, category });
  let internalResults = internalResult.results || [];

  // 2. External search
  let externalResults = [];
  if (includeExternal) {
    try {
      await loadExternalIndex();
      const stats = getExternalIndexCache();
      if (stats && (stats.docs?.length || 0) > 0) {
        externalResults = searchExternalIndex(query, normalized, { limit: 10 });
      }
    } catch {
      // External index not available
    }
  }

  // 3. Expand query with knowledge graph
  const expandedKeywords = expandTopicKeywords(normalized);

  // 3b. Build knowledge graph from results
  const kg = buildKnowledgeGraph(deduped);

  // 4. Merge and deduplicate
  const allResults = [...internalResults];
  for (const r of externalResults) {
    const isDup = allResults.some((ir) => textSimilarity(`${ir.title} ${ir.summary || ir.description || ""}`, `${r.title} ${r.summary || r.description || ""}`) > 0.85);
    if (!isDup) allResults.push(r);
  }

  const deduped = deduplicateResults(allResults);

  // 5. Build answer
  const answer = assembleAnswer(raw, deduped, { normalizedQuery: normalized, intent });

  // 6. Attach metadata
  answer.expandedKeywords = expandedKeywords.slice(0, 20);
  answer.relatedTopics = getRelatedTopics(normalized);
  answer.knowledgeGraph = kg;
  answer.searchMeta = {
    internalSearched: internalResult.deep ? "deep" : "fast",
    internalResults: internalResults.length,
    externalResults: externalResults.length,
    dedupedResults: deduped.length,
    graphNodes: kg.nodes.length,
    graphEdges: kg.edges.length,
  };

  return {
    answer,
    rawAnswer: deduped,
  };
}

/**
 * بحث سريع للاقتراحات (instant).
 */
export async function askSuggestions(query, limit = 10) {
  return quickSearch(query, limit);
}

/**
 * يتحقق من حالة محرك البحث.
 */
export function resetAskSearch() {
  clearExternalIndexCache();
}

export async function getSearchDiagnostics() {
  const internal = [];
  const { getAll } = await import("./search-registry.js");
  const registry = getAll();

  const stats = {
    totalSources: registry.length,
    searchableSources: registry.filter((s) => s.searchable).length,
    categories: [...new Set(registry.map((s) => s.category))],
    languages: ["ar", "en"],
    externalIndex: null,
  };

  try {
    await loadExternalIndex();
    const extStats = getExternalIndexStats();
    stats.externalIndex = extStats || { status: "empty" };
  } catch {
    stats.externalIndex = { status: "unavailable" };
  }

  const config = getCachedConfig();
  if (config && config.sources) {
    stats.externalConfig = {
      totalSources: config.sources.length,
      enabledSources: config.sources.filter((s) => s.enabled).length,
    };
    const first = getSourceById(config.sources[0].id);
    if (first) stats.sampleRateLimit = getRateLimit(first);
  }

  return stats;
}
