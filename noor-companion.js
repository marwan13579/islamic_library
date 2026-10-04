/**
 * 🌿 رفيق النور — Noor Companion
 * =============================================================================
 * نظام إيماني مرافق: رسالة اليوم، تذكير هادئ أثناء الجلسة، تدبر بعد إتمام
 * القراءة، وأعمال يومية اختيارية.
 *
 * مبادئ هندسية (الغرض منها ألّا يُكلَّف الموقع شيئًا):
 *   - سكربت عادي بلا وحدات ES، ليعمل في كل صفحات الموقع ومن القرص مباشرة.
 *   - لا استيراد ولا حزم ولا بناء ولا خادم. التكلفة صفر إن لم تُفعَّل.
 *   - لا مؤقّتات دورية: سلسلة `setTimeout` واحدة تُعاد برمجيًّا بعد كل تذكير.
 *   - لا يحجب المستخدم: يُؤجَّل التذكير إن كان يكتب أو يقرأ أوالإظهار أمامه.
 *   - لا يُنزّل المحتوى إلا عند الحاجة، فملف ١٥٥ ك.ب لا يُحمَّل في أول زيارة.
 *   - كل نصّ دينيّ في `noor-content.js` بمصدره، وما لم يكن منسوبًا فمكتوب
 *     عليه أنه تأليف تحريري. لا يُنسب شيء هنا إلى النبي ﷺ بلا مصدر.
 *
 * الإزالة الكاملة: احذف `noor-companion.js` و`noor-content.js`، ثم انزع
 * سطر السكربت من صفحات HTML، واحذف مفاتيح `noor-*` من `storage.js`
 * و`backup-core.js`. لا شيء آخر في الموقع يعتمد على هذا النظام.
 *
 * التكامل مع الموقع القائم (لا نظام موازٍ):
 *   - يتركّب على `storage-fallback.js` فيصمد عند منع التخزين.
 *   - يقرأ تقدّم القراءة من `quran-lastpos` ولا يكتب مفتاحًا موازيًا له.
 *   - يعرض إشعارات المتصفح عبر عامل الخدمة نفسه (`sw.js`) القائم.
 *   - يستعمل متغيّرات التصميم الموجودة (`--paper`, `--ink`, `--gold`, `--card`)
 *     فيتبع الوضع الليلي والوضع الهادئ و RTL دون تعريف لون جديد.
 *
 * الواجهة العامة (يستدعيها الموقع القائم):
 *   NoorCompanion.observeReading({surah, ayah})  — من دالة التقدّم في المصحف
 *   NoorCompanion.markSurahDone(surah)          — من صفحة الحفظ
 *   NoorCompanion.getStats()                     — لإحصاءات «رحلتي»
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NoorCompanion = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* النطاق العام: معامل الغلاف (root) غير مرئي داخل المصنع، فنلتقطه هنا. */
  var GLOBAL = typeof globalThis !== "undefined" ? globalThis : this;

  /* ============================================================ 0) الثوابت */

  var KEY = {
    settings: "noor-settings",
    shown: "noor-shown",
    stats: "noor-stats",
    actions: "noor-actions",
  };

  /** المسار إلى جذر الموقع، نسبةً لملف هذا السكربت لا للصفحة الحالية.
   * الملف في الجذر، وهو محمَّل من `src/site/` و`src/app/` بعمق مختلف،
   * فاشتقاق الجذر من عنوان الصفحة كان سينكسر هناك. و`document.currentScript`
   * صحيح وقت تنفيذ سكربت كلاسيكي، فنأخذ جذره مباشرة؛ وإن كان الملف مضمَّنًا
   * بلا `src` رجعنا إلى مسار الصفحة.
   */
  var BASE = (function () {
    if (typeof document !== "undefined" && document.currentScript && document.currentScript.src) {
      return String(document.currentScript.src).replace(/[^/]*$/, "");
    }
    if (typeof location === "undefined") return "";
    return String(location.pathname).replace(/[^/]+$/, "");
  })();

  var CONTENT_SRC = BASE + "noor-content.js";
  var SETTINGS_PAGE = BASE + "44-noor-companion.html";

  /** الفواصل بال دقائق. القيمة الأولى اقتراحٌ لا إصرار. */
  var INTERVALS = [
    { value: 5, label: "كل ٥ دقائق" },
    { value: 15, label: "كل ١٥ دقيقة" },
    { value: 30, label: "كل ٣٠ دقيقة" },
    { value: 60, label: "كل ساعة" },
    { value: 1440, label: "مرة يوميًا" },
  ];

  /** أنواع المحتوى التي يقبلها المستخدم في التذكير. */
  var REMINDER_TYPES = ["verse", "hadith", "dhikr", "dua", "story", "lesson"];

  /** سقف الأمان: لا إشعارات بلا نهاية مهما طالت الجلسة. */
  var MAX_PER_DAY = 12;
  /** كم معرّفًا نحتفظ بهامشٍ حديثًا منع التكرار. */
  var HISTORY_SIZE = 60;
  /** آخر ١٢ معرّفًا لا تُعاد حتى لو ضاق المحتوى. */
  var RECENT_BLOCK = 12;
  /** مهلة إعادة محاولة التذكير المؤجَّل، بالمللي ثانية. */
  var DEFER_MS = 25000;
  /** أقل من هذا لا تُعرض رسالة «حصيلة الجلسة». */
  var SESSION_MIN_SECONDS = 120;

  var AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  var arNum = function (value) {
    return String(value).replace(/\d/g, function (d) { return AR_DIGITS[Number(d)]; });
  };

  function todayKey() {
    var now = new Date();
    return (
      now.getFullYear() +
      "-" + String(now.getMonth() + 1).padStart(2, "0") +
      "-" + String(now.getDate()).padStart(2, "0")
    );
  }

  /* ============================================================ 1) السجلّ
   * لا يظهر للمستخدم النهائي. يطبع في التطوير فقط، ويُشغَّل بإسناد
   * `window.NOOR_DEBUG = true` قبل تحميل هذا الملف.
   */
  var debugOn = (function () {
    if (GLOBAL.NOOR_DEBUG === true) return true;
    var host = (typeof location !== "undefined" && location.hostname) || "";
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  })();

  function log() {
    if (!debugOn) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[Noor Companion]");
    if (typeof console.info === "function") console.info.apply(console, args);
  }

  /* ============================================================ 2) التخزين
   * كل قراءة وكل كتابة داخل try/catch: الموقع يعمل حين يمنع المتصفح
   * التخزين (-private-، أو امتلاء الحصة)، و`storage-fallback.js` يحوّل
   * التخزين إلى ذاكرة في هذه الحالة.
   */
  var memory = {};

  function readRaw(key) {
    try {
      var value = localStorage.getItem(key);
      return value === null ? (key in memory ? memory[key] : null) : value;
    } catch (error) {
      return key in memory ? memory[key] : null;
    }
  }

  function writeRaw(key, value) {
    memory[key] = value;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      log("تعذّر الحفظ الدائم، وبقيت في الذاكرة:", key);
    }
  }

  /** يقرأ كائنًا ويُصلح شكله إن كان تالفًا. */
  function readObject(key, fallback) {
    var raw = readRaw(key);
    if (!raw) return fallback;
    try {
      var value = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
      return value;
    } catch (error) {
      return fallback;
    }
  }

  function writeObject(key, value) {
    try {
      writeRaw(key, JSON.stringify(value));
    } catch (error) {
      log("تعذّر الحفظ:", key);
    }
  }

  /* ============================================================ 3) الإعدادات */

  var DEFAULT_SETTINGS = {
    v: 1,
    enabled: true,
    quiet: false,
    interval: 5,
    types: { verse: true, hadith: true, dhikr: true, dua: true, story: true, lesson: true },
    onboarded: false,
    notifAsked: false,
    dailyShownOn: "",
    actionsShownOn: "",
  };

  var settings = loadSettings();

  function loadSettings() {
    var stored = readObject(KEY.settings, {});
    var merged = {
      v: 1,
      enabled: stored.enabled !== false,
      quiet: stored.quiet === true,
      interval: INTERVALS.some(function (i) { return i.value === stored.interval; })
        ? stored.interval
        : DEFAULT_SETTINGS.interval,
      types: {},
      onboarded: stored.onboarded === true,
      notifAsked: stored.notifAsked === true,
      dailyShownOn: typeof stored.dailyShownOn === "string" ? stored.dailyShownOn : "",
      actionsShownOn: typeof stored.actionsShownOn === "string" ? stored.actionsShownOn : "",
    };
    REMINDER_TYPES.forEach(function (type) {
      merged.types[type] = stored.types ? stored.types[type] !== false : true;
    });
    return merged;
  }

  function saveSettings() {
    writeObject(KEY.settings, settings);
    listeners.settings.forEach(function (fn) { safe(fn, settings); });
  }

  /* ============================================================ 4) السجلّ
   * سجلّ ما عُرض فعلًا. هو ما يمنع التكرار، ويغني عن أي إحصاء على
   * الخادم: البيانات كلها عند المستخدم.
   */
  var shown = loadShown();

  function loadShown() {
    var stored = readObject(KEY.shown, {});
    return {
      v: 1,
      ids: Array.isArray(stored.ids) ? stored.ids.filter(isString).slice(-HISTORY_SIZE) : [],
      reflections: Array.isArray(stored.reflections) ? stored.reflections.filter(isString) : [],
      lastAt: Number(stored.lastAt) || 0,
      day: typeof stored.day === "string" ? stored.day : "",
      todayCount: Number(stored.todayCount) || 0,
    };
  }

  function isString(value) {
    return typeof value === "string" && value.length > 0;
  }

  function saveShown() {
    writeObject(KEY.shown, shown);
  }

  /** يسجّل عرضًا ويقصّ الهامش، فيبقى الملف صغيرًا مهما طال العمر. */
  function noteShown(id, isReflection) {
    if (isString(id)) {
      shown.ids.push(id);
      if (shown.ids.length > HISTORY_SIZE) shown.ids = shown.ids.slice(-HISTORY_SIZE);
    }
    if (isReflection && isString(id)) {
      shown.reflections.push(id);
      if (shown.reflections.length > 60) shown.reflections = shown.reflections.slice(-60);
    }
    shown.lastAt = Date.now();
    shown.day = todayKey();
    shown.todayCount += 1;
    saveShown();
  }

  /** هل تجاوزنا سقف اليوم؟ */
  function dailyCapReached() {
    if (shown.day !== todayKey()) {
      shown.day = todayKey();
      shown.todayCount = 0;
      saveShown();
      return false;
    }
    return shown.todayCount >= MAX_PER_DAY;
  }

  /* ============================================================ 5) الإحصاءات
   * شخصية ومحلية بالكامل. الأذكار تُقرأ من مفاتيحها القائمة ولا تُعدّ
   * مرتين،لأن عدّها هنا يعني تضاعف الرقم على المستخدم.
   */
  var stats = readObject(KEY.stats, {});

  function statNumber(name) {
    var value = Number(stats[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  function bump(name, by) {
    stats[name] = statNumber(name) + (by || 1);
    stats.v = 1;
    writeObject(KEY.stats, stats);
  }

  /**
   * مجموع أذكار المستخدم من مفاتيح صفحاته القائمة. لا نكتب عدًّا جديدًا،
   * فجمعنا لرقمين واحدين يربك ولا يطمئن.
   */
  function azkarTotal() {
    var total = 0;
    ["nour-progress", "azkar-shamila-progress"].forEach(function (key) {
      var value = readObject(key, {});
      var data = value.data && typeof value.data === "object" ? value.data : value;
      Object.keys(data).forEach(function (id) {
        var count = Number(data[id]);
        if (Number.isFinite(count) && count > 0) total += count;
      });
    });
    return total;
  }

  /* ============================================================ 6) الأعمال */

  var actions = loadActions();

  function loadActions() {
    var stored = readObject(KEY.actions, {});
    return {
      v: 1,
      day: typeof stored.day === "string" ? stored.day : "",
      chosen: Array.isArray(stored.chosen) ? stored.chosen.filter(isString) : [],
      done: Array.isArray(stored.done) ? stored.done.filter(isString) : [],
    };
  }

  function saveActions() {
    writeObject(KEY.actions, actions);
    listeners.actions.forEach(function (fn) { safe(fn, actions); });
  }

  function rolloverActions() {
    if (actions.day === todayKey()) return;
    actions.day = todayKey();
    actions.chosen = [];
    actions.done = [];
    saveActions();
  }

  /* ============================================================ 7) المحتوى */

  var content = null;
  var loading = null;

  /**
   * يحمّل ملف المحتوى عند أول حاجة فقط. يُحقن وسم `<script>` ليعمل من
   * القرص مباشرة كما تعمل بقية صفحات الموقع، وليعمل من وحدة ES
   * فيدخل في كاش الصفحة ثم في كاش عامل الخدمة.
   */
  function loadContent(done) {
    if (content) return done(content);
    if (GLOBAL.NOOR_CONTENT) {
      content = GLOBAL.NOOR_CONTENT;
      return done(content);
    }
    if (loading) return loading.then(function () { done(content); });

    loading = new Promise(function (resolve) {
      var script = document.createElement("script");
      script.src = CONTENT_SRC;
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () {
        log("تعذّر تحميل المحتوى، سيُعطَّل التذكير في هذه الجلسة.");
        resolve();
      };
      if (!document.head) return resolve();
      document.head.appendChild(script);
    }).then(function () {
      content = GLOBAL.NOOR_CONTENT || null;
      if (!content) log("لا مستودع محتوى: يبقى النظام صامتًا.");
    });

    return loading.then(function () { done(content); });
  }

  var byId = Object.create(null);
  function index(items) {
    items.forEach(function (item) { byId[item.id] = item; });
  }

  function item(id) {
    return byId[id] || null;
  }

  /* ============================================================ 8) سياق الصفحة
   * يحدّد: أين نحن، وما الأداة، وبأي موضوعات نمشي.
   */
  function contextOf() {
    var file = String(location.pathname).split("/").pop() || "index.html";
    var routes = (content && content.routes) || [];
    for (var i = 0; i < routes.length; i += 1) {
      var route = routes[i];
      for (var j = 0; j < route.match.length; j += 1) {
        if (file.indexOf(route.match[j]) !== -1) {
          return {
            page: route.page,
            feature: route.feature,
            topics: route.topics,
            file: file,
            surah: 0,
          };
        }
      }
    }
    return { page: "other", feature: "other", topics: ["dhikr"], file: file, surah: 0 };
  }

  /** الموضوعات التي يقرأها المستخدم الآن في المصحف، إن كان يقرأ. */
  function readingTopics(surah) {
    var map = (content && content.surahTopics) || {};
    if (surah && map[surah]) return map[surah];
    return contextOf().topics;
  }

  /* ============================================================ 9) الاختيار */

  /** مولّد أرقام شبه عشوائي ثابت البذرة: يتغيّر يوميًا، لا في كل نداء. */
  function seeded(seed) {
    var value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return function () {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function pickIndex(list, salt) {
    if (!list.length) return -1;
    var daySeed = 0;
    var key = todayKey();
    for (var i = 0; i < key.length; i += 1) daySeed = daySeed * 31 + key.charCodeAt(i);
    var random = seeded(daySeed + (salt || 0) + list.length * 7919);
    return Math.floor(random() * list.length) % list.length;
  }

  function allowedTypes() {
    return REMINDER_TYPES.filter(function (type) { return settings.types[type]; });
  }

  function hasTopic(item, topics) {
    if (!topics || !topics.length) return true;
    for (var i = 0; i < topics.length; i += 1) {
      if (item.topics.indexOf(topics[i]) !== -1) return true;
    }
    return false;
  }

  function inRecent(id, block) {
    var from = Math.max(0, shown.ids.length - (block || RECENT_BLOCK));
    return shown.ids.indexOf(id, from) !== -1;
  }

  /**
   * يختار عنصرًا للمتذكّر: من موضوعات الصفحة أولًا، ثم من غيرها، ولا يكرر
   * ما عُرض أخيرًا إلا إذا لم يبقَ شيء آخر — وحينها يُخفَّف الحظر ولا يُعطَّل.
   */
  function pickReminder(topics, salt) {
    var types = allowedTypes();
    if (!types.length) return null;
    var pool = content.items.filter(function (candidate) {
      return types.indexOf(candidate.type) !== -1 && !inRecent(candidate.id);
    });
    if (!pool.length) {
      /* استُنزف المحتوى: نخفّف الحظر إلى آخر ثلاثة، فلا يسكت النظام. */
      pool = content.items.filter(function (candidate) {
        return types.indexOf(candidate.type) !== -1 && !inRecent(candidate.id, 3);
      });
    }
    if (!pool.length) return null;
    var onTopic = pool.filter(function (candidate) { return hasTopic(candidate, topics); });
    var chosen = onTopic.length ? onTopic : pool;
    return chosen[pickIndex(chosen, salt)] || null;
  }

  /**
   * يختار مادة التدبر بعد إتمام القراءة: آية أولًا ثم عبرة، وكلاهما
   * من موضوع السورة. لا تُعاد عبرة سبق عرضها إلا إذا لم يبقَ غيرها.
   */
  function pickReflection(surah) {
    var topics = readingTopics(surah);
    var seen = shown.reflections;
    var verse = content.items.filter(function (candidate) {
      return candidate.type === "verse" && hasTopic(candidate, topics) && !inRecent(candidate.id, 20);
    });
    var reflection = content.items.filter(function (candidate) {
      return candidate.type === "reflection" &&
        hasTopic(candidate, topics) &&
        seen.indexOf(candidate.id) === -1;
    });

    /* مواد بديلة: ليس تفسيرًا دائمًا، فتختار الآية أحيانًا والعبرة أحيانًا. */
    var options = [];
    if (verse.length) options.push(verse[pickIndex(verse, surah || 1)]);
    if (reflection.length) options.push(reflection[pickIndex(reflection, (surah || 1) + 31)]);
    if (!options.length && verse.length) {
      options.push(content.items.filter(function (candidate) {
        return candidate.type === "verse" && hasTopic(candidate, topics);
      })[0]);
    }
    if (!options.length) return null;
    return options[pickIndex(options, (surah || 1) + 97)] || options[0];
  }

  /* ========================================================== 10) ذاكرة اليوم */

  /** إحصاءات هذه الجلسة فقط. */
  var session = {
    startedAt: Date.now(),
    seconds: 0,
    surahs: [],
    reflections: 0,
    actions: 0,
    summarized: false,
  };

  function sessionLabel() {
    return session.seconds >= 60
      ? arNum(Math.round(session.seconds / 60)) + " دقيقة"
      : arNum(session.seconds) + " ثانية";
  }

  /* ========================================================== 11) المستمعون
   * بدل أن يستدعي المحرّك الواجهة، تستدعي الواجهة المحرّك. فالتركيب
   * محايدة: لا أعرف من يسمع، ولا من يستمع.
   */
  var listeners = { settings: [], actions: [], ready: [] };

  function on(name, fn) {
    if (listeners[name] && typeof fn === "function") listeners[name].push(fn);
  }

  function safe(fn, arg) {
    try { fn(arg); } catch (error) { log("خطأ في مستمع:", error); }
  }

  /* ============================================================ 12) التنسيق
   * لا لون جديد: يستعمل ما عرّفته صفحات الموقع في :root، فيتبع تلقائيًا
   * الوضع الليلي والوضع الهادئ والتباين العالي.
   */
  var STYLE_ID = "noor-companion-style";

  var CSS = [
    ".noor-root{position:fixed;inset-inline:0;bottom:calc(env(safe-area-inset-bottom,0px) + 76px);",
    "z-index:130;display:flex;justify-content:center;padding-inline:12px;pointer-events:none}",
    ".noor-card{pointer-events:none;width:100%;max-width:400px;background:var(--card,#fffaf0);",
    // البطاقة مرئيّة فوق الصفحة لكنّها لا تعترض النقر: ما تحتها يبقى قابلًا
    // للاستعمال، ولا يُمنع المستخدم عن قراءة أو الضغط على أي زرّ تحتها.
    ".noor-card .noor-btn,.noor-card .noor-x,.noor-card a{pointer-events:auto}",
    "color:var(--ink,#13322c);border:1px solid var(--line,rgba(19,50,44,.14));",
    "border-inline-start:3px solid var(--gold,#9c7420);border-radius:14px;padding:14px 16px;",
    "box-shadow:0 8px 28px rgba(0,0,0,.18);font-family:Cairo,system-ui,sans-serif;font-size:.92rem;",
    "line-height:1.75}",
    ".noor-card h3{margin:0 0 6px;font-size:.95rem;font-weight:700;color:var(--gold,#9c7420)}",
    ".noor-kind{font-size:.72rem;letter-spacing:.04em;color:var(--ink-soft,#3d5b53);",
    "border:1px solid var(--line,rgba(19,50,44,.14));border-radius:999px;padding:1px 9px;",
    "display:inline-block;margin-inline-end:6px}",
    ".noor-text{margin:8px 0 0;font-family:Amiri,Scheherazade New,serif;font-size:1.12rem;",
    "line-height:2}",
    ".noor-text.is-quote{font-size:1.16rem}",
    ".noor-src{margin:8px 0 0;font-size:.76rem;color:var(--ink-soft,#3d5b53)}",
    ".noor-meta{margin:10px 0 0;padding:10px 0 0;border-top:1px dashed var(--line,rgba(19,50,44,.14));",
    "font-size:.86rem;color:var(--ink-soft,#3d5b53)}",
    ".noor-meta b{color:var(--ink,#13322c);font-weight:600}",
    ".noor-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}",
    ".noor-btn{font-family:inherit;font-size:.82rem;font-weight:600;cursor:pointer;",
    "border-radius:999px;padding:7px 14px;border:1px solid var(--line,rgba(19,50,44,.16));",
    "background:transparent;color:var(--ink,#13322c)}",
    ".noor-btn:hover{border-color:var(--gold,#9c7420);color:var(--gold,#9c7420)}",
    ".noor-btn:focus-visible{outline:2px solid var(--gold,#9c7420);outline-offset:2px}",
    ".noor-btn[data-primary]{background:var(--gold,#9c7420);border-color:var(--gold,#9c7420);color:var(--card,#fffaf0)}",
    ".noor-x{position:absolute;inset-inline-start:6px;top:6px;background:none;border:0;cursor:pointer;",
    "color:var(--ink-soft,#3d5b53);font-size:1rem;line-height:1;padding:6px}",
    ".noor-x:focus-visible{outline:2px solid var(--gold,#9c7420);outline-offset:1px}",
    ".noor-holder{position:relative}",
    ".noor-list{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:7px}",
    ".noor-list li{display:flex;align-items:flex-start;gap:8px;font-size:.86rem}",
    ".noor-list input{margin-top:5px;accent-color:var(--gold,#9c7420);width:16px;height:16px;flex:none}",
    ".noor-list label{cursor:pointer}",
    ".noor-gear{position:fixed;inset-inline-end:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);",
    "z-index:129;width:42px;height:42px;border-radius:50%;cursor:pointer;font-size:1.1rem;",
    "background:var(--card,#fffaf0);color:var(--ink,#13322c);",
    "border:1px solid var(--line,rgba(19,50,44,.14));box-shadow:0 3px 12px rgba(0,0,0,.16)}",
    ".noor-gear:focus-visible{outline:2px solid var(--gold,#9c7420);outline-offset:2px}",
    ".noor-backdrop{position:fixed;inset:0;z-index:140;background:rgba(0,0,0,.45);display:flex;",
    "align-items:center;justify-content:center;padding:16px}",
    ".noor-backdrop[hidden]{display:none}",
    ".noor-sheet{pointer-events:auto;background:var(--card,#fffaf0);color:var(--ink,#13322c);",
    "border:1px solid var(--line,rgba(19,50,44,.14));border-radius:18px;padding:20px 18px;",
    "max-width:520px;width:100%;max-height:86vh;overflow:auto;box-shadow:0 18px 50px rgba(0,0,0,.3)}",
    ".noor-sheet h2{margin:0 0 4px;font-family:Amiri,serif;font-size:1.2rem}",
    ".noor-sheet .noor-sub{color:var(--ink-soft,#3d5b53);font-size:.8rem;margin:0 0 12px}",
    ".noor-rows{display:grid;gap:10px}",
    ".noor-row{display:flex;align-items:center;justify-content:space-between;gap:12px;",
    "padding-bottom:10px;border-bottom:1px solid var(--line,rgba(19,50,44,.1))}",
    ".noor-row:last-child{border-bottom:0}",
    ".noor-row>span{font-size:.88rem}",
    ".noor-pill{display:flex;flex-wrap:wrap;gap:6px}",
    ".noor-pill label{display:inline-flex;align-items:center;gap:5px;font-size:.8rem;",
    "border:1px solid var(--line,rgba(19,50,44,.14));border-radius:999px;padding:4px 10px;cursor:pointer}",
    ".noor-pill input{accent-color:var(--gold,#9c7420)}",
    ".noor-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:8px}",
    ".noor-stat{background:var(--paper-2,#efe5cf);border-radius:12px;padding:10px;text-align:center}",
    ".noor-stat b{display:block;font-size:1.05rem;color:var(--gold,#9c7420)}",
    ".noor-stat span{font-size:.72rem;color:var(--ink-soft,#3d5b53)}",
    ".noor-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
    "@media (prefers-reduced-motion:no-preference){.noor-card,.noor-sheet{animation:noor-in .22s ease-out}",
    "@keyframes noor-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}}",
    "@media (max-width:420px){.noor-root{bottom:calc(env(safe-area-inset-bottom,0px) + 70px)}.noor-card{font-size:.88rem}}",
    "@media print{.noor-root,.noor-gear,.noor-backdrop{display:none!important}}",
  ].join("");

  function injectStyle() {
    if (!document.head || document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------- 13) أدوات العرض */

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  /** يبني نصّ العنصر: الآية والحديث والأذكار يُوسم بنوعه، فلا يختلط. */
  function itemMarkup(entry) {
    if (!entry) return "";
    var labels = (content && content.typeLabels) || {};
    var kind = labels[entry.type] || entry.type;
    var isQuote = entry.type === "verse" || entry.type === "hadith";
    var html = '<span class="noor-kind">' + esc(kind) + "</span>";
    if (entry.title) html += " <strong>" + esc(entry.title) + "</strong>";
    html += '<p class="noor-text' + (isQuote ? " is-quote" : "") + '">' + esc(entry.text) + "</p>";
    if (entry.meaning && entry.type !== "verse") {
      html += '<p class="noor-src">' + esc(entry.meaning) + "</p>";
    }
    var src = entry.source || entry.ref;
    if (src) html += '<p class="noor-src">' + esc(src) + "</p>";
    return html;
  }

  /* ------------------------------------------------------------- 14) البطاقة */

  var rootEl = null;

  function ensureRoot() {
    if (!document.body) return null;
    if (rootEl) return rootEl;
    rootEl = document.createElement("div");
    rootEl.className = "noor-root";
    rootEl.setAttribute("role", "region");
    rootEl.setAttribute("aria-label", "تذكير إيماني من رفيق النور");
    rootEl.setAttribute("aria-live", "polite");
    document.body.appendChild(rootEl);
    return rootEl;
  }

  /**
   * بطاقة صغيرة أسفل الشاشة. لا تغطي المحتوى ولا تركّز نفسها ولا تمنع
   * القراءة: يُغلقها المستخدم متى شاء، وتختفي وحدها بعد مدّة.
   */
  function showCard(options) {
    /* تفكيك الصفحة: لا نكتب في مستندٍ فُكِّك، فلا يقع استثناء. */
    if (typeof document === "undefined" || !document.body || !document.head) return null;
    injectStyle();
    var host = ensureRoot();
    if (!host) return null;
    host.innerHTML = "";

    var holder = document.createElement("div");
    holder.className = "noor-holder";
    holder.setAttribute("role", "status");

    var card = document.createElement("div");
    card.className = "noor-card";
    card.innerHTML =
      '<button type="button" class="noor-x" aria-label="إغلاق">✕</button>' +
      "<h3>" + esc(options.title || "🌿 رفيق النور") + "</h3>" +
      options.body +
      (options.footer
        ? '<div class="noor-acts">' + options.footer + "</div>"
        : "");
    holder.appendChild(card);
    host.appendChild(holder);

    function close() {
      if (holder.parentNode) holder.parentNode.removeChild(holder);
      if (options.onClose) safe(options.onClose);
    }

    card.querySelector(".noor-x").addEventListener("click", close);
    var buttons = options.buttons || [];
    /* حاوية الأزرار تُرسم مع `footer` فقط، وقد تطلبها البطاقة ببلا footer
       (الترحيب مثلًا) — فننشئها هنا، وإلا انهار null.appendChild. */
    var acts = card.querySelector(".noor-acts");
    if (!acts && buttons.length) {
      acts = document.createElement("div");
      acts.className = "noor-acts";
      card.appendChild(acts);
    }
    buttons.forEach(function (spec) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "noor-btn" + (spec.primary ? " data-primary" : "");
      btn.textContent = spec.label;
      btn.addEventListener("click", function () {
        var keep = spec.action ? spec.action() : undefined;
        if (keep !== false) close();
      });
      acts.appendChild(btn);
    });

    var timer = null;
    if (options.autoClose) {
      timer = setTimeout(close, options.autoClose);
    }
    holder.addEventListener("mouseenter", function () {
      if (timer) clearTimeout(timer);
    });

    log("عرض بطاقة:", options.title);
    return { close: close, el: holder };
  }

  /* -------------------------------------------------------- 15) لوح الإعدادات
   * لوح كامل لأنه المكان الوحيد الذي يغيّر سلوك النظام كله.
   */
  var lastFocus = null;

  function openSheet(title, subtitle, bodyHtml) {
    if (typeof document === "undefined" || !document.body || !document.head) return null;
    injectStyle();
    if (document.getElementById("noor-backdrop")) return null;

    lastFocus = document.activeElement;
    var backdrop = document.createElement("div");
    backdrop.className = "noor-backdrop";
    backdrop.id = "noor-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-label", title);

    var sheet = document.createElement("div");
    sheet.className = "noor-sheet";
    sheet.innerHTML =
      "<h2>" + esc(title) + "</h2>" +
      (subtitle ? '<p class="noor-sub">' + esc(subtitle) + "</p>" : "") +
      bodyHtml;
    backdrop.appendChild(sheet);
    document.body.appendChild(backdrop);

    function close() {
      document.removeEventListener("keydown", onKey, true);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      /* حصر التنقّل داخل اللوح: مستخدم لوحة المفاتيح لا يخرج بلا اختيار. */
      if (event.key !== "Tab") return;
      var focusable = sheet.querySelectorAll(
        'button,input,select,a[href],[tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey, true);
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) close();
    });
    sheet.close = close;
    var target = sheet.querySelector("button,input");
    if (target) target.focus();
    return sheet;
  }

  /* ------------------------------------------------------ 16) زرّ الإعدادات */

  function mountGear() {
    if (!document.body) return;
    if (document.body.dataset && document.body.dataset.noorCompanionPage) return;
    if (document.querySelector(".noor-gear")) return;
    injectStyle();
    var gear = document.createElement("button");
    gear.type = "button";
    gear.className = "noor-gear";
    gear.textContent = "🌿";
    gear.setAttribute("aria-label", "إعدادات رفيق النور");
    gear.setAttribute("aria-haspopup", "dialog");
    gear.addEventListener("click", openSettingsSheet);
    document.body.appendChild(gear);
  }

  var TYPE_LABELS = {
    verse: "آيات",
    hadith: "أحاديث",
    dhikr: "أذكار",
    dua: "أدعية",
    story: "قصص",
    lesson: "فوائد",
  };

  function switchRow(label, name, checked, onChange) {
    return (
      '<div class="noor-row"><span id="noor-lbl-' + name + '">' + esc(label) + "</span>" +
      '<input type="checkbox" role="switch" data-noor="' + name + '"' +
      (checked ? " checked" : "") + ' aria-labelledby="noor-lbl-' + name + '"></div>'
    );
  }

  function openSettingsSheet() {
    var rows = "";
    rows += switchRow("التذكيرات أثناء الجلسة", "enabled", settings.enabled);
    rows += switchRow("الوضع الهادئ (لا تذكير في هذه الجلسة)", "quiet", settings.quiet);

    rows += '<div class="noor-row"><span>نوع التذكير</span></div>';
    rows += '<div class="noor-pill" role="group" aria-label="أنواع التذكير">';
    REMINDER_TYPES.forEach(function (type) {
      rows +=
        '<label><input type="checkbox" data-noor-type="' + type + '"' +
        (settings.types[type] ? " checked" : "") + "> " + esc(TYPE_LABELS[type] || type) + "</label>";
    });
    rows += "</div>";

    rows += '<div class="noor-row" style="display:block"><span>الفاصل الزمني</span>';
    rows += '<div class="noor-pill" role="radiogroup" aria-label="الفاصل الزمني" style="margin-top:8px">';
    INTERVALS.forEach(function (option) {
      rows +=
        '<label><input type="radio" name="noor-interval" value="' + option.value + '"' +
        (settings.interval === option.value ? " checked" : "") + "> " + esc(option.label) + "</label>";
    });
    rows += "</div></div>";

    rows +=
      '<div class="noor-row"><span>التذكير بالقراءة (تدبر بعد إتمامها)</span>' +
      '<input type="checkbox" role="switch" data-noor="reflect"' +
      (settings.enabled ? " checked" : "") + ' aria-labelledby="noor-lbl-reflect"></div>';

    rows +=
      '<div class="noor-row" style="display:block"><span>رحلة</span>' +
      '<div class="noor-stats" style="margin-top:8px">' +
      statCell("جلسات", "sessions") +
      statCell("أجزاء", "parts") +
      statCell("تدبرات", "reflections") +
      statCell("أعمال", "actions") +
      "</div></div>";

    rows +=
      '<div class="noor-acts">' +
      '<a class="noor-btn" href="' + esc(SETTINGS_PAGE) + '">صفحة الإعدادات</a>' +
      '<button type="button" class="noor-btn" data-noor-act="notify">' + esc(notifyLabel()) + "</button>" +
      '<button type="button" class="noor-btn" data-noor-act="reset">مسح سجل العرض</button>' +
      "</div>";

    var sheet = openSheet(
      "⚙️ إعدادات التذكيرات",
      "كل ما يُحفظ على جهازك وحده، ولا يُرسل إلى أي خادم.",
      rows
    );
    if (!sheet) return;

    sheet.addEventListener("change", function (event) {
      var target = event.target;
      if (target.dataset.noor) {
        var name = target.dataset.noor;
        if (name === "enabled" || name === "reflect") settings.enabled = target.checked;
        if (name === "quiet") {
          settings.quiet = target.checked;
          schedule();
        }
        saveSettings();
        log("تغيّر الإعداد:", name, target.checked);
        return;
      }
      if (target.dataset.noorType) {
        settings.types[target.dataset.noorType] = target.checked;
        saveSettings();
        return;
      }
      if (target.name === "noor-interval") {
        settings.interval = Number(target.value);
        saveSettings();
        schedule();
      }
    });

    sheet.addEventListener("click", function (event) {
      var act = event.target.dataset ? event.target.dataset.noorAct : null;
      if (act === "notify") askNotificationPermission(true);
      if (act === "reset") {
        shown.ids = [];
        shown.reflections = [];
        saveShown();
        showCard({
          title: "🌿 مسح السجل",
          body: "<p>سيتكرّر المحتوى نفسه مجدّدًا. لم يُمسّ شيء من تقدّمك في القراءة.</p>",
          autoClose: 5000,
        });
      }
    });
  }

  function statCell(label, name) {
    return '<div class="noor-stat"><b>' + arNum(statNumber(name)) + "</b><span>" + esc(label) + "</span></div>";
  }

  function notifyLabel() {
    if (!("Notification" in window)) return "الإشعارات غير مدعومة";
    if (Notification.permission === "granted") return "إشعارات المتصفح: مفعّلة";
    if (Notification.permission === "denied") return "الإشعارات محظورة من المتصفح";
    return "تفعيل إشعارات المتصفح";
  }

  /* ------------------------------------------ 17) إشعارات المتصفح (بموافقة)
   * لا تُطلب الإذن لحظة الدخول. نعرض بطاقة، فإن وافق طلبنا، وإن رفض لم
   * نعد ولا نتذكّره مرة أخرى.
   */
  function notificationsSupported() {
    return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  }

  function askNotificationPermission(explicit) {
    if (!notificationsSupported()) return;
    if (Notification.permission === "granted") {
      if (explicit) showCard({ title: "🔔", body: "<p>الإشعارات مفعّلة بالفعل.</p>", autoClose: 4000 });
      return;
    }
    if (Notification.permission === "denied") {
      if (explicit) {
        showCard({
          title: "🔔",
          body: "<p>المتصفح يمنع الإشعارات لهذا الموقع. بقية التذكيرات تعمل داخل الصفحة.</p>",
          autoClose: 6000,
        });
      }
      return;
    }
    if (explicit) {
      settings.notifAsked = true;
      saveSettings();
    }
    Notification.requestPermission().then(function (permission) {
      settings.notifAsked = true;
      saveSettings();
      log("تغيّر إذن الإشعارات:", permission);
      if (permission === "granted") {
        showCard({
          title: "🔔",
          body: "<p>فُعّلت التذكيرات. يمكنك إيقافها متى شئت من زر 🌿.</p>",
          autoClose: 5000,
        });
      } else {
        showCard({
          title: "🌿",
          body: "<p>لا بأس. التذكيرات ستبقى داخل الصفحة، ولن نطلب الإذن مرة أخرى.</p>",
          autoClose: 6000,
        });
      }
    }).catch(function () { /* رفض المتصفح أو سياق غير آمن */ });
  }

  /** يمرّر الإشعار عبر عامل الخدمة القائم ليعمل وهو في الخلفية. */
  function pushNotification(entry) {
    if (!notificationsSupported() || Notification.permission !== "granted") return false;
    var labels = (content && content.typeLabels) || {};
    var payload = {
      title: "🌿 " + (labels[entry.type] || "تذكير"),
      body: String(entry.text).slice(0, 120),
      tag: "noor-" + entry.id,
    };
    var controller = navigator.serviceWorker.controller;
    if (controller) {
      try {
        controller.postMessage({ type: "notify", url: entry.url || location.href, ...payload });
        return true;
      } catch (error) { /* يسقط إلى ما تحته */ }
    }
    try {
      new Notification(payload.title, { body: payload.body, tag: payload.tag });
      return true;
    } catch (error) {
      return false;
    }
  }

  /* ======================================================== 18) محرّك التذكير
   * سلسلة `setTimeout` واحدة، لا `setInterval` ولا استطلاع للصفحة.
   * - لا مؤقّت يعمل والصفحة مخفية أو الوضع هادئ أو التذكير مطفأ.
   * - يُعاد الضبط بعد كل عرض، فلا يتراكم توقيت ولا تتضاعف الإشعارات.
   * - يُزاح التذكير إذا كان المستخدم يكتب أو يقرأ أو الإظهار أمامه.
   */
  var timer = null;
  var deferTimer = null;

  /** هل كانت استراحة آمنة للعرض الآن؟ */
  function canInterrupt() {
    if (document.hidden) return false;
    if (document.querySelector("dialog[open], .noor-backdrop")) return false;
    if (window.getSelection && String(window.getSelection()) !== "") return false;

    var el = document.activeElement;
    if (!el) return true;
    var tag = el.tagName;
    /* لا نقاطع من يكتب أو يستقبل إدخالًا، ولا منتقٍّ على شيء ما. */
    if (tag === "TEXTAREA" || tag === "SELECT" || tag === "INPUT") return false;
    if (el.isContentEditable) return false;

    /* في قارئ المصحف: انتظر حتى يتوقف المستخدم عن التمرير. */
    if (Date.now() - lastScroll < 12000) return false;
    return true;
  }

  var lastScroll = 0;
  function markActivity() {
    lastScroll = Date.now();
  }

  function clearTimers() {
    if (timer) clearTimeout(timer);
    if (deferTimer) clearTimeout(deferTimer);
    timer = null;
    deferTimer = null;
  }

  /** يعيد بناء التوقيت من الصفر وفق الإعدادات الحالية. */
  function schedule() {
    clearTimers();
    if (!settings.enabled || settings.quiet || !content) return;
    var minutes = Math.max(1, settings.interval || 5);
    /* زحافة ±١٠٪: لا آلة في التوقيت، ولا نبضة منتظمة تثير الانتباه. */
    var jitter = 1 + (Math.random() - 0.5) * 0.2;
    var wait = Math.round(minutes * 60000 * jitter);
    timer = setTimeout(fire, wait);
    log("ضُبط التذكير بعد", Math.round(wait / 1000), "ثانية");
  }

  function defer() {
    if (deferTimer) return;
    log("التذكير مؤجَّل: المستخدم مشغول");
    deferTimer = setTimeout(function () {
      deferTimer = null;
      if (!settings.enabled || settings.quiet || document.hidden) return;
      fire();
    }, DEFER_MS);
  }

  function fire() {
    timer = null;
    if (!settings.enabled || settings.quiet || !content) return;
    if (document.hidden || dailyCapReached()) {
      schedule();
      return;
    }
    if (!canInterrupt()) {
      defer();
      schedule();
      return;
    }
    loadContent(function (loaded) {
      if (!loaded) return;
      var entry = pickReminder(contextOf().topics, shown.todayCount);
      if (!entry) {
        log("لا محتوى متاح بعد استبعاد المكرر");
        return;
      }
      noteShown(entry.id, false);
      bump("reminders");
      showCard({
        title: "🌿 تذكير إيماني",
        body: itemMarkup(entry),
        autoClose: 16000,
        footer: entry.url
          ? '<a class="noor-btn" href="' + esc(BASE + entry.url) + '">قراءة المزيد</a>'
          : "",
        buttons: [{ label: "حسنًا", primary: true }],
      });
      if (notificationsSupported() && Notification.permission === "granted") {
        pushNotification(entry);
      }
      schedule();
    });
  }

  /* ================================================== 19) رسائل اليوم والبداية
   * أول زيارة: ترحيب واحد، بطاقة صغيرة لا لوح. لوحٌ يحجب الصفحة كلها،
   * فيُفسد تجربة أول زيارة ويمنع استعمال الموقع. ثم رسالة اليوم. لا أكثر.
   */
  function showOnboarding() {
    settings.onboarded = true;
    saveSettings();
    var answered = false;
    showCard({
      title: "🌿 مرحبًا بك في رفيق النور",
      body: "<p>سنذكّرك بالخير أثناء رحلتك في الموقع، ويمكنك إيقاف التذكيرات في أي وقت.</p>",
      buttons: [
        {
          label: "ابدأ",
          primary: true,
          action: function () {
            answered = true;
            schedule();
            if (notificationsSupported() && !settings.notifAsked) offerNotifications();
          },
        },
        {
          label: "ليس الآن",
          action: function () {
            answered = true;
            settings.notifAsked = true;
            saveSettings();
          },
        },
      ],
      onClose: function () {
        /* أُغلقت بلا اختيار: لا نلحّ على الإذن في جلسةٍ أخرى. */
        if (!answered) settings.notifAsked = true;
        saveSettings();
        schedule();
      },
    });
    log("بطاقة الترحيب");
  }

  /** بطاقة صغيرة تسأل عن الإشعارات، تُعرض مرة واحدة بعد موافقة الترحيب. */
  function offerNotifications() {
    if (!notificationsSupported()) return;
    if (settings.notifAsked) return;
    if (Notification.permission !== "default") {
      settings.notifAsked = true;
      saveSettings();
      return;
    }
    showCard({
      title: "🔔 هل تريد تفعيل التذكيرات الإيمانية؟",
      body: "<p>يمكنك الحصول على تذكير إيماني أثناء استخدام الموقع، حتى والصفحة في الخلفية.</p>",
      buttons: [
        {
          label: "تفعيل التذكيرات",
          primary: true,
          action: function () {
            askNotificationPermission(true);
          },
        },
        {
          label: "ليس الآن",
          action: function () {
            settings.notifAsked = true;
            saveSettings();
          },
        },
      ],
    });
  }

  function showDailyMessage(force) {
    var today = todayKey();
    if (!force && settings.dailyShownOn === today) return;
    var topics = contextOf().topics;
    var entry = pickReminder(topics.concat(["khutbah", "tadabbur"]), 3);
    if (!entry) return;
    noteShown(entry.id, false);
    settings.dailyShownOn = today;
    saveSettings();

    var labels = (content && content.typeLabels) || {};
    var title =
      (entry.type === "verse" ? "🌿 آية اليوم" : "🌿 رسالة اليوم") +
      (labels[entry.type] ? "" : "");
    showCard({
      title: title,
      body: itemMarkup(entry),
      autoClose: 20000,
      buttons: [{ label: "بارك الله فيك", primary: true }],
    });
    log("رسالة اليوم:", entry.id);
  }

  /* ======================================================= 20) التدبر والعبرة
   * يُستدعى من دالة التقدّم القائمة في المصحف، لا من نظام موازٍ.
   */
  function observeReading(position) {
    if (!position || !settings.enabled) return;
    var surah = Number(position.surah);
    var ayah = Number(position.ayah);
    if (!surah || !ayah) return;
    markActivity();

    loadContent(function (loaded) {
      if (!loaded) return;
      var surahs = loaded.surahs || null;
      var meta = surahs ? surahs[surah - 1] : null;
      var total = meta ? meta.ayahCount : 0;
      /* نُكمل السورة عند بلوغ آخر آية فيها، لا قبلها. */
      if (!total || ayah < total) return;
      showReflection(surah);
    });
  }

  function showReflection(surah) {
    if (!settings.enabled || session.surahs.indexOf(surah) !== -1) return;
    session.surahs.push(surah);
    bump("surahs");

    var entry = pickReflection(surah);
    if (!entry) return;

    var topics = readingTopics(surah);
    var body = "";
    body += "<h3>" + esc(entry.title || "تدبر") + "</h3>";
    if (entry.type === "verse") {
      body += '<p class="noor-text is-quote">' + esc(entry.text) + "</p>";
      body += '<p class="noor-src">' + esc(entry.ref || entry.source) + "</p>";
    } else {
      body += "<p>" + esc(entry.text) + "</p>";
      if (entry.about) {
        var verse = item("v_" + entry.about.replace(":", "_"));
        if (verse) {
          body +=
            '<p class="noor-text is-quote" style="margin-top:10px">' + esc(verse.text) + "</p>" +
            '<p class="noor-src">' + esc(verse.ref) + "</p>";
        }
      }
    }

    /* عمل اليوم: اقتراح واحد أو اثنان من موضوع السورة، بلا حساب ولا نقاط. */
    rolloverActions();
    var pool = content.items.filter(function (candidate) {
      return candidate.type === "action" && hasTopic(candidate, topics);
    });
    var chosen = [];
    if (pool.length) {
      var first = pool[pickIndex(pool, surah)];
      chosen.push(first);
      if (pool.length > 1) {
        var rest = pool.filter(function (c) { return c.id !== first.id; });
        chosen.push(rest[pickIndex(rest, surah + 5)]);
      }
    }
    if (chosen.length) {
      body +=
        '<div class="noor-meta"><b>حوِّل القراءة إلى عمل</b>' +
        '<ul class="noor-list">' +
        chosen
          .filter(Boolean)
          .map(function (action) {
            return (
              '<li><input type="checkbox" data-noor-action="' + esc(action.id) + '" id="noor-act-' +
              esc(action.id) + '"><label for="noor-act-' + esc(action.id) + '">' +
              esc(action.text) + "</label></li>"
            );
          })
          .join("") +
        "</ul></div>";
    }

    body +=
      '<div class="noor-meta">' +
      "<b>" + esc(surahName(surah)) + "</b>" +
      '<span> — معرّفة: ' + topics.length + " موضوعًا في هذه السورة</span>" +
      "</div>";

    noteShown(entry.id, true);
    session.reflections += 1;
    bump("reflections");

    var sheet = openSheet("🌿 تدبر بعد القراءة", "عبرة وعمل، لا واجب.", body);
    if (!sheet) return;

    sheet.addEventListener("change", function (event) {
      var id = event.target.dataset ? event.target.dataset.noorAction : null;
      if (!id) return;
      var index = actions.chosen.indexOf(id);
      if (event.target.checked) {
        if (index === -1) actions.chosen.push(id);
        session.actions += 1;
        bump("actions");
      } else if (index !== -1) {
        actions.chosen.splice(index, 1);
      }
      saveActions();
      log("اختيار عمل:", id, event.target.checked);
    });

    sheet.addEventListener("click", function (event) {
      if (event.target.closest && event.target.closest("button")) {
        if (session.surahs.length >= 30) bump("parts");
      }
    });

    log("عرض تدبر للسورة", surah, "بمادة", entry.id);
  }

  function surahName(surah) {
    var meta = content && content.surahs ? content.surahs[surah - 1] : null;
    return meta ? meta.name : "سورة " + arNum(surah);
  }

  /** من صفحة الحفظ: السورة أُتمّت قراءةً أو حفظًا. */
  function markSurahDone(surah) {
    var id = Number(surah);
    if (!id) return;
    showReflection(id);
  }

  /* ==================================================== 21) حصيلة الجلسة
   * عند مغادرة الصفحة بعد جلسة ذات معنى. الأرقام بلا مبالغة، والرسالة
   * دعاء لا تقييم.
   */
  function summarizeSession(options) {
    var tearingDown = options && options.tearingDown;
    if (session.summarized) return;
    if (session.seconds < SESSION_MIN_SECONDS) return;
    if (!session.surahs.length && !session.reflections && !session.actions) return;
    session.summarized = true;

    bump("sessions");
    var lines = [];
    if (session.surahs.length) {
      lines.push(
        "<b>قرأت:</b> " +
          esc(session.surahs.map(surahName).join("، "))
      );
      lines.push("<b>وقت القراءة:</b> " + esc(sessionLabel()));
    }
    if (session.reflections) {
      lines.push("<b>تدبرت:</b> " + arNum(session.reflections) + " عبرة");
    }
    if (session.actions) {
      lines.push("<b>عمل صالح:</b> " + arNum(session.actions));
    }

    if (tearingDown) return;

    showCard({
      title: "🌙 حصيلة جلستك",
      body: '<p class="noor-meta" style="border:0;padding:0;margin-top:4px">' + lines.join("<br>") + "</p>",
      autoClose: 24000,
      buttons: [{ label: "تقبّل الله مني ومنك", primary: true }],
    });
    log("عرض حصيلة الجلسة");
  }

  /* ========================================================== 22) الإقلاع */

  function start() {
    injectStyle();
    mountGear();

    loadContent(function (loaded) {
      if (!loaded) {
        /* لا محتوى: لا timers ولا بطاقة ولا شيء. صمت كامل. */
        return;
      }
      index(loaded.items);
      log("جاهز:", loaded.items.length, "عنصرًا | نوع الصفحة:", contextOf().page);
      listeners.ready.forEach(function (fn) { safe(fn); });

      if (!settings.onboarded) {
        showOnboarding();
        return;
      }
      showDailyMessage();
      schedule();
      if (!settings.notifAsked && notificationsSupported()) {
        setTimeout(offerNotifications, 20000);
      }
    });

    /* نشاط المستخدم: عدّاد الوقت، وتأجيل التذكير أثناء القراءة. */
    ["scroll", "pointerdown", "keydown"].forEach(function (type) {
      window.addEventListener(type, markActivity, { passive: true, capture: true });
    });

    /* عدّ الثواني بلا مؤقّت: من آخر طابع زمني عند العودة للصفحة. */
    var lastTick = Date.now();
    function tick() {
      var now = Date.now();
      var delta = Math.round((now - lastTick) / 1000);
      if (!document.hidden && delta > 0 && delta < 600) session.seconds += delta;
      lastTick = now;
    }
    setInterval(tick, 15000);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        summarizeSession();
        clearTimers();
      } else {
        schedule();
      }
    });
    window.addEventListener("pagehide", function () { summarizeSession({ tearingDown: true }); });
  }

  /* ========================================================= 23) الواجهة العامة */
  function publicApi() {
    return {
      /* يقرأه الموقع القائم: دالة التقدّم في المصحف تناديه. */
      observeReading: observeReading,
      markSurahDone: markSurahDone,
      /* للتشخيص والإحصاءات. */
      getSettings: function () {
        return JSON.parse(JSON.stringify(settings));
      },
      getStats: function () {
        return {
          sessions: statNumber("sessions"),
          parts: statNumber("parts"),
          surahs: statNumber("surahs"),
          reflections: statNumber("reflections"),
          actions: statNumber("actions"),
          reminders: statNumber("reminders"),
          azkar: azkarTotal(),
        };
      },
      getActions: function () {
        rolloverActions();
        return JSON.parse(JSON.stringify(actions));
      },
      openSettings: openSettingsSheet,
      showDailyMessage: showDailyMessage,
      notify: askNotificationPermission,
      on: on,
      /* للتشغيل اليدوي من وحدة ES إن احتاج أحد. */
      start: start,
      /* --- ما تحتاجه صفحة الإعدادات دون أن تلمس التخزين --- */
      updateSettings: function (patch) {
        if (!patch || typeof patch !== "object") return settings;
        if (typeof patch.enabled === "boolean") settings.enabled = patch.enabled;
        if (typeof patch.quiet === "boolean") settings.quiet = patch.quiet;
        if (typeof patch.onboarded === "boolean") settings.onboarded = patch.onboarded;
        if (INTERVALS.some(function (i) { return i.value === patch.interval; })) {
          settings.interval = patch.interval;
        }
        if (patch.types && typeof patch.types === "object") {
          REMINDER_TYPES.forEach(function (type) {
            if (typeof patch.types[type] === "boolean") settings.types[type] = patch.types[type];
          });
        }
        saveSettings();
        if (patch.enabled === false || patch.quiet === true || patch.interval != null) schedule();
        return settings;
      },
      listActions: function () {
        if (!content) return [];
        return content.items.filter(function (entry) { return entry.type === "action"; });
      },
      toggleAction: function (id, on) {
        if (!isString(id)) return actions;
        rolloverActions();
        var index = actions.chosen.indexOf(id);
        if (on && index === -1) {
          actions.chosen.push(id);
          bump("actions");
        } else if (!on && index !== -1) {
          actions.chosen.splice(index, 1);
        }
        saveActions();
        return actions;
      },
      /** يمسح سجلّ العرض فقط: لا يمسّ تقدّم القراءة ولا اختيار الأعمال. */
      clearHistory: function () {
        shown.ids = [];
        shown.reflections = [];
        shown.todayCount = 0;
        saveShown();
        log("مُسح سجلّ العرض بطلب المستخدم");
        return true;
      },
      /** لصفحة الإعدادات: يُستدعى مرّة بعد جلب المحتوى. */
      markReady: function () {
        listeners.ready.forEach(function (fn) { safe(fn); });
      },
    };
  }

  /* الإقلاع تلقائيًّا: يكفي وسم واحد في كل صفحة. */
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }

  return publicApi();
});
