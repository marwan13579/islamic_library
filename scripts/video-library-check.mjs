/**
 * فحص مكتبة الفيديو الإسلامية في متصفح حقيقي.
 *
 * ما يفحصه (وهو ما لا تكشفه اختبارات الوحدة):
 *   - أن الصفحة تفتح بلا أخطاء كونسول وبلا طلب إلى يوتيوب.
 *   - أن البحث والفلاتر تغيّر النتائج فعلًا، وأن المفضلة تُحفظ وتظهر
 *     في صفحتها، وأن «اقتراح آخر» يغيّر الاقتراح.
 *   - أن الترقيم يمنع رسم كل شيء دفعةً واحدة.
 *   - أن الرابط يفتح تبويبًا جديدًا على نطاق يوتيوب، وأن فتحه يسجّل
 *     القناة في «آخر ما شوهد».
 *   - أن العرض سليم من 320px إلى 1440px، وفي الوضعين الليلي والفاتح.
 * التشغيل:  node scripts/video-library-check.mjs
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { CHANNELS } from "../src/data/islamic-channels.js";

const liveChannels = CHANNELS.filter((c) => c.verified && !c.needsReview && !c.disabled);

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
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
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
  console.log(`${ok ? "✔" : "✘"} ${message}`);
  if (!ok) failures += 1;
};

/** @param {string} title */
const section = (title) => console.log(`\n▸ ${title}`);

const LIB = `${base}/islamic-videos/`;
const FAV = `${base}/islamic-videos/favorites/`;

/* ─────────────────────────────────────────── الصفحة تفتح بلا أخطاء */

const context = await browser.newContext();
const tab = await context.newPage();
const problems = [];
tab.on("console", (message) => {
  if (message.type() === "error") problems.push(`console: ${message.text()}`);
});
tab.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
const external = [];
tab.on("request", (request) => {
  const url = request.url();
  if (!url.startsWith(base) && !url.startsWith("data:") && !url.startsWith("about:")) external.push(url);
});

await tab.goto(LIB, { waitUntil: "networkidle" });
await tab.waitForTimeout(400);

section("الصفحة تفتح");
pass(problems.length === 0, `بلا أخطاء كونسول${problems.length ? `: ${problems.join(" | ")}` : ""}`);
pass(external.length === 0, `بلا طلب خارجي${external.length ? `: ${external.slice(0, 3).join(", ")}` : ""}`);
pass((await tab.getAttribute("html", "dir")) === "rtl", "اتجاه الصفحة من اليمين");

const cards = () => tab.locator("#results .vcard");
const cardCount = async () => cards().count();

section("الترقيم والعرض");
const total = Number((await tab.textContent("#heroStats")).match(/[٠-٩]+/)?.[0]?.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)) ?? 0);
pass(total > 20, `عدد القنوات المعروضة في البطاقة العظمى: ${total}`);
pass((await cardCount()) === 12, `الصفحة الأولى فيها ١٢ بطاقة (رسمنا ${await cardCount()})`);
pass((await tab.locator("iframe").count()) === 0, "لا إطار مضمَّن");

/* ───────────────────────────────────────────────────── البحث */

section("البحث");
await tab.fill("#q", "الأزهر");
await tab.waitForTimeout(260);
const azhar = await cardCount();
pass(azhar >= 1 && azhar < 12, `«الأزهر» يرجع ${azhar} نتيجة`);

await tab.fill("#q", "zakaria");
await tab.waitForTimeout(260);
pass((await cardCount()) >= 1, "البحث بالإنجليزية يجد قناة تعلّم مع زكريا");

await tab.fill("#q", "لاشيء-به-هذا-الاسم-قطعًا");
await tab.waitForTimeout(260);
pass((await cardCount()) === 0, "بحث لا نتائج يعرض حالة فارغة");
pass((await tab.locator("#results .vempty").count()) === 1, "حالة الفراغ معروضة");

await tab.fill("#q", "");
await tab.waitForTimeout(260);
pass((await cardCount()) === 12, "تفريغ البحث يرجع الصفحة الأولى");

/* ────────────────────────────────────────────── الفلترة والترقيم */

