/**
 * التواريخ: الهجري عبر `Intl` (بلا أي مكتبة)، الستريك، ومفتاح الأسبوع.
 * @module lib/dates
 */

/** @type {Intl.DateTimeFormat} */
const HIJRI_LONG = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** @type {Intl.DateTimeFormat} */
const HIJRI_SHORT = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** @type {Intl.DateTimeFormat} */
const GREGORIAN_AR = new Intl.DateTimeFormat("ar-EG-u-ca-gregory", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * @param {Date} [date]
 * @returns {string} مثل «١٥ ربيع الآخر ١٤٤٧ هـ»
 */
export function hijriLong(date = new Date()) {
  return `${HIJRI_LONG.format(date)} هـ`;
}

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function hijriShort(date = new Date()) {
  return HIJRI_SHORT.format(date);
}

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function gregorianLong(date = new Date()) {
  return GREGORIAN_AR.format(date);
}

/**
 * @param {Date} [date]
 * @returns {{ day: string, month: string, year: string }}
 */
export function hijriParts(date = new Date()) {
  const parts = HIJRI_LONG.formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value ?? "—";
  return { day: read("day"), month: read("month"), year: read("year") };
}

/**
 * @param {"hijri" | "gregorian"} type
 * @param {Date} [date]
 * @returns {string}
 */
export function calendarLabel(type, date = new Date()) {
  return type === "gregorian" ? gregorianLong(date) : hijriLong(date);
}

/**
 * مفتاح يوم محلي (لا UTC) بالصيغة `YYYY-MM-DD`.
 * @param {Date} [date]
 * @returns {string}
 */
export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * @param {string} key
 * @returns {Date}
 */
export function fromDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/**
 * بذرة ثابتة لكل يوم — لاختيار آية اليوم دون عشوائية متغيّرة.
 * @param {Date} [date]
 * @returns {number}
 */
export function daySeed(date = new Date()) {
  const key = dateKey(date);
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  return hash;
}

/**
 * @template T
 * @param {T[]} items
 * @param {Date} [date]
 * @returns {T}
 */
export function dailyOf(items, date = new Date()) {
  return items[daySeed(date) % items.length];
}

/**
 * @typedef {Object} Stats
 * @property {number} streak
 * @property {number} dhikrToday
 * @property {string} day
 */

/**
 * @param {Stats} stats
 * @returns {Stats}
 */
/** أمسٍ بتقويم القويم، لا بطرح ٢٤ ساعة، فلا يخطئ عند تغيّر التوقيت الصيفي. */
function yesterdayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
}

export function updateStreak(stats) {
  const today = dateKey();
  const yesterday = dateKey(yesterdayDate());
  if (stats.day === today) return { ...stats, day: today };
  return {
    streak: stats.day === yesterday ? stats.streak + 1 : 1,
    dhikrToday: 0,
    day: today,
  };
}

/** أول أيام الأسبوع: السبت، وهو بداية الأسبوع الشرعي. */
const WEEK_START = 6;

/**
 * يحسب عدد الأيام منذ أقرب سبت إلى هذا التاريخ.
 * @param {Date} date
 * @returns {number} ٠ = يوم السبت
 */
function daysSinceWeekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): ٠ الأحد ← ٦ السبت
  const offset = (start.getDay() - WEEK_START + 7) % 7;
  start.setDate(start.getDate() - offset);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86400000);
}

/**
 * مفتاح الأسبوع لتحدّي الاختبار الأسبوعي الثابت.
 * يبدأ الأسبوع يوم السبت، فلا ينتصف بين يومين متلاصقين.
 * @param {Date} [date]
 * @returns {string} مثل `2026-09-26`
 */
export function weekKey(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - daysSinceWeekStart(date));
  return dateKey(start);
}

/**
 * @param {Date} [date]
 * @returns {number} عدد الأيام المتبقية في الأسبوع (٠ = السبت)
 */
export function daysLeftInWeek(date = new Date()) {
  return 6 - daysSinceWeekStart(date);
}

/**
 * @param {string} key مثل `1 محرم`
 * @returns {boolean} هل يطابق هذا التاريخ الهجري اليوم؟
 */
export function isHijriToday(key) {
  const [day, month] = String(key).split(/\s+/).map((part) => part.trim());
  const parts = hijriParts();
  const normalize = (value) => value.replace(/^ال/, "").trim();
  return (
    toDigits(day) === toDigits(parts.day) && normalize(month) === normalize(parts.month)
  );
}

function toDigits(value) {
  return String(value).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}