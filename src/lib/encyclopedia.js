/**
 * encyclopedia.js — نظام الموسوعة الإسلامية للربط والتنقل.
 *
 * لا يولد محتوى دينيًّا: يقرأ البيانات الموجودة ويربطها ببعضها.
 * @module lib/encyclopedia
 */

import { ENCYCLOPEDIA_CATEGORIES, CONTENT_RELATIONS, getRelatedCategories, findCategory } from "../data/encyclopedia-categories.js";

/**
 * Build a "related content" HTML block for a given category/topic.
 * @param {string} categoryId
 * @param {{max?: number, excludeId?: string}} [options]
 * @returns {string}
 */
export function relatedContentHtml(categoryId, options = {}) {
  const { max = 6, excludeId = "" } = options;
  const cat = ENCYCLOPEDIA_CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return "";

  const relatedIds = getRelatedCategories(categoryId).filter(id => id !== excludeId);
  if (!relatedIds.length) return "";

  const items = relatedIds.slice(0, max).map(id => {
    const rel = ENCYCLOPEDIA_CATEGORIES.find(c => c.id === id);
    if (!rel) return "";
    return `<a class="encyclopedia-card" href="${rel.route}" style="padding:10px 12px;display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit">
      <span class="icon">${rel.icon}</span>
      <span class="title" style="font-size:.9rem">${rel.title}</span>
    </a>`;
  }).filter(Boolean);

  if (!items.length) return "";

  return `<section style="margin-top:20px">
    <h3 class="section-title">🔗 مواضيع ذات صلة</h3>
    <div class="related-grid">${items.join("")}</div>
  </section>`;
}

/**
 * Get encyclopedia statistics for display.
 * @returns {{categories: number, keywords: number, relations: number}}
 */
export function getEncyclopediaStats() {
  const keywords = new Set();
  ENCYCLOPEDIA_CATEGORIES.forEach(c => c.keywords.forEach(k => keywords.add(k)));
  const relations = new Set();
  Object.values(CONTENT_RELATIONS).forEach(arr => arr.forEach(id => relations.add(id)));
  return {
    categories: ENCYCLOPEDIA_CATEGORIES.length,
    keywords: keywords.size,
    relations: relations.size
  };
}
