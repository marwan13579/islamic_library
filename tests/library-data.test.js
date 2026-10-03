"use strict";

/**
 * السلوك الذي كان خاطئًا وثبّتناه:
 *   - صفحات لا تتشابك ولا تتكرر
 *   - «الأحدث» في النهاية فعلًا حيث لا تواريخ
 *   - الهمزة المفردة تُحذف في الاستعلام كما في البناء
 *   - الفهرس لا يجلب إلا ملفًّا واحدًا لكل استعلام
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");

/** يخدم ملفات المحتوى من القرص كما لو كانت شبكة. */
function serveContent() {
  const served = [];
  globalThis.fetch = async (url) => {
    const file = path.join(CONTENT, String(url).replace(/^.*content\//, ""));
    served.push(String(url));
    if (!fs.existsSync(file)) {
      return { ok: false, status: 404, json: async () => { throw new Error("غير موجود"); } };
    }
    const text = fs.readFileSync(file, "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  };
  return served;
}

const load = (rel) => import(path.join(ROOT, rel));

test("صفحات «الأقدم» لا تتشابك ولا تتكرر", async () => {
  serveContent();
  const { browse } = await load("src/lib/library.js");
  const seen = new Set();
  let repeated = 0;
  for (let page = 1; page <= 6; page += 1) {
    const chunk = await browse("fatwa", { page, perPage: 30, sort: "oldest" });
    for (const item of chunk.items) {
      if (seen.has(item.id)) repeated += 1;
      seen.add(item.id);
    }
  }
  assert.equal(repeated, 0, `تكرّر ${repeated} عنصرًا بين الصفحات`);
  assert.equal(seen.size, 180);
});

test("«الأحدث» في النهاية فعلًا حيث غابت التواريخ", async () => {
  serveContent();
  const { browse } = await load("src/lib/library.js");
  const serial = (id) => Number(/(\d+)$/.exec(id)[1]);
  const newest = await browse("history", { page: 1, perPage: 3, sort: "newest" });
  const oldest = await browse("history", { page: 1, perPage: 3, sort: "oldest" });
  assert.ok(
    serial(newest.items[0].id) > serial(oldest.items[0].id),
    "الأحدث لا تتقدّم على الأقدم",
  );
  // والأقدم هو أوّل الحدث: مولد النبي ﷺ
  assert.equal(serial(oldest.items[0].id), 1);
});

test("ترتيب الخطب بتاريخها: الأحدث أحدث تاريخًا", async () => {
  serveContent();
  const { browse } = await load("src/lib/library.js");
  const newest = await browse("khutbahs", { page: 1, perPage: 5, sort: "newest" });
  const oldest = await browse("khutbahs", { page: 1, perPage: 5, sort: "oldest" });
  const dates = (chunk) => chunk.items.map((i) => String(i.d));
  for (const d of dates(newest)) assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(d), `تاريخ غير ISO: ${d}`);
  assert.ok(dates(newest)[0] > dates(oldest)[0], "الأحدث ليست أحدث تاريخًا");
  assert.ok(
    dates(newest).every((d, i, all) => i === 0 || all[i - 1] >= d),
    "قائمة الأحدث ليست تنازلية",
  );
});

test("لا ترتيبٌ ثالث في الواجهة: طوله لا يُعرف إلا بترتيب الجميع", () => {
  /* الترتيب بدقائق القراءة يحتاج كل الملخّصات: عشرة ميغابايت للفتاوى
     صفحةً واحدة، واسمه «الأكثر» يكذب إذ لا أكثرية في المصدر. فحُذف من
     شريط الترتيب، ولا يبقى إلا ما يُعرف بترتيب القوائم نفسها. */
  const ui = fs.readFileSync(path.join(ROOT, "src/lib/content-ui.js"), "utf8");
  const sorts = /const SORTS = \[([\s\S]*?)\];/.exec(ui);
  assert.ok(sorts, "لا شريط ترتيب في الواجهة");
  const ids = [...sorts[1].matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ["newest", "oldest"], `فرزات غير متوقّعة: ${ids.join("، ")}`);
  assert.ok(!/sort === "popular"/.test(fs.readFileSync(path.join(ROOT, "src/lib/library.js"), "utf8")));
});

test("صفحات التصنيف لا تتشابك في الاتجاهين", async () => {
  serveContent();
  const { browseCategory } = await load("src/lib/library.js");
  for (const sort of ["newest", "oldest"]) {
    const seen = new Set();
    let repeated = 0;
    for (let page = 1; page <= 4; page += 1) {
      const chunk = await browseCategory("fatwa", "قضايا المرأة", { page, perPage: 12, sort });
      for (const item of chunk.items) {
        if (seen.has(item.id)) repeated += 1;
        seen.add(item.id);
      }
    }
    assert.equal(repeated, 0, `تكرّر ${repeated} عنصرًا في ترتيب ${sort}`);
    assert.equal(seen.size, 48);
  }
});

test("فشل تحميل واحد لا يُقفل القسم", async () => {
  let fail = true;
  globalThis.fetch = async (url) => {
    const file = path.join(CONTENT, String(url).replace(/^.*content\//, ""));
    if (fail) {
      fail = false;
      return { ok: false, status: 503, json: async () => { throw new Error("تعذّر"); } };
    }
    if (!fs.existsSync(file)) {
      return { ok: false, status: 404, json: async () => { throw new Error("غير موجود"); } };
    }
    const text = fs.readFileSync(file, "utf8");
    return { ok: true, status: 200, json: async () => JSON.parse(text) };
  };
  const shards = await load("src/lib/shards.js");
  // مجموعة لم تسبقها نداءات في هذا الملف، وإلا كان بيانها في الذاكرة
  await assert.rejects(() => shards.collectionMeta("quiz"), "كان يجب أن يفشل أول نداء");
  const meta = await shards.collectionMeta("quiz");
  assert.equal(meta.count, 5820, "لم تُجزَأ المحاولة الثانية");
});

test("الهمزة المفردة تُحذف في الاستعلام كما في البناء", async () => {
  const { tokenize } = await load("src/lib/search.js");
  // البناء حذف ء عند بناء الفهرس، فـ«شيء» مخزَّنة «شي»
  assert.deepEqual(tokenize("شيء"), ["شي"]);
  assert.deepEqual(tokenize("دعاء"), ["دعا"]);
});

test("الفهرس يقرأ ملفًّا واحدًا لا أربعة وثمانين", async () => {
  const mf = JSON.parse(fs.readFileSync(path.join(CONTENT, "search", "manifest.json"), "utf8"));
  const pick = (token) => {
    const group = mf.groups.find((g) => g.l === token[0]);
    assert.ok(group, `لا مجموعة للحرف ${token[0]}`);
    return group.split
      ? group.files.filter((f) => token.startsWith(f.p) || f.p.startsWith(token))
      : group.files;
  };
  for (const token of ["الصلاه", "الله", "الزكاه", "الرحيم"]) {
    const files = pick(token);
    assert.ok(files.length > 0, `لا ملف لـ${token}`);
    assert.ok(
      files.length <= 3,
      `${token} يجلب ${files.length} ملفًا؛ keys كانت مكرّرة فتجلب ٨٤`,
    );
  }
});

test("بيان البحث يصف بادئة صالحة لكل ملف", async () => {
  const mf = JSON.parse(fs.readFileSync(path.join(CONTENT, "search", "manifest.json"), "utf8"));
  for (const group of mf.groups) {
    if (!group.split) continue;
    for (const file of group.files) {
      assert.equal(typeof file.p, "string", `${group.l}/${file.f} بلا بادئة`);
      assert.ok(file.p.length > 0, `${group.l}/${file.f} بادئة فارغة`);
      assert.ok(file.p.startsWith(group.l), `${group.l}/${file.f} بادئته لا تبدأ بالحرف`);
    }
  }
});

test("لا ملف فهرس يتجاوز حدّ التحميل", async () => {
  const dir = path.join(CONTENT, "search");
  let worst = 0;
  let worstFile = "";
  for (const name of fs.readdirSync(dir)) {
    if (!/^g\d+(-\d+)?\.json$/.test(name)) continue;
    const size = fs.statSync(path.join(dir, name)).size;
    if (size > worst) {
      worst = size;
      worstFile = name;
    }
  }
  assert.ok(worst <= 650 * 1024, `أكبر ملف ${worstFile}: ${worst} بايت`);
});
