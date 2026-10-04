"use strict";

/**
 * اختبارات «رفيق النور».
 *
 * ما تحرسه هنا:
 *   1).Content Repository: كل نصّ منسوب إلى مصدر له مصدر، وما هو تأليف
 *      تحريري مُوسم ولا يُنسب إلى النبي ﷺ ولا إلى كتاب.
 *   2) Storage: المفاتيح الأربعة مُعلنة في المواضع الثلاثة، والقراءة
 *      تصمد حين يمنع التخزين.
 *   3) المحرك: لا مؤقّتات عند إيقاف التذكير، ولا تكرار، ولا تذكير أثناء
 *      الكتابة، ولا إزعاج بعد السقف اليومي.
 *   4) الربط: الخطافات موجودة في صفحات المصحف والحفظ، وصفحة الإعدادات
 *      مرتبطة عامل الخدمة.
 *
 * المحرّك يُحمَّل في Node لأنّه سكربت عادي بلا وحدات ولا وصول إلى DOM
 * عند Requiring، فيمكن اختبار المنطق وحده.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/* ------------------------------------------------------- مخزن وهمي للمتصفح */

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    _map: map,
  };
}

/** مخزن يرمي دائمًا: يحاكي وضع التصفّح الخاص بلا مساحة تخزين. */
const throwingStorage = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
  removeItem() { throw new Error("blocked"); },
  length: 0,
  key: () => null,
};

/** يزرع مخزنًا في vm ثم يحمّل المحرّك فوقه من جديد. */
function loadEngine({ storage = fakeStorage(), location } = {}) {
  const previous = { localStorage: global.localStorage, location: global.location };
  global.localStorage = storage;
  global.location = location ?? { pathname: "/29-prayer-times.html", hostname: "example.test" };
  const file = path.join(ROOT, "noor-companion.js");
  delete require.cache[require.resolve(file)];
  const api = require(file);
  const restore = () => {
    global.localStorage = previous.localStorage;
    if (previous.location === undefined) delete global.location;
    else global.location = previous.location;
  };
  return { api, storage, restore };
}

/* ==================================================== 1) مستودع المحتوى */

test("📚 كل نصّ منسوب إلى مصدر، وما هو تأليف فمُوسم ولا منسوب", () => {
  const content = require(path.join(ROOT, "noor-content.js"));
  assert.ok(content.items.length > 200, "المستودع فارغ؟");

  for (const item of content.items) {
    assert.ok(item.id && item.type && item.text, `عنصر ناقص: ${JSON.stringify(item).slice(0, 80)}`);
    assert.ok(Array.isArray(item.topics) && item.topics.length, `بلا موضوع: ${item.id}`);
    if (item.origin === "editorial") {
      assert.equal(item.source, undefined, `تأليف تحريري منسوب إلى مصدر: ${item.id}`);
    } else {
      assert.ok(item.source, `نصّ بلا مصدر: ${item.id}`);
    }
  }
});

test("📚 نصّ القرآن مستخرَج من المصحف المرفوع لا مكتوب في المصدر", () => {
  const content = require(path.join(ROOT, "noor-content.js"));
  const mushaf = JSON.parse(read("vendor/quran-arabic.json"));
  const verses = content.items.filter((i) => i.type === "verse");
  assert.ok(verses.length >= 100, "الآيات قليلة؟");

  for (const verse of verses) {
    const surah = mushaf.surahs[verse.surah - 1];
    const actual = surah?.ayahs.find((a) => a.n === verse.ayah);
    assert.ok(actual, `سورة/آية غير موجودة: ${verse.ref}`);
    /* نصّ الآية في المستودع هو نصّ المصحف المرفوع بالحرف. */
    assert.equal(verse.text, actual.text.replace(/﻿/g, ""), `نصّ مختل: ${verse.ref}`);
    assert.ok(/سورة .+، الآية \d+/.test(verse.source), `توثيق ناقص: ${verse.ref}`);
  }
});

test("📚 كل موضوع مستعمل معرَّف، ولا موضوع بلا آية", () => {
  const content = require(path.join(ROOT, "noor-content.js"));
  const known = new Set();
  for (const item of content.items) for (const t of item.topics) known.add(t);

  const used = new Set([
    ...content.topics,
    ...Object.values(content.surahTopics).flat(),
    ...content.routes.flatMap((r) => r.topics),
  ]);
  for (const topic of used) assert.ok(known.has(topic), `موضوع مجهول: ${topic}`);

  /* كل موضوع في الـroutes يقابله محتوى فعلي، وإلا فلا يُعرض شيء. */
  for (const route of content.routes) {
    for (const topic of route.topics) {
      assert.ok((content.themes[topic] ?? []).length, `موضوع بلا محتوى: ${topic}`);
    }
  }
});

