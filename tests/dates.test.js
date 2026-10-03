"use strict";

/**
 * اختبارات التقويم والأسبوع.
 *
 * الأسبوع الشرعي يبدأ السبت، فتثبيتُه له يضمن ألّا يتوسط التحدي الأسبوعي
 * في يومٍ غير متوقّع، وألّا تتفرّق أيام الأسبوع على مفتاحين.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const load = () => import(`file://${path.join(ROOT, "src/lib/dates.js")}`);

/**>@param {string} ymd */
const at = (ymd) => new Date(`${ymd}T12:00:00`);

test("أيام السبت إلى الجمعة في مفتاح واحد", async () => {
  const { weekKey } = await load();
  const days = ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-02"];
  const keys = new Set(days.map((d) => weekKey(at(d))));
  assert.equal(keys.size, 1, `تعدّدت المفاتيح في أسبوع واحد: ${[...keys].join("، ")}`);
  assert.equal([...keys][0], "2026-09-26", "المفتاح هو تاريخ السبت");
});

test("السبت يفتتح أسبوعًا جديدًا", async () => {
  const { weekKey } = await load();
  assert.notEqual(weekKey(at("2026-10-02")), weekKey(at("2026-10-03")));
});

test("الأيام المتبقية تنقص من السبت إلى الجمعة", async () => {
  const { daysLeftInWeek } = await load();
  assert.equal(daysLeftInWeek(at("2026-09-26")), 6, "السبت: ستة أيام متبقية");
  assert.equal(daysLeftInWeek(at("2026-09-27")), 5);
  assert.equal(daysLeftInWeek(at("2026-10-01")), 1, "الخميس: يوم واحد");
  assert.equal(daysLeftInWeek(at("2026-10-02")), 0, "الجمعة: آخر يوم");
  assert.equal(daysLeftInWeek(at("2026-10-03")), 6, "السبت الجديد");
});

test("مفتاح الأسبوع لا يتغيّر بتغيّر الوقت في اليوم", async () => {
  const { weekKey } = await load();
  const morning = new Date(2026, 8, 30, 0, 0, 1);
  const evening = new Date(2026, 8, 30, 23, 59, 59);
  assert.equal(weekKey(morning), weekKey(evening));
});

test("مفتاح الأسبوع يعبر حدّ السنة بلا انزلاق", async () => {
  const { weekKey } = await load();
  // ٣١ ديسمبر ٢٠٢٦ و١ يناير ٢٠٢٧ في أسبوع واحد: من ٢٦ ديسمبر إلى ١ يناير.
  const last = at("2026-12-31");
  const first = at("2027-01-01");
  assert.equal(weekKey(last), weekKey(first), "آخر يوم في السنة وأولها في أسبوع واحد");
  assert.equal(weekKey(last), "2026-12-26");
  // والمفتاح يبقى تاريخ سبت في كل الأحوال
  for (const d of ["2026-12-28", "2026-12-31", "2027-01-01", "2027-01-04"]) {
    const key = weekKey(at(d));
    assert.equal(new Date(`${key}T12:00:00`).getDay(), 6, `${key} ليس سبتًا`);
  }
});

test("الستريك يزيد يومًا متتاليًا ويصفّر عند الانقطاع", async () => {
  const { updateStreak, dateKey } = await load();
  const today = dateKey();
  const yesterday = dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1));

  // اليوم نفسه: لا يتغيّر
  const same = updateStreak({ streak: 5, dhikrToday: 12, day: today });
  assert.equal(same.streak, 5);
  assert.equal(same.dhikrToday, 12, "لا يُصفَّر عدّاد اليوم في اليوم نفسه");

  // أمس: يزيد
  const cont = updateStreak({ streak: 5, dhikrToday: 3, day: yesterday });
  assert.equal(cont.streak, 6);
  assert.equal(cont.dhikrToday, 0, "يبدأ اليوم الجديد من صفر");
  assert.equal(cont.day, today);

  // انقطاع: يعود إلى واحد
  const broke = updateStreak({ streak: 5, dhikrToday: 3, day: "2000-01-01" });
  assert.equal(broke.streak, 1);
});

test("dateKey و fromDateKey يعكسان بعضهما", async () => {
  const { dateKey, fromDateKey } = await load();
  for (const d of ["2026-01-01", "2026-09-26", "2026-12-31", "2024-02-29"]) {
    assert.equal(dateKey(at(d)), d, `فشل في ${d}`);
    assert.equal(dateKey(fromDateKey(d)), d, `فشل الرجوع في ${d}`);
  }
});

test("التاريخ الهجري يسبق الميلادي بأربعة عشر قرنًا تقريبًا", async () => {
  const { hijriParts } = await load();
  const { year } = hijriParts(at("2026-09-30"));
  const toEn = (v) => Number(v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
  const h = toEn(year);
  // السنة الميلادية ٢٠٢٦ تقابل نحو ١٤٤٨ هجرية.
  assert.ok(h >= 1440 && h <= 1455, `السنة الهجرية ${h} خارج المدى المتوقّع`);
});
