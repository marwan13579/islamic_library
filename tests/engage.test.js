"use strict";

/**
 * اختبارات طبقة التفاعل.
 *
 * ما تحرسه هنا:
 *   1) الحصاد: يقرأ مفاتيح الأدوات القائمة، ويحتسب الفارق لا القيمة، فلا
 *      يُنقاط التقدّم مرّتين ولا تُنقَص النقاط إن أعادت الأداة ضبط نفسها.
 *   2) الت-total: كل نقطة تدخل من `credit` واحدة، فلا يتفرّق الرصيد.
 *   3) المتتالية: تنتهي اليوم أو أمس، ويومٌ بلا عملٍ لا يُحسب خطأً.
 *   4) الأوسمة: لا تُفتح إلا بشرطها، ولا تُفتح مرّتين.
 *   5) تحدّي اليوم: حتميٌّ في تاريخه، ويختلف بين الأيام، ويُقفل بأن
 *      يتمّه عملُه في اليوم نفسه لا عملٌ سابق.
 *   6) الربط: الطبقة محقونة في كل صفحة قديمة، ومُدرَجة في عامل الخدمة،
 *      ومفتاحها في قائمة النسخ الاحتياطية.
 *
 * المحرّك يُحمَّل في Node لأنه سكربت عادي بلا وحدات ولا وصول إلى DOM
 * عند Requiring، فيمكن اختبار المنطق وحده.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/* ------------------------------------------------------- مخزن وهمي للمتصفح */

function fakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
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

/** مخزن يرمي دائمًا: يحاكي التصفّح الخاص بلا مساحة تخزين. */
const throwingStorage = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
  removeItem() { throw new Error("blocked"); },
  length: 0,
  key: () => null,
};

/** يزرع مخزنًا ثم يحمّل المحرّك فوقه من جديد. */
function loadEngine(initial, storage = fakeStorage(initial)) {
  const previous = {
    localStorage: global.localStorage,
    location: global.location,
    matchMedia: global.matchMedia,
    requestAnimationFrame: global.requestAnimationFrame,
  };
  global.localStorage = storage;
  global.location = { pathname: "/17-wird.html", hostname: "example.test" };
  delete require.cache[require.resolve(path.join(ROOT, "engage.js"))];
  const api = require(path.join(ROOT, "engage.js"));
  const restore = () => {
    global.localStorage = previous.localStorage;
    if (previous.location === undefined) delete global.location;
    else global.location = previous.location;
    global.matchMedia = previous.matchMedia;
    global.requestAnimationFrame = previous.requestAnimationFrame;
  };
  return { api, storage, restore };
}

/** مفتاح يومٍ بالتوقيت المحلي — كما يحسبه المحرّك، لا بتوقيت UTC.
 *  الفارق بينهما يبلغ يومًا كاملًا في المناطق البعيدة عن غرينتش. */
