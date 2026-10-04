"use strict";

/**
 * مُقلع الإشعارات في كل صفحة.
 * تحرس هذه الاختبارات شرطًا واحدًا: أن يُقلع نظام الإشعارات تلقائيًّا
 * في كل صفحة بالمشروع، بلا زرّ ولا سطرٍ يكتبه صاحب الصفحة. فمن فتح
 * أي صفحة من الموقع يخرج له إشعار.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

/** @returns {string[]} صفحات HTML في كل المشروع (بلا مخرجات البناء) */
function pages() {
  /** @type {string[]} */
  const files = [];
  const skip = new Set(["node_modules", "dist", ".git"]);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name) || entry.name.startsWith(".")) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(".html")) files.push(path.relative(ROOT, abs));
    }
  };
  walk(ROOT);
  return files.sort();
}

/** الصفحات التي تحمّل `storage-fallback.js` — وهي كل صفحة قديمة. */
const legacy = pages().filter((file) =>
  fs.readFileSync(path.join(ROOT, file), "utf8").includes("storage-fallback.js"),
);

test("🔔 كل صفحة تحمّل مُقلع الإشعارات", () => {
  assert.ok(legacy.length >= 40, `صفحات قديمة: ${legacy.length} فقط`);
  const missing = legacy.filter(
    (file) => !/<script src="[^"]*notify-boot\.js" defer><\/script>/.test(fs.readFileSync(path.join(ROOT, file), "utf8")),
  );
  assert.deepEqual(missing, [], "صفحات بلا مُقلع إشعارات");
});

test("📍 مسار المُقلع صحيح في كل صفحة، لا جذرًا واحدًا", () => {
  const wrong = legacy.filter((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    const src = html.match(/<script src="([^"]*notify-boot\.js)" defer>/)[1];
    // المسار يُحلّ نسبةً إلى مجلّد الصفحة، لا نسبةً إلى جذر المستودع.
    const resolved = path.join(ROOT, path.dirname(file), src);
    return !fs.existsSync(resolved);
  });
  assert.deepEqual(wrong, [], "مسار مُقلع الإشعارات لا يُحلّ إلى ملفٍّ موجود");
});

test("🚀 المُقلع يطلب النظام التلقائي، وواجهة الصفحة لا تتغيّر", () => {
  const source = fs.readFileSync(path.join(ROOT, "notify-boot.js"), "utf8");
  assert.match(source, /import\(new URL\("src\/lib\/auto-notify\.js", here\)/, "المُقلع لا يجلب الوحدة");
  assert.match(source, /notify\.boot\(/, "المُقلع لا يُقلع النظام");
  //-module بلا import static كي يبقى نصًّا كلاسيكيًّا تعمله الصفحات القديمة.
  assert.doesNotMatch(source, /^\s*import\s/m, "المُقلع يستخدم صيغة الاستيراد الثابتة");
  assert.doesNotMatch(source, /export\s/, "المُقلع يصدّر، فهو ليس نصًّا كلاسيكيًّا");
});

test("📦 المُقلع مُدرَج في ذاكرة عامل الخدمة، فيعمل بلا إنترنت", () => {
  const worker = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  assert.match(worker, /"\.\/notify-boot\.js"/, "المُقلع غير مُدرَج في عامل الخدمة");
});

test("🗂 صفحتا الوحدتين تُقلعان النظام من وحدتهما", () => {
  for (const file of ["src/app/app.html", "src/site/noor.html"]) {
    const html = fs.readFileSync(path.join(ROOT, file), "utf8");
    const script = html.match(/<script[^>]+src="([^"]+\.js)"/g)?.join(" ") ?? "";
    assert.ok(script, `${file} بلا نصوص برمجية`);
  }
  for (const [file, unit] of [["src/app/app.js", "app.js"], ["src/site/site.js", "site.js"]]) {
    assert.match(fs.readFileSync(path.join(ROOT, file), "utf8"), /auto-notify\.js/, `${unit} لا يستدعي النظام`);
  }
});