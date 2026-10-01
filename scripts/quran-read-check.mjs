"use strict";

/**
 * فحص ميزات قراءة المصحف ومؤقّت النوم في متصفح حقيقي.
 * التشغيل:  node scripts/quran-read-check.mjs
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXECUTABLE =
  process.env.CHROMIUM_PATH ||
  path.join(process.env.HOME, ".cache/ms-playwright/chromium-1243/chrome-linux64/chrome");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

const server = await new Promise((resolve) => {
  const s = http.createServer((req, res) => {
    let file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) return void res.writeHead(404).end("404");
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  s.listen(0, "127.0.0.1", () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

let failures = 0;
const pass = (ok, message) => {
  console.log(`  ${ok ? "✔" : "✘"} ${message}`);
  if (!ok) failures += 1;
};

/* ---------------------- وحدة القراءة (بلا شبكة) ---------------------- */

console.log("=== وحدة قراءة المصحف ===");
{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/src/app/app.html#tab/quran`, { waitUntil: "load" });
  await page.waitForTimeout(1200);

  const module = await page.evaluate(async () => {
    const m = await import("../app/quran-read.js");
    return {
      types: m.TAFSIR_TYPES.map((t) => t.key),
      // نبني DOM صغيرًا ونختبر الرسم
      renderVerses: (() => {
        const el = document.createElement("div");
        m.renderVerses([{ numberInSurah: 1, text: "بسم الله" }], el, 24);
        return el.innerHTML;
      })(),
      renderTajweed: (() => {
        const el = document.createElement("div");
        m.renderVerses(
          [{ numberInSurah: 1, text: "الحمد لله", html: '<span class="tj-madda_normal">بِسْمِ</span>' }],
          el, 24,
        );
        return el.innerHTML;
      })(),
      renderTafsir: (() => {
        const el = document.createElement("div");
        m.renderTafsir([{ numberInSurah: 1, text: "بدأ الكتاب" }], el, "الميسّر");
        el.hidden = false;
        return { html: el.innerHTML.slice(0, 90), visible: !el.hidden };
      })(),
      renderWBW: (() => {
        const el = document.createElement("div");
        m.renderWordByWord(
          [{ numberInSurah: 1, words: [{ text_uthmani: "قُلْ", translation: { text: "قل" } }], translation: "Say" }],
          el, 24,
        );
        return el.innerHTML;
      })(),
      ayahRef: m.ayahWithRef({ name: "الفاتحة", number: 1 }, { numberInSurah: 2, text: "الحمد لله" }),
    };
  });

  pass(module.types.length === 3, `أنواع التفسير: ${module.types.join(" ")}`);
  pass(module.renderVerses.includes("ayah-number"), "رسم الآيات يعمل");
  pass(module.renderTajweed.includes("tj-madda_normal"), "ألوان التجويد تُطبَّق");
  pass(module.renderTafsir.visible && module.renderTafsir.html.includes("الميسّر"), "لوحة التفسير تظهر");
  pass(module.renderWBW.includes("wbw-word") && module.renderWBW.includes("قل"), "الترجمة كلمة بكلمة تعمل");
  pass(module.ayahRef.includes("الفاتحة") && module.ayahRef.includes("﴿"), "نسخ الآية مع المرجع يعمل");

  // الحماية من الحقن: نصّ تفسيري يحوي HTML
  const escaped = await page.evaluate(async () => {
    const m = await import("../app/quran-read.js");
    const el = document.createElement("div");
    m.renderTafsir([{ numberInSurah: 1, text: '<img src=x onerror=alert(1)>' }], el, "اختبار");
    return el.innerHTML;
  });
  pass(!escaped.includes("<img"), "نصّ التفسير يُرمَّز ضد الحقن (escapeHtml)");

  await context.close();
}

/* --------------------------- مؤقّت النوم --------------------------- */

console.log("\n=== مؤقّت النوم للإذاعة ===");
{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/src/app/app.html#tab/media`, { waitUntil: "load" });
  await page.waitForTimeout(1200);

  const buttons = await page.locator('[data-role="sleep-timer"]').count();
  pass(buttons === 3, `أزرار المؤقّت موجودة (${buttons})`);

  await page.click('[data-role="sleep-timer"][data-minutes="15"]');
  await page.waitForTimeout(400);
  const armed = await page.evaluate(() => document.getElementById("sleepStatus")?.textContent ?? "");
  pass(armed.includes("١٥"), `التسليح يعمل: «${armed.trim()}»`);

  await page.click('[data-role="sleep-cancel"]');
  await page.waitForTimeout(300);
  const cleared = await page.evaluate(() => document.getElementById("sleepStatus")?.textContent ?? "");
  pass(cleared.trim() === "", "الإلغاء يمسح المؤقّت");

  await context.close();
}

await browser.close();
server.close();
console.log(`\n${failures === 0 ? "✔ كل فحوص القراءة نجحت" : `✘ ${failures} مشكلة`}`);
process.exit(failures === 0 ? 0 : 1);