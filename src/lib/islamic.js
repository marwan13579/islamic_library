/**
 * أدوات إسلامية حسابية: القبلة، الزكاة، النصاب، والسبحة.
 * @module lib/islamic
 */

import { normalizeAr } from "./text.js";

/** إحداثيات الكعبة */
export const KAABA = { lat: 21.4225, lng: 39.8262 };

/** أقصى خط عرض (بين القطبين). */
export const LAT_LIMIT = 90;
/** أقصى خط طول (بين الظلّين). */
export const LNG_LIMIT = 180;

/**
 * صحّة إحداثيات الموقع: خط العرض بين ٩٠ شمالًا وجنوبًا، والطول بين ١٨٠ شرقًا وغربًا.
 *
 * فبدونها يخرج حساب القبلة عن معناه كلّيًا (لأنّ `atan2` لا يميّز بين
 * أطراف المجال)، فالتحقّق هنا يمنع أن تعرض الواجهة زاوية مغلوطة.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {boolean}
 */
export function isValidCoords(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= LAT_LIMIT && Math.abs(lng) <= LNG_LIMIT
  );
}

/** نصاب الذهب بالجرام */
export const NISAB_GOLD = 85;
/** نصاب الفضة بالجرام */
export const NISAB_SILVER = 595;
/** نسبة زكاة المال */
const ZAKAT_RATE = 0.025;

const toRad = (value) => (value * Math.PI) / 180;
const toDeg = (value) => (value * 180) / Math.PI;

/**
 * اتجاه القبلة من موقع معيّن: الدائرة العظمى إلى الكعبة، بالدرجات من الشمال
 * الحقيقي مع عقارب الساعة (٠ شمال · ٩٠ شرق · ١٨٠ جنوب · ٢٧٠ غرب).
 *
 *Formula baptism很多人的 كتاب «اتجاه القبلة»:
 *
 *     y = sin Δλ · cos φ₂
 *     x = cos φ₁ · sin φ₂ − sin φ₁ · cos φ₂ · cos Δλ
 *     θ = atan2(y, x)
 *
 * وفيها `cos φ₂` عامل لا بدّ منه؛ بحذفه ينحرف الاتجاه نحو القطب بضع درجات
 * (نحو درجتين في مصر)، ولا يظهر الخلل إلا عند مقارنته بمرجع.
 *
 * @param {number} lat خط عرض الموقع
 * @param {number} lng خط طول الموقع
 * @returns {number | null} 0..360، و`null` إن كانت الإحداثيات خارج المدى
 */
