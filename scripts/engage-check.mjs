"use strict";

/**
 * فحص طبقة التفاعل في المتصفح: الشارة العائمة، لوحة الأوسمة، تحدّي اليوم،
 * وتعليم القراءة في الصفحات النصّية.
 *
 * التشغيل:  node scripts/engage-check.mjs
 * يحتاج Chromium؛ مساره الافتراضي في `~/.cache/ms-playwright/…`، ويُغيَّر
 * بمتغيّر البيئة `CHROMIUM_PATH`.
 *
 * ما يُفحص سلوكًا لا نصًّا: كل قاعدةٍ في `engage.js` تُكتَب ولا تعمل تظهر
 * هنا بأمرٍ واضح. وحين لا يكون في المتصفح `dialog` ولا `AudioContext` —
 * كما في المتصفحات القديمة — يُتحقَّق أن الطبقة صامتة لا أنهPlacement.
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

/** يفتح صفحة ويسجّل أخطاء الطرفية، ويمرّرها في `errors`. */
async function open(context, pagePath) {
  context.setDefaultTimeout(8000);
  const tab = await context.newPage();
  const errors = [];
  tab.on("pageerror", (error) => errors.push(String(error)));
  tab.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await tab.goto(`${base}${pagePath}`, { waitUntil: "load" });
  await tab.waitForTimeout(350);
  return { tab, errors };
}

/** دليل المكتبة (`intro-tour.js`) يُفتح تلقائيًّا بعد ٧٠٠ مللي ثانية من
 *  الفهرس، وهو `dialog` يعلو كل شيء فيمنع كل نقرة. فننتظر ظهوره ثم نغلقه،
 *  وإلا اعترض أول زرٍّ نضغطه. */
async function dismissTour(tab) {
  const tour = tab.locator("#itModal");
  try {
    await tour.waitFor({ state: "visible", timeout: 2500 });
  } catch {
    return; // لم يُفتح — لا حاجة لإغلاق شيء
  }
  await tab.keyboard.press("Escape");
  await tab.waitForTimeout(200);
  pass(!(await tour.evaluate((node) => node.open).catch(() => false)), "دليل المكتبة أُغلق قبل الفحص");
}

/* --------------------------------- 1) الشارة العائمة في كل صفحة ---------- */
console.log("=== 1) الشارة العائمة في كل صفحة ===");
{
  const pages = ["/index.html", "/12-mustajab.html", "/17-wird.html", "/9-seerah.html", "/30-quran-full.html"];
  for (const pagePath of pages) {
    const context = await browser.newContext();
    const { tab, errors } = await open(context, pagePath);
    const shown = await tab.evaluate(() => {
      const pill = document.querySelector(".eg-pill");
      if (!pill) return null;
      const box = pill.getBoundingClientRect();
      const styles = getComputedStyle(pill);
      return {
        visible: box.width > 0 && box.height > 0 && styles.visibility !== "hidden",
        label: pill.getAttribute("aria-label") || "",
        hasRing: Boolean(pill.querySelector(".eg-ring-fg")),
        inViewport: box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1,
        onScreen: box.top >= -1 && box.left >= -1,
      };
    });
    pass(Boolean(shown?.visible), `${pagePath}: الشارة ظاهرة`);
    pass(Boolean(shown?.onScreen && shown?.inViewport), `${pagePath}: الشارة داخل الشاشة`);
    pass(Boolean(shown?.hasRing), `${pagePath}: حلقة التقدّم مرسومة`);
    pass(/تقدّمك اليوم/.test(shown?.label || ""), `${pagePath}: الشارة لها اسم لقارئ الشاشة`);
    pass(errors.length === 0, `${pagePath}: بلا أخطاء طرفية${errors.length ? ` — ${errors[0]}` : ""}`);
    await context.close();
  }
}

