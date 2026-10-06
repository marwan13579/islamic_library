/**
 * progress.js — نظام المفضلة والتقدم الموحّد للموسوعة.
 *
 * لا يتطلب تسجيلًا. يخزّن كل شيء في localStorage تحت بادئة `ency-`.
 * يعمل على كل صفحات الموقع بلا تعديلات في كل صفحة على حدة.
 * @module lib/progress
 */

const PREFIX = "ency-";

/**
 * قراءة قيمة من التخزين.
 * @param {string} key
 * @param {any} fallback
 * @returns {any}
 */
export function readProgress(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * كتابة قيمة إلى التخزين.
 * @param {string} key
 * @param {any} value
 */
export function writeProgress(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* quota exceeded — silent */ }
}

/**
 * تبديل عنصر في المفضلة.
 * @param {string} id
 * @returns {boolean} الحالة الجديدة
 */
export function toggleFavorite(id) {
  const favs = readProgress("favorites", {});
  const next = { ...favs, [id]: !favs[id] };
  writeProgress("favorites", next);
  return next[id];
}

/**
 * هل العنصر مفضّل؟
 * @param {string} id
 * @returns {boolean}
 */
export function isFavorite(id) {
  return !!readProgress("favorites", {})[id];
}

/**
 * سجلّ آخر العناصر التي فُتحت.
 * @param {string} id
 */
export function addToHistory(id) {
  const hist = readProgress("history", []);
  const next = [id, ...hist.filter(x => x !== id)].slice(0, 100);
  writeProgress("history", next);
}

/**
 * آخر العناصر التي فُتحت.
 * @returns {string[]}
 */
export function getHistory() {
  return readProgress("history", []);
}
