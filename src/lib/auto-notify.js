/**
 * الإشعارات التلقائية — تشتغل وحدها بلا زرّ.
 * ------------------------------------------------------------------
 * المتصفّح لا يقبل طلب إذن الإشعارات إلا من تفاعل صادر عن المستخدم،
 * فطلبُه بلا لمسة يرفضه كل متصفّح تقريبًا (وفي آيفون لا يقبله إلا بعد
 * تثبيت التطبيق). الحلّ المعتمد في المواقع كلها: يُطلب الإذن عند أوّل
 * لمسة — أيّ لمسة، لا ضغطة زرّ مخصّص — فيصير التفعيل تلقائيًّا من جهة
 * المستخدم، بلا قرار يتخذه ولا زرّ يبحث عنه.
 *
 * وبعد الإذن مقبول:
 *   1) إشعار ترحيب عند كل فتح للموقع، يمرّ عبر عامل الخدمة فيظهر
 *      ولو كانت الصفحة في الخلفية، ونقره يفتح الموقع.
 *   2) جدول أذانٍ يُدفع إلى المتصفّح فيرنّ في وقته بعد إغلاق الموقع،
 *      لأنّ مؤقّت الصفحة يموت بإغلاقها ومؤقّت عامل الخدمة لا يموت.
 *
 * @module lib/auto-notify
 */

import { postToWorker, registerServiceWorker } from "./pwa.js";
import { showToast } from "../components/toast.js";
import { read, write, KEYS } from "./storage.js";

/** أقل فاصل بين ترحيبَين في الجلسة نفسها، فلا تتكدّس مع كل تحديث. */
const GREET_INTERVAL = 20 * 60 * 1000;

/** وسمٌ واحد للترحيب، فيستبدل آخرَه بدل أن يصطفّ الإشعاران. */
const GREET_TAG = "noor-greet";

/** متى رحّبنا آخر مرّة — في ذاكرة الجلسة لا الدائمة. */
const GREET_AT = "noor-auto-greet-at";

/** كم نُعيد تأكيد جدول الأذان والصفحة مفتوحة (ست ساعات). */
const REFRESH_EVERY = 6 * 60 * 60 * 1000;

/** إيماءات المستخدم الأولى: أيّها نصنع منها إذنًا. */
const GESTURES = ["pointerdown", "touchend", "keydown", "click"];

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const PRAYER_NAMES = {
  Fajr: "الفجر",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

/** @type {Partial<{ url: string, title: string }>} */
let options = {};

/** @type {((event: Event) => void) | null} */
let gestureHandler = null;

/** @type {ReturnType<typeof setInterval> | null} */
let refreshTimer = null;

/** @type {Promise<boolean> | null} تكرارُ boot() لا يضاعف التسجيل ولا المؤقّت */
let starting = null;

/* ------------------------------------------------------------------ */
/* البيئة                                                              */
/* ------------------------------------------------------------------ */

/** @returns {boolean} هل يدعم المتصفّح الإشعارات وعاملَ الخدمة معًا؟ */
export function supported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator
  );
}

/** @returns {boolean} هل الإذن مُمنح بالفعل؟ */
export function granted() {
  return supported() && Notification.permission === "granted";
}

/** @returns {boolean} هل حجبه المستخدم؟ فلا نطلب مرّة أخرى بعد إذنٍ مرفوض. */
export function refused() {
  return supported() && Notification.permission === "denied";
}

/* ------------------------------------------------------------------ */
/* طلب الإذن عند أوّل لمسة                                             */
/* ------------------------------------------------------------------ */

/**
 * يطلب الإذن مرّة واحدة، ثم — إن مُنح — يحيّي المستخدم ويجدول الأذان.
 * @returns {Promise<NotificationPermission>}
 */
export async function ask() {
  if (!supported()) return /** @type {any} */ ("denied");
  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") await afterGranted();
    return permission;
  } catch {
    return /** @type {any} */ ("denied");
  }
}

/**
 * يراقب أوّل تفاعل من المستخدم فيطلب الإذن تلقائيًّا — بلا زرّ ولا
 * بطاقة ولا سؤال. وهي النافذة الوحيدة التي يقبل فيها المتصفّح الطلب.
 */
