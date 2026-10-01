/**
 * ترميز Unicode في base64 — ضروري لمزامنة الختمة عبر الرابط،
 * لأن `btoa` يفشل مع النص العربي مباشرة.
 * @module lib/b64
 */

/**
 * @param {string} value
 * @returns {string}
 */
export function b64EncodeUnicode(value) {
  return btoa(
    encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    ),
  );
}

/**
 * @param {string} encoded
 * @returns {string}
 */
export function b64DecodeUnicode(encoded) {
  return decodeURIComponent(
    Array.from(atob(encoded), (char) =>
      `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`,
    ).join(""),
  );
}

/**
 * يبني رابط المزامنة (الكود داخل الـ hash لا الـ query لتفادي قلب المحارف في RTL).
 * @param {unknown} state
 * @returns {string}
 */
export function syncUrl(state) {
  const code = b64EncodeUnicode(JSON.stringify(state));
  return `${location.origin}${location.pathname}#khatma=${code}`;
}

/**
 * @returns {unknown | null} الحالة القادمة من الرابط إن وُجدت
 */
export function readSyncHash() {
  const match = location.hash.match(/^#khatma=(.+)$/);
  if (!match) return null;
  try {
    return JSON.parse(b64DecodeUnicode(match[1]));
  } catch {
    return null;
  }
}

/**
 * @param {unknown} value
 * @returns {boolean} هل القيمة بصيغة ختمة صالحة؟
 */
export function isValidKhatmaSync(value) {
  if (!value || typeof value !== "object") return false;
  const state = /** @type {Record<string, unknown>} */ (value);
  return state.v === 1 && Array.isArray(state.parts) && state.parts.length === 30;
}

/**
 * @param {string} code
 */
export function clearSyncHash() {
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}