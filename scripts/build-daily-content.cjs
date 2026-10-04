"use strict";

/**
 * جسر المحتوى اليومي — يولّد `daily-content.js` من وحدات البيانات الموثوقة.
 *
 * الصفحة الرئيسية تفتح من القرص (file://) أحيانًا، ومتصفح يرفض وحدات ES من
 * file:// لأن أصل الصفحة null. فالمحتوى الديني الذي تعرضه الصفحة الرئيسية
 * لا يُنسخ يدويًا (نسخٌ يدوي يتفرّق عن المصدر)، بل يُولَّد من
 * `src/data/daily.js` و`src/data/app-daily.js` — وهما المصدر الوحيد.
 *
 * الاستعمال:
 *   node scripts/build-daily-content.cjs            # كتابة الملف
 *   node scripts/build-daily-content.cjs --check     # التحقق من عدم التخلّف
 */

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "daily-content.js");
const CHECK = process.argv.includes("--check");

const SOURCES = [
  { file: "src/data/daily.js", keys: ["DAILY_VERSES", "DAILY_HADITHS"] },
  { file: "src/data/app-daily.js", keys: ["APP_DAILY_VERSES", "APP_DAILY_HADITHS", "APP_DAILY_WISDOM"] },
  { file: "src/data/app-duas.js", keys: ["APP_DUAS"] },
];

const HEADER = `/*
 * مولَّد آليًا من: src/data/daily.js + src/data/app-daily.js
 * لا تعدّل هذا الملف يدويًا — عدّل المصدر ثم شغّل: npm run build:content
 * المصدر: وحدات البيانات في المشروع (المحتوى الحرفي محفوظ).
 */
`;

/** يوحّد شكل العنصر حتى لو اختلفت التسمية بين الوحدات (ref / src). */
function normalizeVerse(item) {
  const text = String(item.text ?? item.ayah ?? "").replace(/^"|"$/g, "").trim();
  return { text, ref: String(item.ref ?? "").replace(/^\[|\]$/g, "").trim() };
}

function normalizeQuoted(item) {
  const text = String(item.text ?? "").replace(/^"|"$/g, "").trim();
  const ref = String(item.ref ?? item.src ?? "").replace(/^\[|\]$/g, "").trim();
  return { text, ref };
}

/** الدعاء يحمل عنوانًا ونسخته (صباح/مساء/سفر…) ثمّ مصدره. */
function normalizeDua(item) {
  const base = normalizeQuoted(item);
  return {
    text: base.text,
    ref: base.ref,
    title: String(item.title ?? "").trim(),
    cat: String(item.cat ?? "").trim(),
  };
}

async function loadSources() {
  const out = { verses: [], hadiths: [], wisdom: [], duas: [] };
  for (const source of SOURCES) {
    const absolute = path.join(ROOT, source.file);
    if (!fs.existsSync(absolute)) throw new Error(`Missing data module: ${source.file}`);
    const mod = await import(pathToFileURL(absolute).href);
    for (const key of source.keys) {
      const list = mod[key];
      if (!Array.isArray(list)) throw new Error(`${source.file} does not export an array named ${key}`);
      for (const item of list) {
        if (key.endsWith("VERSES")) out.verses.push(normalizeVerse(item));
        else if (key.endsWith("HADITHS")) out.hadiths.push(normalizeQuoted(item));
        else if (key === "APP_DUAS") out.duas.push(normalizeDua(item));
        else out.wisdom.push(normalizeQuoted(item));
      }
    }
  }
  // إزالة التكرار مع الحفاظ على الترتيب: النسختان تتشاركان نفس الآيات والأحاديث.
  const unique = (list) => {
    const seen = new Set();
    return list.filter((item) => {
      const key = item.text + "|" + item.ref;
      if (!item.text || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  out.verses = unique(out.verses);
  out.hadiths = unique(out.hadiths);
  out.wisdom = unique(out.wisdom);
  out.duas = unique(out.duas);
  return out;
}

async function main() {
  const content = await loadSources();
  if (!content.verses.length) throw new Error("Refusing to write an empty daily content file.");
  const body =
    HEADER +
    "(function (root) {\n" +
    "  root.DailyContent = Object.freeze(" +
    JSON.stringify(content, null, 2) +
    ");\n" +
    "})(typeof window !== \"undefined\" ? window : globalThis);\n";

  if (CHECK) {
    const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
    if (current !== body) {
      console.error("✖ daily-content.js متخلّف عن src/data — شغّل: npm run build:content");
      process.exit(1);
    }
    console.log(`✔ daily-content.js مطابق للمصدر (${content.verses.length} آية · ${content.hadiths.length} حديث · ${content.wisdom.length} فائدة)`);
    return;
  }

  fs.writeFileSync(OUTPUT, body, "utf8");
  console.log(`✔ daily-content.js: ${content.verses.length} آية · ${content.hadiths.length} حديث · ${content.wisdom.length} فائدة`);
}

main().catch((error) => {
  console.error(`✖ ${error.message}`);
  process.exit(1);
});