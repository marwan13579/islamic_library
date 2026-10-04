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
  readerFont: "reader_font",
  readerLine: "reader_line",
  readerLast: "reader_last",
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
  /* المكتبة المستوردة */
  tasbihDaily: "gtasbeeh-daily",
  tasbihCustom: "gtasbeeh-custom",
  tasbihPhrase: "gtasbeeh-phrase",
  tasbihGoal: "gtasbeeh-goal",
  tasbihPeople: "gtasbeeh-people",
  quizLevel: "lib-quiz-level",
  quizHistory: "lib-quiz-history",
  athanTimings: "athan_timings",
  athanCoords: "athan_coords",
  athanMethod: "athan_method",
  athanAutoAudio: "athan_auto_audio",
  athanNotifOff: "athan_notif_off",
  /* صفحات قديمة كانت تُصدَّر بلا تعريف هنا، فسقطت بصمت عند الاستيراد */
  tadabburEntries: "tadabbur-entries",
  wirdGoal: "wird-goal",
  wirdLog: "wird-log",
  qadaOwed: "qada-owed",
  qadaDone: "qada-done",
  mushafProgress: "mushaf-progress",
  mushafReviewDates: "mushaf-reviewdates",
  mushafDaily: "mushaf-daily",
  mushafStreak: "mushaf-streak",
  mushafLastDay: "mushaf-lastday",
  mushafMarkedToday: "mushaf-markedtoday",
  azkarShamilaProgress: "azkar-shamila-progress",
  dailySystemState: "daily-system-state",
  dailySystemStreak: "daily-system-streak",
  dailySystemLastFull: "daily-system-lastfull",
  hadithFavorites: "hadith-favorites",
  prayerTimesState: "prayertimes-state",
  prayerTimesNotify: "prayertimes-notify",
  quranSettings: "quran-settings",
  quranBookmarksPage: "quran-bookmarks",
  quranNotesPage: "quran-notes",
  quranLastPos: "quran-lastpos",
  themePref: "lib-theme-pref",
  ramadanDay: "ramadan-day",
  ramadanState: "ramadan-state",
  ramadanItikaf: "ramadan-itikaf",
  ramadanEidList: "ramadan-eidlist",
  hubLang: "hub-lang",
  hubFavorites: "hub-favorites",
  hubNotes: "hub-notes",
  hubLastUsed: "hub-lastused",
  hubRamadanLoc: "hub-ramadan-loc",
  hubIntroSeen: "hub-intro-seen",
  hubIntroStep: "hub-intro-step",
  nourProgress: "nour-progress",
  /* مكتبة الفيديو الإسلامية: المفضلة وآخر ما شوهد — لا غير */
  videoFavorites: "video_favorites",
  videoRecent: "video_recent",
  /* رفيق النور — نظام التذكير الإيماني */
  noorSettings: "noor-settings",
  noorShown: "noor-shown",
  noorStats: "noor-stats",
  noorActions: "noor-actions",
  /* طبقة التفاعل — التقدّم الموحّد لكل الأدوات */
  engage: "engage-v1",
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
  reader_font: "string",
  reader_line: "string",
  reader_last: "string",
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
  athan_auto_audio: "boolean",
  athan_notif_off: "boolean",
  // المكتبة المستوردة
  "gtasbeeh-daily": "object",
  "gtasbeeh-custom": "array",
  "gtasbeeh-phrase": "string",
  "gtasbeeh-goal": "number",
  "gtasbeeh-people": "array",
  "nour-progress": "object",
  video_favorites: "array",
  video_recent: "array",
  // رفيق النور: إعدادات، وسجلّ عرض (منع التكرار)، وإحصاءات، وأعمال اليوم.
  "noor-settings": "object",
  "noor-shown": "object",
  "noor-stats": "object",
  "noor-actions": "object",
  // طبقة التفاعل: النقاط والأوسمة وأيام المتتالية وما علّمه من عناصر.
  "engage-v1": "object",
  "lib-quiz-level": "string",
  "lib-quiz-history": "array",
  /* صفحات قديمة: الأنواع مستنبطة من قراءتها في الصفحة نفسها */
  "tadabbur-entries": "array",
  "wird-goal": "number",
  "wird-log": "object",
  "qada-owed": "array",
  "qada-done": "array",
  "mushaf-progress": "object",
  "mushaf-reviewdates": "object",
  "mushaf-daily": "number",
  "mushaf-streak": "number",
  "mushaf-lastday": "string",
  "mushaf-markedtoday": "string",
  "azkar-shamila-progress": "object",
  "daily-system-state": "object",
  "daily-system-streak": "number",
  "daily-system-lastfull": "string",
  "hadith-favorites": "object",
  "prayertimes-state": "object",
  // مخزَّن "1"/"0" لا كمنطقي، فهو رقم في عيون القراءة.
  "prayertimes-notify": "number",
  "quran-settings": "object",
  "quran-bookmarks": "object",
  "quran-notes": "object",
  "quran-lastpos": "string",
  "lib-theme-pref": "string",
  "ramadan-day": "number",
  "ramadan-state": "object",
  "ramadan-itikaf": "object",
  "ramadan-eidlist": "string",
  "hub-lang": "string",
  "hub-favorites": "object",
  "hub-notes": "object",
  "hub-lastused": "object",
  "hub-ramadan-loc": "string",
  "hub-intro-seen": "string",
  "hub-intro-step": "string",
  athan_timings: "object",
  athan_coords: "object",
  athan_method: "number",
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
 * قيم النسخة الاحتياطية نصوص، لأن التخزين نصوص: كل ما كُتب بـwrite
 * مرّ على JSON.stringify. فنُعيدها إلى أنواعها قبل فحص النوع والكتابة،
 * وإلا رُفض كل كائن وقائمة ورقم ومنطقي في الملف.
 * @param {unknown} value
 * @returns {unknown}
 */
function decodeStored(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const first = trimmed[0];
  if (first !== "{" && first !== "[" && first !== '"') return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

/**
 * يكتب قيمة كما هي، بلا ترميز JSON إضافي.
 * النسخة الاحتياطية التقاطٌ حرفي لما في التخزين، فالنصّ يُستعاد نصًّا:
 * لولا ذلك لأصبح `lib-theme-pref` محفوظًا بـ"\"dark\"" فيرفضه القارئ.
 * @param {string} key
 * @param {string} value
 */
function writeRaw(key, value) {
  try {
    /** @type {any} */ (target()).setItem(key, value);
    return true;
  } catch {
    return false;
  }
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
  for (const [key, raw] of Object.entries(parsed)) {
    if (!known.has(key)) {
      rejected.push(key);
      continue;
    }
    const expected = IMPORT_TYPES[key];
    // النصّ يعود كما جاء: النسخة تلتقط التخزين حرفيًا.
    if (expected === "string" && typeof raw === "string") {
      writeRaw(key, raw);
      written.push(key);
      continue;
    }
    const value = decodeStored(raw);
    if (expected && !matchesType(value, expected)) {
      rejected.push(key);
      continue;
    }
    write(key, value);
    written.push(key);
  }
  return { written, rejected };
}
