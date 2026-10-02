"use strict";

/**
 * اختبار جدولة الأذان داخل العامل.
 *
 * العامل ليس وحدة تُستورَد، فتُحمَّل شيفرة `sw.js` في سياق مزيّف:
 * `self.addEventListener` يجمع المعالجات، و`setTimeout` يُختصر
 * فلا ننتظر خمس ساعات.
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
 * @param {{ timers?: any[] }} [options]
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
    clearTimeout: () => {},
    self: {
      addEventListener(type, fn) {
        (handlers[type] ||= []).push(fn);
      },
      skipWaiting() {},
      waitUntil() {},
      clients: {
        matchAll: async () => [{ postMessage: (m) => posted.push(m) }],
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
      open: async () => ({
        match: async () => undefined,
        put: async () => {},
        addAll: async () => {},
        keys: async () => [],
      }),
      match: async () => undefined,
    },
    fetch: async () => ({ ok: true, clone: () => ({}) }),
    Request: function Request() {},
    Response: function Response() {},
    __ticks: fired,
    __handlers: handlers,
  };
  sandbox.self.clients = sandbox.self.clients;

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "sw.js" });
  void options;
  return { sandbox, handlers, shown, posted, fired };
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