"use strict";

/**
 * فحصٌ حيّ للبحث الموسَّع: يفتح الصفحة في متصفّحٍ حقيقي، ويبحث بلفظ آية
 * ومعنى كلمة غريبة واسم سورة برقمها، ثم يتأكّد أنّ رابط النتيجة يفتح
 * الموضع بعينه في المصحف.
 *
 * ما لا تحتمله اختباراتُ الوحدة: أنّ المتصفّح يجلب المدوّدة فعلًا، وأنّ
 * النافذة تعرض ما فيها، وأنّ `?s=&a=` يفتح الآية.
 *
 * التشغيل: npm run check:search
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
  ".svg": "image/svg+xml",
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
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

const search = async (query) => {
  await page.goto(`${base}/index.html`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  // دليل المكتبة يفتح تلقائيًّا: يُغلق أولًا وإلا اعترض كل نقرة.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  // الفهرس فيه حقل بحث في الترويسة، والزرّ المزروع يظهر في غيره.
  const header = await page.$("#search");
  if (header) {
    await header.click();
    await page.fill("#search", query);
  } else {
    await page.click("#searchFab");
    await page.fill("#searchModalInput", query);
  }
  await page.waitForFunction(() => {
    const panel = document.getElementById("searchModalResults");
    return panel && !panel.hidden && panel.querySelectorAll(".search-modal-item").length > 0;
  }, null, { timeout: 15000 });
  // النتائج وحدها: اللوحاتُ المخفيّة فيها عناصرُها من اقتراحاتٍ وتاريخ.
  return page.$$eval("#searchModalResults .search-modal-item", (items) =>
    items.slice(0, 4).map((el) => ({
      title: el.querySelector(".search-modal-item-title")?.textContent?.trim() || "",
      href: el.getAttribute("href"),
    })));
};

const CASES = [
  ["الحمد لله رب العالمين", /سورة الفاتحة/, "لفظ آية"],
  ["البقرة 255", /سورة البقرة/, "سورة ورقم آية"],
  ["سورة 18", /الكهف/, "سورة برقمها"],
  ["اقسط", /قسط/, "معنى غريب"],
  ["عذاب القبر", /القبر/, "ذكر في حصن المسلم"],
  ["الجزء 30", /الجزء/, "موضع في المصحف"],
  ["ابوبكر", /بكر/, "خطأ إملائي"],
  ["أبو بكر الصديق رضي الله عنه", /بكر/, "جملة طويلة"],
];

const failures = [];
const pass = (ok, message) => {
  console.log(`  ${ok ? "✔" : "✘"} ${message}`);
  if (!ok) failures.push(message);
};

console.log("=== البحث النصّي يفتح ما طلبه ===");
for (const [query, expected, note] of CASES) {
  const results = await search(query);
  const top = results[0] || { title: "", href: "" };
  const shown = results.filter((r) => expected.test(r.title)).length;
  const hasHref = Boolean(top.href && top.href !== "#");
  pass(shown > 0 && hasHref, `${query} — ${note}: ${top.title} → ${top.href}`);
}

// الفلاتر: كل تبويبٍ يعطي نتائجٍ أو لا يظهر.
await page.goto(`${base}/index.html`, { waitUntil: "load" });
await page.waitForTimeout(1200);
await page.keyboard.press("Escape");
await page.click("#search");
const tabs = await page.$$eval("#searchModalFilters .search-modal-filter", (els) =>
  els.map((el) => ({ id: el.dataset.filter, label: el.textContent.trim() })));
console.log("\n=== تبويبات الفئات ===");
pass(tabs.length > 25, `عدد التبويبات: ${tabs.length}`);
pass(
  ["آيات", "معاني", "مدن", "مناسبات", "أقسام"].every((id) => tabs.some((t) => t.id === id)),
  `الفئات الجديدة ظاهرة: ${tabs.map((t) => t.id).join("، ")}`,
);

// الرابط العميق: يفتح سورة البقرة عند الآية ٢٥٥.
await page.goto(`${base}/30-quran-full.html?s=2&a=255`, { waitUntil: "networkidle" });
const deep = await page.evaluate(() => {
  const card = document.getElementById("ayah-2-255");
  if (!card) return null;
  return {
    top: Math.round(card.getBoundingClientRect().top),
    text: card.textContent.replace(/\s+/g, " ").trim().slice(0, 40),
  };
});
pass(Boolean(deep), deep ? `?s=2&a=255 فتح «${deep.text}» عند y=${deep.top}` : "?s=2&a=255 لم يفتح الآية");
pass(errors.length === 0, errors.length ? `أخطاء تشغيل: ${errors.join(" | ")}` : "بلا أخطاء تشغيل");

await browser.close();
server.close();

if (failures.length) {
  console.error(`\n✘ فشل ${failures.length} فحصًا`);
  process.exit(1);
}
console.log("\n✔ نجح فحص البحث الموسَّع");