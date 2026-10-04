"use strict";

/**
 * اختبارات محرك الرفيق اليومي (daily-companion.js).
 *
 * المحرّك لا يعرف شيئًا عن الصفحة، فيُختبر وحده: المواقيت، والورد،
 * والأيام المتتالية، والمشاركة، والتذكيرات. كل اختبار يثبّت `localStorage`
 * في ذاكرةٍ نظيفة فلا يترك أثرًا بين الملفات.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { beforeEach } = require("node:test");

const ROOT = path.join(__dirname, "..");
const dc = require("../daily-companion.js");

/** تخزينٌ مؤقّت في الذاكرة يحاكي localStorage. */
function useMemoryStorage() {
  const map = new Map();
  globalThis.localStorage = {
    get length() { return map.size; },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => map.set(String(k), String(v)),
    removeItem: (k) => map.delete(String(k)),
    clear: () => map.clear(),
  };
  return map;
}

useMemoryStorage();
globalThis.IslamicCalculations = require("../calculations.js");

// كل اختبار يبدأ بتخزينٍ نظيف، فلا يسرّب مفتاحٌ إلى الذي يليه.
beforeEach(() => {
  useMemoryStorage();
});

test("مفتاح اليوم بالتوقيت المحلي لا يتأثر بتوقيت UTC", () => {
  assert.equal(dc.dateKey(new Date(2026, 0, 1, 0, 5)), "2026-01-01");
  assert.equal(dc.dateKey(new Date(2026, 0, 1, 23, 55)), "2026-01-01");
  assert.equal(dc.shiftKey("2026-02-28", 1), "2026-03-01");
  assert.equal(dc.fromKey("2026-13-40"), null);
});

test("العدّ التنازلي يعطي hh:mm:ss فوق الساعة ودقائق تحتها", () => {
  assert.equal(dc.countdown(7000), "00:07");
  assert.equal(dc.countdown(3723000), "01:02:03");
  assert.equal(dc.countdown(0), "00:00");
  assert.equal(dc.countdown(-5), "00:00");
});

test("خطط الورد تقسم المصحف بأيامها وتقبل المخصصة", () => {
  assert.equal(dc.planById("khatma7").pages, 87);
  assert.equal(dc.planById("khatma15").pages, 41);
  assert.equal(dc.planById("khatma30").pages, 21);
  assert.equal(dc.planById("khatma60").pages, 11);
  assert.equal(dc.planById("small").pages, 2);
  assert.equal(dc.planById("مجهول"), null);

  const custom = dc.startPlan("custom", { pagesPerDay: 7, totalPages: 100 });
  assert.equal(custom.pagesPerDay, 7);
  assert.equal(dc.getPlan().totalPages, 100);
  assert.equal(dc.startPlan("custom", { pagesPerDay: 0 }), null);
  assert.equal(dc.startPlan("custom", { pagesPerDay: "كثير" }), null);
});

test("صفحة المصحف ٦٠٤ وخطة الختمة لا تتجاوزها", () => {
  assert.equal(dc.QURAN_PAGES, 604);
  dc.startPlan("small", {});
  assert.equal(dc.logPages(9999), 604);
  assert.equal(dc.wirdState().done, 2);
});

test("الورد يحسبgoal والمنجَز والمتبقّي ونسبة الإنجاز", () => {
  dc.startPlan("medium", {}); // ٤ صفحات
  assert.equal(dc.wirdState().goal, 4);
  assert.equal(dc.wirdState().complete, false);

  dc.logPages(2);
  let state = dc.wirdState();
  assert.equal(state.done, 2);
  assert.equal(state.remainingToday, 2);
  assert.equal(state.percent, 50);
  assert.equal(state.complete, false);

  dc.logPages(3);
  state = dc.wirdState();
  assert.equal(state.doneRaw, 5);
  assert.equal(state.remainingToday, 0);
  assert.equal(state.percent, 100);
  assert.equal(state.complete, true);
});

test("لا خطة = لا ورد، والتسجيل بلا خطة لا ينشئها", () => {
  dc.resetPlan("medium", {});
  localStorage.clear();
  assert.equal(dc.getPlan(), null);
  assert.equal(dc.wirdState().active, false);
  dc.logPages(3);
  assert.equal(dc.getPlan(), null);
  assert.equal(dc.getStreak().current, 0);
});

