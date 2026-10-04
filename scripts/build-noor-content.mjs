/**
 * يبني `noor-content.js` — مستودع محتوى «رفيق النور».
 *
 * مبدأ البناء: لا نصّ دينيّ يُكتب هنا. كل نصّ يخرج من موضعه الموثوق داخل
 * المشروع، ويحمل مصدره. وما لا مصدر له إلا إذا وُسم
 * `origin: "editorial"` (عبرة أو عمل عملي)، وإلا أبى البناء.
 *
 * التشغيل:  npm run build:noor
 * الفحص:    --check  لا يكتب، ويقارن الناتج بما في القرص.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  VERSE_TOPICS,
  SURAH_TOPICS,
  REFLECTIONS,
  ACTIONS,
  PAGE_ROUTES,
  assertCurationSanity,
  assertTopicNamesAreKnown,
} from "./noor-curation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "noor-content.js");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const json = (rel) => JSON.parse(read(rel));

const problems = [];
const fail = (message) => problems.push(message);

/* ------------------------------------------------------- 1) نصوص القرآن */

/** نصّ الآية كما في ملف المصحف، منقّى من علامة ترتيب البايتات. */
function verseText(surahNo, ayahNo) {
  const surah = mushaf.surahs[surahNo - 1];
  const ayah = surah?.ayahs.find((a) => a.n === ayahNo);
  if (!ayah) return "";
  return ayah.text.replace(/﻿/g, "");
}

const mushaf = json("vendor/quran-arabic.json");
const surahNames = new Map(json("content/surahs.json").map((s) => [s.no, s.name]));

/** «البقرة: ٢٥٥» بأرقام عربية، كما هو سطر التوثيق في الموقع. */
function refOf(surah, ayah) {
  return `${surahNames.get(surah) ?? surah}: ${ayah}`;
}

const items = [];

/** يضيف عنصرًا بعد أن يتحقق من اكتماله. */
function add(item) {
  if (!item.id || !item.type || !item.text) fail(`عنصر ناقص: ${JSON.stringify(item).slice(0, 90)}`);
  /* نصٌّ منسوب إلى مصدر لا يُقبل بلا توثيق. أما التأليف فيُوسم صراحةً. */
  if (item.origin !== "editorial" && !item.source) {
    fail(`نصّ بلا مصدر (${item.type} ${item.id ?? "?"}): ${String(item.text).slice(0, 60)}`);
  }
  if (item.origin === "editorial" && item.source) {
    fail(`تأليف تحريري منسوب إلى مصدر (${item.id}): ${item.source}`);
  }
  if (item.origin !== "editorial" && /﴿|﴾/.test(item.text) && item.type === "hadith") {
    fail(`حديث محاط بعلامة آية (${item.id})`);
  }
  items.push(item);
  return item;
}

/* الآيات — نصّها مستخرج من الملف المرفوع، وسورتها ورقمها مضبوطان به. */
for (const key of Object.keys(VERSE_TOPICS)) {
  const [surah, ayah] = key.split(":").map(Number);
  const text = verseText(surah, ayah);
  if (!text) {
    fail(`آية غير موجودة في المصحف: ${key}`);
    continue;
  }
  add({
    id: `v_${surah}_${ayah}`,
    type: "verse",
    origin: "quran",
    text,
    source: `سورة ${surahNames.get(surah) ?? surah}، الآية ${ayah}`,
    ref: refOf(surah, ayah),
    surah,
    ayah,
    topics: VERSE_TOPICS[key],
    url: `30-quran-full.html?s=${surah}&a=${ayah}`,
  });
}

/* ------------------------------------------------------- 2) الأحاديث */

const { HADITHS } = await import(path.join(ROOT, "src/data/hadiths.js"));
const { DAILY_HADITHS } = await import(path.join(ROOT, "src/data/daily.js"));
const { APP_DAILY_HADITHS } = await import(path.join(ROOT, "src/data/app-daily.js"));

/** تصنيف الحديث في `src/data/hadiths.js` إلى موضوعاتنا. */
const HADITH_CAT_TOPICS = {
  faith: ["tawheed", "taqwa"],
  worship: ["salah"],
  dhikr: ["dhikr"],
  quran: ["quran"],
  social: ["akhlaq"],
};

