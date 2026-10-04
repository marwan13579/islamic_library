"use strict";

/**
 * مكتبة الفيديو الإسلامية: بيانات وربط ومنطق.
 *
 * ما يفحصه هذا الملف:
 *   - أن البيانات سليمة البناء: لا معرّف مكرّر، ولا رابط مخترع، ولا قناة
 *     بلا عمر أو مجال، ولا «مختارة» لم يثبت مصدرها.
 *   - أن ما يُعرض للقارئ هو المحقّق فقط: القناة التي تنتظر المراجعة لا
 *     تظهر في التصفية ولا في المختارات ولا في الاقتراحات.
 *   - أن صفحتي القسم تصلان بكل مورد تسمّيه، وأن روابطهما الداخلية حيّة.
 *   - أن البحث العربي يعمل بالواجهة العربية والإنجليزية معًا.
 *
 * فحص روابط YouTube الحيّة ليس هنا (يحتاج إنترنت) بل في:
 *   npm run videos:check
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const has = (rel) => fs.existsSync(path.join(ROOT, rel));
const load = (rel) => import(path.join(ROOT, rel)).then((m) => m);

/* وحدات تُحمَّل في خطّاف لا في أعلى الملف، فهذا الملف CommonJS. */
let data;
let lib;
let INDEX;
let CHANNELS;
let AGE_GROUPS;
let CATEGORIES;
let LANGUAGES;
let TRUST_LEVELS;
let STARTING_POINTS;

test.before(async () => {
  data = await load("src/data/islamic-channels.js");
  lib = await load("src/lib/video-library.js");
  INDEX = lib.buildIndex();
  ({ CHANNELS, AGE_GROUPS, CATEGORIES, LANGUAGES, TRUST_LEVELS, STARTING_POINTS } = data);
});

/* ───────────────────────────────────────────────────────── البيانات */

test("☐ القنوات: معرّفات فريدة وأسماء عربية بالإنجليزية", () => {
  assert.ok(CHANNELS.length >= 50, `القنوات ${CHANNELS.length} أقلّ من المتوقّع`);
  const ids = new Set();
  for (const channel of CHANNELS) {
    assert.ok(channel.id && /^[a-z0-9-]+$/.test(channel.id), `معرّف غير صالح: ${channel.id}`);
    assert.equal(ids.has(channel.id), false, `معرّف مكرّر: ${channel.id}`);
    ids.add(channel.id);
    assert.ok(channel.nameAr?.trim(), `${channel.id}: بلا اسم عربي`);
    assert.ok(channel.nameEn?.trim(), `${channel.id}: بلا اسم أصلي`);
    assert.ok(channel.descriptionAr?.length > 10, `${channel.id}: الوصف قصير جدًا`);
  }
});

test("☐ القنوات: كل القيم من التصنيفات المعرَّفة، ولا قائمة فارغة", () => {
  const ages = new Set(AGE_GROUPS.map((group) => group.id));
  const categories = new Set(CATEGORIES.map((category) => category.id));
  const languages = new Set(LANGUAGES.map((language) => language.id));
  const trusts = new Set(TRUST_LEVELS.map((level) => level.id));
  const types = new Set(data.TYPES);

  for (const channel of CHANNELS) {
    assert.ok(channel.ageGroups.length, `${channel.id}: بلا فئة عمرية`);
    assert.ok(channel.categories.length, `${channel.id}: بلا مجال`);
    assert.ok(channel.language.length, `${channel.id}: بلا لغة`);
    for (const age of channel.ageGroups) assert.ok(ages.has(age), `${channel.id}: عمر مجهول ${age}`);
    for (const item of channel.categories) {
      assert.ok(categories.has(item), `${channel.id}: مجال مجهول ${item}`);
    }
    for (const language of channel.language) {
      assert.ok(languages.has(language), `${channel.id}: لغة مجهولة ${language}`);
    }
    assert.ok(trusts.has(channel.trustLevel), `${channel.id}: مستوى توصية مجهول`);
    assert.ok(types.has(channel.type), `${channel.id}: نوع مجهول`);
    assert.ok(Array.isArray(channel.keywords), `${channel.id}: كلمات مفتاحية غير مصفوفة`);
  }
});

