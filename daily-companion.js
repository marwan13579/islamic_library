/*
 * محرك الرفيق اليومي — daily-companion.js
 * ------------------------------------------------------------------
 * منطق الصفحة الرئيسية «رفيق المسلم اليومي»: الصلاة القادمة، الورد
 * اليومي وتقدّمه، الأيام المتتالية، المحتوى اليومي، المشاركة، والتذكيرات.
 *
 * يُكتب كسكربت عادي (بلا وحدات ES) ليبقى قابلًا للفتح من القرص مثل
 * بقية صفحات الفهرس، ولئلا يبقى تحميل الصفحة الرئيسية بلا وحدة.
 *
 * لا يحتوي هذا الملف أي نصّ ديني: المحتوى يأتي من `daily-content.js`
 * المولَّد آليًا من `src/data/*` (المصدر الوحيد). وإن غاب المحتوى فلا
 * يظهر شيء — ولا يُخترع بديل.
 *
 * كل ما يُكتب هنا يذهب تحت بادئة `dc-` فلا يمسّ مفاتيح الأدوات القائمة
 * (`wird-goal`، `khatma_state`، `mushaf-progress` …) ولا يغيّرها.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DailyCompanion = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /** النطاق العام — نلتقطه هنا لأنّ معامل الغلاف ليس مرئيًا داخل المصنع. */
  const GLOBAL = typeof globalThis !== "undefined" ? globalThis : this;

  /* ==================== ثوابت ==================== */

  /** عدد صفحات المصحف المدني المعتمدة في أدوات المشروع (٦٠٤ صفحة). */
  const QURAN_PAGES = 604;

  const KEYS = {
    plan: "dc-plan",
    log: "dc-log",
    streak: "dc-streak",
    reminders: "dc-reminders",
    saved: "dc-saved",
    prefs: "dc-prefs",
  };

  const PRAYERS = [
    { id: "fajr", name: "الفجر" },
    { id: "sunrise", name: "الشروق" },
    { id: "dhuhr", name: "الظهر" },
    { id: "asr", name: "العصر" },
    { id: "maghrib", name: "المغرب" },
    { id: "isha", name: "العشاء" },
  ];

  /** طرق الحساب نفسها المستخدمة في 29-prayer-times.html فتبقى المواقيت متسقة. */
  const METHODS = [
    { id: "mwl", name: "رابطة العالم الإسلامي", fajr: 18, isha: 17 },
    { id: "isna", name: "الجمعية الإسلامية لأمريكا الشمالية", fajr: 15, isha: 15 },
    { id: "egypt", name: "الهيئة المصرية العامة للمساحة", fajr: 19.5, isha: 17.5 },
    { id: "karachi", name: "جامعة كراتشي", fajr: 18, isha: 18 },
    { id: "makkah", name: "أم القرى، مكة المكرمة", fajr: 18.5, isha: "90" },
    { id: "kuwait", name: "الكويت", fajr: 18, isha: 17.5 },
    { id: "qatar", name: "قطر", fajr: 18, isha: "90" },
    { id: "gulf", name: "الخليج", fajr: 19.5, isha: "90" },
  ];

  const DEFAULT_LOCATION = { lat: 30.0444, lon: 31.2357, label: "القاهرة (افتراضي)" };

  const PLANS = [
    { id: "small", label: "ورد صغير", pages: 2, note: "سورتان كل يوم — أخفُّ ورد وأدومُه" },
    { id: "medium", label: "ورد متوسط", pages: 4, note: "أربع صفحات كل يوم" },
    { id: "large", label: "ورد كبير", pages: 8, note: "ثماني صفحات كل يوم" },
    { id: "khatma7", label: "ختمة في ٧ أيام", pages: Math.ceil(QURAN_PAGES / 7), note: "من أول المصحف" },
    { id: "khatma15", label: "ختمة في ١٥ يومًا", pages: Math.ceil(QURAN_PAGES / 15), note: "من أول المصحف" },
    { id: "khatma30", label: "ختمة في ٣٠ يومًا", pages: Math.ceil(QURAN_PAGES / 30), note: "جزء كل يوم تقريبًا" },
    { id: "khatma60", label: "ختمة في ٦٠ يومًا", pages: Math.ceil(QURAN_PAGES / 60), note: "أخفُّ خطة وأدومُها" },
    { id: "custom", label: "خطة مخصصة", pages: 0, note: "حدّد الصفحات أو الأيام بنفسك" },
  ];

  /* ==================== تخزين آمن ==================== */

  function store() {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage;
    } catch (error) {
      return null;
    }
  }

  function readRaw(key) {
    const s = store();
    if (!s) return null;
    try {
      return s.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeRaw(key, value) {
    const s = store();
    if (!s) return false;
    try {
      s.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function readJson(key, fallback) {
    const raw = readRaw(key);
    if (raw === null || raw === "") return fallback;
    try {
      const value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    return writeRaw(key, JSON.stringify(value));
  }

  /* ==================== تواريخ ==================== */

  /** مفتاح اليوم بالتوقيت المحلي — لا UTC، حتى لا ينقلب اليوم قبل منتصف الليل. */
  function dateKey(date) {
    const d = date instanceof Date ? date : new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function fromKey(key) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key ?? ""));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    // الحقول غير الصالحة (٣٠ فبراير) تعبر إلى الشهر التالي — نرفضها.
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function shiftKey(key, days) {
    const date = fromKey(key);
    if (!date) return null;
    date.setDate(date.getDate() + days);
    return dateKey(date);
  }

  /** بذرة ثابتة لليوم: نفس المحتوى طوال اليوم، ويختلف بين الأيام. */
  function daySeed(date) {
    const d = date instanceof Date ? date : new Date();
    const key = dateKey(d);
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function pick(list, salt, date) {
    if (!Array.isArray(list) || !list.length) return null;
    const seed = (daySeed(date) + (salt || 0) * 2654435761) >>> 0;
    return list[seed % list.length];
  }

  function toArabicDigits(value) {
    return String(value).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  }

  /* ==================== الموقع وطرق الحساب ==================== */

  function getLocation() {
    const prefs = readJson(KEYS.prefs, {});
    const loc = prefs && typeof prefs.location === "object" && prefs.location ? prefs.location : null;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) {
      return { lat: loc.lat, lon: loc.lon, label: String(loc.label ?? "") || "موقعك" };
    }
    return { ...DEFAULT_LOCATION };
  }

  function setLocation(lat, lon, label) {
    const prefs = readJson(KEYS.prefs, {});
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    prefs.location = { lat, lon, label: String(label ?? "") };
    return writeJson(KEYS.prefs, prefs);
  }

  function getMethod() {
    const prefs = readJson(KEYS.prefs, {});
    const id = prefs && prefs.method ? String(prefs.method) : "mwl";
    return METHODS.find((m) => m.id === id) || METHODS[0];
  }

  function setMethod(id) {
    const method = METHODS.find((m) => m.id === id);
    if (!method) return false;
    const prefs = readJson(KEYS.prefs, {});
    prefs.method = method.id;
    return writeJson(KEYS.prefs, prefs);
  }

  /* ==================== المواقيت ==================== */

  function calculations() {
    return GLOBAL.IslamicCalculations || null;
  }

  /**
   * مواقيت اليوم بالساعات العشرية، أو null إن تعذّر الحساب
   * (لا مكتبة، أو إحداثيات غير صالحة). لا يرمي خطأ أبدًا.
   */
  function prayerTimes(date, location, method) {
    const calc = calculations();
    if (!calc || typeof calc.computePrayerTimes !== "function") return null;
    const loc = location || getLocation();
    const methodDef = method || getMethod();
    const when = date instanceof Date ? date : new Date();
    const timezone = -new Date().getTimezoneOffset() / 60;
    try {
      const times = calc.computePrayerTimes(loc.lat, loc.lon, when, timezone, methodDef, 1);
      if (!times) return null;
      const valid = PRAYERS.every((p) => Number.isFinite(times[p.id]));
      return valid ? times : null;
    } catch (error) {
      return null;
    }
  }

  function toDate(decimalHour, date) {
    const base = date instanceof Date ? new Date(date) : new Date();
    if (!Number.isFinite(decimalHour)) return null;
    const minutes = Math.round(decimalHour * 60);
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
    next.setMinutes(minutes);
    return next;
  }

  /** الصلاة الحالية والصلاة القادمة، وكل مواقيت اليوم. */
  function prayerState(date) {
    const when = date instanceof Date ? date : new Date();
    const times = prayerTimes(when);
    if (!times) return null;
    const calc = calculations();
    const all = PRAYERS.map((p) => ({
      ...p,
      hour: times[p.id],
      at: toDate(times[p.id], when),
      clock: calc && calc.formatPrayerClock ? calc.formatPrayerClock(times[p.id]) : "—",
    }));
    const upcoming = all.find((p) => p.at && p.at.getTime() > when.getTime());
    let current = null;
    for (const prayer of all) {
      if (prayer.at && prayer.at.getTime() <= when.getTime()) current = prayer;
    }
    return {
      all,
      current,
      next: upcoming ?? null,
      location: getLocation(),
      method: getMethod(),
    };
  }

  /** "2:15:30" أو "05:12" حسب الوقت المتبقّي. */
  function countdown(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "00:00";
    const total = Math.floor(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  }

  /* ==================== الورد اليومي ==================== */

  function planById(id) {
    return PLANS.find((p) => p.id === id) || null;
  }

  function getPlan() {
    const plan = readJson(KEYS.plan, null);
    if (!plan || typeof plan !== "object" || !plan.id) return null;
    const definition = planById(plan.id);
    if (!definition) return null;
    const pages = Number(plan.pagesPerDay);
    if (!Number.isFinite(pages) || pages <= 0) return null;
    return {
      id: String(plan.id),
      label: definition.label,
      pagesPerDay: pages,
      totalPages: Number.isFinite(Number(plan.totalPages)) && Number(plan.totalPages) > 0
        ? Number(plan.totalPages)
        : QURAN_PAGES,
      startKey: /^\d{4}-\d{2}-\d{2}$/.test(String(plan.startKey ?? "")) ? String(plan.startKey) : dateKey(),
      paused: Boolean(plan.paused),
    };
  }

  function getLog() {
    const log = readJson(KEYS.log, {});
    if (!log || typeof log !== "object" || Array.isArray(log)) return {};
    const clean = {};
    for (const [key, value] of Object.entries(log)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      const pages = Number(value);
      if (Number.isFinite(pages) && pages > 0) clean[key] = Math.min(Math.round(pages), QURAN_PAGES);
    }
    return clean;
  }

  function savePlan(plan) {
    return writeJson(KEYS.plan, plan);
  }

  /** يختار خطة ويبدأها اليوم (لا يمسح السجلّ السابق). */
  function startPlan(id, options) {
    const definition = planById(id);
    if (!definition) return null;
    const opts = options && typeof options === "object" ? options : {};
    let pages = definition.pages;
    if (id === "custom") {
      pages = Math.round(Number(opts.pagesPerDay));
      if (!Number.isFinite(pages) || pages <= 0) return null;
    }
    pages = Math.min(Math.max(1, pages), QURAN_PAGES);
    const total = id === "custom" && Number.isFinite(Number(opts.totalPages)) && Number(opts.totalPages) > 0
      ? Math.min(Math.round(Number(opts.totalPages)), QURAN_PAGES)
      : QURAN_PAGES;
    const plan = {
      id,
      pagesPerDay: pages,
      totalPages: total,
      startKey: dateKey(),
      paused: false,
    };
    savePlan(plan);
    return plan;
  }

  function pausePlan() {
    const plan = getPlan();
    if (!plan) return null;
    plan.paused = true;
    savePlan(plan);
    return plan;
  }

  function resumePlan() {
    const plan = getPlan();
    if (!plan) return null;
    plan.paused = false;
    savePlan(plan);
    return plan;
  }

  /** إعادة الضبط: خطة جديدة من اليوم، ويُمسح تقدّمها فقط. */
  function resetPlan(id, options) {
    const log = getLog();
    const plan = getPlan();
    if (plan) {
      const start = fromKey(plan.startKey);
      const from = start && start <= new Date() ? dateKey(start) : dateKey();
      let key = from;
      while (key) {
        delete log[key];
        key = shiftKey(key, 1);
      }
      writeJson(KEYS.log, log);
    }
    const fresh = startPlan(id || (plan && plan.id) || "medium", options);
    writeJson(KEYS.streak, { current: 0, best: 0, lastDay: "" });
    return fresh;
  }

  /** يسجّل عدد الصفحات المقروءة اليوم (تراكمي). */
  function logPages(pages) {
    const amount = Math.round(Number(pages));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const log = getLog();
    const key = dateKey();
    log[key] = Math.min((log[key] || 0) + amount, QURAN_PAGES);
    writeJson(KEYS.log, log);
    syncStreak();
    return log[key];
  }

  function todayPages() {
    return getLog()[dateKey()] || 0;
  }

  /** حالة الورد: هدف اليوم، المنجَز، المتبقّي، النسبة، والمدة المتبقية للخطة. */
  function wirdState() {
    const plan = getPlan();
    if (!plan) {
      return { active: false, plan: null, goal: 0, done: 0, remaining: 0, percent: 0, daysLeft: 0 };
    }
    const done = todayPages();
    const goal = plan.pagesPerDay;
    const log = getLog();
    let total = 0;
    let key = plan.startKey;
    const today = dateKey();
    // نعدّ من يوم بدء الخطة فصاعدًا، ولا نعدّ تواريخ مستقبلية.
    let guard = 0;
    while (key && key <= today && guard < 4000) {
      total += log[key] || 0;
      key = shiftKey(key, 1);
      guard += 1;
    }
    const remaining = Math.max(0, plan.totalPages - total);
    return {
      active: true,
      paused: plan.paused,
      plan,
      goal,
      done: Math.min(done, goal),
      doneRaw: done,
      remainingToday: Math.max(0, goal - done),
      totalDone: total,
      remaining,
      percent: goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0,
      planPercent: plan.totalPages > 0 ? Math.min(100, Math.round((total / plan.totalPages) * 100)) : 0,
      daysLeft: plan.pagesPerDay > 0 ? Math.ceil(remaining / plan.pagesPerDay) : 0,
      complete: done >= goal,
    };
  }

  /* ==================== الأيام المتتالية ==================== */

  /**
   * يعدّ الأيام المتتالية التي أُنجز فيها الورد كاملًا، ويحدّث أطول سلسلة.
   * لا يُحسب اليوم الحالي إلا إذا أُنجز فعلًا، فلا يكذب على صاحبه.
   */
  /**
   * يعدّ الأيام المتتالية التي أُنجز فيها الورد كاملًا، ويحدّث أطول سلسلة.
   *
   * يُحسب من السجلّ مباشرةً بالمشيُ للخلف — لا يُبنى رقمًا متراكمًا — فيبقى
   * النتيجة نفسها مهما أُعيد استدعاؤه، ويُصحّح نفسه لو استورد المستخدم نسخة
   * فيها أيامٌ أقدم أو عدّل سجلّه.
   *
   * ولا يُحسب اليوم الحالي إلا إذا أُنجز فعلًا، فلا يكذب على من لم يقرأ بعد.
   */
  function syncStreak() {
    const record = readJson(KEYS.streak, { best: 0 });
    const best = Number.isFinite(Number(record.best)) ? Number(record.best) : 0;
    const plan = getPlan();
    if (!plan) {
      const cleared = { current: 0, best, lastDay: "" };
      writeJson(KEYS.streak, cleared);
      return cleared;
    }
    const log = getLog();
    const goal = plan.pagesPerDay;
    const today = dateKey();
    const doneToday = (log[today] || 0) >= goal;
    let key = doneToday ? today : shiftKey(today, -1);
    let current = 0;
    let guard = 0;
    while (key && (log[key] || 0) >= goal && guard < 4000) {
      current += 1;
      key = shiftKey(key, -1);
      guard += 1;
    }
    const streak = {
      current,
      best: current > best ? current : best,
      lastDay: current === 0 ? "" : doneToday ? today : shiftKey(today, -1),
    };
    writeJson(KEYS.streak, streak);
    return streak;
  }

  function getStreak() {
    return readJson(KEYS.streak, { current: 0, best: 0, lastDay: "" });
  }

  /** آخر ٧ أيام: هل أُنجز الورد في كل يوم؟ */
  function weekHistory() {
    const plan = getPlan();
    const log = getLog();
    const goal = plan ? plan.pagesPerDay : 0;
    const out = [];
    for (let back = 6; back >= 0; back -= 1) {
      const key = shiftKey(dateKey(), -back);
      out.push({ key, pages: log[key] || 0, done: goal > 0 && (log[key] || 0) >= goal });
    }
    return out;
  }

  /* ==================== المحتوى اليومي ==================== */

  function content() {
    return GLOBAL.DailyContent || { verses: [], hadiths: [], wisdom: [], duas: [] };
  }

  function dailyVerse(date) {
    return pick(content().verses, 1, date);
  }

  function dailyHadith(date) {
    return pick(content().hadiths, 2, date);
  }

  function dailyWisdom(date) {
    return pick(content().wisdom, 3, date);
  }

  function dailyDua(cat, date) {
    const list = (content().duas || []).filter((d) => !cat || d.cat === cat);
    return pick(list.length ? list : content().duas, 4, date);
  }

  /**
   * محتوى شاشة الإتمام — كلّه من المصدر المُتحقَّق منه فقط.
   * الأنواع: آية للتدبر · حديث صحيح · فائدة إيمانية · دعاء.
   * لا يوجد هنا «تفسير مختصر» ولا «قصة»: لا نخترع تفسيرًا ولا ننسب
   * قصةً إلى الدين، فمن أرادهما فليأخذهما من موضعهما (٩ص، ٤٣ص).
   */
  function completionPick(date) {
    const source = content();
    const pool = [
      ...(source.verses || []).map((item) => ({ kind: "آية للتدبر", emoji: "🌿", ...item })),
      ...(source.hadiths || []).map((item) => ({ kind: "حديث صحيح", emoji: "📜", ...item })),
      ...(source.wisdom || []).map((item) => ({ kind: "فائدة", emoji: "💡", ...item })),
      ...(source.duas || []).map((item) => ({ kind: "دعاء", emoji: "🤲", ...item })),
    ];
    if (!pool.length) return null;
    const chosen = pick(pool, 5, date);
    if (!chosen) return null;
    return {
      kind: chosen.kind,
      emoji: chosen.emoji,
      text: chosen.text,
      ref: chosen.ref,
      title: chosen.title || "",
    };
  }

  /* ==================== المحفوظات ==================== */

  function getSaved() {
    const saved = readJson(KEYS.saved, {});
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  }

  function isSaved(id) {
    return Boolean(getSaved()[String(id)]);
  }

  function toggleSaved(item) {
    if (!item || !item.text) return false;
    const saved = getSaved();
    const id = String(item.ref || item.text).slice(0, 120);
    if (saved[id]) {
      delete saved[id];
      writeJson(KEYS.saved, saved);
      return false;
    }
    saved[id] = { text: String(item.text).slice(0, 600), ref: String(item.ref ?? ""), at: new Date().toISOString() };
    writeJson(KEYS.saved, saved);
    return true;
  }

  /* ==================== المشاركة ==================== */

  const SITE_NAME = "المكتبة الإسلامية";

  /** مسار الصفحة الحالية، بلا استعلام ولا مُجزّئ. */
  function currentPath() {
    if (GLOBAL.location && GLOBAL.location.pathname) return GLOBAL.location.pathname;
    return "/";
  }

  function absoluteUrl(pathname) {
    const origin = GLOBAL.location && GLOBAL.location.origin;
    const base = origin && origin !== "null" ? origin : "";
    return base + String(pathname ?? "");
  }

  /** نصّ المشاركة: النصّ ثمّ مصدره ثمّ اسم الموقع ثمّ الرابط. */
  function shareText(item, url) {
    if (!item || !item.text) return "";
    const link = absoluteUrl(url || currentPath());
    const head = item.emoji ? item.emoji + " " : "";
    const parts = [head + item.text];
    if (item.ref) parts.push("المصدر: " + item.ref);
    if (item.title) parts.push(item.title);
    parts.push(SITE_NAME);
    parts.push(link);
    return parts.join("\n");
  }

  function shareTargets(text) {
    const link = absoluteUrl(currentPath());
    return {
      whatsapp: "https://wa.me/?text=" + encodeURIComponent(text),
      telegram: "https://t.me/share/url?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent(text),
      facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(link),
      x: "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text),
    };
  }

  /** مشاركة أصلية على الجوال، وإلا نسخ النصّ — لا نافذة جديدة إجبارية. */
  async function share(item, url) {
    const text = shareText(item, url);
    if (!text) return { ok: false, reason: "empty" };
    try {
      if (navigator.share) {
        await navigator.share({ title: SITE_NAME, text });
        return { ok: true, via: "native" };
      }
    } catch (error) {
      if (error && error.name === "AbortError") return { ok: false, reason: "cancelled" };
    }
    return { ok: true, via: "copy", text };
  }

  async function copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      /* المتصفح رفض الحافظة — نجرّب الطريقة القديمة. */
    }
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch (error) {
      return false;
    }
  }

  /* ==================== التذكيرات ==================== */

  const DEFAULT_REMINDERS = {
    enabled: false,
    prayer: false,
    wird: { on: false, time: "07:00" },
    morning: { on: false, time: "06:00" },
    evening: { on: false, time: "18:00" },
    daily: { on: false, time: "21:00" },
  };

  function getReminders() {
    const saved = readJson(KEYS.reminders, {});
    const base = JSON.parse(JSON.stringify(DEFAULT_REMINDERS));
    if (!saved || typeof saved !== "object") return base;
    base.enabled = Boolean(saved.enabled);
    base.prayer = Boolean(saved.prayer);
    for (const name of ["wird", "morning", "evening", "daily"]) {
      const item = saved[name];
      if (item && typeof item === "object") {
        base[name].on = Boolean(item.on);
        if (/^\d{2}:\d{2}$/.test(String(item.time ?? ""))) base[name].time = String(item.time);
      }
    }
    return base;
  }

  function setReminders(patch) {
    const next = getReminders();
    if (patch && typeof patch === "object") {
      for (const key of Object.keys(next)) {
        if (patch[key] === undefined) continue;
        if (key === "enabled" || key === "prayer") next[key] = Boolean(patch[key]);
        else if (next[key] && typeof next[key] === "object") {
          next[key].on = Boolean(patch[key].on);
          if (/^\d{2}:\d{2}$/.test(String(patch[key].time ?? ""))) next[key].time = String(patch[key].time);
        }
      }
    }
    writeJson(KEYS.reminders, next);
    return next;
  }

  function supportedNotifications() {
    try {
      return typeof Notification !== "undefined";
    } catch (error) {
      return false;
    }
  }

  function notificationPermission() {
    if (!supportedNotifications()) return "unsupported";
    try {
      return Notification.permission;
    } catch (error) {
      return "unsupported";
    }
  }

  function showNotification(title, options) {
    if (notificationPermission() !== "granted") return false;
    try {
      new Notification(title, options || {});
      return true;
    } catch (error) {
      return false;
    }
  }

  return {
    QURAN_PAGES,
    KEYS,
    PRAYERS,
    METHODS,
    PLANS,
    DEFAULT_LOCATION,
    DEFAULT_REMINDERS,
    SITE_NAME,
    // تواريخ
    dateKey,
    fromKey,
    shiftKey,
    daySeed,
    pick,
    toArabicDigits,
    // مواقيت
    prayerTimes,
    prayerState,
    countdown,
    getLocation,
    setLocation,
    getMethod,
    setMethod,
    // ورد
    planById,
    getPlan,
    startPlan,
    pausePlan,
    resumePlan,
    resetPlan,
    logPages,
    getLog,
    todayPages,
    wirdState,
    // استمرارية
    syncStreak,
    getStreak,
    weekHistory,
    // محتوى
    content,
    dailyVerse,
    dailyHadith,
    dailyWisdom,
    dailyDua,
    completionPick,
    toggleSaved,
    isSaved,
    getSaved,
    // مشاركة
    shareText,
    shareTargets,
    share,
    copy,
    // تذكيرات
    getReminders,
    setReminders,
    supportedNotifications,
    notificationPermission,
    showNotification,
  };
});