section("الفلترة");
const selectAge = async (value) => {
  await tab.selectOption("#fAge", value);
  await tab.waitForTimeout(200);
};
const toNumber = (value) =>
  Number(String(value).replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
await selectAge("kids36");
const kids = await cardCount();
/* العدد يُقاس على البيانات لا على رقمٍ مكتوب في الفحص: تتغيّر المكتبة
   بقنوات جديدة، فالفحص يسأل «هل مرّر الفلترة ما يستحقّه» لا «كم قناة كان». */
const expectedKids = liveChannels.filter((channel) => channel.ageGroups.includes("kids36")).length;
const kidsTotal = toNumber((await tab.textContent("#count")).match(/[٠-٩]+/g)?.at(-1) ?? "");
pass(kids > 0, `فلترة العمر 3–6 تُظهر بطاقات (${kids})`);
pass(
  kidsTotal === expectedKids,
  `فلترة العمر 3–6 تمرّر ${kidsTotal} قناة والبيانات فيها ${expectedKids}`,
);
await selectAge("all");

await tab.selectOption("#fLang", "en");
await tab.waitForTimeout(200);
const english = await cardCount();
pass(english > 0, `فلترة الإنجليزية ترجع ${english} قناة`);
await tab.selectOption("#fLang", "all");
await tab.waitForTimeout(200);

const kidChip = tab.locator("#catChips .vchip", { hasText: "الأطفال" }).first();
await kidChip.click();
await tab.waitForTimeout(200);
pass((await cardCount()) > 0, "شريحة مجال «الأطفال» ترجع نتائج");
pass((await kidChip.getAttribute("aria-pressed")) === "true", "الشريحة المضغوطة معلنة بـaria-pressed");
await kidChip.click();
await tab.waitForTimeout(200);

const nextButton = tab.locator("#pager button", { hasText: "التالي" });
if ((await nextButton.count()) > 0) {
  const firstBefore = await cards().first().getAttribute("data-id");
  await nextButton.click();
  await tab.waitForTimeout(250);
  const firstAfter = await cards().first().getAttribute("data-id");
  pass(firstAfter !== firstBefore, `زر «التالي» ينقل إلى صفحة أخرى (${firstBefore} ← ${firstAfter})`);
  pass((await cardCount()) <= 12, "الصفحة الثانية لا تزيد عن اثنتي عشرة بطاقة");
  const previousButton = tab.locator("#pager button", { hasText: "السابق" });
  pass((await previousButton.isEnabled()) === true, "زر «السابق» مفعَّل في الصفحة الثانية");
  await previousButton.click();
  await tab.waitForTimeout(250);
  pass((await cards().first().getAttribute("data-id")) === firstBefore, "الرجوع للصفحة الأولى يُعيد النتائج نفسها");
} else {
  pass(false, "لا يوجد زر «التالي» رغم أن القنوات أكثر من اثنتي عشرة");
}

/* ─────────────────────────────────────────── watchNow والتوصيات */

section("الاقتراحات");
const spotlightId = await tab.getAttribute("#spotlight .vspot", "data-id");
pass(Boolean(spotlightId), `اقتراح «ماذا أشاهد» موجود (${spotlightId})`);
await tab.click("#reroll");
await tab.waitForTimeout(250);
const rerolled = await tab.getAttribute("#spotlight .vspot", "data-id");
pass(rerolled !== spotlightId, "«اقتراح آخر» غيّر القناة");
pass(
  (await tab.locator("#learnSection").isHidden()) ||
    (await tab.locator("#learnGrid .vcard").count()) <= 3,
  "«شاهد وتعلم» لا يعرض أكثر من ثلاثة اقتراحات",
);

/* ────────────────────────────────────────────── المفضلة والسجل */

section("المفضلة وآخر ما شوهد");
const firstCard = tab.locator("#results .vcard").first();
const firstId = await firstCard.getAttribute("data-id");
await firstCard.locator(".vstar").click();
await tab.waitForTimeout(200);
const stored = await tab.evaluate(() => JSON.parse(localStorage.getItem("video_favorites") || "[]"));
pass(stored.includes(firstId), "النجمة تحفظ القناة في video_favorites");
pass(
  (await tab.locator(`#results [data-fav="${firstId}"]`).first().getAttribute("aria-pressed")) === "true",
  "النجمة تعلن حالتها بالـaria",
);

const watchHref = await firstCard.locator("a[data-watch]").getAttribute("href");
pass(/^https:\/\/www\.youtube\.com\//.test(watchHref), `رابط المشاهدة على يوتيوب (${watchHref})`);
pass((await firstCard.locator("a[data-watch]").getAttribute("rel"))?.includes("noopener"), "rel=noopener");
pass((await firstCard.locator("a[data-watch]").getAttribute("target")) === "_blank", "يفتح تبويبًا جديدًا");

/* نمنع التنقل فعليًا ونترك معالج الصفحة يسجّل القناة */
await tab.evaluate(() => {
  document.addEventListener("click", (event) => event.preventDefault(), true);
});
await firstCard.locator("a[data-watch]").click();
await tab.waitForTimeout(250);
const recent = await tab.evaluate(() => JSON.parse(localStorage.getItem("video_recent") || "[]"));
pass(recent.some((item) => item.id === firstId), "فتح القناة يسجّلها في آخر ما شوهد");
pass((await tab.locator("#recentSection").isHidden()) === false, "قسم آخر ما شوهد ظهر");

await tab.goto(FAV, { waitUntil: "networkidle" });
await tab.waitForTimeout(300);
pass((await tab.locator(`#favBody [data-id="${firstId}"]`).count()) === 1, "القاة المحفوظة تظهر في صفحة المفضلة");
pass((await tab.locator("#favBody .vcard").count()) >= 1, "صفحة المفضلة تعرض بطاقاتها");
await tab.locator(`#favBody [data-fav="${firstId}"]`).first().click();
await tab.waitForTimeout(250);
pass((await tab.locator("#favBody .vcard").count()) === 0, "إزالة النجمة تفرغ المفضلة");
pass((await tab.locator("#favBody .vempty").count()) === 1, "حالة «لا محفوظات» معروضة");

/* ────────────────────────────────────────── وضع المراجعة فقط */

section("وضع المراجعة");
await tab.goto(`${LIB}?review=1`, { waitUntil: "networkidle" });
await tab.waitForTimeout(300);
pass((await tab.locator("#reviewSection").isHidden()) === false, "?review=1 يكشف قسم المراجعة");
pass((await tab.locator("#reviewSection a").count()) === 0, "قسم المراجعة بلا روابط مشاهدة");
await tab.goto(LIB, { waitUntil: "networkidle" });
await tab.waitForTimeout(300);
pass((await tab.locator("#reviewSection").isHidden()) === true, "وضع المراجعة مخفي بلا معامل");

/* ────────────────────────────────────────────────── المقاسات */

section("المقاسات والاتجاهين");
for (const width of [320, 375, 390, 430, 768, 1024, 1440]) {
  await tab.setViewportSize({ width, height: 800 });
  await tab.waitForTimeout(150);
  const overflow = await tab.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  pass(overflow <= 1, `${width}px: بلا تمرير أفقي (${overflow})`);
}

/* ────────────────────────────────────────────── الوضع الليلي */

section("الوضع الليلي");
await tab.setViewportSize({ width: 390, height: 844 });
await tab.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
await tab.waitForTimeout(200);
const dark = await tab.evaluate(() => ({
  paper: getComputedStyle(document.body).backgroundColor,
  card: getComputedStyle(document.querySelector(".vcard")).backgroundColor,
  ink: getComputedStyle(document.querySelector(".vcard__title")).color,
}));
pass(dark.paper !== "rgba(0, 0, 0, 0)", "خلفية الصفحة في الوضع الليلي");
pass(dark.card !== dark.paper, "البطاقة بلون يميّزها عن الخلفية");
pass(dark.ink.length > 0, `لون النص محدَّد (${dark.ink})`);
await tab.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
await tab.waitForTimeout(150);
const light = await tab.evaluate(() => getComputedStyle(document.body).backgroundColor);
pass(light !== dark.paper, "الوضع الفاتح يعطي خلفية مختلفة");

/* ───────────────────────────────────────────── إتاحة لوحة المفاتيح */

section("الإتاحة");
await tab.keyboard.press("Tab");
const firstStop = await tab.evaluate(() => document.activeElement?.className || "");
pass(firstStop.includes("skip"), `أول ضغطة tab تصل إلى رابط التخطّي (${firstStop})`);
await tab.focus("#q");
await tab.keyboard.type("قرآن");
await tab.waitForTimeout(250);
pass((await cardCount()) > 0, "البحث يعمل بلوحة المفاتيح");
const unnamed = await tab.evaluate(() =>
  [...document.querySelectorAll("button, a[href], select, input")]
    .filter((element) => {
      const style = getComputedStyle(element);
      if (!element.getClientRects().length || style.visibility === "hidden") return false;
      const name =
        element.getAttribute("aria-label") ||
        element.textContent.trim() ||
        element.getAttribute("title") ||
        (element.labels && element.labels.length ? element.labels[0].textContent : "");
      return !name;
    })
    .map((element) => element.outerHTML.slice(0, 60)),
);
pass(unnamed.length === 0, `كل الأزرار لها اسم مقروء${unnamed.length ? `: ${unnamed[0]}` : ""}`);

await context.close();
await browser.close();
server.close();

console.log(`\n${failures === 0 ? "✔ نجحت كل فحوص مكتبة الفيديو" : `✘ ${failures} فحصًا فاشلًا`}`);
process.exit(failures === 0 ? 0 : 1);