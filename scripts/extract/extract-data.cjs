"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { evaluateDeclarations } = require("./script-data.cjs");
const { htmlToBlocks } = require("./blocks.cjs");

const SOURCE_DIR = "/home/abokhaled/Downloads/إسلامى";
const SITE_FILE = path.join(SOURCE_DIR, "نور الهدى.html");
const APP_FILE = path.join(SOURCE_DIR, "النُّور وصَلِّ لِي.html");
const V1_FILE = path.join(SOURCE_DIR, "deepseek_html_20260929_7a7dd5.html");
const NAMES_SUPPLEMENT = path.join(SOURCE_DIR, "بيانات-مكملة-أسماء-الله-٩٩.ts");
const OUT_DIR = path.join(__dirname, "..", "..", "src", "data");
const ASSET_DIR = path.join(__dirname, "..", "..", "src", "assets");

const HEADER = (source) =>
  `/**\n * مولَّد آليًا من: ${source}\n * المصدر: ملف HTML مرجعي (المحتوى الحرفي محفوظ).\n *لتعديل المحتوى راجع أهل العلم ثم عدّل الملف المصدر أو هذا الملف.\n */\n`;

function writeModule(fileName, body, source) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const target = path.join(OUT_DIR, fileName);
  fs.writeFileSync(target, HEADER(source) + body, "utf8");
  return target;
}

function assertNoHtml(value, label) {
  if (typeof value === "string" && /<\/?(div|span|p|ul|ol|li|h3|h4|strong|b|em)\b/i.test(value)) {
    throw new Error(`HTML خام تسرّب إلى ${label}: ${value.slice(0, 80)}`);
  }
}

const SERIALIZERS = [
  { test: (value) => Array.isArray(value) || (value && typeof value === "object"), run: (value) => `${JSON.stringify(value, null, 2)}\n` },
  { test: (value) => typeof value === "string", run: (value) => `${JSON.stringify(value)}\n` },
  { test: (value) => typeof value === "number" || typeof value === "boolean", run: (value) => `${JSON.stringify(value)}\n` },
];

/** Emits an `export const NAME = …;` statement with stable formatting. */
function exportConst(name, value, { indent = "" } = {}) {
  const serializer = SERIALIZERS.find((item) => item.test(value));
  if (!serializer) throw new Error(`نوع غير مدعوم للمتغير ${name}`);
  const body = serializer.run(value);
  if (body.startsWith("\n")) {
    return `export const ${name} =${indent ? `\n${indent}` : ""}${body
      .trimEnd()
      .split("\n")
      .map((line) => (indent ? indent + line : line))
      .join("\n")};\n`;
  }
  return `export const ${name} = ${body.trimEnd()};\n`;
}

function walk(value, visit, trail = []) {
  visit(value, trail);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, visit, [...trail, index]));
  else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => walk(item, visit, [...trail, key]));
  }
}

/* ------------------------------------------------------------------ */
/* 1) الموقع — نور الهدى                                              */
/* ------------------------------------------------------------------ */

