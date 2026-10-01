"use strict";

/**
 * اختبارات دروس الآداب المضافة.
 *
 * أهمّها تحقّق `evidence` من نصّ الآية ومرجعها مقابلًا لـ
 * `vendor/quran-arabic.json`، فلا يمرّ نصٌّ مغلوط ولا مرجعٌ كاذب.
 * ثم فحصٌ يمنع أي تلوّث لغوي: حروف صينية أو سيلافية أو لاتينية داخل نصّ عربي.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.join(__dirname, "..");
const load = (rel) => import(`file://${path.join(ROOT, "src", rel)}`);

const QURAN = JSON.parse(fs.readFileSync(path.join(ROOT, "vendor", "quran-arabic.json"), "utf8"));

/* ------------------------------------------------------------------ */
/* تطبيع النص القرآني                                                    */
/* ------------------------------------------------------------------ */

/**
 * يبقى من النصّ الحروف والأرقام فقط — لا تشكيل ولا علامات قرآنية.
 * نستعمل ترميز المحارف لا مدىً نصّيًا، لأن المدى السهو يبتلع الحروف نفسها
 * (مدى `ـ` إلى `‏` يبتلع كل الحروف العربية).
 */
const letters = (value) =>
  [...String(value)]
    .filter((ch) => {
      const cp = ch.codePointAt(0);
      return cp !== 0x0640 && ((cp >= 0x0621 && cp <= 0x064a) || (cp >= 0x0660 && cp <= 0x0669));
    })
    .join("");

/**
 * الحروف المدّية والهمزة. رسم المصحف يخالف فيها الرسم الإملائي
 * (ٱلصَّلَوٰة في العثماني، الصَّلَاة في الإملائي)، فيُحذف الحرف من الطرفين
 * معًا وإلا صار كل نصٍّ إملائيّ مرفوضًا.
 */
const MATER = "ءآأإٱٲٳؤئىةوا";

/** هيكل الحروف لمقارنة الآية بما ورد في الدرس. */
const skeleton = (value) =>
  letters(value)
    .split("")
    .map((ch) => (MATER.includes(ch) ? "" : ch))
    .join("");

/** «سُورَةُ ٱلْمَائـِدَةِ» → مفتاح السورة */
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

/** يحوّل الأرقام العربية-الهندية إلى لاتينية. */
const toEn = (value) =>
  String(value).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** «المائدة: ٦» → نصّ الآية، أو `null` إن كان المرجع مجهولًا. */
const verseFor = (ref) => {
  const match = /^([^:]+):\s*([٠-٩]+)$/.exec(ref);
  if (!match) return null;
  const surah = SURAH_BY_NAME.get(surahKey(match[1]));
  if (!surah) return null;
  return QURAN.surahs.find((s) => s.number === surah)?.ayahs.find((a) => a.n === Number(toEn(match[2])))?.text ?? null;
};

/** نصّ الاقتباس بلا ﴿﴾ و«...». */
const quoteText = (ayah) => skeleton(ayah.replace(/[﴿﴾.…]/g, ""));

/** يجمع كتل `evidence` من متن الدرس. */
const evidenceOf = (lesson) => {
  const out = [];
  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      if (node?.type === "evidence") out.push(node);
      walk(node?.children);
    }
  };
  walk(lesson.body);
  return out;
};

/* ------------------------------------------------------------------ */
/* المخطّط                                                              */
/* ------------------------------------------------------------------ */

test("وحدة الدروس تُحمَّل وهي مصفوفة كائنات", async () => {
  const { EXTRA_LESSONS, LESSON_PATCHES, mergeLessons, buildLessonIndex } =
    await load("data/lessons-extra.js");

  assert.equal(EXTRA_LESSONS.length, 5);
  for (const lesson of EXTRA_LESSONS) {
    for (const key of ["id", "cat", "catKey", "type", "icon", "title", "desc", "body"]) {
      assert.ok(lesson[key], `الدرس ${lesson.id ?? "؟"} ناقص الحقل ${key}`);
    }
    assert.ok(lesson.faq.length > 0, `${lesson.id}: لا أسئلة`);
    assert.ok(lesson.quiz.length > 0, `${lesson.id}: لا اختبار`);
    for (const q of lesson.quiz) {
      assert.ok(q.options.length >= 2, `${lesson.id}: خيارات ناقصة`);
      assert.ok(q.answer >= 0 && q.answer < q.options.length, `${lesson.id}: فهرس إجابة خارج المدى`);
    }
  }
  assert.equal(typeof mergeLessons, "function");
  assert.equal(typeof buildLessonIndex, "function");
  assert.equal(LESSON_PATCHES.food?.length, 2);
});

