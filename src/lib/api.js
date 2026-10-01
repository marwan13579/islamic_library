/**
 * أدوات الشبكة: مهلة، إعادة محاولة، وتغلّف أخطاء مفهومة بالعربية.
 * @module lib/api
 */

/**
 * جلب JSON مع مهلة زمنية.
 * @param {string} url
 * @param {{ timeout?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 */
export async function fetchJson(url, options = {}) {
  const { timeout = 10000, signal } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {unknown} error
 * @returns {string} رسالة عربية مفهومة
 */
export function networkError(error) {
  if (error?.name === "AbortError") return "انتهت مهلة الاتصال — حاول مرة أخرى أو تحقّق من الشبكة.";
  if (error instanceof TypeError) return "تعذّر الاتصال بالإنترنت. بعض المزايا تعمل بدون اتصال.";
  return "حدث خطأ غير متوقّع — حاول مرة أخرى.";
}

/**
 * @param {number} [timeout]
 * @returns {(callback: (...args: any[]) => void) => (...args: any[]) => void}
 */
export function debounce(timeout = 200) {
  let timer = null;
  return (callback) => (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => callback(...args), timeout);
  };
}

/**
 * يطلب الموقع الجغرافي مع رسالة خطأ عربية واضحة.
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export function requestLocation() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("جهازك لا يدعم تحديد الموقع — أدخل الإحداثيات يدويًا."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(new Error(locationError(error))),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 600000 },
    );
  });
}

/**
 * @param {GeolocationPositionError | { code: number }} error
 * @returns {string}
 */
export function locationError(error) {
  switch (error?.code) {
    case 1:
      return "رُفض إذن الموقع. فعّله من إعدادات المتصفح أو أدخل الإحداثيات يدويًا.";
    case 2:
      return "تعذّر تحديد الموقع عبر GPS — أدخل الإحداثيات يدويًا.";
    case 3:
      return "انتهت مهلة تحديد الموقع — حاول مجددًا أو أدخل الإحداثيات يدويًا.";
    default:
      return "تعذّر تحديد الموقع — أدخل الإحداثيات يدويًا.";
  }
}

/**
 * مواقيت الصلاة من AlAdhan.
 * @param {{ lat: number, lng: number }} coords
 * @param {number} method
 * @param {string} [date] DD-MM-YYYY
 */
export async function fetchPrayerTimes(coords, method = 5, date) {
  const day = date ?? formatApiDate(new Date());
  const url = `https://api.aladhan.com/v1/timings/${day}?latitude=${coords.lat}&longitude=${coords.lng}&method=${method}`;
  const payload = await fetchJson(url, { timeout: 8000 });
  const timings = payload?.data?.timings;
  if (!timings) throw new Error("تعذّر جلب المواقيت.");
  return timings;
}

function formatApiDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

/** @type {Record<string, string>} طرق الحساب المعتمدة في AlAdhan */
const CALC_METHOD_NAMES = {
  0: "الجمعية الإسلامية لأمريكا الشمالية",
  1: "جامعة العلوم الإسلامية — كراتشي",
  2: "الجمعية الإسلامية لأمريكا الشمالية (ISNA)",
  3: "رابطة العالم الإسلامي",
  4: "الجمعية الإسلامية الأمريكية (ISNA)",
  5: "أم القرى — مكة المكرمة",
  7: "معهد الجيوفيزياء — طهران",
  8: "هيئة الشؤون الإسلامية — السعودية",
  12: "الاتحاد الإسلامي العالمي",
  13: "هيئة الشؤون الإسلامية — السعودية",
  14: "معهد الجيوفيزياء — طهران",
  15: "الجمعية الإسلامية — السنغال",
  17: "الهيئة المصرية العامة للمساحة",
};

/** @type {number[]} الطرق المعروضة في الواجهة */
export const CALC_METHODS = [5, 4, 3, 2, 1, 8, 12];

/** @param {number} method */
export function methodName(method) {
  return CALC_METHOD_NAMES[method] ?? `طريقة رقم ${method}`;
}