const seenHadith = new Set();
/** يمنع تكرار الحديث نفسه الوارد في أكثر من ملف بيانات. */
const hadithFingerprint = (text) => text.replace(/[\s"'.،؛:()\-]/g, "").slice(0, 40);

for (const hadith of HADITHS) {
  add({
    id: `hd_${hadith.id}`,
    type: "hadith",
    origin: "hadith",
    title: hadith.title,
    text: hadith.text,
    source: hadith.ref,
    ref: hadith.ref,
    topics: HADITH_CAT_TOPICS[hadith.cat] ?? ["knowledge"],
  });
  seenHadith.add(hadithFingerprint(hadith.text));
}

/** الموضوعات لحديث بعينه، بمطابقة أول كلمات نصّه. */
const PREFIX_TOPICS = {
  "عليكم بسنتي": ["obedience", "seerah"],
  "من أحدث في أمرنا": ["obedience", "seerah"],
  "خير الناس قرني": ["seerah", "khutbah"],
  "كل بدعة ضلالة": ["obedience", "khutbah"],
  "إنما الأعمال بالنيات": ["seerah", "khutbah"],
  "الدين النصيحة": ["khutbah", "justice"],
  "لا يؤمن أحدكم": ["akhlaq"],
  "اتق الله حيثما": ["taqwa"],
};

for (const [index, hadith] of DAILY_HADITHS.entries()) {
  const fingerprint = hadithFingerprint(hadith.text);
  if (seenHadith.has(fingerprint)) continue;
  seenHadith.add(fingerprint);
  const plain = hadith.text.replace(/[""']/g, "").trim();
  const key = Object.keys(PREFIX_TOPICS).find((p) => plain.startsWith(p));
  add({
    id: `hd_d${index + 1}`,
    type: "hadith",
    origin: "hadith",
    text: hadith.text,
    source: hadith.src,
    ref: hadith.src,
    topics: key ? PREFIX_TOPICS[key] : ["knowledge"],
  });
}

for (const [index, hadith] of APP_DAILY_HADITHS.entries()) {
  const fingerprint = hadithFingerprint(hadith.text);
  if (seenHadith.has(fingerprint)) continue;
  seenHadith.add(fingerprint);
  const plain = hadith.text.replace(/[""']/g, "").trim();
  const key = Object.keys(PREFIX_TOPICS).find((p) => plain.startsWith(p));
  add({
    id: `hd_a${index + 1}`,
    type: "hadith",
    origin: "hadith",
    text: hadith.text,
    source: hadith.ref,
    ref: hadith.ref,
    topics: key ? PREFIX_TOPICS[key] : ["knowledge"],
  });
}

/* ------------------------------------------------------- 3) الأدعية */

const { APP_DUAS } = await import(path.join(ROOT, "src/data/app-duas.js"));

const DUA_CAT_TOPICS = {
  morning: ["dhikr", "dua"],
  evening: ["dhikr", "dua"],
  sleep: ["dhikr", "dua"],
  travel: ["dua", "protection"],
  sick: ["dua"],
  food: ["dua"],
  anxiety: ["dua", "patience"],
  general: ["dua"],
};

for (const [index, dua] of APP_DUAS.entries()) {
  add({
    id: `du_a${index + 1}`,
    type: "dua",
    origin: "dua",
    title: dua.title,
    text: dua.text,
    source: dua.ref,
    ref: dua.ref,
    topics: DUA_CAT_TOPICS[dua.cat] ?? ["dua"],
  });
}

/* ------------------------------------------------------- 4) الأذكار */

const { ATHKAR_REFERENCES } = await import(path.join(ROOT, "src/data/review-references.js"));
/** الاعتماد على الموضوع بأول كلمات الذكر. */
const ATHKAR_PREFIX_TOPICS = {
  "أَصْبَحْنَا": ["dhikr"],
  "اللَّهُ لَا إِلَهَ": ["dhikr", "tawheed"],
  "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ": ["dhikr"],
  "أَمْسَيْنَا": ["dhikr"],
  "أَعُوذُ بِكَلِمَاتِ": ["protection"],
  "أَسْتَغْفِرُ اللَّهَ": ["tawbah"],
  "سُبْحَانَ اللَّهِ (33)": ["dhikr"],
  "رَبِّ اغْفِرْ لِي وَتُبْ": ["tawbah"],
};

Object.entries(ATHKAR_REFERENCES).forEach(([text, meta], index) => {
  const plain = text.replace(/[()]/g, "").trim();
  const key = Object.keys(ATHKAR_PREFIX_TOPICS).find((p) => plain.startsWith(p.replace(/[()]/g, "")));
  add({
    id: `dk_r${index + 1}`,
    type: "dhikr",
    origin: "dhikr",
    text,
    source: meta.ref,
    ref: meta.ref,
    url: meta.url,
    topics: key ? ATHKAR_PREFIX_TOPICS[key] : ["dhikr", "dua"],
  });
});

/* أذكار من `content/azkar.json` (Altaqwaa ٤.٠، مرفقة في المشروع بمصدرها). */
const azkar = json("content/azkar.json");
const azkarCats = new Map(azkar.map((c) => [c.key, c]));
/** كم ذكرًا نأخذ من كل قسم: القسمة على أربعة أقسام رئيسية فقط. */
const AZKAR_PER_CAT = 8;
for (const catKey of ["morning", "evening"]) {
  const category = azkarCats.get(catKey);
  if (!category) {
    fail(`قسم أذكار غير موجود: ${catKey}`);
    continue;
  }
  for (const item of category.array.slice(0, AZKAR_PER_CAT)) {
    /* اسم المصحَّف في عنوان المصدر: «أذكار الصباح - … - النسائي». */
    const source = item.title.split("-").pop().trim();
    add({
      id: `dk_${catKey}_${item.id}`,
      type: "dhikr",
      origin: "dhikr",
      text: item.adhkar,
      source: source || category.category,
      meaning: item.description || undefined,
      ref: item.title,
      topics: ["dhikr"],
    });
  }
}

/* ------------------------------------------------------- 5) القصص والخبر */

/**
 * «قصص الأنبياء» و«السيرة» في المشروع مختصرات تعليمية من إعدادها، وليست
 * نصًّا من كتاب. لذلك تُوسم `editorial_summary` وتذكر ذلك في مصدرها.
 */
const { PROPHETS } = await import(path.join(ROOT, "src/data/prophets.js"));
for (const [index, prophet] of PROPHETS.entries()) {
  add({
    id: `st_p${index + 1}`,
    type: "story",
    origin: "editorial_summary",
    title: `${prophet.title} — ${prophet.desc}`,
    text: prophet.story,
    source: "مختصر تعليمي: قصص الأنبياء (إعداد الموقع)",
    topics: ["quds"],
  });
}

const { SEERAH } = await import(path.join(ROOT, "src/data/seerah.js"));
for (const [index, event] of SEERAH.entries()) {
  add({
    id: `st_s${index + 1}`,
    type: "story",
    origin: "editorial_summary",
    title: `${event.title} (${event.year})`,
    text: event.desc,
    source: "مختصر تعليمي: السيرة النبوية (إعداد الموقع)",
    topics: ["seerah"],
  });
}

/* أقوال العلماء المنسوبة إلى أصحابها — تُنسب كما هي. */
const { SAYINGS } = await import(path.join(ROOT, "src/data/sayings.js"));
for (const [index, saying] of SAYINGS.entries()) {
  add({
    id: `ls_${index + 1}`,
    type: "lesson",
    origin: "quotation",
    text: saying.txt,
    source: saying.author ? `${saying.author} — ${saying.src ?? ""}`.trim() : saying.src,
    ref: saying.src,
    topics: ["khutbah", "obedience"],
  });
}

/* ------------------------------------------------------- 6) التأليف التحريري */

/** معاني الآيات: تأليفنا، ولا يُنسَب إلى مفسّر ولا إلى النبي ﷺ. */
for (const reflection of REFLECTIONS) {
  const key = reflection.about;
  if (!key || !VERSE_TOPICS[key]) fail(`عبرة تشير إلى آية غير مختارة: ${reflection.id} ← ${key}`);
  add({
    id: reflection.id,
    type: "reflection",
    origin: "editorial",
    title: reflection.title,
    text: reflection.text,
    about: key,
    meaning: key,
    topics: [reflection.topic],
  });
}

/** الأعمال العملية: اقتراح اختياري، لا شرع ولا حساب. */
for (const action of ACTIONS) {
  add({
    id: action.id,
    type: "action",
    origin: "editorial",
    text: action.text,
    topics: [action.topic],
  });
}

/* ------------------------------------------------------- 7) الفحص والبناء */

const verseKeys = items.filter((i) => i.type === "verse").map((i) => `${i.surah}:${i.ayah}`);
problems.push(...assertCurationSanity(verseKeys));
const unknownTopics = assertTopicNamesAreKnown(["tadabbur"]);
for (const topic of unknownTopics) fail(`موضوع مستعمل في التوجيه بلا آية: ${topic}`);

const ids = new Set();
for (const item of items) {
  if (ids.has(item.id)) fail(`معرّف مكرر: ${item.id}`);
  ids.add(item.id);
  if (!item.topics?.length) fail(`عنصر بلا موضوع: ${item.id}`);
}

if (problems.length) {
  console.error(`✗ بناء المحتوى فشل في ${problems.length} مشكلة:\n`);
  console.error([...new Set(problems)].map((p) => "  • " + p).join("\n"));
  process.exit(1);
}

/* الموضوعات: من الآية إلى كل ما يخصها، ليجد المحرّك مادة-topic بثغرة. */
const themes = {};
for (const item of items) {
  for (const topic of item.topics) (themes[topic] ??= []).push(item.id);
}

const counts = {};
for (const item of items) counts[item.type] = (counts[item.type] ?? 0) + 1;

const payload = {
  meta: {
    name: "محتوى رفيق النور",
    version: 1,
    builtAt: new Date().toISOString().slice(0, 10),
    disclaimer:
      "نصوص القرآن والأذكار والأدعية والآثار مقتبسة من مصادرها المذكورة أسفل كل عنصر، " +
      "ولا يُنسب إلى النبي ﷺ إلا ما ذُكر مصدره. وما وُسم «تأليف تحريري» فعبرة أو عمل " +
      "عملي من إعداد الموقع، لا يُقدَّم على أنه شرع ولا على أنه كلام النبي ﷺ.",
    sources: [
      "القرآن الكريم: vendor/quran-arabic.json (رواية حفص، AlQuran.cloud — انظر QURAN-DATA-SOURCE.md)",
      "الأذكار والأدعية: src/data/*.js و content/azkar.json (Altaqwaa) — كلٌّ بمصدره",
      "الأحاديث: src/data/hadiths.js و daily.js و app-daily.js — كلٌّ بمصدره ودرجته",
      "المختصرات التعليمية: src/data/prophets.js و seerah.js",
    ],
  },
  types: ["verse", "hadith", "dhikr", "dua", "story", "lesson", "reflection", "action"],
  typeLabels: {
    verse: "قرآن كريم",
    hadith: "حديث",
    dhikr: "ذكر",
    dua: "دعاء",
    story: "قصة",
    lesson: "خبر وأثر",
    reflection: "تدبر",
    action: "عمل صالح",
  },
  counts,
  topics: [...new Set(Object.keys(themes))].sort(),
  /* أسماء السور وعدد آياتها: يحتاجها كشف إتمام السورة لعرض التدبر. */
  surahs: json("content/surahs.json").map((s) => ({ no: s.no, name: s.name, ayahCount: s.verses })),
  items,
  themes,
  surahTopics: SURAH_TOPICS,
  routes: PAGE_ROUTES,
};

/* يُصدَّر سكربتًا عاديًا (لا وحدة ES) ليعمل من كل صفحات الموقع ومن file:. */
const banner =
  "/*\n" +
  " * noor-content.js — محتوى «رفيق النور». مُولَّد آليًّا، لا تعدّله يدويًا.\n" +
  " * المصدر: scripts/noor-curation.mjs  |  البناء: npm run build:noor\n" +
  " * الآيات مستخرجة من vendor/quran-arabic.json، وسائر النصوص من src/data/.\n" +
  ` * عدد العناصر: ${items.length}\n` +
  " */\n";

const source = `${banner}(function (root) {\n` +
  `  var NOOR_CONTENT = ${JSON.stringify(payload, null, 2)};\n` +
  "  root.NOOR_CONTENT = NOOR_CONTENT;\n" +
  '  if (typeof module === "object" && module.exports) module.exports = NOOR_CONTENT;\n' +
  "})(typeof globalThis !== \"undefined\" ? globalThis : this);\n";

const check = process.argv.includes("--check");
if (check) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== source) {
    console.error("✗ noor-content.js لا يطابق ناتج البناء. نفّذ: npm run build:noor");
    process.exit(1);
  }
  console.log(`✔ noor-content.js مطابق للبناء (${items.length} عنصرًا)`);
} else {
  fs.writeFileSync(OUT, source);
  console.log(`✔ بُني noor-content.js — ${items.length} عنصرًا`);
  console.log(`  ${Object.entries(counts).map(([t, n]) => `${payload.typeLabels[t]}: ${n}`).join("  ")}`);
}