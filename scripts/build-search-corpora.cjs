"use strict";

/**
 * يبني مدوّدة البحث تحت `content/corpora/` من نصوص القرآن والأذكار والتفسير
 * وغريب القرآن الموجودة في المشروع سلفًا.
 *
 * لماذا مدوّدة مستقلة، لا البحث في ملفات المحتوى نفسها:
 *   - البحث في `content/hisn/bab-*.json` يعني ١٣٢ طلبًا، وفي
 *     `content/tafsir/sura-*.json` يعني ١١٤ طلبًا، وطلبٌ كثيرُه صامتٌ بطيء.
 *   - ملفات المدوّدة أربعة فقط، يُحمَّل منها ما يحتاجه الاستعلامُ وحده ويُحفظ
 *     في الذاكرة، ويبقى أولُ بحث بعده فوريًّا.
 *   - وهي نصٌّ مطبَّع مبسّط: الحركات محذوفة والهمزات موحَّدة، لأن المطابقة
 *     تجري بعد التطبيع على الطرفين، فلا حاجة لتخزين النصّ المشكول مرّتين.
 *
 * لا يُكتب نصٌّ دينيّ هنا: كل حرف يخرج من ملفٍّ موثّق داخل المشروع، ولا يُنسب
 * إلى موضعه إلا بمرجعه (رقم السورة والآية أو رقم الباب).
 *
 * التشغيل:  npm run build:corpora
 * الفحص:    --check  لا يكتب، ويقارن الناتج بما في القرص.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "content", "corpora");

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";

/**
 * ينقّي نصًّا عثمانيًّا للعرض، ولا يُطبّعه.
 *
 * التطبيعُ يتمّ مرّةً واحدة عند التحميل في المتصفّح، أمّا هنا فنُبقي النصّ
 * كما يُقرأ: التشكيل جزءٌ من جمال الآية، وحذفُه هنا يجعل نتيجة البحث نصًّا
 * عاديًّا بلا معنى ذوقيّ.
 *
 * ويُحوَّل الألفُ الخنجرية (U+0670) إلى ألفٍ عادية، لأنها حاملُ حركةٍ لا
 * حرفٌ في «ٱلْعَٰلَمِينَ»، فحذفُها يحوّل «العالمين» إلى «العلمين» فتضيع
 * مطابقةُ البحث عن الآية بلفظها.
 * @param {string} value
 * @returns {string}
 */