test("☐ القنوات: لا رابط إلا ليوتيوب، وما ينتظر المراجعة بلا رابط", () => {
  for (const channel of CHANNELS) {
    if (channel.needsReview) {
      assert.equal(channel.youtubeUrl, "", `${channel.id}: قناة تنتظر المراجعة لها رابط`);
      assert.equal(channel.verified, false, `${channel.id}: قناة تنتظر المراجعة وُسمت موثّقة`);
      continue;
    }
    assert.match(
      channel.youtubeUrl,
      /^https:\/\/www\.youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]+|user\/[\w.-]+|c\/[\w.-]+)\/?$/,
      `${channel.id}: رابط ليس رابط قناة يوتيوب: ${channel.youtubeUrl}`,
    );
    assert.equal(channel.verified, true, `${channel.id}: معروضة وغير موثّقة`);
  }
});

test("☐ المختارات: لا يدخلها إلا موثّقة موصى بها", () => {
  const featured = CHANNELS.filter((channel) => channel.featured);
  assert.ok(featured.length >= 5, `المختارات ${featured.length} قليلة`);
  assert.ok(featured.length <= 12, `المختارات ${featured.length} كثيرة — الصفحة تُثقل`);
  for (const channel of featured) {
    assert.equal(channel.verified, true, `${channel.id}: مُختارة وغير موثّقة`);
    assert.equal(channel.trustLevel, "recommended", `${channel.id}: مُختارة وموثّقة و ليست موصى بها`);
    assert.ok(channel.youtubeUrl, `${channel.id}: مُختارة وبلا رابط`);
  }
  /* والحارس البرمجي لا يكتفي بتصريح البيانات: يفحصها فعلًا. */
  assert.deepEqual(
    lib.featuredChannels().map((channel) => channel.id).sort(),
    featured.map((channel) => channel.id).sort(),
    "مختارات العرض تختلف عن المُعلَنة",
  );
});

test("☐ التغطية: لكل فئة عمرية رئيسية قناة، وللكل فئات ولغات", () => {
  const published = lib.publishable();
  for (const group of ["kids36", "kids79", "kids1012", "teens1315", "teens1618", "youth", "family", "everyone"]) {
    assert.ok(
      published.some((channel) => channel.ageGroups.includes(group)),
      `لا قناة موثّقة للفئة ${group}`,
    );
  }
  for (const language of ["ar", "en"]) {
    assert.ok(published.some((channel) => channel.language.includes(language)), `لا قناة ${language}`);
  }
  assert.ok(published.length >= 45, `القنوات الموثّقة ${published.length}`);
});

/* ─────────────────────────────────────────────── ما يُعرض للقارئ */

test("☐ العرض: قنوات المراجعة لا تدخل التصفية ولا المفضلة", () => {
  const shown = lib.runQuery(INDEX, {});
  assert.ok(shown.length > 0, "لا نتائج أصلًا");
  assert.ok(
    shown.every((channel) => channel.verified && channel.youtubeUrl),
    "تسرّبت قناة غير موثّقة إلى التصفية",
  );
  assert.equal(INDEX.length, publishedCount(), "حجم فهرس التصفية لا يطابق المحقّق");
  assert.equal(lib.buildIndex(CHANNELS, true).length, CHANNELS.length, "وضع المراجعة لا يظهر الكل");
});

/** @returns {number} */
function publishedCount() {
  return CHANNELS.filter((c) => c.verified && c.youtubeUrl && !c.disabled).length;
}

test("☐ الاقتراحات: «شاهد وتعلم» ثلاث، و«ماذا أشاهد» من الموصى به فقط", () => {
  const picks = lib.suggestionsFor(INDEX, { category: "quran" }, 3);
  assert.equal(picks.length, 3, "اقتراحات «شاهد وتعلم» ليست ثلاثة");
  assert.equal(new Set(picks.map((c) => c.id)).size, 3, "تكرار في اقتراحات «شاهد وتعلم»");
  assert.ok(picks.every((c) => c.categories.includes("quran")), "اقتراح خارج الفلتر المطلوب");

  for (const channel of lib.watchNow(INDEX, 1)) {
    assert.equal(channel.trustLevel, "recommended", "اقتراح «ماذا أشاهد» ليس موصى به");
    assert.equal(channel.verified, true, "اقتراح «ماذا أشاهد» غير موثّق");
  }
  /* الزر «اقتراح آخر» يعطي قناة مختلفة ما دامت هناك قنوات. */
  const first = lib.watchNow(INDEX, 1)[0];
  const next = lib.watchNow(INDEX, 1, Math.random, [first.id])[0];
  assert.notEqual(next?.id, first.id, "زر «اقتراح آخر» يعيد نفس القناة");
});