export function arm() {
  if (!supported() || Notification.permission !== "default") return;
  if (gestureHandler) return;
  gestureHandler = () => {
    disarm();
    if (Notification.permission !== "default") return;
    ask()
      .then((permission) => {
        if (permission === "granted") showToast("فُعّلت الإشعارات تلقائيًّا 🔔");
      })
      .catch(() => {});
  };
  // التقاط في مرحلة مبكرة: أوّل ضغطة على أيّ زرّ في الصفحة تكفي.
  for (const type of GESTURES) {
    window.addEventListener(type, gestureHandler, { capture: true, passive: true });
  }
}

function disarm() {
  if (!gestureHandler) return;
  for (const type of GESTURES) window.removeEventListener(type, gestureHandler, true);
  gestureHandler = null;
}

/** ما بعد المنح: ترحيبٌ وجدول أذان يعملان بعد إغلاق الموقع. */
async function afterGranted() {
  write(KEYS.notifEnabled, true);
  await greet();
  await pushPrayerSchedule();
}

/* ------------------------------------------------------------------ */
/* إشعار الترحيب عند كل فتح                                            */
/* ------------------------------------------------------------------ */

/**
 * ترحيبٌ يليق بوقت اليوم: إشعارٌ بلا معنى لا يقرؤه أحد.
 * @param {number} hour
 * @returns {string}
 */
function greetingBody(hour) {
  if (hour < 4) return "ليلة مباركة — طلبة الليل هم السادة أولياء الله.";
  if (hour < 11) return "صباح الخير — وردك اليومي وذكر الصباح في انتظارك.";
  if (hour < 15) return "السلام عليكم — لا تنسَ صلاة الضحى والاستغفار.";
  if (hour < 19) return "أهلًا بك — آية اليوم وذكر المساء بانتظارك.";
  if (hour < 23) return "مساء الخير — الأذكار ووردك الليلي في انتظارك.";
  return "ليلة مباركة — لا تهجر القرآن.";
}

/**
 * إشعار الترحيب عند كل فتح للموقع، يمرّ عبر عامل الخدمة فيُعرض ولو
 * كانت الصفحة في الخلفية أو قد أضحى المتصفّح نائمًا في الخلفية.
 * @returns {Promise<boolean>} هل عُرض الإشعار؟
 */
export async function greet() {
  if (!granted()) return false;
  const now = Date.now();
  const last = Number(sessionValue(GREET_AT));
  if (Number.isFinite(last) && now - last < GREET_INTERVAL) return false;
  setSessionValue(GREET_AT, String(now));

  const payload = {
    type: "notify",
    title: options.title ?? "🕌 المكتبة الإسلامية",
    body: greetingBody(new Date().getHours()),
    tag: GREET_TAG,
    url: options.url ?? "./",
  };
  // عامل الخدمة أوّلًا (يعمل بعد إغلاق الصفحة)، و`new Notification`
  // احتياطًا للمتصفّح الذي منع تسجيل العامل.
  const shown = (await postToWorker(payload)) || showDirect(payload);
  // المتصفّح لا يُظهر إشعارًا لصفحة في مقدّمتها، فنُبصره من داخلها.
  if (shown && typeof document !== "undefined" && document.visibilityState !== "hidden") {
    showToast(payload.body);
  }
  return shown;
}

/** @param {{ title: string, body: string, tag: string }} payload */
function showDirect(payload) {
  try {
    new Notification(payload.title, { body: payload.body, tag: payload.tag });
    return true;
  } catch {
    return false;
  }
}

/**
 * إشعار تجريبي فوري — لزرّ الجرس حين يكون الإذن قد مُنح من قبل.
 * @param {{ title?: string, body?: string, url?: string }} [payload]
 * @returns {Promise<boolean>}
 */
export async function test(payload = {}) {
  if (!granted()) return false;
  const message = {
    type: "notify",
    title: payload.title ?? "🔔 الإشعارات تعمل",
    body: payload.body ?? "هكذا سيصلك تنبيه الموقع، ولو كان مغلقًا.",
    tag: "noor-test",
    url: payload.url ?? "./",
  };
  return (await postToWorker(message)) || showDirect(message);
}

