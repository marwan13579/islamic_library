"use strict";

/**
 * اختبارات دليل المكتبة (intro-tour.js).
 *
 * الجولة تعريفٌ بالموقع وبأدواته، فحارسها الأول الصدق: كل رقمٍ فيها يقرأه
 * الفهرس نفسه، وكل رابطٍ يشير إلى ملفٍّ موجود، ولا نصّ دينيًّا فيها. وتُفحص
 * كذلك ألّا تكسر الصفحة: لا `innerHTML`، ولا مسارٍ مطلق، ولا زرّ بلا اسم،
 * وأن تعمل بلا إنترنت عبر صدفة عامل الخدمة.
 *
 * منطق النافذة (التصيير والتنقّل والحفظ) يُختبر على شجرة DOM مُصطنعة
 * صغيرة، فلا يحتاج هذا الملف متصفّحًا.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const intro = require("../intro-tour.js");

const index = read("index.html");
const source = read("intro-tour.js");
const style = read("intro-tour.css");

/* ------------------------------------------------- شجرة DOM مُصطنعة */

function matches(node, selector) {
  if (selector.startsWith("#")) return node.getAttribute("id") === selector.slice(1);
  if (selector.startsWith(".")) return node.className.split(/\s+/).includes(selector.slice(1));
  const tag = selector.match(/^([a-z]+)/i)?.[1];
  if (tag && node.tagName !== tag.toUpperCase()) return false;
  const attr = selector.match(/\[(\w+)\^?="([^"]*)"\]$/);
  if (!attr) return true;
  const value = node.getAttribute(attr[1]) ?? "";
  return attr[0].includes("^=") ? value.startsWith(attr[2]) : value === attr[2];
}