function extractSite() {
  const values = evaluateDeclarations(SITE_FILE, [
    "MANHAJ_LESSONS", "LESSONS", "SCHOLARS", "SAYINGS", "SEERAH", "PROPHETS",
    "NAMES99", "DUAS", "ADHKAR", "KIDS", "QA", "DV", "DH", "ADHKAR_T", "TYPE_LABEL",
  ]);
  const written = [];

  const lessons = values.MANHAJ_LESSONS.map((lesson) => {
    const item = { ...lesson, body: htmlToBlocks(lesson.body) };
    walk(item, (node, trail) => assertNoHtml(node, `MANHAJ_LESSONS.${trail.join(".")}`));
    return item;
  });
  written.push(writeModule(
    "manhaj-lessons.js",
    exportConst("MANHAJ_LESSONS", lessons) +
      "\n/** فهرس سريع: معرّف الدرس ← موقعه في المصفوفة */\n" +
      exportConst("MANHAJ_BY_ID", Object.fromEntries(lessons.map((item) => [item.id, item])))
      .replace("export const MANHAJ_BY_ID", "export const MANHAJ_BY_ID"),
    "نور الهدى.html — MANHAJ_LESSONS",
  ));

  const fiqhLessons = values.LESSONS.map((lesson) => {
    const item = { ...lesson, body: htmlToBlocks(lesson.body) };
    walk(item, (node, trail) => assertNoHtml(node, `LESSONS.${trail.join(".")}`));
    return item;
  });
  written.push(writeModule(
    "lessons.js",
    exportConst("LESSONS", fiqhLessons) +
      "\n" +
      exportConst("LESSON_TYPE_LABEL", values.TYPE_LABEL) +
      "\n" +
      exportConst("LESSON_CATEGORIES", [...new Set(fiqhLessons.map((item) => item.catKey))]) +
      "\n" +
      exportConst("LESSONS_BY_ID", Object.fromEntries(fiqhLessons.map((item) => [item.id, item]))),
    "نور الهدى.html — LESSONS",
  ));

  written.push(writeModule("scholars.js", exportConst("SCHOLARS", values.SCHOLARS), "نور الهدى.html — SCHOLARS"));
  written.push(writeModule("sayings.js", exportConst("SAYINGS", values.SAYINGS), "نور الهدى.html — SAYINGS"));
  written.push(writeModule("seerah.js", exportConst("SEERAH", values.SEERAH), "نور الهدى.html — SEERAH"));
  written.push(writeModule("prophets.js", exportConst("PROPHETS", values.PROPHETS), "نور الهدى.html — PROPHETS"));
  written.push(writeModule("kids.js", exportConst("KIDS", values.KIDS), "نور الهدى.html — KIDS"));
  written.push(writeModule(
    "qa.js",
    exportConst("QA", values.QA),
    "نور الهدى.html — QA",
  ));
  written.push(writeModule(
    "duas.js",
    exportConst("DUAS", values.DUAS) +
      "\n" +
      exportConst("DUAS_KEYS", Object.keys(values.DUAS)),
    "نور الهدى.html — DUAS",
  ));
  written.push(writeModule(
    "adhkar.js",
    exportConst("ADHKAR", values.ADHKAR) +
      "\n" +
      exportConst("ADHKAR_KEYS", Object.keys(values.ADHKAR)) +
      "\n" +
      exportConst("ADHKAR_T", values.ADHKAR_T),
    "نور الهدى.html — ADHKAR",
  ));
  written.push(writeModule(
    "daily.js",
    exportConst("DAILY_VERSES", values.DV) +
      "\n" +
      exportConst("DAILY_HADITHS", values.DH),
    "نور الهدى.html — DV / DH",
  ));
  written.push(writeModule(
    "names99.js",
    exportConst("NAMES99", mergeNames(values.NAMES99)) +
      "\n" +
      exportConst("NAMES99_COUNT", mergeNames(values.NAMES99).length),
    "نور الهدى.html — NAMES99 + بيانات-مكملة-أسماء-الله-٩٩.ts",
  ));

  return written;
}

/** Merges the 20 names of the site with the supplemental 99-name list. */
function mergeNames(siteNames) {
  const supplemental = parseSupplementalNames();
  if (supplemental.length === 0) return siteNames;
  return supplemental;
}

function parseSupplementalNames() {
  if (!fs.existsSync(NAMES_SUPPLEMENT)) return [];
  const source = fs.readFileSync(NAMES_SUPPLEMENT, "utf8");
  const pattern = /\{\s*n:\s*(\d+),\s*name:\s*'([^']*)'\s*,\s*meaning:\s*'([^']*)'\s*,?\s*\}/g;
  const names = [];
  let match;
  while ((match = pattern.exec(source))) {
    names.push({ n: match[2], m: match[3] });
  }
  return names;
}

/* ------------------------------------------------------------------ */
/* 2) بنك الأسئلة — النسخة الأولى (نظام الاختبار المتقدّم)              */
/* ------------------------------------------------------------------ */

function extractQuestionBank() {
  const { QB } = evaluateDeclarations(V1_FILE, ["QB"]);
  const categories = {};
  let total = 0;
  for (const [key, category] of Object.entries(QB)) {
    const questions = category.questions.map((question) => {
      if (!question.e) throw new Error(`سؤال بلا تعليل في فئة ${key}: ${question.q}`);
      const item = { t: question.t, d: question.d, q: question.q };
      if (question.t === "mc") item.o = question.o;
      if (question.t === "tf") item.a = question.a;
      if (question.t === "fill") item.a = question.a;
      if (question.t !== "fill") item.a = question.a;
      item.e = question.e;
      return item;
    });
    total += questions.length;
    categories[key] = {
      key,
      title: category.title,
      desc: category.desc,
      icon: category.icon,
      group: CATEGORY_GROUP[key] ?? "other",
      questions,
    };
  }

  return writeModule(
    "question-bank.js",
    `/** بنك الأسئلة ثلاثي الأنواع (مصدره: ${path.basename(V1_FILE)}) */\n` +
      `export const QUESTION_BANK = ${JSON.stringify(categories, null, 2)}\n` +
      `\n/** المجموعات المعروضة في شاشة إعدادات الاختبار */\n` +
      exportConst("QUESTION_GROUPS", [
        { key: "salaf", title: "منهج السلف", categories: ["salaf", "aqeedah", "seerah", "adab"] },
        { key: "fiqh", title: "الفقه", categories: ["tahara", "salah", "zakah"] },
        { key: "worship", title: "العبادات", categories: ["salah", "zakah"] },
        { key: "names", title: "أسماء الله", categories: ["names"] },
        { key: "quran", title: "القرآن", categories: ["quran"] },
      ]) +
      `\n/** إجمالي أسئلة البنك: ${total} */\n` +
      exportConst("QUESTION_BANK_SIZE", total),
    "deepseek_html_20260929_7a7dd5.html — QB",
  );
}

