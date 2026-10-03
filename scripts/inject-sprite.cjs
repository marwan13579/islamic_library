"use strict";

/**
 *حقن سبرايت الأيقونات داخل الصفحات التي تستعمل <use href="#i-...">مباشرة.
 * السبب: <use> بجزء مجزّأ لا يعمل إلا إن كان الـsymbol في نفس المستند،
 * وحقنه عبر fetch يفشل عند الفتح عبر file:// ويفشل دون اتصال.
 *
 * التشغيل:  node scripts/inject-sprite.cjs [--check]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SPRITE = path.join(ROOT, "src/assets/icons.svg");
const TARGETS = ["src/site/noor.html", "src/app/app.html"];
const MARK_START = "<!-- icons:sprite:start -->";
const MARK_END = "<!-- icons:sprite:end -->";

const sprite = fs.readFileSync(SPRITE, "utf8").trim();

/**
 * نحقن السبرايت كاملًا لا المس-used فقط، لأن معظم الأيقونات
 * يستدعيها كود مولَّد وقت التشغيل (قوالب site.js)، لا HTML الثابت.
 */
function needed() {
  return sprite
    .replace(/^<svg\b[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">')
    .replace(/\s*<\/svg>\s*$/, "\n</svg>");
}

const check = process.argv.includes("--check");
let changed = 0;
const problems = [];

for (const file of TARGETS) {
  const abs = path.join(ROOT, file);
  let html = fs.readFileSync(abs, "utf8");
  const block = `${MARK_START}\n    ${needed()}\n    ${MARK_END}`;

  const re = new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}`);
  const emptyHost = /\s*<div id="sprite" aria-hidden="true"><\/div>/;

  // 1) استبدل الحاوية الفارغة الحالية
  if (emptyHost.test(html)) {
    html = html.replace(emptyHost, `\n  ${block}`);
    changed++;
  } else if (re.test(html)) {
    // 2) حدّث الكتلة إن كانت موجودة
    const next = html.replace(re, block);
    if (next !== html) changed++;
    html = next;
  } else if (html.includes('href="#i-')) {
    // 3) لا حاوية ولا كتلة: أدرج الكتلة قبل إغلاق body
    html = html.replace(/<\/body>/, `  ${block}\n</body>`);
    changed++;
  }

  if (check) {
    if (!re.test(html)) problems.push(`${file}: السبرايت غير محقونة`);
    continue;
  }
  fs.writeFileSync(abs, html);
}

if (check) {
  if (problems.length) {
    console.log("✘ سبرايت الأيقونات:");
    problems.forEach((p) => console.log("   " + p));
    process.exit(1);
  }
  console.log("✔ سبرايت الأيقونات محقونة في كل الصفحات");
} else {
  console.log(`✔ حُقنت سبرايت الأيقونات (${changed} تعديل)`);
}