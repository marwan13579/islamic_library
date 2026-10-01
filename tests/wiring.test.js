"use strict";

/**
 * فحص ثابت يضمن أن كل زر معلَّم بـ data-role له معالج في موزّع الأحداث،
 * فلا يبقى في الواجهة زرّ لا يفعل شيئًا.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

test("فحص المصدر يتجاوز الملفات الخارجية محليًا ويفرضها في الوضع الصارم", () => {
  const script = path.join(ROOT, "scripts/extract/verify-content.cjs");
  const missingSourceDir = path.join(ROOT, "missing-reference-fixtures");
  const env = {
    ...process.env,
    ISLAMIC_LIBRARY_SOURCE_DIR: missingSourceDir,
    VERIFY_CONTENT_REQUIRE_SOURCES: "",
  };
  const local = spawnSync(process.execPath, [script], { cwd: ROOT, env, encoding: "utf8" });
  assert.equal(local.status, 0, local.stderr || local.stdout);
  assert.match(local.stdout, /تخطّي مقارنة المصدر/);

  const strict = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    env: { ...env, VERIFY_CONTENT_REQUIRE_SOURCES: "1" },
    encoding: "utf8",
  });
  assert.notEqual(strict.status, 0, "يجب أن يفشل الوضع الصارم عند غياب المصادر المطلوبة");
  assert.match(strict.stdout, /تخطّي مقارنة المصدر/);
});

/** الواجهات التي تولّد أزرارًا برمجيًا. */
const VIEW_FILES = ["src/app/tabs.js", "src/site/sections.js", "src/site/render.js"];
/** الملفات التي فيها موزّع الأحداث. */
const DISPATCH_FILES = ["src/app/app.js", "src/site/site.js"];

const usedRoles = () => {
  const roles = new Set();
  for (const file of VIEW_FILES) {
    for (const m of read(file).matchAll(/data-role=\\?"([^"\\]+)\\?"/g)) roles.add(m[1]);
  }
  return roles;
};

test("كل data-role في الواجهات له معالج", () => {
  const dispatch = DISPATCH_FILES.map(read).join("\n");
  const dead = [...usedRoles()].filter((role) => !dispatch.includes(`"${role}"`)).sort();
  assert.deepEqual(dead, [], `أزرار بلا معالج: ${dead.join("، ")}`);
});

test("لا معالج مُعرَّف لزرّ غير موجود في الواجهات", () => {
  const views = VIEW_FILES.map(read).join("\n");
  const dispatch = DISPATCH_FILES.map(read).join("\n");
  const orphan = [...dispatch.matchAll(/case "([a-z0-9-]+)":/g)]
    .map((m) => m[1])
    .filter((role) => !views.includes(`"${role}"`));
  assert.deepEqual(orphan, [], `معالجات بلا زر: ${orphan.join("، ")}`);
});

test("لا مسارات مطلقة تكسر النشر في مجلد فرعي", () => {
  const files = [
    ...fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).map((f) => f),
    ...["src/site", "src/app"].flatMap((d) =>
      fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith(".html")).map((f) => `${d}/${f}`),
    ),
  ];
  const offenders = [];
  for (const file of files) {
    const html = read(file);
    for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      if (m[1].startsWith("//")) continue;
      offenders.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("كل رابط داخلي ثابت يشير إلى ملف موجود", () => {
  const files = [
    ...fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).map((f) => f),
    ...["src/site", "src/app"].flatMap((d) =>
      fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith(".html")).map((f) => `${d}/${f}`),
    ),
  ];
  const dead = [];
  for (const file of files) {
    const dir = path.dirname(path.join(ROOT, file));
    for (const m of read(file).matchAll(/(?:href|src)="([^"#?]+)"/g)) {
      const url = m[1];
      // الوحدات تُبنى نصًّا أثناء التشغيل، فلا يُفحص مسارها هنا.
      // المسارات المبنية نصًّا أثناء التشغيل ليست روابط ثابتة.
      if (/['"+$}{]/.test(url)) continue;
      if (/^(https?:|data:|mailto:|tel:|javascript:|\/\/)/.test(url)) continue;
      if (url.startsWith("/")) continue;
      if (!fs.existsSync(path.resolve(dir, url))) dead.push(`${file} → ${url}`);
    }
  }
  assert.deepEqual([...new Set(dead)], []);
});

test("عدد الأقسام المذكور في وصف نور الهدى يطابق الواقع", async () => {
  const { SECTIONS } = await import(`file://${path.join(ROOT, "src/site/sections.js")}`);
  const html = read("index.html");
  const card = html.match(/id:"noor"[\s\S]*?desc:"([^"]+)"/);
  assert.ok(card, "بطاقة نور الهدى غير موجودة");
  const claimed = card[1].match(/(\d+|[٠-٩]+)\s*قسم/);
  assert.ok(claimed, `الوصف لا يذكر عدد الأقسام: ${card[1]}`);
  const toEn = (v) => v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  assert.equal(
    Number(toEn(claimed[1])),
    SECTIONS.length,
    `الوصف يقول ${claimed[1]} والواقع ${SECTIONS.length}`,
  );
});

test("وصف نور الهدى لا يَعِد بما ليس فيه", async () => {
  const { SECTIONS } = await import(`file://${path.join(ROOT, "src/site/sections.js")}`);
  const ids = new Set(SECTIONS.map((s) => s.id));
  const html = read("index.html");
  const desc = html.match(/id:"noor"[\s\S]*?desc:"([^"]+)"/)[1];
  // ما يَعِد به الوصف يجب أن يقابله قسم أو ميزة حقيقية في التطبيق.
  const claims = [
    ["اختبارات", "quiz"],
    ["شهادات", "cert"],
  ];
  for (const [word, need] of claims) {
    if (desc.includes(word)) {
      const has = [...ids].some((id) => id.includes(need));
      assert.ok(has, `الوصف يَعِد بـ«${word}» ولا قسم يفي بذلك`);
    }
  }
});