/* --------------------------------- 2) بطاقة تحدّي اليوم في الفهرس ------- */
console.log("=== 2) بطاقة تحدّي اليوم في الصفحة الرئيسية ===");
{
  const context = await browser.newContext();
  const { tab, errors } = await open(context, "/index.html");
  const card = await tab.evaluate(() => {
    const host = document.getElementById("engageRoot");
    const node = document.querySelector(".eg-card");
    if (!host || !node) return null;
    return {
      insideMount: host.contains(node),
      title: node.querySelector(".eg-card-title")?.textContent || "",
      challenge: node.querySelector(".eg-challenge")?.className || "",
      goal: node.querySelector(".eg-ch-go")?.getAttribute("href") || "",
      stats: [...node.querySelectorAll(".eg-stat b")].map((n) => n.textContent),
      arabic: /[٠-٩]/.test(node.textContent),
    };
  });
  pass(Boolean(card?.insideMount), "البطاقة مبنيّة داخل موضعها #engageRoot");
  pass(/تحدّي اليوم/.test(card?.title || ""), "البطاقة تحمل عنوانها");
  pass(/eg-challenge/.test(card?.challenge || ""), "فيها سطر التحدّي");
  const href = (card?.goal || "").replace(/^https?:\/\/[^/]+/, "");
  pass(Boolean(href) && fs.existsSync(path.join(ROOT, decodeURIComponent(href.split("#")[0]))),
    `وجهة التحدّي موجودة: ${href || "لا شيء"}`);
  pass((card?.stats || []).length === 3, "فيها ثلاثة أرقام: نقاط وأيام وأوسمة");
  pass(Boolean(card?.arabic), "الأرقام معروضة بالعربية");
  pass(errors.length === 0, `بلا أخطاء طرفية${errors.length ? ` — ${errors[0]}` : ""}`);
  await context.close();
}

/* --------------------------------- 3) لوحة الأوسمة تُفتح وتُغلق -------- */
console.log("=== 3) لوحة الأوسمة ===");
{
  const context = await browser.newContext();
  const { tab, errors } = await open(context, "/index.html");
  await dismissTour(tab);
  await tab.locator(".eg-pill").click();
  await tab.waitForTimeout(250);
  const opened = await tab.evaluate(() => {
    const dialog = document.getElementById("egPanel");
    if (!dialog) return null;
    return {
      isDialog: dialog.tagName === "DIALOG",
      open: dialog.open,
      badges: dialog.querySelectorAll(".eg-badge").length,
      locked: dialog.querySelectorAll('.eg-badge:not(.open)').length,
      stats: [...dialog.querySelectorAll(".eg-stat b")].map((n) => n.textContent),
      challenge: Boolean(dialog.querySelector(".eg-challenge")),
      log: Boolean(dialog.querySelector(".eg-log") || dialog.querySelector(".eg-empty")),
      mute: Boolean(dialog.querySelector('[data-eg="mute"]')),
      reset: Boolean(dialog.querySelector('[data-eg="reset"]')),
    };
  });
  pass(Boolean(opened?.isDialog && opened?.open), "اللوحة تفتح كـ`dialog` حقيقي");
  pass((opened?.badges || 0) >= 12, `شبكة الأوسمة فيها ${opened?.badges || 0} وسامًا`);
  pass((opened?.locked || 0) > 0, "الأوسمة المقفولة معروضة كمقفولة");
  pass(Boolean(opened?.challenge && opened?.log), "فيها سطر التحدّي وسجلّ اليوم");
  pass(Boolean(opened?.mute && opened?.reset), "فيها زرّا الكتم والتصفير");
  pass(errors.length === 0, `بلا أخطاء طرفية${errors.length ? ` — ${errors[0]}` : ""}`);
  await context.close();
}

/* --------------------------------- 4) كتم النغمة يعمل ويُحفَظ ---------- */
console.log("=== 4) كتم النغمة ===");
{
  const context = await browser.newContext();
  const { tab, errors } = await open(context, "/index.html");
  await dismissTour(tab);
  await tab.locator(".eg-pill").click();
  await tab.waitForTimeout(200);
  const label = () => tab.evaluate(() =>
    document.querySelector('[data-eg="mute"] span')?.textContent || "");
  const before = await label();
  await tab.locator('[data-eg="mute"]').click();
  await tab.waitForTimeout(120);
  const after = await label();
  const stored = await tab.evaluate(() => JSON.parse(localStorage.getItem("engage-v1") || "{}").muted);
  pass(before !== after, `نصّ الزر يتغيّر: «${before}» ← «${after}»`);
  pass(stored === true, "الكتم محفوظ في التخزين");
  await tab.reload({ waitUntil: "load" });
  await tab.waitForTimeout(400);
  await dismissTour(tab);
  await tab.locator(".eg-pill").click();
  await tab.waitForTimeout(200);
  pass((await label()) === after, "الكتم يبقى بعد إعادة التحميل");
  pass(errors.length === 0, `بلا أخطاء طرفية${errors.length ? ` — ${errors[0]}` : ""}`);
  await context.close();
}