test("لا معرّف مكرّر بين الدروس الأساسية والمضافة", async () => {
  const { LESSONS } = await load("data/lessons.js");
  const { EXTRA_LESSONS } = await load("data/lessons-extra.js");

  const base = new Set(LESSONS.map((l) => l.id));
  for (const lesson of EXTRA_LESSONS) {
    assert.equal(base.has(lesson.id), false, `المعرّف ${lesson.id} مكرّر`);
  }
  const extra = EXTRA_LESSONS.map((l) => l.id);
  assert.equal(new Set(extra).size, extra.length, "تكرار داخل الدروس المضافة");
});

test("كل روابط related تشير إلى درس موجود", async () => {
  const { LESSONS } = await load("data/lessons.js");
  const { EXTRA_LESSONS, mergeLessons, buildLessonIndex } = await load("data/lessons-extra.js");

  const index = buildLessonIndex(mergeLessons(LESSONS));
  assert.equal(Object.keys(index).length, LESSONS.length + EXTRA_LESSONS.length);

  for (const lesson of Object.values(index)) {
    for (const rel of lesson.related ?? []) {
      assert.ok(index[rel], `${lesson.id}: related غير موجود (${rel})`);
    }
  }
});

test("المعرّفات القديمة المعلّقة صارت موجودة", async () => {
  const { LESSONS } = await load("data/lessons.js");
  const { mergeLessons, buildLessonIndex } = await load("data/lessons-extra.js");

  const index = buildLessonIndex(mergeLessons(LESSONS));
  // `lessons.js` كان يشير إلى `host` و`visit` ودونهما كانت الروابط معلّقة
  const food = LESSONS.find((l) => l.id === "food");
  const speech = LESSONS.find((l) => l.id === "speech");
  assert.ok(food.related.includes("host"), "در الطعام يشير إلى host");
  assert.ok(speech.related.includes("visit"), "درس الكلام يشير إلى visit");

  assert.ok(index.host, "درس الضيافة موجود (host)");
  assert.ok(index.visit, "درس زيارة المريض موجود (visit)");
});

test("الأيقونات المستعملة موجودة في ملف الرموز", async () => {
  const { EXTRA_LESSONS } = await load("data/lessons-extra.js");
  const svg = fs.readFileSync(path.join(ROOT, "src", "assets", "icons.svg"), "utf8");
  const ids = new Set([...svg.matchAll(/id="(i-[a-z-]+)"/g)].map((m) => m[1]));

  for (const lesson of EXTRA_LESSONS) {
    assert.ok(ids.has(lesson.icon), `أيقونة غير موجودة: ${lesson.icon}`);
  }
});

/* ------------------------------------------------------------------ */
/* تحقّق الآيات — وهو الفحص الأهمّ                                      */
/* ------------------------------------------------------------------ */

test("كل آية في الدروس تطابق نصّها ومرجعها في المصحف المخزَّن", async () => {
  const { LESSONS } = await load("data/lessons.js");
  const { EXTRA_LESSONS, LESSON_PATCHES, mergeLessons } = await load("data/lessons-extra.js");

  const evidence = [
    ...mergeLessons(LESSONS).flatMap(evidenceOf),
    ...LESSON_PATCHES.food,
  ];
  assert.ok(evidence.length >= 15, `عدد الآيات أقل من المتوقّع: ${evidence.length}`);

  for (const item of evidence) {
    const verse = verseFor(item.ref);
    assert.ok(verse, `مرجع مجهول: ${item.ref}`);

    const quoted = quoteText(item.ayah);
    assert.ok(quoted.length > 0, `اقتباس فارغ: ${item.ref}`);
    assert.ok(
      skeleton(verse).includes(quoted),
      `النصّ لا يطابق ${item.ref}\n  المذكور: ${item.ayah}\n  في المصدر: ${verse}`,
    );
  }
});