test("كل سكربت مضمّن في الصفحات سليم نحويًا", () => {
  const files = [
    ...fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")),
    ...["src/site", "src/app"].flatMap((d) =>
      fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith(".html")).map((f) => `${d}/${f}`),
    ),
  ];
  const broken = [];
  for (const file of files) {
    const html = read(file);
    // يُفحص جافاسكربت الكلاسيكي فقط:
    //  - ما له src ملفٌ منفصل، ويفحصه check-syntax.cjs.
    //  - type="module" لا يقبله new Function لأنه يستورد.
    //  - type="application/ld+json" بيانات منظَّمة لا جافاسكربت.
    const CLASSIC = /<script(?![^>]*\bsrc=)(?![^>]*\btype=)[^>]*>([\s\S]*?)<\/script>/g;
    for (const m of html.matchAll(CLASSIC)) {
      try {
        // eslint-disable-next-line no-new-func
        new Function(m[1]);
      } catch (error) {
        broken.push(`${file}: ${error.message}`);
      }
    }
  }
  assert.deepEqual(broken, [], broken.join("\n"));
});

test("صفحة الأدوات تُفحص في check:browser", () => {
  const check = read("scripts/browser-check.mjs");
  // الفحص يكتشف الصفحات تلقائيًا، فلا تُنسى أداة جديدة.
  assert.match(check, /discoverPages/);
  assert.doesNotMatch(
    check.split("const PAGES = discoverPages();")[0],
    /const PAGES = \[/,
    "لا بدّ أن تبقى PAGES مكتشفةً لا مكتوبة يدويًا",
  );
});

/** كل صفحة في المشروع. */
function allHtml() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (/node_modules|^\.git|^tests$|^scripts$|^vendor$|^dist$|^\.kilo/.test(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(".html")) out.push(path.relative(ROOT, abs).split(path.sep).join("/"));
    }
  };
  walk(ROOT);
  return out;
}

test("كل صفحة فيها زرّ الرجوع إلى المكتبة", () => {
  // الفهرس هو المكتبة نفسها، فلا زرّ إليه.
  const exempt = new Set(["index.html"]);
  const missing = [];
  for (const file of allHtml()) {
    if (exempt.has(file)) continue;
    const html = read(file);
    const hasButton = /<a[^>]*class="back-link"[^>]*href="[^"]*index\.html"/.test(html);
    // صفحة الفقد لها زرّ في متنها، فهو مقبول.
    const hasInBodyLink = /<a[^>]*href="[^"]*index\.html"[^>]*>[^<]*\S/.test(html);
    if (!hasButton && !hasInBodyLink) missing.push(file);
  }
  assert.deepEqual(missing, [], `صفحات بلا زرّ رجوع:\n  ${missing.join("\n  ")}`);
});

