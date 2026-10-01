"use strict";

/**
 * فحص تفاعلي في المتصفح: التثبيت، الإشعارات، تخزين المصحف، ولوحة المفاتيح.
 * التشغيل:  node scripts/interaction-check.mjs
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

/* ------------------------------ بيان التثبيت ------------------------------ */
console.log("=== بيان التطبيق (manifest) ===");
{
  const context = await browser.newContext();
  const tab = await context.newPage();
  await tab.goto(`${base}/src/app/app.html`, { waitUntil: "load" });

  const manifest = await tab.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    const response = await fetch(href);
    const json = await response.json();
    return { name: json.name, icons: json.icons.length, display: json.display, start: json.start_url };
  });
  console.log(`  الاسم: ${manifest.name} | أيقونات: ${manifest.icons} | العرض: ${manifest.display}`);
  pass(manifest.icons >= 5, "البيان يحمل مجموعة أيقونات كاملة");
  pass(manifest.display === "standalone", "وضع standalone مضبوط");

  // كل أيقونة تُحمَّل فعليًا دون خطأ
  const iconStatus = await tab.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    const json = await (await fetch(href)).json();
    const results = await Promise.all(
      json.icons.map(async (icon) => {
        const url = new URL(icon.src, href).href;
        const response = await fetch(url);
        return { src: icon.src, ok: response.ok, type: response.headers.get("content-type") };
      }),
    );
    return results;
  });
  for (const icon of iconStatus) {
    // كل أيقونة PNG يجب أن تُخدَّم كـ image/png، والأيقونة المتجهة كـ svg
    const expected = icon.src.endsWith(".svg") ? "image/svg+xml" : "image/png";
    pass(icon.ok && icon.type === expected, `${icon.src} تُحمَّل (${icon.type})`);
  }
  await context.close();
}

/* ------------------------------ التخزين بدون إنترنت ------------------------------ */
console.log("\n=== تخزين سور المصحف في IndexedDB ===");
{
  const context = await browser.newContext();
  const tab = await context.newPage();

  // نخزّن سورة عبر واجهة IndexedDB مباشرة ثم نتحقق من العرض بدون إنترنت
  await tab.goto(`${base}/src/app/app.html#tab/quran`, { waitUntil: "load" });
  await tab.waitForTimeout(1200);

  const stored = await tab.evaluate(async () => {
    const request = indexedDB.open("noor_db", 1);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!db.objectStoreNames.contains("surahs")) return { ok: false, reason: "no store" };
    const tx = db.transaction("surahs", "readwrite");
    tx.objectStore("surahs").put({
      number: 112,
      name: "الإخلاص",
      numberOfAyahs: 4,
      ayahs: [
        { numberInSurah: 1, text: "قُلْ هُوَ اللَّهُ أَحَدٌ" },
        { numberInSurah: 2, text: "اللَّهُ الصَّمَدُ" },
        { numberInSurah: 3, text: "لَمْ يَلِدْ وَلَمْ يُولَدْ" },
        { numberInSurah: 4, text: "وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ" },
      ],
      cachedAt: Date.now(),
    });
    await new Promise((resolve) => { tx.oncomplete = resolve; });
    const count = await new Promise((resolve) => {
      const r = db.transaction("surahs", "readonly").objectStore("surahs").count();
      r.onsuccess = () => resolve(r.result);
    });
    return { ok: true, count };
  });
  pass(stored.ok && stored.count === 1, `السورة خُزِّنت في IndexedDB (${stored.count} سجل)`);

  // الآن اقطع الشبكة وافتح السورة ١١٢
  await context.setOffline(true);
  await tab.goto(`${base}/src/app/app.html#tab/quran`, { waitUntil: "load" }).catch(() => {});
  await tab.waitForTimeout(1500);
  await tab.evaluate(() => {
    document.querySelector('[data-surah="112"]')?.click();
  });
  await tab.waitForTimeout(1500);

  const offlineText = await tab.evaluate(() => document.getElementById("quranBody")?.innerText ?? "");
  pass(
    offlineText.includes("الصَّمَد"),
    `السورة المخزّنة تُقرأ بدون إنترنت (${offlineText.trim().slice(0, 30)}…)`,
  );
  await context.close();
}

