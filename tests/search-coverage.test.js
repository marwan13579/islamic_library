"use strict";

/**
 * تغطية البحث الموحّد: مصادر المحتوى، والمطابقة بكلماته، والوصول من كل صفحة.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const fileUrl = (rel) => `file://${path.join(ROOT, rel)}`;

/** يقرأ ملفات JSON التي يطلبها محرّك البحث في المتصفّح. */
function stubFetch() {
  return async (target) => {
    // المحرّك يطلب روابطَ مطلقة (محسوبةً من وحداته)، والصفحات طلباتٍ نسبية.
    const raw = String(target);
    const rel = raw.startsWith("file://")
      ? path.relative(ROOT, decodeURIComponent(new URL(raw).pathname))
      : raw.includes("/content/")
        ? raw.slice(raw.indexOf("/content/") + 1)
        : raw.replace(/^\.?\//, "");
    try {
      return { ok: true, json: async () => JSON.parse(read(rel)) };
    } catch {
      return { ok: false, json: async () => ({}) };
    }
  };
}

// المصادر الكسولة (مدوّدة النصوص) تُحمَّل أوّلَ بحثٍ بعدها، فلا يكفي أن
// يكون بديلُ الشبكة مركَّبًا أثناء التسجيل: يبقى بديلُ الملفات طوال الملف،
// وإلّا خرج البحث النصّي إلى شبكةٍ حقيقية في الاختبار.
globalThis.fetch = stubFetch();

async function loadSearch() {
  const content = await import(fileUrl("src/lib/search-content.js"));
  await content.registerDataSources();
  const registry = await import(fileUrl("src/lib/search-registry.js"));
  const unified = await import(fileUrl("src/lib/unified-search.js"));
  return { ...content, ...registry, ...unified };
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
  assert.match(modal, /import \{[^}]*registerDataSources[^}]*\} from "\.\.\/lib\/search-content\.js"/, "النافذة لا ترفع التسجيل");
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
    questions: "الصلاة",
    appathkar: "الاستغفار",
    daily: "سنتي",
    cities: "القاهرة",
    hijri: "عاشوراء",
    stations: "إذاعة",
    sections: "أعلام",
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

/* ------------------------------------------------- نصّ القرآن والتفسير وغريبه */

test("☑ المدوّدة: مبنيّةٌ من مصادرها ومطابقةٌ لها", () => {
  const check = spawnSync(
    process.execPath,
    [path.join(ROOT, "scripts/build-search-corpora.cjs"), "--check"],
    { encoding: "utf8" },
  );
  assert.equal(check.status, 0, `مدوّدة البحث لا تطابق مصادرها:\n${check.stderr}`);

  const manifest = JSON.parse(read("content/corpora/manifest.json"));
  assert.deepEqual(
    Object.keys(manifest.corpora).sort(),
    ["hisn", "quran", "siraj", "tafsir"],
    "مدوّدات البحث تغيّرت: إمّا أُضيف مصدرٌ وإلّا سقط",
  );

  // قاعدة المشروع: لا ملفّ في `content/` يتجاوز حدّ التحميل، والمدوّدةُ
  // أجزاء. partesُ مدوّدةٍ واحدة يجب أن تُشغّل البحث معًا، فحجمُها وحده لا يكفي.
  for (const [name, info] of Object.entries(manifest.corpora)) {
    assert.ok(info.files >= 1, `${name}: بلا أجزاء`);
    assert.ok(info.rows > 0, `${name}: بلا صفوف`);
    for (const file of fs.readdirSync(path.join(ROOT, "content/corpora", name))) {
      const size = fs.statSync(path.join(ROOT, "content/corpora", name, file)).size;
      assert.ok(size <= 650 * 1024, `${name}/${file} كبير: ${size}`);
    }
  }
});

test("☑ المدوّدة: آيات المصحف تُبحث بنصّها وتفتح موضعها", async () => {
  const { registry } = await loadSearch();
  const source = registry.get("corpusQuran");
  assert.ok(source, "مصدر آيات المصحف مفقود");
  assert.equal(source.lazy, true, "المدوّدة يجب أن تُحمَّل عند الحاجة لا مع النافذة");

  // لفظٌ من آية بلفظها، بلا تشكيل.
  const byText = await source.search("الحمد لله رب العالمين");
  assert.ok(byText.length, "لم يجد البحثُ آيةً بلفظها");
  assert.equal(byText[0].title, "سورة الفاتحة: ٢");
  assert.equal(byText[0].route, "30-quran-full.html?s=1&a=2");

  // «البقرة ٢٥٥»: سورةٌ برقمها ورقم آيتها، لا أي آية رقمُها ٢٥٥.
  const byNumber = await source.search("البقرة 255");
  assert.equal(byNumber[0].title, "سورة البقرة: ٢٥٥");
  assert.equal(byNumber.filter((r) => r.title === "سورة البقرة: ٢٥٥").length, 1);

  // موضعٌ في المصحف بسؤالٍ عن الجزء.
  const juz = await source.search("الجزء 30");
  assert.ok(juz.some((r) => /الجزء ٣٠/.test(r.title)), "لا نتيجة لموضع الجزء");
});

