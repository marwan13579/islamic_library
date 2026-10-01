"use strict";

/**
 * فحص زمن التشغيل في متصفح حقيقي (Chromium).
 * يشغّل خادمًا محليًا، يفتح الصفحات، ويرصد أخطاء الـ console والصفحات.
 * التشغيل:  node scripts/browser-check.mjs
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
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

/** @type {{ url: string, name: string, main?: string }[]} */
const PINNED = [
  { url: "/index.html", name: "الفهرس", main: "#mainContent" },
  { url: "/src/site/noor.html", name: "موقع نور الهدى" },
  { url: "/src/site/review.html", name: "ورقة المراجعة العلمية", main: ".sheet" },
  { url: "/src/app/app.html", name: "بوابة النور" },
  { url: "/offline.html", name: "صفحة عدم الاتصال" },
];

/** مجلدات لا صفحات فيها. */
const SKIP_DIR = /node_modules|^\.git|^tests$|^scripts$|^vendor$|^dist$|^\.kilo/;

/**
 * يكتشف كل صفحات HTML في المشروع تلقائيًا.
 *
 * كان الفحص محصورًا في خمس صفحات مكتوبة يدويًا، فمرّ خطأٌ نحويّ في إحدى
 * أدوات المشروع unnoticedَ. الاكتشاف يضمن ألّا تُنسى صفحة.
 *
 * @returns {{ url: string, name: string, main?: string }[]}
 */
function discoverPages() {
  const pinnedByUrl = new Map(PINNED.map((p) => [p.url, p]));
  const found = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      const rel = path.relative(ROOT, absolute);
      if (entry.isDirectory()) {
        if (SKIP_DIR.test(rel)) continue;
        walk(absolute);
        continue;
      }
      if (!entry.name.endsWith(".html")) continue;
      const url = "/" + rel.split(path.sep).join("/");
      found.set(url, pinnedByUrl.get(url) ?? { url, name: entry.name });
    }
  };
  walk(ROOT);
  const rest = [...found.values()].filter((p) => !PINNED.includes(p));
  return [...PINNED.filter((p) => found.has(p.url)), ...rest.sort((a, b) => a.url.localeCompare(b.url))];
}

const PAGES = discoverPages();

/** أخطاء نتجت عن شبكات خارجية قد لا تتوفّر في بيئة الاختبار. */
const EXTERNAL = /fonts\.(googleapis|gstatic)\.com|api\.aladhan|api\.alquran\.cloud|cdn\.islamic|qurango|api\.quran\.com|bigdatacloud/;

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

let failures = 0;

