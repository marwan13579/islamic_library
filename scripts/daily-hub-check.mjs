import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent((req.url || "/").split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const EXECUTABLE = process.env.CHROMIUM_PATH
  || path.join(process.env.HOME, ".cache/ms-playwright/chromium-1243/chrome-linux64/chrome");
const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

const problems = [];
const note = (message) => { problems.push(message); console.log("  ✘ " + message); };
const ok = (message) => console.log("  ✔ " + message);

/* ---------- ١) سطح المكتب: الصفحة تُبنى بلا أخطاء ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${base}/index.html`, { waitUntil: "networkidle" });

  const counts = await page.evaluate(() => ({
    hero: document.querySelectorAll("#dcRoot .dc-hero").length,
    quick: document.querySelectorAll("#dcRoot .dc-quick a").length,
    cards: document.querySelectorAll("#dcRoot .dc-card").length,
    prayer: document.querySelectorAll('#dcRoot [data-prayer]').length,
    wird: document.querySelectorAll('#dcRoot [data-wird]').length,
    remind: document.querySelectorAll('#dcRoot [data-remind]').length,
    now: document.querySelectorAll("#dcRoot .dc-now a").length,
    verse: document.querySelector("#dcRoot .dc-verse")?.textContent?.trim() || "",
    verseRef: document.querySelector("#dcRoot .dc-ref")?.textContent?.trim() || "",
    count: document.querySelector("#dcRoot .dc-count")?.textContent || "",
    times: document.querySelectorAll("#dcRoot .dc-time").length,
    cta: document.querySelectorAll("#dcRoot .dc-share-cta").length,
    toolsStillThere: document.querySelectorAll("#sections .tool").length,
    dashboard: !!document.getElementById("dashboard"),
    fav: !!document.getElementById("favSection"),
  }));

  counts.hero === 1 ? ok("التحية موجودة") : note("التحية غير موجودة");
  counts.quick >= 7 ? ok(`الاختصارات السريعة ${counts.quick}`) : note(`اختصارات قليلة: ${counts.quick}`);
  counts.cards >= 6 ? ok(`بطاقات اليوم ${counts.cards}`) : note(`بطاقات قليلة: ${counts.cards}`);
  counts.times === 6 ? ok("كل مواقيت اليوم معروضة") : note(`مواقيت ${counts.times} بدل 6`);
  /^\d{2}:\d{2}(:\d{2})?$/.test(counts.count) ? ok(`العدّ التنازلي يعمل: ${counts.count}`) : note(`عدّ تنازلي غير صالح: "${counts.count}"`);
  counts.verse.length > 10 ? ok("آية اليوم معروضة") : note("آية اليوم فارغة");
  counts.verseRef ? ok("مرجع الآية موجود: " + counts.verseRef) : note("مرجع الآية مفقود");
  counts.now >= 8 ? ok(`بطاقات "ماذا تريد أن تفعل الآن؟" ${counts.now}`) : note(`بطاقات قليلة: ${counts.now}`);
  counts.cta === 1 ? ok("CTA المشاركة موجود") : note("CTA المشاركة مفقود");
  counts.toolsStillThere > 20 ? ok(`فهرس الأدوات سليم (${counts.toolsStillThere} أداة)`) : note(`فهرس الأدوات تلف: ${counts.toolsStillThere}`);
  counts.dashboard && counts.fav ? ok("لوحة الإحصاء والمفضلة لم تُحذف") : note("عنصر قائم اختفى");
  errors.length === 0 ? ok("بلا أخطاء في الطرفية") : errors.forEach(note);

  /* ---------- ٢)计划的:中没有 plan 就显示开始 ---------- */
  const beforePlan = await page.locator("#dcRoot .dc-card[data-wird] .dc-btn.primary").first().textContent();
  beforePlan.includes("ابدأ") ? ok("بلا خطة: زر «ابدأ وردك» ظاهر") : note(`زر البداية غير متوقّع: ${beforePlan}`);

  /* ---------- ٣)打通计划后进度条出现 ---------- */
  await page.locator("#dcRoot .dc-card[data-wird] .dc-btn.primary").first().click();
  await page.waitForSelector("dialog.dc-modal[open]", { timeout: 3000 });
  const planCount = await page.locator("dialog.dc-modal .dc-plan").count();
  planCount >= 8 ? ok(`نافذة الخطة تعرض ${planCount} خطط`) : note(`خطط قليلة: ${planCount}`);
  await page.locator('dialog.dc-modal .dc-plan[data-plan="medium"]').click();
  await page.waitForTimeout(200);
  const bar = await page.locator("#dcRoot .dc-card[data-wird] .dc-bar").count();
  bar === 1 ? ok("شريط التقدّم ظهر بعد بدء الخطة") : note("شريط التقدّم لم يظهر");

  /* ---------- ٤)الإتمام وشاشة التهنئة ---------- */
  await page.fill("#dcPages", "4");
  await page.locator("#dcRoot .dc-stepper .dc-btn").click();
  await page.waitForTimeout(900);
  const done = await page.locator("dialog.dc-modal .dc-done").count();
  done === 1 ? ok("شاشة إتمام الورد ظهرت") : note("شاشة الإتمام لم تظهر");
  if (done) {
    const doneRef = await page.locator("dialog.dc-modal .dc-done-ref").textContent();
    doneRef?.includes("المصدر") ? ok("محتوى الإتمام يحمل مصدره: " + doneRef.trim()) : note("محتوى الإتمام بلا مصدر");
    const dialogs = await page.locator("dialog.dc-modal[open]").count();
    dialogs === 1 ? ok("نافذة واحدة فقط مفتوحة (لا تكدّس)") : note(`نوافذ مفتوحة: ${dialogs}`);
    await page.keyboard.press("Escape");
  }
  const streak = await page.locator("#dcRoot .dc-streak").textContent().catch(() => "");
  streak?.includes("🔥") ? ok("الأيام المتتالية ظهرت: " + streak.trim()) : note("سلسلة الأيام لم تظهر");

  /* ---------- ٥)التذكيرات لا تُطلب بلا إذن ---------- */
  const asked = await page.evaluate(() => window.Notification?.permission === "default");
  asked ? ok("الإذن لم يُطلب تلقائيًا (الإذن ما زال default)") : note("permission: " + asked);
  const rows = await page.locator("#dcRoot .dc-remind-list .dc-remind-row").count();
  rows === 0 ? ok("التذكيرات مطفيّة فلا صفوف تذكير قبل التفعيل") : note(`صفوف تذكير ظاهرة بلا تفعيل: ${rows}`);

  await page.close();
}

