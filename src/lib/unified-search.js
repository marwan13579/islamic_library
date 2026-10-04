/**
 * Unified search engine - searches across all registered content sources.
 * No AI. Pure rule-based local search.
 * @module lib/unified-search
 */

import { normalizeAr } from "./text.js";
import { registry, createSource } from "./search-registry.js";
import { expandAlias, correctSpelling, getIntent, getCategoryKeywords, ALIASES } from "./search-aliases.js";

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

/**
 * Normalize and enrich a search query.
 * @param {string} query
 * @returns {{raw: string, normalized: string, aliases: string[], intent: string}}
 */
export function processQuery(query) {
  const raw = String(query || "").trim();
  if (!raw) return { raw: "", normalized: "", aliases: [], intent: "general" };
  
  let normalized = normalizeAr(raw);
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
  normalized = correctedWords.join(" ");
  
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
 * Search all registered sources.
 * @param {string} query
 * @param {{limit?: number, category?: string, type?: string}} [options]
 * @returns {Promise<{results: SearchResult[], categories: string[], intent: string}>}
 */
export async function searchAll(query, options = {}) {
  const { raw, normalized, aliases, intent } = processQuery(query);
  
  if (!normalized) {
    return { results: [], categories: [], intent: "general" };
  }
  
  const limit = options.limit || MAX_RESULTS;
  const categoryFilter = options.category || null;
  const typeFilter = options.type || null;
  
  const allResults = [];
  const seen = new Set();
  
  // Search with normalized query
  for (const source of registry.getAll()) {
    if (!source.searchable) continue;
    if (typeFilter && source.type !== typeFilter) continue;
    
    try {
      const results = await source.search(query, normalized, { limit: MAX_PER_SOURCE });
      for (const r of results) {
        const key = `${r.sourceId}-${r.id || r.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        
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
        
        // Boost for keyword match
        for (const kw of source.keywords) {
          if (normalizeAr(kw).includes(normalized)) score += 10;
        }
        
        allResults.push({
          ...r,
          score
        });
      }
    } catch (e) {
      // Skip failed sources
    }
  }
  
  // Also search with raw query for content that might have special chars
  for (const source of registry.getAll()) {
    if (!source.searchable) continue;
    if (typeFilter && source.type !== typeFilter) continue;
    
    try {
      const results = await source.search(raw, raw, { limit: MAX_PER_SOURCE });
      for (const r of results) {
        const key = `${r.sourceId}-${r.id || r.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        
        // Filter by result category
        if (categoryFilter && r.category !== categoryFilter) continue;
        
        let score = (r.score || 0) * 0.5; // Lower priority for raw match
        allResults.push({
          ...r,
          score
        });
      }
    } catch (e) {
      // Skip
    }
  }
  
  // Sort by score
  allResults.sort((a, b) => b.score - a.score);
  
  // Group by category
  const categories = [...new Set(allResults.map(r => r.category))];
  
  return {
    results: allResults.slice(0, limit),
    categories,
    intent
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
