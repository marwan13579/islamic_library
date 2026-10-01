"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const load = (relative) => import(`file://${path.join(__dirname, "..", "src", relative)}`);

test("normalizeAr folds Arabic orthography for search", async () => {
  const { normalizeAr } = await load("lib/text.js");
  assert.equal(normalizeAr("أَسْتَغْفِرُ"), "استغفر");
  assert.equal(normalizeAr("إِلَىٰ"), "الي");
  assert.equal(normalizeAr("ٱلْحَمْدُ"), "الحمد");
  assert.equal(normalizeAr("الصَّلَاةُ"), "الصلاه");
  assert.equal(normalizeAr("مُؤْمِن"), "مومن");
  assert.equal(normalizeAr("آية ٢٥٥"), "ايه 255");
});

test("Arabic-Indic digits round-trip", async () => {
  const { toArNum, toEnNumber } = await load("lib/text.js");
  assert.equal(toArNum(1447), "١٤٤٧");
  assert.equal(toEnNumber("١٤٤٧"), "1447");
  assert.equal(toEnNumber(toArNum(20260930)), "20260930");
});

test("escapeHtml neutralises injection payloads", async () => {
  const { escapeHtml, highlight, richText } = await load("lib/text.js");
  assert.equal(escapeHtml("<script>"), "&lt;script&gt;");
  assert.equal(escapeHtml("\"><img onerror=alert(1)>"), "&quot;&gt;&lt;img onerror=alert(1)&gt;");
  assert.equal(escapeHtml("it's"), "it&#39;s");
  assert.doesNotMatch(richText("**نص** <b>"), /<b>/);
  assert.match(richText("**نص**"), /<strong>نص<\/strong>/);
  assert.doesNotMatch(highlight("<script>الصلاة</script>", "الصلاة"), /<script>/);
});

test("humanTime and clock helpers read naturally in Arabic", async () => {
  const { to12h, humanTime } = await load("lib/text.js");
  assert.equal(to12h(14), "٢:٠٠ م");
  assert.equal(to12h(0), "١٢:٠٠ ص");
  assert.equal(to12h(12), "١٢:٠٠ م");
  assert.equal(to12h(Number.NaN), "—");
  assert.match(humanTime(2.25 * 3600 * 1000), /ساعتين|ساعة و/);
});

test("qibla points at the Kaaba from known cities", async () => {
  const { calcQibla, KAABA } = await load("lib/islamic.js");
  const near = calcQibla(KAABA.lat, KAABA.lng);
  assert.ok(near < 1 || near > 359, `expected ~0, got ${near}`);
  const cairo = calcQibla(30.0444, 31.2357);
  assert.ok(Math.abs(cairo - 136) < 2, `Cairo expected ≈136, got ${cairo}`);
  const jakarta = calcQibla(-6.2088, 106.8456);
  assert.ok(Math.abs(jakarta - 295) < 2, `Jakarta expected ≈295, got ${jakarta}`);
});

test("zakat respects the nisab boundary", async () => {
  const { calculateZakat, calculateMetalZakat, NISAB_GOLD } = await load("lib/islamic.js");
  assert.deepEqual(calculateZakat(84, NISAB_GOLD), {
    due: 0, belowNisab: true, shortfall: 1, percent: 0,
  });
  assert.deepEqual(calculateZakat(85, NISAB_GOLD), {
    due: 2.13, belowNisab: false, shortfall: 0, percent: 2.5,
  });
  const gold = calculateMetalZakat(86, 100, "gold");
  assert.equal(gold.belowNisab, false);
  assert.equal(gold.due, 215);
  const silver = calculateMetalZakat(500, 1, "silver");
  assert.equal(silver.belowNisab, true);
});

test("tasbih steps, targets and distances", async () => {
  const { tasbihStep, tasbihPercent, estimateDistance } = await load("lib/islamic.js");
  const first = tasbihStep({ count: 0, total: 10, target: 33 }, "سبحان الله");
  assert.deepEqual([first.count, first.total, first.reached], [1, 11, false]);
  const done = tasbihStep({ count: 32, total: 99, target: 33 }, "سبحان الله");
  assert.equal(done.reached, true);
  assert.equal(tasbihPercent(33, 33), 100);
  assert.equal(tasbihPercent(10, 0), 0);
  assert.match(estimateDistance("سبحان الله", 33), /كم تقريبًا/);
});

test("streak extends, repeats and breaks correctly", async () => {
  const { updateStreak, dateKey } = await load("lib/dates.js");
  const yesterday = dateKey(new Date(Date.now() - 86400000));
  assert.equal(updateStreak({ streak: 3, dhikrToday: 12, day: yesterday }).streak, 4);
  assert.equal(updateStreak({ streak: 3, dhikrToday: 12, day: dateKey() }).streak, 3);
  const broken = updateStreak({ streak: 3, dhikrToday: 12, day: "1999-01-01" });
  assert.equal(broken.streak, 1);
  assert.equal(broken.dhikrToday, 0);
});

test("week key starts on Saturday and spans Saturday to Friday", async () => {
  const { weekKey, daysLeftInWeek } = await load("lib/dates.js");
  const start = new Date(2026, 8, 26, 9, 0, 0); // Saturday
  const sameWeek = new Date(2026, 8, 30, 23, 0, 0); // Wednesday
  const nextWeek = new Date(2026, 9, 3, 9, 0, 0); // following Saturday
  assert.equal(weekKey(start), weekKey(sameWeek));
  assert.notEqual(weekKey(start), weekKey(nextWeek));
  // المفتاح تاريخ سبتٍ حقيقي، لا رقم أسبوعٍ محسوب من رأس السنة.
  assert.equal(weekKey(start), "2026-09-26");
  assert.equal(new Date(`${weekKey(start)}T12:00:00`).getDay(), 6);
  assert.equal(daysLeftInWeek(start), 6);
  assert.equal(daysLeftInWeek(new Date(2026, 9, 2)), 0); // Friday
});

test("base64 round-trips Arabic for khatma sync", async () => {
  const { b64EncodeUnicode, b64DecodeUnicode } = await load("lib/b64.js");
  const payload = JSON.stringify({ dedication: "إهداء لوالدي", assignees: { 0: "أحمد" } });
  const encoded = b64EncodeUnicode(payload);
  assert.match(encoded, /^[A-Za-z0-9+/=]+$/);
  assert.equal(b64DecodeUnicode(encoded), payload);
});

test("validation rejects malformed khatma sync payloads", async () => {
  const { isValidKhatmaSync } = await load("lib/b64.js");
  assert.equal(isValidKhatmaSync({ v: 1, parts: new Array(30).fill(false) }), true);
  assert.equal(isValidKhatmaSync({ v: 2, parts: new Array(30).fill(false) }), false);
  assert.equal(isValidKhatmaSync({ v: 1, parts: [true] }), false);
  assert.equal(isValidKhatmaSync(null), false);
});

test("storage wrapper survives a blocked localStorage", async () => {
  const { read, write, remove, keys, toggleInList, has, isPersistent } = await load("lib/storage.js");
  assert.equal(isPersistent(), false);
  assert.deepEqual(read("missing-key", "fallback"), "fallback");
  write("k", 1);
  assert.equal(read("k"), 1);
  assert.equal(toggleInList("list", "id"), true);
  assert.equal(has("list", "id"), true);
  assert.equal(toggleInList("list", "id"), false);
  assert.deepEqual(keys().length, 2);
  remove("k");
  assert.equal(read("k", null), null);
});