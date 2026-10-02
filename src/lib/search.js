/**
 * بحث عربي كامل في المتصفح فوق فهرس مقسّم.
 *
 * الخوارزمية مستعارة من Altaqwaa (GPL-3.0 — ريان المالكي، `searcher.mjs`)
 * بترتيب BM25 وقواعد المطابقة الواسعة نفسها، مع تغيير واحد جوهري: الفهرس
 * مقسّم على الحرف الأول من المصطلح، فالاستعلام يقرأ ما لا يزيد عن ثلاثة
 * أجزاء بدل ٢٩٢ ميغابايت.
 *
 * قاعدة "الأدقّ أولًا": إذا تجاوز عدد المستندات ٢٥ فالمرشّحات التقريبية
 * لهذا المصطلح تُهمل، وإلا ابتلعت الكلمات المتشابهة (الحجاب/الحجاج)
 * النتائجَ الحقيقية.
 * @module lib/search
 */

import { normalizeAr } from "./text.js";
import { searchManifest, searchFile, searchDocs } from "./shards.js";

const K1 = 1.2;
const B = 0.75;
const MAX_TOKENS = 6;
const MIN_TOKEN = 2;
const MAX_TOKEN = 24;
const COMMON_THRESHOLD = 25;
const FUZZY_MAX_DISTANCE = 2;

/** مقاطع الحروف العربية: ء إلى ٱ ثم الحروف الممدودة. */
const ARABIC_RUN = /[ء-يٱ-ە]+/g;

/** حرف لا صوت له منفردًا: حركات وتطويل. لا تُمدّ به حدود المطابقة. */
const COMBINING = /^[ً-ْٰۖ-ۭـ]$/;

/**
 * يقطّع النص إلى مصطلحات عربية صالحة للبحث.
 * التطبيع من `lib/text` نفسه، فيوافق البناءُ في السكربت والواجهة هنا.
 * @param {unknown} text
 * @returns {string[]}
 */
export function tokenize(text) {
  return (normalizeAr(text).match(ARABIC_RUN) || []).filter(
    (tok) => tok.length >= MIN_TOKEN && tok.length <= MAX_TOKEN
  );
}

/* ------------------------------------------------------------ مسافة التحرير */

/**
 * مسافة ليفنشتاين بمصفوفتين متبدّلتين. تُقصَر مبكّرًا إن اختلف الطول
 * بأكثر من مسموح، فالكلمات العربية القصيرة لا تحتاج أكثر.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levDistance(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  if (Math.abs(m - n) > FUZZY_MAX_DISTANCE) return FUZZY_MAX_DISTANCE + 1;

  let prev = new Uint16Array(n + 1);
  let curr = new Uint16Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[n];
}

/**
 * ثلاثيات المصطلح: مرشّحون تقريبيون بلا مسح كل المفردات.
 * @param {string} token
 * @returns {string[]}
 */
export function trigrams(token) {
  if (token.length <= 3) return [token];
  const out = [];
  for (let i = 0; i <= token.length - 3; i += 1) out.push(token.slice(i, i + 3));
  return out;
}

/* ---------------------------------------------------------------- التظليل */

/** علامة يفتح `highlight` بها المطابقة. */
export const HIGHLIGHT_OPEN = "[[H]]";
/** علامة تختم `highlight` بها المطابقة. */
export const HIGHLIGHT_CLOSE = "[[/H]]";

/**
 * جدول يربط مواضع النص المطبَّع بمواضع الأصل.
 * بدونه ينزاح التظليل عن الكلمة بمقدار الحركات والتطويل.
 * @param {string} text
 */
function align(text) {
  const raw = String(text);
  /** @type {number[]} موضع النص المطبَّع ← موضع النص الأصلي. */
  const rawOf = [];
  let norm = "";
  for (let i = 0; i < raw.length; i += 1) {
    const n = normalizeAr(raw[i]);
    for (let k = 0; k < n.length; k += 1) rawOf.push(i);
    norm += n;
  }
  return { raw, norm, rawOf };
}

/**
 * يحيط بمواضع المصطلحات بعلامتي `[[H]]`.
 * الرجوع نصٌّ خام لا HTML، فالواجهة تقرّر الوسم ولا يدخلها نص المستخدم.
 * @param {string} text
 * @param {string[]} terms مصطلحات خام أو مطبَّعة
 * @returns {string}
 */
