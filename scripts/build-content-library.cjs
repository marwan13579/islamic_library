"use strict";

/**
 * يبني مكتبة المحتوى المقسّمة داخل `content/` من مصدر altaqwaa المثبّت.
 *
 * مصدر المحتوى هو حزمة snap الخاصة بـ Altaqwaa (رخصة GPL-3.0)، تُقرأ من
 * قرصها مباشرةً ولا تُنسخ كما هي: يقتطع هذا السكربت الحقول التي لا تحتاجها
 * الواجهة، ثم يقسّم الباقي إلى ملفات صغيرة تُحمَّل عند الطلب.
 *
 * لماذا التقسيم: المحتوى الكامل ٢١٢ ميغابايت في四处 مجموعات، وهو أكبر من أن
 * يُحمَّل في صفحة واحدة. الفهرس المجمّع (٢٩٢ م.ب) مستحيل تمامًا. لذلك:
 *   - ملخصات (بلا محتوى) للتصفّح والقوائم
 *   - محتوى كامل في أجزاء بحجم ~٦٠٠ كيلوبايت
 *   - فهرس بحث مبسّط bucketed بالحرف الأول من المصطلح
 *
 * التشغيل:
 *   node scripts/build-content-library.cjs
 *   ALTAQWAA_RESOURCES=/path/to/resources node scripts/build-content-library.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "content");

/** مصدر المحتوى: موارد Altaqwaa المثبّتة. */
const RESOURCES =
  process.env.ALTAQWAA_RESOURCES ||
  "/snap/altaqwaa/current/app/resources";

/** حجم الجزء الواحد المستهدف بالبايت. */
const SHARD_BYTES = 600 * 1024;

/** عدد الملخصات في ملف القوائم. */
const LIST_PER_SHARD = 500;
/** ملخّصات التصنيف في الملف الواحد. أصغر من القوائم: كل تصنيف يُقرأ وحده. */
const CAT_PER_SHARD = 120;

/** المجموعات التي تُبنى قوائمها من `items_<type>.json`. */
const COLLECTIONS = ["fatwa", "khutbahs", "history", "quiz"];

/** الحقول التي لا تستخدمها أي واجهة، فتُحذف لتخفيف الأجزاء. */
const DROP_KEYS = new Set([
  "tags",
  "keywords",
  "hash",
  "dataset",
  "sourceId",
  "slug",
  "breadcrumbs",
  "relatedIds",
  "popularity",
  "createdAt",
]);

/* ---------------------------------------------------------------- تطبيع عربي */

const DIACRITICS = /[ً-ْٰ]/g;
const ALEF_VARIANTS = /[آأإ]/g;

