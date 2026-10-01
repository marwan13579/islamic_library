"use strict";

/**
 * دمج شامل لكل ما تبقّى في ملفات المصدر المرجعية داخل
 * /home/abokhaled/Downloads/إسلامى إلى المشروع.
 *
 * المبدأ: **نقل حرفي فقط** — لا يُولَّد أي نصّ. كل ما يُضاف مأخوذ من
 * الملفات المصدر حرفيًا، وبمخطّط المشروع بعد التحويل.
 *
 * القاعدة: يُضاف العنصر فقط إذا لم يكن مكافئًا (بعد تطبيع النصّ)
 * لعنصر موجود فعلًا.
 *
 * التشغيل:  node scripts/extract/merge-all.cjs [--write]
 */

const fs = require("node:fs");
const path = require("node:path");
const { evaluateDeclarations } = require("./script-data.cjs");

const ROOT = path.join(__dirname, "..", "..");
const SRC_DIR = "/home/abokhaled/Downloads/إسلامى";
const WRITE = process.argv.includes("--write");

const NOUR = path.join(SRC_DIR, "النُّور وصَلِّ لِي.html");
const NOOR = path.join(SRC_DIR, "نور الهدى.html");
const LEGACY = path.join(SRC_DIR, "legacy_html_20260929_997a67.html");
const V1 = path.join(SRC_DIR, "legacy_html_20260929_7a7dd5.html");

/* ------------------------------ أدوات ------------------------------ */

/**
 * تطبيع النصّ للمقارنة: يتجاهل التشكيل والتطويل والزخرفة واختلاف
 * علامات الترقيم وأشكال الهمزة، فلا يُعدّ اختلافُ الكتابة اختلافًا في المعنى.
 */
