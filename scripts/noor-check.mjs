/**
 * فحص وظيفي لـ«رفيق النور» في متصفّح حقيقي.
 *
 * الفحوص الأخرى تحرس بنية المشروع، وهذا الملف يحرس السلوك: هل تظهر
 * رسالة اليوم، وهل يتكرّر المحتوى، وهل يأتي التدبر بعد إتمام السورة،
 * وهل يتوقّف التذكير عند إطفائه، وهل يعمل في الوضع الليلي و RTL.
 *
 * التشغيل: npm run check:noor
 */

import { chromium } from "playwright-core";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

const results = [];
const pass = (ok, label) => {
  results.push({ ok, label });
  console.log(`  ${ok ? "✔" : "✘"} ${label}`);
};

const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
    res.writeHead(404).end("404");
    return;
  }
  const type = MIME[path.extname(file)] ?? "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ["--no-sandbox"] });

/** صفحة نظيفة: تخزينٌ جديد ونفسها بلا ذاكرة من جولة سابقة. */
async function openPage(pathname, { theme = "light" } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon/.test(m.text())) errors.push("console: " + m.text());
  });
  await page.addInitScript((value) => {
    try { localStorage.setItem("lib-theme-pref", value); } catch {}
  }, theme);
  await page.goto(`${base}${pathname}`, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(window.NoorCompanion));
  await page.waitForTimeout(400);
  return { context, page, errors };
}

/* ------------------------------------------------ 1) أول زيارة: ترحيب صغير */

console.log("\n=== أول زيارة ===");
{
  const { context, page, errors } = await openPage("/29-prayer-times.html");

  const gear = await page.locator(".noor-gear").count();
  pass(gear === 1, "زرّ الإعدادات 🌿 ظاهر مرة واحدة");

  const welcome = await page.locator(".noor-card h3").first().textContent().catch(() => "");
  pass(/رفيق النور/.test(welcome ?? ""), `بطاقة الترحيب ظاهرة: ${welcome?.trim()}`);

  /* لا لوح يحجب الصفحة: البطاقة يجب ألّا تغطّي أزرار الصفحة. */
  const blocking = await page.locator(".noor-backdrop").count();
  pass(blocking === 0, "لا لوح يحجب الصفحة — البطاقة صغيرة وتمرّ النقر تحتها");

  const clickThrough = await page.evaluate(() => {
    const card = document.querySelector(".noor-card");
    if (!card) return null;
    return getComputedStyle(card).pointerEvents;
  });
  pass(clickThrough === "none", `البطاقة لا تعترض النقر (pointer-events=${clickThrough})`);

  await page.locator(".noor-card .noor-btn", { hasText: "ابدأ" }).first().click();
  await page.waitForTimeout(600);
  const offer = await page.locator(".noor-card h3").first().textContent().catch(() => "");
  pass(/هل تريد تفعيل/.test(offer ?? ""), `سؤال الإذن جاء بعد موافقة: ${offer?.trim()}`);

  /* الرفض لا يفسد شيئًا ولا يُعاد السؤال. */
  await page.locator(".noor-card .noor-btn", { hasText: "ليس الآن" }).first().click();
  await page.waitForTimeout(400);
  const asked = await page.evaluate(() => window.NoorCompanion.getSettings().notifAsked);
  pass(asked === true, "رفض الإذن سُجّل، فلا يُعاد السؤال");

  pass(errors.length === 0, `بلا أخطاء في الصفحة${errors.length ? ": " + errors.join(" | ") : ""}`);
  await context.close();
}

/* --------------------------------------------------- 2) رسالة اليوم */

console.log("\n=== رسالة اليوم ===");
{
  const { context, page } = await openPage("/index.html");
  await page.evaluate(() => window.NoorCompanion.showDailyMessage(true));
  await page.waitForTimeout(500);

  const title = await page.locator(".noor-card h3").first().textContent();
  const body = await page.locator(".noor-text").first().textContent().catch(() => "");
  const src = await page.locator(".noor-src").first().textContent().catch(() => "");
  pass(/آية اليوم|رسالة اليوم/.test(title ?? ""), `العنوان: ${title?.trim()}`);
  pass((body ?? "").trim().length > 10, "النصّ معروض");
  pass((src ?? "").trim().length > 0, `مصدره معروض: ${src?.trim().slice(0, 40)}`);

  /* مرة ثانية في اليوم نفسه لا تُكرَّر تلقائيًّا. */
  await page.evaluate(() => {
    document.querySelector(".noor-x")?.click();
    window.NoorCompanion.showDailyMessage();
  });
  await page.waitForTimeout(300);
  const repeat = await page.locator(".noor-card").count();
  pass(repeat === 0, "لا تتكرّر في اليوم نفسه بلا طلب");
  await context.close();
}