/* ------------------------------------------------------------------ */
/* جدولة الأذان لدى المتصفّح                                           */
/* ------------------------------------------------------------------ */

/**
 * يدفع جدول اليوم إلى عامل الخدمة، فينبه الأذان ولو أُغلق الموقع.
 * @returns {Promise<boolean>}
 */
export async function pushPrayerSchedule() {
  if (!granted()) return false;
  // الإيقاف اختيارٌ محفوظ: لولاه لأعادت الصفحة جدولة ما أوقفه المستخدم.
  if (read(KEYS.athanNotifOff, false)) return false;

  let timings = read(KEYS.athanTimings, null) ?? read("prayer_timings", null);
  if (!timings) timings = await fetchStoredTimings();
  const schedule = timings ? buildSchedule(timings) : [];
  if (!schedule.length) return false;
  return postToWorker({ type: "schedule-athan", schedule });
}

/** يجلب المواقيت من الخادم مرّة — الإحداثيات محفوظة — ثم يحفظها. */
async function fetchStoredTimings() {
  const coords = read(KEYS.athanCoords, null) ?? read(KEYS.prayerCoords, null);
  if (typeof coords?.lat !== "number" || typeof coords?.lng !== "number") return null;
  try {
    const { fetchPrayerTimes } = await import("./api.js");
    const timings = await fetchPrayerTimes(coords, Number(read(KEYS.calcMethod, 5)));
    if (timings) write(KEYS.athanTimings, timings);
    return timings;
  } catch {
    return null;
  }
}

/**
 * يحوّل مواقيت اليوم إلى جدولٍ مطلق، وما فات اليوم يُدفع إلى الغد
 * ليبقى التنبيه قائمًا بدل أن يختفي كله بعد آخر صلاة.
 * @param {Record<string, string>} timings
 * @returns {{ key: string, name: string, at: number, href: string }[]}
 */
export function buildSchedule(timings) {
  const href = (typeof location !== "undefined" && location.pathname) || "./";
  const schedule = [];
  for (const key of PRAYERS) {
    const at = clockOf(timings?.[key]);
    if (!at) continue;
    const when = new Date();
    when.setHours(at.hour, at.minute, 0, 0);
    if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1);
    schedule.push({ key, name: PRAYER_NAMES[key], at: when.getTime(), href });
  }
  return schedule;
}

/** @param {string | undefined} value @returns {{ hour: number, minute: number } | null} */
function clockOf(value) {
  const match = String(value ?? "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

/* ------------------------------------------------------------------ */
/* ذاكرة الجلسة                                                        */
/* ------------------------------------------------------------------ */

/** @param {string} key @returns {string | null} */
function sessionValue(key) {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {string} value
 */
function setSessionValue(key, value) {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, value);
  } catch {
    /* التخزين محجوب: يُرحَّب كل فتح، وهذا أهون من إفساد الصفحة */
  }
}

/* ------------------------------------------------------------------ */
/* التشغيل                                                             */
/* ------------------------------------------------------------------ */

/**
 * التشغيل الكامل: تسجيل عامل الخدمة، وتسليح الإذن عند أوّل لمسة،
 * ثم — إن كان الإذن قد مُنح — ترحيبٌ وجدول أذان يتجدّدان.
 * @param {{ url?: string, title?: string }} [settings]
 * @returns {Promise<boolean>}
 */
export async function boot(settings = {}) {
  Object.assign(options, settings);
  if (!supported()) return false;
  starting ??= registerServiceWorker().catch(() => null);
  await starting;

  arm();
  if (refreshTimer === null && typeof setInterval === "function") {
    // المواقيت تتغيّر بتغيّر اليوم، فلا بدّ من تجديد الجدول بين حين وآخر.
    refreshTimer = setInterval(() => {
      pushPrayerSchedule().catch(() => {});
    }, REFRESH_EVERY);
  }
  if (!granted()) return false;
  await greet();
  await pushPrayerSchedule();
  return true;
}