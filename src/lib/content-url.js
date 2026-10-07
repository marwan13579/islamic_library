/**
 * جذر المحتوى على شبكة توزيع GitHub Pages.
 *
 * المحتوى ٢٤٩ ميغابايت فلا يُنشر مع الصفحات: يحمله فرع `gh-pages`
 * وتخدمه GitHub من شبكتها، فينزل حجم النشر من ثلاثمئة ميغابايت إلى
 * نحو ستين، ولا يتكرر حجم المحتوى مع كل نشر.
 * @module lib/content-url
 */

/** جذر المحتوى: فرع `gh-pages` من هذا المستودع. */
export const CONTENT_BASE =
  "https://marwan13579.github.io/islamic_library/content";

/**
 * يبني رابط ملف محتوى على شبكة التوزيع. يقبل المسار بيادٍ من «content/»
 * أو بلاها، فإن الوحدات تختلف في عادتها.
 * @param {string} path مسار نسبي داخل `content/`
 * @returns {string}
 */
export function contentUrl(path) {
  const clean = String(path).replace(/^\.?\//, "").replace(/^content\//, "");
  return `${CONTENT_BASE}/${clean}`;
}