/* --------------------------------- 5) تعليم القراءة في صفحة نصّية -------- */
console.log("=== 5) الصفحات النصّية: بحث وتعليم ما قُرئ ===");
{
  const context = await browser.newContext();
  const { tab, errors } = await open(context, "/12-mustajab.html");
  const bar = await tab.evaluate(() => {
    const node = document.querySelector(".eg-readbar");
    if (!node) return null;
    return {
      items: document.querySelectorAll(".eg-item").length,
      marks: document.querySelectorAll(".eg-mark").length,
      search: Boolean(node.querySelector(".eg-readsearch")),
      count: node.querySelector(".eg-readcount")?.textContent || "",
      all: Boolean(node.querySelector(".eg-readall")),
      firstAfterBar: node.nextElementSibling?.querySelector(".eg-item") ? true : false,
      marksInside: [...document.querySelectorAll(".eg-item")].every(
        (item) => item.querySelector(":scope > .eg-mark"),
      ),
    };
  });
  pass((bar?.items || 0) >= 8, `وُجد ${bar?.items || 0} عنصرًا قابلًا للتعليم`);
  pass(bar?.items === bar?.marks, "لكل عنصر علامة واحدة");
  pass(Boolean(bar?.search && bar?.all), "فيها بحث وزرّ تعليم الكل");
  pass(/٠|1|٢/.test(bar?.count || ""), `العدّاد يعرض العدد: «${bar?.count}»`);
  pass(Boolean(bar?.marksInside), "العلامة داخل العنصر لا شقيقةً له");
  pass(Boolean(bar?.firstAfterBar), "شريط البحث فوق القائمة لا تحتها");

  // تعليم عنصرين يرفع النقاط ويسجّلهما.
  const before = await tab.evaluate(() => window.Engagement.state().points);
  await tab.locator(".eg-mark").first().click();
  await tab.waitForTimeout(120);
  await tab.locator(".eg-mark").nth(1).click();
  await tab.waitForTimeout(250);
  const after = await tab.evaluate(() => ({
    points: window.Engagement.state().points,
    pressed: document.querySelectorAll('.eg-mark[aria-pressed="true"]').length,
    read: (JSON.parse(localStorage.getItem("engage-v1") || "{}").read || {})["12-mustajab.html"] || [],
    kinds: window.Engagement.state().kinds,
  }));
  pass(after.points > before, `النقاط ارتفعت من ${before} إلى ${after.points}`);
  pass(after.pressed === 2, "علامتان صارتا مضغوطتين");
  pass(after.read.length === 2, "العنصران محفوظان باسم الصفحة");
  pass((after.kinds.study || 0) >= 2, "العمل مسجَّل بنوعه");

  // ويلتحم الحفظ: بعد التحميل تظلّ العلامات مضغوطة.
  await tab.reload({ waitUntil: "load" });
  await tab.waitForTimeout(300);
  const persisted = await tab.evaluate(() => ({
    pressed: document.querySelectorAll('.eg-mark[aria-pressed="true"]').length,
    count: document.querySelector(".eg-readcount")?.textContent || "",
  }));
  pass(persisted.pressed === 2, "العلامات محفوظة بعد إعادة التحميل");
  pass(/٢/.test(persisted.count), `العدّاد يعرض ما قُرئ: «${persisted.count}»`);

  // البحث يُصفّي فعلًا.
  await tab.locator(".eg-readsearch").fill("الجمعة");
  await tab.waitForTimeout(200);
  const filtered = await tab.evaluate(() => ({
    hidden: [...document.querySelectorAll(".eg-item")].filter((n) => n.hidden).length,
    shown: [...document.querySelectorAll(".eg-item")].filter((n) => !n.hidden).length,
    count: document.querySelector(".eg-readcount")?.textContent || "",
  }));
  pass(filtered.hidden > 0 && filtered.shown > 0,
    `البحث يُخفي ${filtered.hidden} ويُبقي ${filtered.shown}`);
  pass(/نتيجة/.test(filtered.count), `العدّاد يتحوّل إلى عدّ نتائج: «${filtered.count}»`);
  pass(errors.length === 0, `بلا أخطاء طرفية${errors.length ? ` — ${errors[0]}` : ""}`);
  await context.close();
}