test("إيقاف الخطة واستئنافها يحفظان السجلّ", () => {
  dc.resetPlan("medium", {});
  dc.logPages(4);
  const paused = dc.pausePlan();
  assert.equal(paused.paused, true);
  assert.equal(dc.getPlan().paused, true);
  assert.equal(dc.resumePlan().paused, false);
  assert.equal(dc.todayPages(), 4);
});

test("إعادة الضبط تصفّر تقدّم الخطة ولا تمسّ ما قبلها", () => {
  localStorage.clear();
  const yesterday = dc.shiftKey(dc.dateKey(), -1);
  localStorage.setItem("dc-log", JSON.stringify({ [yesterday]: 10, [dc.dateKey()]: 4 }));
  dc.startPlan("medium", {});
  dc.resetPlan("medium", {});
  const log = dc.getLog();
  assert.equal(log[yesterday], 10, "ما قبل بدء الخطة يبقى");
  assert.equal(log[dc.dateKey()], undefined, "تقدّم هذه الخطة صُفّر");
});

test("الأيام المتتالية تُعدّ ولا تكذب على يومٍ لم يُنجَز", () => {
  localStorage.clear();
  dc.startPlan("small", {}); // صفحتان
  assert.equal(dc.syncStreak().current, 0);

  dc.logPages(2);
  assert.equal(dc.syncStreak().current, 1);

  // نثبّت سجلّ يومين متتاليين فنحاكي استمرارًا، ثم نترك فجوةً فيتنكسر.
  const base = dc.dateKey();
  localStorage.setItem("dc-log", JSON.stringify({
    [dc.shiftKey(base, -1)]: 2,
    [base]: 2,
  }));
  assert.equal(dc.syncStreak().current, 2);
  assert.equal(dc.getStreak().best, 2);

  localStorage.setItem("dc-log", JSON.stringify({ [base]: 2 }));
  assert.equal(dc.syncStreak().current, 1, "انقطاع السلسلة يعيد العدّ");
});

test("أفضل سلسلة محفوظة ولا تنقص مع الانقطاع", () => {
  const base = dc.dateKey();
  localStorage.setItem("dc-plan", JSON.stringify({ id: "small", pagesPerDay: 2, totalPages: 604, startKey: dc.shiftKey(base, -5), paused: false }));
  localStorage.setItem("dc-log", JSON.stringify({
    [dc.shiftKey(base, -3)]: 2,
    [dc.shiftKey(base, -2)]: 2,
    [dc.shiftKey(base, -1)]: 2,
  }));
  assert.equal(dc.syncStreak().current, 3);
  assert.equal(dc.getStreak().best, 3);

  localStorage.setItem("dc-log", JSON.stringify({ [base]: 1 }));
  assert.equal(dc.syncStreak().current, 0);
  assert.equal(dc.getStreak().best, 3, "أفضل سلسلة تبقى محفوظة");
});

test("سجلّ الأسبوع سبعة أيام بالترتيب", () => {
  localStorage.clear();
  dc.startPlan("small", {});
  const week = dc.weekHistory();
  assert.equal(week.length, 7);
  assert.equal(week[0].key, dc.shiftKey(dc.dateKey(), -6));
  assert.equal(week[6].key, dc.dateKey());
  assert.equal(week[6].done, false);
  dc.logPages(2);
  assert.equal(dc.weekHistory()[6].done, true);
});

test("سجلّ الورد ينقّى القيم غير الصالحة ولا يتجاوز المصحف", () => {
  localStorage.clear();
  localStorage.setItem("dc-log", JSON.stringify({
    "2026-01-01": 5,
    "bad-key": 3,
    "2026-01-02": -2,
    "2026-01-03": "أربع",
    "2026-01-04": 9999,
  }));
  const log = dc.getLog();
  assert.deepEqual(Object.keys(log), ["2026-01-01", "2026-01-04"]);
  assert.equal(log["2026-01-04"], 604);
});

test("المواقيت مرتّبة من الفجر إلى العشاء، والصلاة الحالية تسبق القادمة مباشرة", () => {
  const now = new Date(2026, 0, 1, 12, 0);
  const state = dc.prayerState(now);
  assert.ok(state, "المواقيت تُحسب عبر IslamicCalculations");
  assert.deepEqual(state.all.map((p) => p.id), ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]);
  for (let i = 1; i < state.all.length; i += 1) {
    assert.ok(state.all[i].at > state.all[i - 1].at, "المواقيت متصاعدة");
  }
  // القادمة أوّل صلاةٍ بعد اللحظة، والحالية آخر صلاةٍ قبلها — بلا صلاة بينهما.
  assert.ok(state.next && state.next.at > now, "القائمة تصير بعد الآن");
  assert.ok(state.current && state.current.at <= now, "الحالية تصير قبل الآن أو عنده");
  assert.equal(state.all.indexOf(state.current) + 1, state.all.indexOf(state.next), "لا صلاة بينهما");
});

