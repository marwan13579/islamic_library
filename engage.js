/**
 * 🎯 طبقة التفاعل — Engagement Layer
 * =============================================================================
 * طبقة واحدة فوق كل أدوات المكتبة، تجيب عن سؤال واحد: «لماذا أفتح الموقع
 * مرّة أخرى غدًا؟» — بلا حسابات ولا تسجيل ولا مقارنات ولا رتب.
 *
 * المشكلة التي تحلّها:
 *   المكتبة فيها ٤٤ أداة، لكل أداة عدّادها ومخطّطها وتاريخها. ولا رابط
 *   بينها. فكان المستخدم يبدأ وردًا في أداة، وينسى، ثم يعود بعد أسبوع
 *   لا يعرف أين وقف. المتابعات كانت ٥ عدّادات متناسبة لا يعرف أحدها
 *   صاحبَها. والصفحات الستّ (الصلاة، المناسبات، السيرة، الحج، أوقات
 *   الإجابة، آداب الزيارة) بلا أي تفاعل أصلًا: نصٌّ يُقرأ ولا يُترك أثر.
 *
 * ما تضيفه:
 *   1) حصاد واحد يجمع تقدّم كل الأدوات من مفاتيحها القائمة، فلا يُكتب
 *      مفتاح موازٍ لكل أداة ولا تُعدَّل الأدوات البتّة.
 *   2) أيام متتالية واحدة ورصيد نقاط واحد يشمل المكتبة كلها.
 *   3) أوسمة تُفتح تلقائيًا من العمل الحقيقي، لا من زرّ يُضغط.
 *   4) تحدٍّ يومي واحد يتغيّر كل يوم ويقود إلى أداة بعينها.
 *   5) احتفال عند الإنجاز: قصاصات ونغمة قصيرة — اختيارية، تُكتم، وتُحذف
 *      كلها إن حُذف هذا الملف.
 *   6) للصفحات الستّ: بحث داخل الصفحة، وتعليم ما قُرئ، وعدّاد للتقدّم.
 *
 * مبادئ هندسية (الغرض ألّا يُكلَّف الموقع شيئًا):
 *   - سكربت عادي بلا وحدات ES، ليعمل في كل الصفحات ومن القرص مباشرة.
 *   - لا استيراد ولا حزم ولا بناء ولا خادم، ولا صورة ولا خطّ.
 *   - صامت تمامًا إن لم يعمل: كل الواجهة داخل `try`، وأي خطأ يوقف
 *     هذه الطبقة وحدها ولا يمسّ الصفحة. المكتبة تعمل بلاها كاملة.
 *   - كل قراءة من `localStorage` محروسة، فيصمد في التصفّح الخاص.
 *   - يستعمل متغيّرات التصميم القائمة (`--paper`, `--ink`, `--gold`, …)
 *     فلا يكسر الوضع الليلي ولا RTL ولا الوضع الهادئ.
 *   - لا يُنسب شيء هنا إلى النبي ﷺ، ولا نصّ دينيّ جديد: الأوسمة
 *     والتحديات أوصافٌ تحريرية لِما يفعله المستخدم.
 *
 * الإزالة الكاملة: احذف `engage.js` و`engage.css`، وانزع سطرهما من
 * الصفحات، واحذف `"./engage.js"` و`"./engage.css"` من `sw.js`،
 * وامسح `engage-v1` من `backup-core.js`. لا شيء آخر يعتمد عليه.
 *
 * الواجهة العامة (يستدعيها الموقع القائم):
 *   Engagement.record("adhkar", 1)     — تسجيل عمل
 *   Engagement.state()                 — الحالة الحالية
 *   Engagement.mount(el)               — بطاقة تحدّي اليوم (الصفحة الرئيسية)
 *   Engagement.enhanceReadPage({...})  — بحث + تعليم القراءة لصفحة نصّية
 *   Engagement.refresh()               — إعادة الحصاد وتحديث الواجهة
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.Engagement = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var GLOBAL = typeof globalThis !== "undefined" ? globalThis : this;

  /* ============================================================ 0) الثوابت */

  var KEY = "engage-v1";
  var VERSION = 1;
  /** كم يومًا من سجلّ الأيام نحتفظ به. أطول من أي رحلة متوقَّعة. */
  var DAYS_KEEP = 400;
  /** كم عنصرًا مقروءًا نحتفظ به لكل صفحة. */
  var READ_KEEP = 400;
  /** كم act счита «يومًا نشيطًا» فاستحقّ المتتالية. */
  var ACTS_FOR_ACTIVE_DAY = 1;
  /** هدف الحلقة في الشارة العائمة: خمسة أعمال في اليوم. */
  var DAILY_TARGET = 5;

  var AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  var arNum = function (value) {
    return String(value).replace(/\d/g, function (d) { return AR_DIGITS[Number(d)]; });
  };

  /** نقاط كل وحدة في كل نوع عمل. مصرحٌ بها في `harvest` و`record` معًا. */
  var POINTS = {
    adhkar: 1,      /* ذكرٌ واحد */
    azkar: 1,       /* ذكرٌ في الأذكار الشاملة */
    tasbih: 0.1,    /* عشر تسبيحات = نقطة */
    wird: 2,        /* صفحة وِرد */
    companion: 2,   /* صفحة في الرفيق اليومي */
    surah: 10,      /* سورة محفوظة */
    quiz: 5,        /* محاولة اختبار */
    tadabbur: 3,    /* تدبّر مكتوب */
    qada: 5,        /* يوم قضاء */
    khatma: 8,      /* جزء في ختمة */
    system: 2,      /* خطوة في نظام اليوم */
    salah: 3,       /* صلاة مرصودة */
    study: 2,       /* عنصر درسٍ قُرئ */
    tool: 1,        /* فتح أداة */
  };

  /** أسماء عربية لأنواع العمل، تستعمل في سجلّ اليوم واللوحة. */
  var ACT_LABEL = {
    adhkar: "ذكر", azkar: "ذكر شامل", tasbih: "تسبيح", wird: "قراءة",
    companion: "قراءة يومية", surah: "حفظ", quiz: "اختبار", tadabbur: "تدبّر",
    qada: "قضاء", khatma: "ختمة", system: "نظام اليوم", salah: "صلاة",
    study: "قراءة درس", tool: "أداة",
  };

  /* المسار إلى جذر الموقع، نسبةً لملف هذا السكربت لا للصفحة الحالية، ل��نه
   * محمَّل من الجذر ومن `islamic-videos/` بعمقين مختلفين. */
  var BASE = (function () {
    if (typeof document !== "undefined" && document.currentScript && document.currentScript.src) {
      return String(document.currentScript.src).replace(/[^/]*$/, "");
    }
    if (typeof location === "undefined") return "";
    return String(location.pathname).replace(/[^/]+$/, "");
  })();

  /* ================================================= 1) الحالة والتخزين */

  function blank() {
    return {
      v: VERSION,
      points: 0,     /* رصيد النقاط التراكمي */
      days: {},      /* "YYYY-MM-DD": { p: نقاط, a: أعمال, k: {نوع: عدد} } */
      badges: [],    /* معرّفات الأوسمة المفتوحة */
      read: {},      /* "صفحة.html": [معرّفات العناصر المقروءة] */
      challenges: {},/* "YYYY-MM-DD": معرّف التحدّي المنجَز فيه */
      seen: 0,       /* كم مرّة فُتح الموقع */
      muted: false,  /* كتم النغمة */
      seeded: {},    /* آخر قيمة حُصدت لكل مؤشّر، فلا يُنقاط التقدّم مرّتين */
    };
  }

  /** يقرأ الحالة ويعيدها سليمة الشكل مهما كان ما في التخزين. */
  function normalize(raw) {
    var base = blank();
    if (!raw || typeof raw !== "object") return base;
    var out = base;
    if (typeof raw.points === "number" && isFinite(raw.points)) out.points = Math.max(0, Math.round(raw.points));
    if (raw.days && typeof raw.days === "object") {
      Object.keys(raw.days).slice(0, DAYS_KEEP).forEach(function (key) {
        var day = raw.days[key];
        if (!day || typeof day !== "object") return;
        out.days[key] = {
          p: Math.max(0, Number(day.p) || 0),
          a: Math.max(0, Number(day.a) || 0),
          k: day.k && typeof day.k === "object" ? day.k : {},
        };
      });
    }
    if (Array.isArray(raw.badges)) out.badges = raw.badges.filter(function (id) { return typeof id === "string"; });
    if (raw.read && typeof raw.read === "object") {
      Object.keys(raw.read).forEach(function (key) {
        if (Array.isArray(raw.read[key])) out.read[key] = raw.read[key].slice(-READ_KEEP);
      });
    }
    if (raw.challenges && typeof raw.challenges === "object") {
      Object.keys(raw.challenges).forEach(function (key) { out.challenges[key] = String(raw.challenges[key]); });
    }
    out.seen = Math.max(0, Number(raw.seen) || 0);
    out.muted = !!raw.muted;
    if (raw.seeded && typeof raw.seeded === "object") out.seeded = raw.seeded;
    return out;
  }

  var memory = null;

  function store() {
    try {
      if (typeof localStorage !== "undefined" && localStorage) return localStorage;
    } catch (e) { /* محظور */ }
    if (!memory) {
      /* بديل في الذاكرة:Behavior cam نفس `storage-fallback.js`. */
      var map = {};
      memory = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; },
        setItem: function (k, v) { map[k] = String(v); },
        removeItem: function (k) { delete map[k]; },
      };
    }
    return memory;
  }

  var state = null;

  function load() {
    if (state) return state;
    var raw = null;
    try { raw = JSON.parse(store().getItem(KEY) || "null"); } catch (e) { raw = null; }
    state = normalize(raw);
    return state;
  }

  function save() {
    try { store().setItem(KEY, JSON.stringify(load())); } catch (e) { /* محظور */ }
  }

  /** يصفّر كل تقدّم هذه الطبقة. المفتاح وحده، فالأدوات لا تتأثر. */
  function reset() {
    state = blank();
    save();
    render();
  }

  /* ====================================================== 2) التاريخ */

  /** مفتاح اليوم بالتوقيت المحلي. `toISOString` يعطي UTC فينحرف اليوم. */
  function dayKey(date) {
    var d = date || new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = "0" + m;
    if (day.length < 2) day = "0" + day;
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function shiftKey(key, delta) {
    var parts = String(key).split("-");
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + delta);
    return dayKey(d);
  }

  var today = function () { return dayKey(new Date()); };

  /** الأيام المتتالية النشطة، تنتهي اليوم أو أمس. */
  function streakOf(days) {
    var key = today();
    /* اليوم الذي لم يبدأ بعد لا يكسر المتتالية، فنبدأ من أمس. */
    if (!days[key] || days[key].a < ACTS_FOR_ACTIVE_DAY) key = shiftKey(key, -1);
    var count = 0;
    while (days[key] && days[key].a >= ACTS_FOR_ACTIVE_DAY) {
      count++;
      key = shiftKey(key, -1);
      if (count > DAYS_KEEP) break;
    }
    return count;
  }

  function activeToday(days) {
    var day = days[today()];
    return !!(day && day.a >= ACTS_FOR_ACTIVE_DAY);
  }

  function pruneDays(days) {
    var keys = Object.keys(days).sort();
    while (keys.length > DAYS_KEEP) delete days[keys.shift()];
  }

  /* ============================================== 3) حصاد مؤشرات الأدوات */

  function readJson(key, fallback) {
    try {
      var raw = JSON.parse(store().getItem(key) || "null");
      return raw === null ? fallback : raw;
    } catch (e) { return fallback; }
  }

  function readNum(key) {
    var n = Number(store().getItem(key));
    return isFinite(n) && n > 0 ? n : 0;
  }

  /** عدد القيم الصادقة في كائن (خريطة سورة محفوظة، خريطة خطوة…) أو مصفوفة. */
  function countTruthy(value) {
    if (!value || typeof value !== "object") return 0;
    var keys = Object.keys(value);
    var n = 0;
    for (var i = 0; i < keys.length; i++) {
      if (value[keys[i]]) n++;
    }
    return n;
  }

  /** مجموع قيم أرقام في كائن (سجلّ وِرد: يوم ← صفحات). */
  function sumValues(value) {
    if (!value || typeof value !== "object") return 0;
    var keys = Object.keys(value);
    var n = 0;
    for (var i = 0; i < keys.length; i++) {
      var v = Number(value[keys[i]]);
      if (isFinite(v) && v > 0) n += v;
    }
    return n;
  }

  function arrayLength(value) {
    return Array.isArray(value) ? value.length : 0;
  }

  /**
   * مؤشّرات كل الأدوات، مقروءةً من مفاتيحها القائمة.
   * `daily: true` يعني أن المصدر نفسه يُصفَّر كل يوم، فيُحصد كاملًا
   * عند تغيّر اليوم لا فروقًا.
   */
  var METRICS = [
    { act: "adhkar", daily: true, extract: function () {
      var p = readJson("nour-progress", null);
      if (!p || typeof p !== "object") return { v: 0, d: "" };
      return { v: sumValues(p.data), d: String(p.day || "") };
    } },
    { act: "azkar", daily: false, extract: function () {
      return { v: sumValues(readJson("azkar-shamila-progress", {})), d: "" };
    } },
    { act: "tasbih", daily: true, extract: function () {
      var p = readJson("gtasbeeh-daily", null);
      if (!p || typeof p !== "object") return { v: 0, d: "" };
      return { v: Math.max(0, Number(p.total) || 0), d: String(p.day || "") };
    } },
    { act: "wird", daily: false, extract: function () {
      return { v: sumValues(readJson("wird-log", {})), d: "" };
    } },
    { act: "companion", daily: false, extract: function () {
      return { v: sumValues(readJson("dc-log", {})), d: "" };
    } },
    { act: "surah", daily: false, extract: function () {
      return { v: countTruthy(readJson("mushaf-progress", {})), d: "" };
    } },
    { act: "quiz", daily: false, extract: function () {
      return { v: arrayLength(readJson("lib-quiz-history", [])), d: "" };
    } },
    { act: "tadabbur", daily: false, extract: function () {
      return { v: arrayLength(readJson("tadabbur-entries", [])), d: "" };
    } },
    { act: "qada", daily: false, extract: function () { return { v: readNum("qada-done"), d: "" }; } },
    { act: "khatma", daily: false, extract: function () {
      return { v: countTruthy(readJson("khatma_state", [])), d: "" };
    } },
    { act: "system", daily: false, extract: function () {
      return { v: countTruthy(readJson("daily-system-state", {})), d: "" };
    } },
    { act: "salah", daily: false, extract: function () {
      return { v: countTruthy(readJson("prayer_tracker", {})), d: "" };
    } },
  ];

  /**
   * حصاد المؤشّرات وتحويل الفارق إلى نقاط.
   *
   * الفارق لا القيمة: إن كانت الأداة عند ٢٠٠ ذكر حُصدت، ثم بلغت ٢٣٠،
   * فالفارق ٣٠ لا ٢٣٠. ولو أعادت الأداة ضبط نفسها صفرًا فلا تُناقص
   * النقاط، بل تنتظر قيمتها التالية من جديد. ولهذا `seeded`.
   */
  function harvest() {
    var s = load();
    var earned = 0;
    var byAct = {};
    METRICS.forEach(function (metric) {
      var got;
      try { got = metric.extract() || { v: 0, d: "" }; } catch (e) { got = { v: 0, d: "" }; }
      var value = Math.max(0, Number(got.v) || 0);
      var prev = s.seeded[metric.act];
      var wasV = prev && typeof prev === "object" ? Number(prev.v) || 0 : 0;
      var wasD = prev && typeof prev === "object" ? String(prev.d || "") : "";
      /* مصدر يومي: تغيّر يومه يعني أن العدّاد بدأ من جديد، فالفارق كله. */
      var delta = metric.daily && got.d && got.d !== wasD ? value : value - wasV;
      if (!metric.daily || got.d) {
        s.seeded[metric.act] = { v: Math.max(wasV, value), d: String(got.d || wasD || "") };
      }
      if (delta <= 0) return;
      /* يمنع تكدّس مؤشّرٍ واحد في يوم واحد: نُنسب إلى يوم القراءة لا
       * يوم الحصاد، فما يعتمد على الفارق إلا ما جرى اليوم. */
      byAct[metric.act] = Math.min(delta, 100000);
      earned += delta * POINTS[metric.act];
    });
    var added = Math.round(earned);
    if (added > 0) {
      s.points += added;
      credit(added, byAct);
    }
    return { added: added, byAct: byAct };
  }

  /** يضيف عملًا إلى سجلّ اليوم. */
  function credit(points, byAct) {
    var s = load();
    var key = today();
    var day = s.days[key] || { p: 0, a: 0, k: {} };
    var acts = {};
    Object.keys(byAct || {}).forEach(function (act) {
      var amount = Math.max(0, Number(byAct[act]) || 0);
      if (!amount) return;
      day.k[act] = Math.max(0, (Number(day.k[act]) || 0) + amount);
      acts[act] = amount;
    });
    day.p += Math.max(0, Math.round(points) || 0);
    day.a += Object.keys(acts).length;
    s.days[key] = day;
    pruneDays(s.days);
  }

  /** لقطة واحدة تجمع كل ما تحتاجه الأوسمة والواجهة. */
  function snapshot() {
    var s = load();
    var totals = {};
    METRICS.forEach(function (metric) {
      var prev = s.seeded[metric.act];
      totals[metric.act] = prev && typeof prev === "object" ? Number(prev.v) || 0 : 0;
    });
    var day = s.days[today()] || { p: 0, a: 0, k: {} };
    var reads = 0;
    Object.keys(s.read || {}).forEach(function (page) { reads += (s.read[page] || []).length; });
    return {
      points: s.points,
      days: s.days,
      day: day,
      kinds: day.k || {},
      totals: totals,
      reads: reads,
      streak: streakOf(s.days),
      todayActive: activeToday(s.days),
      badges: s.badges,
      muted: s.muted,
      seen: s.seen,
      progress: Math.max(0, Math.min(1, day.a / DAILY_TARGET)),
    };
  }

  /* ================================================== 4) تسجيل العمل */

  /**
   * يسجّل عملًا. الواجهة الوحيدة التي تستدعيها الأدوات.
   * @param {string} act نوع العمل من `POINTS`
   * @param {number} [amount] مقداره
   * @param {object} [options] { silent: لا تحتفل بالوسام الآن }
   */
  function record(act, amount, options) {
    var opts = options || {};
    var n = Math.max(1, Math.round(Number(amount) || 1));
    if (!POINTS[act]) act = "tool";
    credit(n * POINTS[act], (function () { var o = {}; o[act] = n; return o; })());
    var opened = unlockBadges();
    save();
    render();
    checkChallenge(true);
    if (opened.length && !opts.silent) celebrate(opened);
    return opened;
  }

  /* ======================================================= 5) الأوسمة */

  var BADGES = [
    { id: "first", emoji: "🌱", tier: "bronze", name: "الخطوة الأولى",
      desc: "أول عمل في المكتبة", test: function (s) { return s.day.a >= 1; } },
    { id: "explorer", emoji: "🧭", tier: "bronze", name: "مستكشِف",
      desc: "خمسة أعمال في يوم واحد", test: function (s) { return s.day.a >= 5; } },
    { id: "adhkar-50", emoji: "📿", tier: "bronze", name: "خمسون ذكرًا",
      desc: "خمسون ذكرًا في أذكار الموقع", test: function (s) { return s.totals.adhkar >= 50; } },
    { id: "adhkar-500", emoji: "🕌", tier: "gold", name: "أمة تذكر",
      desc: "خمسمائة ذكر", test: function (s) { return s.totals.adhkar >= 500; } },
    { id: "tasbih-100", emoji: "✨", tier: "bronze", name: "مئة تسبيحة",
      desc: "مئة تسبيحة في المجموع", test: function (s) { return s.totals.tasbih >= 100; } },
    { id: "wird-3", emoji: "📖", tier: "bronze", name: "ثلاثة أيام",
      desc: "ثلاثة أيام متتالية فيها عمل", test: function (s) { return s.streak >= 3; } },
    { id: "wird-7", emoji: "🗓️", tier: "silver", name: "أسبوع كامل",
      desc: "سبعة أيام متتالية", test: function (s) { return s.streak >= 7; } },
    { id: "wird-30", emoji: "🏅", tier: "gold", name: "شهر كامل",
      desc: "ثلاثون يومًا متتالية", test: function (s) { return s.streak >= 30; } },
    { id: "surah-1", emoji: "📗", tier: "bronze", name: "أول سورة",
      desc: "سورة واحدة محفوظة", test: function (s) { return s.totals.surah >= 1; } },
    { id: "surah-10", emoji: "📚", tier: "silver", name: "عشر سور",
      desc: "عشر سور محفوظة", test: function (s) { return s.totals.surah >= 10; } },
    { id: "surah-30", emoji: "🗄️", tier: "gold", name: "ثلاثون سورة",
      desc: "ثلاثون سورة محفوظة", test: function (s) { return s.totals.surah >= 30; } },
    { id: "khatma-1", emoji: "🤝", tier: "bronze", name: "يد في الختمة",
      desc: "جزء واحد في ختمة جماعية", test: function (s) { return s.totals.khatma >= 1; } },
    { id: "khatma-10", emoji: "🕋", tier: "gold", name: "عشرة أجزاء",
      desc: "عشرة أجزاء في ختمة", test: function (s) { return s.totals.khatma >= 10; } },
    { id: "quiz-1", emoji: "🧠", tier: "bronze", name: "أول اختبار",
      desc: "محاولة اختبار واحدة", test: function (s) { return s.totals.quiz >= 1; } },
    { id: "quiz-10", emoji: "🎓", tier: "silver", name: "متعلّم دؤوب",
      desc: "عشر محاولات اختبار", test: function (s) { return s.totals.quiz >= 10; } },
    { id: "tadabbur-1", emoji: "💭", tier: "bronze", name: "أول تدبّر",
      desc: "أول تدبّر مكتوب", test: function (s) { return s.totals.tadabbur >= 1; } },
    { id: "tadabbur-10", emoji: "🌊", tier: "silver", name: "إنسان يتدبّر",
      desc: "عشرة تدبّرات مكتوبة", test: function (s) { return s.totals.tadabbur >= 10; } },
    { id: "qada-1", emoji: "🌗", tier: "silver", name: "صيام القضاء",
      desc: "أول يوم قضاء مرصود", test: function (s) { return s.totals.qada >= 1; } },
    { id: "system-day", emoji: "🗂️", tier: "bronze", name: "يوم مرتّب",
      desc: "خمس خطوات في نظام اليوم", test: function (s) { return s.totals.system >= 5; } },
    { id: "reader-10", emoji: "📜", tier: "bronze", name: "قارئ",
      desc: "عشرة عناصر دروس قراءتها", test: function (s) { return s.reads >= 10; } },
    { id: "reader-50", emoji: "🦅", tier: "gold", name: "قارئٌ نهم",
      desc: "خمسون عنصر دروس", test: function (s) { return s.reads >= 50; } },
    { id: "points-100", emoji: "⭐", tier: "silver", name: "مئة نقطة",
      desc: "مئة نقطة تراكمية", test: function (s) { return s.points >= 100; } },
    { id: "points-1000", emoji: "💎", tier: "gold", name: "ألف نقطة",
      desc: "ألف نقطة تراكمية", test: function (s) { return s.points >= 1000; } },
    { id: "both-ways", emoji: "🔄", tier: "silver", name: "الورد والرفيق",
      desc: "قراءة في أداتَي وِرد مختلفتين", test: function (s) {
        return s.totals.wird >= 1 && s.totals.companion >= 1;
      } },
  ];

  /** يفحص الأوسمة ويعيد ما فُتح جديدًا. */
  function unlockBadges() {
    var s = load();
    var snap = snapshot();
    var have = {};
    s.badges.forEach(function (id) { have[id] = true; });
    var opened = [];
    BADGES.forEach(function (badge) {
      if (have[badge.id]) return;
      var ok = false;
      try { ok = !!badge.test(snap); } catch (e) { ok = false; }
      if (!ok) return;
      have[badge.id] = true;
      s.badges.push(badge.id);
      opened.push(badge);
    });
    return opened;
  }

  var badgeById = function (id) {
    for (var i = 0; i < BADGES.length; i++) if (BADGES[i].id === id) return BADGES[i];
    return null;
  };

  /* ==================================================== 6) تحدّي اليوم */

  /**
   * تحدّيات يومية: كلٌّ منها عملٌّ صغيرٌّ قابلٌ للقضاء اليوم، يقود إلى
   * الأداة التي تُنجَز فيه. الاختيار حتميٌّ في تاريخ اليوم، فيرى الجميع
   * التحدّي نفسه في اليوم نفسه، ويختلف بين الأيام.
   */
  var CHALLENGES = [
    { id: "tasbih33", act: "tasbih", goal: 33, title: "سبّح ٣٣ مرةً",
      hint: "في التسبيح الجماعي", url: "15-tasbeeh-jamai.html" },
    { id: "tasbih100", act: "tasbih", goal: 100, title: "مئة تسبيحة",
      hint: "التسبيح الجماعي", url: "15-tasbeeh-jamai.html" },
    { id: "adhkar-33", act: "adhkar", goal: 33, title: "أتممت أذكار اليوم",
      hint: "في نور الذكر", url: "1-adhkar.html" },
    { id: "azkar-cat", act: "azkar", goal: 20, title: "أتممت قسمًا من الأذكار الشاملة",
      hint: "قسم واحد كاملًا", url: "25-azkar-shamila.html" },
    { id: "wird-2", act: "wird", goal: 2, title: "صفحتان من وِردك",
      hint: "ورد القراءة اليومي", url: "17-wird.html" },
    { id: "wird-5", act: "wird", goal: 5, title: "خمس صفحات اليوم",
      hint: "ورد القراءة اليومي", url: "17-wird.html" },
    { id: "companion-2", act: "companion", goal: 2, title: "صفحتان في الرفيق اليومي",
      hint: "من لوحة اليوم في الصفحة الرئيسية", url: "index.html#dcRoot" },
    { id: "surah-1", act: "surah", goal: 1, title: "سورة كاملة في الحفظ",
      hint: "سجّلها في مُصحَفي", url: "2-mushaf.html" },
    { id: "quiz-1", act: "quiz", goal: 1, title: "اختبار واحد",
      hint: "من اختبارات نور الهدى", url: "src/site/noor.html#quiz" },
    { id: "tadabbur-1", act: "tadabbur", goal: 1, title: "تدبّر واحد مكتوب",
      hint: "دفتر التدبّر", url: "16-tadabbur.html" },
    { id: "tadabbur-2", act: "tadabbur", goal: 2, title: "تدبّران مكتوبان",
      hint: "دفتر التدبّر", url: "16-tadabbur.html" },
    { id: "system-5", act: "system", goal: 5, title: "خمس خطوات في نظام اليوم",
      hint: "يومك مرتبط بالصلاة", url: "26-daily-system.html" },
    { id: "salah-3", act: "salah", goal: 3, title: "ثلاث صلوات مرصودة",
      hint: "من متابع الصلاة", url: "42-athan.html" },
    { id: "study-3", act: "study", goal: 3, title: "ثلاثة عناصر من درس",
      hint: "أي صفحة دروس، وعلّم ما قرأته", url: "24-ibadat.html" },
    { id: "study-5", act: "study", goal: 5, title: "خمسة عناصر من درس",
      hint: "وعلّم ما قرأته لتحصل على النقاط", url: "24-ibadat.html" },
    { id: "qada-1", act: "qada", goal: 1, title: "صوم يوم قضاء",
      hint: "سجّله في متابعة القضاء", url: "18-qada.html" },
    { id: "khatma-1", act: "khatma", goal: 1, title: "جزء في ختمة جماعية",
      hint: "وزّع الأجزاء وتابعها", url: "34-khatma.html" },
    { id: "tool-2", act: "tool", goal: 2, title: "جرّب أداتين جديدتين",
      hint: "من فهرس المكتبة", url: "index.html#sections" },
    { id: "study-1", act: "study", goal: 1, title: "اقرأ عنصرًا واحدًا وعلّمه",
      hint: "من أي صفحة دروس", url: "index.html#sections" },
    { id: "adhkar-100", act: "adhkar", goal: 100, title: "مئة ذكر",
      hint: "نور الذكر أو الأذكار الشاملة", url: "1-adhkar.html" },
    { id: "tasbih-66", act: "tasbih", goal: 66, title: "ستٌّ وستون تسبيحة",
      hint: "بعد كل صلاة", url: "15-tasbeeh-jamai.html" },
    { id: "wird-10", act: "wird", goal: 10, title: "عشر صفحات اليوم",
      hint: "ورد القراءة اليومي", url: "17-wird.html" },
    { id: "study-2", act: "study", goal: 2, title: "عنصران من درس",
      hint: "أي صفحة دروس، وعلّم ما قرأته", url: "11-hajj-umrah.html" },
    { id: "companion-4", act: "companion", goal: 4, title: "أربع صفحات في الرفيق",
      hint: "من لوحة اليوم", url: "index.html#dcRoot" },
  ];

  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /** تحدّي يوم معيّن: الحتميّة تأتي من تجزئة التاريخ لا من عشوائية. */
  function challengeFor(key) {
    var day = key || today();
    var pool = CHALLENGES.filter(function (c) { return POINTS[c.act] !== undefined; });
    return pool[hash(day) % pool.length];
  }

  /** هل أُنجِز تحدّي اليوم؟ */
  function challengeDone(key, snap) {
    var s = load();
    var day = key || today();
    var challenge = challengeFor(day);
    var done = s.challenges[day] === challenge.id;
    if (done) return true;
    var shot = snap || snapshot();
    var have = Number(shot.kinds[challenge.act]) || 0;
    return have >= challenge.goal;
  }

  /**
   * يتحقّق من تحدّي اليوم بعد كل عمل، ويحتفل إن أُنجِز جديدًا.
   * @returns {object|null} التحدّي إن أُنجِز الآن
   */
  function checkChallenge(withCelebration) {
    var s = load();
    var day = today();
    if (s.challenges[day]) return null;
    if (!challengeDone(day)) return null;
    var challenge = challengeFor(day);
    s.challenges[day] = challenge.id;
    save();
    render();
    if (withCelebration) celebrate([{ id: "challenge", emoji: "🎯", tier: "gold", name: "تحدّي اليوم", desc: challenge.title }]);
    return challenge;
  }

  /* ===================================================== 7) الاحتفال */

  function reducedMotion() {
    try {
      return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { return false; }
  }

  function hasDom() {
    return typeof document !== "undefined" && !!document.body;
  }

  /** قصاصات على `<canvas>`: بلا صورة ولا حزمة، وتُنظَّف بنفسها. */
  function confetti() {
    if (!hasDom() || reducedMotion()) return;
    var canvas = document.createElement("canvas");
    canvas.className = "eg-confetti";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) { canvas.remove(); return; }
    var ratio = Math.min(2, global.devicePixelRatio || 1);
    var w = canvas.clientWidth || global.innerWidth || 320;
    var h = canvas.clientHeight || global.innerHeight || 480;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.scale(ratio, ratio);
    var colors = ["#9C7420", "#C9A24B", "#2F6B4F", "#3D5B53", "#EFE3C9"];
    var bits = [];
    for (var i = 0; i < 70; i++) {
      bits.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.6,
        y: h * 0.42 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 5.5,
        vy: -4 - Math.random() * 5,
        size: 4 + Math.random() * 5,
        spin: (Math.random() - 0.5) * 0.34,
        angle: Math.random() * Math.PI * 2,
        color: colors[i % colors.length],
      });
    }
    var frame = 0;
    var limit = reducedMotion() ? 1 : 130;
    function step() {
      frame++;
      ctx.clearRect(0, 0, w, h);
      bits.forEach(function (b) {
        b.vy += 0.16;
        b.x += b.vx;
        b.y += b.vy;
        b.angle += b.spin;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.angle);
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size * 0.6);
        ctx.restore();
      });
      if (frame < limit) {
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(step);
      } else {
        canvas.remove();
      }
    }
    if (typeof requestAnimationFrame !== "function") { canvas.remove(); return; }
    requestAnimationFrame(step);
  }

  /** نغمة قصيرة عند الإنجاز. صامتة إن كتمها المستخدم أو لم يجرؤ المتصفح. */
  var audioCtx = null;

  function chime() {
    var s = load();
    if (s.muted || reducedMotion()) return;
    try {
      var Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
      var now = audioCtx.currentTime;
      [880, 1174.66, 1567.98].forEach(function (freq, index) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        /* الصعود ثم الخفوت: نغمةُ تقديرٍ لا زقاقُ جرس. */
        gain.gain.setValueAtTime(0.0001, now + index * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.07, now + index * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.1 + 0.34);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + index * 0.1);
        osc.stop(now + index * 0.1 + 0.4);
      });
    } catch (e) { /* المتصفح رفض الصوت */ }
  }

  /** تنبيه داخلي: صفحات الأدوات لا تحمل نظام التنبيهات في `src/`. */
  function toast(text, sub) {
    if (!hasDom()) return;
    var node = document.getElementById("egToast");
    if (!node) {
      node = document.createElement("div");
      node.id = "egToast";
      node.className = "eg-toast";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      document.body.appendChild(node);
    }
    node.innerHTML = "";
    var title = document.createElement("strong");
    title.textContent = text;
    node.appendChild(title);
    if (sub) {
      var detail = document.createElement("span");
      detail.textContent = sub;
      node.appendChild(detail);
    }
    node.classList.add("show");
    global.clearTimeout(node.egTimer);
    node.egTimer = global.setTimeout(function () { node.classList.remove("show"); }, 4200);
  }

  /** احتفال كامل: نغمة وقصاصات وتنبيه بكل وسام فُتح. */
  function celebrate(opened) {
    var list = (opened || []).slice(0, 3);
    if (!list.length) return;
    confetti();
    chime();
    if (list.length === 1) {
      toast("وسامٌ جديد: " + list[0].name, list[0].desc);
    } else {
      toast("🎉 " + list.length + " أوسمة جديدة", list.map(function (b) { return b.name; }).join(" · "));
    }
  }

  /* ====================================================== 8) الواجهة */

  var mounted = [];
  var pillNode = null;
  var panelNode = null;

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** حلقة تقدّم SVG. `ratio` بين ٠ و١. */
  function ring(ratio, size) {
    var r = 15;
    var c = 2 * Math.PI * r;
    var filled = Math.max(0, Math.min(1, ratio || 0)) * c;
    return '<svg class="eg-ring" viewBox="0 0 36 36" width="' + (size || 40) + '" height="' + (size || 40) +
      '" aria-hidden="true"><circle class="eg-ring-bg" cx="18" cy="18" r="' + r + '"/>' +
      '<circle class="eg-ring-fg" cx="18" cy="18" r="' + r + '" stroke-dasharray="' + c.toFixed(1) +
      '" stroke-dashoffset="' + (c - filled).toFixed(1) + '"/></svg>';
  }

  function challengeLine(snap) {
    var day = today();
    var challenge = challengeFor(day);
    var done = challengeDone(day, snap);
    var have = challenge.act === "read" ? snap.reads : (Number(snap.kinds[challenge.act]) || 0);
    var shown = Math.min(have, challenge.goal);
    return '<div class="eg-challenge' + (done ? " done" : "") + '">' +
      '<div class="eg-ch-top">' +
      '<span class="eg-ch-mark" aria-hidden="true">' + (done ? "✅" : "🎯") + '</span>' +
      '<div><p class="eg-ch-title">' + escapeHtml(challenge.title) + '</p>' +
      '<p class="eg-ch-hint">' + escapeHtml(challenge.hint) + ' — ' +
      '<span class="eg-ch-count">' + arNum(shown) + " / " + arNum(challenge.goal) + "</span></p></div></div>" +
      '<a class="eg-ch-go" href="' + BASE + challenge.url + '">' + (done ? "أداة أخرى" : "ابدأ") + "</a>" +
      "</div>";
  }

  function statsLine(snap) {
    return '<div class="eg-stats">' +
      '<div class="eg-stat"><b>' + arNum(snap.points) + '</b><span>نقطة</span></div>' +
      '<div class="eg-stat"><b>' + arNum(snap.streak) + '</b><span>يوم متتالٍ</span></div>' +
      '<div class="eg-stat"><b>' + arNum(snap.badges.length) + '</b><span>وسام من ' + arNum(BADGES.length) + '</span></div>' +
      "</div>";
  }

  /* ------------------------------------------------------ الشارة العائمة */

  function buildPill() {
    if (pillNode || !hasDom()) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "eg-pill";
    button.setAttribute("aria-haspopup", "dialog");
    button.innerHTML = ring(0, 34) +
      '<span class="eg-pill-fx"><span aria-hidden="true">🔥</span><b class="eg-pill-streak">٠</b></span>' +
      '<span class="eg-pill-fx"><span aria-hidden="true">🏅</span><b class="eg-pill-badges">٠</b></span>';
    button.addEventListener("click", openPanel);
    document.body.appendChild(button);
    pillNode = button;
  }

  /* ------------------------------------------------------------- اللوحة */

  function badgeGrid(snap) {
    var have = {};
    snap.badges.forEach(function (id) { have[id] = true; });
    return '<div class="eg-grid">' + BADGES.map(function (badge) {
      var open = !!have[badge.id];
      return '<div class="eg-badge ' + badge.tier + (open ? " open" : "") + '">' +
        '<span class="eg-badge-emoji" aria-hidden="true">' + (open ? badge.emoji : "🔒") + "</span>" +
        "<b>" + escapeHtml(badge.name) + "</b>" +
        "<span>" + escapeHtml(open ? badge.desc : "مقفل") + "</span></div>";
    }).join("") + "</div>";
  }

  function todayLog(snap) {
    var keys = Object.keys(snap.kinds).filter(function (k) { return Number(snap.kinds[k]) > 0; });
    if (!keys.length) return '<p class="eg-empty">لا شيء بعد اليوم — ابدأ بأي عمل، وسيظهر هنا.</p>';
    return '<ul class="eg-log">' + keys.sort().map(function (k) {
      return "<li><b>" + arNum(snap.kinds[k]) + "</b> " + escapeHtml(ACT_LABEL[k] || k) + "</li>";
    }).join("") + "</ul>";
  }

  function buildPanel() {
    if (panelNode || !hasDom()) return;
    var dialog = document.createElement("dialog");
    dialog.id = "egPanel";
    dialog.className = "eg-panel";
    dialog.innerHTML =
      '<form method="dialog" class="eg-panel-close"><button aria-label="إغلاق">✕</button></form>' +
      '<h2 class="eg-panel-title">تقدّمك في المكتبة</h2>' +
      '<p class="eg-panel-note">هذا منظِّم لِما تفعله أنت، لا نيابقة ولا مقارنة. ' +
      "كلّه محفوظ على جهازك وحدك، ومحذوف تمامًا حين تصفّره.</p>" +
      '<div class="eg-panel-ring">' + ring(0, 92) +
      '<div class="eg-panel-ring-text"><b class="eg-today-acts">٠</b><span>عمل اليوم</span></div></div>' +
      challengeLine(snapshot()) + statsLine(snapshot()) +
      '<h3 class="eg-panel-h">نشاط اليوم</h3>' + todayLog(snapshot()) +
      '<h3 class="eg-panel-h">الأوسمة</h3>' + badgeGrid(snapshot()) +
      '<div class="eg-panel-foot">' +
      '<button type="button" class="eg-btn" data-eg="mute">🔔 <span></span></button>' +
      '<button type="button" class="eg-btn eg-btn-quiet" data-eg="reset">تصفير التقدّم</button>' +
      "</div>";
    document.body.appendChild(dialog);
    dialog.addEventListener("click", function (event) {
      var button = event.target.closest("[data-eg]");
      if (!button) return;
      if (button.dataset.eg === "mute") {
        var s = load();
        s.muted = !s.muted;
        save();
        render();
        toast(s.muted ? "كُتمت النغمة" : "عادت النغمة");
      } else if (button.dataset.eg === "reset") {
        if (global.confirm("سيُصفّر تقدّمك في هذه الطبقة فقط: النقاط والأوسمة " +
          "وأيام المتتالية وما علّمته من عناصر. لن يمسّ数据和 الأدوات. أتممت؟")) {
          reset();
          toast("صُفِّر تقدّمك");
        }
      }
    });
    /* النقر خارج الصندوق يُغلقه، وEscape يعمل بأمر `<dialog>` الأصلي. */
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    panelNode = dialog;
  }

  function openPanel() {
    try {
      buildPanel();
      if (!panelNode) return;
      renderPanel();
      if (typeof panelNode.showModal === "function") panelNode.showModal();
      else panelNode.setAttribute("open", "");
    } catch (e) { /* متصفح بلا dialog */ }
  }

  function renderPanel() {
    if (!panelNode) return;
    var snap = snapshot();
    var ratio = snap.progress;
    var fg = panelNode.querySelector(".eg-panel-ring .eg-ring-fg");
    if (fg) {
      var c = 2 * Math.PI * 15;
      fg.setAttribute("stroke-dashoffset", (c - ratio * c).toFixed(1));
    }
    var acts = panelNode.querySelector(".eg-today-acts");
    if (acts) acts.textContent = arNum(snap.day.a);
    /* المراجع تُلتقط قبل أي استبدال: نقلُ عنصرٍ يزيح بقية `children`. */
    var fresh = document.createElement("div");
    fresh.innerHTML = challengeLine(snap) + statsLine(snap) + todayLog(snap);
    var parts = [fresh.children[0], fresh.children[1], fresh.children[2]];
    var old = panelNode.querySelector(".eg-challenge");
    if (old && old.parentNode && parts[0]) old.parentNode.replaceChild(parts[0], old);
    var oldStats = panelNode.querySelector(".eg-stats");
    if (oldStats && oldStats.parentNode && parts[1]) oldStats.parentNode.replaceChild(parts[1], oldStats);
    var oldLog = panelNode.querySelector(".eg-log") || panelNode.querySelector(".eg-empty");
    if (oldLog && oldLog.parentNode && parts[2]) oldLog.parentNode.replaceChild(parts[2], oldLog);
    var grid = panelNode.querySelector(".eg-grid");
    if (grid) {
      var replacement = document.createElement("div");
      replacement.innerHTML = badgeGrid(snap);
      grid.parentNode.replaceChild(replacement.firstChild, grid);
    }
    var mute = panelNode.querySelector('[data-eg="mute"] span');
    if (mute) mute.textContent = load().muted ? "النغمة مكتومة" : "النغمة تعمل";
  }

  /* --------------------------------------------------- بطاقة الصفحة الرئيسية */

  /**
   * بطاقة تحدّي اليوم في الصفحة الرئيسية.
   * @param {Element|string} target عنصرٌ أو مُعرِّف
   */
  function mount(target) {
    var host = typeof target === "string" ? document.getElementById(target) : target;
    if (!host) return;
    var card = document.createElement("section");
    card.className = "eg-card";
    card.id = "egCard";
    card.setAttribute("aria-label", "تحدّي اليوم وتقدّمك");
    card.innerHTML =
      '<div class="eg-card-head">' +
      '<h2 class="eg-card-title">🎯 تحدّي اليوم</h2>' +
      '<button type="button" class="eg-btn eg-btn-ghost" data-eg="open">كل تقدّمي</button></div>' +
      '<div class="eg-card-body"></div>';
    host.appendChild(card);
    card.addEventListener("click", function (event) {
      if (event.target.closest('[data-eg="open"]')) openPanel();
    });
    mounted.push(card);
    render();
  }

  /* -------------------------------------------------- صفحات القراءة النصّية */

  /**
   * يحوّل صفحة نصّية بلا تفاعل إلى صفحة تُقرأ وتُعلَّم.
   *
   * يضيف: بحثًا داخل الصفحة، وعلامة «قرأته» لكل عنصر، وعدّادًا للتقدّم.
   * والعلامات تُحفظ في `engage-v1` وحدها، فلا تمسّ الأدوات ولا تفترض
   * شيئًا عن بنية الصفحة سوى مُحدِّد العناصر.
   *
   * @param {object} options
   * @param {string} options.items مُحدِّد CSS للعناصر (مثل ".step, .event")
   * @param {string} [options.label] اسم الصفحة في شريط الأدوات
   * @param {string} [options.kind] نوع العمل لتسجيله (default "study")
   */
  function enhanceReadPage(options) {
    var opts = options || {};
    var selector = opts.items;
    if (!selector || !hasDom()) return null;
    var nodes;
    try { nodes = Array.prototype.slice.call(document.querySelectorAll(selector)); }
    catch (e) { return null; }
    if (!nodes.length) return null;

    var page = currentPage();
    var s = load();
    var read = (s.read[page] || []).slice();
    var seen = {};
    read.forEach(function (id) { seen[id] = true; });
    var kind = opts.kind || "study";
    var label = opts.label || "العناصر";

    var bar = document.createElement("div");
    bar.className = "eg-readbar";
    bar.innerHTML =
      '<input type="search" class="eg-readsearch" placeholder="ابحث في الصفحة…" aria-label="ابحث في ' +
      escapeHtml(label) + '">' +
      '<span class="eg-readcount" role="status"></span>' +
      '<button type="button" class="eg-btn eg-btn-quiet eg-readall">علّم الكل كمقروء</button>';

    var host = nodes[0].parentNode;
    if (host && host.parentNode) host.parentNode.insertBefore(bar, host);

    function paintCount() {
      var count = bar.querySelector(".eg-readcount");
      if (!count) return;
      count.textContent = arNum(read.length) + " من " + arNum(nodes.length) + " " + label;
    }

    function paintNodes() {
      nodes.forEach(function (node) {
        var id = node.dataset.egId;
        var open = !!seen[id];
        node.classList.toggle("eg-read", open);
        var mark = node.querySelector(".eg-mark");
        if (mark) {
          mark.textContent = open ? "✓" : "";
          mark.setAttribute("aria-pressed", open ? "true" : "false");
          mark.setAttribute("aria-label", open ? "مقروء" : "علّمه كمقروء");
        }
      });
      paintCount();
    }

    function toggle(id, on) {
      var at = read.indexOf(id);
      if (on && at === -1) read.push(id);
      if (!on && at !== -1) read.splice(at, 1);
      if (read.length > READ_KEEP) read = read.slice(-READ_KEEP);
      seen = {};
      read.forEach(function (key) { seen[key] = true; });
      s.read[page] = read;
      save();
    }

    nodes.forEach(function (node, index) {
      /* المعرّف من نصّ العنصر لا من ترتيبه، فيثبت بين الزيارات ولا يتغيّر
       * إن أضيف عنصرٌ قبله. */
      var id = "i" + hash(node.textContent || String(index)).toString(36) + index.toString(36);
      node.dataset.egId = id;
      node.classList.add("eg-item");
      if (node.tagName !== "LI") node.style.position = node.style.position || "relative";
      var mark = document.createElement("button");
      mark.type = "button";
      mark.className = "eg-mark";
      mark.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var on = !seen[id];
        toggle(id, on);
        paintNodes();
        if (on) {
          record(kind, 1);
          if (nodes.filter(function (n) { return seen[n.dataset.egId]; }).length === nodes.length) {
            confetti();
          }
        } else {
          render();
        }
      });
      node.insertBefore(mark, node.firstChild);
    });

    s.read[page] = read;
    save();
    paintNodes();

    var search = bar.querySelector(".eg-readsearch");
    if (search) {
      search.addEventListener("input", function () {
        var q = normalizeAr(search.value.trim());
        var hits = 0;
        nodes.forEach(function (node) {
          var hit = !q || normalizeAr(node.textContent || "").indexOf(q) !== -1;
          node.hidden = !hit;
          if (hit && q) hits++;
        });
        var count = bar.querySelector(".eg-readcount");
        if (count && q) count.textContent = arNum(hits) + " نتيجة";
      });
    }

    var all = bar.querySelector(".eg-readall");
    if (all) {
      all.addEventListener("click", function () {
        var fresh = nodes.filter(function (node) { return !seen[node.dataset.egId]; });
        fresh.forEach(function (node) { toggle(node.dataset.egId, true); });
        paintNodes();
        if (fresh.length) record(kind, fresh.length);
      });
    }

    return { count: nodes.length, read: read.length };
  }

  /** تطبيع النص العربي للبحث: توحيد الألف والهمزة والتاء المربوطة. */
  function normalizeAr(text) {
    return String(text || "")
      .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function currentPage() {
    if (typeof location === "undefined" || !location.pathname) return "index.html";
    return String(location.pathname).replace(/^.*\//, "") || "index.html";
  }

  /* ======================================================= 9) التحديث */

  function render() {
    if (!hasDom()) return;
    var snap = snapshot();
    if (pillNode) {
      var fg = pillNode.querySelector(".eg-ring-fg");
      if (fg) {
        var c = 2 * Math.PI * 15;
        fg.setAttribute("stroke-dashoffset", (c - snap.progress * c).toFixed(1));
      }
      var streak = pillNode.querySelector(".eg-pill-streak");
      if (streak) streak.textContent = arNum(snap.streak);
      var badges = pillNode.querySelector(".eg-pill-badges");
      if (badges) badges.textContent = arNum(snap.badges.length);
      pillNode.setAttribute("aria-label",
        "تقدّمك اليوم: " + arNum(snap.day.a) + " عمل، " + arNum(snap.streak) +
        " يوم متتالٍ، " + arNum(snap.badges.length) + " وسام. افتح اللوحة.");
    }
    mounted.forEach(function (card) {
      var body = card.querySelector(".eg-card-body");
      if (body) body.innerHTML = challengeLine(snap) + statsLine(snap) +
        '<div class="eg-mini">' + BADGES.filter(function (b) {
          return snap.badges.indexOf(b.id) === -1;
        }).slice(0, 3).map(function (b) {
          return '<span class="eg-mini-badge" title="' + escapeHtml(b.desc) + '">' + b.emoji + "</span>";
        }).join("") + '<span class="eg-mini-note">' + arNum(snap.badges.length) +
        " وسام مفتوح من " + arNum(BADGES.length) + "</span></div>";
    });
    if (panelNode && panelNode.open) renderPanel();
  }

  var refreshPending = false;

  /** حصادٌ جديد وتحديث الواجهة. آمن للاستدعاء المتكرّر. */
  function refresh() {
    if (refreshPending) return;
    refreshPending = true;
    try {
      harvest();
      unlockBadges();
      checkChallenge(false);
      save();
      render();
    } catch (e) { /* لا شيء يُكسر بسبب طبقة التفاعل */ }
    refreshPending = false;
  }

  /* ====================================================== 10) الإقلاع */

  function boot() {
    if (!hasDom()) return;
    try {
      var s = load();
      s.seen = (Number(s.seen) || 0) + 1;
      save();
      harvest();
      var opened = unlockBadges();
      save();
      render();
      buildPill();
      /* فتحُ وسامٍ جديدٍ بعد عملٍ سابقٍ لا يحتفل في صمت، ولا يحتاج أن
       * يرى المستخدم ما فات. فالقسم الثاني يُعلَم عند أول فتحٍ للوحة. */
      if (opened.length) opened = opened;
      mountIfPresent();

      /* بعد كل نقرة يتغيّر شيء في أداة، فنعيد الحصاد. أسهل من تعديل
       * أربعين صفحة لتُنادي `record`، وأخفّ من مراقب تغييرات. */
      var pending = null;
      function onTouch() {
        if (pending) return;
        pending = global.setTimeout(function () { pending = null; refresh(); }, 400);
      }
      document.addEventListener("click", onTouch, true);
      document.addEventListener("keydown", onTouch, true);
      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) refresh();
      });
      global.addEventListener("focus", refresh);
    } catch (e) { /* صامت: المكتبة تعمل بلا هذه الطبقة */ }
  }

  function mountIfPresent() {
    var host = document.getElementById("engageRoot");
    if (host) mount(host);
  }

  if (hasDom()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }

  /* ==================================================== 11) الواجهة العامة */

  return {
    record: record,
    refresh: refresh,
    state: snapshot,
    mount: mount,
    openPanel: openPanel,
    reset: reset,
    celebrate: celebrate,
    confetti: confetti,
    chime: chime,
    harvest: harvest,
    enhanceReadPage: enhanceReadPage,
    challengeFor: challengeFor,
    challengeDone: challengeDone,
    checkChallenge: checkChallenge,
    badges: BADGES,
    challenges: CHALLENGES,
    actLabel: ACT_LABEL,
    dayKey: dayKey,
    normalizeAr: normalizeAr,
    version: VERSION,
  };
});