/* ---------- ٦)الهاتف: لا تمرير أفقي، وأهداف اللمس كبيرة ---------- */
{
  const page = await browser.newPage({ viewport: { width: 360, height: 720 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/index.html`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  overflow <= 1 ? ok("بلا تمرير أفقي على ٣٦٠ بكسل") : note(`تمرير أفقي ${overflow}px`);
  const small = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("#dcRoot button, #dcRoot a")];
    return nodes.filter((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 34; }).length;
  });
  small === 0 ? ok("كل أزرار اللوحة صالحة للّمس") : note(`أزرار صغيرة على اللمس: ${small}`);
  errors.length === 0 ? ok("بلا أخطاء على الهاتف") : errors.forEach(note);
  await page.close();
}

/* ---------- ٧)الوضع الليلي ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });
  await page.goto(`${base}/index.html`, { waitUntil: "networkidle" });
  await page.locator("#dcRoot .dc-theme-toggle").click();
  await page.waitForTimeout(150);
  const dark = await page.evaluate(() => ({
    attr: document.documentElement.getAttribute("data-theme"),
    stored: localStorage.getItem("lib-theme-pref"),
    bg: getComputedStyle(document.body).backgroundColor,
  }));
  dark.attr === "dark" && dark.stored === "dark" ? ok("الوضع الليلي يُفعَّل ويُحفظ") : note(`الوضع الليلي: ${JSON.stringify(dark)}`);
  await page.reload({ waitUntil: "networkidle" });
  const after = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  after === "dark" ? ok("الوضع الليلي يبقى بعد إعادة التحميل") : note(`الوضع بعد التحميل: ${after}`);

  /* ---------- ٨)RTL ---------- */
  const dir = await page.evaluate(() => document.documentElement.dir);
  dir === "rtl" ? ok("الاتجاه RTL") : note("الاتجاه: " + dir);
  await page.close();
}

/* ---------- ٩)تخطّي المحرّك: لا انهيار ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // نحجب الملف فنمنع تعريف المحرّك، وهو أسوأ حالة ممكنة.
  await page.route("**/daily-companion.js", (route) => route.abort());
  await page.goto(`${base}/index.html`, { waitUntil: "networkidle" });
  const defined = await page.evaluate(() => typeof window.DailyCompanion);
  defined === "undefined" ? ok("المحرّك محجوب فعلًا") : note("المحرّك ما زال موجودًا: " + defined);
  const root = await page.evaluate(() => document.getElementById("dcRoot").children.length);
  root === 0 ? ok("بدون المحرّك: اللوحة فارغة بصمت") : note(`اللوحة حاولت البناء: ${root}`);
  const tools = await page.evaluate(() => document.querySelectorAll("#sections .tool").length);
  tools > 20 ? ok("الفهرس يعمل رغم غياب المحرّك") : note("الفهرس تلف");
  errors.length === 0 ? ok("بلا استثناءات") : errors.forEach(note);
  await page.close();
}

/* ---------- ١٠)تخطّي المحتوى: لا نصّ مخترع ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/daily-content.js", (route) => route.abort());
  await page.goto(`${base}/index.html`, { waitUntil: "networkidle" });
  const verse = await page.evaluate(() => document.querySelector("#dcRoot .dc-verse")?.textContent?.trim() || "");
  verse === "" ? ok("بلا مصدر: لا آية مخترعة") : note("ظهرت آية بلا مصدر: " + verse);
  const dhikr = await page.evaluate(() => document.querySelector("#dcRoot .dc-dhikr")?.textContent?.trim() || "");
  dhikr === "" ? ok("بلا مصدر: لا ذكر مخترع") : note("ظهر ذكر بلا مصدر: " + dhikr);
  errors.length === 0 ? ok("بلا استثناءات عند غياب المحتوى") : errors.forEach(note);
  await page.close();
}

await browser.close();
server.close();

console.log(problems.length === 0 ? "\n✔ كل فحوص الرفيق اليومي نجحت" : `\n✘ ${problems.length} مشكلة`);
process.exit(problems.length === 0 ? 0 : 1);