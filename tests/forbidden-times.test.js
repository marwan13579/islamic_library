"use strict";

/**
 * اختبارات أوقات النهي عن الصلاة.
 *
 * تتحقّق `evidence` مقابل `vendor/quran-arabic.json`، وتختبر حساب النوافذ
 * الزمنية من مواقيت AlAdhan، وتمنع التلوّث اللغوي في النصوص.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "..");
const load = (rel) => import(`file://${path.join(ROOT, "src", rel)}`);

const QURAN = JSON.parse(fs.readFileSync(path.join(ROOT, "vendor", "quran-arabic.json"), "utf8"));

/* ------------------------------ تطبيع النص ------------------------------ */

const letters = (value) =>
  [...String(value)]
    .filter((ch) => {
      const cp = ch.codePointAt(0);
      return cp !== 0x0640 && ((cp >= 0x0621 && cp <= 0x064a) || (cp >= 0x0660 && cp <= 0x0669));
    })
    .join("");

/** الحروف المدّية والهمزة: الرسم العثماني يخالف فيه الإملائي. */
const MATER = "ءآأإٱٲٳؤئىةوا";

const skeleton = (value) =>
  letters(value)
    .split("")
    .map((ch) => (MATER.includes(ch) ? "" : ch))
    .join("");

const surahKey = (value) =>
  letters(value)
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/[ئى]/g, "ي")
    .replace(/^سوره/, "")
    .replace(/^ال/, "")
    .replace(/^آل/, "")
    .replace(/^ا/, "");

const SURAH_BY_NAME = new Map(QURAN.surahs.map((s) => [surahKey(s.name), s.number]));

const toEn = (value) =>
  String(value).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

const verseFor = (ref) => {
  const match = /^([^:]+):\s*([٠-٩]+)$/.exec(ref);
  if (!match) return null;
  const surah = SURAH_BY_NAME.get(surahKey(match[1]));
  if (!surah) return null;
  return QURAN.surahs.find((s) => s.number === surah)?.ayahs.find((a) => a.n === Number(toEn(match[2])))?.text ?? null;
};

const quoteText = (ayah) => skeleton(ayah.replace(/[﴿﴾.…]/g, ""));

/* ------------------------------ المواقيت ------------------------------ */

/** مواقيت نموذجية: الفجر ٠٤:٣٠ والشروق ٠٥:٥٢، الظهر ١١:٤٥، العصر ١٥:١٠، المغرب ١٨:٠٠. */
const TIMINGS = {
  Fajr: "04:30",
  Sunrise: "05:52",
  Dhuhr: "11:45",
  Asr: "15:10",
  Maghrib: "18:00",
  Isha: "19:20",
};

/* ------------------------------ الاختبارات ------------------------------ */

test("الوحدة تُحمَّل وفيها ثلاثة أوقات", async () => {
  const { FORBIDDEN_PRAYER_TIMES } = await load("data/forbidden-times.js");
  assert.equal(FORBIDDEN_PRAYER_TIMES.length, 3);
  assert.deepEqual(
    FORBIDDEN_PRAYER_TIMES.map((w) => w.id),
    ["dawn", "zenith", "asr-to-sunset"],
  );
  for (const window of FORBIDDEN_PRAYER_TIMES) {
    assert.ok(window.title, `${window.id}: بلا عنوان`);
    assert.ok(window.detail, `${window.id}: بلا حكم`);
    assert.ok(window.note, `${window.id}: بلا ملاحظة`);
    assert.equal(window.bounds.length, 2, `${window.id}: حدّان ناقصان`);
    assert.ok(window.evidence.length > 0, `${window.id}: بلا آية`);
  }
});

test("كل آية في الأوقات مطابقة للمصحف المخزَّن", async () => {
  const { FORBIDDEN_PRAYER_TIMES } = await load("data/forbidden-times.js");
  const lines = FORBIDDEN_PRAYER_TIMES.flatMap((w) => w.evidence);
  assert.equal(lines.length, 3);

  for (const line of lines) {
    const verse = verseFor(line.ref);
    assert.ok(verse, `مرجع مجهول: ${line.ref}`);
    assert.ok(
      skeleton(verse).includes(quoteText(line.ayah)),
      `النصّ لا يطابق ${line.ref}\n  المذكور: ${line.ayah}\n  في المصدر: ${verse}`,
    );
  }
});

test("parseClock يتحقّق من الصيغة ويرفض الفاسد", async () => {
  const { parseClock } = await load("data/forbidden-times.js");
  assert.equal(parseClock("05:12"), 312);
  assert.equal(parseClock("00:00"), 0);
  assert.equal(parseClock("23:59"), 1439);
  assert.equal(parseClock("5:07"), 307, "يقبل ساعة بلا صفر");
  assert.equal(parseClock("24:00"), null);
  assert.equal(parseClock("12:60"), null);
  assert.equal(parseClock(""), null);
  assert.equal(parseClock("garbage"), null);
  assert.equal(parseClock(undefined), null);
  assert.equal(parseClock(null), null);
});

test("نافذة الفجر تمتدّ من الفجر إلى الشروق", async () => {
  const { FORBIDDEN_PRAYER_TIMES, resolveWindow, windowText } =
    await load("data/forbidden-times.js");
  const dawn = FORBIDDEN_PRAYER_TIMES.find((w) => w.id === "dawn");
  const result = resolveWindow(dawn, TIMINGS);
  assert.equal(result.from, 270);
  assert.equal(result.to, 352);
  assert.equal(windowText(result), "من 04:30 إلى 05:52");
});