export function highlight(text, terms) {
  if (!text) return text;
  const { raw, norm, rawOf } = align(text);
  const wanted = [...new Set(terms.map(normalizeAr).filter(Boolean))];
  if (!wanted.length) return text;

  /** @type {[number, number][]} */
  const ranges = [];
  for (const term of wanted) {
    let from = 0;
    while (true) {
      const at = norm.indexOf(term, from);
      if (at === -1) break;
      /* طرفا المطابقة يُسقطان إلى مواضع الأصل، ثم تُمدّ النهاية لتشمل
         الحركات اللاحقة لأنها بصريًا جزء من الكلمة. */
      const start = rawOf[at];
      let end = rawOf[at + term.length - 1] + 1;
      while (end < raw.length && COMBINING.test(raw[end])) end += 1;
      ranges.push([start, end]);
      from = at + term.length;
    }
  }
  if (!ranges.length) return text;

  ranges.sort((a, b) => a[0] - b[0]);
  /** @type {[number, number][]} */
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }

  let out = "";
  let pos = 0;
  for (const [start, end] of merged) {
    out += text.slice(pos, start) + HIGHLIGHT_OPEN + text.slice(start, end) + HIGHLIGHT_CLOSE;
    pos = end;
  }
  return out + text.slice(pos);
}

/* ------------------------------------------------------------ قراءة الفهرس */

/**
 * يقرأ أجزاء الدلو التي تخصّ مصطلحًا، فلا يُحمَّل إلا ما يلزم.
 * @param {any} mf بيان البحث
 * @param {string} token مصطلح مطبَّع
 */
async function loadBucket(mf, token) {
  const group = mf.groups.find((g) => g.l === token[0]);
  if (!group) return [];
  const wanted = group.split ? [token[1] || "·"] : [""];
  const files = group.files.filter((f) => wanted.includes(f.k)).map((f) => f.f);
  if (!files.length) return [];
  return Promise.all(files.map((file) => searchFile(file)));
}

/**
 * يدمج أجزاء الدلو في خريطة مصطلحات وخريطة ثلاثيات.
 * @param {any[]} buckets
 */
function indexBucket(buckets) {
  const terms = new Map();
  const grams = new Map();
  for (const bucket of buckets) {
    bucket.t.forEach((term, i) => {
      terms.set(term, bucket.p[i]);
      for (const gram of trigrams(term)) {
        const hit = grams.get(gram);
        if (hit) hit.push(term);
        else grams.set(gram, [term]);
      }
    });
  }
  return { terms, grams };
}

/**
 * مرشّحون لمصطلح داخل دلو واحد: الدقيق، ثم ما يبدأ به، ثم التقريبي.
 * @param {string} token
 * @param {{terms: Map<string, number[]>, grams: Map<string, string[]>}} bucket
 * @returns {[string, number][]} المصطلح ودرجة الثقة
 */
export function candidatesFor(token, bucket) {
  const exact = bucket.terms.get(token);
  if (exact) return [[token, 1]];

  /** @type {Map<string, number>} */
  const scores = new Map();
  const note = (cand, conf) => {
    if (cand === token) return;
    scores.set(cand, Math.max(scores.get(cand) || 0, conf));
  };

  if (token.length < 3) {
    for (const cand of bucket.terms.keys()) {
      if (cand.startsWith(token)) note(cand, 0.9 * (token.length / cand.length));
    }
    return [...scores.entries()];
  }

  for (const gram of trigrams(token)) {
    for (const cand of bucket.grams.get(gram) || []) {
      if (cand.startsWith(token)) {
        note(cand, 0.9 * (token.length / cand.length));
        continue;
      }
      if (cand.length < token.length - 1 || cand.length > token.length + 2) continue;
      const distance = levDistance(cand, token);
      if (distance <= 1) note(cand, 0.85);
      else if (distance === 2 && cand.length >= 9) note(cand, 0.7);
    }
  }
  return [...scores.entries()];
}

/* ------------------------------------------------------------- الترتيب */

/**
 * يبحث في المكتبة كلها.
 * @param {string} query
 * @param {{limit?: number, offset?: number, type?: string|null, category?: string|null}} [options]
 * @returns {Promise<{results: any[], total: number}>}
 */