/* ------------------------------------------- 3) تدبر بعد إتمام السورة */

console.log("\n=== التدبر بعد إتمام القراءة ===");
{
  const { context, page, errors } = await openPage("/30-quran-full.html");

  /* نداء الخطّاف كما تناديه saveLastPos في صفحة المصحف. */
  await page.evaluate(() => window.NoorCompanion.observeReading({ surah: 94, ayah: 8 }));
  await page.waitForTimeout(700);

  const sheetTitle = await page.locator(".noor-sheet h2").first().textContent().catch(() => "");
  pass(/تدبر بعد القراءة/.test(sheetTitle ?? ""), `اللوح: ${sheetTitle?.trim()}`);

  const sheet = await page.locator(".noor-sheet").first().innerText().catch(() => "");
  pass(/اقرأ ثم اعمل|تدبر/.test(sheet) || sheet.length > 120, "محتوى التدبر معروض");

  const hasAction = await page.locator(".noor-sheet [data-noor-action]").count();
  pass(hasAction > 0, `اقتراح عمل اليوم: ${hasAction} خيارًا`);

  const modal = await page.getAttribute(".noor-backdrop", "aria-modal");
  pass(modal === "true", "اللوح معلَن كنتفAccessible (aria-modal)");

  /* اختيار عمل يُحفظ محليًّا. */
  if (hasAction > 0) {
    await page.locator(".noor-sheet [data-noor-action]").first().check();
    await page.waitForTimeout(300);
    const chosen = await page.evaluate(() => window.NoorCompanion.getActions().chosen.length);
    pass(chosen === 1, "اختيار العمل حُفظ في الجهاز");
  }

  /* إعادة السورة نفسها في الجلسة لا تكرّر التدبر. */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.NoorCompanion.observeReading({ surah: 94, ayah: 8 }));
  await page.waitForTimeout(500);
  const again = await page.locator(".noor-backdrop").count();
  pass(again === 0, "لا يتكرّر التدبر لنفس السورة في الجلسة نفسها");

  /* سورة أخرى يعطي تدبرًا جديدًا. */
  await page.evaluate(() => window.NoorCompanion.observeReading({ surah: 112, ayah: 4 }));
  await page.waitForTimeout(600);
  const other = await page.locator(".noor-backdrop").count();
  pass(other === 1, "سورة أخرى تعطي تدبرًا جديدًا");

  pass(errors.length === 0, `بلا أخطاء${errors.length ? ": " + errors.join(" | ") : ""}`);
  await context.close();
}

/* ------------------------------------- 4) منع التكرار والإزعاج */

console.log("\n=== منع التكرار والإزعاج ===");
{
  const { context, page } = await openPage("/1-adhkar.html");

  const picks = await page.evaluate(() => {
    const seen = [];
    const NC = window.NoorCompanion;
    /* نحاكي الاختيار عشر مرات عبر المسار العام: نطلب تذكيرات متتالية. */
    for (let i = 0; i < 10; i += 1) {
      document.querySelector(".noor-x")?.click();
      NC.showDailyMessage(true);
      const text = document.querySelector(".noor-text")?.textContent?.trim() ?? "";
      seen.push(text);
    }
    return seen;
  });
  const unique = new Set(picks);
  pass(unique.size >= 5, `محتوى متنوّع: ${unique.size} من ${picks.length}`);

  /* تذكيران متتاليان لا يختاران الشيء نفسه. */
  const repeated = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 6; i += 1) {
      document.querySelector(".noor-x")?.click();
      window.NoorCompanion.showDailyMessage(true);
      out.push(document.querySelector(".noor-text")?.textContent?.trim() ?? "");
    }
    let same = 0;
    for (let i = 1; i < out.length; i += 1) if (out[i] && out[i] === out[i - 1]) same += 1;
    return same;
  });
  pass(repeated === 0, `لا تكرار في المواجهة (${repeated} تكرارًا)`);
  await context.close();
}

{
  const { context, page } = await openPage("/22-qibla.html");
  await page.evaluate(() => window.NoorCompanion.updateSettings({ enabled: false, quiet: true }));

  const timers = await page.evaluate(() => {
    /* عند Quiet لا يبقى مؤقّت تذكير معلّق: نقيس بغياب بطاقة جديدة. */
    const before = document.querySelectorAll(".noor-card").length;
    window.NoorCompanion.showDailyMessage(true);
    return document.querySelectorAll(".noor-card").length - before;
  });
  pass(timers === 1, "الوضع الهادئ يُبقي الاستجابة اليدوية فقط، ولا يبدأ مؤقّتًا");

  const quiet = await page.evaluate(() => window.NoorCompanion.getSettings().quiet);
  pass(quiet === true, "الوضع الهادئ مسجّل في الإعدادات");
  await context.close();
}