for (const page of PAGES) {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  const tab = await context.newPage();
  const problems = [];

  tab.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (EXTERNAL.test(text)) return;
    problems.push(`console: ${text}`);
  });
  tab.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  tab.on("requestfailed", (request) => {
    const url = request.url();
    if (EXTERNAL.test(url)) return;
    problems.push(`request failed: ${url} — ${request.failure()?.errorText}`);
  });

  await tab.goto(base + page.url, { waitUntil: "networkidle", timeout: 30000 }).catch((error) => {
    problems.push(`goto: ${error.message}`);
  });
  await tab.waitForTimeout(900);

  const facts = await tab.evaluate(() => ({
    title: document.title,
    h1: document.querySelectorAll("h1").length,
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    // حروف عربية مشوّهة أو نص خارج العربية/الإنجليزية
    replacement: (document.body.innerText.match(/�/g) || []).length,
    /**
     * emptiness بالمعنى المحسوس لا بالمعنى النحوي:
     * `innerText` يتجاهل المخفيّ، فالصفحة التي كل محتواها في `<details>`
     * مطويّة تبدو فارغة وهي ممتلئة. فلا نُحكم بالفراغ إلا إذا خلا
     * `textContent` أيضًا — وهو لا يتجاهل شيئًا.
     */
    /**
     * الفراغ يُقاس على `<main>` إن وُجد، وإلا فعلى حاوية المحتوى المعتادة
     * في صفحات الأدوات، وإلا فعلى `body`. فكثيرٌ منها بلا وسم main أصلًا،
     * وحكمُها فارغٌ لأنما فُحصت عناوين لا صفحات.
     */
    emptyMain: (() => {
      const host =
        document.querySelector("main") ??
        document.querySelector(".wrap") ??
        document.body;
      return Math.max(
        (host.innerText ?? "").trim().length,
        (host.textContent ?? "").replace(/\s+/g, "").length,
      );
    })(),
    unnamedControls: [...document.querySelectorAll(
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]',
    )].filter((element) => {
      const style = getComputedStyle(element);
      if (element.hidden || style.display === "none" || style.visibility === "hidden" || !element.getClientRects().length) {
        return false;
      }
      const labelledBy = element.getAttribute("aria-labelledby")
        ?.split(/\s+/)
        .some((id) => document.getElementById(id)?.textContent.trim());
      const ownText =
        element.innerText?.trim() ||
        element.textContent?.trim() ||
        element.value?.trim() ||
        element.getAttribute("alt")?.trim() ||
        "";
      const svgTitle = element.querySelector("svg title")?.textContent.trim();
      const isFormField = /^(INPUT|SELECT|TEXTAREA)$/.test(element.tagName);
      if (isFormField) {
        return !(
          element.getAttribute("aria-label")?.trim() ||
          labelledBy ||
          element.title?.trim() ||
          element.labels?.length
        );
      }
      return !(
        element.getAttribute("aria-label")?.trim() ||
        labelledBy ||
        element.title?.trim() ||
        element.labels?.length ||
        ownText.trim() ||
        svgTitle
      );
    }).map((element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}`),
    imagesWithoutAlt: document.querySelectorAll("img:not([alt])").length,
    performance: (() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const firstPaint = performance.getEntriesByName("first-contentful-paint")[0];
      const sameOriginBytes = performance
        .getEntriesByType("resource")
        .filter((entry) => new URL(entry.name).origin === location.origin)
        .reduce((total, entry) => total + entry.transferSize, 0);
      return {
        fcp: Math.round(firstPaint?.startTime ?? 0),
        domReady: Math.round(navigation?.domContentLoadedEventEnd ?? 0),
        load: Math.round(navigation?.loadEventEnd ?? 0),
        bytes: sameOriginBytes,
      };
    })(),
  })).catch(() => ({}));

  await tab.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await tab
    .evaluate(() => {
      const width = document.documentElement.clientWidth;
      const elements = [...document.body.querySelectorAll("*")]
        .filter((element) => {
          const style = getComputedStyle(element);
          return (
            element.clientWidth > 0 &&
            element.scrollWidth > element.clientWidth + 1 &&
            !["auto", "scroll", "hidden", "clip"].includes(style.overflowX)
          );
        })
        .slice(0, 5)
        .map((element) => {
          const classes = [...element.classList].join(".");
          const selector = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${classes ? `.${classes}` : ""}`;
          return `${selector} (${element.scrollWidth}/${element.clientWidth}px)`;
        });
      return {
        hasOverflow: document.documentElement.scrollWidth > width,
        elements,
      };
    })
    .catch(() => false);

  const checks = [];
  if (!facts.title) problems.push("الصفحة بلا <title>");
  if (facts.dir !== "rtl") problems.push(`dir=${facts.dir} بدل rtl`);
  if (!facts.lang) problems.push("lang غير معيّن");
  if (facts.replacement > 0) problems.push(`${facts.replacement} محرفًا تالفًا (�)`);
  if (facts.emptyMain === 0) problems.push("<main> فارغ — لم يُصيَّر المحتوى");
  if (facts.unnamedControls?.length) {
    problems.push(`عناصر تفاعل بلا اسم: ${facts.unnamedControls.join("، ")}`);
  }
  if (facts.imagesWithoutAlt) problems.push(`${facts.imagesWithoutAlt} صورة بلا سمة alt`);
  if (mobileOverflow?.hasOverflow) {
    problems.push(`تمرير أفقي على عرض الهاتف: ${mobileOverflow.elements.join("، ")}`);
  }

  console.log(`\n=== ${page.name} (${page.url}) ===`);
  console.log(`  العنوان: ${facts.title}`);
  console.log(
    `  h1: ${facts.h1} | main: ${facts.emptyMain} محرف | تالف: ${facts.replacement} | ` +
      `بدون اسم: ${facts.unnamedControls?.length ?? 0} | صور بلا alt: ${facts.imagesWithoutAlt ?? 0} | ` +
      `تمرير أفقي: ${mobileOverflow?.hasOverflow ? "نعم" : "لا"}`,
  );
  console.log(
    `  الأداء: FCP ${facts.performance?.fcp ?? 0}ms | DOM ${facts.performance?.domReady ?? 0}ms | ` +
      `تحميل ${facts.performance?.load ?? 0}ms | أصول محلية ${Math.round((facts.performance?.bytes ?? 0) / 1024)}KB`,
  );
  if (problems.length) {
    failures += problems.length;
    for (const problem of problems) console.log(`  ✘ ${problem}`);
  } else {
    console.log("  ✔ بلا أخطاء");
  }

  await context.close();
}