/* ------------------------------ التثبيت والإشعارات ------------------------------ */
console.log("\n=== زر التثبيت وإرسال الإشعارات ===");
{
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const tab = await context.newPage();
  await tab.goto(`${base}/src/app/app.html`, { waitUntil: "load" });
  await tab.waitForTimeout(1200);

  // نُطلق حدث التثبيت يدويًا (المتصفّح لا يطلقه تلقائيًا في الوضع المقطوع)
  await tab.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    event.prompt = () => {
      window.__prompted = true;
      return Promise.resolve();
    };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await tab.waitForTimeout(300);

  const installVisible = await tab.evaluate(() => {
    const button = document.getElementById("installBtn");
    return Boolean(button) && !button.hidden;
  });
  pass(installVisible, "زر التثبيت يظهر عند إطلاق beforeinstallprompt");

  await tab.click("#installBtn");
  await tab.waitForTimeout(400);
  const prompted = await tab.evaluate(() => window.__prompted === true);
  pass(prompted, "الضغط على الزر يستدعي نافذة التثبيت");

  // الإشعار يصل عبر عامل الخدمة
  const messageReached = await tab.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) return "no-controller";
    navigator.serviceWorker.controller.postMessage({
      type: "notify",
      title: "🕌 اختبار",
      body: "حي على الصلاة",
      tag: "test",
    });
    return "sent";
  });
  pass(messageReached === "sent", `رسالة الإشعار أُرسلت إلى عامل الخدمة (${messageReached})`);
  await context.close();
}

/* ------------------------------ النافذة والتركيز ------------------------------ */
console.log("\n=== النافذة المنبثقة وإدارة التركيز ===");
{
  const context = await browser.newContext();
  const tab = await context.newPage();
  await tab.goto(`${base}/src/app/app.html`, { waitUntil: "load" });
  await tab.waitForTimeout(1000);

  await tab.click("#settingsBtn");
  await tab.waitForTimeout(400);
  const opened = await tab.evaluate(() => !document.getElementById("settingsModal")?.hidden);
  pass(opened, "نافذة الإعدادات تُفتح");

  const focusedInside = await tab.evaluate(() =>
    document.getElementById("settingsModal")?.contains(document.activeElement) ?? false,
  );
  pass(focusedInside, "التركيز ينتقل إلى داخل النافذة");

  await tab.keyboard.press("Escape");
  await tab.waitForTimeout(300);
  const closed = await tab.evaluate(() => document.getElementById("settingsModal")?.hidden);
  pass(closed, "Escape يغلق النافذة");

  const restored = await tab.evaluate(() => document.activeElement?.id);
  pass(restored === "settingsBtn", `التركيز يعود إلى الزر (${restored})`);
  await context.close();
}

/* ------------------------------ التنقّل بالتبويبات ------------------------------ */
console.log("\n=== تبويبات التطبيق ===");
{
  const context = await browser.newContext();
  const tab = await context.newPage();
  const errors = [];
  tab.on("pageerror", (error) => errors.push(error.message));
  await tab.goto(`${base}/src/app/app.html`, { waitUntil: "load" });
  await tab.waitForTimeout(1000);

  const tabs = await tab.evaluate(() =>
    [...document.querySelectorAll("[data-tab]")].map((node) => node.getAttribute("data-tab")),
  );
  console.log(`  عدد التبويبات: ${tabs.length}`);

  for (const id of tabs) {
    await tab.click(`[data-tab="${id}"]`);
    await tab.waitForTimeout(350);
    const chars = await tab.evaluate(
      () => (document.getElementById("tabPanel")?.innerText ?? "").trim().length,
    );
    if (chars < 40) pass(false, `تبويب ${id} فارغ (${chars} محرف)`);
  }
  pass(errors.length === 0, `تصفّح كل التبويبات بلا أخطاء${errors.length ? ": " + errors.join(" | ") : ""}`);
  await context.close();
}

