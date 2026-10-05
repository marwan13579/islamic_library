"use strict";

/**
 * قائمة الانحدار الدائمة.
 *
 * كل بندٍ هنا اختبارٌ مستقلّ، واسمُه ما يكتبه في عدّاد الفحص. فمن
 * عاد فتشكّلت القوائم، فتُقرأ القائمة كلها في ثوانٍ وتُعرف الصفحة
 * أو المورد الذي انكسر.
 *
 * ما تفحصه: أن كل صفحة من صفحات الموقع قائمةٌ وتعمل، وأن كل مورد تسمّيه
 * الصفحة موجود، وأن ما يُكتب في التخزين مُعلَن، وأن عامل الخدمة يخدم
 * بلا إنترنت. فالغالبية أخطاءُ تجميعٍ صامتة لا تظهر إلا عند الانتقال
 * إلى صفحة أخرى أو بلا إنترنت.
 *
 * لا يفحص هذا سلوك الأزرار — لذلك `check:browser` و`check:interaction`.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const has = (rel) => fs.existsSync(path.join(ROOT, rel));
const loadJson = (rel) => JSON.parse(read(rel));

/** كل صفحة في المشروع. */
function allHtml() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (/node_modules|^\.git$|^tests$|^scripts$|^dist$|^\.kilo/.test(entry.name)) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith(".html")) {
        out.push(path.relative(ROOT, abs).split(path.sep).join("/"));
      }
    }
  }
  walk(ROOT);
  return out;
}

/** نصوص صفحة بلا سكربتات، فالروابط داخل الشيفرة قوالب لا وجهات. */
function markupOf(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>/g, "");
}

