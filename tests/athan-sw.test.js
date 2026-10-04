"use strict";

/**
 * اختبار جدولة الأذان في العامل، وترحيب كل فتح.
 *
 * العامل ليس وحدة تُستورَد، فتُحمَّل شيفرة `sw.js` في سياق مزيّف:
 * `self.addEventListener` يجمع المعالجات، و`setTimeout` يُختصر
 * فلا ننتظر خمس ساعات، والمخازن تُعطى ذاكرةً فنرى ما يُحفَظ.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "sw.js"), "utf8");

/**
 * يشغّل `sw.js` في سياق عامل خدمة مزيّف.
 * @param {{ store?: Record<string, any> }} [options] ما في مخازن العامل
 */
function bootWorker(options = {}) {
  /** @type {Record<string, Function[]>} */
  const handlers = {};
  /** @type {any[]} */
  const shown = [];
  /** @type {any[]} */
  const posted = [];
  /** @type {any[]} */
  const fired = [];
  /** @type {any[]} */
  const cleared = [];
  /** @type {Record<string, any>} */
  const store = { ...(options.store || {}) };

  const sandbox = {
    console,
    URL,
    Promise,
    Date,
    JSON,
    setTimeout: (fn) => {
      fired.push(fn);
      return fired.length;
    },
    clearTimeout: (id) => cleared.push(id),
    self: {
      addEventListener(type, fn) {
        (handlers[type] ||= []).push(fn);
      },
      skipWaiting() {},
      waitUntil() {},
      clients: {
        matchAll: async () => [{ postMessage: (m) => posted.push(m) }],
        openWindow: async () => {},
      },
      registration: {
        scope: "https://example.test/",
        showNotification: async (title, opts) => {
          shown.push({ title, body: opts.body, tag: opts.tag });
        },
      },
    },
    clients: undefined,
    caches: {
      open: async (name) => ({
        match: async (url) => {
          const value = store[name]?.[String(url)];
          if (value === undefined) return undefined;
          return { json: async () => value };
        },
        put: async (url, response) => {
          // الاستجابةُ الحقيقية تحتاج Request/Response؛ فنقرأ JSON منها
          // كما تفعل Cache Storage: نصٌّ يُحلَّل.
          const text = await response.text();
          (store[name] ||= {})[String(url)] = JSON.parse(text);
        },
        addAll: async () => {},
        keys: async () => [],
      }),
      match: async () => undefined,
      keys: async () => Object.keys(store),
      delete: async () => true,
    },
    fetch: async () => ({ ok: true, clone: () => ({}) }),
    Request: function Request() {},
    Response: function Response(body) {
      this.text = async () => body;
      this.headers = { get: () => null };
    },
    __ticks: fired,
    __handlers: handlers,
  };
  sandbox.self.clients = sandbox.self.clients;

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "sw.js" });
  return { sandbox, handlers, shown, posted, fired, cleared, store };
}

/** يبني حدث رسالة كما يوصله `postMessage`. */
function messageEvent(data) {
  const waited = [];
  return {
    data,
    waitUntil: (promise) => waited.push(promise),
    __waited: waited,
  };
}

test("رسالة الجدولة تصل إلى العامل", () => {
  const { handlers } = bootWorker();
  assert.ok(handlers.message, "لا معالج رسائل في العامل");
  assert.ok(
    handlers.message.some((fn) => fn.toString().includes("schedule-athan")),
    "رسالة جدولة الأذان غير موصولة"
  );
});

test("خمس صلوات تُجدول، والمؤقّتات تُلغى قبل إعادة الجدولة", async () => {
  const { handlers, fired } = bootWorker();
  const send = handlers.message.find((fn) => fn.toString().includes("schedule-athan"));

  const at = Date.now() + 3600000;
  const first = messageEvent({
    type: "schedule-athan",
    schedule: ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map((key) => ({ key, name: key, at, href: "42-athan.html" })),
  });
  send(first);
  await Promise.all(first.__waited);
  assert.equal(fired.length, 5, `جُدول ${fired.length} من 5`);

  /* إعادة الجدولة تلغي ما سبق: المؤقّتات القديمة تُنشِظ بلا فائدة. */
  fired.length = 0;
  const second = messageEvent({ type: "schedule-athan", schedule: [{ key: "Fajr", name: "الفجر", at, href: "42-athan.html" }] });
  send(second);
  await Promise.all(second.__waited);
  assert.equal(fired.length, 1, `تكرّر الجدولة: ${fired.length}`);
});

test("صلاة ماضية لا تُجدول، فلا استيقاظ بلا سبب", async () => {
  const { handlers, fired } = bootWorker();
  const send = handlers.message.find((fn) => fn.toString().includes("schedule-athan"));
  const past = messageEvent({
    type: "schedule-athan",
    schedule: [{ key: "Isha", name: "العشاء", at: Date.now() - 60000, href: "42-athan.html" }],
  });
  send(past);
  await Promise.all(past.__waited);
  assert.equal(fired.length, 0);
});

