"use strict";

/**
 * اختبارات «السراج في بيان غريب القرآن»: تماسك المحتوى وصدق مواضعه.
 *
 * المحتوى نصُّ كتاب مرفوع من مصدر رقمي، فيخاف عليه من فساد الجلب
 * أكثر مما يخاف على المولَّدة: سورة بلا سطر ترتيب، أو مدخل رقمُ آيته
 * خارج سورته، أو فهرسُ كلمة يشير إلى موضعٍ لا وجود له.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const dir = path.join(root, "content", "siraj");

const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
const surahs = () => read("index.json").surahs;
const surahFile = (no) => read(`sura-${String(no).padStart(3, "0")}.json`);

test("فهرس السِراج يغطّي السور كلها وعنوانَه موثّق", () => {
  const index = read("index.json");
  assert.equal(index.surahs.length, 114, "السور ١١٤");
  assert.deepEqual(
    index.surahs.map((row) => row.no),
    Array.from({ length: 114 }, (_, at) => at + 1),
    "ترتيب السور هو ترتيب المصحف"
  );
  for (const row of index.surahs) {
    assert.ok(row.name, `السورة ${row.no} بلا اسم`);
    assert.ok(row.count >= 0, `السورة ${row.no} بلا عدد مداخل`);
  }
  assert.ok(index.count > 5000, `عدد اللغات قليل: ${index.count}`);
  assert.ok(index.source && index.source.url, "المصدر غير موثّق");
  assert.ok(index.source.author && index.source.title, "المؤلف أو العنوان غير موثّق");
});

test("مجموع مداخل السور يساوي عدد اللغات في البيان", () => {
  const index = read("index.json");
  const total = index.surahs.reduce((sum, row) => sum + surahFile(row.no).entries.length, 0);
  assert.equal(total, index.count, `مجموع السور ${total} والبيان ${index.count}`);
  for (const row of index.surahs) {
    const sura = surahFile(row.no);
    assert.equal(sura.count, sura.entries.length, `عدد مداخل السورة ${row.no} لا يطابق ملفها`);
    assert.equal(sura.count, row.count, `عدد مداخل السورة ${row.no} لا يطابق الفهرس`);
  }
});

test("كل مدخل لفظٌ ومعنًى، وآيتُه داخل سورته", () => {
  const mushaf = JSON.parse(fs.readFileSync(path.join(root, "content", "surahs.json"), "utf8"));
  for (const meta of mushaf) {
    const sura = surahFile(meta.no);
    assert.equal(sura.verses, meta.verses, `آيات السورة ${meta.no} لا تطابق المصحف`);
    for (const row of sura.entries) {
      assert.ok(row.w && row.w.length > 1, `مدخل بلا لفظ في السورة ${meta.no}`);
      /* مدخل بلا بيانٍ في الكتاب يُعلَّم `b`، ولا يُملأ من عندنا. */
      assert.ok(
        row.m.length > 2 || row.b === 1,
        `مدخل بلا معنى ولا عَلَم في السورة ${meta.no}`
      );
      if (row.a === null) continue;
      assert.ok(
        Number.isInteger(row.a) && row.a >= 1 && row.a <= meta.verses,
        `آية ${row.a} خارجة عن السورة ${meta.no}`
      );
    }
  }
});

test("مواضع اللفظ في المصحف تشير إلى مداخلٍ قائمة", () => {
  for (const meta of surahs()) {
    const sura = surahFile(meta.no);
    for (const [at, row] of sura.entries.entries()) {
      for (const [no, seat] of row.o || []) {
        assert.ok(no >= 1 && no <= 114, `سورة ${no} خارجة عن المصحف`);
        const other = surahFile(no);
        assert.ok(seat < other.entries.length, `الموضع ${seat} خارج مداخل السورة ${no}`);
        assert.notEqual(no === meta.no && seat === at, true, "الموضع هو المدخل نفسه");
      }
    }
  }
});

test("فهرس الكلمات يشير إلى مواضعها في السور", async () => {
  const { normalizeAr } = await import(`file://${path.join(root, "src/lib/text.js")}`);
  const letters = fs.readdirSync(path.join(dir, "terms")).filter((name) => name.endsWith(".json"));
  assert.equal(letters.length, 28, "دلاء الحروف ٢٨");
  let keys = 0;
  for (const name of letters) {
    const bucket = read(path.join("terms", name));
    for (const [key, positions] of Object.entries(bucket)) {
      keys += 1;
      assert.equal(normalizeAr(key).slice(0, 1), path.basename(name, ".json"), `«${key}» في دلو غيره`);
      assert.ok(positions.length, `«${key}» بلا مواضع`);
      for (const [no, seat] of positions) {
        const entry = surahFile(no).entries[seat];
        assert.ok(entry, `الموضع ${no}:${seat} لا مدخل`);
        assert.ok(
          normalizeAr(entry.w).includes(key),
          `الكلمة «${key}» لا تُطابق لفظ ${entry.w}`
        );
      }
    }
  }
  assert.ok(keys > 6000, `مفاتيح الفهرس قليلة: ${keys}`);
});

test("مقدّمة الكتاب وخاتمته نصٌّ محفوظ", () => {
  const intro = read("muqaddima.json");
  const khatima = read("khatima.json");
  assert.ok(intro.paras.length > 3, "المقدمة قصيرة");
  assert.ok(khatima.paras.length >= 1, "الخاتمة فارغة");
  for (const para of [...intro.paras, ...khatima.paras]) {
    assert.ok(para.trim().length > 0, "فقرة فارغة");
  }
});

test("واجهة القراءة تفتح السورة وتحرس حدودها", async () => {
  const store = new Map();
  global.fetch = async (url) => {
    const file = path.join(root, "content", String(url).replace(/^.*content\//, ""));
    if (!fs.existsSync(file)) return { ok: false, status: 404 };
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(file, "utf8")) };
  };
  global.window = { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
  store.clear();

  const library = await import(`file://${path.join(root, "src/lib/library.js")}`);
  const sura = await library.readSiraj(2);
  assert.ok(sura && sura.no === 2, "السورة ٢ لم تُفتح");
  assert.ok(sura.entries.length > 100, "مداخل السورة ٢ قليلة");
  /* كما في `readSurah` و`readBab`: الرقم خارج المدى يُقرَّب إلى حدّه. */
  assert.equal((await library.readSiraj(0)).no, 1, "الصفر إلى أوّل السور");
  assert.equal((await library.readSiraj(115)).no, 114, "ما بعد ١١٤ إلى آخرها");
});