function normalizeArabic(text) {
  return String(text == null ? "" : text)
    .replace(DIACRITICS, "")
    .replace(/ـ/g, "")
    .replace(ALEF_VARIANTS, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** مقاطع الحروف العربية: ء إلى ٱ ثم الحروف الممدودة. */
const ARABIC_RUN = /[ء-يٱ-ە]+/g;

/** أقصر مصطلح مفيد وأطول مصطلح مقبول — يوافقهما `tokenize` في المتصفح. */
const MIN_TOKEN = 2;
const MAX_TOKEN = 24;

/**
 * يقطع النص إلى مصطلحات عربية صالحة للفهرسة.
 *
 * لا يُكتفي بالتقسيم على المسافات: نصوص الخطب فيها علامات ترقيم ملتصقة
 * بالكلمات (`ب"ابو`، `ب(ال):`)، فتقسيمها بالمسافات وحدها ينتج مصطلحات
 * لا يطابقها أحد ويضخّم الفهرس بلا فائدة.
 *
 * والمصطلح الأقصر من حرفين يُهمَل: حرف واحد يطابق كل النصوص المجموعة.
 * @param {string[]} parts
 * @returns {string[]}
 */
function tokensOf(parts) {
  const out = [];
  for (const part of parts) {
    for (const tok of normalizeArabic(part).match(ARABIC_RUN) || []) {
      if (tok.length >= MIN_TOKEN && tok.length <= MAX_TOKEN) out.push(tok);
    }
  }
  return out;
}

/* ------------------------------------------------------------------- أدوات */

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  return fs.statSync(file).size;
}

function pad(n) {
  return String(n).padStart(3, "0");
}

/**
 * يفرض https على رابط، أو يتركه فارغًا إن لم يكن رابطًا.
 * @param {unknown} url
 * @returns {string}
 */
function secure(url) {
  const text = String(url || "");
  if (!text) return "";
  return text.replace(/^http:\/\//i, "https://");
}

/**
 * تجزئة نصية بسيطة لتوزيع المعرّفات على الدلاء.
 * @param {string} text
 * @returns {number} عدد صحيح غير سالب
 */
function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/**
 * اسم ملف آمن من اسم فئة عربي.
 * @param {string} text
 * @returns {string}
 */
function slug(text) {
  return (
    String(text)
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "cat"
  );
}

function log(message) {
  console.log(message);
}

/**
 * يجمع عناصر في أجزاء بحجم مستهدف، ويريد الأجزاء بالترتيب الأصلي مع
 * فهرس يربط كل معرّف برقم جزئه وموضعه داخله.
 * @param {any[]} items
 * @param {string} dir
 * @param {string} prefix
 * @param {number} targetBytes
 * @returns {{ files: string[], locator: Record<string, [number, number]> }}
 */
function shardBySize(items, dir, prefix, targetBytes = SHARD_BYTES) {
  fs.rmSync(dir, { recursive: true, force: true });
  const files = [];
  const locator = {};
  let bucket = [];
  let size = 2;

  const flush = () => {
    if (!bucket.length) return;
    const name = `${prefix}-${pad(files.length)}.json`;
    writeJson(path.join(dir, name), bucket);
    files.push(name);
    bucket = [];
    size = 2;
  };

  for (const item of items) {
    const cost = Buffer.byteLength(JSON.stringify(item)) + 1;
    if (bucket.length && size + cost > targetBytes) flush();
    if (item && item.id) locator[item.id] = [files.length, bucket.length];
    bucket.push(item);
    size += cost;
  }
  flush();
  return { files, locator };
}

/* ------------------------------------------------------- تنظيف عناصر المكتبة */

/**
 * يردّ العنصر بعد حذف الحقول الثقيلة غير المستخدمة.
 * @param {Record<string, any>} item
 */
function slimItem(item) {
  const out = {};
  for (const [key, value] of Object.entries(item)) {
    if (DROP_KEYS.has(key)) continue;
    if (value === undefined) continue;
    if (Array.isArray(value) && !value.length) continue;
    if (value === "" && key !== "title" && key !== "content") continue;
    out[key] = value;
  }
  if (out.summary && out.content && out.summary === out.content) delete out.summary;
  return out;
}

/**
 * الملخّص الذي يكفي للقوائم والنتائج.
 * `p` هو موضع العنصر داخل أحد أجزاء المحتوى، فيفتحه القارئ بطلب جزء واحد.
 * @param {Record<string, any>} item
 * @param {[number, number] | undefined} where
 */
function summaryOf(item, where) {
  return {
    id: item.id,
    t: item.type,
    ti: item.title,
    su: item.summary || "",
    c: item.categories || [],
    a: item.author || "",
    d: item.dateText || item.dateIso || "",
    r: item.readingTime || 0,
    au: item.extra && item.extra.audio ? 1 : 0,
    p: where || [0, 0],
  };
}

/* --------------------------------------------------------------- المجموعات */

function buildCollection(type) {
  const source = path.join(RESOURCES, "library", `items_${type}.json`);
  const raw = readJson(source);
  const items = raw.map(slimItem);
  const dir = path.join(OUT, "library", type);

  /* المحتوى الكامل أولًا: ترتيب الأجزاء يحدّد مواضع العناصر. */
  const pageDir = path.join(dir, "items");
  const { files: itemFiles, locator } = shardBySize(items, pageDir, "part");

  /* القوائم: ملخّصات بلا محتوى، مرتّبة الأحدث أولًا. */
  const summaries = items
    .map((item) => summaryOf(item, locator[item.id]))
    .sort((a, b) => String(b.d).localeCompare(String(a.d)));

  const listDir = path.join(dir, "list");
  fs.rmSync(listDir, { recursive: true, force: true });
  const listFiles = [];
  for (let i = 0; i < summaries.length; i += LIST_PER_SHARD) {
    const name = `${pad(listFiles.length)}.json`;
    writeJson(path.join(listDir, name), summaries.slice(i, i + LIST_PER_SHARD));
    listFiles.push(name);
  }

  /* الفئات مرتّبة تنازليًا كما في Altaqwaa. */
  const counts = new Map();
  for (const item of items) {
    for (const c of item.categories || []) counts.set(c, (counts.get(c) || 0) + 1);
  }
  const categories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ar"));

  /* قائمة مستقلة لكل فئة.
   * تصفية القوائم كاملة تعني قراءة كل ملفاتها (١١ م.ب للفتاوى)، فلا
   * تُصفّى إلا ضمن ملف الفئة وحده فيبقى الطلب بضع مئات من الكيلوبايت.
   */
  const catDir = path.join(dir, "cat");
  fs.rmSync(catDir, { recursive: true, force: true });
  const catIndex = {};
  categories.forEach((category, catNo) => {
    const subset = summaries.filter((s) => s.c.includes(category.name));
    if (!subset.length) return;
    /* بعض التصنيفات تتجاوز الستّمئة كيلوبايت بكل ملخّصاتها، فتقسّم
       إلى ملفات: صفحة التصنيف تقرأ ما يكفي منها ثم تتوقف. */
    const sub = path.join(catDir, pad(catNo));
    const files = [];
    for (let i = 0; i < subset.length; i += CAT_PER_SHARD) {
      const name = `${pad(files.length)}.json`;
      writeJson(path.join(sub, name), subset.slice(i, i + CAT_PER_SHARD));
      files.push(name);
    }
    catIndex[category.name] = { dir: pad(catNo), files, count: subset.length, perShard: CAT_PER_SHARD };
  });

  /* دليل المعرّف: sixteen ملفًا موزّعة بالتجزئة، فالوصول برابط مباشر
   * لعنصر لا يحتاج مسح كل ملفات الفئات. */
  const idDir = path.join(dir, "byid");
  fs.rmSync(idDir, { recursive: true, force: true });
  const BUCKETS_ID = 16;
  /** @type {string[][]} */
  const byId = Array.from({ length: BUCKETS_ID }, () => []);
  for (const summary of summaries) {
    byId[hash(summary.id) % BUCKETS_ID].push([summary.id, summary.p]);
  }
  for (let i = 0; i < BUCKETS_ID; i += 1) {
    writeJson(path.join(idDir, `${pad(i)}.json`), Object.fromEntries(byId[i]));
  }

  const meta = {
    type,
    count: items.length,
    source: (items[0] && items[0].source) || null,
    listFiles,
    listPerShard: LIST_PER_SHARD,
    itemFiles,
    categories,
    catIndex,
    idBuckets: BUCKETS_ID,
  };
  writeJson(path.join(dir, "meta.json"), meta);
  log(
    `  ${type}: ${items.length} عنصر · ${listFiles.length} ملف قائمة · ${itemFiles.length} جزء`
  );
  return meta;
}

/* ------------------------------------------------------------------ التفسير */

function buildTafsir() {
  const rows = readJson(path.join(RESOURCES, "data", "tafseerMouaser.json"));
  const bySura = new Map();
  for (const row of rows) {
    const no = Number(row.sura_no) || 0;
    if (!bySura.has(no)) bySura.set(no, []);
    bySura.get(no).push({
      j: Number(row.jozz) || 0,
      p: Number(row.page) || 0,
      n: Number(row.aya_no) || 0,
      t: row.aya_text || "",
      f: row.aya_tafseer || "",
    });
  }
  const dir = path.join(OUT, "tafsir");
  fs.rmSync(dir, { recursive: true, force: true });
  const surahs = [];
  for (let no = 1; no <= 114; no += 1) {
    const ayat = (bySura.get(no) || []).sort((a, b) => a.n - b.n);
    const name = rows.find((r) => Number(r.sura_no) === no);
    const file = `sura-${pad(no)}.json`;
    writeJson(path.join(dir, file), {
      no,
      name: (name && String(name.sura_name_ar).trim()) || "",
      nameEn: (name && name.sura_name_en) || "",
      ayat,
    });
    surahs.push({ no, name: (name && String(name.sura_name_ar).trim()) || "", count: ayat.length });
  }
  writeJson(path.join(dir, "index.json"), {
    source: "التفسير الميسر",
    count: rows.length,
    surahs,
  });
  log(`  التفسير: ${rows.length} آية في ${surahs.length} سورة`);
  return { count: rows.length, surahs: surahs.length };
}

/* -------------------------------------------------------------- حصن المسلم */

function buildHisn() {
  const rows = readJson(path.join(RESOURCES, "data", "hisnmuslim.json"));
  const dir = path.join(OUT, "hisn");
  fs.rmSync(dir, { recursive: true, force: true });
  const index = [];
  rows.forEach((row, i) => {
    const id = pad(i + 1);
    const items = (row.array || []).map((entry) => ({
      t: entry.text || "",
      e: entry.explanation || "",
    }));
    writeJson(path.join(dir, `bab-${id}.json`), {
      no: i + 1,
      title: row.category || "",
      /* المصدر على http، والنشر على https: المتصفح يمنع المحتوى المختلط
         فتسقط الأصوات كلها. نرفعها هنا. */
      audio: secure(row.audio),
      filename: row.filename || "",
      items,
    });
    index.push({ no: i + 1, title: row.category || "", count: items.length, audio: Boolean(secure(row.audio)) });
  });
  writeJson(path.join(dir, "index.json"), { count: rows.length, bab: index });
  log(`  حصن المسلم: ${rows.length} بابًا`);
  return { count: rows.length };
}

/* --------------------------------------------------- القرّاء والإذاعات والأذكار */

function buildMisc() {
  const reciters = readJson(path.join(RESOURCES, "data", "mp3quran.json")).map((r) => ({
    id: Number(r.id),
    name: r.name || "",
    server: r.Server || "",
    riwaya: r.rewaya || "",
    letter: r.letter || "",
    surahs: String(r.suras || "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => n >= 1 && n <= 114),
  }));
  writeJson(path.join(OUT, "reciters.json"), { count: reciters.length, reciters });

  const radio = readJson(path.join(RESOURCES, "data", "radio.json"));
  writeJson(path.join(OUT, "radio.json"), radio);

  /* أذكار Altaqwaa تُسقط هنا: حصن المسلم (١٣٢ بابًا) يغطّي الصبح
     والمساء والنوم والطعام والبيت، وهو أوسع وأوثق. تكرارها يزيد
     الحجم دون أن يزيد المحتوى. */

  const surahs = readJson(path.join(RESOURCES, "data", "quran.json")).map((s) => ({
    no: s.Number,
    name: s.Name,
    nameEn: s.English_Name,
    verses: s.Number_Verses,
  }));
  writeJson(path.join(OUT, "surahs.json"), surahs);

  log(`  القرّاء: ${reciters.length} · الإذاعات: ${radio.length} · السور: ${surahs.length}`);
  return { reciters: reciters.length, radio: radio.length };
}

/* ----------------------------------------------------------- فهرس البحث */

/**
 * تقديم تحريري لكل نوع في الترتيب.
 *
 * بنك الاختبارات أسئلته قصيرة ومركّزة، فيربح في BM25 على الفتاوى
 * والخطب الأطول دائمًا. والمكتبة المرجعية تُقدّم النصّ المرجعي على
 * سؤال الاختبار، فنخفض درجته قليلًا مع بقائه في النتائج.
 */
const TYPE_PRIOR = {
  tafsir: 1.15,
  hisn: 1.1,
  fatwa: 1.05,
  khutbahs: 1,
  history: 1,
  quiz: 0.5,
};

/**
 * يبني فهرس BM25 مقسّمًا على الحرف الأول من المصطلح.
 *
 * يُبنى على العنوان والملخّص لا على النص الكامل: فهرس Altaqwaa الكامل
 * (٢٩٢ م.ب) يتضمّن نص كل مستند، ولا يُحمَّل في متصفح أبدًا.
 *
 * أوزان الحقول مدمجة في التكرار لا في معادلة الترتيب: العنوان ثلاث مرات
 * والملخّص مرتين، فيصير `tf` وزنًا جاهزًا. ومع كل تكرار يُحفظ طول
 * المستند لأن BM25 يحتاجه قبل أن تُقرأ بيانات المستند من شريحتها.
 */
function buildSearchIndex(collections) {
  const docs = [];
  const postings = new Map();
  const ranges = [];
  let lenSum = 0;

  /** يضيف مستندًا واحدًا بفهرسه وموقعه `[ملف, عنصر]`. */
  const push = (summary, weights) => {
    const index = docs.length;
    docs.push(summary);
    /* المستندات مرتّبة بالنوع: كل نوع في مدى متصل. فالتحديد بالنوع
       يفحص مدَى، لا كل مستند. */
    const last = ranges[ranges.length - 1];
    if (last && last.type === summary.t) last.to = index;
    else ranges.push({ type: summary.t, from: index, to: index });
    const terms = tokensOf(weights);
    const len = terms.length || 1;
    lenSum += len;
    const local = new Map();
    for (const term of terms) local.set(term, (local.get(term) || 0) + 1);
    for (const [term, tf] of local) {
      let entry = postings.get(term);
      if (!entry) postings.set(term, (entry = []));
      entry.push(index, tf, len);
    }
  };

  for (const type of collections) {
    const dir = path.join(OUT, "library", type, "items");
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.startsWith("part-")) continue;
      const items = readJson(path.join(dir, file));
      for (const item of items) {
        push(summaryOf(item), [
          item.title,
          item.title,
          item.title,
          item.summary,
          item.summary,
        ]);
      }
    }
  }

  /* التفسير وحصن المسلم يُفهرسان آيةً آية وبابًا بابًا، فكلٌّ منهما وحده
   * أوسع من أن يُجمَّع في ملف واحد: ٦٢٣٦ آية و١٣٢ بابًا. */
  const suraFiles = fs
    .readdirSync(path.join(OUT, "tafsir"))
    .filter((f) => f.startsWith("sura-"))
    .sort();
  for (let fi = 0; fi < suraFiles.length; fi += 1) {
    const sura = readJson(path.join(OUT, "tafsir", suraFiles[fi]));
    for (let ai = 0; ai < sura.ayat.length; ai += 1) {
      const aya = sura.ayat[ai];
      const label = `آية ${aya.n}`;
      const summary = String(aya.f || "")
        .replace(/\[[^\]]*\]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 150);
      push(
        {
          id: `tafsir-${sura.no}-${aya.n}`,
          t: "tafsir",
          ti: `${sura.name} · ${label}`,
          su: summary,
          c: ["التفسير الميسر"],
          a: "مجمع الملك فهد ل等服务 المصحفية",
          d: `سورة ${sura.no}`,
          r: 1,
          au: 0,
          p: [fi, ai],
          x: [sura.no, aya.n],
        },
        [sura.name, aya.n, aya.n, label, label, aya.f, aya.f]
      );
    }
  }

  const babFiles = fs
    .readdirSync(path.join(OUT, "hisn"))
    .filter((f) => f.startsWith("bab-"))
    .sort();
  for (let fi = 0; fi < babFiles.length; fi += 1) {
    const bab = readJson(path.join(OUT, "hisn", babFiles[fi]));
    const first = String((bab.items[0] && bab.items[0].t) || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 150);
    push(
      {
        id: `hisn-${bab.no}`,
        t: "hisn",
        ti: bab.title,
        su: first,
        c: ["حصن المسلم"],
        a: "مكتبة حصن المسلم",
        d: `باب ${bab.no}`,
        r: bab.items.length,
        au: bab.audio ? 1 : 0,
        p: [fi, 0],
        x: [bab.no],
      },
      [bab.title, bab.title, bab.title, first, first]
    );
  }

  const avgLen = docs.length ? lenSum / docs.length : 1;

  const dir = path.join(OUT, "search");
  fs.rmSync(dir, { recursive: true, force: true });

  const bucket = new Map();
  for (const [term, pairs] of postings) {
    const head = term[0] || "·";
    if (!bucket.has(head)) bucket.set(head, []);
    bucket.get(head).push([term, pairs]);
  }

  /**
   * يوزّع مصطلحات دلو على ملفات، فيقسّمه بالحرف الثاني إن تجاوز الحدّ.
   * تفصيل الحرف الأول وحده لا يكفي: دلو "ا" وحده يتراوح بين ٤ م.ب
   * وأكثر، فتقسيمه بالحرف الثاني يوزّعه على مئات الملفات الصغيرة.
   * @param {[string, number[]][]} entries
   */
  function partition(entries, depth) {
    const bytes = entries.reduce((sum, [term, p]) => sum + term.length * 2 + p.length * 7 + 40, 0);
    if (bytes <= SHARD_BYTES || depth > 3) return [entries];
    const sub = new Map();
    for (const entry of entries) {
      const key = entry[0][depth] || "·";
      if (!sub.has(key)) sub.set(key, []);
      sub.get(key).push(entry);
    }
    if (sub.size < 2) return [entries];
    return [...sub.values()].flatMap((group) => partition(group, depth + 1));
  }

  const groups = [];
  let totalTerms = 0;
  let groupIndex = 0;
  for (const [letter, entries] of bucket) {
    entries.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const parts = partition(entries, 1);
    const id = groupIndex;
    groupIndex += 1;
    const files = [];
    parts.forEach((part, i) => {
      if (!part.length) return;
      const terms = [];
      const lists = [];
      const grams = {};
      for (const [term, pairs] of part) {
        terms.push(term);
        lists.push(pairs);
        const g = term.length <= 3 ? [term] : [];
        for (let k = 0; k <= term.length - 3; k += 1) g.push(term.slice(k, k + 3));
        for (const gram of new Set(g)) (grams[gram] ||= []).push(terms.length - 1);
      }
      totalTerms += terms.length;
      const key = parts.length === 1 ? "" : part[0][0][1] || "·";
      const file = `g${pad(id)}${parts.length === 1 ? "" : `-${pad(i)}`}.json`;
      writeJson(path.join(dir, file), { l: letter, t: terms, p: lists, g: grams });
      files.push({ k: key, f: file });
    });
    groups.push({ l: letter, split: parts.length > 1, files });
  }
  const files = groups.reduce((sum, g) => sum + g.files.length, 0);

  /* بيانات المستندات: أرقام مسطّحة لتقليل الحجم، مقسّمة على نطاقات.
     الشريحة الواحدة سبعمئة مستند: أصغر تحمّلًا للصفحة، وأكبر من أن
     يكلّف طلبًا لكل نتيجة. */
  const docsDir = path.join(dir, "docs");
  fs.rmSync(docsDir, { recursive: true, force: true });
  const DOCS_PER = 700;
  const docFiles = [];
  for (let i = 0; i < docs.length; i += DOCS_PER) {
    const slice = docs.slice(i, i + DOCS_PER).map((d) => [
      d.id,
      d.t,
      d.ti,
      d.su,
      d.a,
      d.c.join("|"),
      d.d,
      d.r,
      d.au,
      d.p,
      d.x || 0,
      TYPE_PRIOR[d.t] === undefined ? 1 : TYPE_PRIOR[d.t],
    ]);
    const name = `${pad(docFiles.length)}.json`;
    writeJson(path.join(docsDir, name), slice);
    docFiles.push(name);
  }

  writeJson(path.join(dir, "manifest.json"), {
    n: docs.length,
    avgLen,
    docsPerFile: DOCS_PER,
    groups,
    ranges,
    docFiles,
    terms: totalTerms,
  });
  log(`  فهرس البحث: ${totalTerms} مصطلحًا في ${files} ملفًا · ${docFiles.length} ملف مستندات`);
  return { terms: totalTerms, files };
}

