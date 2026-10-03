"use strict";

/**
 * يجلب نص «السراج في بيان غريب القرآن» نصًّا من المكتبة الشاملة.
 *
 * المصدر رقميٌّ مطبوع (لا استخراج ضوئي): كل مدخل فقرة فيه رقم الآية والكلمة
 * الغريبة بين قوسين معنويين ثم معناها. وهذا الجلب يلتقط هذه البنية كما هي
 * ويضعها في `sources/siraj/raw.json`، والبناء منها إلى `content/siraj/`
 * في `scripts/build-siraj-content.cjs`.
 *
 * الطلب متسلسل بمهلة بينه فلا يثقل الموقع، وكل عشرين صفحة يكتب ما جلب
 * حتى إن انقطع فيُستأنف من حيث وقف.
 *
 *   node scripts/fetch-siraj-source.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const BOOK = 14531;
const BASE = `https://shamela.ws/book/${BOOK}`;
const OUT_DIR = path.resolve(__dirname, "..", "sources", "siraj");
const OUT = path.join(OUT_DIR, "raw.json");
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";
const PAUSE = 250;

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

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * صفحة واحدة مع إعادة المحاولة عند فشل الشبكة.
 * @param {number} page
 * @returns {Promise<string>}
 */
async function get(page) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(`${BASE}/${page}`, {
        headers: { "user-agent": UA, accept: "text/html" },
        signal: AbortSignal.timeout(45000),
      });
      if (res.status === 404) return "";
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      lastError = error;
      await sleep(800 * attempt);
    }
  }
  throw new Error(`تعذّر جلب الصفحة ${page}: ${lastError && lastError.message}`);
}

/**
 * فصول الكتاب: عنوان كل فصل وصفحته الأولى.
 * @param {string} html
 * @returns {{title: string, page: number}[]}
 */
function chapters(html) {
  const nav = html.match(/<h4>فصول الكتاب<\/h4>[\s\S]*?<\/ul>/);
  const out = [];
  for (const match of (nav ? nav[0] : html).matchAll(
    /<a href="[^"]*\/book\/\d+\/(\d+)"[^>]*>([^<]+)<\/a>/g
  )) {
    out.push({ title: match[2].trim(), page: Number(match[1]) });
  }
  return out;
}

/** @param {string} html @returns {number} رقم آخر صفحة في الكتاب */
function lastPage(html) {
  const match = html.match(/href="[^"]*\/book\/\d+\/(\d+)#p1"[^>]*>&gt;&gt;/);
  return match ? Number(match[1]) : 0;
}

/**
 * يلتقط نصّ الكتاب من الصفحة: كل فقرة مدخل، وما فيها من رقم آية وكلمة غريبة.
 * @param {string} html
 * @returns {{a: number|null, w: string|null, t: string}[]}
 */
function paragraphs(html) {
  const body = html.match(/<div class="nass[^"]*"[^>]*>([\s\S]*?)<div id="appended_pages">/);
  if (!body) return [];
  const out = [];
  for (const match of body[1].matchAll(/<p>([\s\S]*?)<\/p>/g)) {
    const raw = match[1]
      .replace(/<span class="anchor"[^>]*><\/span>/g, "")
      .replace(/<a [^>]*class="btn_tag[^"]*"[^>]*>[\s\S]*?<\/a>/g, "")
      .trim();
    if (!raw) continue;
    const ayah = (raw.match(/<span class="c2">([^<]*)<\/span>/) || [])[1];
    const words = [...raw.matchAll(/<span class="c3">([^<]*)<\/span>/g)].map((row) =>
      row[1].replace(/[{}]/g, "").replace(/\s+/g, " ").trim()
    );
    const rest = raw
      .replace(/<span class="c\d">[^<]*<\/span>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s*\.\s*\.\s*\.\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    out.push({
      a: ayah === undefined ? null : arNumber(ayah.replace(/[^\d٠-٩]/g, "")),
      w: words.length ? words.join(" ") : null,
      t: rest,
    });
  }
  return out;
}

async function main() {
  const index = await get(1);
  const toc = chapters(index);
  if (!toc.length) throw new Error("لم يُقرأ فهرس الفصول من المصدر");
  const end = lastPage(index) || toc[toc.length - 1].page;
  console.log(`فصول: ${toc.length} · صفحات: 1..${end}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let done = [];
  if (fs.existsSync(OUT)) {
    try {
      const have = JSON.parse(fs.readFileSync(OUT, "utf8"));
      if (Array.isArray(have.pages)) done = have.pages;
    } catch {
      done = [];
    }
  }
  const have = new Map(done.map((row) => [row.page, row]));

  for (let page = 2; page <= end; page += 1) {
    if (have.has(page)) continue;
    const html = await get(page);
    if (!html) continue;
    const rows = paragraphs(html);
    have.set(page, { page, rows });
    await sleep(PAUSE);
    if (page % 20 === 0) {
      fs.writeFileSync(
        OUT,
        `${JSON.stringify({
          source: {
            name: "المكتبة الشاملة",
            url: BASE,
            author: "محمد بن عبد العزيز الخضيري",
            title: "السراج في بيان غريب القرآن",
            edition: "الطبعة الثانية، الرياض ١٤٢٩ هـ / ٢٠٠٨ م — مركز الدراسات والبحوث بمكتبة الملك فهد الوطنية",
            retrievedAt: new Date().toISOString().slice(0, 10),
          },
          chapters: toc,
          lastPage: end,
          pages: [...have.values()].sort((a, b) => a.page - b.page),
        })}\n`
      );
      console.log(`الصفحة ${page}/${end} · ${have.size} صفحة مجلوبة`);
    }
  }

  const payload = {
    source: {
      name: "المكتبة الشاملة",
      url: BASE,
      author: "محمد بن عبد العزيز الخضيري",
      title: "السراج في بيان غريب القرآن",
      edition:
        "الطبعة الثانية، الرياض ١٤٢٩ هـ / ٢٠٠٨ م — مركز الدراسات والبحوث بمكتبة الملك فهد الوطنية",
      retrievedAt: new Date().toISOString().slice(0, 10),
    },
    chapters: toc,
    lastPage: end,
    pages: [...have.values()].sort((a, b) => a.page - b.page),
  };
  fs.writeFileSync(OUT, `${JSON.stringify(payload)}\n`);
  const total = payload.pages.reduce((sum, row) => sum + row.rows.length, 0);
  console.log(`جُلب ${payload.pages.length} صفحة و${total} فقرة إلى ${path.relative(process.cwd(), OUT)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});