test("لا مكتبة مواقيت فلا انهيار: المواقيت null بدل رمي خطأ", () => {
  const saved = globalThis.IslamicCalculations;
  delete globalThis.IslamicCalculations;
  try {
    assert.equal(dc.prayerTimes(), null);
    assert.equal(dc.prayerState(), null);
  } finally {
    globalThis.IslamicCalculations = saved;
  }
});

test("الموقع وطريقة الحساب يُحفظان ويُرفض غيرهما", () => {
  localStorage.clear();
  assert.equal(dc.getLocation().lat, 30.0444);
  assert.equal(dc.getMethod().id, "mwl");
  assert.equal(dc.setLocation(21.4225, 39.8262, "مكة"), true);
  assert.equal(dc.getLocation().label, "مكة");
  assert.equal(dc.setLocation("شمال", 39, ""), false);
  assert.equal(dc.setMethod("makkah"), true);
  assert.equal(dc.getMethod().fajr, 18.5);
  assert.equal(dc.setMethod("method-x"), false);
  assert.equal(dc.getMethod().id, "makkah");
});

test("نصّ المشاركة يحوي النصّ والمصدر واسم الموقع والرابط", () => {
  globalThis.location = { origin: "https://example.com", pathname: "/index.html" };
  const text = dc.shareText({ emoji: "🌿", text: "آية", ref: "طه ١١٤" });
  assert.match(text, /آية/);
  assert.match(text, /المصدر: طه ١١٤/);
  assert.match(text, new RegExp(dc.SITE_NAME));
  assert.match(text, /https:\/\/example\.com\/index\.html/);
  assert.equal(dc.shareText(null), "");

  const targets = dc.shareTargets("نص");
  assert.match(targets.whatsapp, /^https:\/\/wa\.me\/\?text=/);
  assert.match(targets.telegram, /^https:\/\/t\.me\/share\/url\?url=/);
  assert.match(targets.facebook, /^https:\/\/www\.facebook\.com\/sharer/);
  assert.match(targets.x, /^https:\/\/twitter\.com\/intent\/tweet/);
});

test("المحفوظات تُضاف وتُزال بالمفتاح نفسه", () => {
  localStorage.clear();
  const item = { text: "أَلَا بِذِكْرِ اللَّهِ", ref: "الرعد ٢٨" };
  assert.equal(dc.isSaved("الرعد ٢٨"), false);
  assert.equal(dc.toggleSaved(item), true);
  assert.equal(dc.isSaved("الرعد ٢٨"), true);
  assert.equal(dc.toggleSaved(item), false);
  assert.equal(dc.getSaved()["الرعد ٢٨"], undefined);
});

test("التذكيرات مطفية افتراضيًا، والإذن لا يُطلب تلقائيًا", () => {
  localStorage.clear();
  const defaults = dc.getReminders();
  assert.equal(defaults.enabled, false);
  for (const name of ["wird", "morning", "evening", "daily"]) assert.equal(defaults[name].on, false);
  assert.equal(defaults.prayer, false);

  const next = dc.setReminders({ enabled: true, wird: { on: true, time: "05:30" } });
  assert.equal(next.wird.on, true);
  assert.equal(next.wird.time, "05:30");
  assert.equal(next.evening.on, false, "ما لم يُطلب يُبقى مطفيًا");
  assert.equal(dc.getReminders().enabled, true);

  dc.setReminders({ wird: { on: true, time: "غير وقت" } });
  assert.equal(dc.getReminders().wird.time, "05:30", "وقت غير صالح يُتجاهل");
});

test("لا دعم إشعارات = حالة صريحة لا استثناء", () => {
  const saved = globalThis.Notification;
  delete globalThis.Notification;
  try {
    assert.equal(dc.supportedNotifications(), false);
    assert.equal(dc.notificationPermission(), "unsupported");
    assert.equal(dc.showNotification("جملة", {}), false);
  } finally {
    globalThis.Notification = saved;
  }
});