export function calcQibla(lat, lng) {
  if (!isValidCoords(lat, lng)) return null;
  const phi1 = toRad(lat);
  const phi2 = toRad(KAABA.lat);
  const deltaLng = toRad(KAABA.lng - lng);
  const y = Math.sin(deltaLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** @type {Array<[number, string]>} */
const COMPASS = [
  [0, "شمال"], [45, "شمال شرق"], [90, "شرق"], [135, "جنوب شرق"],
  [180, "جنوب"], [225, "جنوب غرب"], [270, "غرب"], [315, "شمال غرب"],
];

/**
 * @param {number} angle
 * @returns {string} اسم الاتجاه بالعربية
 */
export function compassName(angle) {
  const index = Math.round((((angle % 360) + 360) % 360) / 45) % 8;
  return COMPASS[index][1];
}

/**
 * زكاة المال.
 * @param {number} amount القيمة المعروضة (بالعملة أو بالجرام)
 * @param {number} [nisab]
 * @param {number} [rate]
 * @returns {{ due: number, belowNisab: boolean, shortfall: number, percent: number }}
 */
export function calculateZakat(amount, nisab = NISAB_GOLD, rate = ZAKAT_RATE) {
  const value = Number(amount) || 0;
  if (value < nisab) {
    return { due: 0, belowNisab: true, shortfall: round2(nisab - value), percent: 0 };
  }
  const due = round2(value * rate);
  return { due, belowNisab: false, shortfall: 0, percent: rate * 100 };
}

/**
 * زكاة المعادن النفيسة من الوزن والسعر.
 *
 * المذهب المشهور: النصاب لا يجب فيما هو زينةً يُلبس أو يُصاغ للزينة،
 * إن كان على صاحبه فيه حاجة معتبرة. فيُفرَّق بين:
 *  - `trade`  ذهبٌ للتجارة أو مكتنز للادخار: تجب فيه الزكاة على النصاب.
 *  - `jewelry` ذهبٌ للزينة: لا تجب فيه زكاة النصاب.
 *
 * ومن أراد الاستيفاء احتياطًا فليؤخذ بالحساب عند أهل العلم في محلّه.
 *
 * @param {number} weight جرام
 * @param {number} price سعر الجرام
 * @param {"gold" | "silver"} kind
 * @param {"trade" | "jewelry"} [holding] ما هو الذهب؟ للتجارة أم للزينة؟
 */
export function calculateMetalZakat(weight, price, kind = "gold", holding = "trade") {
  const grams = Number(weight) || 0;
  const rate = Number(price) || 0;
  const nisabGrams = kind === "silver" ? NISAB_SILVER : NISAB_GOLD;
  const value = round2(grams * rate);
  const nisab = round2(nisabGrams * rate);

  if (holding === "jewelry") {
    return {
      value,
      grams,
      price: rate,
      nisabGrams,
      nisab,
      due: 0,
      belowNisab: false,
      shortfall: 0,
      percent: 0,
      holding,
      note: "الزينة: لا يجب فيها زكاة النصاب على المذهب المشهور.",
    };
  }

  const result = calculateZakat(value, nisab);
  return { ...result, value, nisab, grams, price: rate, nisabGrams, holding };
}

/**
 * زكاة الأنعام بالعدد.
 *
 * الجداول أدناه مشهورة ومتفق عليها في كتب الفقه. وما بعد مداها المتفق عليه
 * يتّسع فيه الخلاف بين أهل العلم، فلا يُخمَّن فيه رقم، بل يُرجَع `null`
 * ويُعلَم للمستخدم أن العدد خارج جدول التطبيق ويرجع لأهل العلم.
 *
 * @param {{ camels?: number, cows?: number, sheep?: number }} herd
 * @returns {Array<{ item: string, due: number | null, note: string }>}
 */
export function calculateLivestockZakat({ camels = 0, cows = 0, sheep = 0 } = {}) {
  const camel = Number(camels) || 0;
  const cow = Number(cows) || 0;
  const small = Number(sheep) || 0;
  /** @type {{ item: string, due: number | null, note: string }[]} */
  const rows = [];
  if (camel > 0) {
    rows.push({ item: "الإبل", due: camelShare(camel), note: "نصاب ٥ إبل فأكثر" });
  }
  if (cow > 0) {
    rows.push({ item: "البقر", due: cowShare(cow), note: "نصاب ٣٠ بقرة فأكثر" });
  }
  if (small > 0) {
    rows.push({ item: "الغنم", due: sheepShare(small), note: sheepNote(small) });
  }
  return rows;
}

/** أعلى عدد في جدول الإبل الذيل فيه الراجح. */
export const CAMEL_TABLE_MAX = 299;
/** أعلى عدد في جدول البقر. */
export const COW_TABLE_MAX = 999;

/** @type {Array<[number, number]>} */
const CAMEL_TABLE = [
  [5, 1], [10, 1], [15, 2], [20, 2], [25, 3], [30, 3], [35, 4], [40, 4],
  [45, 5], [60, 10], [110, 10], [121, 11], [130, 12], [140, 15], [150, 16],
  [160, 17], [170, 18], [180, 19], [190, 20], [200, 21], [210, 22], [220, 23],
  [230, 24], [240, 25], [250, 26], [260, 27], [270, 28], [280, 29], [290, 30],
];

/** @type {Array<[number, number]>} */
const COW_TABLE = [
  [30, 1], [40, 2], [60, 3], [100, 4], [200, 5], [300, 6], [400, 7],
  [500, 8], [600, 9], [700, 10], [800, 12], [900, 15], [1000, 20],
];

/**
 * يبحث في جدول [أدنى عدد، الواجب] عن أوّل مدخل يغطّي العدد.
 * @param {Array<[number, number]>} table
 * @param {number} count
 * @param {number} max
 * @returns {number | null}
 */
function shareOf(table, count, max) {
  if (count > max) return null;
  let due = 0;
  for (const [from, value] of table) {
    if (count >= from) due = value;
    else break;
  }
  return due;
}

/** @param {number} count */
function camelShare(count) {
  return shareOf(CAMEL_TABLE, count, CAMEL_TABLE_MAX);
}

/** @param {number} count */
function cowShare(count) {
  return shareOf(COW_TABLE, count, COW_TABLE_MAX);
}

/**
 * زكاة الغنم: خمسة فأربعون رأسًا، ثم تتزايد-share.
 * @param {number} count
 */
function sheepShare(count) {
  if (count < 5) return 0;
  if (count < 40) return 1;
  if (count < 200) return 2;
  if (count < 2000) return 3;
  return 4;
}

/** @param {number} count */
function sheepNote(count) {
  if (count < 5) return "دون النصاب";
  if (count < 40) return "٢.٥٪";
  if (count < 200) return "٥٪";
  return "١٠٪";
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * السبحة الإلكترونية.
 * @param {Object} state
 * @param {number} state.count عدّاد اليوم
 * @param {number} state.total الإجمالي الكلي
 * @param {number} state.target الهدف اليومي (٠ = بلا هدف)
 */
export function tasbihStep(state, dhikr) {
  const count = state.count + 1;
  return {
    ...state,
    count,
    total: state.total + 1,
    dhikr,
    reached: state.target > 0 && count === state.target,
  };
}

/**
 * @param {number} count
 * @returns {number} نسبة الإجازة إلى الهدف
 */
export function tasbihPercent(count, target) {
  if (!target) return 0;
  return Math.min(100, Math.round((count / target) * 100));
}

/** @type {Record<string, number>} تقدير المسافة التقريبية لكل ذكر عند ٣٣ تكرارًا */
const TASBIH_DISTANCE = {
  "سبحان الله": 1.6,
  "الحمد لله": 1.9,
  "الله أكبر": 1.6,
  "لا إله إلا الله": 2.2,
  "أستغفر الله": 1.9,
  "لا حول ولا قوة إلا بالله": 2.7,
};

/**
 * @param {string} dhikr
 * @param {number} count
 * @returns {string}
 */
export function estimateDistance(dhikr, count) {
  const base = Object.entries(TASBIH_DISTANCE).find(([key]) =>
    normalizeAr(key) === normalizeAr(dhikr),
  );
  if (!base) return "—";
  return `${round2((base[1] * count) / 33).toFixed(1)} كم تقريبًا`;
}