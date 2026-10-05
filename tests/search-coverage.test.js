"use strict";

/**
 * تغطية البحث الموحّد: مصادر المحتوى، والمطابقة بكلماته، والوصول من كل صفحة.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const fileUrl = (rel) => `file://${path.join(ROOT, rel)}`;

/** يقرأ ملفات JSON التي يطلبها محرّك البحث في المتصفّح. */
function stubFetch() {
  return async (target) => {
    const rel = String(target).replace(/^\.?\//, "");
    try {
      return { ok: true, json: async () => JSON.parse(read(rel)) };
    } catch {
      return { ok: false, json: async () => ({}) };
    }
  };
}

async function loadSearch() {
  const original = globalThis.fetch;
  globalThis.fetch = stubFetch();
  try {
    const content = await import(fileUrl("src/lib/search-content.js"));
    await content.registerDataSources();
    const registry = await import(fileUrl("src/lib/search-registry.js"));
    const unified = await import(fileUrl("src/lib/unified-search.js"));
    return { ...content, ...registry, ...unified };
  } finally {
    globalThis.fetch = original;
  }
}

/* ------------------------------------------------------- التسجيل المركزي */

test("☑ البحث: المصادر تُسجَّل مركزيًا لا في الفهرس وحده", async () => {
  const content = read("src/lib/search-content.js");
  assert.match(content, /export function registerDataSources\(\)/, "لا دالّة تسجيل مركزية");

  const index = read("index.html");
  assert.doesNotMatch(index, /registerArraySource/, "الفهرس ما زال يسجّل يدويًّا");
  assert.match(index, /registerDataSources\(\)/, "الفهرس لا يستدعي التسجيل المركزي");

  // النافذة نفسها تستدعيه، فالصفحة التي لا تستدعيه تجد المصادر عند فتحها.
  const modal = read("src/components/search-modal.js");
  assert.match(modal, /import \{ registerDataSources \} from "\.\.\/lib\/search-content\.js"/, "النافذة لا ترفع التسجيل");
  assert.match(modal, /await registerDataSources\(\)\.catch/, "البحث لا ينتظر المصادر");
});

test("☑ البحث: كل مصدر يُعطي نتيجةً ذات عنوان ورابط لكلمة مفتاحه", async () => {
  const { registry } = await loadSearch();
  const expected = {
    hadiths: "نيات",
    adhkar: "النوم",
    duas: "السفر",
    appduas: "السفر",
    scholars: "الصديق",
    prophets: "نوح",
    names: "الرحمن",
    seerah: "الهجرة",
    lessons: "الغسل",
    manhaj: "العقيدة",
    kids: "الصلاة",
    qa: "السلفية",
    sayings: "اتبعوا",
    channels: "يقين",
    surahs: "الملك",
    reciters: "الحصري",
    radio: "إذاعة",
    azkarShamila: "الصباح",
    tools: "الزكاة",
    pages: "القرآن",
  };

  for (const [id, word] of Object.entries(expected)) {
    const source = registry.get(id);
    assert.ok(source, `مصدر مفقود: ${id}`);
    const results = await source.search(word);
    assert.ok(results.length, `${id}: لا نتيجة لـ«${word}»`);
    for (const result of results) {
      assert.equal(typeof result.title, "string", `${id}: عنوان غير نصّي`);
      assert.ok(result.title.trim().length, `${id}: نتيجة بلا عنوان لـ«${word}»`);
      assert.ok(result.route && result.route !== "#", `${id}: نتيجة بلا رابط`);
    }
  }
});

test("☑ البحث: التسجيل لا يتكرّر ولا يُعطّل مصدرٌ واحد", async () => {
  const { registry, registerDataSources } = await loadSearch();
  const before = registry.getAll().length;
  await registerDataSources();
  await registerDataSources();
  assert.equal(registry.getAll().length, before, "المصادر تتراكم عند الاستدعاء مرّتين");

  // ملف JSON مفقود: مصدره وحده يسقط، ولا يسقط معه شيءٌ آخر.
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
  try {
    const fresh = await import(`${fileUrl("src/lib/search-content.js")}?fresh=1`);
    await fresh.registerDataSources();
    const { searchAll } = await import(fileUrl("src/lib/unified-search.js"));
    const { results } = await searchAll("الزكاة", { limit: 5 });
    assert.ok(results.length, "سقوط ملف JSON أسقط البحث كلّه");
  } finally {
    globalThis.fetch = original;
  }
});

/* -------------------------------------------------------------- المطابقة */

test("☑ المطابقة: كل كلمات الاستعلام لازمة، والعنوان يقدّم على النصّ", () => {
  return (async () => {
    const { scoreItem } = await loadSearch();

    assert.equal(scoreItem({ title: "دعاء السفر" }, ""), null, "الاستعلام الفارغ لا يطابق");
    assert.equal(scoreItem({ title: "دعاء السفر" }, "دعاء السفرその他"), null, "كلمةٌ زائدة تُسقط المطابقة");

    const exact = scoreItem({ title: "دعاء السفر" }, "دعاء السفر");
    const title = scoreItem({ title: "دعاء السفر 고민" }, "دعاء السفر");
    const body = scoreItem({ title: "كتاب", description: " فيه دعاء السفر" }, "دعاء السفر");
    assert.equal(exact.matchType, "exact");
    assert.ok(exact.score > title.score, "العنوان بالضبط يقدّم على العنوان الجزئي");
    assert.ok(title.score > body.score, "العنوان يقدّم على الوصف");

    // «سفر» تطابق «السفر» لأنّ المطابقة تقبل بادئة الكلمة.
    assert.ok(scoreItem({ title: "دعاء السفر" }, "دعاء سفر"), "بادئة الكلمة لا تطابق");
  })();
});

test("☑ المطابقة: الاسم البديل يُحسب كالعنوان", () => {
  return (async () => {
    const { scoreItem } = await loadSearch();
    const withAlias = scoreItem({ title: "سورة الملك", aliases: ["الملك"] }, "الملك");
    const withoutAlias = scoreItem({ title: "سورة الملك" }, "الملك");
    assert.equal(withAlias.matchType, "exact", "الاسم المجرّد لا يُطابق");
    assert.ok(withAlias.score > withoutAlias.score);
  })();
});

test("☑ المطابقة: الاستعلام الخارج من المحرك مطبَّع فعلًا", () => {
  return (async () => {
    const { processQuery } = await loadSearch();
    const { normalizeAr } = await import(fileUrl("src/lib/text.js"));
    for (const query of ["أذكار الصباح", "اذكار المساء", "زكاة", "دعاء السفر"]) {
      const { normalized } = processQuery(query);
      assert.equal(
        normalized,
        normalizeAr(query),
        `«${query}» خرج غير مطبَّع: ${normalized}`,
      );
    }
  })();
});

test("☑ المطابقة: استعلام متعدّد الكلمات يجد نتيجته", async () => {
  const { searchAll } = await loadSearch();
  const cases = [
    ["أذكار الصباح", /الصباح/],
    ["دعاء السفر", /السفر/],
    ["سورة الملك", /الملك/],
    ["ركن الأطفال", /الأطفال|أطفال/],
  ];
  for (const [query, pattern] of cases) {
    const { results } = await searchAll(query, { limit: 10 });
    assert.ok(results.length, `لا نتائج لـ«${query}»`);
    assert.ok(
      results.some((r) => pattern.test(String(r.title)) || pattern.test(String(r.description))),
      `«${query}»: لم تظهر مطابقةٌ متوقّعة`,
    );
  }
});

/* --------------------------------------------------------------- المدخل */

test("☑ البحث: زرٌّ يفتح النافذة في صفحةٍ بلا حقل بحث", () => {
  const modal = read("src/components/search-modal.js");
  assert.match(modal, /function mountSearchTrigger\(\)/, "لا زرّ للبحث");
  assert.match(modal, /id = "searchFab"/, "الزرّ بلا مُعرِّف");
  assert.match(modal, /\.search-fab \{/, "الزرّ بلا تنسيق");
  // الصفحة التي فيها حقل بحث ظاهر لا تُزرع لها زرٌّ ثانٍ.
  assert.match(modal, /document\.getElementById\("search"\)/, "لا تحقّق من الحقل الموجود");
  // والنافذة لا تفتح على مرجعٍ فارغ إن لم تكن قد نُشئت بعد.
  assert.match(modal, /if \(!modal\) return;/, "الفتح لا يحرس غياب النافذة");
});

test("☑ البحث: صفحات المكتبة تُركّب النافذة", () => {
  const numbered = fs.readdirSync(ROOT).filter((name) => /^\d+-.*\.html$/.test(name));
  // صفحات الإشعار (تحويلٌ إلى صفحة أخرى، أو لوحة تنبيه) بلا سكربت وحدة، فتركيبُ
  // نافذةٍ فيها بلا معنى. سائر الصفحات صفحةٌ حيّة تُفتَّح منها النافذة.
  const notices = numbered.filter((name) => !/type="module"/.test(read(name)));
  const pages = numbered.filter((name) => !notices.includes(name));
  assert.ok(pages.length >= 40, `صفحات قليلة: ${pages.length}`);
  const missing = pages.filter((name) => !read(name).includes("search-modal.js"));
  assert.deepEqual(missing, [], "صفحات بلا نافذة بحث");
});