test("☐ الترقيم: لا ترسم كل النتائج دفعةً واحدة", () => {
  const rows = lib.runQuery(INDEX, {});
  assert.ok(rows.length > lib.PAGE_SIZE, "البيانات أصغر من حجم الصفحة — لا معنى للاختبار");
  const page = lib.paginate(rows);
  assert.equal(page.slice.length, lib.PAGE_SIZE, "رُسمت كل النتائج بلا ترقيم");
  assert.equal(page.page, 1);
  assert.equal(page.hasMore, true);
  assert.equal(lib.paginate([], 12).pages, 1, "قائمة فارغة لا صفحة واحدة");
});

/* ────────────────────────────────────────────────────────── البحث */

test("☐ البحث: عربي بلا همزة ولا تشكيل، وإنجليزي بحروفه", () => {
  const azhar = INDEX.find((entry) => entry.channel.id === "al-azhar-al-shareef");
  assert.ok(azhar, "قناة الأزهر غير موجودة");
  for (const word of ["الأزهر", "الازهر", "ازهر", "أزهر", "azhar"]) {
    assert.ok(lib.matchesText(azhar.index, word), `البحث عن «${word}» لم يجد الأزهر`);
  }
  const zakaria = INDEX.find((entry) => entry.channel.id === "learn-with-zakaria");
  assert.ok(lib.matchesText(zakaria.index, "زكريا"), "البحث عن «زكريا» لم يجد القناة");
  assert.ok(lib.matchesText(zakaria.index, "zakaria"), "البحث بالإنجليزية لم يجد القناة");
  assert.ok(lib.matchesText(zakaria.index, "أطفال kids"), "البحث بكلمتين لم يعمل");
  assert.equal(lib.matchesText(zakaria.index, "لا-موجود-إطلاقًا"), false, "مطابقة لشيء غير موجود");
});

test("☐ البحث: يطابق الوصف والتصنيف والفئة والكلمات المفتاحية", () => {
  const rows = lib.runQuery(INDEX, { text: "تجويد" });
  assert.ok(rows.length, "البحث عن «تجويد» لم يرجع شيئًا");
  const names = new Set(AGE_GROUPS.map((group) => group.label));
  assert.ok(
    names.size >= 6,
    "الفئات العمرية ناقصة: البحث فيها لا معنى",
  );
});

test("☐ الفلترة: العمر واللغة والمجال والمزيج", () => {
  const kids = lib.runQuery(INDEX, { age: "kids36" });
  assert.ok(kids.length, "لا نتائج للفئة 3–6");
  assert.ok(kids.every((channel) => channel.ageGroups.includes("kids36")), "تسريب في فلترة العمر");

  const english = lib.runQuery(INDEX, { language: "en" });
  assert.ok(english.every((channel) => channel.language.includes("en")), "تسريب في فلترة اللغة");

  /* «العربية + English» تعني محتوى بلغتين لا تسميةً واحدة. */
  const both = lib.runQuery(INDEX, { language: "both" });
  assert.ok(both.length > 0, "لا قنوات ثنائية اللغة");
  assert.ok(
    both.every(
      (channel) =>
        channel.language.includes("both") ||
        (channel.language.includes("ar") && channel.language.includes("en")),
    ),
    "تسريب في فلترة اللغة الثنائية",
  );

  const combined = lib.runQuery(INDEX, { category: "kids", age: "kids36" });
  assert.ok(
    combined.every((channel) => channel.categories.includes("kids") && channel.ageGroups.includes("kids36")),
    "فلترة مزدوجة لا تعمل",
  );
  assert.ok(combined.length < kids.length + english.length, "الفلترة المزدوجة لا تضيّق");
});

test("☐ الترتيب: المختارات أولًا ثم الموصى بها ثم الاسم", () => {
  const rows = lib.runQuery(INDEX, {});
  const firstFeatured = rows.findIndex((channel) => channel.featured);
  assert.equal(firstFeatured, 0, "المختارة الأولى ليست في الصدارة");
  const recommendedDone = rows.findIndex((channel) => channel.trustLevel !== "recommended");
  const featuredAfter = rows.findIndex((channel, index) => channel.featured && index >= recommendedDone);
  assert.equal(featuredAfter, -1, "مختارة جاءت بعد قناة موصى بها غير مختارة");
});