test("jسر المحتوى المولَّد مطابق للمصدر وكل نصّ له مرجع", () => {
  const generated = fs.readFileSync(path.join(ROOT, "daily-content.js"), "utf8");
  const json = generated.match(/Object\.freeze\((\{[\s\S]*\})\);/);
  assert.ok(json, "daily-content.js يحمل كائن المحتوى");
  const content = JSON.parse(json[1]);

  for (const name of ["verses", "hadiths", "wisdom", "duas"]) {
    assert.ok(Array.isArray(content[name]) && content[name].length, `${name} غير فارغ`);
    for (const item of content[name]) {
      assert.ok(item.text, `${name}: نصّ مفقود`);
      assert.ok(item.ref, `${name}: مرجع مفقود — لا نصّ بلا مصدر`);
    }
  }
  assert.ok(
    content.duas.every((d) => typeof d.title === "string" && typeof d.cat === "string"),
    "لكل دعاء عنوان وتصنيف",
  );
});

test("اختيار المحتوى اليومي ثابت في اليوم ومتنوّع بين الأيام", () => {
  globalThis.DailyContent = {
    verses: [{ text: "آية ١", ref: "س ١" }, { text: "آية ٢", ref: "س ٢" }, { text: "آية ٣", ref: "س ٣" }],
    hadiths: [],
    wisdom: [],
    duas: [],
  };
  const day = new Date(2026, 4, 1);
  assert.equal(dc.dailyVerse(day).text, dc.dailyVerse(day).text);
  assert.equal(dc.dailyVerse(day).ref, dc.dailyVerse(day).ref);

  const seen = new Set();
  for (let i = 0; i < 30; i += 1) seen.add(dc.dailyVerse(new Date(2026, 4, 1 + i)).text);
  assert.ok(seen.size > 1, "يتغيّر المحتوى بين الأيام");
});