/** روابط داخلية من وسوم `href` و`src` وحدها. */
function localLinks(html) {
  const out = new Set();
  for (const m of markupOf(html).matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
    const value = m[1].trim();
    if (!value) continue;
    if (/^(?:https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i.test(value)) continue;
    out.add(value.split("#")[0].split("?")[0]);
  }
  return [...out].filter(Boolean);
}

/** هل يصل هدفٌ من داخل صفحة؟ */
function resolves(file, target) {
  const base = path.posix.dirname(file);
  return has(path.posix.normalize(path.posix.join(base, target))) || has(target);
}

/** ورقة تعريف CSS بعد حلّ مسارها من داخل الصفحة. */
function resolvedSheet(file, href) {
  const base = path.posix.dirname(file);
  return path.posix.normalize(path.posix.join(base, href)).replace(/^(\.\.\/)+/, "");
}

/* ------------------------------------------------- الصفحة الرئيسية */

test("☐ الصفحة الرئيسية: بطاقات الأدوات كلّها موجودة", () => {
  const html = read("index.html");
  const cards = [...html.matchAll(/url\s*:\s*"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((url) => !/^(?:https?:|\/\/)/i.test(url));
  assert.ok(cards.length > 40, `بطاقات الأدوات ${cards.length} أقلّ من المتوقّع`);

  const dead = [...new Set(cards.map((url) => url.split("#")[0].split("?")[0]))]
    .filter((url) => url && !has(url));
  assert.deepEqual(dead, [], "بطاقاتٌ تشير إلى صفحات غير موجودة");
  assert.match(html, /rel="manifest"/, "الفهرس لا يربط بيان التطبيق");
  assert.match(html, /serviceWorker|registerServiceWorker/, "الفهرس لا يربط عامل الخدمة");
  assert.match(html, /name="viewport"/, "الفهرس بلا مقاس عرض");
  assert.match(html, /<h1[\s>]/, "الفهرس بلا عنوان رئيسي");
});

/* -------------------------------------------------------- القرآن */

test("☐ القرآن: الصفحة والنصّ وأوضاع القراءة قائمة", () => {
  for (const file of ["30-quran-full.html", "content/surahs.json", "vendor/quran-arabic.json"]) {
    assert.ok(has(file), `مفقود: ${file}`);
  }
  assert.match(read("30-quran-full.html"), /quran-arabic\.json/, "المصحف لا يقرأ النصّ");

  const surahs = loadJson("content/surahs.json");
  assert.ok(Array.isArray(surahs) && surahs.length === 114, `سور ${surahs.length}`);
  assert.ok(surahs.every((s) => s.name && s.verses > 0), "سورة بلا اسم أو بلا عدد آيات");

  assert.match(read("src/app/app.js"), /id:\s*"quran"/, "لا تبويب المصحف");
  const reader = read("src/app/quran-read.js");
  for (const feature of ["loadTajweed", "loadWordByWord", "loadTafsir"]) {
    assert.match(reader, new RegExp(`function ${feature}`), `القراءة بلا ${feature}`);
  }
  /* كل نصّ يُحقن في الصفحة يرمّز، والوسوم الوحيدة المسموحة هي التجويد. */
  assert.match(reader, /escapeHtml/, "القارئ لا يرمّز النصّ");
  assert.match(reader, /tajweed/, "لا معالجة لوسوم التجويد");
});

/* ------------------------------------------------------ الحديث */

test("☐ الحديث: المصادر كاملة والنصوص مخرَّجة", async () => {
  for (const file of ["27-hadith.html", "3-arbaeen.html", "src/data/hadiths.js"]) {
    assert.ok(has(file), `مفقود: ${file}`);
  }
  const { ATTRIBUTED, statusOf } = await import(`file://${path.join(ROOT, "src/lib/review.js")}`);
  assert.ok(ATTRIBUTED.length, "أداة المراجعة فارغة");
  assert.equal(typeof statusOf, "function", "لا دالّة حالة");
  /* الصفحتان تعرضان المصادر ولا تقرآن منها. */
  assert.match(read("27-hadith.html"), /<h1[\s>]/, "صفحة الحديث بلا عنوان");
  assert.match(read("3-arbaeen.html"), /<h1[\s>]/, "صفحة الأربعين بلا عنوان");
});

/* ---------------------------------------------------- المكتبة */

test("☐ المكتبة: المجموعات الأربع وفهارس ترتيبها قائمة", () => {
  const collections = loadJson("content/manifest.json").collections || {};
  assert.ok(Object.keys(collections).length >= 4, `مجموعات ${Object.keys(collections).length}`);

  for (const [type, expected] of Object.entries(collections)) {
    const dir = `content/library/${type}`;
    assert.ok(has(`${dir}/meta.json`), `${type}: لا بيان`);
    assert.ok(has(`${dir}/order.json`), `${type}: لا فهرس ترتيب — نفّذ npm run build:order`);
    const meta = loadJson(`${dir}/meta.json`);
    assert.equal(meta.count, expected.count, `${type}: العدد لا يطابق البيان الإجمالي`);
    assert.equal(fs.readdirSync(path.join(ROOT, dir, "items")).length, expected.itemFiles, `${type}: الأجزاء`);
    assert.equal(meta.listFiles.length, expected.listFiles, `${type}: القوائم`);
  }
  assert.ok(has("reader.html"), "لا صفحة قارئ");
  assert.match(read("src/lib/library.js"), /PAGE_SIZE\s*=/, "لا حجم صفحة");
});

/* ---------------------------------------------------- البحث */

test("☐ البحث: المحرك الموحّد والنافذة المنبثقة قائمين", () => {
  for (const file of ["src/components/search-modal.js", "src/lib/unified-search.js", "src/lib/search-registry.js"]) {
    assert.ok(has(file), `مفقود: ${file}`);
  }
  const modal = read("src/components/search-modal.js");
  assert.match(modal, /function createSearchModal\(\)/, "نافذة البحث غير موجودة");
  assert.match(modal, /function openSearchModal\(\)/, "فتح النافذة غير موجود");
  assert.match(modal, /searchAll|quickSearch/, "المحرك الموحّد غير مرفوع");
});

/* --------------------------------------------------- الأذكار */

test("☐ الأذكار: الصفحات وأبواب حصن المسلم والمصادر قائمة", () => {
  for (const file of ["1-adhkar.html", "25-azkar-shamila.html", "src/data/app-athkar.js"]) {
    assert.ok(has(file), `مفقود: ${file}`);
  }
  const hisn = loadJson("content/hisn/index.json");
  assert.equal(hisn.bab.length, hisn.count, "أبواب حصن المسلم: العدد لا يطابق البيان");
  assert.ok(hisn.count >= 100, `أبواب حصن المسلم ${hisn.count}`);
  assert.ok(hisn.bab.every((b) => b.title && b.count > 0), "باب بلا عنوان أو فارغ");
  for (const no of [1, 2, hisn.count]) {
    assert.ok(has(`content/hisn/bab-${String(no).padStart(3, "0")}.json`), `باب ${no} مفقود`);
  }
  assert.ok(has("content/azkar.json"), "ملف الأذكار الشاملة مفقود");
  assert.ok(Array.isArray(loadJson("content/azkar.json")), "الأذكار الشاملة ليست قائمة");
});

/* --------------------------------------------------- الصلاة */

test("☐ الصلاة: المواقيت والأذان والتقويم الهجري", () => {
  for (const file of ["29-prayer-times.html", "42-athan.html", "28-hijri.html", "src/lib/api.js"]) {
    assert.ok(has(file), `مفقود: ${file}`);
  }
  const api = read("src/lib/api.js");
  assert.match(api, /api\.aladhan\.com/, "لا مصدر مواقيت");
  assert.match(api, /timeout|AbortSignal/, "لا مهلة لطلب المواقيت");
  /* رفض الإذن يُعرَض ولا يُصمت. */
  assert.match(api, /locationError/, "لا رسالة لرفض إذن الموقع");
  assert.match(read("42-athan.html"), /locationError|رُفض|تعذّر|denied/i, "الأذان لا يعرض رفض الإذن");
  /* حساب المواقيت محليًا ليعمل بلا إنترنت. */
  assert.match(read("calculations.js"), /PrayerTimes|prayerTimes|calculateTimes/i, "لا حساب مواقيت محلي");
});

/* ---------------------------------------------------- القبلة */

test("☐ القبلة: الاتجاه محسوب ورفض الإذن معالَج", async () => {
  assert.ok(has("22-qibla.html"), "صفحة القبلة مفقودة");
  const { calcQibla, KAABA } = await import(`file://${path.join(ROOT, "src/lib/islamic.js")}`);
  /* مكة من إسطنبول شمال شرق تقريبًا، ومن مدينة جنوبية غربًا. */
  const north = calcQibla(41.0082, 28.9784);
  const south = calcQibla(-33.8688, 151.2093);
  assert.ok(north > 100 && north < 170, `اتجاه القبلة من إسطنبول ${north}`);
  assert.ok(south > 240 && south < 300, `اتجاه القبلة من مدينة جنوبية ${south}`);
  assert.ok(Math.abs(calcQibla(KAABA.lat, KAABA.lng)) < 1, "الاتجاه من الكعبة نفسها ليس صفرًا");
  const page = read("22-qibla.html");
  assert.match(page, /locationError|رُفض|تعذّر|denied/i, "لا نصّ لرفض إذن الموقع");
  /* الصفحة تأخذ الحساب من المكتبة المشتركة، فلا تختلف عن باقي الواجهات */
  assert.match(page, /from "\.\/src\/lib\/islamic\.js"/, "الصفحة لا تستعمل حساب القبلة المشترك");
  assert.doesNotMatch(page, /atan2|qiblaBearing/, "في الصفحة حسابٌ خاصّ للقبلة ينحرف عن المشترك");
  assert.match(page, /magneticDeclination/, "البوصلة الحيّة بلا تصحيح الانحراف المغناطيسي");
  assert.doesNotMatch(page, /30\.0444|31\.2357/, "في الصفحة إحداثيات افتراضية تظهر كأنها موقعك");
});

/* --------------------------------------------------- الأدوات */

test("☐ الأدوات: الزكاة والسبحة تعمل", async () => {
  for (const file of ["10-zakat.html", "15-tasbeeh-jamai.html", "calculations.js"]) {
    assert.ok(has(file), `مفقود: ${file}`);
  }
  const { calculateZakat, calculateMetalZakat, calculateLivestockZakat, tasbihStep } = await import(
    `file://${path.join(ROOT, "src/lib/islamic.js")}`
  );
  /* النصاب ٨٥ جرامًا بنسبة ٢٫٥٪: مئة جرام ← اثنان ونصف. */
  assert.equal(calculateZakat(100, 100).due, 2.5, "زكاة المال");
  assert.equal(calculateZakat(80, 100).belowNisab, true, "دون النصاب");
  assert.ok(calculateMetalZakat(100, 100, "gold", "trade").due >= 0, "زكاة الذهب");
  assert.equal(calculateMetalZakat(100, 100, "gold", "jewelry").due, 0, "الزينة");
  const sheep = calculateLivestockZakat({ sheep: 2 });
  assert.ok(Array.isArray(sheep) && sheep.length, "زكاة الغنم لا تُحسب");
  assert.equal(sheep[0].due, 0, "خمس شيون دون النصاب");
  assert.equal(tasbihStep({ count: 32, target: 33 }).count, 33, "عدّاد السبحة");
});

/* --------------------------------------------------- رمضان */

test("☐ رمضان: المهام والأدعية وليالي الشهر", () => {
  assert.ok(has("7-ramadan.html"), "صفحة رمضان مفقودة");
  const html = read("7-ramadan.html");
  assert.match(html, /id="tasks"/, "لا مهام اليوم");
  assert.match(html, /id="duabox"/, "لا صندوق الأدعية");
  assert.match(html, /id="itikaf"/, "لا اعتماد");
  assert.match(html, /رؤية الهلال/, "لا دعاء رؤية الهلال");
  assert.match(html, /AR_NUM\[n\]|ليلة/, "لا تتبّع ليلي الشهر");
  assert.match(html, /id="next"/, "لا تنقّل بين الأيام");
  /* نسخة احتياطية للتقدّم، فتُنسخ بيانات المستخدم. */
  assert.match(html, /نسخة احتياطية/, "لا تصدير لتقدّم رمضان");
});

/* ------------------------------------------------- الصوتيات */

test("☐ الصوتيات: الإذاعات والقرّاء في صفحة واحدة، والمشغّل والتخزين", () => {
  for (const file of ["32-radio-hub.html", "40-reciters.html", "content/radio.json", "content/reciters.json", "src/data/radio-live.js"]) {
    assert.ok(has(file), `مفقود: ${file}`);
  }
  const radio = loadJson("content/radio.json");
  assert.ok(Array.isArray(radio) && radio.length > 50, `إذاعات ${radio.length}`);
  /* The data still holds one insecure stream: a duplicate of entry 129
     that was stored under http, so a browser blocks it as mixed content
     and nobody can hear it. `stations()` drops those, not the data, so a
     content rebuild cannot bring the broken station back. */
  assert.equal(
    radio.filter((s) => !/^https:/i.test(s.link || "")).length,
    1,
    "the count of insecure streams changed - review them by hand",
  );

  const reciters = loadJson("content/reciters.json");
  const list = reciters.reciters || reciters;
  assert.ok(Array.isArray(list) && list.length > 50, `قرّاء ${list.length}`);

  assert.match(read("src/lib/player.js"), /lib-player-state/, "لا حفظ لموضع الإذن");
  assert.match(read("src/lib/audio-store.js"), /quran-audio-v1/, "لا مخزن تلاوات");
  /* الإذاعات صارت في صفحة القرّاء والتلاوة، والمشغّل فيها واحد. */
  assert.match(read("40-reciters.html"), /<audio|\.play\(|playTrack/, "لا مشغّل صوت");
  assert.match(read("40-reciters.html"), /audio-hub\.js/, "الإذاعات غير مدمجة بالقرّاء");
});

/* ---------------------------------------------- الوضع الليلي */

test("☐ الوضع الليلي: مفتاح محفوظ وقواعد داكنة في كل صفحة", () => {
  const theme = read("src/components/theme.js");
  assert.match(theme, /KEYS\.theme/, "لا مفتاح الثيم");
  assert.match(theme, /prefers-color-scheme/, "لا احترام تفضيل النظام");
  assert.match(theme, /KEYS\.fontSize/, "لا حجم الخط المحفوظ");

  const pages = allHtml();
  const dark = pages.filter((file) => {
    const html = read(file);
    const sheets = [...html.matchAll(/<link[^>]*href="([^"?]+\.css)"/g)]
      .map((m) => m[1])
      .filter((sheet) => resolves(file, sheet));
    const pattern = /prefers-color-scheme:\s*dark|\[data-theme=["']?dark/;
    return pattern.test(html) || sheets.some((sheet) => pattern.test(read(resolvedSheet(file, sheet))));
  });
  assert.ok(dark.length >= pages.length - 2, `الوضع الليلي في ${dark.length} من ${pages.length} صفحة`);
});

/* --------------------------------------- الهاتف والحاسوب */

test("☐ Mobile: مقاس العرض في كل صفحة، والتكبير متاح", () => {
  const pages = allHtml();
  const noViewport = pages.filter((file) => !/name="viewport"/.test(read(file)));
  assert.deepEqual(noViewport, [], "بلا مقاس عرض:\n  " + noViewport.join("\n  "));

  /* منع التكبير بابٌ يُقفل على من يحتاجه. */
  const locked = pages.filter((file) => /user-scalable\s*=\s*no/.test(read(file)));
  assert.deepEqual(locked, [], "التكبير مقفل في: " + locked.join("، "));

  const ltr = pages.filter((file) => !/dir="rtl"/.test(read(file)));
  assert.deepEqual(ltr, [], "بلا اتجاه من اليمين:\n  " + ltr.join("\n  "));
});

/* --------------------------------------------- Offline / PWA */

test("☐ Offline/PWA: عامل الخدمة وبيان التطبيق وصفحة الفقد", () => {
  const sw = read("sw.js");
  const manifest = loadJson("manifest.webmanifest");
  assert.equal(manifest.dir, "rtl", "البيان ليس من اليمين");
  assert.equal(manifest.lang, "ar", "البيان ليس عربيًا");
  assert.ok(manifest.icons.length >= 4, "أيقونات قليلة في البيان");

  const deadIcons = manifest.icons.map((icon) => icon.src.replace(/^\.\//, "")).filter((src) => !has(src));
  assert.deepEqual(deadIcons, [], "أيقونات مفقودة: " + deadIcons.join("، "));

  const shell = sw.match(/const SHELL = \[([\s\S]*?)\n\];/);
  assert.ok(shell, "لا قائمة التحميل المسبق");
  const missing = [...shell[1].matchAll(/["']([^"']+)["']/g)]
    .map((m) => m[1].replace(/^\.\//, ""))
    .filter((asset) => !has(asset));
  assert.deepEqual(missing, [], "أصول مفقودة من التحميل المسبق: " + missing.join("، "));

  assert.ok(has("offline.html"), "لا صفحة انقطاع");
  assert.match(read("offline.html"), /name="robots"[^>]*noindex/, "صفحة الفقد قابلة للفهرسة");
  assert.match(sw, /CACHE_VERSION\s*=/, "لا نسخة كاش");
  assert.match(read("src/lib/pwa.js"), /registerServiceWorker/, "لا تسجيل عامل خدمة");
  /* الصفحة التي لا يعمل منها العامل تشير إليه فعلًا. */
  assert.match(sw, /registerServiceWorker|self\.registration/, "لا تسجيل ذاتي");
});

/* ---------------------------------- المورد المذكور في الصفحة */

test("☐ كل مورد تسمّيه صفحة موجود، وكل رابط داخلي يصل", () => {
  const broken = [];
  for (const file of allHtml()) {
    for (const target of localLinks(read(file))) {
      if (!resolves(file, target)) broken.push(`${file} ← ${target}`);
    }
  }
  assert.deepEqual(broken, [], "روابط أو موارد لا تصل:\n  " + broken.join("\n  "));
});

/* ---------------------------------------- مفاتيح التخزين */

test("☐ كل مفتاح تخزين مستعمل مُعلَن في KEYS", async () => {
  const { KEYS, IMPORT_TYPES } = await import(`file://${path.join(ROOT, "src/lib/storage.js")}`);
  const declared = new Set(Object.values(KEYS));
  assert.equal(Object.keys(IMPORT_TYPES).length, declared.size, "أنواع الاستيراد لا تغطي المفاتيح كلها");

  /* مفتاح يُكتب خارج KEYS يضيع في النسخة الاحتياطية بصمت. */
  const sources = [
    "src/app/app.js", "src/app/tabs.js", "src/components/theme.js",
    "src/components/quiz.js", "src/components/certificate.js",
    "src/lib/library.js", "src/lib/player.js",
  ];
  const known = new Set([...declared, "lib-player-state", "__noor_probe__", "prayer_timings"]);
  const adHoc = [];
  for (const file of sources) {
    for (const m of read(file).matchAll(/(?:localStorage|sessionStorage)\.(?:get|set|remove)Item\(\s*"([^"]+)"/g)) {
      if (!known.has(m[1])) adHoc.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual(adHoc, [], "مفاتيح لا تدخل النسخة الاحتياطية:\n  " + adHoc.join("\n  "));
});