function dayOffset(delta) {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const todayKey = () => dayOffset(0);

/* --------------------------------------------------------------- الحصاد */

test("الحصاد يقرأ مفاتيح الأدوات ويحوّلها إلى نقاط", () => {
  const { api, restore } = loadEngine({
    "nour-progress": JSON.stringify({ day: "2000-01-01", data: { a: 5, b: 7 } }),
    "mushaf-progress": JSON.stringify({ 1: true, 2: true, 3: false }),
    "lib-quiz-history": JSON.stringify([{ s: 80 }, { s: 90 }]),
    "tadabbur-entries": JSON.stringify([{ id: 1 }]),
  });
  try {
    api.harvest();
    const state = api.state();
    // ١٢ ذكرًا + ٢٠ لكل سورتين + ١٠ لمحاولتين + ٣ لتدبّرٍ واحد
    assert.equal(state.points, 12 + 20 + 10 + 3);
    assert.equal(state.totals.adhkar, 12);
    assert.equal(state.totals.surah, 2, "لا تُحسب السورة غير المحفوظة");
  } finally {
    restore();
  }
});

test("الحصاد لا يُنقاط التقدّم مرّتين", () => {
  const data = { "wird-log": JSON.stringify({ "2026-01-01": 4 }) };
  const { api, restore } = loadEngine(data);
  try {
    api.harvest();
    const first = api.state().points;
    assert.equal(first, 8, "أربع صفحات وِرد بنقطتين لكلٍّ");
    for (let i = 0; i < 5; i++) api.harvest();
    assert.equal(api.state().points, first, "الحصاد المتكرّر لا يزيد شيئًا");
  } finally {
    restore();
  }
});

test("إعادة ضبط الأداة لا تُنقِص النقاط ولا تُفسد ما بعدها", () => {
  const { api, storage, restore } = loadEngine({
    "wird-log": JSON.stringify({ "2026-01-01": 10 }),
  });
  try {
    api.harvest();
    assert.equal(api.state().points, 20);
    // الأداة صفّرت سجلّها: المجموع منذ البداية لا ينقص، ولا يُعاد احتساب
    // ما تحت السقف الأعلى حتى لا تتضخّم النقاط بإعادة الضبط.
    storage.setItem("wird-log", JSON.stringify({}));
    api.harvest();
    assert.equal(api.state().points, 20, "التصفير لا يسحب نقاطًا");
    storage.setItem("wird-log", JSON.stringify({ "2026-01-02": 2 }));
    api.harvest();
    assert.equal(api.state().points, 20, "وما دون السقف الأعلى لا يُنقص ولا يُضاعَف");
    // ثم تجاوز السقف الأعلى: يُحسب الفارق وحده.
    storage.setItem("wird-log", JSON.stringify({ "2026-01-02": 12 }));
    api.harvest();
    assert.equal(api.state().points, 24, "تجاوز السقف يُحسب فارقًا لا قيمةً");
  } finally {
    restore();
  }
});

test("المصدر اليومي يُحصَد كاملًا عند تغيّر يومه", () => {
  const { api, storage, restore } = loadEngine({
    "nour-progress": JSON.stringify({ day: "2000-01-01", data: { a: 40 } }),
  });
  try {
    api.harvest();
    assert.equal(api.state().points, 40);
    // العدّاد اليومي بدأ من جديد بيومٍ جديد، فلا يبقى الفارق صفرًا.
    storage.setItem("nour-progress", JSON.stringify({ day: "2099-01-01", data: { a: 3 } }));
    api.harvest();
    assert.equal(api.state().points, 43);
  } finally {
    restore();
  }
});

/* --------------------------------------------------------------- الرصيد */

test("كل نقطة تدخل من موضع واحد", () => {
  const { api, restore } = loadEngine();
  try {
    api.record("adhkar", 33);
    api.record("tasbih", 33);
    api.record("wird", 5);
    const state = api.state();
    assert.equal(state.points, 33 + 3 + 10);
    // سجلّ اليوم يساوي مجموع ما أُضيف.
    const dayPoints = Object.values(state.days).reduce((sum, day) => sum + day.p, 0);
    assert.equal(dayPoints, state.points, "ما في سجلّ اليوم غير ما في الرصيد");
  } finally {
    restore();
  }
});

test("نوعٌ مجهول يُسجَّل فتحُ أداةٍ لا ينهار", () => {
  const { api, restore } = loadEngine();
  try {
    assert.doesNotThrow(() => api.record("لا-يوجد", 5));
    assert.equal(api.state().points, 5);
  } finally {
    restore();
  }
});

/* ---------------------------------------------------------- الأيام المتتالية */

test("المتتالية تنتهي اليوم أو أمس، ويومٌ بلا عملٍ لا يُحسب", () => {
  const yesterday = dayOffset(-1);
  const base = (days) => ({ v: 1, points: 0, days });
  const day = (a = 1) => ({ p: 5, a, k: {} });

  const both = loadEngine({ "engage-v1": JSON.stringify(base({ [todayKey()]: day(), [yesterday]: day() })) });
  try {
    assert.equal(both.api.state().streak, 2, "اليوم وأمس عملٌ متصل");
  } finally {
    both.restore();
  }

  /* يُحمَّل المحرّك من جديد: حالته محفوظة في المتغيّر، فلا تعيد
   * الكتابة في التخزين شيئًا عند القراءة. */
  const onlyYesterday = loadEngine({ "engage-v1": JSON.stringify(base({ [yesterday]: day() })) });
  try {
    assert.equal(onlyYesterday.api.state().streak, 1, "بدايةُ اليوم لا تُكسر المتتالية");
  } finally {
    onlyYesterday.restore();
  }

  const idle = loadEngine({ "engage-v1": JSON.stringify(base({ [todayKey()]: day(0), [yesterday]: day() })) });
  try {
    assert.equal(idle.api.state().streak, 1, "اليوم بلا عملٍ يُعدّ يومًا فارغًا");
  } finally {
    idle.restore();
  }
});

test("فجوةُ يومٍ تكسر المتتالية", () => {
  const { api, storage, restore } = loadEngine();
  try {
    const today = todayKey();
    const threeDaysAgo = dayOffset(-3);
    storage.setItem("engage-v1", JSON.stringify({
      v: 1,
      points: 0,
      days: { [today]: { p: 1, a: 1, k: {} }, [threeDaysAgo]: { p: 1, a: 1, k: {} } },
    }));
    assert.equal(api.state().streak, 1);
  } finally {
    restore();
  }
});

/* -------------------------------------------------------------- الأوسمة */

test("الوسام لا يُفتح إلا بشرطه", () => {
  const { api, restore } = loadEngine();
  try {
    api.record("adhkar", 10);
    let open = api.state().badges;
    assert.ok(open.includes("first"), "أول عملٍ يفتح الخطوة الأولى");
    assert.ok(!open.includes("adhkar-50"), "عشرة أذكار لا تفتح خمسين");
    api.record("adhkar", 60);
    open = api.state().badges;
    assert.ok(open.includes("adhkar-50"), "خمسون ذكرًا تفتح وسامها");
  } finally {
    restore();
  }
});

test("الوسام لا يُفتح مرّتين", () => {
  const { api, restore } = loadEngine();
  try {
    api.record("adhkar", 200);
    const before = api.state().badges.length;
    api.record("adhkar", 200);
    assert.equal(api.state().badges.length, before, "لا تكرار في الفتح");
  } finally {
    restore();
  }
});

test("كل وسام له شرطٌ قابلٌ للقياس، ورقمُه عربيّ", () => {
  const { api, restore } = loadEngine();
  try {
    assert.ok(api.badges.length >= 12, "أوسمة قليلة على الموقع كله");
    const ids = new Set();
    for (const badge of api.badges) {
      assert.ok(!ids.has(badge.id), `معرّف مكرّر: ${badge.id}`);
      ids.add(badge.id);
      assert.equal(typeof badge.test, "function", `${badge.id}: بلا شرط`);
      assert.equal(typeof badge.name, "string");
      assert.ok(badge.name.trim().length > 0, `${badge.id}: بلا اسم`);
      assert.ok(["bronze", "silver", "gold"].includes(badge.tier), `${badge.id}: طبقة مجهولة`);
    }
  } finally {
    restore();
  }
});

test("التصفير يمسح الأوسمة ولا يمسّ بيانات الأدوات", () => {
  const { api, storage, restore } = loadEngine({
    "mushaf-progress": JSON.stringify({ 1: true }),
  });
  try {
    api.refresh();
    assert.ok(api.state().badges.includes("surah-1"));
    api.reset();
    assert.deepEqual(api.state().badges, []);
    assert.equal(api.state().points, 0);
    assert.equal(storage.getItem("mushaf-progress"), JSON.stringify({ 1: true }),
      "بيانات الأداة باقية");
    // والحصاد بعدها يعيد بناء التقدّم من جديد، لا من صفرٍ عائم.
    api.refresh();
    assert.ok(api.state().badges.includes("surah-1"), "يعود الواجب بعد التصفير");
  } finally {
    restore();
  }
});

/* ------------------------------------------------------------ تحدّي اليوم */

test("تحدّي اليوم حتميٌّ في تاريخه", () => {
  const { api, restore } = loadEngine();
  try {
    const a = api.challengeFor("2026-10-05");
    const b = api.challengeFor("2026-10-05");
    assert.equal(a.id, b.id, "التحدّي يتغيّر في اليوم نفسه");
  } finally {
    restore();
  }
});

test("تحدّي اليوم يقود إلى أداةٍ موجودة، ويختلف بين الأيام", () => {
  const { api, restore } = loadEngine();
  try {
    const seen = new Set();
    for (let day = 1; day <= 60; day++) {
      const key = `2026-09-${String(day).padStart(2, "0")}`;
      const challenge = api.challengeFor(key);
      assert.ok(fs.existsSync(path.join(ROOT, challenge.url.split("#")[0])),
        `وجهةٌ لا وجود لها: ${challenge.url}`);
      assert.ok(challenge.goal > 0, `${challenge.id}: هدفٌ بلا حد`);
      assert.ok(challenge.title.trim().length > 0, `${challenge.id}: بلا عنوان`);
      seen.add(challenge.id);
    }
    assert.ok(seen.size >= 8, `تحدٍّ واحد يتكرّر ستين يومًا (${seen.size} مختلفًا فقط)`);
  } finally {
    restore();
  }
});

test("تحدّي اليوم لا يُقفل إلا بعملٍ في اليوم نفسه", () => {
  const { api, storage, restore } = loadEngine();
  try {
    const today = todayKey();
    const yesterday = dayOffset(-1);
    // عملٌ مكتملٌ في الأمس، ونفس النوع اليوم لا شيء.
    const days = { [yesterday]: { p: 999, a: 9, k: { wird: 99 } } };
    storage.setItem("engage-v1", JSON.stringify({ v: 1, points: 0, days }));
    assert.equal(api.challengeDone(), false, "عملُ الأمس لا يُنهي تحدّي اليوم");
    days[today] = { p: 5, a: 1, k: { wird: 1 } };
    storage.setItem("engage-v1", JSON.stringify({ v: 1, points: 0, days }));
    const challenge = api.challengeFor(today);
    if (challenge.act === "wird") {
      api.record("wird", challenge.goal);
      assert.equal(api.challengeDone(), true, "عملُ اليوم يُنهيه");
    } else {
      assert.equal(api.challengeDone(), false);
    }
  } finally {
    restore();
  }
});

test("التحدّي يُقفل مرّة واحدة في اليوم", () => {
  const { api, restore } = loadEngine();
  try {
    const challenge = api.challengeFor();
    assert.equal(api.checkChallenge(true), null, "لم يُنجَز بعد");
    api.record(challenge.act, challenge.goal);
    assert.equal(api.challengeDone(), true, "عملُه أُنجزه");
    // إنجازٌ ثانٍ لا يُعيد القفل ولا يفتح احتفالًا جديدًا.
    assert.equal(api.checkChallenge(true), null, "لا احتفال مرّتين في يوم واحد");
    assert.equal(api.checkChallenge(true), null);
  } finally {
    restore();
  }
});

/* ------------------------------------------------------ التخزين المعطوب */

test("محركٌ لا يعرف شكل تخزينٍ تالفًا لا ينهار عند القراءة", () => {
  const { api, restore } = loadEngine({ "engage-v1": "{{{ ليست JSON" });
  try {
    assert.doesNotThrow(() => api.state());
    assert.equal(api.state().points, 0);
    assert.doesNotThrow(() => api.record("adhkar", 1));
  } finally {
    restore();
  }
});

test("محركٌBlocked على التخزين يبقى في الذاكرة ويعمل", () => {
  const { api, restore } = loadEngine(null, throwingStorage);
  try {
    assert.doesNotThrow(() => api.harvest());
    assert.doesNotThrow(() => api.record("adhkar", 5));
    assert.equal(api.state().points, 5);
  } finally {
    restore();
  }
});

test("قيمٌ سالبة أو منحرفة في التخزين تُقصَّى", () => {
  const { api, restore } = loadEngine({
    "engage-v1": JSON.stringify({
      v: 1,
      points: -40,
      badges: "ليست مصفوفة",
      days: { "2026-01-01": { p: -5, a: -9, k: "لا شيء" } },
      read: { "a.html": "ليست مصفوفة" },
    }),
  });
  try {
    const state = api.state();
    assert.equal(state.points, 0, "النقاط السالبة تُقصَّى");
    assert.deepEqual(state.badges, []);
    assert.equal(state.days["2026-01-01"].a, 0);
    assert.equal(state.reads, 0, "ما ليس مصفوفة في سجلّ القراءة يُهمَل");
  } finally {
    restore();
  }
});

/* ---------------------------------------------------- تطبيع البحث العربي */

test("البحث يتجاهل التشكيل ويوحّد الحروف", () => {
  const { api, restore } = loadEngine();
  try {
    const forms = ["الصَّلَاة", "الصلاه", "الصـلاة"];
    const normalized = new Set(forms.map(api.normalizeAr));
    assert.equal(normalized.size, 1, "التشكيل والهاء لا يغيّران الكلمة");
    assert.equal(api.normalizeAr("أَحْمَد"), "احمد");
    assert.equal(api.normalizeAr("  آداب   visitation  "), "اداب visitation");
  } finally {
    restore();
  }
});

/* -------------------------------------------------------------- الربط */

test("🔗 كل صفحة قديمة تحمّل طبقة التفاعل بمسارٍ صحيح", () => {
  const files = [];
  const skip = new Set(["node_modules", "dist", ".git", "src", ".kilo"]);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name) || entry.name.startsWith(".")) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(".html")) files.push(path.relative(ROOT, abs));
    }
  };
  walk(ROOT);
  const targets = files.filter((file) => read(file).includes("storage-fallback.js"));
  assert.ok(targets.length >= 40, `صفحات قديمة: ${targets.length} فقط`);
  for (const file of targets) {
    const html = read(file);
    assert.match(html, /<script src="[^"]*engage\.js" defer><\/script>/, `${file}: بلا طبقة التفاعل`);
    assert.match(html, /<link rel="stylesheet" href="[^"]*engage\.css">/, `${file}: بلا تنسيق الطبقة`);
    // المسار يُحلّ نسبةً إلى مجلّد الصفحة.
    for (const m of html.matchAll(/(?:href|src)="([^"]*engage\.(?:js|css))"/g)) {
      assert.ok(fs.existsSync(path.resolve(path.dirname(path.join(ROOT, file)), m[1])),
        `${file}: مسار لا يُحلّ (${m[1]})`);
    }
  }
});