function display(value) {
  return String(value ?? "")
    .replace(/﻿/g, "")
    .replace(/۝.*$/, "")
    .replace(/\[\d+\]/g, " ")
    .replace(/[ٰٱٲٳ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

/** @returns {any} */
function json(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

/** @param {string} name @returns {any[]} */
function jsonFiles(dir, prefix) {
  return fs
    .readdirSync(path.join(ROOT, dir))
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .sort()
    .map((name) => json(path.join(dir, name)));
}

/** @param {number} value @returns {string} */
function arNum(value) {
  return String(value).replace(/\d/g, (digit) => ARABIC_INDIC[Number(digit)]);
}

/* ------------------------------------------------------------ 1) المصحف */

/**
 * آيات المصحف كاملة، ومع كل آية اسمُ سورتها وجزؤها وصفحتُها وحزبُها، فالبحث
 * عن آية يجدها برقمها، والضغط عليها يفتح موضعها في المصحف.
 */
function buildQuran() {
  const mushaf = json("vendor/quran-arabic.json");
  const names = new Map(json("content/surahs.json").map((s) => [s.no, s.name]));
  const juzStart = new Map();
  const ayat = [];

  for (const surah of mushaf.surahs) {
    const name = display(names.get(surah.number) || surah.name);
    for (const ayah of surah.ayahs) {
      if (!juzStart.has(ayah.juz)) juzStart.set(ayah.juz, `${name}:${ayah.n}`);
      ayat.push([
        surah.number,
        ayah.n,
        ayah.juz || 0,
        ayah.page || 0,
        ayah.hizb || 0,
        name,
        display(ayah.text),
      ]);
    }
  }

  return {
    rows: ayat,
    meta: {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "المصحف الشريف — النص العثماني (vendor/quran-arabic.json)",
    count: ayat.length,
    // أسبقية الوضع: `normal text` من دون فواصل، ليبقى الملف أصغر ما يمكن.
    fields: ["surah", "ayah", "juz", "page", "hizb", "surahName", "text"],
    juzStart: [...juzStart.entries()].map(([juz, at]) => [juz, at]),
    surahs: mushaf.surahs.map((s) => [
      s.number,
      display(names.get(s.number) || s.name),
      s.ayahCount,
    ]),
    },
  };
}

/* ------------------------------------------------- 2) حصن المسلم وغريب القرآن */

/** أبواب حصن المسلم بنصوصها، كل ذكرٍّ مربوطًا برقم بابه ليُفتح من رابطه. */
function buildHisn() {
  const index = json("content/hisn/index.json");
  const babs = jsonFiles("content/hisn", "bab-");
  const items = [];
  const rows = [];

  for (const bab of babs) {
    const title = display(bab.title);
    rows.push([bab.no, title, (bab.items || []).length]);
    for (const item of bab.items || []) {
      const text = display(`${item.t || ""} ${item.e || ""}`);
      if (!text) continue;
      items.push([bab.no, text]);
    }
  }

  return {
    rows: items,
    meta: {
      generatedAt: new Date().toISOString().slice(0, 10),
      source: "حصن المسلم — من المكتبة الشاملة (content/hisn)",
      fields: ["bab", "text"],
      babCount: index.count || babs.length,
      babs: rows,
    },
  };
}

/**
 * معاني غريب ألفاظ القرآن: اللفظُ ومعناه ومكانُ وروده. يُبنى من مدوّدة السراج
 * نفسها، فيصير البحث في معاني الكلمات سؤالًا حقيقيًّا لا بحثًا في قائمة.
 */
function buildSiraj() {
  const index = json("content/siraj/index.json");
  const surahs = jsonFiles("content/siraj", "sura-");
  const words = [];
  const rows = [];

  for (const surah of surahs) {
    const name = display(surah.name);
    rows.push([surah.no, name, (surah.entries || []).length]);
    for (const entry of surah.entries || []) {
      const word = display(entry.w || "");
      const meaning = display(entry.m || "");
      if (!word) continue;
      words.push([surah.no, entry.a || 0, word, meaning]);
    }
  }

  return {
    rows: words,
    meta: {
      generatedAt: new Date().toISOString().slice(0, 10),
      source: `السراج في بيان غريب القرآن — ${index.source?.author || ""}`.trim(),
      fields: ["surah", "ayah", "word", "meaning"],
      termCount: index.terms || words.length,
      surahs: rows,
    },
  };
}

/* --------------------------------------------------------------- 3) التفسير */

/** تفسير الميسر آيةً آية، موصولًا برقم السورة والآية. */
function buildTafsir() {
  const index = json("content/tafsir/index.json");
  const surahs = jsonFiles("content/tafsir", "sura-");
  const ayat = [];
  const rows = [];

  for (const surah of surahs) {
    const name = display(surah.name);
    rows.push([surah.no, name, (surah.ayat || []).length]);
    for (const ayah of surah.ayat || []) {
      const text = display(ayah.f || "");
      if (!text) continue;
      ayat.push([surah.no, ayah.n, name, text]);
    }
  }

  return {
    rows: ayat,
    meta: {
      generatedAt: new Date().toISOString().slice(0, 10),
      source: `التفسير الميسر${index.source ? ` — ${index.source}` : ""}`.trim(),
      fields: ["surah", "ayah", "surahName", "text"],
      count: ayat.length,
      surahs: rows,
    },
  };
}

/* ------------------------------------------------------------------ البناء */

/**
 * المدوّدة كلُّها ملفٌ واحد كبير، وقاعدة المشروع أن لا يمرّ شيءٌ من `content/`
 * بحدٍّ التحميل (٦٥٠ كيلوبايت) فيتعلّق أوّله على شبكةٍ بطيئة. فتنقسم المدوّدة
 * إلى أجزاء، ويُحمَّل ما يلزم منها عند الطلب.
 */
const SHARD_BYTES = 500 * 1024;

/** المدوّداتُ الأربع ومصدرُ كلٍّ منها داخل المشروع. */
const CORPORA = {
  quran: buildQuran,
  hisn: buildHisn,
  siraj: buildSiraj,
  tafsir: buildTafsir,
};

/**
 * مصادرُ المدوّدة تُنزَّل بخطواتها (`npm run download:quran` و`build:siraj`)،
 * فغيابُها في نسخةٍ جديدة لا يُعطّل البناء: يُبنى ما توفّر، ويُنبَّه على الساقط.
 */
const REQUIRED = [
  "vendor/quran-arabic.json",
  "content/surahs.json",
  "content/hisn/index.json",
  "content/siraj/index.json",
  "content/tafsir/index.json",
];
const absent = REQUIRED.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));

/**
 * يقسم مدوّدة إلى أجزاء كلٌّ منها دون الحدّ، ويكتب بيانَها.
 * @param {string} dir مجلّد المدوّدة
 * @param {string} name اسمها
 * @param {any} data
 * @returns {{dir: string, files: string[], rows: number, meta: object}}
 */
function writeSharded(name, data) {
  const shards = [];
  let current = [];
  let currentBytes = 0;
  for (const row of data.rows) {
    const bytes = Buffer.byteLength(JSON.stringify(row));
    if (current.length && currentBytes + bytes > SHARD_BYTES) {
      shards.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(row);
    currentBytes += bytes;
  }
  if (current.length) shards.push(current);

  const outDir = path.join(OUT, name);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const files = shards.map((rows, index) => {
    const file = `${String(index).padStart(3, "0")}.json`;
    fs.writeFileSync(path.join(outDir, file), JSON.stringify(rows));
    return file;
  });

  const meta = { ...data.meta, files, rows: data.rows.length };
  // بلا سطرٍ أخير: الفحص يقارن النصّ حرفيًّا، والفرقُ فيه صعبُ 눈에.
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(meta));
  return { dir: name, files, rows: data.rows.length, meta };
}

/**
 * نفس التقسيم بلا كتابة، للفحص.
 * @param {{rows: any[], meta: object}} data
 * @returns {{files: string[], parts: Record<string, any[]>, meta: object}}
 */
function writeToMemory(data) {
  const shards = [];
  let current = [];
  let currentBytes = 0;
  for (const row of data.rows) {
    const bytes = Buffer.byteLength(JSON.stringify(row));
    if (current.length && currentBytes + bytes > SHARD_BYTES) {
      shards.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(row);
    currentBytes += bytes;
  }
  if (current.length) shards.push(current);
  const files = shards.map((rows, index) => `${String(index).padStart(3, "0")}.json`);
  const parts = {};
  shards.forEach((rows, i) => { parts[files[i]] = rows; });
  return { files, parts, meta: { ...data.meta, files, rows: data.rows.length } };
}

/**
 * يُسقط تاريخ البناء من نصٍّ للمقارنة.
 *
 * `generatedAt` تاريخُ يوم البناء: يتغيّر كلَّ صباحٍ ولو لم يتغيّر المصدرُ
 * بحرف، فالمقارنةُ الحرفية تُسقط `check:corpora` في الغد — وهو الفحصُ الذي
 * يكشف قوّةَ المصدر — وتُخفي عن صاحبه أنّ البناء بخير. وحقلُه وحيدٌ في
 * المدوّدة، فإسقاطُه لا يُخفي تغيّرًا في البيانات.
 * @param {string|null} text
 * @returns {string}
 */
const withoutBuildDate = (text) =>
  String(text ?? "").replace(/"generatedAt":\s*"\d{4}-\d{2}-\d{2}"/g, '"generatedAt": "<built>"');

const check = process.argv.includes("--check");
const problems = [];
const index = { generatedAt: new Date().toISOString().slice(0, 10), builder: "scripts/build-search-corpora.cjs", corpora: {} };

for (const [name, build] of Object.entries(CORPORA)) {
  if (absent.length) {
    process.stderr.write(`تعذّر بناء ${name}: ينقص ${absent.join("، ")}\n`);
    continue;
  }
  const built = build();
  const outDir = path.join(OUT, name);
  const metaPath = path.join(outDir, "index.json");

  if (check) {
    // الفحص يقارن ما على القرص بالناتج كاملًا: البيان والأجزاء معًا، وإلّا
    // بقيت مدوّدةٌ ناقصة أو زائدة و«--check» يمرّ.
    const dry = writeToMemory(built);
    // البيانُ جزءٌ من المدوّدة، فمقارنتُه جزءٌ من الفحص لا زيادةٌ عليه.
    const expectedFiles = [...dry.files, "index.json"];
    const currentMeta = fs.existsSync(metaPath) ? fs.readFileSync(metaPath, "utf8") : null;
    if (withoutBuildDate(currentMeta) !== withoutBuildDate(JSON.stringify(dry.meta))) {
      problems.push(`${name}/index.json مختلف عن مصدره`);
      continue;
    }
    for (const file of dry.files) {
      const target = path.join(outDir, file);
      const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
      if (current !== JSON.stringify(dry.parts[file])) problems.push(`${name}/${file} مختلف عن مصدره`);
    }
    const stray = fs.existsSync(outDir)
      ? fs.readdirSync(outDir).filter((f) => !expectedFiles.includes(f))
      : [];
    if (stray.length) problems.push(`${name}: ملفات زيادة ${stray.join("، ")}`);
    index.corpora[name] = { dir: name, files: dry.files.length, rows: dry.meta.rows };
    continue;
  }

  fs.mkdirSync(OUT, { recursive: true });
  const written = writeSharded(name, built);
  index.corpora[name] = { dir: written.dir, files: written.files.length, rows: written.rows };
  const size = (Buffer.byteLength(JSON.stringify(written.meta)) / 1024).toFixed(0);
  process.stdout.write(`كتب ${name}/ — ${written.files.length} جزءًا، ${written.rows} صفًّا (بيان ${size} ك.ب)\n`);
}

const manifestText = `${JSON.stringify(index, null, 2)}\n`;
const manifestPath = path.join(OUT, "manifest.json");
const currentManifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, "utf8") : null;
if (withoutBuildDate(currentManifest) !== withoutBuildDate(manifestText)) {
  if (check) problems.push("manifest.json مختلف عن مصدره");
  else {
    fs.writeFileSync(manifestPath, manifestText);
    process.stdout.write("كتب manifest.json\n");
  }
}

if (problems.length) {
  for (const problem of problems) process.stderr.write(`خلل: ${problem}\n`);
  process.stderr.write("شغّل: npm run build:corpora\n");
  process.exit(1);
}
process.stdout.write(check ? "مدوّدة البحث مطابقة لمصدرها\n" : "بُنيت مدوّدة البحث\n");