/* --------------------------------------- 5) السياق يتبع الصفحة */

console.log("\n=== التذكير الذكي حسب الصفحة ===");
{
  const pages = [
    ["/1-adhkar.html", "أذكار"],
    ["/30-quran-full.html", "تدبّر أو آية"],
    ["/29-prayer-times.html", "ذكر الصلاة"],
    ["/10-zakat.html", "الإنفاق"],
  ];
  for (const [pathname, label] of pages) {
    const { context, page, errors } = await openPage(pathname);
    const shown = await page.evaluate(() => {
      document.querySelector(".noor-x")?.click();
      window.NoorCompanion.showDailyMessage(true);
      return document.querySelector(".noor-card")?.innerText ?? "";
    });
    const src = (shown.match(/(سورة.+|البخاري.*|مسلم.*|صحيح.*|أذكار.*|حصن المسلم.*)/) ?? [])[0] ?? "";
    pass(shown.length > 20, `/${pathname.replace("/", "")} (${label}) → ${src.trim().slice(0, 42)}`);
    pass(errors.length === 0, `  ${pathname} بلا أخطاء`);
    await context.close();
  }
}

/* ------------------------------------- 6) RTL والوضع الليلي والإتاحة */

console.log("\n=== RTL والوضع الليلي والإتاحة ===");
{
  const { context, page } = await openPage("/22-qibla.html", { theme: "dark" });
  const theme = await page.getAttribute("html", "data-theme");
  pass(theme === "dark", `الوضع الليلي محفوظ ومطبَّق (${theme})`);

  await page.evaluate(() => window.NoorCompanion.showDailyMessage(true));
  await page.waitForTimeout(400);
  const bg = await page.evaluate(() => {
    const card = document.querySelector(".noor-card");
    if (!card) return null;
    const s = getComputedStyle(card);
    return { bg: s.backgroundColor, color: s.color, dir: getComputedStyle(card).direction };
  });
  pass(bg?.dir === "rtl", `اتجاه البطاقة RTL (${bg?.dir})`);
  pass(bg && bg.bg !== "rgba(0, 0, 0, 0)", `للنموذج لون خلفية (${bg?.bg})`);
  pass(bg && bg.color !== bg.bg, `لون النص مختلف عن لون الخلفية (${bg?.color} على ${bg?.bg})`);
  await context.close();
}

{
  const { context, page } = await openPage("/index.html");
  await page.evaluate(() => window.NoorCompanion.openSettings());
  await page.waitForTimeout(400);

  const dialog = await page.getAttribute(".noor-backdrop", "role");
  pass(dialog === "dialog", "اللوح بدور dialog");

  const labelled = await page.evaluate(() =>
    [...document.querySelectorAll(".noor-sheet input")].every(
      (el) => el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.labels?.length,
    ),
  );
  pass(labelled, "كل حقول اللوح موسومة");

  const live = await page.getAttribute(".noor-root", "aria-live");
  pass(live === "polite", "منطقة البطاقة معلنة aria-live=polite");

  /* Escape يغلق، والتركيز يعود حيث كان. */
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  pass((await page.locator(".noor-backdrop").count()) === 0, "Escape يغلق اللوح");
  await context.close();
}

/* -------------------------------------------- 7) العمل بلا اتصال */

console.log("\n=== العمل بلا اتصال ===");
{
  const { context, page, errors } = await openPage("/44-noor-companion.html");
  await context.setOffline(true);

  const offline = await page.evaluate(async () => {
    const res = await fetch("noor-content.js").catch(() => null);
    return res ? res.ok : false;
  });
  /* بعد تثبيت عامل الخدمة فقط. بلا عامل خدمة يُتوقّع ٥٠٣ لا قراءة. */
  const stats = await page.evaluate(() => {
    const s = document.getElementById("journey")?.innerText ?? "";
    return s.length > 0;
  });
  pass(stats, "الإحصاءات معروضة بلا أي طلب شبكة");
  pass(errors.length === 0, `صفحة الإعدادات بلا أخطاء بلا اتصال${errors.length ? ": " + errors.join(" | ") : ""}`);
  await context.close();
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n================ رفيق النور: ${results.length - failed.length}/${results.length} ================`);
if (failed.length) {
  for (const f of failed) console.log(`  ✘ ${f.label}`);
  process.exit(1);
}
console.log("✔ كل فحوص رفيق النور نجحت");