/* --------------------- فحص عامل الخدمة والعمل بدون إنترنت --------------------- */

console.log("\n=== عامل الخدمة ووضع عدم الاتصال ===");
const context = await browser.newContext({ serviceWorkers: "allow" });
const tab = await context.newPage();
await tab.goto(`${base}/index.html`, { waitUntil: "load" });

// ننتظر تسجيل عامل الخدمة وتثبيته
const swState = await tab.evaluate(async () => {
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return null;
  for (let i = 0; i < 40; i += 1) {
    if (navigator.serviceWorker.controller) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return { scope: registration.scope, controlled: Boolean(navigator.serviceWorker.controller) };
}).catch((error) => ({ error: error.message }));

// ننتظر اكتمال تخزين ملفات القشرة قبل قطع الشبكة
await tab.waitForTimeout(2500);

if (!swState || swState.error) {
  console.log(`  ✘ لم يُسجَّل عامل الخدمة: ${swState?.error ?? "غير متاح"}`);
  failures += 1;
} else {
  console.log(`  النطاق: ${swState.scope}`);
  console.log(`  ${swState.controlled ? "✔" : "✘"} الصفحة تحت سيطرة عامل الخدمة`);
  if (!swState.controlled) failures += 1;
}

// نقطع الشبكة ونفتح الصفحة الرئيسية
await context.setOffline(true);
const offlineErrors = [];
tab.on("pageerror", (error) => offlineErrors.push(error.message));

for (const url of ["/index.html", "/src/site/noor.html", "/src/app/app.html"]) {
  const response = await tab.goto(base + url, { waitUntil: "load" }).catch((error) => {
    offlineErrors.push(`${url}: ${error.message}`);
    return null;
  });
  // وحدات ES تُنفَّذ بعد تحميل الصفحة، فننتظر استقرار التصيير
  await tab.waitForTimeout(1200);
  const rendered = await tab
    .evaluate(() => (document.querySelector("main")?.innerText ?? "").trim().length)
    .catch(() => 0);
  const ok = Boolean(response) && rendered > 200;
  console.log(`  ${ok ? "✔" : "✘"} ${url} بدون إنترنت — ${rendered} محرف`);
  if (!ok) failures += 1;
}

if (offlineErrors.length) {
  console.log(`  ✘ أخطاء أثناء العمل بدون إنترنت:\n     ${offlineErrors.join("\n     ")}`);
  failures += offlineErrors.length;
}

await context.close();
await browser.close();
server.close();

console.log(`\n${failures === 0 ? "✔ كل الفحوص نجحت" : `✘ ${failures} مشكلة`}`);
process.exit(failures === 0 ? 0 : 1);