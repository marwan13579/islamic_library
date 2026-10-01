/**
 * موقع «نور الهدى» — صفحة واحدة بأربعة عشر قسمًا مع scroll-spy وروابط عميقة.
 * @module site/site
 */

import { MANHAJ_LESSONS } from "../data/manhaj-lessons.js";
import { LESSONS as BASE_LESSONS, LESSON_TYPE_LABEL } from "../data/lessons.js";
import { mergeLessons, buildLessonIndex } from "../data/lessons-extra.js";

/** الدروس الأساسية + الإضافية، مع فهرس يغطّي الاثنين. */
const LESSONS = mergeLessons(BASE_LESSONS);
const LESSONS_BY_ID = buildLessonIndex(LESSONS);
import { SCHOLARS } from "../data/scholars.js";
import { SAYINGS } from "../data/sayings.js";
import { SEERAH } from "../data/seerah.js";
import { PROPHETS } from "../data/prophets.js";
import { NAMES99 } from "../data/names99.js";
import { DUAS } from "../data/duas.js";
import { ADHKAR, ADHKAR_T } from "../data/adhkar.js";
import { KIDS } from "../data/kids.js";
import { QA } from "../data/qa.js";
import { DAILY_VERSES, DAILY_HADITHS } from "../data/daily.js";
import { QUESTION_BANK_SIZE } from "../data/question-bank.js";
import { HIJRI_EVENTS } from "../data/hijri-events.js";

import { normalizeAr, escapeHtml, toArNum, to12h } from "../lib/text.js";
import { registerServiceWorker, setupInstallButton, setupUpdatePrompt } from "../lib/pwa.js";
import { hijriLong, gregorianLong, dailyOf, isHijriToday, updateStreak, calendarLabel } from "../lib/dates.js";
import { read, write, KEYS, toggleInList, has } from "../lib/storage.js";
import { calcQibla, compassName, tasbihStep, tasbihPercent, estimateDistance } from "../lib/islamic.js";
import { requestLocation, fetchPrayerTimes, networkError, debounce, CALC_METHODS, methodName } from "../lib/api.js";
import { copyText, shareLinks, shareOrCopy, sharePayload, resultText } from "../lib/share.js";
import { initTheme, toggleTheme, stepFontScale } from "../components/theme.js";
import { openModal, closeModal, trapFocus } from "../components/modal.js";
import { showToast, buzz } from "../components/toast.js";
import { blocksToText } from "../components/blocks.js";
import { openQuizSetup, startCustomQuiz, startWeeklyChallenge, updateWeeklyCard, weeklyResult } from "../components/quiz.js";
import { listCertificates } from "../components/certificate.js";
import { SECTIONS } from "./sections.js";
import * as ui from "./render.js";

const $ = (id) => document.getElementById(id);
const state = {
  scholarQuery: "",
  prophetQuery: "",
  nameQuery: "",
  lessonCat: "",
  manhajCat: "",
  duaKey: "",
  tasbih: read("tasbih-count", 0),
  tasbihTotal: read("total-tasbih", 0),
  tasbihTarget: read("tasbih-target", 33),
  tasbihIndex: 0,
  stats: read(KEYS.stats, { streak: 0, dhikrToday: 0, day: "" }),
};

/* ------------------------------------------------------------------ */
/* التهيئة                                                             */
/* ------------------------------------------------------------------ */

async function boot() {
  initTheme();
  state.stats = updateStreak(state.stats);
  write(KEYS.stats, state.stats);

  await loadSprite();
  renderNav();
  renderAll();
  renderFooter();
  wire();
  handleHash();
  updateWeeklyCard();
  window.addEventListener("hashchange", handleHash);

  registerServiceWorker();
  setupInstallButton($("installBtn"));
  setupUpdatePrompt($("updateBtn"));
}

async function loadSprite() {
  const host = $("sprite");
  if (!host) return;
  try {
    const response = await fetch(new URL("../assets/icons.svg", import.meta.url));
    host.innerHTML = await response.text();
  } catch {
    showToast("تعذّر تحميل أيقونات الموقع — الأيقونات التُممية فقط.");
  }
}

/* ------------------------------------------------------------------ */
/* الهيدر والرئيسية                                                    */
/* ------------------------------------------------------------------ */

function renderNav() {
  const nav = $("mainNav");
  if (!nav) return;
  nav.innerHTML = SECTIONS.map(
    (item) => `<a href="#${item.id}" data-nav="${item.id}">${escapeHtml(item.title)}</a>`,
  ).join("");
}

function statsHtml() {
  const read_ = read(KEYS.readLessons, []).length;
  const bm = Object.values(read(KEYS.bookmarks, {})).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  return `<div class="stats">
    <div class="stat-box"><div class="num" id="statRead">${toArNum(read_)}</div><div class="lbl">دروس مقروءة</div></div>
    <div class="stat-box"><div class="num" id="statStreak">${toArNum(state.stats.streak)}</div><div class="lbl">أيام متتالية</div></div>
    <div class="stat-box"><div class="num" id="statBookmarks">${toArNum(bm)}</div><div class="lbl">عناصر محفوظة</div></div>
    <div class="stat-box"><div class="num" id="statDhikr">${toArNum(state.stats.dhikrToday)}</div><div class="lbl">أذكار اليوم</div></div>
  </div>`;
}

