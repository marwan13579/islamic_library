"use strict";

/**
 * فحوص تربط الثوابت بما يولّد الواجهة فعلًا، فلا تبقى سمة تُكتب ولا تُقرأ.
 * الغرض: منع زرّ أو شريحة صامتة — يعمل الكود ولا يُحدث شيئًا في الشاشة.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** الملفات التي تُولّد أزرارًا وشرائح، وملفات موزّعات الأحداث. */
const VIEWS = ["src/app/tabs.js", "src/site/render.js", "src/site/site.js"];
const DISPATCH = ["src/app/app.js", "src/site/site.js"];

/** سمة data-* قد تُكتب في الواجهة وتُقرأ في الموزّع أو العكس. */
const DATA_ATTRS = [
  "data-dua-cat",
  "data-radio-cat",
  "data-hadith-cat",
  "data-goto-ayah",
  "data-review",
  "data-copy-dua",
  "data-surah-type",
];

test("كل سمة data-* مكتوبة في الواجهة تُقرأ في موزّع الأحداث", () => {
  const views = VIEWS.map(read).join("\n");
  const dispatch = DISPATCH.map(read).join("\n");
  const dead = DATA_ATTRS.filter(
    (attr) => views.includes(attr) && !dispatch.includes(attr),
  );
  assert.deepEqual(dead, [], `سمات بلا قارئ: ${dead.join("، ")}`);
});

test("نسخ الدعاء في الموقع يحتاج data-role لا سمة مفردة", () => {
  // العيب الذي كان: الزر كُتب بـ data-copy-dua فقط، والمعالج يقرأ data-role.
  const render = read("src/site/render.js");
  const button = render.match(/<button[^>]*data-copy-dua="[^"]*"[^>]*>/)?.[0];
  assert.ok(button, "زرّ نسخ الدعاء غير موجود في render.js");
  assert.match(button, /data-role="copy-dua"/, "زرّ نسخ الدعاء بلا data-role فلا يعمل");
});

test("شرائح تصفية الفئات تُصدَر بفسحة واحدة نشِطة واحدة", () => {
  const tabs = read("src/app/tabs.js");
  const chips = tabs.match(/<div class="chips"[^>]*>\S*\$\{cats\s*\.map/g) ?? [];
  assert.deepEqual(chips, [], "ما زال هناك توليد شرائح يُعلّم كلها نشِطة");
  // catChipsHtml هي المصدر الوحيد، وفيها شريحة «الكل» النشِطة وحدها.
  const helper = tabs.match(/function catChipsHtml[\s\S]*?\n}/)?.[0];
  assert.ok(helper, "catChipsHtml غير موجودة");
  assert.match(helper, /chip\("", "الكل", true\)/, "بلا شريحة «الكل» النشِطة");
  assert.match(helper, /chip\(cat, cat, false\)/, "فئات غير نشِطة في البداية");
});

test("مبدّل شرائح الفئات يعيد رسم القائمة المرتبطة", () => {
  const app = read("src/app/app.js");
  const fn = app.match(/function switchCat[\s\S]*?\n}/)?.[0];
  assert.ok(fn, "switchCat غير موجودة");
  for (const holder of ["duaList", "radioList", "hadithList"]) {
    assert.ok(fn.includes(holder), `switchCat لا تعيد رسم ${holder}`);
  }
  // الموزّع يمرّ على السمات الثلاث في حلقة واحدة، والقيمة الفارغة تعني «الكل».
  assert.match(
    app,
    /for \(const attribute of \["dua-cat", "radio-cat", "hadith-cat"\]\)/,
    "لا حلقة نقر لشرائح الفئات الثلاث",
  );
  assert.match(
    app,
    /closest\(`\[data-\$\{attribute\}\]`\)/,
    "حلقة النقر لا تقرأ سمة الشريحة",
  );
});

test("قائمة السور تُصفّى بالنوع وبالاسم معًا", () => {
  const app = read("src/app/app.js");
  assert.match(app, /case "surahType":/, "قائمة النوع بلا معالج تغيير");
  assert.match(app, /function repaintSurahs\(\)/, "لا دالة تُعيد الرسم بالفلترين");
  assert.match(read("src/app/tabs.js"), /id="surahType"/, "قائمة النوع غير موجودة");
  assert.match(app, /data-type="\$\{type\}"/, "التصفية لا تستعمل data-type");
});

test("العلامات تُحفظ وتُقرأ بصيغة واحدة", async () => {
  const tabs = await import(`file://${path.join(ROOT, "src/app/tabs.js")}`);
  assert.equal(tabs.bookmarkKey(2, 255), "2:255");
  assert.deepEqual(tabs.parseBookmark("2:255"), [2, 255]);
  assert.deepEqual(tabs.parseBookmark("لا شيء"), [0, 0]);
  const html = tabs.bookmarksHtml(["2:255"]);
  assert.match(html, /data-goto-ayah="2:255"/, "الشريحة بلا معرّف");
  assert.match(html, /البقرة/, "الشريحة لا تعرض اسم السورة");
  assert.match(tabs.bookmarksHtml([]), /لا توجد علامات/);
  // لا حقن: مفتاح غير موثوق يُهرَّب ولا يظهر خامًا.
  const injected = tabs.bookmarksHtml(['<img src=x onerror="alert(1)">']);
  assert.doesNotMatch(injected, /<img/, "مفتاح علامة غير موثوق حُقن كـ HTML");
});