/* ────────────────────────────────────────────── المفضلة والسجل */

test("☐ المفضلة: التبديل يُرجع الحالة، والترتيب لا يهم", async () => {
  const ui = await load("src/lib/video-library-ui.js");
  const rows = lib.runQuery(INDEX, {});
  const first = rows[0].id;
  const second = rows[1].id;
  const favorites = new Set(ui.readFavorites());
  const hadFirst = favorites.has(first);

  assert.equal(ui.toggleFavorite(first), !hadFirst, "النجمة لم ترجع الحالة المعاكسة");
  assert.equal(ui.isFavorite(first), !hadFirst, "حالة المفضلة لم تُحفظ");
  ui.toggleFavorite(first);
  assert.equal(ui.isFavorite(first), hadFirst, "التبديل الثاني لم يرجع الحالة الأولى");

  /* المفضلة عاملُ فلترة لا معلَمُ مسار: ترتيبها لا يغيّر النتيجة. */
  const a = new Set([first, second]);
  const b = new Set([second, first]);
  assert.deepEqual(
    lib.runQuery(INDEX, { favoritesOnly: true }, a).map((c) => c.id),
    lib.runQuery(INDEX, { favoritesOnly: true }, b).map((c) => c.id),
  );
});

/* ────────────────────────────────────────────────── الروابط والأمان */