const CATEGORY_GROUP = {
  salaf: "salaf",
  aqeedah: "salaf",
  seerah: "salaf",
  adab: "salaf",
  tahara: "fiqh",
  salah: "worship",
  zakah: "worship",
  names: "names",
  quran: "quran",
};

/* ------------------------------------------------------------------ */
/* 3) التطبيق — بوابة النور                                            */
/* ------------------------------------------------------------------ */

function extractApp() {
  const values = evaluateDeclarations(APP_FILE, [
    "athkarData", "duaData", "hadithData", "radioStations", "dailyVerses",
    "dailyHadiths", "dailyWisdom", "hijriEvents", "ATHAN_URLS",
    "CITY_COORDS", "CITY_NAMES_AR",
  ]);
  const written = [];
  written.push(writeModule("app-athkar.js", exportConst("ATHKAR_DATA", values.athkarData), "النُّور وصَلِّ لِي.html — athkarData"));
  written.push(writeModule("app-duas.js", exportConst("APP_DUAS", values.duaData), "النُّور وصَلِّ لِي.html — duaData"));
  written.push(writeModule("hadiths.js", exportConst("HADITHS", values.hadithData), "النُّور وصَلِّ لِي.html — hadithData"));
  written.push(writeModule("radio.js", exportConst("RADIO_STATIONS", values.radioStations), "النُّور وصَلِّ لِي.html — radioStations"));
  written.push(writeModule("hijri-events.js", exportConst("HIJRI_EVENTS", values.hijriEvents), "النُّور وصَلِّ لِي.html — hijriEvents"));
  written.push(
    writeModule(
      "app-daily.js",
      exportConst("APP_DAILY_VERSES", values.dailyVerses) +
        "\n" +
        exportConst("APP_DAILY_HADITHS", values.dailyHadiths) +
        "\n" +
        exportConst("APP_DAILY_WISDOM", values.dailyWisdom) +
        "\n" +
        exportConst("ATHAN_URLS", values.ATHAN_URLS),
      "النُّور وصَلِّ لِي.html — dailyVerses / dailyHadiths / dailyWisdom / ATHAN_URLS",
    ),
  );
  written.push(
    writeModule(
      "cities.js",
      exportConst("CITY_COORDS", values.CITY_COORDS) +
        "\n" +
        exportConst("CITY_NAMES_AR", values.CITY_NAMES_AR) +
        "\n" +
        exportConst("CITY_LIST", Object.keys(values.CITY_COORDS).map((en) => ({
          en,
          ar: values.CITY_NAMES_AR[en],
          lat: values.CITY_COORDS[en][0],
          lng: values.CITY_COORDS[en][1],
        }))),
      "النُّور وصَلِّ لِي.html — CITY_COORDS / CITY_NAMES_AR",
    ),
  );
  return written;
}

/* ------------------------------------------------------------------ */
/* 4) سبرايت الأيقونات                                                  */
/* ------------------------------------------------------------------ */

function extractIcons() {
  const html = fs.readFileSync(SITE_FILE, "utf8");
  const symbols = [];
  const pattern = /<symbol\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/g;
  let match;
  while ((match = pattern.exec(html))) symbols.push({ id: match[1], body: match[2].trim() });
  if (symbols.length === 0) return [];
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">\n${symbols
    .map((symbol) => `  <symbol id="${symbol.id}" viewBox="0 0 24 24">${symbol.body}</symbol>`)
    .join("\n")}\n</svg>`;
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  const target = path.join(ASSET_DIR, "icons.svg");
  fs.writeFileSync(target, `${sprite}\n`, "utf8");
  return [{ file: target, count: symbols.length }];
}

function main() {
  const written = [...extractSite(), extractQuestionBank(), ...extractApp()];
  for (const file of written) console.log(`✔ ${path.relative(process.cwd(), file)}`);
  for (const icons of extractIcons()) {
    console.log(`✔ ${path.relative(process.cwd(), icons.file)} (${icons.count} رمزًا)`);
  }
}

main();