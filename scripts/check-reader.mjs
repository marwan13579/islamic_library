"use strict";

/**
 * فحص أدوات القارئ في متصفح حقيقي (Chromium).
 *
 * ما لا يعرفه فحص الجملة ولا فحوص الصفحة: أن شريط الأدوات يُرسم، وأن
 * الفهرس يُبنى من العناوين، وأن البحث يُبرز الورودات، وأن تغيير الخط
 * والتباعد ينعكس على المتن — وكل ذلك من صفحةٍ تُفتح بمعامل لا بصفحة فارغة.
 *
 * التشغيل:  node scripts/check-reader.mjs
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(process.env.BROWSER_CHECK_ROOT || PROJECT_ROOT);
const EXECUTABLE =
  process.env.CHROMIUM_PATH ||
  path.join(process.env.HOME, ".cache/ms-playwright/chromium-1243/chrome-linux64/chrome");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    let file = path.join(ROOT, url);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

const problems = [];
const ok = (label) => console.log(`  ✔ ${label}`);
const bad = (label, detail) => {
  problems.push(label);
  console.log(`  ✖ ${label}${detail ? ` — ${detail}` : ""}`);
};

/** حصن المسلم: أكثر متنٍ عناوين، فهو أنفع لاختبار الفهرس والبحث. */
async function openReader(query) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${base}/reader.html${query}`, { waitUntil: "load" });
  await page.waitForSelector(".body", { timeout: 15000 }).catch(() => {});
  return { page, errors };
}

console.log("\n=== أدوات القارئ ===");

/* ------------------------------------------------------ الرسم */

{
  const { page, errors } = await openReader("?type=hisn&id=hisn-1");

  if (await page.locator(".rtools").count()) ok("شريط الأدوات مرسوم");
  else bad("شريط الأدوات مرسوم");

  if (await page.locator(".rtool").count() >= 8) ok("الأدوات كلها مرسومة");
  else bad("الأدوات كلها مرسومة", `${await page.locator(".rtool").count()} زرًّا`);

  /* ترتيب الأدوات: الشريط يسبق المتن فيبقى لاصقًا أعلى الصفحة. */
  const before = await page.evaluate(() => {
    const bar = document.querySelector(".rtools");
    const body = document.querySelector(".body");
    return Boolean(bar && body && bar.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  if (before) ok("الشريط يسبق المتن");
  else bad("الشريط يسبق المتن");

  /* المكوّن يقرأ من التخزين ولا يرمي بلا قيم محفوظة. */
  const saved = await page.evaluate(() => {
    try {
      localStorage.getItem("reader_font");
      localStorage.getItem("reader_line");
      return true;
    } catch {
      return false;
    }
  });
  if (saved) ok("التخزين المحلي متاح للتفضيلات");
  else bad("التخزين المحلي متاح للتفضيلات");

  if (errors.length === 0) ok("بلا أخطاء في الـ console");
  else bad("بلا أخطاء في الـ console", errors.slice(0, 2).join(" | "));

  await page.close();
}

/* ---------------------------------------------------- الفهرس */

{
  const { page } = await openReader("?type=hisn&id=hisn-1");
  const rows = await page.locator(".routline li").count();
  if (rows > 5) ok(`الفهرس بُني من العناوين (${rows} عنوانًا)`);
  else bad("الفهرس بُني من العناوين", `${rows}`);

  const hiddenAtFirst = await page.locator(".router").isHidden();
  if (hiddenAtFirst) ok("الفهرس مطويٌّ حتى يُطلب");
  else bad("الفهرس مطويٌّ حتى يُطلب");

  await page.locator('.rtool[title="فهرس العناوين"]').click();
  if (await page.locator(".router").isVisible()) ok("الفهرس ينفتح بالنقر");
  else bad("الفهرس ينفتح بالنقر");

  /* الانتقال إلى عنوان ought أن يغيّر الموضع. */
  const jumped = await page.evaluate(async () => {
    const link = document.querySelector(".routline a");
    if (!link) return false;
    const target = link.getAttribute("href").slice(1);
    const node = document.getElementById(target);
    if (!node) return false;
    node.scrollIntoView();
    return true;
  });
  if (jumped) ok("روابط الفهرس تشير إلى عناوين موجودة");
  else bad("روابط الفهرس تشير إلى عناوين موجودة");

  await page.close();
}

/* ------------------------------------------- البحث في النصّ */

{
  const { page } = await openReader("?type=hisn&id=hisn-1");
  const field = page.locator(".rfind-field");

  /* الكلمة تُؤخذ من عقدة نصّ واحدة: البحث يمشي على عقد النصّ،
     فلا يطابق كلمةً مقطّعة على عقدتين. */
  const word = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.querySelector(".body"), NodeFilter.SHOW_TEXT);
    let best = "";
    let node = walker.nextNode();
    while (node) {
      for (const run of (node.textContent || "").match(/[ء-ي]{6,}/g) || []) {
        if (run.length > best.length) best = run;
      }
      node = walker.nextNode();
    }
    return best;
  });

  await field.fill(word);
  await page.waitForTimeout(250);
  const hits = await page.locator("mark.rfind").count();
  if (hits > 0) ok(`the search marks every hit (${hits} for ${word})`);
  else bad("the search marks every hit", `${word} was not marked`);

  /* And with a vowel mark added, which the search must ignore: the
     reader types without tashkeel all the time. */
  await field.fill(`${word.slice(0, 4)}َ${word.slice(4)}`);
  await page.waitForTimeout(250);
  const folded = await page.locator("mark.rfind").count();
  if (folded > 0) ok(`the search ignores vowel marks (${folded})`);
  else bad("the search ignores vowel marks", `${word} with a fatha was not found`);

  /* A single letter matches everything, so it is refused. */
  await field.fill("ا");
  await page.waitForTimeout(150);
  const oneChar = await page.locator("mark.rfind").count();
  if (oneChar === 0) ok("a single letter is not searched");
  else bad("a single letter is not searched", `${oneChar}`);

  /* Clearing the field takes the marks away again. */
  await field.fill("");
  await page.waitForTimeout(150);
  const cleared = await page.locator("mark.rfind").count();
  if (cleared === 0) ok("clearing the field removes the marks");
  else bad("clearing the field removes the marks", `${cleared} left over`);

  await page.close();
}

/* ------------------------------- الخطّ والتباعد والحجم */

{
  const { page } = await openReader("?type=hisn&id=hisn-1");
  const fontOf = () =>
    page.evaluate(() => getComputedStyle(document.querySelector(".body")).fontFamily);

  const first = await fontOf();
  await page.locator(".rsel").first().selectOption("cairo");
  await page.waitForTimeout(120);
  const second = await fontOf();
  if (first !== second) ok("تغيير الخطّ ينعكس على المتن");
  else bad("تغيير الخطّ ينعكس على المتن", `${first} = ${second}`);

  /* ويعود بعد إعادة التحميل، فقد حُفظ. */
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector(".body");
  const third = await fontOf();
  if (third === second) ok("الخطّ المحفوظ يعود في القراءة التالية");
  else bad("الخطّ المحفوظ يعود في القراءة التالية", `${third}`);

  const lineBefore = await page.evaluate(
    () => getComputedStyle(document.querySelector(".body")).lineHeight,
  );
  await page.locator(".rsel").nth(1).selectOption("loose");
  await page.waitForTimeout(120);
  const lineAfter = await page.evaluate(
    () => getComputedStyle(document.querySelector(".body")).lineHeight,
  );
  if (lineAfter !== lineBefore) ok(`تغيير التباعد ينعكس (${lineBefore} ← ${lineAfter})`);
  else bad("تغيير التباعد ينعكس", `${lineBefore}`);

  const sizeBefore = await page.evaluate(() =>
    getComputedStyle(document.documentElement).fontSize);
  await page.locator('.rtool[title="تكبير الخط"]').click();
  await page.waitForTimeout(120);
  const sizeAfter = await page.evaluate(() =>
    getComputedStyle(document.documentElement).fontSize);
  if (sizeAfter !== sizeBefore) ok(`زرّ الحجم يغيّر الحجم (${sizeBefore} ← ${sizeAfter})`);
  else bad("زرّ الحجم يغيّر الحجم", `${sizeBefore}`);

  await page.close();
}

/* ---------------------------------- آخر موضع قراءة */

{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/reader.html?type=hisn&id=hisn-1`, { waitUntil: "load" });
  await page.waitForSelector(".body");
  const stored = await page.evaluate(() => localStorage.getItem("reader_last"));
  /* التخزين يكتب بـJSON، فالقراءة الخام محاطة بعلامتَي تنصيص. */
  let decoded = "";
  try {
    decoded = JSON.parse(String(stored));
  } catch {
    decoded = String(stored);
  }
  if (decoded === "hisn:hisn-1") ok(`the last read position is kept (${decoded})`);
  else bad("the last read position is kept", `${stored} -> ${decoded}`);

  await page.goto(`${base}/reader.html`, { waitUntil: "load" });
  await page.waitForTimeout(300);
  const link = await page.locator('a[href*="type=hisn"]').count();
  if (link > 0) ok("القارئ الفارغ يعرض رابط آخر قراءة");
  else bad("القارئ الفارغ يعرض رابط آخر قراءة");

  await page.close();
}

await browser.close();
server.close();

if (problems.length) {
  console.log(`\n✖ ${problems.length} فحصًا لم ينجح:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
console.log("\n✔ أدوات القارئ سليمة");