test("حلّ الوقت يُعلن الإشعار ويُخبر الصفحة", async () => {
  const { handlers, fired, shown, posted } = bootWorker();
  const send = handlers.message.find((fn) => fn.toString().includes("schedule-athan"));

  const event = messageEvent({
    type: "schedule-athan",
    schedule: [{ key: "Fajr", name: "الفجر", at: Date.now() + 1000, href: "42-athan.html" }],
  });
  send(event);
  await Promise.all(event.__waited);
  assert.equal(fired.length, 1);

  fired[0]();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(shown.length, 1, "لم يظهر إشعار");
  assert.match(shown[0].title, /الفجر/);
  assert.equal(shown[0].tag, "athan-Fajr");
  assert.equal(posted.length, 1, "الصفحة المفتوحة لم تُخبر");
  /* الكائن آتٍ من سياق العامل المزيّف، فنقارن نصًّا لا هوية النموذج. */
  assert.equal(JSON.stringify(posted[0]), JSON.stringify({ type: "athan-now", name: "الفجر" }));
});

test("رسالة الإلغاء تمسح الجدولة", async () => {
  const { handlers, fired } = bootWorker();
  const send = handlers.message.find((fn) => fn.toString().includes("schedule-athan"));

  const event = messageEvent({
    type: "schedule-athan",
    schedule: [{ key: "Fajr", name: "الفجر", at: Date.now() + 60000, href: "42-athan.html" }],
  });
  send(event);
  await Promise.all(event.__waited);
  assert.equal(fired.length, 1);

  fired.length = 0;
  const cancel = messageEvent({ type: "cancel-athan" });
  const cancelFn = handlers.message.find((fn) => fn.toString().includes("cancel-athan"));
  cancelFn(cancel);
  await Promise.all(cancel.__waited);
  assert.equal(fired.length, 0);
});

test("رابط الإشعار يُحترم، والإشعار بلا رابط يعود لصفحة الصلاة", async () => {
  const { handlers, fired, shown } = bootWorker();
  const send = handlers.message.find((fn) => fn.toString().includes("schedule-athan"));
  const event = messageEvent({
    type: "schedule-athan",
    schedule: [{ key: "Asr", name: "العصر", at: Date.now() + 1000, href: "42-athan.html" }],
  });
  send(event);
  await Promise.all(event.__waited);
  fired[0]();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(shown.length);
});

/* ------------------------------ ترحيب كل فتح ------------------------------ */

/** حدث تنقّل كما يصل إلى معالج الجلب. */
function navigateEvent(path = "/4-salah.html") {
  const waited = [];
  return {
    request: { method: "GET", mode: "navigate", url: `https://example.test${path}` },
    respondWith: () => {},
    waitUntil: (promise) => waited.push(Promise.resolve(promise).catch(() => {})),
    __waited: waited,
  };
}

/** @param {Function[]} handlers */
function fetchHandler(handlers) {
  const fn = handlers.fetch[0];
  assert.ok(fn, "لا معالج جلب في العامل");
  return fn;
}

/**
 * ينفّذ معالج حدثٍ وينتظر ما علّقه: المعالجات لا تُعيد وعدها.
 * @param {Function} handler
 * @param {any} event
 */
async function run(handler, event) {
  let waited = null;
  handler({ ...event, waitUntil: (promise) => { waited = Promise.resolve(promise); } });
  await waited;
}

/**
 * معالج الاستيقاظ الذي يُعيد جدولة الأذان (آخرُ مسجَّل، فأوّلُهما
 * تنظيفُ الكاش).
 * @param {Record<string, Function[]>} handlers
 */
function activateHandler(handlers) {
  const fn = handlers.activate[handlers.activate.length - 1];
  assert.ok(fn, "لا معالج استيقاظ في العامل");
  return fn;
}

test("👋 كل فتح للموقع يُخرج ترحيبًا، ولو كانت الصفحة نائمة", async () => {
  const { handlers, shown } = bootWorker();
  const onFetch = fetchHandler(handlers);

  const first = navigateEvent("/index.html");
  onFetch(first);
  await Promise.all(first.__waited);

  assert.equal(shown.length, 1, "لم يخرج ترحيب مع فتح الموقع");
  assert.equal(shown[0].tag, "noor-greet");
  assert.match(shown[0].body, /\S/, "الترحيب بلا نصّ");

  /* فتحٌ بعده بزمنٍ قصير: الفاصل بين ترحيبَين، فلا إشعار ثانٍ. */
  const second = navigateEvent("/30-quran-full.html");
  onFetch(second);
  await Promise.all(second.__waited);
  assert.equal(shown.length, 1, "تكرّر الترحيب لفتحين متجاورين");
});

