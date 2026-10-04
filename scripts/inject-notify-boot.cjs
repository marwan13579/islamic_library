"use strict";

/**
 * حقن مُقلع الإشعارات في كل صفحة تحمّل `storage-fallback.js`.
 * السبب: الإشعارات يجب أن تشتغل في كل صفحة بلا زرّ وبلا سطرٍ يُكتب
 * فيها يدًا. و`storage-fallback.js` أوّل ملفٍ يُحمَّل في كل الصفحات،
 * فهو الموضع الذي يُحاق به.
 *
 * صفحتا `src/app` و`src/site` خارج ذلك: كلتاهما تستدعي النظام
 * التلقائي في `app.js` و`site.js`، فتكفيهما وحدهما.
 *
 * التشغيل:  node scripts/inject-notify-boot.cjs [--check]
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MARK = "notify-boot.js";
const DIRS = ["islamic-videos", "islamic-videos/favorites"];

/** @returns {string[]} صفحاتُ المشروع التي تحمّل `storage-fallback.js` */
function pages() {
  /** @type {string[]} */
  const files = [];
  const roots = [ROOT, ...DIRS.map((dir) => path.join(ROOT, dir))];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
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
  return html.replace(anchor, `$1\n<script src="${prefix}${MARK}" defer></script>`);
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
    console.log("✘ مُقلع الإشعارات غير محقون:");
    missing.forEach((file) => console.log("   " + file));
    process.exit(1);
  }
  console.log(`✔ مُقلع الإشعارات محقون في كل الصفحات (${all.length} صفحة)`);
} else {
  console.log(`✔ حُقِن مُقلع الإشعارات (${changed} صفحة من ${all.length})`);
}