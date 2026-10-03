"use strict";

/**
 * يبني `content/siraj/` من نصّ الكتاب المجلوب.
 *
 * المدخل نصّ «السراج في بيان غريب القرآن» في `sources/siraj/raw.json`،
 * لكل صفحة فقراتها: رقم الآية والكلمة الغريبة ومعناها. وهنا تُجمَع
 * الفقرات في ملف لكل سورة، ويُبنى فهرس الكلمات في دلاء على أول حرف،
 * فتقرأ الصفحة دلو الحرف الأول من كلمة البحث لا الكتاب كلّه.
 *
 * التطبيع اسم واحد: `normalizeAr` في `src/lib/text.js`، يستورده هذا البناء
 * من هناك لا من نسخةٍ ثانية، وإلا اختلف طرفا البحث.
 *
 *   node scripts/build-siraj-content.cjs
 */

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "sources", "siraj", "raw.json");
const OUT = path.join(ROOT, "content", "siraj");

/** حدّ حجم ملف في المكتبة: `tests/library.test.js` يرفض ما فوقه. */
const MAX_BYTES = 650 * 1024;

const AR_DIGITS = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9 };

/** @param {string} text @returns {number|null} */
function arNumber(text) {
  let out = "";
  for (const ch of String(text || "")) {
    if (AR_DIGITS[ch] === undefined) return null;
    out += AR_DIGITS[ch];
  }
  return out ? Number(out) : null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** @param {string} file @param {any} value */
function writeJson(file, value) {
  const text = JSON.stringify(value);
  const bytes = Buffer.byteLength(text);
  if (bytes > MAX_BYTES) {
    throw new Error(`${path.relative(ROOT, file)} حجمه ${bytes} بايت، فوق الحدّ ${MAX_BYTES}`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return bytes;
}

async function main() {
  const { normalizeAr } = await import(
    pathToFileURL(path.join(ROOT, "src", "lib", "text.js")).href
  );
  const raw = readJson(SOURCE);
  const surahList = readJson(path.join(ROOT, "content", "surahs.json"));
  const canon = new Map(surahList.map((row) => [row.no, row]));

  /* الفصول: «مقدمة» ثم سورة لكل رقم، ثم الخاتمة. */
  const chapters = raw.chapters;
  const frontIndex = chapters.findIndex((row) => /مقدمة/.test(row.title));
  const endIndex = chapters.findIndex((row) => /خاتمة/.test(row.title));
  const surahChapters = chapters
    .map((row, at) => ({ ...row, at, to: chapters[at + 1] ? chapters[at + 1].page : raw.lastPage + 1 }))
    .slice(frontIndex + 1, endIndex === -1 ? chapters.length : endIndex)
    .map((row) => {
      const match = /^([\d٠-٩]+)\s*-\s*سورة\s+(.+)$/.exec(row.title);
      if (!match) throw new Error(`فصل بلا رقم سورة: ${row.title}`);
      return { ...row, no: arNumber(match[1]), bookName: match[2].trim() };
    });
  if (surahChapters.length !== 114) throw new Error(`فصول السور ${surahChapters.length} لا ١١٤`);

  const pages = new Map(raw.pages.map((row) => [row.page, row.rows]));
  const rowsIn = (from, to) => {
    const out = [];
    for (let page = from; page < to; page += 1) out.push(...(pages.get(page) || []));
    return out;
  };

  /* مدخل يذكره الكتاب لفظًا ولا يشرحه: نضع له عَلَم `b` بدل أن نحشو
     معنًى من عندنا، والصفحة تقول ذلك في موضعه. */
const entry = (row) => {
  const meaning = row.t.replace(/^\*\s*/, "").trim();
  return meaning.replace(/[.\s،؛…]+/g, "")
    ? { a: row.a, w: row.w, m: meaning }
    : { a: row.a, w: row.w, m: "", b: 1 };
};

const intro = frontIndex === -1 ? [] : rowsIn(chapters[frontIndex].page, surahChapters[0].page);
  const closing = endIndex === -1 ? [] : rowsIn(chapters[endIndex].page, raw.lastPage + 1);

  /** سورٌ مبنيّة في الذاكرة تُكتب بعد أن تكتمل فهارسُ مواضع الكلمات. */
  const built = [];

  /**
   * مفاتيح البحث للفظ: العبارة كما هي، ثم كل كلمة فيها، فالبحث عن
   * «صراط» يجد «الصِّرَاطَ الْمُسْتَقِيمَ» و«صراط» مبسوطةً لا يفصلهما.
   * @param {string} word
   * @returns {string[]}
   */
  const keysOf = (word) =>
    [normalizeAr(word), ...String(word).split(/\s+/).map((part) => normalizeAr(part))].filter(Boolean);

  /**
   * مواضع اللفظ نفسه خارج مدخله: موضعٌ لكل مفتاح، بلا تكرار، ولا موضعه هو.
   * @param {string[]} keys
   * @param {number} surah
   * @param {number} at
   * @returns {[number, number][]}
   */
  const elsewhere = (keys, surah, at) => {
    const seen = new Set();
    const out = [];
    for (const key of keys) {
      for (const [no, seat] of terms.get(key) || []) {
        if (no === surah && seat === at) continue;
        const id = `${no}:${seat}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push([no, seat]);
      }
    }
    return out;
  };

  /* @type {Map<string, number[][]>} */
  const terms = new Map();
  let total = 0;
  const surahs = surahChapters.map((chapter) => {
    const reference = canon.get(chapter.no);
    if (!reference) throw new Error(`السورة ${chapter.no} ليست في فهرس المصحف`);
    const rows = rowsIn(chapter.page, chapter.to);
    const header = rows.find((row) => !row.w && /ترتيبها/.test(row.t));
    if (!header) throw new Error(`السورة ${chapter.no} بلا سطر ترتيب`);

    /* «آياتها» غائبة عن سورٍ قصيرة سقطت من سطرها، فالمصحف هو المرجع. */
    const said = arNumber((/آياتها\s*([\d٠-٩]+)/.exec(header.t) || [])[1]);
    if (said !== null && said !== reference.verses) {
      throw new Error(`السورة ${chapter.no}: الكتاب يقول ${said} آية والمصحف ${reference.verses}`);
    }
    const ayahs = reference.verses;
    const place = /مكية|مدنية/.exec(header.t);

    const entries = rows
      .filter((row) => row.w)
      .map(entry)
      .map((row, at) => {
        if (row.a !== null && (row.a < 1 || row.a > ayahs)) {
          throw new Error(`السورة ${chapter.no} مدخل ${at} رقم آيته ${row.a}`);
        }
        for (const key of keysOf(row.w)) {
          if (!terms.has(key)) terms.set(key, []);
          const positions = terms.get(key);
          const last = positions[positions.length - 1];
          if (!last || last[0] !== chapter.no || last[1] !== at) positions.push([chapter.no, at]);
        }
        return row;
      });

    total += entries.length;
    built.push({
      no: chapter.no,
      name: reference.name,
      verses: reference.verses,
      place: place ? place[0] : "",
      entries,
    });
    return { no: chapter.no, name: reference.name, verses: reference.verses, place: place ? place[0] : "", count: entries.length };
  });

  /* مواضع اللفظ نفسه في بقية السور: تُكتب في ملف سورته، فلا يحتاج القارئ
     إلى فهرس الكلمات ليرى «فَوَيْلٌ» في سورٍ أخرى غير التي يقرأها. */
  for (const sura of built) {
    const file = `sura-${String(sura.no).padStart(3, "0")}.json`;
    writeJson(path.join(OUT, file), {
      no: sura.no,
      name: sura.name,
      verses: sura.verses,
      place: sura.place,
      count: sura.entries.length,
      entries: sura.entries.map((row, at) => ({
        ...row,
        o: elsewhere(keysOf(row.w), sura.no, at),
      })),
    });
  }

  /* فهرس الكلمات في دلاء على أول حرف: بحث «غُلْف» يقرأ دلو «غ» وحده. */
  const letters = new Map();
  for (const [key, positions] of terms) {
    const letter = key.slice(0, 1);
    if (!letters.has(letter)) letters.set(letter, {});
    letters.get(letter)[key] = positions;
  }
  let termFiles = 0;
  for (const [letter, bucket] of [...letters].sort((a, b) => a[0].localeCompare(b[0], "ar"))) {
    writeJson(path.join(OUT, "terms", `${letter}.json`), bucket);
    termFiles += 1;
  }

  writeJson(path.join(OUT, "muqaddima.json"), { title: "مقدمة الكتاب", paras: intro.map((row) => row.t).filter(Boolean) });
  writeJson(path.join(OUT, "khatima.json"), { title: "خاتمة الكتاب", paras: closing.map((row) => row.t).filter(Boolean) });
  writeJson(path.join(OUT, "index.json"), {
    source: raw.source,
    count: total,
    terms: terms.size,
    surahs,
  });

  console.log(
    `بُني ${surahs.length} سورة و${total} مدخلًا، وفهرس ${terms.size} كلمة في ${termFiles} دلوًا`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});