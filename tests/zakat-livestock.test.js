"use strict";

/**
 * اختبارات جداول زكاة الأنعام.
 *
 * تثبيت الأرقام المرجعية لكل نطاق، فلا تعود الصيغة المختصرة التي كانت
 * تُعطي ٢٥ من الإبل عند ١٢٠ و٤ من البقر عند ١٠٠٠.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const load = () => import(`file://${path.join(ROOT, "src/lib/islamic.js")}`);

/** @param {{ camels?: number, cows?: number, sheep?: number }} herd */
const one = (rows, item) => rows.find((row) => row.item === item)?.due;

test("جدول الإبل يطابق المرجع", async () => {
  const { calculateLivestockZakat } = await load();
  /** @type {[number, number | null][]} */
  const cases = [
    [4, 0], [5, 1], [9, 1], [10, 1], [14, 1],
    [15, 2], [20, 2], [24, 2],
    [25, 3], [30, 3], [34, 3],
    [35, 4], [40, 4], [44, 4],
    [45, 5], [59, 5],
    [60, 10], [100, 10], [109, 10], [110, 10], [120, 10],
    [121, 11], [129, 11], [130, 12], [139, 12],
    [140, 15], [149, 15], [150, 16], [160, 17], [170, 18],
    [180, 19], [190, 20], [200, 21], [250, 26], [290, 30], [299, 30],
  ];
  for (const [count, due] of cases) {
    assert.equal(one(calculateLivestockZakat({ camels: count }), "الإبل"), due, `إبل ${count}`);
  }
});

test("جدول البقر يطابق المرجع", async () => {
  const { calculateLivestockZakat } = await load();
  /** @type {[number, number | null][]} */
  const cases = [
    [29, 0], [30, 1], [39, 1],
    [40, 2], [59, 2],
    [60, 3], [99, 3],
    [100, 4], [199, 4],
    [200, 5], [299, 5],
    [300, 6], [400, 7], [500, 8], [600, 9], [700, 10],
    [800, 12], [900, 15], [999, 15],
  ];
  for (const [count, due] of cases) {
    assert.equal(one(calculateLivestockZakat({ cows: count }), "البقر"), due, `بقر ${count}`);
  }
});

test("جدول الغنم يطابق المرجع", async () => {
  const { calculateLivestockZakat } = await load();
  /** @type {[number, number][]} */
  const cases = [
    [4, 0], [5, 1], [39, 1],
    [40, 2], [199, 2],
    [200, 3], [1999, 3],
    [2000, 4], [5000, 4],
  ];
  for (const [count, due] of cases) {
    assert.equal(one(calculateLivestockZakat({ sheep: count }), "الغنم"), due, `غنم ${count}`);
  }
});

test("نسبة الغنم المكتوبة تطابق الواجب", async () => {
  const { calculateLivestockZakat } = await load();
  assert.equal(calculateLivestockZakat({ sheep: 100 })[0].note, "٥٪");
  assert.equal(calculateLivestockZakat({ sheep: 20 })[0].note, "٢.٥٪");
  assert.equal(calculateLivestockZakat({ sheep: 500 })[0].note, "١٠٪");
  assert.equal(calculateLivestockZakat({ sheep: 2 })[0].note, "دون النصاب");
});

test("ما بعد مدول الجدول يُرجَع null لا رقمًا مخمَّنًا", async () => {
  const { calculateLivestockZakat, CAMEL_TABLE_MAX, COW_TABLE_MAX } = await load();
  assert.equal(one(calculateLivestockZakat({ camels: 300 }), "الإبل"), null);
  assert.equal(one(calculateLivestockZakat({ camels: 5000 }), "الإبل"), null);
  assert.equal(one(calculateLivestockZakat({ cows: 1000 }), "البقر"), null, "١٠٠٠ خارج جدول البقر");
  assert.equal(one(calculateLivestockZakat({ cows: COW_TABLE_MAX }), "البقر"), 15);
  assert.equal(one(calculateLivestockZakat({ camels: CAMEL_TABLE_MAX }), "الإبل"), 30);
});

