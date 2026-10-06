/**
 * عارضات تبويبات تطبيق «بوابة النور» — كل تبويب دالة تعيد HTML.
 * @module app/tabs
 */

import { ATHKAR_DATA } from "../data/app-athkar.js";
import { ATHKAR_REFERENCES, normalizeAthkar } from "../data/review-references.js";
import { APP_DUAS } from "../data/app-duas.js";
import { HADITHS } from "../data/hadiths.js";
import { RADIO_STATIONS } from "../data/radio.js";
import { APP_DAILY_VERSES, APP_DAILY_HADITHS, APP_DAILY_WISDOM, ATHAN_URLS } from "../data/app-daily.js";
import { FORBIDDEN_PRAYER_TIMES, resolveWindow, windowText } from "../data/forbidden-times.js";
import { RECITERS, DEFAULT_RECITER } from "../lib/quran-audio.js";
import { HIJRI_EVENTS } from "../data/hijri-events.js";
import { CITY_LIST } from "../data/cities.js";
import { ADHKAR_T } from "../data/adhkar.js";
import { ENCYCLOPEDIA_CATEGORIES } from "../data/encyclopedia-categories.js";
import { LEARNING_PATHS, getPathProgress, updatePathProgress, getPathOverallProgress } from "../data/learning-paths.js";

import { escapeHtml, toArNum, to12h, normalizeAr, stripHtml } from "../lib/text.js";
import { dailyOf, isHijriToday, hijriShort, weekKey, dateKey } from "../lib/dates.js";
import { read, write, KEYS } from "../lib/storage.js";
import { calculateZakat, calculateMetalZakat, calculateLivestockZakat, tasbihPercent } from "../lib/islamic.js";
import { CALC_METHODS, methodName } from "../lib/api.js";

const card = (title, body, cls = "") =>
  `<div class="card ${cls}"><h3>${escapeHtml(title)}</h3>${body}</div>`;

/** @param {{ cat: string }[]} items @returns {string[]} الفئات المتاحة بترتيب أوّل ظهورها. */
const catsOf = (items) => [...new Set(items.map((item) => item.cat))];

/**
 * شرائح تصفية الفئات: «الكل» ثم الفئات، وأولها نشِط.
 * @param {string[]} cats @param {string} attribute اسم السمة (dua-cat مثلًا)
 */
