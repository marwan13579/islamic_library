"use strict";

/**
 * الإشعارات التلقائية — تشتغل بلا زرّ.
 * تحرس هذه الاختبارات ثلاثة أشياء هي كل ما طُلب:
 *   1) الإذن يُطلب وحده: أوّلًا عند فتح الصفحة، ثم عند أوّل لمسة.
 *   2) إشعار ترحيب يخرج في كل فتح للموقع، بلا تذكّر بين الفتحات.
 *   3) جدول الأذان يُدفع إلى المتصفّح ليرنّ بعد إغلاق الموقع.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const load = (rel) => import(path.join(ROOT, rel));

/** @type {Map<string, string>} ذاكرة جلسة مزيفة، تُصفَّر مع كل اختبار */
let session = new Map();

/** @type {{ permission: string, asked: number, shown: any[] }} */
let notif;

/** عامل خدمة يجمع ما يصله. */
function recorder() {
  const posted = [];
  const worker = { postMessage: (data) => posted.push(data) };
  return { posted, worker, registration: { active: worker } };
}

/**
 * يهيّئ بيئة متصفّح مصغّرة تكفي للوحدة.
 * @param {{ permission?: string }} [options]
 */
function stubBrowser(options = {}) {
  const listeners = new Map();
  session = new Map();
  notif = { permission: options.permission ?? "default", asked: 0, shown: [] };

  global.Notification = class {
    constructor(title, opts) {
      notif.shown.push({ title, ...opts });
    }
    static requestPermission() {
      notif.asked += 1;
      notif.permission = "granted";
      return Promise.resolve("granted");
    }
  };
  Object.defineProperty(global.Notification, "permission", {
    configurable: true,
    get: () => notif.permission,
  });

  global.window = {
    isSecureContext: true,
    matchMedia: () => ({ matches: false }),
    navigator: { userAgent: "node-test" },
    // في المتصفّح Notification خاصيةٌ على النافذة نفسها، والنصّ يفحصها.
    Notification: global.Notification,
    addEventListener: (type, handler) => {
      listeners.set(type, [...(listeners.get(type) ?? []), handler]);
    },
    removeEventListener: (type, handler) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((row) => row !== handler));
    },
  };
  global.document = { getElementById: () => null, visibilityState: "visible" };
  Object.defineProperty(global, "navigator", {
    configurable: true,
    writable: true,
    value: {
      userAgent: "node-test",
      platform: "",
      maxTouchPoints: 0,
      serviceWorker: {
        controller: null,
        // لا ينتهي أبدًا إلا إذا ربطه الاختبار: العامل غير النشط لا يستقبل.
        ready: new Promise(() => {}),
        register: async () => ({ addEventListener() {} }),
      },
    },
  });
  global.sessionStorage = {
    getItem: (key) => session.get(key) ?? null,
    setItem: (key, value) => session.set(key, value),
    removeItem: (key) => session.delete(key),
  };
  global.location = {
    pathname: "/src/app/app.html",
    href: "https://example.test/src/app/app.html",
  };
  return {
    emit(type, event = {}) {
      for (const handler of listeners.get(type) ?? []) handler(event);
    },
    count: (type) => (listeners.get(type) ?? []).length,
  };
}

test("🔔 الإذن يُطلب وحده: عند الفتح أوّلًا، ثم عند أوّل لمسة", async () => {
  const env = stubBrowser();
  const { posted, worker, registration } = recorder();
  global.navigator.serviceWorker.controller = worker;
  global.navigator.serviceWorker.ready = Promise.resolve(registration);

  const notify = await load("src/lib/auto-notify.js");
  assert.equal(notify.granted(), false);

  /* فتح الصفحة يجرّب الطلب بلا لمسة: من يقبله صامتًا انتهى الأمر عنده. */
  await notify.askOnLoad();
  assert.equal(notif.asked, 1, "لم يُطلب الإذن عند الفتح");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(notify.granted(), true, "رُفض الإذن بلا لمسة");
  assert.ok(posted.some((row) => row.type === "greet"), "لم يُعرض إشعار بعد المنح");

  /* المتصفّحات التي أهملت الرمي: أوّل لمسة هي نافذتها الوحيدة. */
  session = new Map();
  notif.permission = "default";
  notify.arm();
  assert.equal(env.count("pointerdown"), 1, "لم تُراقَب أوّل لمسة");

  env.emit("pointerdown");
  assert.equal(notif.asked, 2, "أوّل لمسة لا تطلب الإذن");
  await new Promise((resolve) => setTimeout(resolve, 0));

  /* ولمسةٌ ثانية لا تطلب مرّة أخرى، وقد فُكّت المراقبة. */
  env.emit("pointerdown");
  assert.equal(notif.asked, 2, "طُلب الإذن مرّة أخرى");
  assert.equal(env.count("pointerdown"), 0, "بقيت المراقبة بعد الطلب");
});

