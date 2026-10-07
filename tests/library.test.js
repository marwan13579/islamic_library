"use strict";

/**
 * اختبارات وحدات المكتبة المستوردة: التقسيم، والقراءة، والبحث.
 *
 * الملفات حقيقية في `content/`، والاختبار يقرأها من القرص كما تفعل
 * الصفحة: `fetch` مزيّف يقرأ المسار، و`localStorage` في الذاكرة.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

/* ------------------------------------------------ بيئة تشغيل الصفحة */

const store = new Map();

/** يقرأ `content/...` من القرص كما يقرأها المتصفح من الشبكة. */
function installBrowser() {
  global.fetch = async (url) => {
    const rel = String(url).replace(/^.*content\//, "");
    const file = path.join(root, "content", rel);
    if (!fs.existsSync(file)) return { ok: false, status: 404 };
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(file, "utf8")) };
  };
  global.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
}

installBrowser();

const shards = () => import(`file://${path.join(root, "src/lib/shards.js")}`);
const library = () => import(`file://${path.join(root, "src/lib/library.js")}`);
const search = () => import(`file://${path.join(root, "src/lib/search.js")}`);

/* ------------------------------------------------------ التقسيم */

test("لا جزء في المكتبة يتجاوز حدّ التحميل", async () => {
  const s = await shards();
  const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(abs));
      else if (entry.name.endsWith(".json")) out.push(abs);
    }
    return out;
  };
  const files = walk(path.join(root, "content"));
  assert.ok(files.length > 500, `الملفات المولّدة قليلة: ${files.length}`);

  /* الجزء الواحد في المكتبة كله لا يتجاوز ٦٥٠ كيلوبايت، وإلا تعلّقت
     الصفحة الأولى على شبكة بطيئة. */
  const LIMIT = 650 * 1024;
  const heavy = files
    .map((f) => [path.relative(root, f), fs.statSync(f).size])
    .filter(([, size]) => size > LIMIT);
  assert.deepEqual(heavy, [], "أجزاء تتجاوز الحدّ");
});

test("البيان يعلن ما بُني فعلًا", async () => {
  const s = await shards();
  const manifest = await s.manifest();
  for (const [type, meta] of Object.entries(manifest.collections)) {
    const built = await s.collectionMeta(type);
    assert.equal(built.count, meta.count, `عدد ${type} لا يطابق البيان`);
    assert.equal(built.listFiles.length, meta.listFiles, `قوائم ${type} لا تطابق`);
    assert.equal(built.itemFiles.length, meta.itemFiles, `أجزاء ${type} لا تطابق`);
    assert.equal(built.categories.length, meta.categories, `تصنيفات ${type} لا تطابق`);
  }
});

test("كل موضع في القوائم يشير إلى عنصر موجود", async () => {
  const s = await shards();
  const groups = Object.keys((await s.manifest()).collections);
  for (const type of groups) {
    const meta = await s.collectionMeta(type);
    /* عيّنة من ثلاث قوائم تكفي: الموضع يولّده البناء لكل عنصر. */
    for (const index of [0, Math.floor(meta.listFiles.length / 2), meta.listFiles.length - 1]) {
      const rows = await s.listShard(type, index);
      const sample = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]];
      for (const row of sample.filter(Boolean)) {
        const items = await s.itemShard(type, row.p[0]);
        assert.ok(items[row.p[1]], `${type}: موضع ${JSON.stringify(row.p)} فارغ`);
        assert.equal(items[row.p[1]].id, row.id, `${type}: الموضع يشير لعنصر آخر`);
      }
    }
  }
});

test("دليل المعرّفات يجد كل معرّف في مجموعته", async () => {
  const lib = await library();
  const groups = ["fatwa", "khutbahs", "history", "quiz"];
  for (const type of groups) {
    const first = await lib.browse(type, { page: 1, perPage: 5 });
    for (const row of first.items) {
      const where = await lib.findWhere(type, row.id);
      assert.deepEqual(where, row.p, `${type}: ${row.id}`);
    }
    assert.equal(await lib.findWhere(type, "لا-يوجد-هذا"), null);
  }
});

/* ------------------------------------------------------- القراءة */

test("التصفح يعيد صفحة بترتيبها وعددها", async () => {
  const lib = await library();
  const first = await lib.browse("fatwa", { page: 1 });
  assert.equal(first.items.length, 30);
  assert.equal(first.page, 1);
  assert.ok(first.pages > 100, `عدد الصفحات غير متوقع: ${first.pages}`);
  assert.ok(first.hasMore);

  const second = await lib.browse("fatwa", { page: 2 });
  assert.notDeepEqual(first.items[0].id, second.items[0].id);
});