test("☐ روابط المشاهدة: نطاق يوتيوب فقط، وما ينتظر المراجعة بلا زر", async () => {
  const ui = await load("src/lib/video-library-ui.js");
  for (const channel of CHANNELS) {
    const url = ui.channelUrl(channel);
    if (channel.needsReview || !channel.verified) {
      assert.equal(url, "", `${channel.id}: قناة غير موثّقة يعطيها زر مشاهدة`);
      continue;
    }
    assert.match(url, /^https:\/\/www\.youtube\.com\//, `${channel.id}: رابط خارج يوتيوب`);
    assert.ok(!/redirect|bit\.ly|linktr\.ee|youtu\.be/i.test(url), `${channel.id}: رابط مختصر أو إعادة توجيه`);
  }
  /* حماية إضافية: حتى لو دخل شيء مؤوَّه في البيانات، لا يخرج نطاق يوتيوب. */
  assert.equal(
    ui.channelUrl({ id: "x", verified: true, youtubeUrl: "https://evil.example.com/@x" }),
    "",
    "نطاق غريب مرّ من الحارس",
  );
  assert.equal(
    ui.channelUrl({ id: "x", verified: true, youtubeUrl: "javascript:alert(1)" }),
    "",
    "مخطّط خطير مرّ من الحارس",
  );
});

test("☐ البطاقة: لا صورة خارجية ولا إطار مضمَّن ولا رابط معرّف مستخدم", async () => {
  const ui = await load("src/lib/video-library-ui.js");
  const card = ui.channelCard(CHANNELS.find((c) => c.verified));
  assert.match(card, /▶ مشاهدة القناة/, "زر المشاهدة مفقود");
  assert.match(card, /rel="noopener noreferrer"/, "التبويب الجديد بلا حماية");
  assert.match(card, /target="_blank"/, "المشاهدة لا تفتح تبويبًا جديدًا");
  assert.equal(/<img|<iframe/i.test(card), false, "في البطاقة صورة أو إطار مضمَّن");
  assert.equal(/ytimg|ggpht|doubleclick/i.test(card), false, "طلب شبكة إلى يوتيوب في البطاقة");
});

test("☐ لا إعلانات ولا تتبّع ولا مشغّل موحّد في القسم", () => {
  for (const page of ["islamic-videos/index.html", "islamic-videos/favorites/index.html"]) {
    const html = read(page);
    assert.equal(/googletagmanager|google-analytics|adsbygoogle|adservice|facebook\.net/i.test(html), false,
      `${page}: تتبّع أو إعلان`);
    assert.equal(/<iframe/i.test(html), false, `${page}: إطار مضمَّن`);
    assert.equal(/document\.write|innerHTML\s*=\s*["'`]\s*\+/i.test(html), false,
      `${page}: حقن HTML من نصّ`);
  }
});

/* ──────────────────────────────────────────────────── الملفات والروابط */

test("☐ القسم: صفحتاه موجودتان بكل ما تسمّيانه", () => {
  for (const page of ["islamic-videos/index.html", "islamic-videos/favorites/index.html"]) {
    assert.ok(has(page), `مفقود: ${page}`);
    const html = read(page);
    assert.match(html, /<h1[\s>]/, `${page}: بلا عنوان رئيسي`);
    assert.match(html, /name="viewport"/, `${page}: بلا مقاس عرض`);
    assert.match(html, /dir="rtl"/, `${page}: بلا اتجاه من اليمين`);
    assert.equal(/user-scalable\s*=\s*no/.test(html), false, `${page}: التكبير مقفل`);
    assert.match(html, /class="vlib"/, `${page}: بلا حاوية القسم`);
    assert.match(html, /skip-link/, `${page}: بلا رابط التخطّي`);
  }
  for (const asset of [
    "islamic-videos/videos.css",
    "src/data/islamic-channels.js",
    "src/lib/video-library.js",
    "src/lib/video-library-ui.js",
  ]) {
    assert.ok(has(asset), `مفقود: ${asset}`);
  }
});

test("☐ القسم: كل رابط داخلي في صفحاته يصل", () => {
  for (const page of ["islamic-videos/index.html", "islamic-videos/favorites/index.html"]) {
    const base = path.posix.dirname(page);
    const markup = read(page).replace(/<script\b[\s\S]*?<\/script>/g, "");
    for (const match of markup.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
      const target = match[1].trim();
      if (!target || /^(?:https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i.test(target)) continue;
      const clean = target.split("#")[0].split("?")[0];
      const resolved = path.posix.normalize(path.posix.join(base, clean));
      assert.ok(has(resolved), `${page} ← ${target}`);
    }
  }
});

test("☐ القسم: مُسجَّل في التحميل المسبق وفي مخرجات النشر", () => {
  const shell = read("sw.js").match(/const SHELL = \[([\s\S]*?)\n\];/);
  assert.ok(shell, "لا قائمة التحميل المسبق");
  for (const asset of [
    "./islamic-videos/index.html",
    "./islamic-videos/favorites/index.html",
    "./islamic-videos/videos.css",
    "./src/data/islamic-channels.js",
    "./src/lib/video-library.js",
    "./src/lib/video-library-ui.js",
  ]) {
    assert.ok(shell[1].includes(asset), `غير مُحمَّل مسبقًا: ${asset}`);
    assert.ok(has(asset.replace("./", "")), `مفقود: ${asset}`);
  }
  /* البناء ينسخ مجلد القسم كاملًا إلى مخرجات النشر. */
  assert.match(read("scripts/prepare-pages.cjs"), /"islamic-videos"/, "مجلد القسم لا يُنسخ إلى dist");
  /* والفهرس يشير إلى القسم، بالعربية والإنجليزية. */
  const index = read("index.html");
  assert.match(index, /islamic-videos\//, "بطاقة القسم غير موجودة في الفهرس");
  assert.match(index, /islamicvideos:\["Islamic Video Library"/, "ترجمة البطاقة الإنجليزية ناقصة");
});

test("☐ القسم: أزرار البداية كلها تصفّي إلى نتائج", () => {
  for (const point of STARTING_POINTS) {
    assert.ok(point.label && point.emoji, `زر ناقص: ${JSON.stringify(point)}`);
    assert.ok(point.categories.length, `زر بلا تصنيف: ${point.id}`);
    const rows = lib.runQuery(INDEX, { category: point.categories[0] });
    assert.ok(rows.length > 0, `زر «${point.label}» لا يقود إلى نتائج`);
  }
});

test("☐ تخزين المكتبة: مفتاحاها مُعلَنان في ثلاثة مواضع", async () => {
  const { KEYS, IMPORT_TYPES } = await load("src/lib/storage.js");
  assert.equal(KEYS.videoFavorites, "video_favorites");
  assert.equal(KEYS.videoRecent, "video_recent");
  assert.equal(IMPORT_TYPES[KEYS.videoFavorites], "array");
  assert.equal(IMPORT_TYPES[KEYS.videoRecent], "array");

  const backup = read("backup-core.js");
  for (const key of ["video_favorites", "video_recent"]) {
    assert.ok(backup.includes(`"${key}"`), `${key} يسقط من النسخة الاحتياطية`);
  }
});