function heroHtml() {
  const verse = dailyOf(DAILY_VERSES);
  const hadith = dailyOf(DAILY_HADITHS);
  return `<section class="hero">
    <h1>تعلَّمْ أحكامَ دينِك</h1>
    <p class="lead">موسوعة إسلامية مبنيّة على منهج سلف الأمة: من العقيدة إلى الفقه، مع اختبارات وشهادات تُخزَّن في جهازك فقط.</p>
    <div class="hero-ornament"></div>
    ${statsHtml()}
    <div class="cards-grid" style="justify-content:center">
      <div class="card" id="weeklyCard">
        <h3>🗓️ تحدّي الأسبوع</h3>
        <p>أسئلة ثابتة كل أسبوع — نتيجة واحدة تُحفظ.</p>
        <button type="button" class="btn primary" data-role="weekly">ابدأ التحدي</button>
      </div>
      <div class="card">
        <h3>🎯 بنك الاختبارات</h3>
        <p>${toArNum(QUESTION_BANK_SIZE)} سؤالًا بثلاثة أنواع مع شرح بعد كل إجابة.</p>
        <button type="button" class="btn primary" data-role="quiz">ابدأ اختبارًا</button>
      </div>
      <div class="card">
        <h3>📜 شهاداتي</h3>
        <p>تحتوي الشهادات على <span id="certCount">${toArNum(listCertificates().length)}</span> شهادة.</p>
        <button type="button" class="btn ghost" data-role="certs">عرض الشهادات</button>
      </div>
    </div>
    ${ui.ayahCard(verse.ayah, verse.ref)}
    <div class="card" style="margin-block-start:14px">
      <p>«${escapeHtml(hadith.text)}»</p><span class="meta">${escapeHtml(hadith.src)}</span>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ */
/* الأقسام                                                              */
/* ------------------------------------------------------------------ */

function section(id, head, body) {
  return `<section class="section" id="${id}">${ui.sectionHead(head, body)}</section>`;
}

function renderAll() {
  const root = $("siteRoot");
  if (!root) return;
  root.innerHTML = [
    heroHtml(),
    section(
      "manhaj",
      { icon: "i-book", title: "منهج سلف الأمة", sub: `${toArNum(MANHAJ_LESSONS.length)} درسًا منهجيًا` },
      `<div class="chips" id="manhajChips">${manhajChipsHtml()}</div><div id="manhajGrid">${ui.manhajGrid(MANHAJ_LESSONS)}</div>`,
    ),
    section(
      "scholars",
      { icon: "i-users", title: "أعلام سلف الأمة", sub: `${toArNum(SCHOLARS.length)} عالماً` },
      `<input class="search" id="scholarsSearch" type="search" placeholder="ابحث في أعلام السلف…" aria-label="بحث في أعلام السلف">
       <div id="scholarsGrid">${ui.scholarsGrid(SCHOLARS)}</div>`,
    ),
    section(
      "sayings",
      { icon: "i-sparkle", title: "أقوال سلف الأمة", sub: `${toArNum(SAYINGS.length)} قولاً` },
      `<div id="sayingsGrid">${ui.sayingsGrid(SAYINGS)}</div>`,
    ),
    section(
      "sections",
      { icon: "i-mosque", title: "الدروس الفقهية", sub: `${toArNum(LESSONS.length)} دروس مع اختبارات` },
      `<div class="chips" id="lessonChips">${lessonChipsHtml()}</div><div id="sectionsGrid">${ui.lessonsGrid(LESSONS)}</div>`,
    ),
    section(
      "seerah",
      { icon: "i-history", title: "السيرة النبوية", sub: `${toArNum(SEERAH.length)} محطات` },
      `<div id="seerahTimeline">${ui.seerahTimeline(SEERAH)}</div>`,
    ),
    section(
      "prophets",
      { icon: "i-star", title: "قصص الأنبياء", sub: `${toArNum(PROPHETS.length)} أنبياء` },
      `<input class="search" id="prophetsSearch" type="search" placeholder="ابحث في قصص الأنبياء…" aria-label="بحث في قصص الأنبياء">
       <div id="prophetsGrid">${ui.prophetsGrid(PROPHETS)}</div>`,
    ),
    section(
      "duas",
      { icon: "i-beads", title: "أدعية المناسبات", sub: `${toArNum(Object.keys(DUAS).length)} فئات` },
      `<div class="chips" id="duaChips">${duaChipsHtml()}</div><div id="duasList">${ui.duasList(DUAS)}</div>`,
    ),
    section(
      "names",
      { icon: "i-star", title: "أسماء الله الحسنى", sub: `${toArNum(NAMES99.length)} اسمًا — راجعها مع أهل العلم` },
      `<input class="search" id="namesSearch" type="search" placeholder="ابحث بالاسم أو المعنى…" aria-label="بحث في أسماء الله الحسنى">
       <div id="namesGrid">${ui.namesGrid(NAMES99)}</div>`,
    ),
    section(
      "adhkar",
      { icon: "i-beads", title: "الأذكار", sub: "أذكار النوم وبعد الصلاة" },
      `${tasbihHtml()}<div id="adhkarList">${ui.adhkarList(ADHKAR)}</div>`,
    ),
    section(
      "kids",
      { icon: "i-sparkle", title: "ركن الأطفال", sub: "دروس مبسّطة" },
      `<div id="kidsGrid">${ui.kidsGrid(KIDS)}</div>`,
    ),
    section(
      "tools",
      { icon: "i-qibla", title: "أدوات إسلامية", sub: "القبلة والمواقيت والتقويم" },
      toolsHtml(),
    ),
    section(
      "quiz",
      { icon: "i-quiz", title: "الاختبارات", sub: `${toArNum(QUESTION_BANK_SIZE)} سؤالًا بثلاثة أنواع` },
      quizHtml(),
    ),
    section(
      "certs",
      { icon: "i-check", title: "شهاداتي", sub: "تُرسم على canvas وتُحفظ في جهازك" },
      certificatesHtml(),
    ),
    section("ask", { icon: "i-link", title: "اسأل سؤالًا", sub: "بدون خادم — يفتح بريدك أو ينسخ النص" }, askHtml()),
    section("qa", { icon: "i-info", title: "أسئلة وأجوبة", sub: `${toArNum(QA.length)} أسئلة` }, `<div id="qaGrid">${ui.qaGrid(QA)}</div>`),
    section("about", { icon: "i-lightbulb", title: "عن الموقع", sub: "المنهج والمصادر وسياسة التحرير" }, aboutHtml()),
    section("privacy", { icon: "i-shield", title: "سياسة الخصوصية", sub: "بياناتك تبقى في جهازك" }, privacyHtml()),
  ].join("");
}

function manhajChipsHtml() {
  const cats = [...new Set(MANHAJ_LESSONS.map((item) => item.mcat))];
  return `<button type="button" class="chip active" data-manhaj="">الكل</button>${cats
    .map((cat) => `<button type="button" class="chip" data-manhaj="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`)
    .join("")}`;
}

function lessonChipsHtml() {
  const cats = [...new Set(LESSONS.map((item) => item.cat))];
  return `<button type="button" class="chip active" data-lesson-cat="">الكل</button>${cats
    .map((cat) => `<button type="button" class="chip" data-lesson-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`)
    .join("")}`;
}

function duaChipsHtml() {
  return `<button type="button" class="chip active" data-dua="">الكل</button>${Object.entries(DUAS)
    .map(([key, group]) => `<button type="button" class="chip" data-dua="${escapeHtml(key)}">${escapeHtml(group.title)}</button>`)
    .join("")}`;
}

function tasbihHtml() {
  return `<div class="card tasbih">
    <label class="lbl" for="tasbihSelect">اختر الذكر</label>
    <select id="tasbihSelect" class="search" style="max-width:320px;margin-inline:auto">
      ${ADHKAR_T.map((item, index) => `<option value="${index}">${escapeHtml(item)}</option>`).join("")}
    </select>
    <button type="button" class="tasbih-btn" id="tasbihBtn" aria-label="تسبيح">٠</button>
    <div class="tasbih-bar"><span id="tasbihBar" style="width:0%"></span></div>
    <p class="meta" id="tasbihInfo">—</p>
    <label class="lbl" for="tasbihTarget">الهدف</label>
    <select id="tasbihTarget" class="search" style="max-width:220px;margin-inline:auto">
      ${[33, 99, 100, 200, 0].map((value) => `<option value="${value}">${value === 0 ? "بلا هدف" : toArNum(value)}</option>`).join("")}
    </select>
  </div>`;
}

function toolsHtml() {
  return `<div class="cards-grid">
    <div class="tool-card">
      <h3>🧭 اتجاه القبلة</h3>
      <svg class="qibla-dial" viewBox="0 0 100 100" id="qiblaDial" aria-label="بوصلة القبلة">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-opacity=".2"/>
        <text x="50" y="14" text-anchor="middle" font-size="9">ش</text>
        <g id="qiblaNeedle" class="qibla-needle">
          <path d="M50 22 L57 56 L50 50 L43 56 Z" fill="#c9a227"/>
        </g>
      </svg>
      <p id="qiblaValue">—</p>
      <button type="button" class="btn primary" data-role="locate">تحديد موقعي</button>
    </div>
    <div class="tool-card">
      <h3>🕰️ مواقيت الصلاة</h3>
      <div id="prayerList" class="cards-grid" style="grid-template-columns:1fr 1fr"></div>
      <button type="button" class="btn primary" data-role="times">جلب المواقيت</button>
    </div>
    <div class="tool-card">
      <h3>📅 التقويم الهجري</h3>
      <p id="hijriDay" class="ayah-card" style="font-size:1.1rem;padding:14px">—</p>
      <p class="meta">التقويم محسوب فلكيًا، والحكم بالرؤية.</p>
      <label class="lbl" for="calendarType">نوع التقويم</label>
      <select id="calendarType" class="search" style="max-width:100%">
        <option value="hijri">هجري</option>
        <option value="gregorian">ميلادي</option>
      </select>
    </div>
  </div>`;
}

/** قسم الاختبارات: بنك الأسئلة وتحدّي الأسبوع والشهادات. */
function quizHtml() {
  return `<div class="cards-grid">
    <div class="card" id="weeklyCard">
      <h3>🗓️ تحدّي الأسبوع</h3>
      <p>أسئلة ثابتة كل أسبوع — نتيجة واحدة تُحفظ.</p>
      <button type="button" class="btn primary" data-role="weekly">ابدأ التحدي</button>
    </div>
    <div class="card">
      <h3>🎯 بنك الاختبارات</h3>
      <p>${toArNum(QUESTION_BANK_SIZE)} سؤالًا بثلاثة أنواع مع شرح بعد كل إجابة.</p>
      <button type="button" class="btn primary" data-role="quiz">ابدأ اختبارًا</button>
    </div>
  </div>
  <p class="note-line">تظهر هذه البطاقتان أيضًا أعلى الصفحة، وكلاهما يفتح المحرّك نفسه.</p>`;
}

/** قسم الشهادات: قائمة الشهادات مع معاينة ورسم. */
function certificatesHtml() {
  const list = listCertificates();
  return `<p class="lead">تحتوي شهاداتك على <span id="certCount">${toArNum(list.length)}</span> شهادة.
    الشهادة تُرسم على canvas بمقاس ١٢٠٠×٨٤٨، ويمكنك تحميلها صورةً أو طباعتها.</p>
    <button type="button" class="btn primary" data-role="certs">عرض شهاداتي</button>
    ${
      list.length
        ? `<div class="cards-grid" id="certList">${list
            .map(
              (cert) => `<div class="card"><h3>${escapeHtml(cert.title)}</h3>
              <p>${toArNum(cert.score)} من ${toArNum(cert.total)} — ${toArNum(cert.percent)}٪</p>
              <span class="meta">${escapeHtml(cert.id)}</span></div>`,
            )
            .join("")}</div>`
        : `<p class="empty">لم تحصل على أي شهادة بعد — اجتز اختبارًا بنسبة ${toArNum(80)}٪ للحصول على شهادة 🌟</p>`
    }`;
}

function askHtml() {
  return `<div class="note-box">
    ⚠️ هذا النموذج للتوجيه العام. للفتاوى الشخصية، يُرجى مراجعة أهل العلم في بلدك.
  </div>
  <form id="askForm" novalidate>
    <div class="form-group">
      <label for="askTopic">الموضوع</label>
      <select id="askTopic" name="topic" required>
        ${["العقيدة ومنهج السلف", "الطهارة", "الصلاة", "الصيام", "الزكاة", "الأسرة", "الآداب", "أخرى"]
          .map((topic) => `<option>${topic}</option>`)
          .join("")}
      </select>
      <span class="err">هذا الحقل مطلوب.</span>
    </div>
    <div class="form-group">
      <label for="askQuestion">السؤال</label>
      <textarea id="askQuestion" name="question" rows="4" required minlength="20"></textarea>
      <span class="err">اكتب سؤالًا لا يقل عن ٢٠ حرفًا.</span>
    </div>
    <div class="form-group"><label for="askName">الاسم (اختياري)</label><input id="askName" name="name" type="text"></div>
    <div class="form-group"><label for="askEmail">البريد الإلكتروني (اختياري)</label><input id="askEmail" name="email" type="email"></div>
    <div class="form-group"><label for="askLink">رابط (اختياري)</label><input id="askLink" name="link" type="url"></div>
    <div class="honeypot" aria-hidden="true"><label for="askWebsite">website</label><input id="askWebsite" name="website" tabindex="-1" autocomplete="off"></div>
    <button type="submit" class="btn primary">إرسال السؤال</button>
  </form>`;
}

function aboutHtml() {
  /** @type {Array<[string, string]>} أزواج ثابتة من النص المشروع، تُهرَّب عند العرض */
  const cards = [
    ["🎯 هدفنا", "تقديم العلم الشرعي بصيغة مبسّطة، خالية من التعصب المذهبي، مبنيّة على نصوص الكتاب والسنة."],
    ["📖 منهجنا", "منهج سلف الأمة: التوحيد، تقديم النقل على العقل، والتحذير من البدع."],
    ["📚 مصادرنا", "القرآن الكريم، السنة الصحيحة، الإجماع، والقياس — مع ذكر التخريج."],
    ["🕌 عقيدتنا", "مختصر: لا إله إلا الله وحده لا شريك له، ونؤتمن بما صح عن النبي ﷺ."],
    ["👥 مجلس المراجعة العلمية", REVIEW_BOARD_TEXT],
    [
      "📋 سياسة تحريرية",
      "لا يُنشر نصّ جديد قبل مراجعته من طالب علم، ويُذكر تخريج كل دليل في موضعه.",
    ],
  ];
  return `<div class="cards-grid">${cards
    .map(
      ([title, body]) =>
        `<div class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`,
    )
    .join("")}</div>`;
}

/**
 * تنبيه أمانة علمية — لا يُحذف ولا يُختصر.
 * @type {string}
 */
export const REVIEW_BOARD_TEXT =
  "الموقع قيد إنشاء مجلس مراجعة من طلاب العلم المتخصصين على منهج السلف لمراجعة كل درس. حتى الآن، المحتوى مكتوب بمساعدة تقنية ويحتاج مراجعة نهائية.";

function privacyHtml() {
  return `<div class="cards-grid">
    <div class="card"><h3>🔒 البيانات التي نجمعها</h3>
      <p>لا نجمع بيانات شخصية. يحفظ المتصفح فقط إعداداتك (الثيم، حجم الخط، تقدم القراءة، نتائج الاختبارات) في <code>localStorage</code>. الموقع لا يرسل أي بيانات لخوادمنا.</p></div>
    <div class="card"><h3>🌐 أدوات الطرف الثالث</h3>
      <p><strong>Google Fonts</strong> — Amiri, Cairo, Reem Kufi, Scheherazade New, Aref Ruqaa.<br>
      <strong>AlAdhan API</strong> — api.aladhan.com (مواقيت الصلاة فقط — تُرسل الإحداثيات للخدمة).</p></div>
  </div>`;
}

function renderFooter() {
  const grid = $("footerGrid");
  if (!grid) return;
  const lessons = LESSONS.map((item) => `<a href="#lesson/${escapeHtml(item.id)}">${escapeHtml(item.title)}</a>`).join("");
  const links = SECTIONS.slice(2, 10).map((item) => `<a href="#${item.id}">${escapeHtml(item.title)}</a>`).join("");
  const sources = ["القرآن الكريم", "السنة الصحيحة", "الإجماع", "القياس"]
    .map((item) => `<a href="#manhaj">${item}</a>`)
    .join("");
  grid.innerHTML = `
    <div><h3>نور الهدى</h3><p>موسوعة على منهج سلف الأمة.</p>
      <p><a href="mailto:marwansinger13579@gmail.com">📧 marwansinger13579@gmail.com</a></p></div>
    <div><h3>الدروس</h3>${lessons}</div>
    <div><h3>الأقسام</h3>${links}</div>
    <div><h3>المصادر</h3>${sources}</div>`;
  const year = $("footerYear");
  if (year) year.textContent = toArNum(new Date().getFullYear());
}

/* ------------------------------------------------------------------ */
/* الأحداث                                                             */
/* ------------------------------------------------------------------ */

function wire() {
  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  $("modalCloseBtn")?.addEventListener("click", closeModal);
  document.querySelector(".modal-overlay")?.addEventListener("click", closeModal);
  $("themeBtn")?.addEventListener("click", () => {
    const next = toggleTheme();
    const icon = document.getElementById("themeIcon");
    if (icon) icon.setAttribute("href", next === "dark" ? "#i-sun" : "#i-moon-theme");
    $("themeBtn").setAttribute("aria-label", next === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن");
  });
  $("fontUp")?.addEventListener("click", () => stepFontScale(1));
  $("fontDown")?.addEventListener("click", () => stepFontScale(-1));
  $("menuBtn")?.addEventListener("click", () => {
    const open = $("mainNav").classList.toggle("open");
    $("menuBtn").setAttribute("aria-expanded", String(open));
  });
  $("toTop")?.addEventListener("click", () => window.scrollTo({ top: 0 }));

  window.addEventListener(
    "scroll",
    () => {
      $("toTop")?.classList.toggle("show", window.scrollY > 400);
      spy();
    },
    { passive: true },
  );

  observeReveal();
  setInterval(tickHijri, 60000);
  tickHijri();
  wireSearch();
  wireTasbih();
  wireTools();
  wireAsk();
}

/**
 * يربط أدوات القسم: restores النوع المختار للتقويم، ويحدّث اليوم المعروض.
 * أزرار القبلة والمواقيت نفسها تُعالَج في onClick عبر data-role.
 */
function wireTools() {
  const select = /** @type {HTMLSelectElement | null} */ ($("calendarType"));
  if (select) {
    select.value = read(KEYS.calendarType, "hijri");
    select.addEventListener("change", () => {
      write(KEYS.calendarType, select.value);
      tickHijri();
    });
  }
  // استعادة القبلة والمواقيت المحفوظتين من زيارة سابقة
  const saved = read("user-coords", null);
  if (saved) {
    const angle = calcQibla(saved.lat, saved.lng);
    const needle = $("qiblaNeedle");
    if (needle) needle.style.transform = `rotate(${angle}deg)`;
    const value = $("qiblaValue");
    if (value) value.textContent = `${toArNum(Math.round(angle))}° — ${compassName(angle)}`;
    loadPrayerTimes(saved);
  }
  tickHijri();
}

function onKeydown(event) {
  trapFocus(event);
  if (event.key === "Escape") closeModal();
  if (event.key === "T" && !isTyping(event)) $("themeBtn")?.click();
  if (event.key === "/" && !isTyping(event)) {
    event.preventDefault();
    /** @type {HTMLInputElement | null} */ ($("namesSearch"))?.focus();
  }
}

function isTyping(event) {
  const target = /** @type {HTMLElement} */ (event.target);
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function onClick(event) {
  const target = /** @type {HTMLElement} */ (event.target);

  const role = target.closest("[data-role]")?.getAttribute("data-role");
  if (role === "quiz") return openQuizSetup();
  if (role === "weekly") return startWeeklyChallenge();
  if (role === "certs") return showCertificates();
  if (role === "locate") return locateMe();
  if (role === "times") return loadPrayerTimes();
  if (role === "copy-dua") return copyDua(target.getAttribute("data-copy-dua"));
  if (role === "toggle-read") return toggleRead(target.getAttribute("data-lesson"));
  if (role === "copy-lesson") return copyLesson(target.getAttribute("data-lesson"));
  if (role === "print-lesson") return printLesson(target.getAttribute("data-lesson"));
  if (role === "share-lesson") return shareLesson(target.getAttribute("data-lesson"));

  const open = target.closest("[data-open]");
  if (open) return openItem(open.getAttribute("data-open"), open.getAttribute("data-id"));

  const manhaj = target.closest("[data-manhaj]");
  if (manhaj) return filterChips(manhaj, "manhaj", (value) => {
    state.manhajCat = value;
    $("manhajGrid").innerHTML = ui.manhajGrid(MANHAJ_LESSONS, value);
  });

  const lessonCat = target.closest("[data-lesson-cat]");
  if (lessonCat) return filterChips(lessonCat, "lesson", (value) => {
    state.lessonCat = value;
    $("sectionsGrid").innerHTML = ui.lessonsGrid(LESSONS, value);
  });

  const dua = target.closest("[data-dua]");
  if (dua) return filterChips(dua, "dua", (value) => {
    state.duaKey = value;
    $("duasList").innerHTML = ui.duasList(DUAS, value);
  });
}

function filterChips(chip, key, apply) {
  const group = chip.parentElement;
  group?.querySelectorAll(".chip").forEach((item) => item.classList.remove("active"));
  chip.classList.add("active");
  apply(chip.getAttribute(`data-${key}`) ?? "");
}

/* ------------------------------ openItem ------------------------------ */

function openItem(role, id) {
  switch (role) {
    case "scholar": return showScholar(SCHOLARS[Number(id)]);
    case "prophet": return showProphet(PROPHETS[Number(id)]);
    case "saying": return showSaying(SAYINGS[Number(id)]);
    case "seerah": return showSeerah(SEERAH[Number(id)]);
    case "name": return showName(NAMES99[Number(id)]);
    case "kid": return showKid(KIDS[Number(id)]);
    case "lesson": return showLesson(id);
    case "manhaj": return showManhaj(MANHAJ_LESSONS.find((item) => item.id === id));
    default: return undefined;
  }
}

function showScholar(item) {
  openModal({
    title: item.name,
    badge: item.tag,
    html: `<p class="meta">${escapeHtml(item.era)}</p><p>${escapeHtml(item.bio)}</p>`,
    footerHtml: toolsFooter("scholar", item.name, item.bio),
  });
}

function showProphet(item) {
  openModal({
    title: `${item.emoji} ${item.title}`,
    badge: "قصص الأنبياء",
    html: `<p>${escapeHtml(item.desc)}</p><p>${escapeHtml(item.story)}</p>`,
    footerHtml: toolsFooter("prophet", item.title, item.story),
  });
}

function showSaying(item) {
  openModal({
    title: item.author,
    badge: "قول",
    html: `<div class="ayah-card">«${escapeHtml(item.txt)}»<span class="ref">${escapeHtml(item.src)}</span></div>`,
    footerHtml: toolsFooter("saying", `قول ${item.author}`, item.txt),
  });
}

function showSeerah(item) {
  openModal({
    title: item.title,
    badge: "السيرة",
    html: `<p class="meta">${escapeHtml(item.year)}</p><p>${escapeHtml(item.desc)}</p>`,
    footerHtml: toolsFooter("seerah", item.title, item.desc),
  });
}

function showName(item) {
  openModal({
    title: item.n,
    badge: "من أسماء الله الحسنى",
    html: `<p>${escapeHtml(item.m)}</p>`,
    footerHtml: toolsFooter("name", item.n, item.m),
  });
}

function showKid(item) {
  openModal({
    title: `${item.emoji} ${item.title}`,
    badge: `ركن الأطفال — ${item.age}`,
    html: `<p style="font-size:1.05rem">${escapeHtml(item.body)}</p>`,
    footerHtml: toolsFooter("kid", item.title, item.body),
  });
}

function toolsFooter(id, title, text) {
  const links = shareLinks(title, location.href);
  return `<a class="btn ghost" href="${links.whatsapp}" target="_blank" rel="noopener">📤 واتساب</a>
    <a class="btn ghost" href="${links.telegram}" target="_blank" rel="noopener">✈️ تليجرام</a>
    <button type="button" class="btn ghost" data-role="copy-generic" data-text="${escapeHtml(text)}">📋 نسخ</button>`;
}

function showManhaj(item) {
  if (!item) return;
  openModal({
    title: item.title,
    badge: item.cat,
    html: ui.lessonModal(item),
    footerHtml: `<button type="button" class="btn ghost" data-role="copy-lesson" data-lesson="${escapeHtml(item.id)}">📋 نسخ</button>
      <button type="button" class="btn ghost" data-role="print-lesson" data-lesson="${escapeHtml(item.id)}">🖨️ طباعة</button>
      <button type="button" class="btn ghost" data-role="share-lesson" data-lesson="${escapeHtml(item.id)}">📤 مشاركة</button>`,
  });
  wireGenericCopy();
}

function showLesson(id) {
  const lesson = LESSONS_BY_ID[id];
  if (!lesson) return;
  const quizCount = lesson.quiz.length;
  openModal({
    title: lesson.title,
    badge: `${lesson.cat} — ${LESSON_TYPE_LABEL[lesson.type] ?? lesson.type}`,
    html: ui.lessonModal(lesson),
    read: has(KEYS.readLessons, id),
    footerHtml: `<div class="tool-btns">
        <button type="button" class="btn ghost" data-role="copy-lesson" data-lesson="${escapeHtml(id)}">📋 نسخ</button>
        <button type="button" class="btn ghost" data-role="print-lesson" data-lesson="${escapeHtml(id)}">🖨️ طباعة</button>
        <button type="button" class="btn ghost" data-role="share-lesson" data-lesson="${escapeHtml(id)}">📤 مشاركة</button>
        <button type="button" class="btn ghost" data-role="toggle-read" data-lesson="${escapeHtml(id)}">✓ حفظ كمقروء</button>
      </div>
      <div class="nav-btns"><button type="button" class="btn primary" data-role="lesson-quiz" data-lesson="${escapeHtml(id)}">🎯 اختبار (${toArNum(quizCount)})</button></div>`,
    progress: `${toArNum(LESSONS.indexOf(lesson) + 1)} / ${toArNum(LESSONS.length)}`,
  });
  document
    .querySelector('[data-role="lesson-quiz"]')
    ?.addEventListener("click", () => startLessonQuiz(lesson));
  wireGenericCopy();
}

/** اختبار الدرس: يمرّر أسئلة الدرس إلى محرّك الاختبار الموحّد. */
function startLessonQuiz(lesson) {
  const questions = lesson.quiz.map((item) => ({
    t: /** @type {const} */ ("mc"),
    d: /** @type {any} */ ("medium"),
    q: item.q,
    o: item.options,
    a: item.answer,
    e: item.explain,
  }));
  startCustomQuiz(questions, lesson.title);
}

function toggleRead(id) {
  const on = toggleInList(KEYS.readLessons, id);
  const mark = $("modalReadMark");
  if (mark) mark.hidden = !on;
  updateStats();
  showToast(on ? "تم حفظ الدرس كمقروء" : "أُزيل الدرس من المقروء");
}

function updateStats() {
  const read_ = read(KEYS.readLessons, []).length;
  const stat = $("statRead");
  if (stat) stat.textContent = toArNum(read_);
}

function copyLesson(id) {
  const lesson = LESSONS_BY_ID[id] ?? MANHAJ_LESSONS.find((item) => item.id === id);
  if (!lesson) return;
  const text = `${lesson.title}\n\n${blocksToText(lesson.body)}\n\n— من موقع نور الهدى\n${location.origin}${location.pathname}#lesson/${lesson.id}`;
  copyText(text).then((ok) => showToast(ok ? "تم نسخ الدرس" : "تعذّر النسخ"));
}