test("التصنيف يعيد عناصره وحدها", async () => {
  const lib = await library();
  const meta = await (await shards()).collectionMeta("khutbahs");
  const group = meta.categories[0];
  const page = await lib.browseCategory("khutbahs", group.name, { page: 1 });
  assert.ok(page.items.length, `تصنيف «${group.name}» فارغ`);
  for (const row of page.items) {
    assert.ok(row.c.includes(group.name), `${row.id} ليس في تصنيفه`);
  }
});

test("العنصر يقرأ بنصّه ومصادره", async () => {
  const lib = await library();
  const list = await lib.browse("fatwa", { page: 1, perPage: 3 });
  const row = list.items[0];
  const item = await lib.readItem("fatwa", row.id);
  assert.equal(item.id, row.id);
  assert.equal(item.title, row.ti);
  assert.ok(item.content.length > 100, "النص قصير أو فارغ");
  assert.ok(Array.isArray(item.refs), "لا مصادر");
});

test("التفسير يفتح سورة وآية منها", async () => {
  const lib = await library();
  const sura = await lib.readSurah(2);
  assert.equal(sura.no, 2);
  assert.equal(sura.ayat.length, 286);
  assert.ok(sura.ayat[254].t.length > 10, "نص آية الكرسي مفقود");

  const aya = await lib.readItem("tafsir", "tafsir-2-255");
  assert.equal(aya.surah, 2);
  assert.equal(aya.ayah, 255);
  assert.ok(aya.text.length > 10);
  assert.ok(aya.content.length > 50, "تفسير الآية فارغ");

  /* الحدود: رقم سورة خارج المدى لا يرمي بل يعود بلا شيء. */
  assert.equal(await lib.readSurah(0), await lib.readSurah(1));
});

test("حصن المسلم يفتح بابًا بذكراه وصوته", async () => {
  const lib = await library();
  const bab = await lib.readBab(1);
  assert.equal(bab.no, 1);
  assert.ok(bab.items.length >= 20, `أذكار الباب قليلة: ${bab.items.length}`);
  assert.match(bab.audio, /\.mp3$/);

  const opened = await lib.readItem("hisn", "hisn-1");
  assert.equal(opened.bab, 1);
  assert.ok(opened.content.includes(opened.items[0].t.slice(0, 20)));
});

/* ------------------------------------------------------- المفضّلة */

test("المفضّلة تُحفظ وتُزال في مكان واحد", async () => {
  const lib = await library();
  store.clear();
  assert.equal(lib.toggleBookmark("binbaz-1"), true);
  assert.ok(lib.isBookmarked("binbaz-1"));
  assert.equal(lib.toggleBookmark("binbaz-1"), false);
  assert.equal(lib.isBookmarked("binbaz-1"), false);
});

/* -------------------------------------------------------- البحث */

test("التطبيع العربي يجعل «الصلاة» و«الصلاه» مصطلحًا واحدًا", async () => {
  const s = await search();
  assert.deepEqual(s.tokenize("الصَّلَاةِ"), s.tokenize("الصلاه"));
  assert.deepEqual(s.tokenize("أبو بكر"), s.tokenize("ابو بكر"));
  /* الترقيم والأرقام الهندية لا تكسر المطابقة. */
  assert.deepEqual(s.tokenize("الآية ٢٥٥"), s.tokenize("الايه 255"));
});

test("التظليل يحيط بالكلمة ولا يبتلع التشكيل", () => {
  const s = require("node:module");
  return import(`file://${path.join(root, "src/lib/search.js")}`).then((m) => {
    const out = m.highlight("فَإِنَّ مَعَ الْعُسْرِ يُسْرًا", ["اليسر", "العسر"]);
    assert.equal(out, "فَإِنَّ مَعَ [[H]]الْعُسْرِ[[/H]] يُسْرًا");
    assert.ok(out.includes("الْعُسْرِ"), "ابتلع التشكيل داخل الكلمة");
  });
});

test("البحث يجد العنصر الصحيح في نوعه", async () => {
  const s = await search();
  const hit = await s.search("صلاة الاستخارة", { limit: 5 });
  assert.ok(hit.total > 20, `نتائج قليلة: ${hit.total}`);
  assert.ok(hit.results.length);
  for (const row of hit.results) {
    assert.ok(row.id && row.type && row.title);
    assert.ok(row.score > 0);
  }
});