test("☑ المدوّدة: التفسير وغريب القرآن يفتحان بلفظهما", async () => {
  const { registry } = await loadSearch();

  const tafsir = await registry.get("corpusTafsir").search("الحمد لله رب العالمين");
  assert.ok(tafsir.length, "التفسير لا يُبحث فيه بنصّه");
  assert.match(tafsir[0].route, /^35-tafsir\.html\?s=\d+$/, "رابط التفسير بلا سورة");

  const { normalizeAr } = await import(fileUrl("src/lib/text.js"));
  const siraj = await registry.get("corpusSiraj").search("اقسط");
  assert.ok(siraj.length, "معاني غريب القرآن لا تُبحث فيها");
  // اللفظ معروضٌ مشكولًا كما في المصدر، فيُقارَن بعد التطبيع.
  assert.match(normalizeAr(siraj[0].title), /قسط/, "لم يُعثر على اللفظ في معانيه");
  assert.ok(siraj[0].description.trim().length, "معنى اللفظ فارغ");
  assert.match(siraj[0].route, /^43-siraj\.html\?s=\d+/, "رابط الغريب بلا موضع");
});

test("☑ المدوّدة: نصوص حصن المسلم تفتح بابها", async () => {
  const { registry } = await loadSearch();
  const hisn = await registry.get("corpusHisn").search("عذاب القبر");
  assert.ok(hisn.length, "نصوص حصن المسلم لا تُبحث فيها");
  for (const result of hisn) {
    assert.match(result.route, /^36-hisn\.html\?no=\d+$/, "ذكرٌ بلا بابه");
  }
});

test("☑ المدوّدة: لا تُحمَّل مع فتح النافذة", async () => {
  const { registry } = await loadSearch();
  // كل مصادر المدوّدة كسولة: فتح النافذة لا يجلب أربعة ميغابايت.
  for (const id of ["corpusQuran", "corpusTafsir", "corpusSiraj", "corpusHisn"]) {
    assert.equal(registry.get(id).lazy, true, `${id}: مصدر مدوّدةٍ ليس كسولًا`);
  }
  assert.ok(
    registry.getAll().some((source) => !source.lazy),
    "لا مصدر سريع بلا مدوّدة",
  );
});

test("☑ البحث: التسجيل لا يتكرّر ولا يُعطّل مصدرٌ واحد", async () => {
  const { registry, registerDataSources } = await loadSearch();
  const before = registry.getAll().length;
  await registerDataSources();
  await registerDataSources();
  assert.equal(registry.getAll().length, before, "المصادر تتراكم عند الاستدعاء مرّتين");

  // ملف JSON مفقود: مصدره وحده يسقط، ولا يسقط معه شيءٌ آخر.
  const good = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
  try {
    const fresh = await import(`${fileUrl("src/lib/search-content.js")}?fresh=1`);
    await fresh.registerDataSources();
    const { searchAll } = await import(fileUrl("src/lib/unified-search.js"));
    const { results } = await searchAll("الزكاة", { limit: 5 });
    assert.ok(results.length, "سقوط ملف JSON أسقط البحث كلّه");
  } finally {
    globalThis.fetch = good;
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

test("☑ التبويبات: كل فئةٍ في الشريط تُنتج نتائج، ولا واحدة ميتة", () => {
  return (async () => {
    const modal = read("src/components/search-modal.js");
    const declared = [...modal.matchAll(/\{ id: "([^"]+)", label:/g)]
      .map((m) => m[1])
      .filter((id) => id !== "all");
    assert.ok(declared.length > 20, `فئات قليلة: ${declared.length}`);

    const { registry, resultCategories } = await loadSearch();
    const possible = new Set(resultCategories());
    const dead = declared.filter((id) => !possible.has(id));
    assert.deepEqual(dead, [], "تبويبات لفئاتٍ لا تُنتج نتائج أبدًا");

    // والفئات التي تنتج نتائج لا بدّ أن يكون لها مكانٌ في الشريط، وإلّا
    // ولا سبيل إلى تصفيتها باللمس.
    const listed = new Set(declared);
    const missing = [...possible].filter((id) => !listed.has(id));
    assert.deepEqual(missing, [], "فئاتٌ تُنتج نتائج ولا يستطيع المستخدم تصفّيها");
  })();
});

test("☑ المدوّدة: تُخدَم من ذاكرة عامل الخدمة فتعمل دون اتصال", () => {
  const sw = read("sw.js");
  // المحتوى على شبكة التوزيع (gh-pages) له ذاكرة منفصلة تُخزَّن
  // عند الطلب، فالمدوّدة تعمل بلا شبكةٍ بعد أول تحميل. والمهمّ
  // ألّا تُعامل كصفحةٍ (navigation).
  assert.match(sw, /contentStrategy/, "لا ذاكرة محتوى في عامل الخدمة");
  assert.match(sw, /CONTENT_CDN_ORIGIN/, "أصل شبكة توزيع المحتوى غير مذكور");
  // المدوّدة ٤ ميغابايت: تُخدَم من ذاكرة المحتوى عند الطلب، ولا تُحمَّل مسبقًا.
  assert.doesNotMatch(sw, /"\.\/content\/corpora/, "المدوّدة في التحميل المسبق وهي كبيرة");
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