console.log("\n=== ورقة المراجعة العلمية ===");
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/src/site/review.html`, { waitUntil: "load" });
  await page.waitForTimeout(800);

  // نحسب المتوقَّع من البيانات نفسها حتى لا يتكسّر الفحص عند إضافة مجموعة
  const { ATTRIBUTED, entriesOf } = await import("../src/lib/review.js");
  const modules = {
    APP_DUAS: (await import("../src/data/app-duas.js")).APP_DUAS,
    HADITHS: (await import("../src/data/hadiths.js")).HADITHS,
    ATHKAR_DATA: (await import("../src/data/app-athkar.js")).ATHKAR_DATA,
    SEERAH: (await import("../src/data/seerah.js")).SEERAH,
    PROPHETS: (await import("../src/data/prophets.js")).PROPHETS,
    SAYINGS: (await import("../src/data/sayings.js")).SAYINGS,
    EXTRA_LESSONS: (await import("../src/data/lessons-extra.js")).EXTRA_LESSONS,
    FORBIDDEN_PRAYER_TIMES: (await import("../src/data/forbidden-times.js")).FORBIDDEN_PRAYER_TIMES,
  };
  const expected = ATTRIBUTED.reduce((sum, g) => sum + entriesOf(g, modules).length, 0);

  const all = await page.locator(".entry").count();
  pass(all === expected, `عرض كل النصوص (${all} من ${expected} متوقَّعة)`);

  const groups = await page.locator(".grp").count();
  pass(groups === ATTRIBUTED.length, `عدد المجموعات ${groups} من ${ATTRIBUTED.length}`);

  // تصفية الحالة
  await page.selectOption("#filter", "بلا تخريج");
  await page.waitForTimeout(300);
  const missing = await page.locator(".entry").count();
  pass(missing > 0 && missing < all, `تصفية «بلا تخريج» تعطي ${missing} عنصرًا`);

  // البحث
  await page.selectOption("#filter", "all");
  await page.fill("#q", "استغفر");
  await page.waitForTimeout(300);
  const found = await page.locator(".entry").count();
  pass(found > 0 && found < all, `البحث عن «استغفر» يعطي ${found} عنصرًا`);

  // الحماية من الحقن — المحتوى يأتي من ملفات البيانات
  const injected = await page.evaluate(() =>
    [...document.querySelectorAll(".entry .x")].filter((node) => node.querySelector("*")).length,
  );
  pass(injected === 0, "نصوص المراجعة بلا وسوم محقونة");

  pass(errors.length === 0, `الورقة بلا أخطاء${errors.length ? ": " + errors.join(" | ") : ""}`);
  await context.close();
}

console.log("\n=== دروس الآداب المضافة ===");
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/src/site/noor.html`, { waitUntil: "load" });
  await page.waitForTimeout(1000);

  const ids = ["host", "dress", "janazah", "offspring", "visit"];
  for (const id of ids) {
    const card = page.locator(`[data-open="lesson"][data-id="${id}"]`);
    pass((await card.count()) === 1, `بطاقة الدرس ${id} معروضة`);
    await card.first().click();
    await page.waitForTimeout(500);
    const text = await page.evaluate(() => document.querySelector("#modalBody, .modal-body, .modal")?.innerText ?? "");
    pass(text.length > 200, `الدرس ${id} يفتح بمحتوى (${text.length} محرف)`);
    pass(text.includes("\uFD3F"), `الدرس ${id} يعرض آية قرآنية`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  // الروابط المعلّقة التي كانت في المصدر صارت موجودة
  const broken = await page.evaluate(() => {
    const ids = ["host", "visit"];
    return ids.filter((x) => !document.querySelector(`[data-open="lesson"][data-id="${x}"]`));
  });
  pass(broken.length === 0, `الروابط القديمة صارت موجودة${broken.length ? ": " + broken.join(",") : ""}`);

  pass(errors.length === 0, `الدروس بلا أخطاء${errors.length ? ": " + errors.join(" | ") : ""}`);
  await context.close();
}

console.log("\n=== مدخلات التخزين المحلي غير الموثوقة ===");
async function checkStoredText(pagePath, key, value, openTarget) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => { window.__backupXss = false; });
  await page.goto(`${base}${pagePath}`, { waitUntil: "load" });
  await page.evaluate(([storageKey, storageValue]) => {
    localStorage.setItem(storageKey, JSON.stringify(storageValue));
  }, [key, value]);
  await page.reload({ waitUntil: "load" });
  if (openTarget) await openTarget(page);
  await page.waitForTimeout(250);
  const injected = await page.evaluate(() =>
    Boolean(window.__backupXss || document.getElementById("backup-xss-probe")),
  );
  pass(!injected, `${pagePath}: النص المحفوظ لا يُنفَّذ كـHTML`);
  await context.close();
}

const storedPayload = '<img id="backup-xss-probe" src="/missing" onerror="window.__backupXss=true">';
await checkStoredText("/7-ramadan.html", "ramadan-eidlist", [{ t: storedPayload, d: false }]);
await checkStoredText("/16-tadabbur.html", "tadabbur-entries", [{
  id: "entry-1",
  surah: storedPayload,
  ayah: "",
  note: storedPayload,
  ts: Date.now(),
}]);
await checkStoredText("/18-qada.html", "qada-owed", [{ reason: storedPayload, count: 1, ts: Date.now() }]);
await checkStoredText("/30-quran-full.html", "quran-notes", { "1:1": `</textarea>${storedPayload}` }, async (page) => {
  await page.locator(".gcard").first().click();
  await page.locator("textarea.noteArea").first().waitFor({ state: "attached" });
});

await browser.close();
server.close();
console.log(`\n${failures === 0 ? "✔ كل الفحوص التفاعلية نجحت" : `✘ ${failures} مشكلة`}`);
process.exit(failures === 0 ? 0 : 1);