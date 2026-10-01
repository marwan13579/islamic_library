/**
 * أدوات النص العربي: التطبيع، الأرقام، والهروب من HTML.
 * @module lib/text
 */

const DIACRITICS = /[ً-ْٰـۖ-ۭ]/g;
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

/**
 * يطبّع النص العربي للبحث: حذف التشكيل، توحيد الهمزات والتاء المربوطة والألف المقصورة.
 * @param {string} value
 * @returns {string}
 */
export function normalizeAr(value) {
  return String(value ?? "")
    .replace(DIACRITICS, "")
    .replace(/[أإآٱٲٳ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * @param {string | number} value
 * @returns {string} الأرقام بالصيغة الهندية
 */
export function toArNum(value) {
  return String(value ?? "").replace(/\d/g, (digit) => ARABIC_INDIC[Number(digit)]);
}

/**
 * @param {string} value
 * @returns {string} الأرقام بالصيغة الإنجليزية
 */
export function toEnNumber(value) {
  return String(value ?? "").replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)));
}

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * يهرّب النص قبل حقنه في HTML — إلزامي لكل نص يأتي من المستخدم.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/**
 * @param {string} value
 * @returns {string} نص بلا وسوم
 */
export function stripHtml(value) {
  return String(value ?? "").replace(/<[^>]*>/g, "").trim();
}

/**
 * يحوّل `**نص**` و`_نص_` إلى وسوم strong/em بعد التهريب.
 * @param {string} value
 * @returns {string}
 */
export function richText(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

/**
 * يبرز الكلمة المطابقة داخل نص مُهرَّب.
 * @param {string} value النص الأصلي
 * @param {string} query كلمة البحث
 * @returns {string}
 */
export function highlight(value, query) {
  const safe = escapeHtml(value);
  const needle = normalizeAr(query);
  if (!needle) return safe;
  const words = needle.split(" ").filter((word) => word.length > 1);
  let output = safe;
  for (const word of words) {
    const pattern = new RegExp(`(${escapeRegExp(word)})`, "gi");
    output = output.replace(pattern, "<mark>$1</mark>");
  }
  return output;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {number} value
 * @param {number} length
 * @returns {string}
 */
function pad2(value, length = 2) {
  return String(value).padStart(length, "0");
}

/**
 * @param {number} hours24
 * @returns {string} مثل «٦:٠٠ م»
 */
export function to12h(hours24) {
  if (!Number.isFinite(hours24)) return "—";
  const normalized = ((hours24 % 24) + 24) % 24;
  const hour = Math.floor(normalized);
  const minute = Math.round((normalized - hour) * 60);
  const suffix = hour < 12 ? "ص" : "م";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const carry = minute === 60 ? 1 : 0;
  const shown = (hour12 + carry) % 12 === 0 ? 12 : (hour12 + carry) % 12;
  return `${toArNum(shown)}:${toArNum(pad2(String(minute % 60)))} ${suffix}`;
}

/**
 * @param {number} milliseconds
 * @returns {string} مثل «بعد ساعتين و١٥ دقيقة»
 */
export function humanTime(milliseconds) {
  const total = Math.max(0, Math.round(milliseconds / 60000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const parts = [];
  if (hours > 0) parts.push(`${toArNum(hours)} ساعة`);
  if (minutes > 0) parts.push(`${toArNum(minutes)} دقيقة`);
  return parts.length ? `بعد ${parts.join(" و")}` : "الآن";
}