/** محدّداتٌ سلسلية ("#cats [data-cat]") فالمصطنعة تسلك سلوك المتصفّح. */
function collect(root, selector) {
  const parts = String(selector).trim().split(/\s+(?![^[]*\])/);
  const last = parts[parts.length - 1];
  const ancestors = parts.slice(0, -1).reverse();
  const out = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (matches(child, last) && under(child, ancestors)) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

/** هل يجد العنصر أجدادًا يطابقونهم بالترتيب من الأقرب؟ */
function under(node, selectors) {
  let index = 0;
  let current = node.parent;
  while (index < selectors.length && current) {
    if (matches(current, selectors[index])) index += 1;
    current = current.parent;
  }
  return index === selectors.length;
}

/** شجرةٌ صغيرة تكفي للاختبار: عناصر، وأحداث، ونافذة `dialog`. */
function miniDom() {
  const make = (tag) => {
    const node = {
      tagName: String(tag).toUpperCase(),
      attributes: {},
      children: [],
      listeners: {},
      className: "",
      _text: "",
      disabled: false,
      open: false,
      parent: null,
      /* الـDOM الحقيقي: assigning textContent replaces all children */
      get childNodes() { return this.children; },
      get textContent() { return this._text; },
      set textContent(value) { this._text = String(value); this.children = []; },
      setAttribute(key, value) { this.attributes[key] = String(value); },
      getAttribute(key) { return key in this.attributes ? this.attributes[key] : null; },
      appendChild(child) { child.parent = this; this.children.push(child); return child; },
      remove() {
        if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
        this.parent = null;
      },
      contains(other) { return other === this || this.children.some((child) => child.contains(other)); },
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
      dispatch(type, event) {
        for (const fn of this.listeners[type] || []) fn({ preventDefault() {}, ...event });
      },
      focus() { doc.activeElement = this; },
      showModal() { this.open = true; },
      close() {
        if (!this.open) return;
        this.open = false;
        this.dispatch("close", { type: "close", target: this });
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
      querySelectorAll(selector) { return collect(this, selector); },
    };
    return node;
  };

  const doc = {
    make,
    activeElement: null,
    documentElement: make("html"),
    body: make("body"),
    createElement: make,
    getElementById(id) { return doc.body.querySelector("#" + id); },
    querySelector(selector) { return doc.body.querySelector(selector); },
    querySelectorAll(selector) { return doc.body.querySelectorAll(selector); },
  };
  doc.documentElement.setAttribute("lang", "ar");
  doc.documentElement.setAttribute("dir", "rtl");
  return doc;
}

/** يركّب بيئة المتصفّح التي يحتاجها boot()، ويعيد دالّة تنظيف. */
function withBrowser(initial) {
  const doc = miniDom();
  const map = new Map(Object.entries(initial || {}));
  const before = {
    document: globalThis.document,
    location: globalThis.location,
    localStorage: globalThis.localStorage,
    MutationObserver: globalThis.MutationObserver,
  };
  globalThis.document = doc;
  globalThis.location = { hash: "" };
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  return {
    doc,
    map,
    cleanup() {
      for (const [key, value] of Object.entries(before)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    },
  };
}

/** نقرٌ على عنصر، وضغطةُ مفتاح في النافذة. */
const click = (node) => node.dispatch("click", { target: node });
const press = (node, value) => node.dispatch("keydown", { target: node, key: value });
const next = (dialog) => dialog.querySelector("#itNext");

const CATALOG = [{ id: "dhikr", name: "أذكار وأدعية", count: "12", href: "#sec-dhikr", blurb: "أذكارٌ وأدعية" }];

/* ------------------------------------------------- الربط بالصفحة */

test("الفهرس يربط ملفّي الدليل، وعامل الخدمة يخدمهما", () => {
  assert.match(index, /<script src="intro-tour\.js" defer><\/script>/, "السكربت غير مربوط");
  assert.match(index, /<link rel="stylesheet" href="intro-tour\.css">/, "التنسيق غير مربوط");
  const shell = read("sw.js");
  assert.match(shell, /"\.\/intro-tour\.js"/, "الدليل لا يعمل بلا إنترنت");
  assert.match(shell, /"\.\/intro-tour\.css"/, "تنسيق الدليل لا يعمل بلا إنترنت");
  assert.match(shell, /CACHE_VERSION = "islamic-library-v\d+"/, "لا نسخة كاش");
});

test("زرّ الدليل في الترويسة مُسمّى بالعربية والإنجليزية", () => {
  assert.match(index, /<button class="sortbtn" id="introBtn" type="button">/, "زرّ الدليل ناقص");
  assert.match(index, /introBtn:"🧭 دليل المكتبة"/, "نصّ الزر العربي ناقص");
  assert.match(index, /introBtn:"🧭 Site guide"/, "نصّ الزر الإنجليزي ناقص");
  assert.match(index, /getElementById\("introBtn"\)\.textContent = dict\.introBtn/,
    "تبديل اللغة لا يبدّل نصّ الزرّ");
});

test("الدليل يقرأ أقسام الفهرس من الصفحة نفسها", () => {
  assert.match(index, /b\.dataset\.cat=id/, "شريط الأقسام لا يحمل data-cat");
  assert.match(index, /block\.setAttribute\("data-section",catId\)/, "لا معرّف للقسم");
  assert.match(index, /block\.setAttribute\("data-blurb",tCatBlurb\(catId\)\)/, "لا وصف للقسم");
  /* أقسام الفهرس تذكرها I18N بوصف لكلٍّ منها، فلا يكرّرها الدليل. */
  const cats = [...index.matchAll(/\["(\w+)","([^"]+)"\]/g)].map((m) => m[1]);
  assert.ok(cats.length > 5, `أقسام قليلة: ${cats.length}`);
  for (const cat of cats.filter((id) => id !== "all")) {
    assert.match(index, new RegExp(`${cat}:"[^"]+"`), `القسم ${cat} بلا وصف في I18N`);
  }
});

/* ------------------------------------------------- بنية الخطوات */

test("الجولة خمس خطوات مرتّبة، لكل خطوة عنوان ومحتوى", () => {
  const steps = intro.stepsFor("ar", []);
  assert.deepEqual(steps.map((s) => s.id), ["welcome", "today", "sections", "how", "begin"]);
  assert.deepEqual(intro.STEP_ORDER, steps.map((s) => s.id));
  for (const step of steps) {
    assert.ok(step.title.trim().length > 3, `${step.id}: بلا عنوان`);
    assert.ok(step.emoji.trim().length > 0, `${step.id}: بلا رمز`);
    assert.ok(step.parts.length > 0, `${step.id}: بلا متن`);
  }
});

test("خطوة الأقسام تحمل ما مرّره الفهرس، فلا تُخترع أقسام", () => {
  const step = intro.stepsFor("ar", CATALOG).find((s) => s.id === "sections");
  const part = step.parts.find((p) => p.type === "sections");
  assert.equal(part.items.length, 1);
  assert.equal(part.items[0].count, "12");
  assert.equal(part.items[0].href, "#sec-dhikr");
});

test("الخطوات تُبنى من النصوص دون أن تتشارك كائناتها", () => {
  const catalogs = [{ ...CATALOG[0] }];
  const one = intro.stepsFor("ar", catalogs);
  const two = intro.stepsFor("ar", catalogs);
  one.find((s) => s.id === "sections").parts.find((p) => p.type === "sections").items.push({ id: "x" });
  assert.equal(two.find((s) => s.id === "sections").parts.find((p) => p.type === "sections").items.length, 1,
    "خطوتان تشتركان في مصفوفة الأقسام");
  assert.equal(catalogs.length, 1, "عدّل-steps فهرس الفهرس نفسه");
});

test("لغة غير معروفة ترجع إلى العربية", () => {
  assert.deepEqual(
    intro.stepsFor("fr", []).map((s) => s.title),
    intro.stepsFor("ar", []).map((s) => s.title),
  );
});

/* ------------------------------------------------- الصدق والسلامة */

test("كل رابط في الجولة يشير إلى ملفٍّ موجود أو إلى مرجعٍ في الصفحة", () => {
  const targets = [];
  for (const step of intro.stepsFor("ar", CATALOG)) {
    for (const link of step.links) if (link.href) targets.push(link.href);
    for (const part of step.parts) {
      for (const item of part.items || []) if (item.href) targets.push(item.href);
    }
  }
  /* `#dcRoot` و`#sections` عناصرٌ في الصفحة لا ملفّات، فلا ملفّ لها. */
  const anchors = new Set(["#dcRoot", "#sections", "#sec-dhikr"]);
  for (const href of targets.filter((value) => value.startsWith("#"))) {
    assert.ok(anchors.has(href), `مرجع مجهول: ${href}`);
  }
  const files = [...new Set(targets.filter((href) => !href.startsWith("#")))];
  assert.ok(files.length >= 4, `روابط قليلة في الجولة: ${files.length}`);
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `رابط ميّت في الجولة: ${file}`);
  }
  /* والأقسام المولَّدة تشير إلى أقسامٍ يعرضها الفهرس فعلًا. */
  assert.match(index, /block\.id="sec-"\+catId/, "لا مراسي أقسام في الفهرس");
});

test("لا نصّ دينيّ ولا محرفًا تالفًا ولا ترجمةَ ناقصة في الجولة", () => {
  for (const lang of ["ar", "en"]) {
    for (const step of intro.stepsFor(lang, [])) {
      const texts = [
        step.title,
        ...step.parts.flatMap((part) => [
          part.text || "",
          ...(part.items || []).map((item) => `${item.label || ""}${item.desc || ""}${item.emoji || ""}`),
        ]),
      ].filter(Boolean);
      assert.ok(texts.length > 0, `${lang}/${step.id}: بلا نصّ`);
      for (const text of texts) {
        /* تعريفٌ بالموقع: لا آية ولا حديث ولا نسبةٍ إلى أهله. */
        assert.doesNotMatch(text, /[﴿﴾ﷺ]|رواه|متواتر|صحيح\s+الحديث|ضعيف|صدق\s+الله/,
          `${lang}/${step.id}: نصّ منسوب إلى الدين داخل الجولة`);
        assert.doesNotMatch(text, /(?:البقرة|آل\s+عمران|النور|الفاتحة)\s*[:٫]\s*\d/,
          `${lang}/${step.id}: إحالةٌ إلى آية`);
        assert.doesNotMatch(text, /�/, `${lang}/${step.id}: محرف تالف`);
        assert.doesNotMatch(text, /[一-鿿]/, `${lang}/${step.id}: محرف غير عربي ولا لاتيني`);
      }
    }
  }
});

test("لا innerHTML ولا مسارٍ مطلق ولا مورد خارجي", () => {
  assert.doesNotMatch(source, /\.innerHTML/, "الدليل يكتب HTML من نصٍّ خارجي");
  assert.doesNotMatch(source, /["'`]\/(?!\/)/, "مسار مطلق يكسر النشر في مجلد فرعي");
  assert.doesNotMatch(style, /https?:\/\//, "تنسيق يعتمد على مورد خارجي");
});

test("المفاتيح تحت بادئة hub-intro- فلا تمسّ مفاتيح الأدوات", () => {
  for (const key of [intro.SEEN_KEY, intro.STEP_KEY]) {
    assert.match(key, /^hub-intro-/, `مفتاح بلا بادئة: ${key}`);
  }
  /* كل مفتاحٍ في الملف تحت بادئة الجولة، فلا تمسّ مفاتيح الأدوات. */
  const keys = [...source.matchAll(/"((?:hub|dc|mushaf|wird|ramadan|khatma)-[\w-]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 0, "لا مفتاح في الجولة أصلًا");
  assert.deepEqual([...new Set(keys)].sort(), [intro.SEEN_KEY, intro.STEP_KEY].sort());
});

/* ------------------------------------------------- اللغتان متكافئتان */

test("نصوص العربية والإنجليزية متكافئة المفتاحًا بالمفتاح", () => {
  const ar = intro.STR.ar;
  const en = intro.STR.en;
  assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort(), "لغة ناقصة عن الأخرى");
  for (const id of intro.STEP_ORDER) {
    const left = ar.steps[id];
    const right = en.steps[id];
    assert.ok(left && right, `خطوة بلا ترجمة: ${id}`);
    assert.equal(left.parts.length, right.parts.length, `${id}: عدد المقاطع`);
    assert.equal(left.links.length, right.links.length, `${id}: عدد الروابط`);
    left.parts.forEach((part, position) => {
      const other = right.parts[position];
      assert.equal(part.type, other.type, `${id}: نوع المقطع ${position}`);
      assert.equal(Boolean(part.text), Boolean(other.text), `${id}: نصّ المقطع ${position}`);
      if (part.type === "list") {
        assert.equal(part.items.length, other.items.length, `${id}: عدد عناصر القائمة`);
        part.items.forEach((item, i) => {
          assert.ok(item.trim() && other.items[i].trim(), `${id}: عنصر قائمة فارغ`);
        });
      }
      if (part.type === "cards") {
        assert.deepEqual(part.items.map((card) => card.href), other.items.map((card) => card.href),
          `${id}: روابط البطاقات`);
        part.items.forEach((card, i) => {
          assert.ok(card.label.trim() && other.items[i].label.trim(), `${id}: بطاقة بلا اسم`);
        });
      }
    });
    for (const key of ["emoji", "title"]) {
      assert.ok(String(left[key]).trim() && String(right[key]).trim(), `${id}.${key} ناقص`);
    }
  }
  for (const key of ["close", "skip", "prev", "next", "start", "kicker", "dialogLabel"]) {
    assert.ok(String(ar[key]).trim() && String(en[key]).trim(), `نصّ ناقص: ${key}`);
  }
});

test("عدّاد الخطوة بأرقامٍ عربية، والإنجليزي بأرقامه", () => {
  assert.equal(intro.STR.ar.stepOf(2, 5), "الخطوة ٢ من ٥");
  assert.equal(intro.STR.en.stepOf(2, 5), "Step 2 of 5");
});

/* ------------------------------------------------- النافذة على شجرة مُصطنعة */

test("الجولة تفتح خطوةً خطوة، وأسماؤها ظاهرة، وآخر خطوةٍ تبدأ", () => {
  const env = withBrowser({ [intro.SEEN_KEY]: intro.VERSION });
  try {
    const tour = intro.boot({ button: env.doc.createElement("button"), catalogs: CATALOG });
    assert.deepEqual(tour.steps(), intro.STEP_ORDER);

    tour.open(0);
    const dialog = env.doc.getElementById("itModal");
    assert.ok(dialog, "النافذة لم تُبنَ");
    assert.equal(dialog.open, true, "النافذة لم تُفتح");
    assert.equal(dialog.tagName, "DIALOG");
    assert.equal(dialog.getAttribute("aria-label"), intro.STR.ar.dialogLabel);

    assert.equal(dialog.querySelector("#itTitle").textContent, intro.STR.ar.steps.welcome.title);
    assert.equal(dialog.querySelector("#itKicker").textContent, "الخطوة ١ من ٥ · دليل المكتبة");
    assert.equal(dialog.querySelector("#itPrev").disabled, true, "السابق يعمل في أوّل خطوة");
    assert.equal(next(dialog).textContent, "التالي");
    assert.equal(dialog.querySelectorAll(".it-dot").length, 5, "نقاط الخطوات");

    /* السهم الأيسر يتقدّم في RTL، والأيمن يرجع. */
    press(dialog, "ArrowLeft");
    assert.equal(dialog.querySelector("#itTitle").textContent, intro.STR.ar.steps.today.title);
    press(dialog, "ArrowRight");
    assert.equal(dialog.querySelector("#itTitle").textContent, intro.STR.ar.steps.welcome.title);

    /* الخطوة الثالثة تعرض أقسام الفهرس كما هي، بروابطها. */
    click(next(dialog));
    click(next(dialog));
    const sections = dialog.querySelectorAll(".it-sec");
    assert.equal(dialog.querySelector("#itTitle").textContent, intro.STR.ar.steps.sections.title);
    assert.equal(sections.length, 1, "أقسام الجولة لا تطابق الفهرس");
    assert.equal(sections[0].getAttribute("href"), "#sec-dhikr");
    assert.equal(sections[0].querySelector(".it-sec-count").textContent, "١٢");

    /* وآخر خطوة: زرّ البداية، والضغط عليه يُغلق. */
    click(next(dialog));
    click(next(dialog));
    assert.equal(next(dialog).textContent, "ابدأ الآن");
    assert.ok(dialog.querySelectorAll(".it-card").length >= 3, "بطاقات البداية ناقصة");
    assert.equal(dialog.querySelector("#itPrev").disabled, false);

    click(next(dialog));
    assert.equal(dialog.open, false, "البداية أغلقت النافذة");
    assert.equal(env.map.get(intro.SEEN_KEY), intro.VERSION, "لم يُحفظ أنه رأى الجولة");
  } finally {
    env.cleanup();
  }
});

test("السابق في أوّل خطوة لا يتقدّر، والتخطّي يُغلق ويحفظ", () => {
  const env = withBrowser({ [intro.SEEN_KEY]: intro.VERSION });
  try {
    const tour = intro.boot({ button: env.doc.createElement("button"), catalogs: CATALOG });
    tour.open(0);
    const dialog = env.doc.getElementById("itModal");
    press(dialog, "ArrowRight");
    assert.equal(dialog.querySelector("#itKicker").textContent, "الخطوة ١ من ٥ · دليل المكتبة");
    assert.equal(env.map.has(intro.SEEN_KEY), true);
    click(dialog.querySelector("#itSkip"));
    assert.equal(dialog.open, false, "التخطّي لم يُغلق");
  } finally {
    env.cleanup();
  }
});

test("الجولة تظهر أوّل فتح، ولا تتكرّر على من رأها", async () => {
  const env = withBrowser();
  try {
    const tour = intro.boot({ button: env.doc.createElement("button"), catalogs: CATALOG });
    assert.equal(tour.isOpen(), false, "فتحت قبل أوّل مرة");
    await new Promise((resolve) => setTimeout(resolve, intro.AUTO_OPEN_MS + 80));
    assert.equal(tour.isOpen(), true, "لم تُعرّف بالزائر الجديد");
    tour.close();
    assert.equal(env.map.get(intro.SEEN_KEY), intro.VERSION);
  } finally {
    env.cleanup();
  }

  const again = withBrowser({ [intro.SEEN_KEY]: intro.VERSION });
  try {
    const tour = intro.boot({ button: again.doc.createElement("button"), catalogs: CATALOG });
    await new Promise((resolve) => setTimeout(resolve, intro.AUTO_OPEN_MS + 80));
    assert.equal(tour.isOpen(), false, "تكرّرت على من رأها من قبل");
    /* ويظلّ الزرّ متاحًا دائمًا لمن أراد إعادتها. */
    tour.open(0);
    assert.equal(tour.isOpen(), true, "الزرّ لا يفتح الجولة");
  } finally {
    again.cleanup();
  }
});

test("الجولة تفتح من الزرّ نفسه، وتحتسب لغة الصفحة", () => {
  const env = withBrowser({ [intro.SEEN_KEY]: intro.VERSION });
  try {
    const button = env.doc.createElement("button");
    button.setAttribute("id", "introBtn");
    env.doc.body.appendChild(button);
    intro.boot({ catalogs: CATALOG });
    button.dispatch("click", { target: button });
    const dialog = env.doc.getElementById("itModal");
    assert.ok(dialog, "الزرّ لم يفتح الجولة");
    assert.equal(dialog.querySelector("#itTitle").textContent, intro.STR.ar.steps.welcome.title);

    /* خطوةٌ محفوظة: الجولة اليدوية تبدأ من حيث توقّف الزائر. */
    dialog.close();
    env.map.set(intro.STEP_KEY, "2");
    button.dispatch("click", { target: button });
    assert.equal(
      env.doc.getElementById("itModal").querySelector("#itKicker").textContent,
      "الخطوة ٣ من ٥ · دليل المكتبة",
      "الجولة اليدوية لا تبدأ من حيث توقّف الزائر",
    );
    /* ومن انتهى منها تبدأ من أوّلها، لا من آخر خطوةٍ محفوظة. */
    env.doc.getElementById("itModal").close();
    env.map.set(intro.STEP_KEY, "4");
    button.dispatch("click", { target: button });
    assert.equal(
      env.doc.getElementById("itModal").querySelector("#itKicker").textContent,
      "الخطوة ١ من ٥ · دليل المكتبة",
      "من أكمل الجولة لا يبدأ من آخر خطوة",
    );
  } finally {
    env.cleanup();
  }
});

test("أقسام الفهرس تُقرأ من الصفحة: الاسم والعدد والوصف", () => {
  const env = withBrowser();
  try {
    const doc = env.doc;
    const cats = doc.make("nav");
    cats.setAttribute("id", "cats");
    for (const item of CATALOG) {
      const button = doc.make("button");
      button.setAttribute("data-cat", item.id);
      button.textContent = item.name;
      cats.appendChild(button);
    }
    const sections = doc.make("div");
    sections.setAttribute("id", "sections");
    const block = doc.make("div");
    block.setAttribute("id", "sec-dhikr");
    block.setAttribute("data-blurb", CATALOG[0].blurb);
    const heading = doc.make("h2");
    heading.className = "h";
    const name = doc.make("span");
    name.textContent = "أذكار وأدعية";
    const counter = doc.make("span");
    counter.className = "section-count";
    counter.textContent = "12";
    heading.appendChild(name);
    heading.appendChild(counter);
    block.appendChild(heading);
    sections.appendChild(block);
    doc.body.appendChild(cats);
    doc.body.appendChild(sections);

    const read = intro.catalogsFromDocument();
    assert.equal(read.length, 1);
    assert.equal(read[0].id, "dhikr");
    assert.equal(read[0].name, "أذكار وأدعية", "الاسم من العدّاد لا من الشريط");
    assert.equal(read[0].count, "12");
    assert.equal(read[0].blurb, CATALOG[0].blurb);
    assert.equal(read[0].href, "#sec-dhikr");
  } finally {
    env.cleanup();
  }
});

/* ------------------------------------------------- التخزين */

test("الجولة تعمل بلا حفظ: تخزينٌ محظور لا يُسقطها", () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("محظور");
    },
  });
  try {
    assert.equal(intro.hasSeen(), false);
    assert.equal(intro.savedStep(5), 0);
  } finally {
    if (before) Object.defineProperty(globalThis, "localStorage", before);
    else delete globalThis.localStorage;
  }
});

test("الخطوة المحفوظة لا تتجاوز حدود الجولة، ونسخةٌ أقدم تُعيد العرض", () => {
  const map = new Map();
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
  try {
    assert.equal(intro.hasSeen(), false);
    assert.equal(intro.savedStep(5), 0);
    globalThis.localStorage.setItem(intro.STEP_KEY, "3");
    assert.equal(intro.savedStep(5), 3);
    globalThis.localStorage.setItem(intro.STEP_KEY, "99");
    assert.equal(intro.savedStep(5), 4, "خطوةٌ خارج الجولة");
    globalThis.localStorage.setItem(intro.SEEN_KEY, intro.VERSION);
    assert.equal(intro.hasSeen(), true, "الجولة تتكرّر على من رأاها");
    globalThis.localStorage.setItem(intro.SEEN_KEY, "0");
    assert.equal(intro.hasSeen(), false, "نسخةٌ أقدم تُعاد الجولة على أساسها");
  } finally {
    if (before) Object.defineProperty(globalThis, "localStorage", before);
    else delete globalThis.localStorage;
  }
});
