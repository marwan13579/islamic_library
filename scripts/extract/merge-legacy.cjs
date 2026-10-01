"use strict";

/**
 * دمج محتوى الملف legacy_html_20260929_997a67.html في المشروع.
 *
 * هذا الملف نسخة أقدم وأصغر من «نور الهدى.html»، لكنه يحتوي عناصر
 * ناقصة في المشروع (أسئلة اختبار، أسماء، علماء، سيرة، مقالات).
 * الأداة تدمج **العناصر الفريدة فقط** بعد مطابقة نصّية، وتحافظ على
 * مخطّط المشروع (t/d/q/o/a/e) بعد تحويله من مخطّط المصدر (diff/q/opts/a/exp).
 *
 * لا تُولَّد أي نصوص جديدة هنا — كل نصّ مأخوذ حرفيًا من الملف المصدر.
 *
 * التشغيل:  node scripts/extract/merge-legacy.mjs [--write]
 */

const fs = require("node:fs");
const path = require("node:path");
const { evaluateDeclarations } = require("./script-data.cjs");

const ROOT = path.join(__dirname, "..", "..");
const SOURCE = "/home/abokhaled/Downloads/إسلامى/legacy_html_20260929_997a67.html";
const WRITE = process.argv.includes("--write");

/** يطبّع النص للمقارنة: يحذف التشكيل والتطويل والمسافات وأشكال الهمزة. */
const norm = (value) =>
  String(value ?? "")
    .replace(/[\sً-ْٰـ«»"'.،,:؛؟!()\[\]{}]/g, "")
    .replace(/[أإآٱٲٳ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ئىي]/g, "ي")
    .replace(/ة/g, "ه");

/** Difficulty mapping from the source vocabulary to the project's. */
const DIFF = { easy: "easy", medium: "medium", hard: "hard" };

/** مثل `norm` مع إسقاط «ال» التعريف، ليقارن «الوفاة» بـ«وفاة النبي ﷺ». */
const core = (value) => String(norm(value)).replace(/^ال/, "");

/**
 * أول كلمة من العنوان بعد التطبيع.
 * لا يُستعمل `norm` هنا لأنه يحذف المسافات، فلا تبقى حدود كلمات — والحدود
 * هي ما يجعل «الهجرة» تطابق «هجرة النبي ﷺ».
 */
const headWord = (value) => core(String(value ?? "").trim().split(/\s+/)[0] ?? "");

/**
 * يبني دالة تختبر هل المحور الوارد من الملف الأقدم هو محور موجود سلفًا.
 *
 * الملف الأقدم يُسمّي المحاور نفسها بصياغة أقصر («الهجرة» مقابل «الهجرة إلى
 * المدينة»)، فالمطابقة على العنوان الحرفي كانت تُدخل الحدث مرّتين في القائمة.
 * لذلك نطابق على السنة + جوهر الاسم أو الوصف بعد إسقاط «ال» التعريف.
 *
 * @param {Array<{year?: string, title?: string, desc?: string}>} existing
 * @returns {(item: {year?: string, title?: string, desc?: string}) => boolean}
 */
function seerahMatcher(existing) {
  const fingerprints = (existing ?? []).map((item) => [
    norm(item.year),
    core(item.title),
    core(item.desc),
    headWord(item.title),
  ]);
  return (item) => {
    const year = norm(item.year);
    const title = core(item.title);
    const desc = core(item.desc);
    const head = headWord(item.title);
    return fingerprints.some(([y, t, d, h]) => {
      if (y !== year) return false;
      if (title && t && (t.includes(title) || title.includes(t))) return true;
      if (desc && d && (d.includes(desc) || desc.includes(d))) return true;
      // «الهجرة» و«هجرة النبي ﷺ» لا يتقاطعان كنصّ، لكنهما يبدآن بالكلمة نفسها.
      return Boolean(head && h && head === h);
    });
  };
}

module.exports = { norm, core, headWord, seerahMatcher };

const load = (file, names) => evaluateDeclarations(file, names);

/** JSON يُسبق بسطرين ليطابق تنسيق المشروع. */
const indent = (json) => json.replace(/^/gm, "  ");

function main() {
  const src = load(SOURCE, [
    "QUIZ_BANK", "NAMES99", "SCHOLARS", "SEERAH", "SAYINGS", "PROPHETS", "QA", "KIDS", "DUAS",
  ]);

  const bankFile = path.join(ROOT, "src", "data", "question-bank.js");
  const namesFile = path.join(ROOT, "src", "data", "names99.js");
  const scholarsFile = path.join(ROOT, "src", "data", "scholars.js");
  const seerahFile = path.join(ROOT, "src", "data", "seerah.js");
  const sayingsFile = path.join(ROOT, "src", "data", "sayings.js");

  // نقرأ نصّ الوحدات الحالية كنصّ JSON مضمّن لنتفاد إعادة الكتابة العمياء
  const bankExports = loadExports(bankFile, ["QUESTION_BANK", "QUESTION_GROUPS"]);
  const currentBank = bankExports.QUESTION_BANK;
  const currentNames = loadExports(namesFile, ["NAMES99"]).NAMES99;
  const currentScholars = loadExports(scholarsFile, ["SCHOLARS"]).SCHOLARS;
  const currentSeerah = loadExports(seerahFile, ["SEERAH"]).SEERAH;
  const currentSayings = loadExports(sayingsFile, ["SAYINGS"]).SAYINGS;

  const report = [];

  /* ---------------------------- بنك الأسئلة ---------------------------- */

  const bankExisting = new Set();
  for (const category of Object.values(currentBank)) {
    for (const question of category.questions) bankExisting.add(norm(question.q));
  }

  const newQuestions = [];
  for (const [key, category] of Object.entries(src.QUIZ_BANK)) {
    const target = currentBank[key];
    if (!target) continue;
    for (const question of category.questions ?? []) {
      if (bankExisting.has(norm(question.q))) continue;
      if (!question.exp) continue;
      if (!Array.isArray(question.opts) || question.opts.length < 3) continue;
      bankExisting.add(norm(question.q));
      newQuestions.push({
        key,
        value: {
          // t = نوع السؤال في المشروع، d = درجة الصعوبة
          t: "mc",
          d: DIFF[question.diff] ?? "medium",
          q: question.q,
          o: question.opts,
          a: question.a,
          e: question.exp,
        },
      });
    }
  }
  report.push(["QUESTION_BANK", newQuestions.length, Object.values(currentBank).reduce((s, c) => s + c.questions.length, 0)]);

  /* ------------------------------ الأسماء ------------------------------ */

  const nameExisting = new Set(currentNames.map((item) => norm(item.n ?? item.name)));
  const newNames = (src.NAMES99 ?? []).filter((item) => {
    const key = norm(item.name ?? item.n);
    return key && !nameExisting.has(key);
  });
  report.push(["NAMES99", newNames.length, currentNames.length]);

  /* ------------------------------ العلماء ------------------------------ */

  const scholarExisting = new Set(currentScholars.map((item) => norm(item.name)));
  const newScholars = (src.SCHOLARS ?? []).filter((item) => !scholarExisting.has(norm(item.name)));
  report.push(["SCHOLARS", newScholars.length, currentScholars.length]);

  /* ------------------------------- السيرة ------------------------------ */

  const isSameEvent = seerahMatcher(currentSeerah);
  const newSeerah = (src.SEERAH ?? []).filter((item) => !isSameEvent(item));
  report.push(["SEERAH", newSeerah.length, currentSeerah.length]);

  /* ----------------------------- الأقوال ------------------------------ */

  const sayingExisting = new Set(currentSayings.map((item) => norm(item.txt ?? item.text)));
  const newSayings = (src.SAYINGS ?? []).filter((item) => !sayingExisting.has(norm(item.txt ?? item.text)));
  report.push(["SAYINGS", newSayings.length, currentSayings.length]);

  console.log("=== ما سيُدمج ===");
  for (const [name, added, before] of report) {
    console.log(`  ${name.padEnd(15)} +${String(added).padEnd(4)} (الحالي ${before} → ${Number(before) + Number(added)})`);
  }

  if (!WRITE) {
    console.log("\n(وضع المعاينة — أضف --write للتطبيق)");
    return;
  }

  /* ----------------------------- الكتابة ----------------------------- */

  if (newQuestions.length) {
    // إعادة توليد الملف بالكامل من البيانات المدمجة — أمتن من التعديل النصّي
    const groups = loadExports(bankFile, ["QUESTION_BANK", "QUESTION_GROUPS"]);
    const header = [
      "/**",
      " * مولَّد آليًا من: legacy_html_20260929_7a7dd5.html — QB",
      " * المصدر: ملف HTML مرجعي (المحتوى الحرفي محفوظ).",
      " *LETعديل المحتوى راجع أهل العلم ثم عدّل الملف المصدر أو هذا الملف.",
      " */",
    ]
      .join("\n")
      .replace("LETعديل", "لتعديل");

    for (const { key, value } of newQuestions) {
      groups.QUESTION_BANK[key].questions.push(value);
    }
    const size = Object.values(groups.QUESTION_BANK).reduce((sum, c) => sum + c.questions.length, 0);

    const body = [
      header,
      "/** بنك الأسئلة ثلاثي الأنواع (مصدره: legacy_html_20260929_7a7dd5.html + 997a67) */",
      `export const QUESTION_BANK = ${indent(JSON.stringify(groups.QUESTION_BANK, null, 2), 0)};`,
      "/** المجموعات المعروضة في شاشة إعدادات الاختبار */",
      `export const QUESTION_GROUPS = ${indent(JSON.stringify(groups.QUESTION_GROUPS, null, 2), 0)};`,
      `/** إجمالي أسئلة البنك: ${size} */`,
      `export const QUESTION_BANK_SIZE = ${size};`,
      "",
    ].join("\n");

    fs.writeFileSync(bankFile, body);
  }

  const appendTo = (file, exportName, items, shape) => {
    if (!items.length) return;
    const list = loadExports(file, [exportName])[exportName];
    const marker = "\n  // ── مدمج من legacy_html_20260929_997a67.html ──\n";
    const merged = [...list, ...items.map(shape)];
    const text = fs.readFileSync(file, "utf8");
    const start = text.indexOf(`export const ${exportName} = [`);
    const end = text.lastIndexOf("\n];");
    if (start < 0 || end < 0) throw new Error(`تعذّر تحديد ${exportName} في ${file}`);
    const head = text.slice(0, start);
    // نتخطّى "\n];" لأن JSON المُدمج ينتهي بقوسه بالفعل
    const tail = text.slice(end + 3);
    fs.writeFileSync(
      file,
      head +
        `export const ${exportName} = ` +
        indent(JSON.stringify(merged, null, 2), 0) +
        marker +
        tail,
    );
  };

  appendTo(namesFile, "NAMES99", newNames, (item) => ({
    n: item.n ?? item.name,
    m: item.m ?? item.meaning,
  }));
  appendTo(scholarsFile, "SCHOLARS", newScholars, (item) => item);
  appendTo(seerahFile, "SEERAH", newSeerah, (item) => item);
  appendTo(sayingsFile, "SAYINGS", newSayings, (item) => ({
    txt: item.txt,
    author: item.author,
    src: "منهج السلف في الاتباع",
  }));

  console.log("\n✔ تم الدمج.");
}

/** يقرأ وحدة ES ويُعيد قيم التصديرات المطلوبة. */
function loadExports(file, names) {
  const source = fs.readFileSync(file, "utf8").replace(/export const /g, "const ");
  const fn = new Function(`${source}\nreturn { ${names.join(", ")} };`);
  return fn();
}

if (require.main === module) main();