test("زرّ العلامة موجود ويُستدعى، والعلامة تُحفظ في المصحف", () => {
  const tabs = read("src/app/tabs.js");
  const app = read("src/app/app.js");
  assert.match(tabs, /data-role="bookmark-ayah"/, "لا زرّ حفظ العلامة");
  assert.match(app, /case "bookmark-ayah":/, "لا معالج لزرّ العلامة");
  assert.match(app, /write\(KEYS\.quranBookmarks/, "العلامة لا تُحفظ");
  assert.match(app, /closest\("\[data-goto-ayah\]"\)/, "شرائح العلامات بلا معالج");
  // نوع المفتاح في ملف الاستيراد يجب أن يطابق ما يُكتب فعلًا (قائمة).
  assert.match(read("src/lib/storage.js"), /quran_bookmarks: "array"/);
});

test("زرّ «راجع» في مراجعة الاختبار يفتح صفًّا حقيقيًا", async () => {
  const quiz = read("src/components/quiz.js");
  assert.match(quiz, /data-review="\$\{index\}"/, "زرّ راجع غير موجود");
  const detail = quiz.match(/function reviewDetail[\s\S]*?\n}/)?.[0];
  assert.ok(detail, "صفّ التفاصيل غير موجود");
  assert.match(detail, /hidden/, "صفّ التفاصيل يبدأ ظاهرًا");
  assert.match(detail, /id="review-detail-\$\{index\}"/, "بلا معرّف للربط");
  const wire = quiz.match(/querySelectorAll\("\[data-review\]"\)\.forEach[\s\S]*?\n  \}\);/)?.[0];
  assert.ok(wire, "زرّ راجع بلا معالج نقر");
  assert.match(wire, /detail\.hidden/, "المعالج لا يخفي ولا يظهر الصفّ");
});

test("صفحة نور الذكر مرتبطة من الفهرس", () => {
  const index = read("index.html");
  const files = fs
    .readdirSync(ROOT)
    .filter((f) => /^\d+-.*\.html$/.test(f))
// 33-academy صفحة تحويل، وlinkTesting يفحص رابطها لا بطاقتها.
  // 23-search.html صفحة تحويل إلى الصفحة الرئيسية بعد دمج البحث الموحّد.
  // 32-radio-hub.html صفحة تحويل بعد إدماج الإذاعات في 40-reciters.html.
  .filter((f) => !["33-academy.html", "23-search.html", "32-radio-hub.html"].includes(f));
  const missing = files.filter((f) => !index.includes(`"${f}"`));
  assert.deepEqual(missing, [], `أدوات غير مفهرسة: ${missing.join("، ")}`);
  // والبطاقة تُعرَّف بمعرّف فريد ومن فئة معروفة.
  assert.match(index, /id:"dhikrkit"[\s\S]{0,200}cat:"dhikr"/);
  const ids = [...index.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], "معرّفات مكرّرة");
  // الاسم الإنجليزي موجود، وإلا ظهر الاسم العربي في وضع اللغة الإنجليزية.
  // الترجمة الإنجليزية للبطقة تُحمَّل من الملف المعياري
  const enCommon = JSON.parse(fs.readFileSync(path.join(ROOT, "locales/en/common.json"), "utf8"));
  assert.match(enCommon.common.tools.dhikrkit[0], /^Noor al-Dhikr/, "اسم الأداة الإنجليزي ناقص");
});

test("لا تصدير بلا مستهلك في وحدات المشروع", () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(".js")) files.push(abs);
    }
  };
  walk(path.join(ROOT, "src"));

  const corpus = [
    ...files,
    ...fs.readdirSync(ROOT).filter((f) => f.endsWith(".html")).map((f) => path.join(ROOT, f)),
    ...["src/site", "src/app"].flatMap((d) =>
      fs.readdirSync(path.join(ROOT, d)).map((f) => path.join(ROOT, d, f)),
    ),
    // صفحات القسم في مجلدها، فهي مستهلكة كما هي صفحات الجذر.
    ...fs
      .readdirSync(path.join(ROOT, "islamic-videos"), { withFileTypes: true })
      .flatMap((entry) =>
        entry.isDirectory()
          ? fs
              .readdirSync(path.join(ROOT, "islamic-videos", entry.name))
              .map((f) => path.join(ROOT, "islamic-videos", entry.name, f))
          : [path.join(ROOT, "islamic-videos", entry.name)],
      )
      .filter((f) => f.endsWith(".html")),
    ...fs.readdirSync(path.join(ROOT, "tests")).map((f) => path.join(ROOT, "tests", f)),
    ...fs.readdirSync(path.join(ROOT, "scripts")).map((f) => path.join(ROOT, "scripts", f)),
    ...fs.readdirSync(path.join(ROOT, "scripts/extract")).map((f) =>
      path.join(ROOT, "scripts/extract", f),
    ),
  ]
    .filter((f) => fs.statSync(f).isFile())
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");

  const orphans = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
      const name = m[1];
      const uses = (corpus.match(new RegExp(`\\b${name}\\b`, "g")) || []).length;
      // ورودٌ واحد = اسمُه في سطر التصدير فقط، فليس له مستهلك.
      if (uses <= 1) orphans.push(`${path.relative(ROOT, file)}: ${name}`);
    }
  }
  assert.deepEqual(orphans, [], `تصدير بلا مستهلك:\n  ${orphans.join("\n  ")}`);
});