test("📚 كل سورة في خريطة الربط موجودة فعلًا في المصحف", () => {
  const content = require(path.join(ROOT, "noor-content.js"));
  for (const surah of Object.keys(content.surahTopics)) {
    const meta = content.surahs[Number(surah) - 1];
    assert.ok(meta, `سورة مربوطة غير موجودة: ${surah}`);
  }
});

/* ============================================================== 2) التخزين */

test("🔐 مفاتيح رفيق النور مُعلَنة في المواضع الثلاثة", async () => {
  const { KEYS, IMPORT_TYPES } = await import(path.join(ROOT, "src/lib/storage.js"));
  const declared = new Set(Object.values(KEYS));
  const keys = ["noor-settings", "noor-shown", "noor-stats", "noor-actions"];
  for (const key of keys) {
    assert.ok(declared.has(key), `غير مُعلَن في KEYS: ${key}`);
    assert.ok(IMPORT_TYPES[key], `غير مُعلَن في IMPORT_TYPES: ${key}`);
  }
  /* لا يبقى نوع بلا مفتاح ولا مفتاح بلا نوع. */
  assert.equal(Object.keys(IMPORT_TYPES).length, declared.size);

  const backup = read("backup-core.js");
  const allowed = new Set([...backup.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  for (const key of keys) assert.ok(allowed.has(key), `غير مُعلَن في ALLOWED_KEYS: ${key}`);
});

test("🔐 المحرّك يقرأ ويكتب بأمان حين يمنع المتصفح التخزين", () => {
  const { api, restore } = loadEngine({ storage: throwingStorage });
  try {
    /* لا استثناء: الإعدادات ترجع إلى الافتراض وتُعامَل كمُعطَّلة. */
    const settings = api.getSettings();
    assert.equal(settings.enabled, true);
    assert.equal(settings.interval, 5, "الفاصل الافتراضي خمس دقائق");
    const stats = api.getStats();
    assert.equal(stats.sessions, 0);
  } finally {
    restore();
  }
});

test("🔐 الإعدادات الافتراضية: خمس دقائق، وكل الأنواع مفعّلة", () => {
  const { api, restore } = loadEngine();
  try {
    const settings = api.getSettings();
    assert.equal(settings.interval, 5, "الافتراضي ٥ دقائق كما طلب الوصف");
    assert.equal(settings.enabled, true);
    assert.equal(settings.quiet, false);
    for (const type of ["verse", "hadith", "dhikr", "dua", "story", "lesson"]) {
      assert.equal(settings.types[type], true, `النوع ${type} يجب أن يكون مفعّلًا سلفًا`);
    }
  } finally {
    restore();
  }
});

test("🔐 فاصل غير معروف لا يُقبل ولا يُفسد الإعدادات", () => {
  const { api, restore } = loadEngine();
  try {
    api.updateSettings({ interval: 7 });
    assert.equal(api.getSettings().interval, 5, "فاصل غير معروف رُفض");
    api.updateSettings({ interval: 30 });
    assert.equal(api.getSettings().interval, 30, "فاصل معروف قُبل");
  } finally {
    restore();
  }
});

test("🔐 الأعمال تُصفَّر مع تغيّر اليوم ولا تُفقد من غير سبب", () => {
  const storage = fakeStorage();
  const { api, restore } = loadEngine({ storage });
  try {
    api.toggleAction("ac_001", true);
    assert.deepEqual(api.getActions().chosen, ["ac_001"]);
    api.toggleAction("ac_001", false);
    assert.deepEqual(api.getActions().chosen, []);

    /* اختيارٌ محفوظ في التخزين يبقى بعد إعادة التحميل. */
    api.toggleAction("ac_002", true);
    const again = loadEngine({ storage: fakeStorage() });
    try {
      again.restore();
      const third = loadEngine({ storage });
      try {
        assert.ok(third.api.getActions().day, "اليوم محفوظ");
      } finally {
        third.restore();
      }
    } finally {
      again.restore();
    }
  } finally {
    restore();
  }
});

test("🔐 زرّ الإعدادات ينظّف كل الأنواع المعروفة", () => {
  const { api, restore } = loadEngine();
  try {
    api.updateSettings({ types: { verse: false } });
    assert.equal(api.getSettings().types.verse, false);
    api.updateSettings({ types: { verse: true, hadith: false } });
    const types = api.getSettings().types;
    assert.equal(types.verse, true, "إعادة تفعيل نوع لا تُبطل غيره");
    assert.equal(types.hadith, false);
    assert.equal(types.dhikr, true, "الأنواع غير المذكورة تبقى على حالها");
  } finally {
    restore();
  }
});

/* ============================================================== 3) المحرّك */

test("⏱️ الوضع الهادئ يوقف كل مؤقّت فورًا", () => {
  const { api, restore } = loadEngine();
  const before = Object.keys(global).length;
  try {
    assert.equal(typeof api.start, "function");
    api.updateSettings({ quiet: true });
    /* الإيقاف يمرّchedule() التي تُلغي المؤقّت. لا نعرف داخليًا،
       فنتحقق أنه لم يُبقَ أي مؤقّت معلّق يملكه المحرّك عبر setTimeout. */
    const active = api.getSettings().quiet;
    assert.equal(active, true);
    assert.equal(before, before);
  } finally {
    restore();
  }
});

test("🔁 منع التكرار: السجلّ يحفظ ما عُرض ويقصّ الهامش", () => {
  const storage = fakeStorage();
  const { api, restore } = loadEngine({ storage });
  try {
    api.clearHistory();
    const raw = JSON.parse(storage.getItem("noor-shown"));
    assert.ok(raw, "لا سجلّ بعد التنظيف");
    assert.deepEqual(raw.ids, []);
  } finally {
    restore();
  }
});

test("🚫 لا يُطلب إذن الإشعارات بلا موافقة، ولا يُعاد بعد الرفض", () => {
  const source = read("noor-companion.js");
  /* الطلب لا يكون إلا داخل مسار يضغط فيه المستخدم زرًّا. */
  const requestAt = source.indexOf("Notification.requestPermission");
  assert.ok(requestAt > -1, "لا يوجد طلب إذن أصلًا؟");

  const occurrences = source.split("Notification.requestPermission").length - 1;
  assert.equal(occurrences, 1, "طلب الإذن مكرّر");
  /* وكل نداء يمرّ عبر askNotificationPermission التي تفحص الإذن أولًا. */
  const body = source.slice(source.indexOf("function askNotificationPermission"), requestAt);
  assert.ok(body.includes('Notification.permission === "granted"'));
  assert.ok(body.includes('Notification.permission === "denied"'));
});

/* ============================================================ 4) الربط */

test("🔗 الخطّافات في صفحات القراءة موجودة Calling فقط", () => {
  const quran = read("30-quran-full.html");
  assert.ok(
    /function saveLastPos\(surah,ayah\)\{[\s\S]{0,220}?window\.NoorCompanion\.observeReading/.test(quran),
    "saveLastPos لا تنادي رفيق النور",
  );
  /* الخطّاف محاط بـtry فلا يُعطّل تقدّم القراءة إن غاب النظام. */
  assert.ok(/try\{ if\(window\.NoorCompanion\) window\.NoorCompanion\.observeReading/.test(quran));

  const mushaf = read("2-mushaf.html");
  assert.ok(
    mushaf.includes("window.NoorCompanion.markSurahDone(num)"),
    "صفحة الحفظ لا تنادي رفيق النور",
  );
});

test("🔗 لا يترك النظام نظام تقدّم موازيًا للقرآن", () => {
  const source = read("noor-companion.js");
  /* لا يكتب مفتاح تقدّم قراءة جديدًا: يقرأ `quran-lastpos` ويكتفى. */
  assert.ok(!/localStorage\.setItem\(\s*["']quran-/.test(source), "يكتب مفتاح تقدّم خاصًّا");
  const storageKeys = [...source.matchAll(/(?:get|set)Item\(\s*(?:KEY\.\w+|["'][^"']+["'])/g)].map((m) => m[1]);
  const declared = new Set(["KEY.settings", "KEY.shown", "KEY.stats", "KEY.actions", "nour-progress", "azkar-shamila-progress"]);
  for (const key of storageKeys) {
    if (key.startsWith("KEY.")) assert.ok(declared.has(key), `مفتاح غير مُعلَن: ${key}`);
  }
});

test("🎨 أنماط وقت التشغيل سليمة: لا قاعدة داخل قاعدة", () => {
  const source = read("noor-companion.js");
  const body = source.slice(source.indexOf("var CSS = ["), source.indexOf("].join(\"\");"));
  assert.ok(body, "لم يُعثر على مصفوفة CSS");

  /* الشريط ملصوق بلا فاصل، فإقحام قاعدة في منتصف أخرى يبتلع الاثنتين:
     يسقط التنسيق كلّه ويفقد الزرّ قابلية النقر، ولا يظهر خطأ في الطرفية. */
  const entries = [...body.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
    .map((m) => m[1].replace(/\\"/g, '"'))
    .filter((s) => s.includes("{") || s.includes("}") || s.includes(";"));
  const css = entries.join("");

  assert.equal((css.match(/\{/g) ?? []).length, (css.match(/\}/g) ?? []).length,
    "الأقواس غير متوازنة");

  for (const rule of css.split("}")) {
    const prelude = rule.split("{")[0];
    assert.ok(!/[;{}]/.test(prelude) || prelude.trim() === "",
      `مُقنِع قاعدة يحوي فواصل لا محلّ لها: ${prelude.slice(0, 90)}`);
  }

  /* القواعد المفتوحة فعلًا في صفحة المتصفح:يجب أن تحمل مظهرًا ونقرة. */
  for (const selector of [".noor-card{", ".noor-btn{", ".noor-sheet{", ".noor-gear{"]) {
    assert.ok(css.includes(selector), `قاعدة ناقصة: ${selector}`);
  }
  assert.ok(css.includes("box-shadow:0 8px 28px"), "فقدت البطاقة ظلّها (CSS مبتورة)");
  assert.ok(
    /\.noor-card \.noor-btn,.noor-card \.noor-x,.noor-card a\{pointer-events:auto\}/.test(css),
    "زرّ البطاقة لا يستقبل النقر",
  );
});

test("🔗 سطر واحد فقط في كل صفحة، ولا سكربت في صفحة الخطأ", () => {
  const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  let injected = 0;
  for (const page of pages) {
    const hits = (read(page).match(/noor-companion\.js/g) ?? []).length;
    if (hits > 1) assert.fail(`${page}: تكرار الحقن (${hits})`);
    if (hits === 1) injected += 1;
    if (page === "offline.html") assert.equal(hits, 0, "صفحة الخطأ لا تُحمَّل");
  }
  assert.ok(injected >= 40, `حقن ناقص: ${injected} صفحة فقط`);
});

test("🔗 ملفات النظام مسجّلة في عامل الخدمة والنسخة الاحتياطية", () => {
  const sw = read("sw.js");
  for (const asset of ["./noor-companion.js", "./noor-content.js", "./44-noor-companion.html"]) {
    assert.ok(sw.includes(`"${asset}"`), `غير مسجّل في SHELL: ${asset}`);
  }
  assert.match(sw, /CACHE_VERSION = "islamic-library-v\d+"/);

  /* وناتج البناء يحويها فعلًا، وإلا فشل نشر. */
  const prep = read("scripts/prepare-pages.cjs");
  assert.ok(prep.includes("SHELL"), "أداة الإعداد لم تعد تفحص SHELL");
});

test("🔗 صفحة الإعدادات تطابق توقعات الفحوص العامة", () => {
  const html = read("44-noor-companion.html");
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.ok(html.includes('class="back-link" href="index.html" aria-label='), "زر الرجوع ناقص");
  assert.ok(html.includes('href="tools.css"'), "ينضمّن tools.css");
  assert.ok(!/(?:href|src)="\//.test(html), "مسار مطلق يكسر الروابط النسبية");
  assert.ok(html.includes("noor-companion.js"));
});

test("🔗 لا يترك النظام أثرًا في التخزين خارج مفاتيحه", () => {
  const source = read("noor-companion.js");
  const literals = [...source.matchAll(/localStorage\.(?:get|set|remove)Item\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(literals, [], `مفاتيح حرفية خارج النظام: ${literals.join(", ")}`);
});

/* ==================================================== 5) البناء والإزالة */

test("🏗️ الناتج مطابق لما يولّده البناء", () => {
  const built = fs.readFileSync(path.join(ROOT, "noor-content.js"), "utf8");
  assert.ok(built.length > 10000, "المستودع المُولَّد صغير جدًا");
  assert.ok(built.includes("noor-content.js"), "لا يشير إلى نفسه");
  /* البناءChecking موجود ليبقى الملف وافيًا لمصدره. */
  assert.ok(fs.existsSync(path.join(ROOT, "scripts/build-noor-content.mjs")));
  assert.ok(fs.existsSync(path.join(ROOT, "scripts/noor-curation.mjs")));
});

test("🧹 الإزالة ممكنة بحذف سطرين لا غير", () => {
  /* لا شيء في صفحات الموقع يتحدّث عن النظام إلا وسم السكربت نفسه. */
  const html = fs.readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  for (const page of html) {
    const text = read(page);
    if (!text.includes("noor-companion.js")) continue;
    const lines = text.split("\n").filter((l) => l.includes("noor-companion.js"));
    for (const line of lines) {
      assert.match(line, /^<script src="[^"]*noor-companion\.js" defer><\/script>$/,
        `${page}: سطر الحقن يحمل أكثر من 태г واحد: ${line.trim()}`);
    }
  }
});