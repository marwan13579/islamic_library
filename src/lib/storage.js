/**
 * غلاف آمن حول `localStorage` مع دعم القيم المهيكلة.
 * يعتمد على `storage-fallback.js` الذي يوفّر بديلًا في الذاكرة عند المنع.
 * @module lib/storage
 */

/** @type {Storage | null} */
let backend = null;
/** @type {Map<string, string> | null} */
let memory = null;

/** بديل في الذاكرة يحترم واجهة Storage. */
function createMemoryStore() {
  /** @type {Map<string, string>} */
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

function store() {
  if (backend) return backend;
  try {
    const probe = "__noor_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    backend = window.localStorage;
    memory = null;
  } catch {
    backend = null;
    memory = memory ?? createMemoryStore();
  }
  return backend;
}

/** @returns {Storage} التخزين الدائم أو البديل في الذاكرة */
function target() {
  store();
  return /** @type {Storage} */ (backend ?? /** @type {any} */ (memory));
}

/** @returns {boolean} هل التخزين دائم أم مؤقت في الذاكرة */
export function isPersistent() {
  return store() !== null;
}

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export function read(key, fallback = null) {
  try {
    const raw = /** @type {any} */ (target()).getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return /** @type {T} */ (JSON.parse(raw));
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {boolean} نجاح الكتابة
 */
export function write(key, value) {
  try {
    /** @type {any} */ (target()).setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} key
 */
export function remove(key) {
  try {
    /** @type {any} */ (target()).removeItem(key);
  } catch {
    /* التخزين المحجوب — لا حاجة لإزعاج المستخدم */
  }
}

/** @returns {string[]} كل المفاتيح المخزّنة */
export function keys() {
  try {
    const store0 = target();
    const out = [];
    for (let index = 0; index < store0.length; index += 1) {
      const key = store0.key(index);
      if (key) out.push(key);
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * يقرأ قائمة معرّفات ويضيف/يزيل عنصرًا منها.
 * @param {string} key
 * @param {string} id
 * @returns {boolean} الحالة بعد التبديل
 */
export function toggleInList(key, id) {
  const list = read(key, []);
  const index = list.indexOf(id);
  if (index === -1) list.push(id);
  else list.splice(index, 1);
  write(key, list);
  return index === -1;
}

/**
 * @param {string} key
 * @param {string} id
 * @returns {boolean}
 */
export function has(key, id) {
  return read(key, []).includes(id);
}

/** @type {Record<string, string>} */
export const KEYS = {
  theme: "theme",
  fontSize: "font-size",
  readLessons: "readLessons",
  lessonScroll: "lessonScroll",
  bookmarks: "bookmarks",
  quizStats: "quizStats",
  weeklyDone: "weeklyDone",
  certificates: "certificates",
  tasbihCount: "tasbihCount",
  totalTasbih: "totalTasbih",
  stats: "stats",
  calendarType: "calendar_type",
  continueState: "continue-state",
  askDraft: "askDraft",
  lastTab: "last_tab",
  khatma: "khatma_state",
  khatmaAssignees: "khatma_assignees",
  khatmaDedication: "khatma_dedication",
  prayerCity: "prayer_city",
  prayerCoords: "user_coords",
  calcMethod: "calc_method",
  quranFontSize: "quran_font_size",
  focusMode: "focus_mode",
  quranBookmarks: "quran_bookmarks",
  quranWard: "quran_ward",
  athkarProgress: "athkar_progress",
  athkarStreak: "athkar_streak",
  prayerTracker: "prayer_tracker",
  notifEnabled: "notif_enabled",
  notifBefore: "notif_before",
  reciter: "reciter",
  radioVolume: "radio_volume",
  sadakaCards: "sadaka_cards",
  cardState: "card_state",
};

/**
 * نوع كل مفتاح كما يقرؤه التطبيق.
 * ما لم يُذكر هنا يُقبل أي قيمة، لأن تخمين النوع أخطر من تضييقه.
 * @type {Record<string, "object" | "string" | "number" | "boolean" | "array">}
 */
export const IMPORT_TYPES = {
  // كائنات تقرؤها الواجهة وتبني بها ما يُعرض
  readLessons: "object",
  bookmarks: "object",
  stats: "object",
  quizStats: "object",
  weeklyDone: "object",
  certificates: "array",
  lessonScroll: "object",
  khatma_state: "object",
  khatma_assignees: "object",
  quran_bookmarks: "array",
  quran_ward: "object",
  athkar_progress: "object",
  prayer_tracker: "object",
  sadaka_cards: "array",
  user_coords: "object",
  card_state: "object",
  "continue-state": "object",
  // نصوص
  calendar_type: "string",
  last_tab: "string",
  khatma_dedication: "string",
  askDraft: "string",
  prayer_city: "string",
  theme: "string",
  // أعداد
  tasbihCount: "number",
  totalTasbih: "number",
  calc_method: "number",
  quran_font_size: "number",
  athkar_streak: "number",
  notif_before: "number",
  radio_volume: "number",
  reciter: "number",
  "font-size": "number",
  // منطقيات
  focus_mode: "boolean",
  notif_enabled: "boolean",
};

/**
 * @param {unknown} value
 * @param {"object" | "string" | "number" | "boolean" | "array"} type
 */
function matchesType(value, type) {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === type;
}

/**
 * يقبل من ملف الاستيراد المفاتيح المعرَّفة بنوعها الصحيح فقط.
 * يُرجع ما كُتب وما رُفض.
 * @param {Record<string, unknown>} parsed
 * @returns {{ written: string[], rejected: string[] }}
 */
export function importKnownKeys(parsed) {
  const known = new Set(Object.values(KEYS));
  const written = [];
  const rejected = [];
  for (const [key, value] of Object.entries(parsed)) {
    const expected = IMPORT_TYPES[key];
    if (!known.has(key) || (expected && !matchesType(value, expected))) {
      rejected.push(key);
      continue;
    }
    write(key, value);
    written.push(key);
  }
  return { written, rejected };
}
