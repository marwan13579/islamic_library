"use strict";

/**
 * مسح شامل: يفتح كل صفحة، يضغط كل زر فعّال، ويرصد
 *  - أخطاء الكونسول وأخطاء الصفحة
 *  - عناصر عالقة على التحميل
 *  - أزرار لا تُحدث أي أثر مرئي (مع مراعاة الإظهار/الإخفاء)
 * التشغيل:  node scripts/smoke-all.mjs
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

const PAGES = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith(".html") && f !== "offline.html")
  .sort();

/* بصمة الصفحة: كل ما يتغيّر عند التفاعل — بما فيه الإظهار والإخفاء */
const FINGERPRINT = () => {
  const visible = [];
  for (const el of document.querySelectorAll("*")) {
    const id = el.id ? "#" + el.id : "";
    const cls = typeof el.className === "string" && el.className ? "." + el.className.split(/\s+/)[0] : "";
    const key = el.tagName.toLowerCase() + id + cls;
    // checkVisibility يراعي إخفاء الأسلاف، وهو ما فوّتني سابقًا
    const shown = el.checkVisibility
      ? el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })
      : !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    if (shown) visible.push(key);
  }
  const texts = [];
  for (const el of document.querySelectorAll("h1,h2,h3,p,span,td,li,strong,b,label,button,.num,.lbl,.count,.total")) {
    if (el.children.length === 0) {
      const vis = el.checkVisibility ? el.checkVisibility() : !!(el.offsetWidth || el.offsetHeight);
      if (vis) texts.push(el.textContent.trim().slice(0, 40));
    }
  }
  const cs = getComputedStyle(document.documentElement);
  const vars = [];
  for (let i = 0; i < cs.length; i++) {
    const n = cs[i];
    if (n.startsWith("--")) vars.push(n + "=" + cs.getPropertyValue(n).trim());
  }
  return [
    visible.sort().join("|"),
    vars.sort().join(","),
    getComputedStyle(document.body).fontSize,
    document.body.className + "/" + document.documentElement.className,
    texts.sort().join("|"),
    document.title,
    window.scrollY,
    [...document.querySelectorAll("input,select,textarea")]
      .map((i) => (i.id || i.name) + "=" + i.value)
      .sort()
      .join(","),
    [...document.querySelectorAll(".toast,[role='status'],[role='alert']")]
      .map((t) => t.textContent.trim())
      .join(","),
  ].join("##");
};

const findings = [];
const add = (page, kind, detail) => findings.push({ page, kind, detail });

for (const page of PAGES) {
  const context = await browser.newContext();
  const tab = await context.newPage();

  const errors = [];
  tab.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`);
  });
  tab.on("pageerror", (e) => errors.push(`pageerror: ${String(e.message).slice(0, 200)}`));

  const reset = async () => {
    await tab.goto(`${base}/${page}`, { waitUntil: "load", timeout: 20000 });
    await tab.waitForTimeout(650);
  };

  let loaded = true;
  try {
    await reset();
  } catch {
    loaded = false;
    add(page, "فشل تحميل الصفحة", "لم تُفتح");
  }

  if (loaded) {
    // عناصر عالقة على التحميل
    const stuck = await tab.evaluate(() =>
      [...document.querySelectorAll("*")]
        .filter(
          (el) =>
            el.children.length === 0 &&
            /^(جارٍ التحميل|جار التحميل|جاري التحميل|تحميل\.\.\.|⏳|loading\.\.\.)$/i.test(
              el.textContent.trim()
            )
        )
        .map((el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""))
    );
    for (const s of stuck) add(page, "عنصر عالق على التحميل", s);

    const count = await tab.evaluate(() => {
      const sel = 'button,[role="button"],input[type="button"],input[type="submit"],a[href^="#"]';
      return [...document.querySelectorAll(sel)].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !el.disabled && !el.hidden && el.offsetParent !== null;
      }).length;
    });

    for (let i = 0; i < count; i++) {
      let downloaded = false;
      const onDl = () => { downloaded = true; };
      tab.on("download", onDl);
      const before = await tab.evaluate(FINGERPRINT);
      const label = await tab.evaluate((idx) => {
        const sel = 'button,[role="button"],input[type="button"],input[type="submit"],a[href^="#"]';
        const el = [...document.querySelectorAll(sel)].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && !e.disabled && !e.hidden && e.offsetParent !== null;
        })[idx];
        if (!el) return null;
        return (
          (el.id ? "#" + el.id : "") +
          " " +
          (el.textContent || el.value || el.getAttribute("aria-label") || el.getAttribute("href") || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 30)
        );
      }, i);
      if (label === null) break;

      let ok = true;
      try {
        const loc = tab.locator(
          'button,[role="button"],input[type="button"],input[type="submit"],a[href^="#"]'
        );
        await loc.nth(i).click({ timeout: 2500, force: true, noWaitAfter: true });
      } catch {
        ok = false;
      }

      if (!ok) {
        add(page, "تعذّر النقر على الزر", label);
        try { await reset(); } catch {}
        continue;
      }

      await tab.waitForTimeout(320);
      const after = await tab.evaluate(FINGERPRINT);
      tab.off("download", onDl);
      if (after === before && !downloaded) add(page, "زر بلا أثر مرئي", label);

      try { await reset(); } catch {}
    }
  }

  for (const e of new Set(errors)) add(page, "خطأ في الصفحة", e);
  await context.close();
}

await browser.close();
server.close();

console.log("\n================ نتائج المسح الشامل ================");
if (!findings.length) {
  console.log("✔ لا توجد مشاكل");
} else {
  const byPage = new Map();
  for (const f of findings) {
    if (!byPage.has(f.page)) byPage.set(f.page, []);
    byPage.get(f.page).push(f);
  }
  for (const [p, list] of byPage) {
    console.log(`\n▸ ${p}`);
    for (const f of list) console.log(`   [${f.kind}] ${f.detail}`);
  }
  console.log("\nالمجموع:", findings.length);
}
process.exit(findings.length ? 1 : 0);