test("👆 نقرُ الإشعار يفتح الموقع فلا يُرحَّب به مرّتين", async () => {
  const { handlers, shown } = bootWorker();
  const onFetch = fetchHandler(handlers);
  const onClick = handlers.notificationclick[0];

  const opening = navigateEvent("/index.html");
  onFetch(opening);
  await Promise.all(opening.__waited);
  assert.equal(shown.length, 1);

  const clicked = {
    notification: { close() {}, data: { url: "https://example.test/index.html" } },
    waitUntil: () => {},
  };
  onClick(clicked);
  const afterClick = navigateEvent("/index.html");
  onFetch(afterClick);
  await Promise.all(afterClick.__waited);
  assert.equal(shown.length, 1, "رحّب به على الصفحة التي فتحها بنفسه");
});

/* ------------------------- الجدول بعد إغلاق الموقع ------------------------- */

test("📅 جدول الأمس يُؤخَّر إلى اليوم، فلا يسقط بعد آخر صلاة", async () => {
  const yesterday = Date.now() - 20 * 60 * 60 * 1000;
  const { handlers, fired, store } = bootWorker({
    store: {
      "athan-schedule": {
        "https://example.test/__athan": [
          { key: "Fajr", name: "الفجر", at: yesterday, href: "42-athan.html" },
          { key: "Isha", name: "العشاء", at: yesterday + 3600000, href: "42-athan.html" },
        ],
      },
    },
  });

  await run(activateHandler(handlers), {});
  assert.equal(fired.length, 2, `جُدول ${fired.length} من 2 بعد يوم كامل مغلق`);

  /* والحفظ يتبع التأخير: فمتى استيقظ العامل غدًا يجد يومه لا أمسه. */
  const saved = store["athan-schedule"]["https://example.test/__athan"];
  for (const entry of saved) assert.ok(entry.at > Date.now(), `${entry.key} ما زال في الماضي`);
});

test("⏰ أذانٌ فات ونام الجهاز يُعلَن عند الاستيقاظ المجدول، مرّةً واحدة", async () => {
  const missed = Date.now() - 5 * 60 * 1000;
  const { handlers, shown, posted } = bootWorker({
    store: {
      "athan-schedule": {
        "https://example.test/__athan": [{ key: "Asr", name: "العصر", at: missed, href: "42-athan.html" }],
      },
    },
  });

  /* استيقاظٌ لا فتحَ فيه: المتصفّح يوقظ العامل كل ساعتين هكذا. */
  const sync = handlers.periodicsync[0];
  await run(sync, { tag: "athan-check" });
  assert.equal(shown.length, 1, "لم يُعلَن الأذان الفائت");
  assert.match(shown[0].title, /العصر/);
  assert.equal(posted.length, 1, "الصفحة المفتوحة لم تُخبر");

  /* استيقاظٌ ثانٍ: الأذان نفسه يُعلَن مرّةً واحدة لا مرّتين. */
  await run(sync, { tag: "athan-check" });
  assert.equal(shown.length, 1, "تكرّر إعلان الأذان الفائت");

  /* ووسمٌ لا يخصّ الأذان لا يُخرج شيئًا. */
  await run(sync, { tag: "something-else" });
  assert.equal(shown.length, 1, "أُعلن أذانٌ بوسمٍ لا يخصّه");
});

test("♻️ كل فتحٍ يُعيد جدولة الأذان ويُلغي المؤقّتات السابقة", async () => {
  const at = Date.now() + 3600000;
  const { handlers, fired, cleared } = bootWorker({
    store: {
      "athan-schedule": {
        "https://example.test/__athan": [
          { key: "Fajr", name: "الفجر", at, href: "42-athan.html" },
          { key: "Isha", name: "العشاء", at: at + 3600000, href: "42-athan.html" },
        ],
      },
    },
  });

  await run(activateHandler(handlers), {});
  assert.equal(fired.length, 2, "لم تُشدّ المؤقّتات");
  assert.equal(cleared.length, 0);

  const opening = navigateEvent("/index.html");
  fetchHandler(handlers)(opening);
  await Promise.all(opening.__waited);

  assert.equal(cleared.length, 2, `أُلغي ${cleared.length} من 2: المؤقّتات القديمة حيّة`);
  assert.equal(fired.length, 4, `جُدول ${fired.length - 2} جديدًا`);
});

test("🕐 أذانٌ قد فات بيومٍ لا يُعلَن عند الاستيقاظ", async () => {
  const longGone = Date.now() - 20 * 60 * 60 * 1000;
  const { handlers, shown } = bootWorker({
    store: {
      "athan-schedule": {
        "https://example.test/__athan": [{ key: "Fajr", name: "الفجر", at: longGone, href: "42-athan.html" }],
      },
    },
  });

  await run(handlers.periodicsync[0], { tag: "athan-check" });
  assert.equal(shown.length, 0, "أُعلن أذانٌ فات منذ يوم");
});