export async function search(query, options = {}) {
  const { limit = 30, offset = 0, type = null, category = null } = options;
  const tokens = tokenize(query).slice(0, MAX_TOKENS);
  if (!tokens.length) return { results: [], total: 0 };

  const mf = await searchManifest();
  const n = mf.n || 1;
  const avgLen = mf.avgLen || 1;

  /** @type {Map<number, number>} درجة كل مستند. */
  const scores = new Map();
  /** @type {Map<number, string[]>} المصطلحات التي أصابت كل مستند. */
  const used = new Map();

  /** يسجّل أن مصطلحًا أصاب مستندًا، من غير تكرار. */
  const note = (doc, term) => {
    if (!used.has(doc)) used.set(doc, []);
    const list = /** @type {string[]} */ (used.get(doc));
    if (!list.includes(term)) list.push(term);
  };

  await Promise.all(
    tokens.map(async (token) => {
      const buckets = await loadBucket(mf, token);
      if (!buckets.length) return;
      const bucket = indexBucket(buckets);
      for (const [cand, conf] of candidatesFor(token, bucket)) {
        const flat = bucket.terms.get(cand);
        if (!flat) continue;
        const df = flat.length / 3;
        if (df >= COMMON_THRESHOLD && conf < 1) continue;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        for (let i = 0; i < flat.length; i += 3) {
          const doc = flat[i];
          const tf = flat[i + 1];
          const len = flat[i + 2] || 1;
          const denom = len + K1 * (1 - B + B * (len / avgLen));
          scores.set(doc, (scores.get(doc) || 0) + idf * ((tf * (K1 + 1)) / (tf + denom)) * conf);
          note(doc, cand);
        }
      }
    })
  );

  if (!scores.size) return { results: [], total: 0 };

  /* التحديد بالنوع قبل تحميل بيانات المستندات: المستندات مرتّبة بالنوع
     في مدى متصل، فيُستبعد ما لا يطابق قبل قراءة أي شريحة. لولاه
     لأراد «الصلاة» في التفسير قراءة كل أسئلة الاختبارات ثم يطرحها. */
  let ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (type) {
    const spans = (mf.ranges || [])
      .filter((r) => r.type === type)
      .map((r) => [r.from, r.to + 1]);
    if (spans.length) {
      ranked = ranked.filter(([doc]) => spans.some(([from, to]) => doc >= from && doc < to));
    } else {
      ranked = [];
    }
    if (!ranked.length) return { results: [], total: 0 };
  }

  const head = Math.min(ranked.length, Math.max(offset + limit, limit) * 4);
  const rows = await loadDocRows(mf, ranked.slice(0, head).map(([doc]) => doc));

  const results = [];
  for (const [doc, value] of ranked) {
    const row = rows.get(doc);
    if (!row) continue;
    const [id, kind, title, summary, author, cats, date, reading, hasAudio, where, extra, prior] =
      row;
    if (type && kind !== type) continue;
    if (category && !cats.split("|").includes(category)) continue;
    const terms = used.get(doc) || [];
    results.push({
      id,
      type: kind,
      title: highlight(title, terms),
      summary: highlight(summary, terms),
      author,
      categories: cats ? cats.split("|") : [],
      dateText: date,
      readingTime: reading,
      hasAudio: Boolean(hasAudio),
      where,
      extra: extra || 0,
      score: Math.round(value * (prior || 1) * 1000),
    });
  }

  /* الترتيب الأول يحدّد شريحتَي المستندات المراد تحميلهما، فبقي ترتيب
   * BM25. ثم يُطبَّق التقديم التحريري للنوع، فيُعاد الترتيب النهائي. */
  results.sort((a, b) => b.score - a.score);
  return { results: results.slice(offset, offset + limit), total: results.length };
}

/**
 * يقرأ صفوف المستندات المطلوبة فقط، لا كل الشرائح.
 * @param {any} mf
 * @param {number[]} docIndexes
 * @returns {Promise<Map<number, any[]>>}
 */
async function loadDocRows(mf, docIndexes) {
  const per = mf.docsPerFile || 3000;
  /** @type {Map<number, Promise<any[]>>} */
  const wanted = new Map();
  for (const doc of docIndexes) {
    const file = Math.floor(doc / per);
    if (!wanted.has(file)) wanted.set(file, searchDocs(file));
  }
  const rows = new Map();
  await Promise.all(
    [...wanted.entries()].map(async ([file, promise]) => {
      const list = await promise;
      const base = file * per;
      for (let i = 0; i < list.length; i += 1) rows.set(base + i, list[i]);
    })
  );
  return rows;
}