"use strict";

/**
 * فحص الإدماج في متصفّح حقيقي (Chromium).
 *
 * ما لا تحتمله اختبارات الوحدة: أن تبويب الإذاعات يفتح من رابطٍ عميق،
 * وأن زرّ الاستماع يُبدّل المشغّل إلى وضع البثّ الحيّ، وأن الرحلة من
 * محطةٍ إلى سور صاحبها ومن قارئٍ إلى بثّه تعمل بالنقر لا بالقراءة.
 *
 * التشغيل:  node scripts/audio-hub-check.mjs
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
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
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
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const tab = await context.newPage();
const errors = [];
tab.on("pageerror", (error) => errors.push(String(error)));
tab.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

const problems = [];
const pass = (ok, label, detail = "") => {
  console.log(`  ${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) problems.push(label);
};

/** ينتظر انتهاء الرسم بعد جلب القرّاء والإذاعات من الملفات. */
async function ready() {
  await tab.waitForSelector(".tabs .tab", { timeout: 20000 });
  await tab.waitForFunction(() => !document.getElementById("body").textContent.includes("جارٍ"), null, {
    timeout: 20000,
  });
}

/** حالة المشغّل كما يراها المستخدم. */
const playerState = () =>
  tab.evaluate(() => {
    const root = document.querySelector(".lib-player");
    if (!root || root.hidden) return null;
    const seek = root.querySelector(".pl-seek");
    return {
      live: root.dataset.live === "1",
      title: root.querySelector(".pl-title").textContent.trim(),
      seekShown: seek ? getComputedStyle(seek).display !== "none" : false,
    };
  });

/** عدد أسطر صفحة معيّنة. */
const rows = (selector) => tab.$$eval(selector, (els) => els.length);

console.log("=== الصفحة الموحّدة: الإذاعات مع القرّاء ===");

/* ١) رابطٌ عميق: الصفحة القديمة تحيل إلى صفحة واحدة على تبويب الإذاعات. */
await tab.goto(`${base}/32-radio-hub.html`, { waitUntil: "load" });
await tab.waitForFunction(() => location.pathname.endsWith("40-reciters.html"), null, { timeout: 20000 });
await ready();
pass(tab.url().includes("#radio"), "الرابط القديم يفتح الإذاعات", tab.url().split("/").pop());

const headline = await tab.textContent("#headline");
pass(/قارئًا و[٠-٩\d]+ إذاعة/.test(headline), "العدّ في الترويسة صادق", headline?.trim());

/* ٢) التبويبُ المفحوصة: التسع التي يفحصها check:streams، لا أكثر. */
const featuredCount = await rows(".srow");
const featuredLabel = await tab.textContent(".lib-count");
pass(featuredCount === 9, "المحطات المفحوصة التسع وحدها", featuredLabel?.trim());
const insecure = await tab.$$eval(".srow", (els) =>
  els.filter((el) => /http:\/\//.test(el.outerHTML)).length);
pass(insecure === 0, "لا بثٌّ غير آمن في القائمة");

/* ٣) زرّ الاستماع يُبدّل المشغّل إلى وضع البثّ الحيّ. */
await tab.click(".srow .sbtn");
const live = await playerState();
pass(Boolean(live?.live), "المشغّل انقلب إلى وضع البثّ الحيّ", live?.title);
pass(live?.seekShown === false, "شريط التقدّم مخفيّ في البثّ الحيّ");

/* ٤) من محطة البث إلى سور صاحبها. */
const before = tab.url();
await tab.click(".srow .sbtn:nth-of-type(2)");
await tab.waitForSelector(".panelbox", { timeout: 10000 });
const reciterName = await tab.textContent(".panelbox h2");
const surahRows = await rows(".srow");
pass(reciterName?.includes("المنشاوي"), "زرّ «تلاواتُه» فتح صاحب المحطة", reciterName?.trim());
pass(surahRows === 114, "سور القارئ كلّها في الصفحة", `${surahRows} سورة`);
pass(before === tab.url(), "الرحلة لم تُغيّر الصفحة");

/* ٥) ومن القارئ إلى بثّه الحيّ، فالمشغّلُ نفسُه لا مشغّلٌ آخر. */
await tab.click(".panelbox .sbtn");
const fromReciter = await playerState();
pass(Boolean(fromReciter?.live), "بثُّ القارئ من لوحه", fromReciter?.title);

/* ٦) البحث في الصفحة يبقى داخلها. */
await tab.click(".tab:nth-child(1)");
await ready();
await tab.fill("#q", "الحصري");
await tab.waitForTimeout(400);
const found = await rows(".rcard");
const hits = await tab.$$eval(".rcard", (els) => els.map((el) => el.textContent));
pass(found > 0 && hits.some((t) => t.includes("الحصري")), "البحث يجد القارئ", `${found} نتيجة`);

/* ٧) المحفوظات: الحالة الفارغة صريحة، لا فراغٌ غامض. */
await tab.click(".tab:nth-child(3)");
await tab.waitForSelector(".stat, .lib-empty", { timeout: 10000 });
const savedText = await tab.textContent("#body");
pass(/محفوظة|محفوظات/.test(savedText), "تبويب المحفوظات يعرض حالته", savedText?.trim().slice(0, 40));

pass(errors.length === 0, errors.length ? `أخطاء تشغيل: ${errors.join(" | ")}` : "بلا أخطاء تشغيل");

await browser.close();
server.close();

if (problems.length) {
  console.error(`\n✘ فشل ${problems.length} فحصًا`);
  process.exit(1);
}
console.log("\n✔ الإذاعات والقرّاء في صفحة واحدة، والبثّ الحيّ في وضعه");