const norm = (value) =>
  String(value ?? "")
    .replace(/[\sً-ْٰـ«»"'()[\]{}.,،:؛؟!﴿﴾«»ـ]+/g, "")
    .replace(/[أإآٱٲٳ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ئى]/g, "ي")
    .replace(/ة/g, "ه");

/** يقرأ وحدة ES من المشروع ويُعيد تصديرًا منها. */
function loadExports(file, names) {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8").replace(/export const /g, "const ");
  return new Function(`${source}\nreturn { ${names.join(", ")} };`)();
}

/** يعيد كتابة ملف البيانات كاملًا بصيغة JSON المتّسقة. */
function rewrite(file, exportName, value, note) {
  const full = path.join(ROOT, file);
  const text = fs.readFileSync(full, "utf8");
  const start = text.indexOf(`export const ${exportName} = `);
  const end = text.indexOf("\n];", start);
  if (start < 0 || end < 0) throw new Error(`تعذّر تحديد ${exportName} في ${file}`);
  const json = JSON.stringify(value, null, 2).replace(/^/gm, "  ");
  const out = text.slice(0, start) + `export const ${exportName} = ${json};` + text.slice(end + 3);
  fs.writeFileSync(full, note ? out.replace(/\n\/\*\*|\n\/\/ ──/, `\n// ── ${note} ──\n$&`) : out);
}

/** المفاتيح التي تُقارَن بها عناصر مجموعة (دالّة تستخرج نصًّا تمثيليًا). */
const byField = (field) => (item) => norm(item?.[field]);

/* ------------------------------ الخطة ------------------------------ */

function main() {
  const nour = evaluateDeclarations(NOUR, ["dailyVerses", "dailyHadiths", "radioStations", "hadithData", "hijriEvents", "duaData", "dailyWisdom"]);

  /** @type {{label:string, file:string, exportName:string, items:any[], key:(i:any)=>string, convert:(i:any)=>any}[]} */
  const plan = [];

  /* --- الآيات اليومية: يحوّل {text,ref} إلى {ayah,ref} بصيغة المشروع --- */
  const verses = loadExports("src/data/daily.js", ["DAILY_VERSES"]).DAILY_VERSES;
  const verseSeen = new Set(verses.map(byField("ayah")));
  plan.push({
    label: "DAILY_VERSES",
    file: "src/data/daily.js",
    exportName: "DAILY_VERSES",
    existing: verses,
    key: byField("ayah"),
    items: nour.dailyVerses
      .filter((item) => {
        const text = String(item.text ?? "").replace(/^["']|["']$/g, "");
        const key = norm(text);
        if (!key || verseSeen.has(key)) return false;
        verseSeen.add(key);
        return true;
      })
      .map((item) => ({
        ayah: `﴿ ${String(item.text ?? "").replace(/^["']|["']$/g, "")} ﴾`,
        ref: String(item.ref ?? "").replace(/[[\]]/g, "").replace(/\s*:\s*/, " ").trim(),
      })),
    convert: (item) => item,
  });

  /* --- الأحاديث اليومية: يحوّل {text,ref} إلى {text,src} بصيغة المشروع --- */
  const hadiths = loadExports("src/data/daily.js", ["DAILY_HADITHS"]).DAILY_HADITHS;
  const hadithSeen = new Set(hadiths.map(byField("text")));
  plan.push({
    label: "DAILY_HADITHS",
    file: "src/data/daily.js",
    exportName: "DAILY_HADITHS",
    existing: hadiths,
    key: byField("text"),
    items: nour.dailyHadiths
      .filter((item) => {
        const key = norm(item.text);
        if (!key || hadithSeen.has(key)) return false;
        hadithSeen.add(key);
        return true;
      })
      .map((item) => ({
        text: item.text,
        src: String(item.ref ?? "").replace(/[[\]]/g, "").trim(),
      })),
    convert: (item) => item,
  });

  /* --- أسماء الله من 7a7dd5 (شكل {n,m}) --- */
  if (fs.existsSync(V1)) {
    const v1 = evaluateDeclarations(V1, ["NAMES"]);
    const names = loadExports("src/data/names99.js", ["NAMES99"]).NAMES99;
    const nameSeen = new Set(names.map((item) => norm(item.n)));
    const extra = (v1.NAMES ?? []).filter((item) => {
      const key = norm(item.n ?? item.name);
      if (!key || nameSeen.has(key)) return false;
      nameSeen.add(key);
      return true;
    });
    plan.push({
      label: "NAMES99",
      file: "src/data/names99.js",
      exportName: "NAMES99",
      existing: names,
      key: byField("n"),
      items: extra.map((item) => ({ n: item.n ?? item.name, m: item.m ?? item.meaning })),
      convert: (item) => item,
    });
  }

  /* ------------------------- التقرير ------------------------- */

  let total = 0;
  console.log("=== ما هو ناقص في المشروع من ملفات المصدر ===");
  for (const step of plan) {
    const before = step.existing.length;
    total += step.items.length;
    console.log(
      `  ${step.label.padEnd(16)} +${String(step.items.length).padEnd(4)} ${before} → ${before + step.items.length}`,
    );
    for (const item of step.items) {
      const value = step.convert(item);
      console.log(`      + ${JSON.stringify(value).slice(0, 96)}`);
    }
  }

  /* --- مجموعات موجودة بالفعل: نتحقق فقط ولا نضيف --- */
  const checks = [
    ["radioStations", "RADIO_STATIONS", "src/data/radio.js", (x) => norm(x.name ?? x.title)],
    ["hadithData", "HADITHS", "src/data/hadiths.js", (x) => norm(x.title)],
    ["hijriEvents", "HIJRI_EVENTS", "src/data/hijri-events.js", (x) => norm(x.title)],
    ["duaData", "APP_DUAS", "src/data/app-duas.js", (x) => norm(x.title)],
  ];
  console.log("\n=== مجموعات مُكتملة أصلًا (تحقّق فقط) ===");
  for (const [srcName, exportName, file, key] of checks) {
    const list = loadExports(file, [exportName])[exportName];
    const have = new Set(list.map(key));
    const lost = nour[srcName].filter((item) => !have.has(key(item)));
    console.log(
      `  ${exportName.padEnd(16)} ${list.length} عنصر | ${lost.length === 0 ? "✔ مكتمل" : `✘ ناقص ${lost.length}`}`,
    );
    if (lost.length) total += lost.length;
  }

  if (!WRITE) {
    console.log(`\n(معاينة — أضف --write لتطبيق ${total} عنصرًا)`);
    return;
  }

  for (const step of plan) {
    if (!step.items.length) continue;
    rewrite(step.file, step.exportName, [...step.existing, ...step.items.map(step.convert)]);
    console.log(`\n✔ ${step.label}: أُضيف ${step.items.length} عنصرًا`);
  }
  if (!total) console.log("\n✔ لا شيء ناقص.");
}

if (require.main === module) main();

module.exports = { norm, loadExports };