function printLesson(id) {
  const lesson = LESSONS_BY_ID[id] ?? MANHAJ_LESSONS.find((item) => item.id === id);
  if (!lesson) return;
  const view = window.open("", "", "width=800,height=900");
  if (!view) {
    showToast("اسمح بالنوافذ المنبثقة للطباعة.");
    return;
  }
  view.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>${escapeHtml(lesson.title)}</title>
<style>body{font-family:system-ui,Tahoma,sans-serif;line-height:1.9;padding:32px;color:#16241f;max-width:720px;margin:auto}
h1{font-size:22px;color:#12664a;border-bottom:3px solid #c9a227;padding-bottom:10px}
h3{color:#12664a;margin-top:22px;border-inline-start:4px solid #c9a227;padding-inline-start:10px}
.evidence,.hadith,.salaf-quote{background:#f5f3ec;border-inline-start:4px solid #c9a227;padding:12px 16px;margin:12px 0;border-radius:8px;page-break-inside:avoid}
.ayah,.hadith p{font-family:Amiri,serif;font-size:18px;margin:0}.ref{font-size:12px;color:#666}
.note-box,.warn-box{padding:12px 16px;border-radius:8px;background:#eef7f2;border:1px solid #cfe4d9}
.sources-box{background:#f0f7f4;border:1px solid #cfe4d9;padding:14px 18px;border-radius:10px}
footer{margin-top:30px;padding-top:14px;border-top:1px solid #ccc;font-size:12px;color:#666;text-align:center}</style>
</head><body><h1>${escapeHtml(lesson.title)}</h1><p>${escapeHtml(lesson.cat)}</p>
${ui.lessonModal(lesson)}
<footer>نور الهدى — على منهج سلف الأمة</footer></body></html>`);
  view.document.close();
  setTimeout(() => {
    view.focus();
    view.print();
  }, 300);
}

function shareLesson(id) {
  const lesson = LESSONS_BY_ID[id] ?? MANHAJ_LESSONS.find((item) => item.id === id);
  if (!lesson) return;
  shareOrCopy(sharePayload(lesson.title, lesson.desc)).then((mode) => {
    if (mode === "copied") showToast("تم نسخ رابط المشاركة.");
  });
}

async function copyGeneric(text) {
  const ok = await copyText(text ?? "");
  showToast(ok ? "تم النسخ" : "تعذّر النسخ");
}

function wireGenericCopy() {
  const buttons = document.querySelectorAll('[data-role="copy-generic"]');
  buttons.forEach((button) =>
    button.addEventListener("click", () => copyGeneric(button.getAttribute("data-text"))),
  );
}


/** ينسخ دعاءً من قسم الأدعية. */
async function copyDua(key) {
  const [category, index] = String(key ?? "").split("-");
  const item = DUAS[category]?.items[Number(index)];
  if (!item) return;
  const ok = await copyText(`${item.txt}\n[${item.src}]`);
  showToast(ok ? "تم نسخ الدعاء" : "تعذّر النسخ");
}

/* ------------------------------ certificates ------------------------------ */

function showCertificates() {
  const list = listCertificates();
  const html = list.length
    ? `<div class="cards-grid">${list
      .map(
        (cert) => `<div class="card"><h3>${escapeHtml(cert.title)}</h3>
        <p>${toArNum(cert.score)} من ${toArNum(cert.total)} — ${toArNum(cert.percent)}٪</p>
        <span class="meta">${escapeHtml(cert.id)}</span></div>`,
      )
      .join("")}</div>`
    : `<p class="empty">لم تحصل على أي شهادة بعد — اجتز اختبارًا بنسبة ${toArNum(80)}٪ للحصول على شهادة 🌟</p>`;
  openModal({ title: "شهاداتي", badge: "شهادات", html });
}

/* ------------------------------ search ------------------------------ */

function wireSearch() {
  // البحث على القوائم الكبيرة (٩٩ اسمًا) يُؤجَّل قليلًا حتى لا يُعاد الرسم لكل حرف.
  const bind = (id, render) => {
    const input = $(id);
    const run = debounce(160)(render);
    input?.addEventListener("input", () => run(input.value));
  };
  bind("scholarsSearch", (value) => {
    const query = normalizeAr(value);
    state.scholarQuery = value;
    const items = SCHOLARS.filter(
      (item) => !query || normalizeAr(`${item.name} ${item.bio} ${item.tag}`).includes(query),
    );
    $("scholarsGrid").innerHTML = items.length
      ? ui.scholarsGrid(items, value)
      : `<p class="empty">لا توجد نتائج مطابقة.</p>`;
  });
  bind("prophetsSearch", (value) => {
    const query = normalizeAr(value);
    state.prophetQuery = value;
    const items = PROPHETS.filter(
      (item) => !query || normalizeAr(`${item.title} ${item.desc}`).includes(query),
    );
    $("prophetsGrid").innerHTML = items.length
      ? ui.prophetsGrid(items, value)
      : `<p class="empty">لا توجد نتائج مطابقة.</p>`;
  });
  bind("namesSearch", (value) => {
    const query = normalizeAr(value);
    state.nameQuery = value;
    const items = NAMES99.filter(
      (item) => !query || normalizeAr(`${item.n} ${item.m}`).includes(query),
    );
    $("namesGrid").innerHTML = ui.namesGrid(items, value);
  });
}

/* ------------------------------ tasbih ------------------------------ */

function wireTasbih() {
  const button = $("tasbihBtn");
  const select = /** @type {HTMLSelectElement | null} */ ($("tasbihSelect"));
  const target = /** @type {HTMLSelectElement | null} */ ($("tasbihTarget"));
  if (!button) return;
  state.tasbihTarget = Number(read("tasbih-target", 33)) || 33;
  if (target) target.value = String(state.tasbihTarget);
  if (select) state.tasbihIndex = Number(read("tasbih-index", 0)) % ADHKAR_T.length;

  const renderTasbih = () => {
    const dhikr = ADHKAR_T[state.tasbihIndex];
    button.textContent = toArNum(state.tasbih);
    $("tasbihBar").style.width = `${tasbihPercent(state.tasbih, state.tasbihTarget)}%`;
    $("tasbihInfo").textContent =
      `${dhikr} — اليوم ${toArNum(state.tasbih)} · الإجمالي ${toArNum(state.tasbihTotal)}` +
      (state.tasbihTarget ? ` · الهدف ${toArNum(state.tasbihTarget)}` : "") +
      ` · ${estimateDistance(dhikr, state.tasbih)}`;
  };

  button.addEventListener("click", () => {
    const next = tasbihStep({ count: state.tasbih, total: state.tasbihTotal, target: state.tasbihTarget }, ADHKAR_T[state.tasbihIndex]);
    state.tasbih = next.count;
    state.tasbihTotal = next.total;
    state.stats.dhikrToday += 1;
    write("tasbih-count", state.tasbih);
    write("total-tasbih", state.tasbihTotal);
    write(KEYS.stats, state.stats);
    $("statDhikr") && ($("statDhikr").textContent = toArNum(state.stats.dhikrToday));
    if (next.reached) {
      buzz(200);
      showToast("ما شاء الله — أتممت الهدف اليومي 🌟", true);
      next.reached = false;
    }
    renderTasbih();
  });

  select?.addEventListener("change", () => {
    state.tasbihIndex = Number(select.value);
    write("tasbih-index", state.tasbihIndex);
    renderTasbih();
  });
  target?.addEventListener("change", () => {
    state.tasbihTarget = Number(target.value);
    write("tasbih-target", state.tasbihTarget);
    renderTasbih();
  });
  renderTasbih();
}

/* ------------------------------ tools ------------------------------ */

async function locateMe() {
  try {
    const coords = await requestLocation();
    const angle = calcQibla(coords.lat, coords.lng);
    const needle = $("qiblaNeedle");
    if (needle) needle.style.transform = `rotate(${angle}deg)`;
    $("qiblaValue").textContent = `${toArNum(Math.round(angle))}° — ${compassName(angle)}`;
    write("user-coords", coords);
    loadPrayerTimes(coords);
  } catch (error) {
    showToast(/** @type {Error} */ (error).message);
  }
}

async function loadPrayerTimes(coords) {
  const list = $("prayerList");
  if (!list) return;
  const saved = read("user-coords", null);
  const target = coords ?? saved;
  if (!target) {
    showToast("حدّد موقعك أولًا عبر زر «تحديد موقعي».");
    return;
  }
  list.innerHTML = `<p class="empty">جارٍ جلب المواقيت…</p>`;
  try {
    const method = Number(read(KEYS.calcMethod, 5));
    const timings = await fetchPrayerTimes(target, method);
    const keys = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
    const labels = ["الفجر", "الشروق", "الظهر", "العصر", "المغرب", "العشاء"];
    list.innerHTML = keys
      .map(
        (key, index) =>
          `<div class="stat-box"><div class="num">${escapeHtml(to12h(toHours(timings[key])))}</div><div class="lbl">${labels[index]}</div></div>`,
      )
      .join("");
    showToast(`المواقيت بحساب ${methodName(method)}`);
  } catch (error) {
    list.innerHTML = `<p class="empty">تعذّر جلب المواقيت. ${networkError(error)}</p>`;
  }
}

function toHours(value) {
  const [h, m] = String(value ?? "").split(":").map(Number);
  return Number.isFinite(h) ? h + (m || 0) / 60 : NaN;
}

function tickHijri() {
  const type = read(KEYS.calendarType, "hijri");
  const label = calendarLabel(type);
  const badge = $("hijriDate");
  if (badge) {
    badge.textContent = type === "gregorian" ? label : `${label}`;
    badge.title = "التقويم محسوب فلكيًا، والحكم بالرؤية";
  }
  const day = $("hijriDay");
  if (day) day.textContent = label;
}

/* ------------------------------ ask ------------------------------ */

function wireAsk() {
  const form = /** @type {HTMLFormElement | null} */ ($("askForm"));
  const select = /** @type {HTMLSelectElement | null} */ ($("calendarType"));
  if (select) {
    select.value = read(KEYS.calendarType, "hijri");
    select.addEventListener("change", () => {
      write(KEYS.calendarType, select.value);
      tickHijri();
    });
  }
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = /** @type {HTMLTextAreaElement} */ ($("askQuestion"));
    const topic = /** @type {HTMLSelectElement} */ ($("askTopic"));
    const questionGroup = question.closest(".form-group");
    const topicGroup = topic.closest(".form-group");
    questionGroup?.classList.remove("has-error");
    topicGroup?.classList.remove("has-error");
    let valid = true;
    if (question.value.trim().length < 20) {
      questionGroup?.classList.add("has-error");
      valid = false;
    }
    if (!topic.value) {
      topicGroup?.classList.add("has-error");
      valid = false;
    }
    if (!valid) return showToast("أكمل الحقول المطلوبة أولًا.");
    if (/** @type {HTMLInputElement} */ ($("askWebsite")).value) return;

    const body = [
      `الموضوع: ${topic.value}`,
      `السؤال: ${question.value.trim()}`,
      `الاسم: ${/** @type {HTMLInputElement} */ ($("askName")).value || "—"}`,
      `البريد: ${/** @type {HTMLInputElement} */ ($("askEmail")).value || "—"}`,
      `رابط: ${/** @type {HTMLInputElement} */ ($("askLink")).value || "—"}`,
    ].join("\n");
    write(KEYS.askDraft, body);
    await copyText(body);
    location.href =
      `mailto:marwansinger13579@gmail.com?subject=${encodeURIComponent(`[${topic.value}] سؤال جديد`)}` +
      `&body=${encodeURIComponent(body)}`;
    showToast("نُسخ النص إلى الحافظة — لو لم يُفتح بريدك فالصقه في أي بريد.");
  });
}

/* ------------------------------ misc ------------------------------ */

function spy() {
  const links = document.querySelectorAll("[data-nav]");
  let current = "";
  for (const sectionEl of document.querySelectorAll("main .section, main .hero")) {
    const top = sectionEl.getBoundingClientRect().top;
    if (top <= 140) current = sectionEl.id;
  }
  links.forEach((link) => link.classList.toggle("active", link.getAttribute("data-nav") === current));
}

function observeReveal() {
  const items = document.querySelectorAll(".card, .lesson-section");
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -40px 0px" },
  );
  items.forEach((item) => observer.observe(item));
}

function handleHash() {
  const hash = location.hash.replace("#", "");
  if (!hash) return;
  const [kind, param] = hash.split("/");
  if (kind === "lesson" && param) {
    showLesson(param);
    return;
  }
  if (kind === "section" && param) {
    document.getElementById(param)?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  const target = document.getElementById(hash);
  if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth" }), 60);
}

boot();