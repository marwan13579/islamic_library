"use strict";

/**
 * حقن طبقة التفاعل في كل صفحة تحمّل `storage-fallback.js`.
 *
 * السبب: الشارة العائمة ولوحة الأوسمة وتحدّي اليوم لا تظهر إلا إن حُمّلت
 * الطبقة، وهي تعمل بلا أسطر في كل صفحة. و`storage-fallback.js` أوّل ملفٍ
 * يُحمَّل في الصفحات القديمة، فهو الموضع الذي يُلحق به — كما أُلحق به
 * مُقلع الإشعارات.
 *
 * الوسمُ هنا وسمٌ كامل: ورقةُ الأنماط ثم السكربت، فالاثنان يجتمعان ولا
 * يظهر نصف الطبقة. وصفحات `src/app` و`src/site` خارج ذلك: لكلٍّ منهما
 * نظامُ تقدّمٍ خاص به ولا يحتاجان طبقةً ثانية فوقه.
 *
 * التشغيل:  node scripts/inject-engage.cjs [--check]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MARK = "engage.js";
const STYLE = "engage.css";
const DIRS = ["islamic-videos", "islamic-videos/favorites"];

/** صفحاتٌ لا طبقةَ فيها: تحويلات وصفحةُ فقد الاتصال. */
const SKIP = new Set(["offline.html", "33-academy.html", "23-search.html"]);

/** @returns {string[]} صفحاتُ المشروع التي تحمّل `storage-fallback.js` */
function pages() {
  /** @type {string[]} */
  const files = [];
  const roots = [ROOT, ...DIRS.map((dir) => path.join(ROOT, dir))];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
      const name = path.basename(entry.name);
      if (SKIP.has(name)) continue;
      const file = path.relative(ROOT, path.join(root, entry.name));
      if (fs.readFileSync(path.join(root, entry.name), "utf8").includes("storage-fallback.js")) {
        files.push(file);
      }
    }
  }
  return files.sort();
}

/**
 * عمق صفحة تحت الجذر: ٠ للجذر، ١ لمجلّد واحد، وهكذا.
 * @param {string} file مسار الصفحة نسبةً إلى الجذر
 * @returns {number}
 */
function depthOf(file) {
  return file.split(/[\\/]/).length - 1;
}

/**
 * يحقن الوسم في صفحة، بلا تكرار.
 * @param {string} html
 * @param {string} file مسار الصفحة نسبةً إلى الجذر
 * @returns {string}
 */
function inject(html, file) {
  if (html.includes(MARK)) return html;
  const prefix = "../".repeat(depthOf(file));
  const anchor = new RegExp(`(\\s*<script src="${prefix}storage-fallback\\.js"[^>]*></script>)`);
  if (!anchor.test(html)) return html;
  const tag =
    `\n<link rel="stylesheet" href="${prefix}${STYLE}">` +
    `\n<script src="${prefix}${MARK}" defer></script>`;
  return html.replace(anchor, `$1${tag}`);
}

const check = process.argv.includes("--check");
const missing = [];
let changed = 0;
const all = pages();

for (const file of all) {
  const abs = path.join(ROOT, file);
  const html = fs.readFileSync(abs, "utf8");
  const next = inject(html, file);
  if (next !== html) {
    changed++;
    if (!check) fs.writeFileSync(abs, next);
  } else if (!html.includes(MARK)) {
    missing.push(file);
  }
}

if (check) {
  if (missing.length) {
    console.log("✘ طبقة التفاعل غير محقونة:");
    missing.forEach((file) => console.log("   " + file));
    process.exit(1);
  }
  console.log(`✔ طبقة التفاعل محقونة في كل الصفحات (${all.length} صفحة)`);
} else {
  console.log(`✔ حُقنت طبقة التفاعل (${changed} صفحة من ${all.length})`);
}