test("البحث يغطّي التفسير وحصن المسلم", async () => {
  const s = await search();
  const tafsir = await s.search("الصلاة", { limit: 10, type: "tafsir" });
  assert.ok(tafsir.total > 20, `تفسير قليل: ${tafsir.total}`);
  for (const row of tafsir.results) {
    assert.equal(row.type, "tafsir");
    assert.ok(Array.isArray(row.extra), "لا رقم السورة");
  }

  const hisn = await s.search("دعاء الاستخارة", { limit: 5, type: "hisn" });
  assert.ok(hisn.total > 0, "لا باب في حصن المسلم");
});

test("النص المرجعي يسبق بنك الاختبارات", async () => {
  const s = await search();
  const hit = await s.search("الصلاة", { limit: 10 });
  assert.ok(hit.results.length >= 5);
  assert.notEqual(hit.results[0].type, "quiz", "السؤال يسبق الفتوى");
});

test("بحث فارغ أو بلا نتيجة لا يرمي", async () => {
  const s = await search();
  assert.deepEqual(await s.search(""), { results: [], total: 0, more: false });
  assert.deepEqual(await s.search("!!! 123 ??? "), { results: [], total: 0, more: false });
  const miss = await s.search("زقزقةChunks");
  assert.ok(miss.total === 0 || miss.results.length === 0);
});

test("ترتيب «الأحدث» لا يقرأ إلا جزءًا واحدًا مهما كبرت المجموعة", async () => {
  const lib = await library();
  const s = await shards();
  const meta = await s.collectionMeta("fatwa");
  assert.ok(meta.listFiles.length > 20, `عدد قوائم الفتاوى غير كافٍ للاختبار: ${meta.listFiles.length}`);

  /* الفتاوى بلا تاريخ، فترتيبُها بالتاريخ مستحيل، والقوائم مرتّبة
     بترتيب المصدر. وكان الطريق يمرّ بكل القوائم — عشرة ميغابايت — لأن
     شرط التاريخ كان يمنع المسار الخفيف. الآن «الأحدث» نافذة من طرف
     القوائم لا غير. */
  s.trim({ keepManifest: false });
  const realFetch = global.fetch;
  const read = [];
  global.fetch = async (url) => {
    read.push(String(url));
    return realFetch(url);
  };
  try {
    for (const page of [1, 2, 7]) {
      read.length = 0;
      const out = await lib.browse("fatwa", { page });
      assert.equal(out.items.length, 30);
      const lists = read.filter((u) => /list\/\d+\.json$/.test(u));
      assert.ok(lists.length <= 2, `الصفحة ${page} قرأت ${lists.length} قائمة بدل واحدة`);
    }
  } finally {
    global.fetch = realFetch;
  }
});

test("الترتيب بغير الافتراضي لا يتداخل بين صفحاته", async () => {
  const lib = await library();
  /* كل صفحة تُقتطع من ترتيب القوائم كله بعدّاده، لا من نافذتها وحدها.
     وكان يُرتَّب كل نافذة وحدها فتتشابك الصفحات. */
  for (const type of ["quiz", "fatwa", "khutbahs"]) {
    const first = await lib.browse(type, { page: 1, sort: "oldest" });
    const second = await lib.browse(type, { page: 2, sort: "oldest" });
    assert.equal(first.items.length, 30, type);
    const seen = new Set(first.items.map((row) => row.id));
    const overlap = second.items.filter((row) => seen.has(row.id));
    assert.deepEqual(overlap, [], `${type}: تكرّرت عناصر بين الصفحتين`);
  }
});

/* ------------------------------------------------------ الذاكرة */

test("الملف الواحد يُقرأ مرة واحدة مهما تكرّر الطلب", async () => {
  const s = await shards();
  /* الذاكرة ممتلئة من الاختبارات السابقة، فنفرغها ونبدأ من الصفر. */
  s.trim({ keepManifest: false });
  let calls = 0;
  const realFetch = global.fetch;
  global.fetch = async (url) => {
    calls += 1;
    return realFetch(url);
  };
  const target = "library/quiz/meta.json";
  const [a, b, c] = await Promise.all([s.load(target), s.load(target), s.load(target)]);
  assert.equal(calls, 1, `طُلب الملف ${calls} مرة`);
  assert.equal(a, b);
  assert.equal(b, c);
  assert.equal(s.cacheStats().cached, 1, "الملف لم يُخزَّن");
  assert.equal(s.cacheStats().pending, 0, "بقي طلب معلّق");
  global.fetch = realFetch;
});