test("زرّ الرجوع يشير إلى الفهرس الصحيح من كل مجلد", () => {
  const bad = [];
  for (const file of allHtml()) {
    if (file === "index.html") continue;
    const html = read(file);
    const m = html.match(/<a[^>]*class="back-link"[^>]*href="([^"]+)"/);
    if (!m) continue;
    const target = path.resolve(path.dirname(path.join(ROOT, file)), m[1]);
    if (!fs.existsSync(target)) bad.push(`${file} → ${m[1]}`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

test("زرّ الرجوع له نصّ وسمٌه للقارئات الصوتية", () => {
  for (const file of allHtml()) {
    const html = read(file);
    const m = html.match(/<a[^>]*class="back-link"[^>]*>([^<]*)<\/a>/);
    if (!m) continue;
    assert.match(html.match(/<a[^>]*class="back-link"[^>]*>/)[0], /aria-label="[^"]+"/, `${file}: بلا aria-label`);
    assert.ok(m[1].trim().length > 0, `${file}: زرّ فارغ`);
  }
});

test("كل صفحة تستخدم صنف back-link تربط ورقة تعريفه", () => {
  // صفحة الفقد (offline.html) لها زرّ في المتن، فلا صنفَ لها.
  const users = allHtml().filter((f) => read(f).includes('class="back-link"'));
  assert.ok(users.length > 30, `عدد مستعملي الصنف ${users.length} غير متوقّع`);
  const missing = users.filter((f) => {
    const html = read(f);
    return !html.includes("tools.css") && !html.includes("site.css") && !html.includes("app.css");
  });
  assert.deepEqual(missing, [], `بلا ورقة تعريف للصنف:\n  ${missing.join("\n  ")}`);
});

test("كل أيقونة مستعملة موجودة في ملف الرموز", async () => {
  const { SECTIONS } = await import(`file://${path.join(ROOT, "src/site/sections.js")}`);
  const sprite = read("src/assets/icons.svg");
  const symbols = new Set([...sprite.matchAll(/id="(i-[a-z-]+)"/g)].map((m) => m[1]));

  // أيقونات الأقسام
  const bySection = SECTIONS.filter((s) => !symbols.has(s.icon)).map((s) => `قسم ${s.id}: ${s.icon}`);

  // أيقونات مذكورة في الشيفرة والبيانات
  const sources = ["src/site/site.js", "src/site/render.js", "src/site/sections.js", "src/data/lessons.js"];
  const bySource = [];
  for (const file of sources) {
    const used = new Set([...read(file).matchAll(/\b(i-[a-z-]+)\b/g)].map((m) => m[1]));
    for (const icon of used) {
      if (!symbols.has(icon)) bySource.push(`${file}: ${icon}`);
    }
  }
  assert.deepEqual([...bySection, ...bySource].sort(), [], `أيقونات بلا رمز (مربّع فارغ):\n  ${[...bySection, ...bySource].join("\n  ")}`);
});

test("معرّفات الأقسام في الموقع تطابق ما في قائمة الأقسام", async () => {
  const { SECTIONS } = await import(`file://${path.join(ROOT, "src/site/sections.js")}`);
  const site = read("src/site/site.js");
  // «home» يُرسم بصفحة الصدارة (heroHtml) لا بقالب section.
  for (const section of SECTIONS.filter((s) => s.id !== "home")) {
    assert.match(site, new RegExp(`section\\(\\s*\\n?\\s*"${section.id}"`), `قسم بلا محتوى: ${section.id}`);
  }
});

test("الأكاديمية صارت صفحة تحويل إلى نور الهدى", () => {
  const html = read("33-academy.html");
  assert.match(html, /http-equiv="refresh"/, "لا تحويل تلقائي");
  assert.match(html, /content="0; url=src\/site\/noor\.html"/, "الوجهة ليست نور الهدى");
  assert.match(html, /<a[^>]*href="src\/site\/noor\.html"/, "لا رابط بديل يدوي");
  assert.doesNotMatch(html, /const SEERAH = \[/, "ما زال المحتوى المضمّن قائمًا");
  assert.doesNotMatch(html, /type="module"/, "صفحة التحويل يجب أن تعمل من القرص");
});

test("محتوى الأكاديمية انتقل إلى نور الهدى فعلًا", async () => {
  const { SECTIONS } = await import(`file://${path.join(ROOT, "src/site/sections.js")}`);
  const ids = SECTIONS.map((s) => s.id);
  for (const id of ["quiz", "certs", "sections", "seerah", "names"]) {
    assert.ok(ids.includes(id), `قسم ناقص في نور: ${id}`);
  }
  const site = read("src/site/site.js");
  assert.match(site, /function quizHtml\(\)/, "لا واجهة قسم الاختبارات");
  assert.match(site, /function certificatesHtml\(\)/, "لا واجهة قسم الشهادات");
  // محرّك الاختبار والشهادة في نور لا في الأكاديمية
  assert.ok(fs.existsSync(path.join(ROOT, "src/components/quiz.js")), "محرّك الاختبار مفقود");
  assert.ok(fs.existsSync(path.join(ROOT, "src/components/certificate.js")), "مولّد الشهادة مفقود");
});