test("الفحص يرفض المرجع الخاطئ والنصّ المختلق", () => {
  const real = { ref: "البقرة: ٢٥٥", ayah: "﴿ وَٱللَّهُ لَا إِلَٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ ﴾" };

  assert.ok(verseFor(real.ref), "المرجع الصحيح يُحلَّل");
  assert.ok(
    skeleton(verseFor(real.ref)).includes(quoteText(real.ayah)),
    "النصّ الصحيح يمرّ",
  );

  // مرجع صحيح ونصّ من آية أخرى
  assert.equal(
    skeleton(verseFor(real.ref)).includes(quoteText("﴿ وَٱللَّهُ سُبْحَـٰنَهُ ﴾")),
    false,
    "نصّ من آية أخرى يُرفَض",
  );
  // نصّ صحيح ومرجع آية أخرى
  assert.equal(
    skeleton(verseFor("البقرة: ٢٥٦")).includes(quoteText(real.ayah)),
    false,
    "رقم آية خاطئ يُرفَض",
  );
  // مرجع لآية غير موجودة
  assert.equal(verseFor("البقرة: ٩٩٩"), null, "رقم آية خارج المدى يُرفَض");
  // سورة غير معروفة
  assert.equal(verseFor("سورة مجهولة: ١"), null, "سورة غير معروفة تُرفَض");
});

test("كل درس مضاف يحمل آية قرآنية واحدة على الأقل", async () => {
  const { EXTRA_LESSONS } = await load("data/lessons-extra.js");
  for (const lesson of EXTRA_LESSONS) {
    assert.ok(evidenceOf(lesson).length > 0, `${lesson.id} (${lesson.title}) بلا آية`);
  }
});

test("درس الطعام صار له آيتان بعد الإضافة", async () => {
  const { LESSONS } = await load("data/lessons.js");
  const { mergeLessons } = await load("data/lessons-extra.js");

  const before = evidenceOf(LESSONS.find((l) => l.id === "food")).length;
  const after = evidenceOf(mergeLessons(LESSONS).find((l) => l.id === "food")).length;
  assert.equal(before, 0, "كان بلا آية أصلًا");
  assert.equal(after, 2);
});

/* ------------------------------------------------------------------ */
/* التلوّث اللغوي                                                       */
/* ------------------------------------------------------------------ */

test("لا تلوّث لغوي في نصوص الدروس المضافة", async () => {
  const { EXTRA_LESSONS, LESSON_PATCHES } = await load("data/lessons-extra.js");

  /** الحقول التقنية لاتينية بطبيعتها فلا تُفحص. */
  const SKIP = new Set(["id", "catKey", "type", "icon", "related"]);
  const offenders = [];

  const scan = (value, key, at) => {
    if (typeof value === "string") {
      if (SKIP.has(key)) return;
      if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Cyrillic}\p{Script=Greek}]/u.test(value)) {
        offenders.push(`${at}: حروف غير عربية — ${value.slice(0, 40)}`);
        return;
      }
      // كلمة لاتينية داخل نصّ عربي علامة على حقن محتوى
      if (/[؀-ۿ]/u.test(value) && /[A-Za-z]{2,}/.test(value)) {
        offenders.push(`${at}: كلمة لاتينية — ${value.match(/[A-Za-z]{2,}/g).join(" ")}`);
      }
      return;
    }
    if (Array.isArray(value)) return value.forEach((v, i) => scan(v, key, `${at}[${i}]`));
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) scan(v, k, `${at}.${k}`);
    }
  };

  for (const lesson of EXTRA_LESSONS) scan(lesson, "", `lesson:${lesson.id}`);
  scan(LESSON_PATCHES, "", "patches");

  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("نصوص الدروس الأساسية سليمة لغويًّا (خطّ أساس)", async () => {
  const { LESSONS } = await load("data/lessons.js");

  const SKIP = new Set(["id", "catKey", "type", "icon", "related", "cat"]);
  const offenders = [];
  const scan = (value, key) => {
    if (typeof value === "string") {
      if (SKIP.has(key)) return;
      if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Cyrillic}]/u.test(value)) {
        offenders.push(`${key}: ${value.slice(0, 40)}`);
      }
      return;
    }
    if (Array.isArray(value)) return value.forEach((v) => scan(v, key));
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) scan(v, k);
    }
  };
  for (const lesson of LESSONS) scan(lesson, lesson.id);
  assert.deepEqual(offenders, [], offenders.join("\n"));
});