test("محتوى شاشة الإتمام من المصدر فقط: آية أو حديث أو فائدة أو دعاء", () => {
  globalThis.DailyContent = {
    verses: [{ text: "آية", ref: "طه ١١٤" }],
    hadiths: [{ text: "حديث", ref: "البخاري" }],
    wisdom: [{ text: "فائدة", ref: "السلف" }],
    duas: [{ text: "دعاء", ref: "مسلم", title: "دعاء", cat: "morning" }],
  };
  const pick = dc.completionPick(new Date(2026, 4, 1));
  assert.ok(pick);
  assert.ok(["آية للتدبر", "حديث صحيح", "فائدة", "دعاء"].includes(pick.kind));
  assert.ok(pick.text && pick.ref);

  globalThis.DailyContent = { verses: [], hadiths: [], wisdom: [], duas: [] };
  assert.equal(dc.completionPick(), null, "لا محتوى = لا اختراع");
});
test("كل روابط لوحة اليوم تشير إلى صفحات موجودة فعلًا", () => {
  const source = fs.readFileSync(path.join(ROOT, "daily-home.js"), "utf8");
  const hrefs = [...source.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(hrefs.length >= 15, `وجدنا ${hrefs.length} رابطًا فقط — المرجو مراجعة الاستخراج`);

  for (const href of hrefs) {
    assert.ok(
      !href.startsWith("http"),
      `رابط خارجي في لوحة اليوم: ${href}`,
    );
    const [file, hash] = href.split("#");
    if (!file) continue; // رابط داخلي مثل #sections
    assert.ok(fs.existsSync(path.join(ROOT, file)), `صفحة مفقودة: ${file}`);
    if (!hash) continue;
    // إن كان الرابط جزءًا من صفحة، فنتحقّق أن المُعرّف موجود فيها.
    const target = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.ok(
      target.includes(`id="${hash}"`) || target.includes(`id:'${hash}'`) || target.includes(`"${hash}"`),
      `مرساة مفقودة في ${file}: #${hash}`,
    );
  }
});

test("لوحة اليوم مثبّتة في index.html وتحترم لغته", () => {
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(index, /id="dcRoot"/, "مِركّب اللوحة موجود");
  assert.match(index, /daily-companion\.css/, "الأنماط محمّلة");
  assert.match(index, /daily-content\.js[\s\S]*daily-companion\.js[\s\S]*daily-home\.js/, "الترتيب: محتوى ثم محرّك ثم واجهة");
  assert.match(index, /<div id="dashboard">/, "لوحة الإحصاء القائمة لم تُحذف");
  assert.match(index, /id="sections"/, "فهرس الأدوات باقٍ");
  assert.match(index, /lib-theme-pref/, "مفتاح الوضع الليلي المشترك");
  assert.match(index, /<h1 id="siteTitle">/, "عنوان الصفحة لم يُستبدل");
});

test("عامل الخدمة يسجّل أصول اللوحة الجديدة", () => {
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  for (const asset of ["./daily-content.js", "./daily-companion.js", "./daily-home.js", "./daily-companion.css"]) {
    assert.ok(sw.includes(`"${asset}"`), `${asset} غير مسجّل في SHELL`);
  }
});

test("الروابط المختصرة لا تحجب ملفًا قائمًا ولا تشير إلى صفحة مفقودة", () => {
  const redirects = fs.readFileSync(path.join(ROOT, "_redirects"), "utf8");
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

  const rules = redirects
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [source, destination, status] = line.split(/\s+/);
      return { source, destination, status };
    });

  assert.ok(rules.length >= 10, `قواعد قليلة: ${rules.length}`);

  const vercelSources = vercel.redirects.map((r) => r.source);
  for (const rule of rules) {
    assert.equal(rule.status, "301", `${rule.source}: يجب أن يكون التحويل 301`);

    // لا يجوز أن يحجب مسارٌ ملفًا موجودًا فعلًا.
    assert.ok(!fs.existsSync(path.join(ROOT, rule.source.replace(/^\//, ""))),
      `${rule.source} مسار موجود بالفعل — سيحجبه التحويل`);

    const [file] = rule.destination.split("#");
    if (file === "/") continue;
    assert.ok(fs.existsSync(path.join(ROOT, file.replace(/^\//, ""))),
      `${rule.source} يشير إلى صفحة مفقودة: ${file}`);

    assert.ok(vercelSources.includes(rule.source),
      `${rule.source} موجود في _redirects وفيه يعمل، لكنه ناقص من vercel.json`);
  }

  for (const entry of vercel.redirects) {
    assert.ok(rules.some((rule) => rule.source === entry.source),
      `${entry.source} في vercel.json وغير موجود في _redirects`);
    assert.ok(entry.permanent === true, `${entry.source}: تحويل دائم فقط`);
  }
});

test("كل صفحة في sitemap موجودة فعلًا", () => {
  const prepare = fs.readFileSync(path.join(ROOT, "scripts/prepare-pages.cjs"), "utf8");
  const block = prepare.slice(prepare.indexOf("const SITE_PAGES = ["));
  const end = block.indexOf("];", block.indexOf("src/app/app.html"));
  const paths = [...block.slice(0, end).matchAll(/\["([^"]*)"/g)].map((m) => m[1]);
  assert.ok(paths.length >= 20, `صفحات قليلة في sitemap: ${paths.length}`);
  for (const pagePath of paths) {
    // المسار الفارغ هو الجذر، أي الصفحة الرئيسية.
    assert.ok(fs.existsSync(path.join(ROOT, pagePath || "index.html")), `صفحة sitemap مفقودة: ${pagePath}`);
  }
});

test("robots و sitemap يُولَّدان في مخرجات النشر", () => {
  const prepare = fs.readFileSync(path.join(ROOT, "scripts/prepare-pages.cjs"), "utf8");
  assert.match(prepare, /SITE_ORIGIN/, "النطاق قابل للضبط");
  assert.match(prepare, /sitemap\.xml/);
  assert.match(prepare, /robots\.txt/);
  assert.match(prepare, /entry\.name === "_redirects"/, "_redirects يُنسخ إلى dist");
});

test("بعد آخر صلاة لا تفرغ «القادمة»: تصير فجر الغد", () => {
  const lateNight = new Date(2026, 0, 1, 23, 30);
  const state = dc.prayerState(lateNight);
  assert.ok(state, "المواقيت تُحسب");
  assert.equal(state.tomorrow, true, "لنا أن الفجر القادم فجر الغد");
  assert.equal(state.next.id, "fajr");
  assert.ok(state.next.at > lateNight, "الفجر بعد اللحظة");
  assert.equal(state.current.id, "isha", "الحالية آخر صلاة اليوم");

  // وأ，白天: القادمة اليوم لا غدًا.
  const daytime = dc.prayerState(new Date(2026, 0, 1, 9, 0));
  assert.equal(daytime.tomorrow, false);
  assert.ok(daytime.next.at <= new Date(2026, 0, 2, 0, 0));
});