test("نافذة الزوال تمتدّ قبل الظهر وبعده", async () => {
  const { FORBIDDEN_PRAYER_TIMES, resolveWindow, windowText } =
    await load("data/forbidden-times.js");
  const zenith = FORBIDDEN_PRAYER_TIMES.find((w) => w.id === "zenith");
  const result = resolveWindow(zenith, TIMINGS);
  assert.equal(result.from, 705 - 15);
  assert.equal(result.to, 705 + 15);
  assert.equal(windowText(result), "من 11:30 إلى 12:00");
});

test("نافذة العصر تمتدّ إلى المغرب", async () => {
  const { FORBIDDEN_PRAYER_TIMES, resolveWindow, windowText } =
    await load("data/forbidden-times.js");
  const asr = FORBIDDEN_PRAYER_TIMES.find((w) => w.id === "asr-to-sunset");
  const result = resolveWindow(asr, TIMINGS);
  assert.equal(result.from, 910);
  assert.equal(result.to, 1080);
  assert.equal(windowText(result), "من 15:10 إلى 18:00");
});

test("النافذة التي تعبر منتصف الليل تبقى مرتّبة", async () => {
  const { resolveWindow } = await load("data/forbidden-times.js");
  // نافذة مفتوحة على الرّواق: من المغرب ١٨:٠٠ إلى الفجر ٠٤:٣٠ في اليوم التالي
  const result = resolveWindow({ id: "x", bounds: ["Maghrib", "Fajr"], title: "t", detail: "d", note: "n" }, TIMINGS);
  assert.equal(result.from, 1080);
  assert.equal(result.to, 270 + 1440, "النهاية تُزاح يومًا");
  assert.ok(result.to > result.from, "الترتيب صحيح");
});

test("نافذة الزوال تلتفّ عند منتصف الليل", async () => {
  const { resolveWindow } = await load("data/forbidden-times.js");
  const result = resolveWindow(
    { id: "z", bounds: ["Dhuhr", "Dhuhr"], padMinutes: 15, title: "t", detail: "d", note: "n" },
    { Dhuhr: "00:05" },
  );
  assert.equal(result.from, 1430, "البداية قبل منتصف الليل");
  assert.equal(result.to, 20, "النهاية بعد منتصف الليل");
});

test("resolveWindow يرجع null إن نقص موعد", async () => {
  const { FORBIDDEN_PRAYER_TIMES, resolveWindow } = await load("data/forbidden-times.js");
  const dawn = FORBIDDEN_PRAYER_TIMES.find((w) => w.id === "dawn");
  assert.equal(resolveWindow(dawn, null), null);
  assert.equal(resolveWindow(dawn, {}), null);
  assert.equal(resolveWindow(dawn, { Fajr: "04:30" }), null, "ينقص الشروق");
  assert.equal(resolveWindow(dawn, { Fajr: "04:30", Sunrise: "لا شيء" }), null);
});

test("humanMinutes يلتفّ على اليوم", async () => {
  const { humanMinutes } = await load("data/forbidden-times.js");
  assert.equal(humanMinutes(0), "00:00");
  assert.equal(humanMinutes(312), "05:12");
  assert.equal(humanMinutes(1440), "00:00");
  assert.equal(humanMinutes(1710), "04:30", "بعد منتصف الليل");
  assert.equal(humanMinutes(-30), "23:30");
});

test("windowText يتعامل مع نافذة مفقودة", async () => {
  const { windowText } = await load("data/forbidden-times.js");
  assert.equal(windowText(null), "—");
  assert.equal(windowText({ from: 300, to: 360 }), "من 05:00 إلى 06:00");
});

test("النوافذ الثلاث مرتّبة زمنيًا في يوم نموذجي", async () => {
  const { FORBIDDEN_PRAYER_TIMES, resolveWindow } = await load("data/forbidden-times.js");
  const windows = FORBIDDEN_PRAYER_TIMES.map((w) => resolveWindow(w, TIMINGS));
  assert.equal(windows.every(Boolean), true, "كل النوافذ حُلّت");
  assert.ok(windows[0].to <= windows[1].from, "الفجر ينتهي قبل بدء الزوال");
  assert.ok(windows[1].to <= windows[2].from, "الزوال ينتهي قبل بدء العصر");
});

test("لا تلوّث لغوي في نصوص الأوقات", async () => {
  const { FORBIDDEN_PRAYER_TIMES } = await load("data/forbidden-times.js");

  const SKIP = new Set(["id", "bounds", "title", "ref", "ayah", "evidence"]);
  const offenders = [];
  const scan = (value, key, at) => {
    if (typeof value === "string") {
      if (SKIP.has(key)) return;
      if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Cyrillic}\p{Script=Greek}]/u.test(value)) {
        offenders.push(`${at}: حروف غير عربية — ${value.slice(0, 40)}`);
        return;
      }
      if (/[\u0600-\u06FF]/u.test(value) && /[A-Za-z]{2,}/.test(value)) {
        offenders.push(`${at}: كلمة لاتينية — ${value.match(/[A-Za-z]{2,}/g).join(" ")}`);
      }
      return;
    }
    if (Array.isArray(value)) return value.forEach((v, i) => scan(v, key, `${at}[${i}]`));
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) scan(v, k, `${at}.${k}`);
    }
  };
  scan(FORBIDDEN_PRAYER_TIMES, "", "forbidden");

  assert.deepEqual(offenders, [], offenders.join("\n"));
});