function catChipsHtml(cats, attribute) {
  const chip = (value, label, active) =>
    `<button type="button" class="chip${active ? " active" : ""}" data-${attribute}="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
  return `<div class="chips" role="group" aria-label="تصفية الفئات">${chip("", "الكل", true)}${cats
    .map((cat) => chip(cat, cat, false))
    .join("")}</div>`;
}

/* ------------------------------- home ------------------------------- */

export function homeTab() {
  const verse = dailyOf(APP_DAILY_VERSES);
  const hadith = dailyOf(APP_DAILY_HADITHS);
  const wisdom = dailyOf(APP_DAILY_WISDOM);
  const tasbih = read(KEYS.tasbihCount, 0);
  const target = read("tasbeeh_target", 33);
  const today = HIJRI_EVENTS.filter((event) => isHijriToday(event.date));
  return `
    <div class="tab-head"><div><h1>بوابة النور</h1><p>الموسوعة الإسلامية — ${escapeHtml(hijriShort())}</p></div></div>
    ${today.length ? `<div class="note-box">🎉 ${today.map((event) => escapeHtml(event.title)).join(" · ")}</div>` : ""}
    <div style="background:var(--card);border:1px solid var(--gold-soft);border-radius:20px;padding:22px;text-align:center;margin-bottom:20px">
      <p style="margin:0 0 14px;font-family:Amiri,serif;font-size:1.1rem;color:var(--gold)">🤔 ماذا تريد أن تفعل؟</p>
      <div class="ask-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">
        ${[
          ["📖","قراءة القرآن","quran"],["🤲","أذكار الصباح","athkar"],["🕰️","مواقيت الصلاة","prayer"],
          ["📕","البحث عن حديث","hadith"],["🕌","تعلم الصلاة",""],["⚖️","تعلم الفقه",""],
          ["🌟","قصة نبي",""],["🧮","حاسبة الزكاة","zakat"],["🧭","اتجاه القبلة",""],
          ["📿","السبحة","athkar"],["🧒","قسم الأطفال",""],["📚","اختبار",""],["🧭","مسار تعلم","learning"],["✨","اكتشف جديدًا","discover"],
        ].map(([em,label,tab])=>`<button class="btn ${tab?"primary":"ghost"}" style="width:100%;justify-content:center" data-goto="${tab||""}" onclick="${tab?`switchTab('${tab}')`:``}">${em} ${label}</button>`).join("")}
      </div>
    </div>
    ${card("آية اليوم", `<p class="quran-text">${escapeHtml(verse.text)}</p><span class="ref">${escapeHtml(verse.ref)}</span>`)}
    ${card("حديث اليوم", `<p style="font-family:Amiri,serif">${escapeHtml(hadith.text)}</p><span class="ref">${escapeHtml(hadith.ref)}</span>`)}
    ${card("حكمة اليوم", `<p style="font-family:Aref Ruqaa,serif">${escapeHtml(wisdom.text)}</p><span class="ref">${escapeHtml(wisdom.ref)}</span>`)}
    ${card("السبحة", `<p>${toArNum(tasbih)} / ${target ? toArNum(target) : "بلا هدف"}</p>
      <div class="tasbih-bar"><span style="width:${tasbihPercent(tasbih, target)}%"></span></div>
      <button class="btn primary" data-role="open-tasbih">📿 افتح السبحة</button>`)}
    ${card("الموسوعة الإسلامية", `<p>تصفّح القرآن، الحديث، التفسير، الفقه، السيرة، الأذكار، الأخلاق، التاريخ، والمكتبة — كلّها مرتبطة ببعضها.</p>
      <button class="btn primary" data-goto="encyclopedia">📖 دخول الموسوعة</button>`)}
    ${card("اختصارات", `<div class="chips">${[
      ["quran", "📖 المصحف"], ["athkar", "🕌 الأذكار"], ["prayer", "🕰️ المواقيت"],
      ["zakat", "🧮 الزكاة"], ["hadith", "📚 الحديث"], ["dua", "🤲 الأدعية"],
      ["khatma", "📋 الختمة"], ["media", "📻 الإذاعة"], ["cards", "🖼️ البطاقات"],
      ["sadaka", "💚 صدقة جارية"], ["tracker", "📈 المتابعة"], ["settings", "⚙️ الإعدادات"],
    ].map(([id, label]) => `<button class="chip" data-goto="${id}">${label}</button>`).join("")}</div>`)}
  `;
}

/* ------------------------------ quran ------------------------------ */

export function quranTab() {
  const fontSize = read(KEYS.quranFontSize, 24);
  const reciter = Number(read(KEYS.reciter, DEFAULT_RECITER)) || DEFAULT_RECITER;
  const focusing = Boolean(read(KEYS.focusMode, false));
  const bookmarks = read(KEYS.quranBookmarks, []);
  const ward = read(KEYS.quranWard, { target: 1, done: 0 });
  return `
    <div class="tab-head"><div><h1>المصحف</h1><p>١١٤ سورة — تُحمَّل من AlQuran Cloud</p></div></div>
    ${card("الورد اليومي", `<p>الهدف: ${toArNum(ward.target)} صفحة · المنجز: ${toArNum(ward.done)}</p>
      <div class="tasbih-bar"><span style="width:${Math.min(100, Math.round((ward.done / Math.max(1, ward.target)) * 100))}%"></span></div>
      <label class="lbl">هدف الورد (صفحات)
        <input type="number" id="wardTarget" value="${Number(ward.target) || 1}" min="1" max="60"></label>
      <button class="btn" data-role="ward-plus">✓ تسجيل صفحة</button>`)}
    ${card("المصحف", `
      <div class="audio-bar">
        <button class="btn" data-role="surah-prev">⏮</button>
        <button class="btn primary" data-role="play">▶ تشغيل</button>
        <button class="btn" data-role="surah-next">⏭</button>
        <input type="range" id="quranFont" min="18" max="30" step="2" value="${Number(fontSize)}" aria-label="حجم خط المصحف">
        <button class="btn" data-role="focus" aria-pressed="${focusing}">${focusing ? "↩️ خروج من التركيز" : "👁️ وضع التركيز"}</button>
      </div>
      <div class="audio-bar">
        <label class="lbl" for="reciterSelect">القارئ
          <select class="search" id="reciterSelect">${RECITERS.map(
            (item) =>
              `<option value="${item.id}" ${item.id === reciter ? "selected" : ""}>${escapeHtml(`${item.name} — ${item.style}`)}</option>`,
          ).join("")}</select></label>
      </div>
      <p id="surahMeta">—</p>
      <div class="audio-bar">
        <button class="btn" data-role="save-surah" id="saveSurahBtn" aria-label="حفظ السورة للعمل بدون إنترنت">⬇️ حفظ للعمل بدون إنترنت</button>
        <button class="btn" data-role="bulk-cache" id="bulkCacheBtn" aria-label="تفريغ ١٠ سور قصيرة للعمل بدون إنترنت">📥 تفريغ ١٠ سور</button>
        <button class="btn ghost" data-role="clear-cache" id="clearCacheBtn" aria-label="حذف السور المخزّنة">🗑️ حذف المخزَّن</button>
      </div>
      <p class="note-line" id="cacheStatus" aria-live="polite">المصحف يُجلب من الشبكة؛ احفظ السورة للقراءة بدون إنترنت.</p>
      <div class="audio-bar" role="group" aria-label="أدوات قراءة المصحف">
        <button class="btn" data-role="toggle-tajweed" aria-pressed="false">🎨 التجويد</button>
        <button class="btn" data-role="toggle-wbw" aria-pressed="false">🔤 كلمة بكلمة</button>
        <button class="btn" data-role="tafsir" aria-pressed="false">📚 التفسير</button>
        <button class="btn" data-role="copy-ayah" id="copyAyahBtn" aria-label="نسخ الآية مع مرجعها">📋 نسخ الآية</button>
        <button class="btn ghost" data-role="bookmark-ayah" aria-pressed="false" aria-label="حفظ علامة على الآية الحالية">🔖 حفظ العلامة</button>
      </div>
      <div class="chips" id="tafsirOptions" hidden role="group" aria-label="نوع التفسير">
        <button class="chip active" data-tafsir="ar.muyassar">الميسّر</button>
        <button class="chip" data-tafsir="ar.jalalayn">الجلالين</button>
        <button class="chip" data-tafsir="en.sahih">English</button>
      </div>
      <p class="note-line" id="readStatus" aria-live="polite"></p>
      <div id="quranBody" class="quran-text" aria-live="polite">جارٍ التحميل…</div>
      <div id="tafsirBody" class="tafsir-body" hidden></div>`)}
    ${card("العلامات", `<div id="bookmarksHolder">${bookmarksHtml(read(KEYS.quranBookmarks, []))}</div>`)}
    ${card("قائمة السور", `<input class="search" id="surahSearch" type="search" placeholder="ابحث باسم السورة أو رقمها…">
      <select class="search" id="surahType"><option value="">الكل</option><option value="Meccan">مكية</option><option value="Medinan">مدنية</option></select>
      <div class="surah-list" id="surahList"><p class="empty">جارٍ التحميل…</p></div>`)}
  `;
}
/** نوع السورة: المفتاح الإنجليزي للتصفية، والاسم العربي للعرض. */
const SURAHS = [
  [1, "الفاتحة", 7, "Meccan"], [2, "البقرة", 286, "Medinan"], [3, "آل عمران", 200, "Medinan"],
  [4, "النساء", 176, "Medinan"], [5, "المائدة", 120, "Medinan"], [6, "الأنعام", 165, "Meccan"],
  [7, "الأعراف", 206, "Meccan"], [8, "الأنفال", 75, "Medinan"], [9, "التوبة", 129, "Medinan"],
  [10, "يونس", 109, "Meccan"], [18, "الكهف", 110, "Meccan"], [36, "يس", 83, "Meccan"],
  [55, "الرحمن", 78, "Meccan"], [56, "الواقعة", 96, "Meccan"], [67, "الملك", 30, "Meccan"],
  [112, "الإخلاص", 4, "Meccan"], [113, "الفلق", 5, "Meccan"], [114, "الناس", 6, "Meccan"],
];

/** اسم السورة عربيًّا كما يُعرض. */
const SURAH_TYPE_LABEL = { Meccan: "مكية", Medinan: "مدنية" };

/**
 * يحوّل قائمة العلامات المحفوظة إلى شرائح قابلة للنقر.
 * كل علامة بصيغة `surah:ayah` (رقم السورة:رقم الآية) وهي نفسها معرّف الشريحة،
 * فالنصّ المعروض اسمٌ مقروء منها لا مصدرٌ ثاني.
 * @param {string[]} list
 */
export function bookmarksHtml(list) {
  if (!Array.isArray(list) || !list.length) {
    return `<p>لا توجد علامات — اضغط «🔖 حفظ العلامة» داخل المصحف.</p>`;
  }
  return `<div class="chips" role="group" aria-label="العلامات المحفوظة">${list
    .map((item) => {
      const [surah, ayah] = parseBookmark(item);
      const name = surahName(surah);
      const label = name ? `${name} — ${toArNum(ayah)}` : escapeHtml(item);
      return `<button type="button" class="chip" data-goto-ayah="${escapeHtml(item)}" aria-label="اذهب إلى ${escapeHtml(label)}">${escapeHtml(label)}</button>`;
    })
    .join("")}</div>`;
}

/** يفكّ العلامة إلى رقمين، ويعيد [0,0] إن كانت غير صالحة. */
export function parseBookmark(item) {
  const match = /^(\d+)\s*:\s*(\d+)$/.exec(String(item ?? "").trim());
  return match ? [Number(match[1]), Number(match[2])] : [0, 0];
}

/** اسم السورة في القائمة المختصرة، أو نص فارغ إن لم تكن فيها. */
function surahName(number) {
  return SURAHS.find(([id]) => id === number)?.[1] ?? "";
}

/** يبني معرّف العلامة الذي يُخزَّن ويُقرأ. */
export function bookmarkKey(surah, ayah) {
  return `${surah}:${ayah}`;
}

export function surahOptions(list = SURAHS) {
  return list
    .map(
      ([number, name, verses, type]) =>
        `<button class="surah-row" data-surah="${number}" data-type="${type}">
          <span>${escapeHtml(name)}</span><span class="meta">${toArNum(number)} · ${toArNum(verses)} آية · ${SURAH_TYPE_LABEL[type] ?? ""}</span>
          <span class="cached-mark" aria-hidden="true"></span></button>`,
    )
    .join("");
}

/**
 * يختار السور القصيرة المناسبة للتفريغ السريع (أقل من ٣٠ آية).
 * @returns {number[]}
 */
export function shortSurahs() {
  return SURAHS.filter(([, , verses]) => verses <= 30).map(([number]) => number);
}

/* ------------------------------ khatma ------------------------------ */

export function khatmaTab() {
  const state = read(KEYS.khatma, { parts: new Array(30).fill(false) });
  const assignees = read(KEYS.khatmaAssignees, {});
  const dedication = read(KEYS.khatmaDedication, "");
  const done = state.parts.filter(Boolean).length;
  return `
    <div class="tab-head"><div><h1>الختمة الجماعية</h1><p>${toArNum(done)} من ٣٠ جزءًا</p></div></div>
    ${card("الإهداء", `<input class="search" id="khatmaDedication" value="${escapeHtml(dedication)}" placeholder="إهداء أو تخصيص…">`)}
    ${card("الأجزاء", `<div class="juz-grid">${state.parts
      .map(
        (doneFlag, index) => `<button class="juz ${doneFlag ? "done" : ""} ${assignees[index] ? "reserved" : ""}" data-juz="${index}">
        <span class="juz-no">${toArNum(index + 1)}</span>${doneFlag ? "✓ تم" : "احجز"}
        ${assignees[index] ? `<span class="meta">👤 ${escapeHtml(assignees[index])}</span>` : ""}</button>`,
      )
      .join("")}</div>`)}
    ${card("المشاركة والمزامنة", `<div class="quiz-actions">
      <button class="btn primary" data-role="khatma-link">🔗 رابط المزامنة</button>
      <button class="btn ghost" data-role="khatma-txt">📄 تصدير TXT</button>
      <button class="btn ghost" data-role="khatma-reset">🗑️ تصفير</button>
    </div><p class="note-line">الرابط يحمل الحالة داخله (base64) — لا خادم ولا حساب.</p>`)}
    ${card("إسناد مُسند", `<input class="search" id="assigneeName" placeholder="اسم المُسند…">
      <select class="search" id="assigneeJuz">${state.parts
        .map((_, index) => `<option value="${index}">الجزء ${toArNum(index + 1)}</option>`)
        .join("")}</select>
      <button class="btn" data-role="khatma-assign">إسناد</button>`)}
  `;
}

/* ------------------------------ athkar ------------------------------ */

export function athkarTab() {
  const streak = read(KEYS.athkarStreak, 0);
  const progress = read(KEYS.athkarProgress, {});
  return `
    <div class="tab-head"><div><h1>الأذكار</h1><p>ستريك: ${toArNum(streak)} يومًا</p></div></div>
    <div class="warn-box">⚠️ الأذكار مأخوذة من مختصر الكتاب، وقد يُقتطع في بعض الأذكار — راجع أهل العلم قبل الاعتماد عليها في وردك.</div>
    <div class="chips" id="athkarSubTabs">
      <button class="chip active" data-subtab="athkar">الأذكار</button>
      <button class="chip" data-subtab="tasbih">📿 السبحة</button>
    </div>
    <div id="athkarSubTabContent">
      <div class="chips">${ATHKAR_DATA.map(
        (group, index) => `<button class="chip ${index === 0 ? "active" : ""}" data-athkar="${index}">${escapeHtml(group.category)}</button>`,
      ).join("")}</div>
      ${renderAthkarItems(ATHKAR_DATA[0], progress)}
    </div>
    <div id="tasbeehSubTabContent" hidden>${tasbihPanel()}</div>
    <button class="btn ghost" data-role="athkar-reset">↺ تصفير العدّاد</button>
  `;
}

export function renderAthkarItems(group, progress = {}) {
  return `<div class="cards-grid">${group.items
    .map((item, index) => {
      const normalized = normalizeAthkar(item);
      const reference = ATHKAR_REFERENCES[normalized.text];
      return `<div class="card">
      <p style="font-family:Amiri,serif">${escapeHtml(normalized.text)}</p>
      <span class="meta">× ${toArNum(normalized.count)}${progress[index] ? " ✓" : ""}</span>
      ${reference ? `<a class="ref" href="${escapeHtml(reference.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(reference.ref)}</a>` : ""}
      <button class="btn" data-dhikr="${index}">تم</button></div>`;
    })
    .join("")}</div>`;
}

export function tasbihPanel() {
  const count = read(KEYS.tasbihCount, 0);
  const total = read("total_all_tasbeeh", 0);
  const target = read("tasbeeh_target", 33);
  return `<div class="card tasbih">
    <select class="search" id="tasbihSelect">${ADHKAR_T.map(
      (item, index) => `<option value="${index}">${escapeHtml(item)}</option>`,
    ).join("")}</select>
    <button class="btn primary tasbih-btn" id="tasbihBtn" aria-label="تسبيح">${toArNum(count)}</button>
    <div class="tasbih-bar"><span id="tasbihBar" style="width:${tasbihPercent(count, target)}%"></span></div>
    <p class="meta">الهدف: ${target ? toArNum(target) : "بلا هدف"} · الإجمالي: ${toArNum(total)}</p>
    <select class="search" id="tasbihTarget">${[33, 99, 100, 200, 0]
      .map((value) => `<option value="${value}" ${value === Number(target) ? "selected" : ""}>${value ? toArNum(value) : "بلا هدف"}</option>`)
      .join("")}</select>
  </div>`;
}

/* ------------------------------ prayer ------------------------------ */

export function prayerTab() {
  const timings = read("prayer_timings", null);
  const method = Number(read(KEYS.calcMethod, 5));
  const notifBefore = Number(read(KEYS.notifBefore, 10));
  return `
    <div class="tab-head"><div><h1>مواقيت الصلاة</h1><p>${escapeHtml(methodName(method))}</p></div></div>
    ${card("المدينة", `<select class="search" id="citySelect">${CITY_LIST.map(
      (city) => `<option value="${escapeHtml(city.en)}">${escapeHtml(city.ar)}</option>`,
    ).join("")}</select>
    <div class="quiz-actions">
      <button class="btn primary" data-role="load-times">جلب المواقيت</button>
      <button class="btn ghost" data-role="locate-app">📍 تحديد موقعي</button>
    </div>`)}
    ${timings
      ? card("الصلاة القادمة", `<h3 id="nextPrayerName">—</h3><p id="nextPrayerHumanTime">—</p>
         <div class="grid-2" id="prayerTimes">${renderTimings(timings)}</div>`)
      : `<p class="empty">اختر مدينتك ثم اضغط «جلب المواقيت».</p>`}
    ${card("الإعدادات", `<label class="lbl">طريقة الحساب
        <select class="search" id="calcMethod">${CALC_METHODS.map(
          (value) => `<option value="${value}" ${value === method ? "selected" : ""}>${escapeHtml(methodName(value))}</option>`,
        ).join("")}</select></label>
      <label class="lbl">تنبيه قبل الأذان بـ
        <select class="search" id="notifBefore">${[5, 10, 15]
          .map((value) => `<option value="${value}" ${value === notifBefore ? "selected" : ""}>${toArNum(value)} دقائق</option>`)
          .join("")}</select></label>
      <button class="btn" data-role="test-athan">🔊 تجربة صوت الأذان</button>
      <p class="note-line">المواقيت محسوبة جغرافيًا، والعبادة بالحكم المحلي. وعلى iOS يعمل الإشعار بعد تثبيت التطبيق على الشاشة الرئيسية.</p>`)}
    ${card("الأوقات المنوعة عن الذكر", `<p>الثلث الأخير من الليل: بعد ${toArNum("٠٣:٠٠")} إلى الفجر.</p>
      <p>وقت طلوع الشمس: من طلوع الفجر حتى الشروق.</p>`)}
    ${card("أوقات النهي عن الصلاة", forbiddenTimesHtml(timings))}
  `;
}

/**
 * بطاقة أوقات النهي عن الصلاة، وتعرض الوقت الفعلي لليوم إن جُلبت المواقيت.
 * @param {Record<string, string> | null} timings
 */
function forbiddenTimesHtml(timings) {
  const rows = FORBIDDEN_PRAYER_TIMES.map((item) => {
    const window = timings ? resolveWindow(item, timings) : null;
    return `<div class="forbidden-row">
      <div class="t">${escapeHtml(item.title)}</div>
      <div class="when">${window ? escapeHtml(windowText(window)) : "— جلب المواقيت لحساب التوقيت اليومي —"}</div>
      <p>${escapeHtml(item.detail)}</p>
      <p class="note-line">${escapeHtml(item.note)}</p>
      ${item.evidence
        .map(
          (line) =>
            `<blockquote class="ayah-quote">${escapeHtml(line.ayah)}<span class="ref">${escapeHtml(line.ref)}</span></blockquote>`,
        )
        .join("")}
    </div>`;
  }).join("");

  return `<p class="note-line">الصلاة لها أوقاتٌ محدّدة يجب حفظها، وهذه ثلاثةٌ منها لا تصلىّ فيها.</p>
    ${rows}
    <p class="note-line">أوقات المنع من السنّة، والآيات أعلاه أصل التوقيت لا نصّ المنع فيحده — ولم يُذكر فيه شيء برقمه بعد.</p>`;
}

function renderTimings(timings) {
  const rows = [["Fajr", "الفجر"], ["Sunrise", "الشروق"], ["Dhuhr", "الظهر"], ["Asr", "العصر"], ["Maghrib", "المغرب"], ["Isha", "العشاء"]];
  return rows
    .map(
      ([key, label]) => `<div class="stat-box"><div class="num">${escapeHtml(timings[key] ?? "—")}</div><div class="lbl">${label}</div></div>`,
    )
    .join("");
}

/* ------------------------------ tracker ------------------------------ */

export function trackerTab() {
  const tracker = read(KEYS.prayerTracker, {});
  const today = dateKey();
  const week = buildWeekChart();
  return `
    <div class="tab-head"><div><h1>المتابعة والورد</h1><p>متابعة الصلاة اليومية</p></div></div>
    ${card("متابعة اليوم", `<div class="grid-2">${["الفجر", "الظهر", "العصر", "المغرب", "العشاء"]
      .map(
        (name) => `<button class="btn ${tracker[`${today}:${name}`] ? "primary" : ""}" data-prayer="${escapeHtml(name)}">
        ${name} ${tracker[`${today}:${name}`] ? "✓" : ""}</button>`,
      )
      .join("")}</div>`)}
    ${card("آخر ٧ أيام", `<div class="tasbih-bar" style="height:14px"></div>
      <div class="grid-2">${week
        .map((day) => `<div class="stat-box"><div class="num">${toArNum(day.count)}</div><div class="lbl">${escapeHtml(day.label)}</div></div>`)
        .join("")}</div>`)}
    ${card("البيانات", `<div class="quiz-actions">
      <button class="btn ghost" data-role="export-data">📤 تصدير JSON</button>
      <button class="btn ghost" data-role="import-data">📥 استيراد</button>
    </div>`)}
  `;
}

function buildWeekChart() {
  const tracker = read(KEYS.prayerTracker, {});
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(Date.now() - (6 - offset) * 86400000);
    const key = dateKey(date);
    const count = Object.keys(tracker).filter((entry) => entry.startsWith(key) && tracker[entry]).length;
    return { label: new Intl.DateTimeFormat("ar-EG", { weekday: "short" }).format(date), count };
  });
}

/* ------------------------------ dua ------------------------------ */

export function duaTab() {
  return `
    <div class="tab-head"><div><h1>مكتبة الأدعية</h1><p>${toArNum(APP_DUAS.length)} دعاءً</p></div></div>
    ${card("ابحث", `<input class="search" id="duaSearch" type="search" placeholder="ابحث في الأدعية…">
      ${catChipsHtml(catsOf(APP_DUAS), "dua-cat")}
      <div id="duaList">${duaListHtml(APP_DUAS, "")}</div>
      <p class="note-line">الأدعية منقولة عن الكتاب والسنة — راجع أهل العلم قبل العمل بها.</p>`)}
  `;
}

export function duaListHtml(items, category) {
  const filtered = category ? items.filter((item) => item.cat === category) : items;
  if (filtered.length === 0) return `<p class="empty">لا توجد أدعية مطابقة.</p>`;
  return `<div class="cards-grid">${filtered
    .map(
      (item, index) => `<div class="card">
      <span class="badge">${escapeHtml(item.cat)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p style="font-family:Amiri,serif">${escapeHtml(item.text)}</p>
      <span class="ref">${escapeHtml(item.ref)}</span>
      <button class="btn ghost" data-copy-dua="${index}">📋 نسخ</button></div>`,
    )
    .join("")}</div>`;
}

/* ------------------------------ media ------------------------------ */

export function mediaTab() {
  return `
    <div class="tab-head"><div><h1>الإذاعة</h1><p>${toArNum(RADIO_STATIONS.length)} محطة</p></div></div>
    ${card("المشغّل", `<div class="audio-bar">
      <button class="btn primary" data-role="radio-play">▶ تشغيل</button>
      <input type="range" id="radioVolume" min="0" max="100" value="${Number(read(KEYS.radioVolume, 80))}" aria-label="مستوى الصوت">
      <span id="radioNow" class="meta">لم تُشغَّل محطة بعد</span>
    </div>
    <div class="audio-bar" role="group" aria-label="مؤقّت النوم">
      <span class="meta">مؤقّت النوم:</span>
      ${[15, 30, 60].map((minutes) => `<button class="btn ghost" data-role="sleep-timer" data-minutes="${minutes}">${toArNum(minutes)}د</button>`).join("")}
      <button class="btn ghost" data-role="sleep-cancel">إلغاء</button>
    </div>
    <p class="note-line" id="sleepStatus" aria-live="polite"></p>`)}
    ${card("المحطات", `<input class="search" id="radioSearch" type="search" placeholder="ابحث عن محطة…">
      ${catChipsHtml(catsOf(RADIO_STATIONS), "radio-cat")}
      <div class="radio-list" id="radioList">${radioListHtml(RADIO_STATIONS, "")}</div>`)}
  `;
}

export function radioListHtml(stations, category, query = "") {
  const needle = normalizeAr(query);
  const filtered = stations.filter(
    (station) =>
      (!category || station.cat === category) &&
      (!needle || normalizeAr(`${station.name} ${station.cat}`).includes(needle)),
  );
  if (filtered.length === 0) return `<p class="empty">لا توجد محطات مطابقة.</p>`;
  return filtered
    .map(
      (station, index) => `<button class="radio-row" data-station="${index}">
      <span>${escapeHtml(station.name)}</span><span class="meta">${escapeHtml(station.cat)}</span></button>`,
    )
    .join("");
}

/* ------------------------------ cards ------------------------------ */

/** @type {{ key: string, name: string, text: string, ref: string }[]} */
export const CARD_TEMPLATES = [
  { key: "sick", name: "للمريض", text: "﴿اللَّهُمَّ رَبَّ النَّاسِ، أَذْهِبِ الْبَاسَ، اشْفِ أَنْتَ الشَّافِي﴾", ref: "[دعاء للمريض]" },
  { key: "parents", name: "للوالدين", text: "﴿رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا﴾", ref: "[الإسراء: ٢٤]" },
  { key: "deceased", name: "للمتوفى", text: "﴿اللَّهُمَّ اغْفِرْ لَهُ وَارْحَمْهُ وَعَافِهِ وَاعْفُ عَنْهُ﴾", ref: "[دعاء للمتوفى]" },
  { key: "eid", name: "للعيد", text: "﴿تَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُمْ، وَكُلُّ عَامٍ وَأَنْتُمْ بِخَيْرٍ﴾", ref: "[عيد مبارك]" },
  { key: "ramadan", name: "رمضان", text: "﴿شَهْرُ رَمَضَانَ الَّذِي أُنزِلَ فِيهِ الْقُرْآنُ هُدًى لِّلنَّاسِ﴾", ref: "[البقرة: ١٨٥]" },
  { key: "general", name: "عام", text: "﴿رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً﴾", ref: "[البقرة: ٢٠١]" },
];

/** @type {Array<[string, number, number]>} */
export const CARD_SIZES = [["مربّع", 600, 600], ["أفقي", 800, 600], ["عمودي", 600, 800]];

export function cardsTab() {
  return `
    <div class="tab-head"><div><h1>صانع البطاقات</h1><p>${toArNum(CARD_TEMPLATES.length)} قوالب × ${toArNum(CARD_SIZES.length)} مقاسات</p></div></div>
    ${card("القوالب", `<div class="chips">${CARD_TEMPLATES.map(
      (template, index) => `<button class="chip ${index === 0 ? "active" : ""}" data-template="${index}">${escapeHtml(template.name)}</button>`,
    ).join("")}</div>
    <div class="chips">${CARD_SIZES.map(
      ([name], index) => `<button class="chip ${index === 0 ? "active" : ""}" data-size="${index}">${escapeHtml(name)}</button>`,
    ).join("")}</div>`)}
    ${card("المحتوى", `<label class="lbl">النص<textarea class="search" id="cardText" rows="3"></textarea></label>
      <label class="lbl">المصدر<input class="search" id="cardRef"></label>
      <label class="lbl">المرسل<input class="search" id="cardFrom"></label>
      <canvas class="card-canvas" id="cardCanvas" width="600" height="600"></canvas>
      <div class="quiz-actions">
        <button class="btn primary" data-role="card-draw">تحديث</button>
        <button class="btn ghost" data-role="card-download">💾 تنزيل PNG</button>
        <button class="btn ghost" data-role="card-copy">📋 نسخ النص</button>
      </div>`)}
  `;
}

/* ------------------------------ hadith ------------------------------ */

export function hadithTab() {
  return `
    <div class="tab-head"><div><h1>مكتبة الحديث</h1><p>${toArNum(HADITHS.length)} أحاديث مختارة</p></div></div>
    <p class="note-line">أحاديث مختارة لا مكتبة كاملة — والتخريج منقول عن المصدر، وراجع أهل العلم في دقة النسبة.</p>
    ${card("البحث", `<input class="search" id="hadithSearch" type="search" placeholder="ابحث في الحديث…">
      ${catChipsHtml(catsOf(HADITHS), "hadith-cat")}
      <div id="hadithList">${hadithListHtml(HADITHS, "")}</div>`)}
  `;
}

export function hadithListHtml(items, category, query = "") {
  const needle = normalizeAr(query);
  const filtered = items.filter(
    (item) =>
      (!category || item.cat === category) &&
      (!needle || normalizeAr(`${item.title} ${item.text}`).includes(needle)),
  );
  if (filtered.length === 0) return `<p class="empty">لا توجد أحاديث مطابقة.</p>`;
  return filtered
    .map(
      (item) => `<div class="card">
      <span class="badge">${escapeHtml(item.cat)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p style="font-family:Amiri,serif">${escapeHtml(item.text)}</p>
      <span class="ref">${escapeHtml(item.ref)}</span>
      <button class="btn ghost" data-copy-text="${escapeHtml(item.text)}">📋 نسخ</button></div>`,
    )
    .join("");
}

/* ------------------------------ zakat ------------------------------ */

export function zakatTab() {
  return `
    <div class="tab-head"><div><h1>حاسبة الزكاة</h1><p>نسبة المال ٢.٥٪</p></div></div>
    <div class="zakat-tabs" id="zakatTabs">
      <button class="chip active" data-zakat="money">💵 نقود</button>
      <button class="chip" data-zakat="gold">🥇 ذهب وفضة</button>
      <button class="chip" data-zakat="stocks">📈 أسهم وعقارات</button>
      <button class="chip" data-zakat="livestock">🐄 أنعام</button>
    </div>
    <div id="zakatPanel">${zakatPanelHtml("money")}</div>
    <p class="note-line">الزكاة لا تُحسب بالسوق مباشرة، وحكم عروض التجارة يُراجَع مع أهل العلم المعاصرين — راجع عالم دين معاصر.</p>
  `;
}

export function zakatPanelHtml(kind) {
  if (kind === "gold") {
    return `<div class="card">
      <p class="note-line">هل الذهب والفضة للتجارة أم للزينة؟ النصاب يجب في التجارة ولا يجب في الزينة على المذهب المشهور.</p>
      <label class="lbl" for="metalHolding">الذهب
        <select class="search" id="metalHolding">
          <option value="trade" selected>للتجارة أو الادخار — تجب الزكاة</option>
          <option value="jewelry">زينة تُلبس — لا يجب زكاة النصاب</option>
        </select></label>
      <label class="lbl">وزن الذهب (جرام)<input class="search" type="number" id="goldWeight" value="85"></label>
      <label class="lbl">سعر الجرام<input class="search" type="number" id="goldPrice" placeholder="مثال: ٢٥٠"></label>
      <label class="lbl">وزن الفضة (جرام)<input class="search" type="number" id="silverWeight" value="595"></label>
      <label class="lbl">سعر جرام الفضة<input class="search" type="number" id="silverPrice"></label>
      <button class="btn primary" data-role="zakat-metal">احسب</button>
      <div class="result-box" id="zakatResult">—</div></div>`;
  }
  if (kind === "stocks") {
    return `<div class="card">
      <label class="lbl">قيمة الأسهم<input class="search" type="number" id="stocksValue"></label>
      <label class="lbl">قيمة العقارات (عروض تجارة)<input class="search" type="number" id="realEstateValue"></label>
      <label class="lbl">الديون<input class="search" type="number" id="debts" value="0"></label>
      <button class="btn primary" data-role="zakat-trade">احسب</button>
      <div class="result-box" id="zakatResult">—</div></div>`;
  }
  if (kind === "livestock") {
    return `<div class="card">
      <label class="lbl">عدد الإبل<input class="search" type="number" id="camels" value="0"></label>
      <label class="lbl">عدد البقر<input class="search" type="number" id="cows" value="0"></label>
      <label class="lbl">عدد الغنم<input class="search" type="number" id="sheep" value="0"></label>
      <button class="btn primary" data-role="zakat-livestock">احسب</button>
      <div class="result-box" id="zakatResult">—</div>
      <p class="note-line">النصاب: ٥ إبل · ٣٠ بقرة · ٤٠ شاة، وتُؤخذ زكاة الأنعام السائمة آنًا حليًّا.</p></div>`;
  }
  return `<div class="card">
    <label class="lbl">المبلغ (نقدًا أو ما قيمته)<input class="search" type="number" id="cashAmount"></label>
    <label class="lbl">الدين<input class="search" type="number" id="cashDebts" value="0"></label>
    <button class="btn primary" data-role="zakat-money">احسب</button>
    <div class="result-box" id="zakatResult">—</div></div>`;
}

/* ------------------------------ sadaka ------------------------------ */

export function sadakaTab() {
  const cards_ = read(KEYS.sadakaCards, []);
  return `
    <div class="tab-head"><div><h1>صدقة جارية</h1><p>${toArNum(cards_.length)} بطاقة</p></div></div>
    <button class="btn primary" data-role="sadaka-new">➕ إنشاء بطاقة</button>
    ${cards_.length
      ? `<div class="cards-grid" style="margin-block-start:14px">${cards_
        .map(
          (item) => `<div class="card">
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.desc ?? "")}</p>
          <span class="meta">${item.amount ? `${toArNum(item.amount)}` : ""}</span>
          <div class="quiz-actions">
            <button class="btn ghost" data-sadaka-archive="${escapeHtml(item.id)}">${item.archived ? "📂 تفعيل" : "🗃️ أرشفة"}</button>
            <button class="btn ghost" data-sadaka-delete="${escapeHtml(item.id)}">🗑️ حذف</button>
          </div></div>`,
        )
        .join("")}</div>`
      : `<p class="empty">لا توجد بطاقات صدقة بعد — أنشئ أول بطاقة.</p>`}
  `;
}

export function learningTab() {
  return `
    <div class="tab-head"><div><h1>🧭 مسارات التعلم</h1><p>بوابة النور — نور الهدى</p></div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px">
      ${LEARNING_PATHS.map(path => {
        const progress = getPathOverallProgress(path.id);
        return `<a href="../45-learning-paths.html#path-${path.id}" style="display:flex;flex-direction:column;gap:10px;padding:20px;background:var(--card);border:1px solid var(--line);border-radius:20px;text-decoration:none;color:var(--ink);transition:transform .15s ease,box-shadow .15s ease" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,.08)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
          <div class="top"><span class="icon">${path.icon}</span><span class="title">${path.title}</span></div>
          <p class="desc">${path.description}</p>
          <div class="progress"><div class="progress-bar" style="width:${progress}%"></div></div>
          <p style="font-size:.75rem;color:var(--ink-soft);margin:0">${progress}% مكتمل</p>
        </a>`;
      }).join("")}
    </div>
  `;
}

export { ATHAN_URLS, stripHtml, to12h, calculateZakat, calculateMetalZakat, calculateLivestockZakat, weekKey };

export function encyclopediaTab() {
  const cats = ENCYCLOPEDIA_CATEGORIES.map(cat => {
    const url = cat.route.startsWith("http") || cat.route.startsWith("./") || cat.route.startsWith("../")
      ? cat.route
      : "../" + cat.route;
    return `<a href="${url}" style="display:flex;flex-direction:column;gap:8px;padding:18px;background:var(--card);border:1px solid var(--line);border-radius:18px;text-decoration:none;color:var(--ink);transition:transform .15s ease,box-shadow .15s ease" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,.08)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
      <div style="display:flex;align-items:center;gap:10px"><span style="font-size:1.8rem">${cat.icon}</span><span style="font-family:Amiri,serif;font-size:1.15rem">${cat.title}</span></div>
      <p style="font-size:.82rem;color:var(--muted);margin:0">${cat.description}</p>
    </a>`;
  }).join("");
  return `
    <div class="tab-head"><div><h1>📖 الموسوعة الإسلامية</h1><p>بوابة النور — نور الهدى</p></div></div>
    <div style="background:var(--card);border:1px solid var(--gold-soft);border-radius:20px;padding:22px;text-align:center;margin-bottom:20px">
      <p style="margin:0 0 14px;font-family:Amiri,serif;font-size:1.1rem;color:var(--gold)">🤔 ماذا تريد أن تفعل؟</p>
      <div class="ask-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px">
        ${[
          ["📖","قراءة القرآن","../30-quran-full.html"],
          ["🕌","تعلم الصلاة","../24-ibadat.html"],
          ["🤲","أذكار الصباح","../25-azkar-shamila.html#sabah"],
          ["📕","البحث عن حديث","../27-hadith.html"],
          ["⚖️","تعلم الفقه","../src/site/noor.html#sections"],
          ["🕌","قراءة السيرة","../9-seerah.html"],
          ["🌟","قصة نبي","../8-qasas-anbiya.html"],
          ["🧮","حاسبة الزكاة","../10-zakat.html"],
          ["🧭","اتجاه القبلة","../22-qibla.html"],
          ["📿","السبحة الإلكترونية","../15-tasbeeh-jamai.html"],
          ["🧒","قسم الأطفال","../13-kids-adab.html"],
          ["📚","الاختبارات","../41-quiz.html"],
        ].map(([em,label,href])=>`<a href="${href}" style="display:block;padding:10px 12px;background:var(--paper);border:1px solid var(--line);border-radius:12px;text-decoration:none;color:var(--ink);font-size:.82rem;font-family:Cairo,sans-serif">${em} ${label}</a>`).join("")}
      </div>
    </div>
    <div class="encyclopedia-grid">
      ${cats}
    </div>
  `;
}