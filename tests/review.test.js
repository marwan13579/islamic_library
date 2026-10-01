"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const load = (relative) => import(`file://${path.join(__dirname, "..", "src", relative)}`);
const requireScript = (relative) =>
  require(path.join(__dirname, "..", "scripts", "extract", relative));

/* ------------------------------------------------------------------ */
/* مطابقة محاور السيرة — كانت تُدخل الحدث مرّتين                        */
/* ------------------------------------------------------------------ */

test("headWord keeps word boundaries that norm strips", () => {
  const { norm, core, headWord } = requireScript("merge-legacy.cjs");
  assert.equal(norm("الهجرة إلى المدينة"), "الهجرهاليالمدينه", "norm يحذف المسافات");
  assert.equal(core("الوفاة"), "وفاه", "core يُسقط أداة التعريف");
  assert.equal(core("وفاة النبي ﷺ"), "وفاهالنبيﷺ");
  assert.equal(headWord("الهجرة إلى المدينة"), "هجره", "headWord يقسم قبل التجريد");
  assert.equal(headWord("هجرة النبي ﷺ"), "هجره");
});

test("seerahMatcher treats a renamed event as the same event", async () => {
  const { seerahMatcher } = requireScript("merge-legacy.cjs");
  const { SEERAH } = await load("data/seerah.js");
  const isSame = seerahMatcher(SEERAH);

  // الصياغة الأقصر التي في الملف الأقدم من الدمج السابق
  assert.equal(isSame({ year: "٦٢٢م", title: "الهجرة", desc: "هاجر إلى المدينة." }), true);
  assert.equal(isSame({ year: "٦٣٢م", title: "الوفاة", desc: "توفي عن ٦٣ سنة." }), true);
  // صياغة أطول أو تختلف أداة التعريف
  assert.equal(isSame({ year: "٦٢٢م", title: "هجرة النبي ﷺ", desc: "" }), true);
  assert.equal(isSame({ year: "٦٢٤م", title: "غزوة بدر الكبرى", desc: "" }), true);
  // العنصر نفسه حرفيًا
  assert.equal(isSame(SEERAH[0]), true);
});

test("seerahMatcher still accepts genuinely new events", async () => {
  const { seerahMatcher } = requireScript("merge-legacy.cjs");
  const { SEERAH } = await load("data/seerah.js");
  const isSame = seerahMatcher(SEERAH);

  assert.equal(isSame({ year: "٦٣٢م", title: "بعثة النبي ﷺ", desc: "أُرسل في الأربعين." }), false);
  assert.equal(isSame({ year: "٦٢٦م", title: "حجة الوداع", desc: "" }), false);
  assert.equal(isSame({ year: "٦٢٨م", title: "غزوة الخندق", desc: "" }), false);
});

test("seerahMatcher keys on the year, not the wording alone", async () => {
  const { seerahMatcher } = requireScript("merge-legacy.cjs");
  const { SEERAH } = await load("data/seerah.js");
  const isSame = seerahMatcher(SEERAH);

  assert.equal(isSame({ year: "٦٣٠م", title: "فتح مكة", desc: "" }), true, "السنة نفسها");
  assert.equal(isSame({ year: "٦٣٢م", title: "فتح مكة", desc: "" }), false, "سنة مختلفة");
});

test("SEERAH has no duplicate event after the merge", async () => {
  const { SEERAH } = await load("data/seerah.js");
  const { headWord } = requireScript("merge-legacy.cjs");
  const seen = new Map();
  for (const item of SEERAH) {
    const key = `${item.year}|${headWord(item.title)}`;
    assert.equal(seen.has(key), false, `محور مكرّر: ${item.year} — ${item.title}`);
    seen.set(key, item);
  }
  assert.equal(SEERAH.length, 6);
});

/* ------------------------------------------------------------------ */
/* تقرير المراجعة العلمية                                                */
/* ------------------------------------------------------------------ */

test("review status classifies citation strength", async () => {
  const { statusOf } = await load("lib/review.js");

  assert.equal(statusOf(""), "بلا تخريج");
  assert.equal(statusOf("   "), "بلا تخريج");
  assert.equal(statusOf(undefined), "بلا تخريج");
  assert.equal(statusOf("البخاري"), "اسم مجموعة");
  assert.equal(statusOf("البخاري ومسلم"), "اسم مجموعة");
  assert.equal(statusOf("البخاري ٦٣٠٦"), "مخرَّج");
  assert.equal(statusOf("البخاري 6306"), "مخرَّج");
  assert.equal(statusOf("البقرة: 201"), "آية");
  assert.equal(statusOf("سورة الفجر"), "آية");
});

test("review report aggregates every attributed collection", async () => {
  const { collect } = require("../scripts/review-report.cjs");
  const { ATTRIBUTED } = await load("lib/review.js");
  const report = await collect();
  const ids = report.map((group) => group.id);
  for (const id of ["APP_DUAS", "HADITHS", "ATHKAR_DATA", "SEERAH", "PROPHETS", "SAYINGS", "LESSONS"]) {
    assert.ok(ids.includes(id), `المجموعة ${id} مفقودة من التقرير`);
  }
  assert.equal(ids.length, ATTRIBUTED.length, "مجموعة ناقصة من التقرير");
  for (const group of report) {
    assert.ok(group.entries.length > 0, `${group.id} فارغ`);
    for (const entry of group.entries) {
      assert.ok(entry.title, `${group.id}: عنصر بلا عنوان`);
      assert.ok(entry.text.length > 0, `${group.id}: ${entry.title} بلا نصّ`);
    }
  }
});

test("blocking groups are exactly the verbatim attributed texts", async () => {
  const { ATTRIBUTED, isBlocking } = await load("lib/review.js");
  const blocking = ATTRIBUTED.filter(isBlocking).map((g) => g.id);
  assert.deepEqual(blocking, ["APP_DUAS", "HADITHS", "ATHKAR_DATA"]);
});

test("every dua and hadith carries a takhrij", async () => {
  const { collect } = require("../scripts/review-report.cjs");
  const report = await collect();
  for (const group of report.filter((g) => ["APP_DUAS", "HADITHS"].includes(g.id))) {
    const missing = group.entries.filter((entry) => entry.status === "بلا تخريج");
    assert.deepEqual(
      missing.map((entry) => entry.title),
      [],
      `${group.label}: عناصر بلا تخريج`,
    );
  }
});

test("all adhkar and Quran-based summaries have linked primary references", async () => {
  const { collect } = require("../scripts/review-report.cjs");
  const { ATHKAR_DATA } = await load("data/app-athkar.js");
  const { ATHKAR_REFERENCES, normalizeAthkar } = await load("data/review-references.js");
  const report = await collect();
  const byId = new Map(report.map((group) => [group.id, group]));

  for (const item of ATHKAR_DATA.flatMap((category) => category.items)) {
    assert.ok(ATHKAR_REFERENCES[normalizeAthkar(item).text], `${item.text}: مصدر بلا خريطة مرجعية`);
  }

  for (const id of ["ATHKAR_DATA", "PROPHETS", "FORBIDDEN_TIMES"]) {
    const group = byId.get(id);
    assert.ok(group, `${id}: المجموعة مفقودة`);
    for (const entry of group.entries) {
      assert.notEqual(entry.status, "بلا تخريج", `${entry.title}: بلا مرجع`);
      assert.match(entry.url ?? "", /^https:\/\/(sunnah\.com|quran\.com)\//, `${entry.title}: رابط المصدر مفقود`);
    }
  }
});