/* --------------------------------- 6) قصاصات احتفال --------------------- */
console.log("=== 6) احتفال فتح وسام ===");
{
  const context = await browser.newContext();
  const { tab, errors } = await open(context, "/12-mustajab.html");
  await tab.evaluate(() => window.Engagement.confetti());
  const during = await tab.evaluate(() => Boolean(document.querySelector(".eg-confetti")));
  pass(during, "القصاصات تظهر");
  await tab.waitForTimeout(2200);
  const after = await tab.evaluate(() => Boolean(document.querySelector(".eg-confetti")));
  pass(!after, "وتنظّف نفسها بعد انتهائها");
  // فتح وسام يُظهر التنبيه. نُسجّل عملًا يفتح «الخطوة الأولى» وأوسمة.
  await tab.evaluate(() => window.Engagement.record("adhkar", 60));
  await tab.waitForTimeout(200);
  const toast = await tab.evaluate(() => {
    const node = document.getElementById("egToast");
    return node ? { shown: node.classList.contains("show"), text: node.textContent } : null;
  });
  pass(Boolean(toast?.shown), `التنبيه يظهر: «${toast?.text || ""}»`);
  pass(/وسام/.test(toast?.text || ""), "ويسمّي ما فُتح");
  pass(errors.length === 0, `بلا أخطاء طرفية${errors.length ? ` — ${errors[0]}` : ""}`);
  await context.close();
}

/* --------------------------------- 7) التصفّح المحمول ------------------- */
console.log("=== 7) التلفّات الضيّقة ===");
{
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    const context = await browser.newContext({ viewport });
    const { tab } = await open(context, "/12-mustajab.html");
    const layout = await tab.evaluate(() => {
      const pill = document.querySelector(".eg-pill")?.getBoundingClientRect();
      const back = document.querySelector(".back-link")?.getBoundingClientRect();
      const theme = document.querySelector("#themeToggle")?.getBoundingClientRect();
      const overlaps = (a, b) => a && b &&
        a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      return {
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        pillOverlaps: overlaps(pill, back) || overlaps(pill, theme),
        readbarSticky: getComputedStyle(document.querySelector(".eg-readbar")).position,
        readbarVisible: (() => {
          const bar = document.querySelector(".eg-readbar").getBoundingClientRect();
          return bar.width > 0 && bar.top >= -1;
        })(),
      };
    });
    pass(layout.overflowX <= 1, `${viewport.width}px: بلا تمرير أفقي (${layout.overflowX})`);
    pass(!layout.pillOverlaps, `${viewport.width}px: الشارة لا تركب زرَّي الصفحة`);
    pass(layout.readbarSticky === "sticky", `${viewport.width}px: شريط البحث لاصق`);
    pass(Boolean(layout.readbarVisible), `${viewport.width}px: شريط البحث ظاهر`);
    await context.close();
  }
}

/* --------------------------------- 8) الوضع الليلي --------------------- */
console.log("=== 8) الطبقة تتبع الوضع الليلي ===");
{
  const context = await browser.newContext({ colorScheme: "dark" });
  const { tab } = await open(context, "/12-mustajab.html");
  const themed = await tab.evaluate(() => {
    const pill = document.querySelector(".eg-pill");
    const styles = getComputedStyle(pill);
    return { bg: styles.backgroundColor, color: styles.color };
  });
  pass(themed.bg !== "rgba(0, 0, 0, 0)", "للشارة خلفيةٌ في الوضع الليلي");
  pass(themed.color !== themed.bg, "ونصّها مفقود عنها");
  await context.close();
}

/* --------------------------------- 9) الأدوات لا تُكسر ------------------ */
console.log("=== 9) حصاد تقدّم الأدوات القائمة ===");
{
  const context = await browser.newContext();
  const { tab, errors } = await open(context, "/17-wird.html");
  const harvested = await tab.evaluate(async () => {
    localStorage.setItem("mushaf-progress", JSON.stringify({ 1: true, 2: true, 3: true }));
    window.Engagement.refresh();
    const state = window.Engagement.state();
    return { points: state.points, surah: state.totals.surah, badges: state.badges };
  });
  pass(harvested.surah === 3, `حصاد أداة الحفظ: ${harvested.surah} سورة`);
  pass(harvested.points >= 30, `نقاطه ${harvested.points}`);
  pass(harvested.badges.includes("surah-1"), "فتح وسام «أول سورة» بلا فتح يدوي");
  // الأداة نفسها لا تزال تعمل: الورد يكتب في مفتاحه.
  await tab.evaluate(() => {
    document.querySelectorAll("button").forEach((b) => { if (/\\+|زائد|إضافة/.test(b.textContent)) b.click(); });
  });
  await tab.waitForTimeout(200);
  pass(errors.length === 0, `بلا أخطاء طرفية${errors.length ? ` — ${errors[0]}` : ""}`);
  await context.close();
}

await browser.close();
server.close();
console.log(`\n${failures === 0 ? "✔ كل فحوص طبقة التفاعل نجحت" : `✘ ${failures} مشكلة`}`);
process.exit(failures === 0 ? 0 : 1);
