"use strict";

/**
 * تحقّق من أمانة النقل: يقارن نصّ الملف المصدر مع نصّ كتل JSON
 * لكل مجموعة بيانات، ويبلّغ عن أي فرق في المحارف.
 */

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { evaluateDeclarations } = require("./script-data.cjs");
const { htmlToBlocks, inlineText } = require("./blocks.cjs");
const { parseFragment, textOf } = require("./html-parser.cjs");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE_DIR = path.resolve(
  process.env.ISLAMIC_LIBRARY_SOURCE_DIR || path.join(os.homedir(), "Downloads", "إسلامى"),
);
const SITE_FILE = path.join(SOURCE_DIR, "نور الهدى.html");
const V1_FILE = path.join(SOURCE_DIR, "legacy_html_20260929_7a7dd5.html");
const LEGACY_FILE = path.join(SOURCE_DIR, "legacy_html_20260929_997a67.html");
const NOUR_APP = path.join(SOURCE_DIR, "النُّور وصَلِّ لِي.html");
const REQUIRE_SOURCES = process.env.VERIFY_CONTENT_REQUIRE_SOURCES === "1";

const normalize = (value) => value.replace(/\s+/g, "").replace(/[ً-ْٰـ«»"'\*_]/g, "");

function blocksText(blocks) {
  let out = "";
  for (const block of blocks) {
    out += block.text ?? block.ayah ?? block.title ?? "";
    if (block.items) out += block.items.join("");
    if (block.ref) out += block.ref;
    if (block.scholar) out += block.scholar;
    if (block.children) out += blocksText(block.children);
  }
  return out;
}

function htmlText(html) {
  return textOf(parseFragment(html));
}

function compare(label, entries) {
  let lost = 0;
  for (const { id, source, blocks } of entries) {
    const before = normalize(htmlText(source));
    const after = normalize(blocksText(blocks));
    if (before !== after) {
      lost += 1;
      console.log(`✗ ${label}/${id}: فقد ${Math.abs(before.length - after.length)} محرفًا`);
      const index = [...before].findIndex((char, position) => char !== after[position]);
      console.log(`   الموضع ${index} — الأصل: …${before.slice(Math.max(0, index - 40), index + 60)}…`);
      console.log(`   بعد النقل: …${after.slice(Math.max(0, index - 40), index + 60)}…`);
    }
  }
  console.log(lost === 0 ? `✔ ${label}: تطابق تام (${entries.length} عنصرًا)` : `${label}: ${lost} عنصرًا غير مطابق`);
  return lost;
}

const failures = [];
const requiredSources = [SITE_FILE, V1_FILE];
const missingRequiredSources = requiredSources.filter((file) => !fs.existsSync(file));
if (missingRequiredSources.length) {
  console.log(`… تخطّي مقارنة المصدر؛ ملفات المصدر غير موجودة في ${SOURCE_DIR}`);
  if (REQUIRE_SOURCES) failures.push(missingRequiredSources.length);
}

if (fs.existsSync(SITE_FILE)) {
  const site = evaluateDeclarations(SITE_FILE, ["MANHAJ_LESSONS", "LESSONS"]);
  failures.push(
    compare("MANHAJ_LESSONS", site.MANHAJ_LESSONS.map((item) => ({
      id: item.id,
      source: item.body,
      blocks: htmlToBlocks(item.body),
    }))),
    compare("LESSONS", site.LESSONS.map((item) => ({
      id: item.id,
      source: item.body,
      blocks: htmlToBlocks(item.body),
    }))),
  );
}

if (fs.existsSync(V1_FILE)) {
  const { QB } = evaluateDeclarations(V1_FILE, ["QB"]);
  const questionCount = Object.values(QB).reduce((sum, category) => sum + category.questions.length, 0);
  const missingExplanation = Object.values(QB)
    .flatMap((category) => category.questions)
    .filter((question) => !question.e);
  console.log(missingExplanation.length === 0
    ? `✔ QUESTION_BANK: ${questionCount} سؤالًا، كلها بتعليل`
    : `✗ QUESTION_BANK: ${missingExplanation.length} سؤالًا بلا تعليل`);
  failures.push(missingExplanation.length);
}

/* ------- المحتوى المدمج من legacy_html_20260929_997a67.html ------- */

/** يحمّل قيمة مُصدَّرة من وحدة ES في المشروع. */
function loadModule(file, exportName) {
  const source = fs.readFileSync(path.resolve(ROOT, file), "utf8").replace(/export const /g, "const ");
  return new Function(`${source}\nreturn ${exportName};`)();
}

const bank = loadModule("src/data/question-bank.js", "QUESTION_BANK");
const allQuestions = Object.values(bank).flatMap((category) => category.questions);

/** تطبيع النص لمطابقة مصدر الملف (يُهمل التشكيل والتطويل). */
const normalizeText = (value) =>
  String(value ?? "")
    .replace(/[\sً-ْٰـ«»"'().،,:؛؟!\[\]{}]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");

/** نصّ السؤال بعد التطبيع — المصدر قد يختلف في التشكيل عن المشروع. */
const questionText = (question) => normalizeText(question.q);

if (fs.existsSync(LEGACY_FILE)) {
  const { QUIZ_BANK } = evaluateDeclarations(LEGACY_FILE, ["QUIZ_BANK"]);
  const sourceQuestions = Object.values(QUIZ_BANK).flatMap((category) => category.questions ?? []);
  const projectTexts = new Set(allQuestions.map(questionText));

  const lost = sourceQuestions.filter((question) => !projectTexts.has(questionText(question)));
  console.log(lost.length === 0
    ? `✔ QUIZ_BANK_MERGED: كل أسئلة الملف القديم (${sourceQuestions.length}) موجودة في البنك`
    : `✗ QUIZ_BANK_MERGED: ${lost.length} سؤالًا من الملف القديم غير موجود`);
  failures.push(lost.length);

  // لا تكرار في البنك بعد الدمج
  const seen = new Set();
  const duplicates = allQuestions.filter((question) => {
    const key = String(question.q).replace(/\s/g, "");
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  console.log(duplicates.length === 0
    ? `✔ QUESTION_BANK_UNIQUE: ${allQuestions.length} سؤالًا بلا تكرار`
    : `✗ QUESTION_BANK_UNIQUE: ${duplicates.length} سؤالًا مكرّرًا`);
  failures.push(duplicates.length);

  // مخطّط كل سؤال صحيح
  const validTypes = new Set(["mc", "tf", "fill"]);
  const badSchema = allQuestions.filter(
    (question) =>
      !validTypes.has(question.t) ||
      !["easy", "medium", "hard"].includes(question.d) ||
      !question.e ||
      (question.t === "mc" && (!Array.isArray(question.o) || question.o.length < 3)),
  );
  console.log(badSchema.length === 0
    ? `✔ QUESTION_BANK_SCHEMA: ${allQuestions.length} سؤالًا بمخطّط صحيح`
    : `✗ QUESTION_BANK_SCHEMA: ${badSchema.length} سؤالًا بمخطّط خاطئ`);
  failures.push(badSchema.length);

  // العدّاد المعلَن يطابق الواقع
  const size = loadModule("src/data/question-bank.js", "QUESTION_BANK_SIZE");
  const sizeOk = size === allQuestions.length;
  console.log(sizeOk
    ? `✔ QUESTION_BANK_SIZE: ${size} يطابق العدد الفعلي`
    : `✗ QUESTION_BANK_SIZE: المعلَن ${size} والفعلي ${allQuestions.length}`);
  failures.push(sizeOk ? 0 : 1);

  // البيانات الأخرى المدمجة موجودة ولم تتكرر
  const mergeSets = [
    ["SCHOLARS", "src/data/scholars.js", "SCHOLARS", "name"],
    ["SEERAH", "src/data/seerah.js", "SEERAH", "title"],
    ["SAYINGS", "src/data/sayings.js", "SAYINGS", "txt"],
  ];
  for (const [label, file, exportName, key] of mergeSets) {
    const list = loadModule(file, exportName);
    const keys = list.map((item) => String(item[key]).replace(/\s/g, ""));
    const unique = new Set(keys);
    const ok = keys.length === unique.size;
    console.log(ok
      ? `✔ ${label}: ${list.length} عنصرًا بلا تكرار`
      : `✗ ${label}: ${list.length - unique.size} عنصرًا مكرّرًا`);
    failures.push(ok ? 0 : 1);
  }
} else {
  console.log("… تخطّي مقارنة البنك بالملف القديم (غير موجود)");
}

/* ------- تغطية شاملة: كل ثابت بيانات في ملفات المصدر ------- */

const norm = (value) =>
  String(value ?? "")
    .replace(/[\sً-ْٰـ«»"'()[\]{}.,،:؛؟!\uFD3E\uFD3F]+/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ئى]/g, "ي")
    .replace(/ة/g, "ه");

/** [ثابت المصدر، ملف المشروع، التصدير، حقل المصدر، حقل المشروع] */
const COVERAGE = [
  ["dailyVerses", "src/data/daily.js", "DAILY_VERSES", "text", "ayah"],
  ["dailyHadiths", "src/data/daily.js", "DAILY_HADITHS", "text", "text"],
  ["radioStations", "src/data/radio.js", "RADIO_STATIONS", "name", "name"],
  ["hadithData", "src/data/hadiths.js", "HADITHS", "title", "title"],
  ["hijriEvents", "src/data/hijri-events.js", "HIJRI_EVENTS", "title", "title"],
  ["duaData", "src/data/app-duas.js", "APP_DUAS", "title", "title"],
];

if (fs.existsSync(NOUR_APP)) {
  const nour = evaluateDeclarations(NOUR_APP, COVERAGE.map(([n]) => n));
  for (const [srcName, file, exportName, sourceField, projectField] of COVERAGE) {
    const sourceItems = nour[srcName];
    if (!sourceItems) continue;
    const items = Array.isArray(sourceItems)
      ? sourceItems
      : Object.values(sourceItems).flat().filter((x) => x && typeof x === "object");
    if (!items.length) continue;
    let projectItems;
    try {
      projectItems = loadModule(file, exportName);
    } catch {
      console.log(`✗ ${exportName}: تعذّر تحميله من ${file}`);
      failures.push(1);
      continue;
    }
    const have = new Set(projectItems.map((item) => norm(item[projectField])));
    const lost = items.filter((item) => !have.has(norm(item[sourceField])));
    console.log(lost.length === 0
      ? `✔ ${exportName.padEnd(16)} ${items.length} من المصدر — كلها موجودة (${projectItems.length} بالمشروع)`
      : `✗ ${exportName.padEnd(16)} ${lost.length} ناقصًا من ${items.length}`);
    failures.push(lost.length);
  }
} else {
  console.log("… تخطّي مقارنة المحتوى مع تطبيق المصدر (غير موجود)");
}

process.exit(failures.some(Boolean) ? 1 : 0);
