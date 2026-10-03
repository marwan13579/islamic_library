"use strict";

/**
 * فهرس الترتيب: دلالته أوّلا، وثمنه ثانيًا.
 *
 *   - `order.json` صورة محسوبة لـ`order()` في `src/lib/library.js`، فإذا
 *     افترقا اختلف ما يراه القارئ عن نية المولّد. الفحص يبني الترتيب
 *     بالطريقتين ويقارنهما عنصرًا عنصرًا، لكل مجموعة وكل فرز.
 *   - والثمن ثابت: صفحة واحدة تقرأ ملف الفهرس والجزء الذي تقع فيه،
 *     لا أكثر، مهما بَعُدت عن الأولى.
 *
 * الملفات حقيقية في `content/`، و`fetch` مزيّف يقرأ القرص كما تفعل الصفحة.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const TYPES = ["fatwa", "khutbahs", "history", "quiz"];

const store = new Map();

/** يخدم `content/...` من القرص، ويسجّل كل ما يُقرأ. */
let read = [];
function installBrowser() {
  read = [];
  global.fetch = async (url) => {
    const rel = String(url).replace(/^.*content\//, "");
    read.push(rel);
    const file = path.join(CONTENT, rel);
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

const shards = () => import(`file://${path.join(ROOT, "src/lib/shards.js")}`);
const library = () => import(`file://${path.join(ROOT, "src/lib/library.js")}`);

/** مفاتيح المقارنة كما في `order()` — تُعاد هنا عمدًا لاختبار الافتراق. */
function stamp(item) {
  const date = String(item.d ?? "").trim();
  if (date) return date;
  const m = /(\d+)$/.exec(String(item.id ?? ""));
  return m ? m[1].padStart(12, "0") : "";
}

/** الترتيب الكامل بالطريقة التي كانت تعمل قبل الفهرس. */
async function sortedByCode(type, sort) {
  const s = await shards();
  const meta = await s.collectionMeta(type);
  const rows = [];
  for (let i = 0; i < meta.listFiles.length; i += 1) rows.push(...(await s.listShard(type, i)));
  if (sort === "popular") return { rows, sorted: [...rows].sort((a, b) => b.r - a.r) };
  if (sort === "oldest") {
    return { rows, sorted: [...rows].sort((a, b) => stamp(a).localeCompare(stamp(b))) };
  }
  return { rows, sorted: [...rows].sort((a, b) => stamp(b).localeCompare(stamp(a))) };
}

/* ------------------------------------------------------ الدلالة */

test("فهرس الترتيب يطابق الترتيب المحسوب بالحرف", async () => {
  for (const type of TYPES) {
    for (const sort of ["newest", "oldest", "popular"]) {
      const index = JSON.parse(
        fs.readFileSync(path.join(CONTENT, "library", type, "order.json"), "utf8"),
      );
      /* مواضع الفهرس أشباح إلى ترتيب البناء، لا إلى الترتيب المرتَّب. */
      const { rows, sorted } = await sortedByCode(type, sort);
      const byIndex = index.orders[sort].map((at) => rows[at]);
      assert.deepEqual(
        byIndex.map((row) => row.id),
        sorted.map((row) => row.id),
        `${type}/${sort}: الفهرس غيّر الترتيب`,
      );
      assert.equal(index.count, rows.length, `${type}: عدد الفهرس لا يطابق`);
    }
  }
});

test("فهرس الترتيب تامّ: لا موضع ناقص ولا مكرّر", async () => {
  for (const type of TYPES) {
    const index = JSON.parse(
      fs.readFileSync(path.join(CONTENT, "library", type, "order.json"), "utf8"),
    );
    assert.equal(index.v, 1, `${type}: صيغة غير معروفة`);
    for (const [sort, list] of Object.entries(index.orders)) {
      assert.equal(list.length, index.count, `${type}/${sort}: الطول`);
      assert.equal(new Set(list).size, index.count, `${type}/${sort}: فيه تكرار`);
      for (const at of list) {
        assert.ok(Number.isInteger(at) && at >= 0 && at < index.count, `${type}/${sort}: موضع ${at}`);
      }
    }
  }
});

test("«الأحدث» يفرق عن «الأقدم» حيث لا تاريخ", async () => {
  const lib = await library();
  /* الفتاوى والتاريخ والاختبارات بلا تاريخ، فكان الحقل فارغًا ولا يفرق
     الفرز بين «الأحدث» و«الأقدم». وصار المفتاح номер المعرّف. */
  for (const type of ["fatwa", "history"]) {
    const newest = await lib.browse(type, { page: 1, perPage: 5, sort: "newest" });
    const oldest = await lib.browse(type, { page: 1, perPage: 5, sort: "oldest" });
    const serial = (id) => Number(/(\d+)$/.exec(id)[1]);
    assert.ok(
      serial(newest.items[0].id) > serial(oldest.items[0].id),
      `${type}: «الأحدث» لا تتقدّم على «الأقدم»`,
    );
  }
});

test("«الأقدم» أوّل الحدث في التاريخ الإسلامي", async () => {
  const lib = await library();
  const oldest = await lib.browse("history", { page: 1, perPage: 3, sort: "oldest" });
  assert.equal(Number(/(\d+)$/.exec(oldest.items[0].id)[1]), 1, "أوّل حدث ليس أقدمها");
});

test("الخطب المرتّبة بالتاريخ: الأحدث أولًا", async () => {
  const lib = await library();
  const newest = await lib.browse("khutbahs", { page: 1, perPage: 5, sort: "newest" });
  const dates = newest.items.map((row) => row.d);
  for (let i = 1; i < dates.length; i += 1) {
    assert.ok(dates[i - 1] >= dates[i], `التاريخ غير تنازلي: ${dates.join(" ")}`);
  }
});

/* ------------------------------------------------------ الثمن */

test("تحميل الصفحة ثابت مهما بَعُدت عن الأولى", async () => {
  const lib = await library();
  const s = await shards();
  for (const type of TYPES) {
    const meta = await s.collectionMeta(type);
    const lastPage = Math.ceil(meta.count / 30);
    for (const [sort, page] of [
      ["newest", 1],
      ["newest", lastPage],
      ["oldest", lastPage],
      ["popular", lastPage],
    ]) {
      s.trim({ keepManifest: false });
      read = [];
      const out = await lib.browse(type, { page, sort });
      /* الصفحة الأخيرة باقية ما بقي، فلا يلزم أن تكون كاملة. */
      const want = Math.min(30, meta.count - (page - 1) * 30);
      assert.equal(out.items.length, want, `${type}/${sort} صفحة ${page}`);
      const lists = read.filter((u) => /list\/\d+\.json$/.test(u));
      assert.ok(
        lists.length <= 2,
        `${type}/${sort} صفحة ${page}: قرأ ${lists.length} قائمة، والثمن ثابت بجزء واحد`,
      );
    }
  }
});

test("فهرس الترتيب أصغر من القوائم كلّها", async () => {
  for (const type of TYPES) {
    const dir = path.join(CONTENT, "library", type);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
    let lists = 0;
    for (const name of meta.listFiles) lists += fs.statSync(path.join(dir, "list", name)).size;
    const index = fs.statSync(path.join(dir, "order.json")).size;
    assert.ok(index < lists / 10, `${type}: الفهرس ${index} والقوائم ${lists}`);
  }
});

test("لا ملف فهرس يتجاوز حدّ التحميل", () => {
  for (const type of TYPES) {
    const size = fs.statSync(path.join(CONTENT, "library", type, "order.json")).size;
    assert.ok(size <= 650 * 1024, `${type}: ${size} بايت`);
  }
});