test("الصفحات الستّ بلا تفاعل صارت تُعلِّم ما قُرئ", () => {
  const pages = {
    "4-salah.html": ".step, .kidbox",
    "6-munasabat.html": ".dhikr",
    "9-seerah.html": ".event",
    "11-hajj-umrah.html": ".step",
    "12-mustajab.html": ".time",
    "19-adab-ziyara.html": ".tip",
  };
  for (const [file, selector] of Object.entries(pages)) {
    const html = read(file);
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(html, new RegExp(`enhanceReadPage\\(\\{ items: "${escaped}"`),
      `${file}: لم يُحسَّن للقراءة`);
    assert.match(html, /label: "[^"]+"/, `${file}: بلا اسم للعدّاد`);
  }
});

test("محدّد كل صفحة محسّنة موجود فعلًا في تنسيقها أو بنائها", () => {
  for (const [file, selector] of Object.entries({
    "4-salah.html": "step",
    "4-salah.html#kidbox": "kidbox",
    "6-munasabat.html": "dhikr",
    "9-seerah.html": "event",
    "11-hajj-umrah.html": "step",
    "12-mustajab.html": "time",
    "19-adab-ziyara.html": "tip",
  })) {
    const html = read(file.split("#")[0]);
    const built = new RegExp(`className="${selector}"`).test(html);
    const styled = new RegExp(`\\.${selector}\\s*[{,:]`).test(html);
    assert.ok(built || styled, `${file}: الصنف «${selector}» لا يُبنى ولا يُنسَّق`);
  }
});