/* -------------------------------------------------------------------- بناء */

function main() {
  if (!fs.existsSync(RESOURCES)) {
    console.error(
      `لم أجد مصدر المحتوى في:\n  ${RESOURCES}\n` +
        `ثبّت Altaqwaa أو عيّن ALTAQWAA_RESOURCES إلى مجلد resources.`
    );
    process.exit(1);
  }

  console.log(`المصدر: ${RESOURCES}`);
  console.log(`الوجهة: ${OUT}\n`);

  fs.mkdirSync(OUT, { recursive: true });
  const collections = {};
  for (const type of COLLECTIONS) collections[type] = buildCollection(type);

  const tafsir = buildTafsir();
  const hisn = buildHisn();
  const misc = buildMisc();
  const search = buildSearchIndex(COLLECTIONS);

  writeJson(path.join(OUT, "manifest.json"), {
    generatedAt: new Date().toISOString(),
    provenance: {
      app: "Altaqwaa",
      version: "4.0.0",
      license: "GPL-3.0",
      author: "Rayan Almalki (rn0x)",
      note: "المحتوى مستخرج من حزمة Altaqwaa الأصلية؛ الحقول الثقيلة غير المستخدمة محذوفة والمحتوى مقسّم لأجزاء.",
    },
    collections: Object.fromEntries(
      Object.entries(collections).map(([type, meta]) => [
        type,
        {
          count: meta.count,
          listFiles: meta.listFiles.length,
          itemFiles: meta.itemFiles.length,
          categories: meta.categories.length,
        },
      ])
    ),
    tafsir,
    hisn,
    misc,
    search,
  });

  log("\n✔ اكتمل بناء المحتوى");
}

main();