test("الوابل داخل النصاب صفر لا null", async () => {
  const { calculateLivestockZakat } = await load();
  assert.equal(one(calculateLivestockZakat({ camels: 2 }), "الإبل"), 0);
  assert.equal(one(calculateLivestockZakat({ cows: 10 }), "البقر"), 0);
  assert.equal(one(calculateLivestockZakat({ sheep: 1 }), "الغنم"), 0);
});

test("الأنواع الثلاثة تظهر معًا ولا تتداخل", async () => {
  const { calculateLivestockZakat } = await load();
  const rows = calculateLivestockZakat({ camels: 5, cows: 30, sheep: 40 });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.item), ["الإبل", "البقر", "الغنم"]);
  assert.deepEqual(rows.map((r) => r.due), [1, 1, 2]);
  assert.equal(calculateLivestockZakat({}).length, 0);
});

test("زكاة المال عند النصاب بالضبط", async () => {
  const { calculateZakat, NISAB_GOLD } = await load();
  const at = calculateZakat(NISAB_GOLD);
  assert.equal(at.belowNisab, false, "النصاب نفسه واجب فيه الزكاة");
  assert.equal(at.due, 2.13, "٢.٥٪ من ٨٥");
  const below = calculateZakat(NISAB_GOLD - 0.01);
  assert.equal(below.belowNisab, true);
  assert.equal(below.due, 0);
  assert.equal(below.shortfall, 0.01);
});

test("زكاة المعادن تحسب النصاب من السعر", async () => {
  const { calculateMetalZakat, NISAB_GOLD, NISAB_SILVER } = await load();
  const gold = calculateMetalZakat(85, 200, "gold");
  assert.equal(gold.nisab, 85 * 200);
  assert.equal(gold.nisabGrams, NISAB_GOLD);
  assert.equal(gold.due, 425, "٢.٥٪ من ١٧٠٠٠");
  const silver = calculateMetalZakat(595, 10, "silver");
  assert.equal(silver.nisabGrams, NISAB_SILVER);
  assert.equal(silver.nisab, 5950);
  assert.equal(silver.belowNisab, false, "بلوغ النصاب بالضبط يُعفى عنه");
  assert.equal(silver.due, 148.75, "٢.٥٪ من ٥٩٥٠");
  const under = calculateMetalZakat(594, 10, "silver");
  assert.equal(under.belowNisab, true, "جرام واحد دون النصاب لا زكاة فيه");
  assert.equal(under.shortfall, 10);
});

test("واجهة الأنعام لا تجمع صفًّا مجهولًا فيصير صفرًا", async () => {
  const { calculateLivestockZakat } = await load();
  const rows = calculateLivestockZakat({ camels: 5000 });
  assert.equal(rows[0].due, null);
  // لولا الفحص لأجمعه reduce فصار صفرًا، وهو أخطأ من عرض لا شيء.
  const naive = rows.reduce((sum, row) => sum + row.due, 0);
  assert.equal(naive, 0, "هذا هو الخطر الذي تحرس منه الواجهة");
  assert.notEqual(naive, 5000);
});

test("زكاة الزينة تختلف عن التجارة", async () => {
  const { calculateMetalZakat } = await load();
  const jewelry = calculateMetalZakat(1000, 250, "gold", "jewelry");
  const trade = calculateMetalZakat(1000, 250, "gold", "trade");
  // الفضة كالذهب: الزينة لا زكاة نصاب فيها
  assert.equal(jewelry.due, 0, "الزينة: لا زكاة نصاب");
  assert.equal(jewelry.holding, "jewelry");
  assert.ok(jewelry.note && jewelry.note.includes("الزينة"));
  // والتجارة تجب فيها حتى مع بلوغ النصاب
  assert.equal(trade.due, 6250, "٢.٥٪ من ٢٥٠٠٠٠");
  assert.equal(trade.holding, "trade");
});

test("الافتراضي التجارة فلا يتغيّر سلوك من لم يختار", async () => {
  const { calculateMetalZakat } = await load();
  assert.equal(calculateMetalZakat(100, 100, "gold").holding, "trade");
  assert.equal(calculateMetalZakat(100, 100, "gold").due, 250);
  // والفطرة في الفضة
  assert.equal(calculateMetalZakat(1000, 10, "silver", "jewelry").due, 0);
  assert.equal(calculateMetalZakat(1000, 10, "silver", "trade").due, 250);
});