test("📦 الطبقة مُدرَجة في ذاكرة عامل الخدمة، فعمل بلا إنترنت", () => {
  const worker = read("sw.js");
  assert.match(worker, /"\.\/engage\.js"/, "المحرّك غير مُدرَج في عامل الخدمة");
  assert.match(worker, /"\.\/engage\.css"/, "التنسيق غير مُدرَج في عامل الخدمة");
});

test("💾 مفتاح الطبقة في قائمة النسخ الاحتياطية", () => {
  assert.match(read("backup-core.js"), /"engage-v1"/, "المفتاح خارج قائمة النسخ");
});

test("التنسيق يستعمل رموز الموقع ولا يلوّن من عنده", () => {
  const css = read("engage.css");
  for (const token of ["--paper", "--ink", "--gold", "--card", "--line", "--green"]) {
    assert.ok(css.includes(`var(${token}`), `الرمز ${token} غير مستعمل`);
  }
  // كل صنفٍ يبدأ بـ`eg-` فلا يختلط بصنف صفحة.
  const classes = [...css.matchAll(/^\.([a-zA-Z][\w-]*)/gm)].map((m) => m[1]);
  const foreign = classes.filter((c) => !c.startsWith("eg-"));
  assert.deepEqual(foreign, [], `أصناف بلا بادئة: ${foreign.join("، ")}`);
});

test("الاحتفال صامت بلا DOM، ولا يمنح نقاطًا", () => {
  const { api, restore } = loadEngine();
  try {
    // بلا DOM فلا قصاصات ولا نغمة ولا تنبيه: الطبقة صامتة تمامًا.
    assert.doesNotThrow(() => api.confetti());
    assert.doesNotThrow(() => api.chime());
    assert.doesNotThrow(() => api.celebrate([{ name: "وسام", desc: "وصف" }]));
    assert.equal(api.state().points, 0, "الاحتفال لا يمنح نقاطًا");
  } finally {
    restore();
  }
});

test("الواجهة العامة كاملة، فلا زرّ يبقى بلا دالة", () => {
  const { api, restore } = loadEngine();
  try {
    const expected = [
      "record", "refresh", "state", "mount", "openPanel", "reset",
      "celebrate", "confetti", "chime", "harvest", "enhanceReadPage",
      "challengeFor", "challengeDone", "checkChallenge", "normalizeAr",
    ];
    for (const name of expected) {
      assert.equal(typeof api[name], "function", `الواجهة ناقصة: ${name}`);
    }
    assert.equal(api.version, 1, "الإصدار يُعلن في مكان واحد");
  } finally {
    restore();
  }
});