test("👋 إشعار ترحيب في كل فتح للموقع، بلا تذكّر بين الفتحات", async () => {
  const env = stubBrowser({ permission: "granted" });
  const { posted, worker, registration } = recorder();
  global.navigator.serviceWorker.controller = worker;
  global.navigator.serviceWorker.ready = Promise.resolve(registration);

  const notify = await load("src/lib/auto-notify.js");
  assert.equal(await notify.greet(), true, "لم يُعرض الترحيب");
  assert.equal(posted.length, 1);
  assert.equal(posted[0].type, "greet", "الترحيب يمرّ عبر عامل الخدمة");

  /* طلبٌ ثانٍ في الفتح نفسه (الإقلاع ثم أوّل لمسة) = إشعار واحد. */
  assert.equal(await notify.greet(), false, "تكرّر الترحيب في الفتح الواحد");
  assert.equal(posted.length, 1);

  /* فتحٌ جديد (جلسة جديدة) = ترحيبٌ جديد، في كل مرة بلا استثناء. */
  session = new Map();
  assert.equal(await notify.greet(), true, "لم يُرحَّب في فتح جديد");
  assert.equal(posted.length, 2);
  assert.equal(env.count("pointerdown"), 0);
});

test("🕌 جدول الأذان يُدفع إلى المتصفّح ليعمل بعد إغلاق الموقع", async () => {
  stubBrowser({ permission: "granted" });
  const { posted, worker, registration } = recorder();
  global.navigator.serviceWorker.controller = worker;
  global.navigator.serviceWorker.ready = Promise.resolve(registration);

  const storage = await load("src/lib/storage.js");
  storage.write(storage.KEYS.athanNotifOff, false);
  storage.write(storage.KEYS.athanTimings, {
    Fajr: "04:12 (EET)",
    Dhuhr: "12:38 (EET)",
    Asr: "16:02 (EET)",
    Maghrib: "19:41 (EET)",
    Isha: "21:10 (EET)",
  });

  const notify = await load("src/lib/auto-notify.js");
  assert.equal(await notify.pushPrayerSchedule(), true, "لم يُدفع الجدول");

  const message = posted.find((row) => row.type === "schedule-athan");
  assert.ok(message, "لم تصل رسالة الجدولة");
  assert.equal(message.schedule.length, 5, "ناقص صلاة من الجدول");
  for (const entry of message.schedule) {
    assert.ok(entry.at > Date.now(), `${entry.key} في الماضي`);
    assert.ok(entry.name, "صلاة بلا اسم");
  }

  /* الإيقاف اختيار محفوظ: لا نعيد جدولة ما أوقفه المستخدم. */
  storage.write(storage.KEYS.athanNotifOff, true);
  posted.length = 0;
  assert.equal(await notify.pushPrayerSchedule(), false, "جُدول الأذان وهو موقوف");
  assert.deepEqual(posted, []);
  storage.remove(storage.KEYS.athanNotifOff);
});

test("🚪 كل صفحة تُقلع النظام عند الدخول بلا زرّ", () => {
  const pages = {
    "index.html": /import\(["']\.\/src\/lib\/auto-notify\.js["']\)/,
    "src/app/app.js": /from "\.\.\/lib\/auto-notify\.js"/,
    "src/site/site.js": /from "\.\.\/lib\/auto-notify\.js"/,
  };
  for (const [page, pattern] of Object.entries(pages)) {
    const source = fs.readFileSync(path.join(ROOT, page), "utf8");
    assert.match(source, pattern, `${page} لا تستدعي النظام التلقائي`);
  }

  /* وكل واحدة تستدعيه فعلًا عند الإقلاع، لا في تعريفٍ لا يُنفَّذ. */
  for (const page of ["src/app/app.js", "src/site/site.js"]) {
    const source = fs.readFileSync(path.join(ROOT, page), "utf8");
    assert.match(source, /autoNotify\.boot\(|bootAutoNotify\(/, `${page} لا تُقلع النظام`);
  }
});