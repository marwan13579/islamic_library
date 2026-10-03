"use strict";

/**
 * إعادة تقسيم فهرس البحث دون إعادة بناء المحتوى.
 *
 * المشكلة: المُفهرِس قسّم دلو "ا" إلى ١١١ ملفًا، لكنه سجّل في البيان
 * مفتاح الحرف الثاني لكل الملفات لا مفتاح الحرف الذي قُسّمت عنده فعلًا.
 * فكل ٨٤ ملفًا من.files تحمل k:"ل"، وأي استعلام يبدأ بـ"ال" يجلبها
 * جميعًا: ٨٤ طلبًا ونحو ٣٫٩ ميغابايت لكل كلمة.
 *
 * ما نفعله هنا: نقرأ الملفات الموجودة بمصطلحاتها وفهارسها، ونعيد
 * تقسيم كل حرف بعمقٍ صحيح، ونكتب d (عمق التقسيم) في البيان،
 * فيقرأ العميل ملفًا واحدًا أو اثنين بدل أربعة وثمانين.
 *
 * التشغيل: node scripts/reindex-search.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "content", "search");

/** مطابق(maximum part size) — نفس حدّ المُفهرِس. */
const SHARD_BYTES = 600 * 1024;

const pad = (n) => String(n).padStart(3, "0");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value));
}

/**
 * يوزّع مدخلات على ملفات، ويسجّل عند أي عمق انقسمت.
 * @param {[string, number[]][]} entries
 * @param {number} depth
 * @returns {{ entries: [string, number[]][], depth: number }[]}
 */
function partition(entries, depth) {
  const bytes = entries.reduce((sum, [term, p]) => sum + term.length * 2 + p.length * 7 + 40, 0);
  if (bytes <= SHARD_BYTES || depth > 6) return [{ entries, depth }];
  const sub = new Map();
  for (const entry of entries) {
    // الحرف عند هذا العمق، وإلا فصنفٌ واحد لا ينقسم.
    const key = entry[0][depth] || "·";
    if (!sub.has(key)) sub.set(key, []);
    sub.get(key).push(entry);
  }
  if (sub.size < 2) return [{ entries, depth }];
  return [...sub.values()].flatMap((group) => partition(group, depth + 1));
}

/**
 * يبني خريطة تريغرامات للمدخلات، كما يفعل المُفهرِس.
 * @param {string[]} terms
 */
function buildGrams(terms) {
  const grams = {};
  for (let i = 0; i < terms.length; i += 1) {
    const term = terms[i];
    const set = term.length <= 3 ? [term] : [];
    for (let k = 0; k <= term.length - 3; k += 1) set.push(term.slice(k, k + 3));
    for (const gram of new Set(set)) (grams[gram] ||= []).push(i);
  }
  return grams;
}

function main() {
  const manifestPath = path.join(DIR, "manifest.json");
  const mf = readJson(manifestPath);

  /* نجمع كل مصطلح في كل حرف، مع إبقاء الترتيب. */
  const letters = new Map();
  for (const group of mf.groups) {
    for (const file of group.files) {
      const data = readJson(path.join(DIR, file.f));
      const bucket = letters.get(group.l) || [];
      data.t.forEach((term, i) => bucket.push([term, data.p[i]]));
      letters.set(group.l, bucket);
    }
  }

  /* أخطاء الدالّة لا تُقصد: نُصلحها هنا بدل إعادة البناء. الهمزة
     المفردة كان المُفهرِس يحذفها والاستعلام لا يحذفها، فكل كلمة
     فيها همزة مفردة كانت غير قابلة للوصول. */
  const HAMZA = /ء/g;
  const ALEF = /^[ٱٲٳ]/;
  let folded = 0;
  let merged = 0;

  const rebuilt = [];
  let groupIndex = 0;
  for (const [letter, raw] of letters) {
    const entries = [];
    const seen = new Set();
    for (const [term, pairs] of raw) {
      // مصطلح الهمزة المفردة لا وجود له في الفهرس: نُسقطه لا أن نخترع فهرسًا.
      if (HAMZA.test(term)) {
        folded += 1;
        continue;
      }
      // ٱٲٳ لم تُوحَّد في البناء، فبقيت في دلو لا يبلغها أي استعلام.
      const term2 = ALEF.test(term) ? "ا" + term.slice(1) : term;
      if (term2 !== term) merged += 1;
      if (seen.has(term2)) continue;
      seen.add(term2);
      entries.push([term2, pairs]);
    }
    HAMZA.lastIndex = 0;

    if (!entries.length) continue;
    entries.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const parts = partition(entries, 1);

    const id = groupIndex;
    groupIndex += 1;
    const files = [];
    parts.forEach((part, i) => {
      const terms = part.entries.map((e) => e[0]);
      const lists = part.entries.map((e) => e[1]);
      const file = `g${pad(id)}${parts.length === 1 ? "" : `-${pad(i)}`}.json`;
      writeJson(path.join(DIR, file), {
        l: letter,
        t: terms,
        p: lists,
        g: buildGrams(terms),
      });
      // p هو المسار: البادئة التي تشترك فيها كل مصطلحات الملف. وهو ما يميّز
      // الملف عن أخيه عند العمق نفسه، إذ تتشارك 파일اتُ الحرفَ الواحد.
      files.push({ p: part.entries[0][0].slice(0, part.depth), f: file, d: part.depth });
    });
    rebuilt.push({ l: letter, split: parts.length > 1, files });
  }

  /* نحذف الملفات القديمة التي لم يُعَد إنتاجها. */
  const keep = new Set(rebuilt.flatMap((g) => g.files.map((f) => f.f)));
  for (const name of fs.readdirSync(DIR)) {
    if (/^g\d+(-\d+)?\.json$/.test(name) && !keep.has(name)) fs.rmSync(path.join(DIR, name));
  }

  mf.groups = rebuilt;
  writeJson(manifestPath, mf);

  const total = rebuilt.reduce((n, g) => n + g.files.length, 0);
  const split = rebuilt.filter((g) => g.split);
  let worst = 0;
  let worstGroup = "";
  for (const g of split) {
    for (const f of g.files) {
      const bytes = fs.statSync(path.join(DIR, f.f)).size;
      if (bytes > worst) {
        worst = bytes;
        worstGroup = `${g.l} ${f.f} d=${f.d}`;
      }
    }
  }
  console.log(`أُعيد التقسيم: ${total} ملفًا، ${split.length} مجموعة مقسَّمة.`);
  console.log(`أُسقط ${folded} مصطلحًا فيه همزة مفردة، وُحّد ${merged} مصطلحًا يبدأ بألف خنجرية.`);
  console.log(`أكبر ملف: ${(worst / 1024).toFixed(0)}KB (${worstGroup})`);
}

main();
