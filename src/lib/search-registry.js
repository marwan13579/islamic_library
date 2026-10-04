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
    this.sources.set(source.id, source);
    if (!this.byCategory.has(source.category)) {
      this.byCategory.set(source.category, []);
    }
    this.byCategory.get(source.category).push(source);
    this.all.push(source);
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
        const title = normalizeAr(item.title || item.name || "");
        const desc = normalizeAr(item.description || item.desc || item.text || "");
        const keywords = (item.keywords || []).map(k => normalizeAr(k)).join(" ");
        const allText = `${title} ${desc} ${keywords}`;
        
        if (allText.includes(q)) {
          let score = 0;
          if (title === q) score = 100;
          else if (title.startsWith(q)) score = 80;
          else if (title.includes(q)) score = 60;
          else if (desc.includes(q)) score = 40;
          else score = 20;
          
          score += this.priority;
          
          results.push({
            ...item,
            sourceId: this.id,
            score,
            matchType: title === q ? "exact" : title.includes(q) ? "title" : "content"
          });
        }
      }
      
      return results.sort((a, b) => b.score - a.score).slice(0, options.limit || 20);
    }
  };
}
