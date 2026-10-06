/**
 * تطبيق «بوابة النور» — اثنا عشر تبويبًا مع BottomNav وشاشة إعدادات موحّدة.
 * @module app/app
 */

import * as tabs from "./tabs.js";
import { CARD_TEMPLATES, CARD_SIZES } from "./tabs.js";

import { escapeHtml, toArNum, to12h, normalizeAr, stripHtml } from "../lib/text.js";
import { idbGet, idbPut, idbList, trimOfflineCache, destroyIDB } from "../lib/idb.js";
import {
  TAFSIR_TYPES, loadTajweed, loadWordByWord, loadTafsir,
  renderVerses, renderWordByWord, renderTafsir, ayahWithRef,
} from "./quran-read.js";
import { registerServiceWorker, setupInstallButton, setupUpdatePrompt, notify } from "../lib/pwa.js";
import * as autoNotify from "../lib/auto-notify.js";
import { calendarLabel, dateKey, updateStreak } from "../lib/dates.js";
import { read, write, remove, keys as storageKeys, KEYS, importKnownKeys } from "../lib/storage.js";
import { calcQibla, compassName, tasbihStep, tasbihPercent, calculateZakat, calculateMetalZakat, calculateLivestockZakat } from "../lib/islamic.js";
import { fetchJson, requestLocation, fetchPrayerTimes, networkError, methodName } from "../lib/api.js";
import { RECITERS, DEFAULT_RECITER, chapterAudioUrl, audioUrlOf, isValidChapter } from "../lib/quran-audio.js";
import { copyText } from "../lib/share.js";
import { initTheme, toggleTheme } from "../components/theme.js";
import { showToast, buzz } from "../components/toast.js";
import { ATHAN_URLS } from "../data/app-daily.js";
import { RADIO_STATIONS } from "../data/radio.js";
import { CITY_LIST } from "../data/cities.js";
import { APP_DUAS } from "../data/app-duas.js";

const $ = (id) => document.getElementById(id);
const APP_VERSION = "1.0.0";

/** @type {Array<{ id: string, label: string, emoji: string, render: () => string }>} */
export const TABS = [
  { id: "home", label: "الرئيسية", emoji: "🏠", render: tabs.homeTab },
  { id: "encyclopedia", label: "الموسوعة", emoji: "📖", render: tabs.encyclopediaTab },
  { id: "quran", label: "المصحف", emoji: "📖", render: tabs.quranTab },
  { id: "khatma", label: "الختمة", emoji: "📋", render: tabs.khatmaTab },
  { id: "athkar", label: "الأذكار", emoji: "🕌", render: tabs.athkarTab },
  { id: "prayer", label: "المواقيت", emoji: "🕰️", render: tabs.prayerTab },
  { id: "tracker", label: "المتابعة", emoji: "📈", render: tabs.trackerTab },
  { id: "dua", label: "الأدعية", emoji: "🤲", render: tabs.duaTab },
  { id: "media", label: "الإذاعة", emoji: "📻", render: tabs.mediaTab },
  { id: "cards", label: "البطاقات", emoji: "🖼️", render: tabs.cardsTab },
  { id: "hadith", label: "الحديث", emoji: "📚", render: tabs.hadithTab },
  { id: "zakat", label: "الزكاة", emoji: "🧮", render: tabs.zakatTab },
  { id: "sadaka", label: "الصدقة", emoji: "💚", render: tabs.sadakaTab },
  { id: "learning", label: "التعلم", emoji: "🧭", render: tabs.learningTab },
];

const state = {
  tab: read(KEYS.lastTab, "home"),
  audio: /** @type {HTMLAudioElement | null} */ (null),
  surahs: null,
  athkar: 0,
};

/* ------------------------------------------------------------------ */

async function boot() {
  initTheme();
  renderNav();
  renderTab();
  wire();
  applyHash();
  importSyncHash();
  tickDate();
  setInterval(tickDate, 60000);
  updateOnline();
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
  registerServiceWorker();
  setupInstallButton($("installBtn"));
  setupUpdatePrompt($("updateBtn"));

  // الإشعارات تشتغل وحدها: إذنٌ عند أوّل لمسة، وترحيبٌ في كل فتح.
  autoNotify.boot({ url: location.href }).catch(() => {});
}

function renderNav() {
  $("bottomNav").innerHTML = TABS.map(
    (tab) => `<button type="button" data-tab="${tab.id}" aria-current="${tab.id === state.tab ? "page" : "false"}">
      <span class="nav-emoji" aria-hidden="true">${tab.emoji}</span><span>${escapeHtml(tab.label)}</span></button>`,
  ).join("");
}

function renderTab() {
  const tab = TABS.find((item) => item.id === state.tab) ?? TABS[0];
  $("tabPanel").innerHTML = tab.render();
  write(KEYS.lastTab, tab.id);
  renderNav();
  onEnter(tab.id);
}

function switchTab(id) {
  const tab = TABS.find((item) => item.id === id);
  if (!tab) return;
  state.tab = id;
  location.hash = `tab/${id}`;
  renderTab();
  window.scrollTo({ top: 0 });
}

/* ------------------------------------------------------------------ */

function wire() {
  document.addEventListener("click", onClick);
  document.addEventListener("change", onChange);
  document.addEventListener("input", onInput);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModals();
    else if (event.key === "Tab") trapTab(event);
  });
  $("themeBtn")?.addEventListener("click", () => {
    const next = toggleTheme();
    showToast(next === "dark" ? "الوضع الداكن" : "الوضع الفاتح");
  });
  $("settingsBtn")?.addEventListener("click", openSettings);
  $("notifBtn")?.addEventListener("click", requestNotifications);
  document.querySelectorAll("[data-close]").forEach((node) =>
    node.addEventListener("click", closeModals),
  );
}

function onClick(event) {
  const target = /** @type {HTMLElement} */ (event.target);
  const tab = target.closest("[data-tab]");
  if (tab) return switchTab(tab.getAttribute("data-tab"));

  const tafsirChip = target.closest("[data-tafsir]");
  if (tafsirChip) return selectTafsir(tafsirChip.getAttribute("data-tafsir"));
  const goto = target.closest("[data-goto]");
  if (goto) return switchTab(goto.getAttribute("data-goto"));
  const bookmark = target.closest("[data-goto-ayah]");
  if (bookmark) return gotoAyah(bookmark.getAttribute("data-goto-ayah"));

  const role = target.closest("[data-role]")?.getAttribute("data-role");
  switch (role) {
    case "open-tasbih": return switchTab("athkar");
    case "load-times": return loadTimes();
    case "locate-app": return locateApp();
    case "test-athan": return playAthan();
    case "ward-plus": return bumpWard();
    case "play": return toggleRecitation();
    case "focus": return toggleFocusMode();
    case "surah-prev": return stepSurah(-1);
    case "surah-next": return stepSurah(1);
    case "export-data": return exportData();
    case "import-data": return importData();
    case "athkar-reset": return resetAthkar();
    case "khatma-link": return shareKhatmaLink();
    case "save-surah": return cacheSurah(Number(read("current_surah", 1)));
    case "bulk-cache": return bulkCache();
    case "clear-cache": return clearCachedSurahs();
    case "toggle-tajweed": return toggleTajweed();
    case "toggle-wbw": return toggleWordByWord();
    case "tafsir": return toggleTafsirPanel();
    case "copy-ayah": return copyCurrentAyah();
    case "bookmark-ayah": return toggleBookmarkAyah();
    case "sleep-timer": return startSleepTimer(Number(target.getAttribute("data-minutes")));
    case "sleep-cancel": return cancelSleepTimer();
    case "khatma-txt": return exportKhatmaText();
    case "khatma-reset": return resetKhatma();
    case "khatma-assign": return assignKhatma();
    case "card-draw": return drawCard();
    case "card-download": return downloadCard();
    case "card-copy": return copyCardText();
    case "sadaka-new": return createSadaka();
    case "zakat-money": return zakatMoney();
    case "zakat-metal": return zakatMetal();
    case "zakat-trade": return zakatTrade();
    case "zakat-livestock": return zakatLivestock();
    case "radio-play": return toggleRadio();
    default: break;
  }

  const juz = target.closest("[data-juz]");
  if (juz) return toggleJuz(Number(juz.getAttribute("data-juz")));
  const surah = target.closest("[data-surah]");
  if (surah) return loadSurah(Number(surah.getAttribute("data-surah")));
  if (target.id === "reciterSelect") {
    write(KEYS.reciter, Number(target.value));
    return stopRecitation();
  }
  const station = target.closest("[data-station]");
  if (station) return playStation(Number(station.getAttribute("data-station")));
  const prayer = target.closest("[data-prayer]");
  if (prayer) return markPrayer(prayer.getAttribute("data-prayer"));
  const dhikr = target.closest("[data-dhikr]");
  if (dhikr) return completeDhikr(Number(dhikr.getAttribute("data-dhikr")));
  const template = target.closest("[data-template]");
  if (template) return pickTemplate(Number(template.getAttribute("data-template")));
  const size = target.closest("[data-size]");
  if (size) return pickSize(Number(size.getAttribute("data-size")));
  const zakatTab = target.closest("[data-zakat]");
  if (zakatTab) return switchZakat(zakatTab.getAttribute("data-zakat"));
  const athkarChip = target.closest("[data-athkar]");
  if (athkarChip) return switchAthkar(Number(athkarChip.getAttribute("data-athkar")));

  for (const attribute of ["dua-cat", "radio-cat", "hadith-cat"]) {
    const chip = target.closest(`[data-${attribute}]`);
    if (chip) return switchCat(attribute, chip.getAttribute(`data-${attribute}`) ?? "");
  }
  const subtab = target.closest("[data-subtab]");
  if (subtab) return switchSubtab(subtab.getAttribute("data-subtab"));
  const copyDua = target.closest("[data-copy-dua]");
  if (copyDua) return copyDuaByIndex(Number(copyDua.getAttribute("data-copy-dua")));
  const copyTextBtn = target.closest("[data-copy-text]");
  if (copyTextBtn) return copyPlain(copyTextBtn.getAttribute("data-copy-text"));
  const archive = target.closest("[data-sadaka-archive]");
  if (archive) return toggleArchive(archive.getAttribute("data-sadaka-archive"));
  const del = target.closest("[data-sadaka-delete]");
  if (del) return deleteSadaka(del.getAttribute("data-sadaka-delete"));
  const tasbihBtn = target.closest("#tasbihBtn");
  if (tasbihBtn) return countTasbih();
}

function onChange(event) {
  const target = /** @type {HTMLInputElement} */ (event.target);
  switch (target.id) {
    case "citySelect":
      return loadTimes();
    case "calcMethod":
      write(KEYS.calcMethod, Number(target.value));
      return loadTimes();
    case "notifBefore":
      write(KEYS.notifBefore, Number(target.value));
      return scheduleNotifications();
    case "tasbihTarget":
      write("tasbeeh_target", Number(target.value));
      return renderTab();
    case "tasbihSelect":
      write("tasbih_index", Number(target.value));
      return renderTab();
    case "quranFont":
      write(KEYS.quranFontSize, Number(target.value));
      $("tabPanel").style.setProperty("--quran-fs", `${target.value}px`);
      return undefined;
    case "radioVolume":
      write(KEYS.radioVolume, Number(target.value));
      if (state.audio) state.audio.volume = Number(target.value) / 100;
      return undefined;
    case "wardTarget":
      return bumpWard(Number(target.value));
    case "surahType":
      return repaintSurahs();
    default:
      return undefined;
  }
}

function onInput(event) {
  const target = /** @type {HTMLInputElement} */ (event.target);
  if (target.id === "duaSearch") {
    $("duaList").innerHTML = filterHtml(APP_DUAS, target.value, activeCat("dua-cat"));
  }
  if (target.id === "radioSearch") {
    $("radioList").innerHTML = tabs.radioListHtml(RADIO_STATIONS, activeCat("radio-cat"), target.value);
  }
  if (target.id === "hadithSearch") {
    import("../data/hadiths.js").then(({ HADITHS }) => {
      $("hadithList").innerHTML = tabs.hadithListHtml(HADITHS, activeCat("hadith-cat"), target.value);
    });
  }
  if (target.id === "surahSearch") repaintSurahs();
}

function activeCat(attribute) {
  const chip = document.querySelector(`[data-${attribute}].active`);
  return chip?.getAttribute(`data-${attribute}`) ?? "";
}

/**
 * يبدّل شريحة الفئة النشِطة ويعيد رسم القائمة المرتبطة.
 * @param {string} attribute اسم السمة (dua-cat مثلًا) @param {string} value الفئة، والفارغ يعني «الكل»
 */
function switchCat(attribute, value) {
  document.querySelectorAll(`[data-${attribute}]`).forEach((chip) => {
    const on = chip.getAttribute(`data-${attribute}`) === value;
    chip.classList.toggle("active", on);
    chip.setAttribute("aria-pressed", String(on));
  });
  const query = (id) => /** @type {HTMLInputElement | null} */ ($(id))?.value ?? "";
  if (attribute === "dua-cat") {
    $("duaList").innerHTML = filterHtml(APP_DUAS, query("duaSearch"), value);
  } else if (attribute === "radio-cat") {
    $("radioList").innerHTML = tabs.radioListHtml(RADIO_STATIONS, value, query("radioSearch"));
  } else if (attribute === "hadith-cat") {
    import("../data/hadiths.js").then(({ HADITHS }) => {
      $("hadithList").innerHTML = tabs.hadithListHtml(HADITHS, value, query("hadithSearch"));
    });
  }
}

function filterHtml(items, query, category) {
  const needle = normalizeAr(query);
  const filtered = items.filter(
    (item) =>
      (!category || item.cat === category) &&
      (!needle || normalizeAr(`${item.title} ${item.text} ${item.ref}`).includes(needle)),
  );
  return tabs.duaListHtml(filtered, "");
}

/* ------------------------------------------------------------------ */
/* التهيئة لكل تبويب                                                   */
/* ------------------------------------------------------------------ */

function onEnter(id) {
  if (id === "quran") {
    surahList();
    loadSurah(Number(read("current_surah", 1)));
    markCachedSurahs();
  }
  if (id === "cards") drawCard();
  if (id === "prayer") {
    const timings = read("prayer_timings", null);
    if (timings) nextPrayer(timings);
  }
}

function tickDate() {
  const type = read(KEYS.calendarType, "hijri");
  const label = calendarLabel(type);
  const badge = $("hijriTopBar");
  if (badge) {
    badge.textContent = label;
    badge.title = "التقويم محسوب فلكيًا، والحكم بالرؤية";
  }
}

function updateOnline() {
  const banner = $("offlineBanner");
  if (banner) banner.hidden = navigator.onLine;
}

/* ------------------------------------------------------------------ */
/* المصحف                                                              */
/* ------------------------------------------------------------------ */

/**
 * يشغّل تلاوة السورة الحالية أو يوقفها، ويحدّث زرّ التشغيل.
 * التلاوة ملف واحد للسورة، فيُطلب مرة واحدة ثم يُستكمل.
 */
let recitation = null;

async function toggleRecitation() {
  const button = document.querySelector('[data-role="play"]');
  if (!button) return;

  if (recitation && !recitation.paused) {
    recitation.pause();
    button.textContent = "▶ تشغيل";
    return;
  }

  const chapter = Number(read("current_surah", 1));
  if (!isValidChapter(chapter)) return showToast("رقم السورة غير صحيح.");

  const reciter = Number(read(KEYS.reciter, DEFAULT_RECITER)) || DEFAULT_RECITER;
  button.disabled = true;
  button.textContent = "جارٍ التحميل…";

  try {
    if (!recitation) recitation = await createRecitation();
    if (recitation.dataset.chapter !== String(chapter) || recitation.dataset.reciter !== String(reciter)) {
      const payload = await fetchJson(chapterAudioUrl(reciter, chapter));
      const url = audioUrlOf(payload);
      if (!url) throw new Error("لا يوجد ملف تلاوة لهذه السورة.");
      recitation.src = url;
      recitation.dataset.chapter = String(chapter);
      recitation.dataset.reciter = String(reciter);
    }
    await recitation.play();
    button.textContent = "⏸ إيقاف";
  } catch {
    button.textContent = "▶ تشغيل";
    showToast("تعذّر تحميل التلاوة. تحقّق من الاتصال.");
  } finally {
    button.disabled = false;
  }
}

/** يوقف التلاوة ويصفر زرّ التشغيل،عند تغيير القارئ. */
function stopRecitation() {
  if (recitation) {
    recitation.pause();
    delete recitation.dataset.chapter;
    delete recitation.dataset.reciter;
  }
  const button = document.querySelector('[data-role="play"]');
  if (button) button.textContent = "▶ تشغيل";
}

/** يشغّل التلاوة، ويُعيد ضبطها إن انتهت أو تغيّرت السورة. */
async function createRecitation() {
  const audio = new Audio();
  audio.preload = "none";
  audio.addEventListener("ended", () => {
    const button = document.querySelector('[data-role="play"]');
    if (button) button.textContent = "▶ تشغيل";
  });
  return audio;
}

/** وضع التركيز: يختفي كل ما ليس المصحف حتى يبقى النص وحده. */
function toggleFocusMode() {
  const on = !document.body.classList.contains("focus-mode");
  document.body.classList.toggle("focus-mode", on);
  write(KEYS.focusMode, on);
  const button = document.querySelector('[data-role="focus"]');
  if (button) {
    button.textContent = on ? "↩️ خروج من التركيز" : "👁️ وضع التركيز";
    button.setAttribute("aria-pressed", String(on));
  }
}

/**
 * ينتقل بين السور ملاصقًا، ويقف عند المصحف من طرفيه.
 * @param {number} delta  ‎-1‎ للسابقة و‎+1‎ للتالية
 */
function stepSurah(delta) {
  const current = Number(read("current_surah", 1)) || 1;
  const next = Math.min(114, Math.max(1, current + delta));
  if (next === current) {
    return showToast(delta > 0 ? "هذه آخر سورة في المصحف." : "هذه أول سورة في المصحف.");
  }
  return loadSurah(next);
}

async function loadSurah(number, { preferCache = false } = {}) {
  const body = $("quranBody");
  const meta = $("surahMeta");
  if (!body) return;
  write("current_surah", number);

  const cached = await idbGet(number);
  if (cached && (preferCache || !navigator.onLine)) {
    renderSurah(cached, body, meta);
    if (meta) meta.textContent += " — متاحة بدون إنترنت ⬇️";
    return;
  }

  body.textContent = "جارٍ التحميل…";
  try {
    const payload = await fetchJson(`https://api.alquran.cloud/v1/surah/${number}`, { timeout: 9000 });
    const surah = payload?.data;
    if (!surah || !Array.isArray(surah.ayahs)) throw new Error("رد غير متوقّع");
    renderSurah(surah, body, meta);
  } catch (error) {
    body.innerHTML = `<p class="empty">تعذّر تحميل السورة — ${networkError(error)}</p>`;
    showToast("اضغط «⬇️ حفظ» لتخزينها للعمل بدون إنترنت.", false, 5000);
  }
}

/** يرسم نص السورة ويضبط الحجم والصف النشط. */
function renderSurah(surah, body, meta) {
  if (meta) meta.textContent = `${surah.name} — ${toArNum(surah.numberOfAyahs)} آية`;
  renderVerses(surah.ayahs, body, Number(read(KEYS.quranFontSize, 24)));
  document.querySelectorAll(".surah-row").forEach((row) =>
    row.classList.toggle("active", row.getAttribute("data-surah") === String(surah.number)),
  );
}

/* ------------------------------------------------------------------ */
/* أدوات القراءة: التجويد · التفسير · كلمة بكلمة                       */
/* ------------------------------------------------------------------ */

/** @type {{mode: "plain"|"tajweed"|"wbw", tafsir: string|null, tafsirLabel: string}} */
const reader = { mode: "plain", tafsir: null, tafsirLabel: "" };

/** يعيد رسم السورة بالوضع الحالي. */
async function refreshReading() {
  const body = $("quranBody");
  const meta = $("surahMeta");
  const number = Number(read("current_surah", 1));
  const status = $("readStatus");
  const fontSize = Number(read(KEYS.quranFontSize, 24));

  if (reader.mode === "tajweed") {
    if (status) status.textContent = "جارٍ تحميل التجويد…";
    try {
      const verses = await loadTajweed(number);
      renderVerses(verses, body, fontSize);
      if (status) status.textContent = "التلوين بأحكام التجويد.";
    } catch (error) {
      reader.mode = "plain";
      syncReadButtons();
      showToast(`تعذّر تحميل التجويد — ${networkError(error)}`);
      await refreshReading();
      return;
    }
  } else if (reader.mode === "wbw") {
    if (status) status.textContent = "جارٍ تحميل الترجمة…";
    try {
      const verses = await loadWordByWord(number);
      renderWordByWord(verses, body, fontSize);
      if (status) status.textContent = "الترجمة كلمة بكلمة.";
    } catch (error) {
      reader.mode = "plain";
      syncReadButtons();
      showToast(`تعذّر تحميل الترجمة — ${networkError(error)}`);
      await refreshReading();
      return;
    }
  } else {
    await loadSurah(number);
  }

  if (reader.tafsir) await refreshTafsir();
}

/** يزامن حالة أزرار القراءة مع الوضع الحالي. */
function syncReadButtons() {
  const marks = {
    "toggle-tajweed": reader.mode === "tajweed",
    "toggle-wbw": reader.mode === "wbw",
    tafsir: Boolean(reader.tafsir),
  };
  for (const [role, on] of Object.entries(marks)) {
    const button = document.querySelector(`[data-role="${role}"]`);
    if (button) button.setAttribute("aria-pressed", String(on));
  }
  const options = $("tafsirOptions");
  if (options) options.hidden = !reader.tafsir;
}

/** يبدّل بين النصّ العادي والتجويد. */
async function toggleTajweed() {
  const next = reader.mode === "tajweed" ? "plain" : "tajweed";
  reader.mode = next;
  if (next === "tajweed") reader.tafsir = null;
  syncReadButtons();
  if (next === "plain") {
    const holder = $("tafsirBody");
    if (holder) holder.hidden = true;
    await refreshReading();
    return;
  }
  await refreshReading();
}

/** يبدّل بين النصّ العادي والترجمة كلمة بكلمة. */
async function toggleWordByWord() {
  const next = reader.mode === "wbw" ? "plain" : "wbw";
  reader.mode = next;
  if (next === "wbw") reader.tafsir = null;
  syncReadButtons();
  if (next === "plain") {
    const holder = $("tafsirBody");
    if (holder) holder.hidden = true;
    await refreshReading();
    return;
  }
  await refreshReading();
}

/** يُظهر أو يخفي لوحة التفسير. */
function toggleTafsirPanel() {
  reader.tafsir = reader.tafsir ? null : (TAFSIR_TYPES[0].key);
  reader.tafsirLabel = reader.tafsir ? TAFSIR_TYPES[0].label : "";
  syncReadButtons();
  if (!reader.tafsir) {
    const holder = $("tafsirBody");
    if (holder) holder.hidden = true;
    return;
  }
  refreshTafsir();
}

/** يغيّر نوع التفسير المعروض. */
async function selectTafsir(key) {
  const type = TAFSIR_TYPES.find((item) => item.key === key);
  if (!type) return;
  reader.tafsir = type.key;
  reader.tafsirLabel = type.label;
  document.querySelectorAll("#tafsirOptions .chip").forEach((chip) =>
    chip.classList.toggle("active", chip.getAttribute("data-tafsir") === key),
  );
  await refreshTafsir();
}

/** يُحمّل التفسير ويعرضه. */
async function refreshTafsir() {
  if (!reader.tafsir) return;
  const holder = $("tafsirBody");
  if (!holder) return;
  const number = Number(read("current_surah", 1));
  holder.hidden = false;
  holder.innerHTML = `<p class="empty">جارٍ تحميل التفسير…</p>`;
  try {
    const entries = await loadTafsir(number, reader.tafsir);
    renderTafsir(entries, holder, reader.tafsirLabel);
  } catch (error) {
    holder.innerHTML = `<p class="empty">تعذّر تحميل التفسير — ${networkError(error)}</p>`;
  }
}

/* ------------------------------------------------------------------ */
/* مؤقّت النوم للإذاعة                                                  */
/* ------------------------------------------------------------------ */

/** @type {number | null} معرّف المؤقّت الجاري */
let sleepTimerId = null;

/**
 * يوقف الإذاعة بعد مدّة محدّدة.
 * @param {number} minutes المدّة بالدقائق
 */
function startSleepTimer(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  cancelSleepTimer();
  const status = $("sleepStatus");
  if (status) status.textContent = `سيتوقّف التشغيل بعد ${toArNum(minutes)} دقيقة.`;
  sleepTimerId = window.setTimeout(() => {
    state.audio?.pause();
    if (state.audio) state.audio.src = "";
    sleepTimerId = null;
    const now = $("radioNow");
    if (now) now.textContent = "توقّفت الإذاعة بمؤقّت النوم";
    showToast("انتهى وقت النوم — توقّفت الإذاعة 🌙");
  }, minutes * 60000);
  write("sleep_minutes", minutes);
}

/** يلغي مؤقّت النوم إن كان مبرمجًا. */
function cancelSleepTimer() {
  if (sleepTimerId !== null) {
    window.clearTimeout(sleepTimerId);
    sleepTimerId = null;
  }
  const status = $("sleepStatus");
  if (status) status.textContent = "";
  showToast("أُلغي مؤقّت النوم");
}

/** ينسخ الآية الأولى مع مرجعها (أو الآية المحدَّدة). */
async function copyCurrentAyah() {
  const body = $("quranBody");
  if (!body) return;
  const first = body.querySelector(".ayah");
  if (!first) return showToast("لا توجد آية بعد.");
  const number = Number(read("current_surah", 1));
  const name = /** @type {HTMLElement | null} */ ($("surahMeta"))?.textContent?.split("—")[0]?.trim() ?? "";
  const index = Number(first.getAttribute("data-ayah") ?? 1);
  const text = first.textContent?.replace(/۝[٠-٩]+/g, "").trim() ?? "";
  copyText(ayahWithRef({ name, number }, { numberInSurah: index, text }))
    .then(() => showToast("نُسخت الآية مع مرجعها."));
}

/**
 * يحفظ علامة على الآية المعروضة أو يزيلها إن كانت محفوظة.
 * العلامة بصيغة `surah:ayah` واسمها هو ما يظهر على الشريحة.
 */
function toggleBookmarkAyah() {
  const body = $("quranBody");
  const first = body?.querySelector(".ayah");
  if (!first) return showToast("حمّل السورة أولًا.");
  const surah = Number(read("current_surah", 1));
  const ayah = Number(first.getAttribute("data-ayah") ?? 1);
  const key = tabs.bookmarkKey(surah, ayah);
  const list = read(KEYS.quranBookmarks, []);
  const saved = list.includes(key);
  const next = saved ? list.filter((item) => item !== key) : [...list, key];
  write(KEYS.quranBookmarks, next);
  showToast(saved ? "أُزيلت العلامة" : "حُفظت العلامة.");
  renderBookmarks();
}

/** يعيد رسم قسم العلامات فقط، فلا تُعاد قراءة السورة. */
function renderBookmarks() {
  const holder = $("bookmarksHolder");
  if (holder) holder.innerHTML = tabs.bookmarksHtml(read(KEYS.quranBookmarks, []));
}

/** ينتقل إلى العلامة المحفوظة فيُحمّل سورتها ثم يمرّر إلى آيتها. */
async function gotoAyah(key) {
  const [surah, ayah] = tabs.parseBookmark(key);
  if (!surah) return showToast("علامة غير صالحة.");
  if (Number(read("current_surah", 1)) !== surah) await loadSurah(surah);
  const target = $("quranBody")?.querySelector(`.ayah[data-ayah="${ayah}"]`);
  if (!target) return showToast(`لم تُحمَّل الآية ${toArNum(ayah)} بعد.`);
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("flash");
  setTimeout(() => target.classList.remove("flash"), 2400);
}

/** يحمّل سورة ويحفظها في IndexedDB للعمل بدون إنترنت. */
async function cacheSurah(number) {
  const status = $("cacheStatus");
  if (status) status.textContent = `جارٍ حفظ السورة ${toArNum(number)}…`;
  try {
    const payload = await fetchJson(`https://api.alquran.cloud/v1/surah/${number}`, { timeout: 12000 });
    const surah = payload?.data;
    if (!surah || !Array.isArray(surah.ayahs)) throw new Error("رد غير متوقّع");
    await idbPut({ ...surah, cachedAt: Date.now() });
    await trimOfflineCache(50);
    await markCachedSurahs();
    if (status) status.textContent = `تم حفظ «${surah.name}» للعمل بدون إنترنت ✅`;
    showToast(`تم حفظ سورة ${surah.name} — تعمل الآن بدون إنترنت.`);
  } catch (error) {
    if (status) status.textContent = "تعذّر حفظ السورة.";
    showToast(`تعذّر الحفظ — ${networkError(error)}`);
  }
}

/** يحفظ عدة سور قصيرة دفعة واحدة. */
async function bulkCache() {
  const numbers = tabs.shortSurahs();
  const status = $("cacheStatus");
  if (!numbers.length) return;
  let done = 0;
  for (const number of numbers) {
    if (await idbGet(number)) {
      done += 1;
      continue;
    }
    if (status) status.textContent = `جارٍ التفريغ… ${toArNum(done + 1)} من ${toArNum(numbers.length)}`;
    try {
      const payload = await fetchJson(`https://api.alquran.cloud/v1/surah/${number}`, { timeout: 12000 });
      const surah = payload?.data;
      if (surah && Array.isArray(surah.ayahs)) await idbPut({ ...surah, cachedAt: Date.now() });
    } catch {
      /* نتخطى السور التي تفشل ونكمل */
    }
    done += 1;
  }
  await trimOfflineCache(50);
  await markCachedSurahs();
  if (status) status.textContent = `اكتمل التفريغ — ${toArNum(done)} سورة متاحة بدون إنترنت ✅`;
  showToast("تم تفريغ السور للعمل بدون إنترنت.");
}

/** يحذف كل السور المخزّنة. */
async function clearCachedSurahs() {
  if (!confirm("حذف كل السور المخزّنة على الجهاز؟")) return;
  const list = await idbList();
  await destroyIDB();
  await markCachedSurahs();
  const status = $("cacheStatus");
  if (status) status.textContent = list.length ? "تم حذف السور المخزّنة." : "لا توجد سور مخزّنة.";
  showToast("تم حذف التخزين المحلي للمصحف.");
}

/** يعلّم السور المخزّنة بعلامة ⬇️ في قائمة السور. */
async function markCachedSurahs() {
  const rows = await idbList();
  const numbers = new Set(rows.map((row) => Number(row.number)));
  document.querySelectorAll(".surah-row").forEach((row) => {
    const number = Number(row.getAttribute("data-surah"));
    row.classList.toggle("cached", numbers.has(number));
    const badge = row.querySelector(".cached-mark");
    if (badge) badge.textContent = numbers.has(number) ? "⬇️" : "";
  });
}

async function surahList() {
  if (state.surahs) return state.surahs;
  const rows = tabs.surahOptions();
  const holder = $("surahList");
  if (holder) holder.innerHTML = rows;
  state.surahs = rows;
  return rows;
}

/**
 * يرسم قائمة السور بعد التصفية بالاسم والنوع معًا.
 * @param {string} query @param {string} type "Meccan" أو "Medinan" أو "" للكل
 */
function filterSurahs(query = "", type = "") {
  const needle = normalizeAr(query);
  // surahOptions يعيد HTML نصًّا، فالفحص على النص نفسه لا على مصفوفة.
  const rows = tabs
    .surahOptions()
    .split(/(?=<button class="surah-row")/)
    .filter((row) => row.includes('class="surah-row"'))
    .filter(
      (row) =>
        (!type || row.includes(`data-type="${type}"`)) &&
        (!needle || normalizeAr(stripHtml(row)).includes(needle)),
    );
  const holder = $("surahList");
  if (holder) holder.innerHTML = rows.join("") || `<p class="empty">لا توجد نتائج.</p>`;
}

/** يعيد رسم قائمة السور بالبحث الحالي وبالتصفية المحفوظة. */
function repaintSurahs() {
  const query = /** @type {HTMLInputElement | null} */ ($("surahSearch"))?.value ?? "";
  const type = /** @type {HTMLSelectElement | null} */ ($("surahType"))?.value ?? "";
  filterSurahs(query, type);
}

/* ------------------------------------------------------------------ */
/* الختمة                                                              */
/* ------------------------------------------------------------------ */

function khatmaState() {
  return read(KEYS.khatma, { v: 1, parts: new Array(30).fill(false), assignees: {}, dedication: "", ts: Date.now() });
}

function toggleJuz(index) {
  const state_ = khatmaState();
  state_.parts[index] = !state_.parts[index];
  state_.ts = Date.now();
  write(KEYS.khatma, state_);
  renderTab();
}

function assignKhatma() {
  const name = /** @type {HTMLInputElement} */ ($("assigneeName"))?.value.trim();
  const index = Number(/** @type {HTMLSelectElement} */ ($("assigneeJuz"))?.value);
  if (!name) return showToast("اكتب اسم المُسند أولًا.");
  const state_ = khatmaState();
  state_.assignees = { ...state_.assignees, [index]: name };
  write(KEYS.khatma, state_);
  write(KEYS.khatmaAssignees, state_.assignees);
  showToast("تم الإسناد");
  renderTab();
}

function resetKhatma() {
  if (!confirm("تصفير الختمة وحذف الإسنادات؟")) return;
  write(KEYS.khatma, { v: 1, parts: new Array(30).fill(false), assignees: {}, dedication: "", ts: Date.now() });
  write(KEYS.khatmaAssignees, {});
  renderTab();
}

function shareKhatmaLink() {
  import("../lib/b64.js").then(({ syncUrl, clearSyncHash }) => {
    const url = syncUrl(khatmaState());
    clearSyncHash();
    copyText(url).then(() => showToast("تم نسخ رابط المزامنة — أرسله للمشاركين"));
  });
}

function exportKhatmaText() {
  const state_ = khatmaState();
  const lines = state_.parts.map(
    (done, index) =>
      `الجزء ${toArNum(index + 1)}: ${done ? "✓ تم" : "—"} ${state_.assignees[index] ? `👤 ${state_.assignees[index]}` : ""}`,
  );
  const text = [`الختمة الجماعية${state_.dedication ? ` — ${state_.dedication}` : ""}`, ...lines].join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "khatma.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importSyncHash() {
  const { readSyncHash, isValidKhatmaSync } = await import("../lib/b64.js");
  const incoming = readSyncHash();
  if (!incoming || !isValidKhatmaSync(incoming)) return;
  const mine = khatmaState();
  const mineDone = mine.parts.filter(Boolean).length;
  const theirDone = incoming.parts.filter(Boolean).length;
  const merge = confirm(
    `النسخة المُرسلة: ${toArNum(theirDone)} جزء • نسختك: ${toArNum(mineDone)} أجزاء.\nنعم = استبدال، إلغاء = دمج`,
  );
  if (merge) {
    write(KEYS.khatma, incoming);
    showToast("تم استبدال نسخة الختمة.");
  } else {
    const merged = {
      ...mine,
      parts: mine.parts.map((value, index) => value || incoming.parts[index]),
      assignees: { ...incoming.assignees, ...mine.assignees },
    };
    write(KEYS.khatma, merged);
    showToast("تم دمج النسختين.");
  }
  const { clearSyncHash } = await import("../lib/b64.js");
  clearSyncHash();
  renderTab();
}

/* ------------------------------------------------------------------ */
/* الأذكار والسبحة                                                     */
/* ------------------------------------------------------------------ */

function switchAthkar(index) {
  state.athkar = index;
  import("../data/app-athkar.js").then(({ ATHKAR_DATA }) => {
    const group = ATHKAR_DATA[index];
    const holder = $("athkarSubTabContent");
    if (group && holder) {
      holder.innerHTML = tabs.renderAthkarItems(group, read(KEYS.athkarProgress, {}));
      holder.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
  document.querySelectorAll("[data-athkar]").forEach((chip) =>
    chip.classList.toggle("active", chip.getAttribute("data-athkar") === String(index)),
  );
}

function switchSubtab(name) {
  const athkarPanel = $("athkarSubTabContent");
  const tasbihPanelNode = $("tasbeehSubTabContent");
  if (!athkarPanel || !tasbihPanelNode) return;
  const showAthkar = name === "athkar";
  athkarPanel.hidden = !showAthkar;
  tasbihPanelNode.hidden = showAthkar;
  document.querySelectorAll("[data-subtab]").forEach((chip) =>
    chip.classList.toggle("active", chip.getAttribute("data-subtab") === name),
  );
}

function completeDhikr(index) {
  const progress = read(KEYS.athkarProgress, {});
  progress[index] = true;
  write(KEYS.athkarProgress, progress);
  buzz(40);
  renderTab();
}

function resetAthkar() {
  if (!confirm("تصفير تقدّم الأذكار لهذا اليوم؟")) return;
  write(KEYS.athkarProgress, {});
  renderTab();
}

function countTasbih() {
  const target = Number(read("tasbeeh_target", 33));
  const next = tasbihStep(
    { count: read(KEYS.tasbihCount, 0), total: read("total_all_tasbeeh", 0), target },
    "سُبْحَانَ ٱللَّهِ",
  );
  write(KEYS.tasbihCount, next.count);
  write("total_all_tasbeeh", next.total);
  const stats = updateStreak(read(KEYS.stats, { streak: 0, dhikrToday: 0, day: "" }));
  stats.dhikrToday += 1;
  write(KEYS.stats, stats);
  const button = $("tasbihBtn");
  if (button) button.textContent = toArNum(next.count);
  const bar = $("tasbihBar");
  if (bar) bar.style.width = `${tasbihPercent(next.count, target)}%`;
  if (next.reached) {
    buzz(200);
    showToast("ما شاء الله — أتممت الهدف 🌟", true);
  }
}

/* ------------------------------------------------------------------ */
/* الصلاة والإشعارات                                                    */
/* ------------------------------------------------------------------ */

async function loadTimes() {
  const list = $("prayerTimes");
  const city = /** @type {HTMLSelectElement | null} */ ($("citySelect"))?.value;
  const method = Number(read(KEYS.calcMethod, 5));
  const coords = read(KEYS.prayerCoords, null) ?? cityCoords(city);
  if (!coords) return showToast("اختر مدينة أولًا.");
  if (list) list.innerHTML = `<p class="empty">جارٍ الجلب…</p>`;
  try {
    const timings = await fetchPrayerTimes(coords, method);
    write("prayer_timings", timings);
    renderTab();
    nextPrayer(timings);
    scheduleNotifications();
  } catch (error) {
    if (list) list.innerHTML = `<p class="empty">${networkError(error)}</p>`;
    else showToast(networkError(error));
  }
}

/** @param {string | null} name مفتاح المدينة `المدينة,الدولة` */
function cityCoords(name) {
  if (!name) return null;
  const city = CITY_LIST.find((item) => item.en === name);
  return city ? { lat: city.lat, lng: city.lng } : null;
}

function nextPrayer(timings) {
  const order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const names = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  for (const key of order) {
    const { hour, minute } = parseClock(timings[key]);
    if (!Number.isFinite(hour)) continue;
    if (hour * 60 + minute > minutesNow) {
      const name = $("nextPrayerName");
      const sub = $("nextPrayerHumanTime");
      if (name) name.textContent = names[key];
      if (sub) {
        const diff = hour * 60 + minute - minutesNow;
        sub.textContent = `بعد ${toArNum(Math.floor(diff / 60))} ساعة و${toArNum(diff % 60)} دقيقة — ${toArNum(timings[key])}`;
      }
      return;
    }
  }
}

async function locateApp() {
  try {
    const coords = await requestLocation();
    const angle = calcQibla(coords.lat, coords.lng);
    if (angle === null) {
      showToast("أعاد جهازك إحداثيات خارج المدى — لم تُحسب القبلة.");
      return;
    }
    write(KEYS.prayerCoords, coords);
    showToast(`اتجاه القبلة من موقعك: ${toArNum(Math.round(angle))}° — ${compassName(angle)}`);
    loadTimes();
  } catch (error) {
    showToast(/** @type {Error} */ (error).message);
  }
}

function playAthan() {
  state.audio?.pause();
  const audio = new Audio(ATHAN_URLS[0]);
  audio.volume = Number(read(KEYS.radioVolume, 80)) / 100;
  audio.play().catch(() => showToast("تعذّر تشغيل الصوت."));
  state.audio = audio;
}

/**
 * جرس الإشعارات. الإذن يُطلب تلقائيًّا عند أوّل لمسة، فبقي للزرّ
 * عملان: التأكد من وصول الإشعار، وجدولة الأذان بعد إغفائه.
 */
async function requestNotifications() {
  if (!("Notification" in window)) return showToast("متصفحك لا يدعم الإشعارات.");

  if (Notification.permission === "granted") {
    write(KEYS.notifEnabled, true);
    scheduleNotifications();
    await autoNotify.pushPrayerSchedule();
    const shown = await autoNotify.test({ url: location.href });
    showToast(shown ? "جرّب الإشعار الذي ظهر 🔔" : "تعذّر عرض الإشعار — تأكّد من إعدادات الموقع.");
    return;
  }

  if (Notification.permission === "denied") {
    return showToast("المتصفّح يمنع إشعارات هذا الموقع — فعّلها من إعداداته.", false, 5000);
  }

  const permission = await Notification.requestPermission();
  write(KEYS.notifEnabled, permission === "granted");
  showToast(permission === "granted" ? "تم تفعيل الإشعارات 🔔" : "لم يُمنح إذن الإشعارات.");
  if (permission === "granted") scheduleNotifications();
}

function scheduleNotifications() {
  if (!read(KEYS.notifEnabled, false) || !("Notification" in window)) return;
  const timings = read("prayer_timings", null);
  if (!timings) return;
  const before = Number(read(KEYS.notifBefore, 10));
  const order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const names = { Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };
  for (const key of order) {
    const delay = msUntil(timings[key]) - before * 60000;
    if (delay <= 0) continue;
    setTimeout(() => {
      const payload = {
        title: `🕌 حان الآن وقت صلاة ${names[key]}`,
        body: `حي على الصلاة، حي على الفلاح — ${timings[key]}`,
        tag: key,
      };
      // نمرّرها عبر عامل الخدمة حتى تظهر الإشعارات في أندرويد بعد إغلاق الصفحة.
      if (!notify(payload)) {
        try {
          new Notification(payload.title, { body: payload.body, tag: payload.tag });
        } catch {
          /* غير مدعوم في هذا المتصفّح */
        }
      }
    }, Math.min(delay, 2147483647));
  }
}

/** يحوّل «04:12 (EET)» إلى أجزاء رقمية. */
function parseClock(value) {
  const match = String(value ?? "").match(/(\d{1,2}):(\d{2})/);
  return { hour: match ? Number(match[1]) : Number.NaN, minute: match ? Number(match[2]) : Number.NaN };
}

function msUntil(time) {
  const { hour, minute } = parseClock(time);
  if (!Number.isFinite(hour)) return -1;
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  return target.getTime() - Date.now();
}

/* ------------------------------------------------------------------ */
/* المتابعة                                                             */
/* ------------------------------------------------------------------ */

function markPrayer(name) {
  const key = `${dateKey()}:${name}`;
  const tracker = read(KEYS.prayerTracker, {});
  tracker[key] = !tracker[key];
  write(KEYS.prayerTracker, tracker);
  renderTab();
}

function bumpWard(target) {
  const ward = read(KEYS.quranWard, { target: 1, done: 0 });
  if (target) ward.target = Number(target) || 1;
  else ward.done += 1;
  write(KEYS.quranWard, ward);
  renderTab();
}

function exportData() {
  const payload = Object.fromEntries(storageKeys().map((key) => [key, read(key, null)]));
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `noor-backup-${dateKey()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return void showToast("الملف لا يحتوي على بيانات صالحة.");
      }
      // الملف يأتي من createBackup داخل غلاف {format,version,createdAt,data}.
      // تمرير الغلاف كما هو يجعل كل مفتاح مجهولًا فيُرفض الملف كله.
      const payload =
        parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
          ? parsed.data
          : parsed;
      const { written, rejected } = importKnownKeys(payload);
      if (!written.length) {
        return void showToast("لا يحتوي الملف على بيانات معروفة للتطبيق.");
      }
      renderTab();
      showToast(
        rejected.length
          ? `استُورد ${toArNum(written.length)} مفتاحًا، وتُخُطّي ${toArNum(rejected.length)} غير معروف.`
          : `تم الاستيراد بنجاح — ${toArNum(written.length)} مفتاحًا.`,
      );
    } catch {
      showToast("الملف غير صالح.");
    }
  });
  input.click();
}

/* ------------------------------------------------------------------ */
/* الأدعية والإذاعة والحديث                                             */
/* ------------------------------------------------------------------ */

function copyDuaByIndex(index) {
  const item = APP_DUAS[index];
  if (!item) return;
  copyText(`${item.text}\n[${item.ref}]`).then(() => showToast("تم نسخ الدعاء"));
}

async function copyPlain(text) {
  const ok = await copyText(text ?? "");
  showToast(ok ? "تم النسخ" : "تعذّر النسخ");
}

function toggleRadio() {
  if (state.audio && !state.audio.paused) {
    state.audio.pause();
    showToast("تم الإيقاف");
    return;
  }
  const last = read(KEYS.reciter, RADIO_STATIONS[0].url);
  playStationUrl(last);
}

function playStation(index) {
  const station = RADIO_STATIONS[index];
  if (!station) return;
  write(KEYS.reciter, station.url);
  playStationUrl(station.url, station.name);
}

function playStationUrl(url, name = "الإذاعة") {
  state.audio?.pause();
  const audio = new Audio(url);
  audio.volume = Number(read(KEYS.radioVolume, 80)) / 100;
  audio.play().then(
    () => {
      const now = $("radioNow");
      if (now) now.textContent = name;
      document.querySelectorAll(".radio-row").forEach((row) => row.classList.remove("playing"));
      showToast(`▶ ${name}`);
    },
    () => showToast("تعذّر تشغيل المحطة — جرّب محطة أخرى."),
  );
  state.audio = audio;
}

/* ------------------------------------------------------------------ */
/* صانع البطاقات والصدقة الجارية                                        */
/* ------------------------------------------------------------------ */

let cardState = {
  template: CARD_TEMPLATES[0],
  size: CARD_SIZES[0],
};

function pickTemplate(index) {
  cardState.template = CARD_TEMPLATES[index];
  const text = /** @type {HTMLTextAreaElement | null} */ ($("cardText"));
  const ref = /** @type {HTMLInputElement | null} */ ($("cardRef"));
  if (text) text.value = cardState.template.text;
  if (ref) ref.value = cardState.template.ref;
  document.querySelectorAll("[data-template]").forEach((chip) =>
    chip.classList.toggle("active", chip.getAttribute("data-template") === String(index)),
  );
  drawCard();
}

function pickSize(index) {
  cardState.size = CARD_SIZES[index];
  document.querySelectorAll("[data-size]").forEach((chip) =>
    chip.classList.toggle("active", chip.getAttribute("data-size") === String(index)),
  );
  drawCard();
}

function drawCard() {
  const canvas = /** @type {HTMLCanvasElement | null} */ ($("cardCanvas"));
  if (!canvas) return;
  const [, width, height] = cardState.size;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const text = /** @type {HTMLTextAreaElement | null} */ ($("cardText"))?.value || cardState.template.text;
  const ref = /** @type {HTMLInputElement | null} */ ($("cardRef"))?.value ?? cardState.template.ref;
  const from = /** @type {HTMLInputElement | null} */ ($("cardFrom"))?.value ?? "";

  ctx.fillStyle = "#fbf8f1";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = Math.max(4, width / 150);
  ctx.strokeRect(20, 20, width - 40, height - 40);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f4d38";
  ctx.font = `700 ${Math.round(width / 12)}px "Amiri", serif`;
  wrapText(ctx, text, width / 2, height / 2 - 40, width - 120, Math.round(width / 18));
  ctx.fillStyle = "#c9a227";
  ctx.font = `600 ${Math.round(width / 26)}px "Cairo", sans-serif`;
  ctx.fillText(ref, width / 2, height - 110);
  ctx.fillStyle = "#5d7268";
  ctx.font = `400 ${Math.round(width / 34)}px "Cairo", sans-serif`;
  ctx.fillText(from ? `— ${from}` : "", width / 2, height - 70);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  let line = "";
  for (const word of words) {
    const attempt = `${line}${word} `;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = `${word} `;
      y += lineHeight;
    } else {
      line = attempt;
    }
  }
  ctx.fillText(line, x, y);
}

function downloadCard() {
  drawCard();
  const canvas = /** @type {HTMLCanvasElement | null} */ ($("cardCanvas"));
  if (!canvas) return;
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "card.png";
  link.click();
}

async function copyCardText() {
  const text = /** @type {HTMLTextAreaElement | null} */ ($("cardText"))?.value || "";
  const ok = await copyText(text);
  showToast(ok ? "تم نسخ النص" : "تعذّر النسخ");
}

function sadakaList() {
  return read(KEYS.sadakaCards, []);
}

function createSadaka() {
  openContentModal("إنشاء بطاقة صدقة", `<form id="sadakaForm">
    <div class="form-group"><label for="sadakaName">الاسم</label><input id="sadakaName" required></div>
    <div class="form-group"><label for="sadakaDesc">الوصف</label><textarea id="sadakaDesc" rows="3"></textarea></div>
    <div class="form-group"><label for="sadakaAmount">المبلغ (اختياري)</label><input id="sadakaAmount" type="number"></div>
    <button class="btn primary" type="submit">حفظ</button></form>`);
  $("contentModalBody")?.querySelector("#sadakaForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = /** @type {HTMLInputElement} */ ($("sadakaName")).value.trim();
    if (!name) return showToast("اكتب الاسم أولًا.");
    const list = sadakaList();
    list.unshift({
      id: `s${Date.now()}`,
      name,
      desc: /** @type {HTMLTextAreaElement} */ ($("sadakaDesc")).value.trim(),
      amount: Number(/** @type {HTMLInputElement} */ ($("sadakaAmount")).value) || 0,
      archived: false,
    });
    write(KEYS.sadakaCards, list);
    closeModals();
    renderTab();
    showToast("تم إنشاء البطاقة");
  });
}

function toggleArchive(id) {
  const list = sadakaList();
  const item = list.find((entry) => entry.id === id);
  if (item) item.archived = !item.archived;
  write(KEYS.sadakaCards, list);
  write("sadaka_archived", list.some((entry) => entry.archived));
  renderTab();
}

function deleteSadaka(id) {
  if (!confirm("حذف البطاقة نهائيًا؟")) return;
  write(KEYS.sadakaCards, sadakaList().filter((entry) => entry.id !== id));
  renderTab();
}

/* ------------------------------------------------------------------ */
/* الزكاة                                                              */
/* ------------------------------------------------------------------ */

function switchZakat(kind) {
  const panel = $("zakatPanel");
  if (panel) panel.innerHTML = tabs.zakatPanelHtml(kind);
  document.querySelectorAll("[data-zakat]").forEach((chip) =>
    chip.classList.toggle("active", chip.getAttribute("data-zakat") === kind),
  );
}

const numberOf = (id) => Number(/** @type {HTMLInputElement | null} */ ($(id))?.value) || 0;

function zakatMoney() {
  const cash = Math.max(0, numberOf("cashAmount") - numberOf("cashDebts"));
  const result = calculateZakat(cash, 0);
  renderZakat(result.due ? `${toArNum(result.due)}` : "لا زكاة", cash);
}

function zakatMetal() {
  const holding = /** @type {HTMLSelectElement} */ ($("metalHolding"))?.value === "jewelry"
    ? "jewelry"
    : "trade";
  const gold = calculateMetalZakat(numberOf("goldWeight"), numberOf("goldPrice"), "gold", holding);
  const silver = calculateMetalZakat(numberOf("silverWeight"), numberOf("silverPrice"), "silver", holding);
  const due = gold.due + silver.due;
  const show = (item) =>
    holding === "jewelry" ? "زينة" : item.belowNisab ? "دون النصاب" : toArNum(item.due);
  const note = holding === "jewelry"
    ? `الذهب: ${show(gold)} · الفضة: ${show(silver)}. الزينة لا يجب فيها زكاة النصاب، فإن أردت الاستيفاء فاحسبها للتجارة وراجع أهل العلم.`
    : `الذهب: ${show(gold)} · الفضة: ${show(silver)}`;
  renderZakat(
    toArNum(Math.round(due * 100) / 100),
    gold.value + silver.value,
    note,
  );
}

function zakatTrade() {
  const total = numberOf("stocksValue") + numberOf("realEstateValue") - numberOf("debts");
  const result = calculateZakat(Math.max(0, total), 0);
  renderZakat(toArNum(result.due), Math.max(0, total));
}

function zakatLivestock() {
  const rows = calculateLivestockZakat({
    camels: numberOf("camels"),
    cows: numberOf("cows"),
    sheep: numberOf("sheep"),
  });
  const detail = rows
    .map((row) => `${row.item}: ${row.due === null ? "خارج جدول التطبيق" : toArNum(row.due)}`)
    .join(" · ") || "لا نصاب";

  // العدد خارج مدول الجدول: لا يُجمع، ولا يُعرض رقمٌ ناقص كأنه الواجب.
  if (rows.some((row) => row.due === null)) {
    return renderZakat("—", "—", `${detail}. راجع أهل العلم في هذا العدد.`);
  }

  const total = rows.reduce((sum, row) => sum + row.due, 0);
  return renderZakat(toArNum(total), total, detail);
}

function renderZakat(amount, base, note = "") {
  const box = $("zakatResult");
  if (box) {
    // الأساس غير المحسوب يُعرض شرطةً، لا صفرًا يوهم بأن الواجب معدوم.
    const shown = Number.isFinite(Number(base)) ? toArNum(Math.round(Number(base))) : "—";
    box.innerHTML = `<div class="amount">${escapeHtml(String(amount))}</div>
      <p>الأساس المحسوب: ${escapeHtml(shown)}</p>
      ${note ? `<p class="meta">${escapeHtml(note)}</p>` : ""}`;
  }
}

/* ------------------------------------------------------------------ */
/* النوافذ والإعدادات                                                    */
/* ------------------------------------------------------------------ */

/** العناصر التي يمكن حصر التركيز بينها داخل النافذة. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])';

/** العنصر الذي كان مركّزًا قبل فتح آخر نافذة، لإعادته عند الإغلاق. */
let lastFocus = null;

/** ينقل التركيز إلى أول عنصر قابل للتركيز داخل النافذة. */
function focusFirst(modal) {
  const first = modal.querySelector(FOCUSABLE) ?? modal.querySelector(".modal-panel");
  /** @type {HTMLElement | null} */ (first)?.focus();
}

/** يحصر التركيز داخل النافذة المفتوحة عند استعمال Tab. */
function trapTab(event) {
  const open = ["contentModal", "settingsModal"]
    .map((id) => $(id))
    .find((modal) => modal && !modal.hidden);
  if (!open) return;
  const items = [...open.querySelectorAll(FOCUSABLE)].filter((node) => node.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openContentModal(title, html) {
  const modal = $("contentModal");
  const heading = $("contentModalTitle");
  const body = $("contentModalBody");
  if (heading) heading.textContent = title;
  if (body) body.innerHTML = html;
  if (modal) {
    if (lastFocus === null) lastFocus = document.activeElement;
    modal.hidden = false;
    focusFirst(modal);
  }
  document.body.classList.add("no-scroll");
}

function closeModals() {
  let hadOpen = false;
  for (const id of ["contentModal", "settingsModal"]) {
    const modal = $(id);
    if (modal && !modal.hidden) hadOpen = true;
    if (modal) modal.hidden = true;
  }
  document.body.classList.remove("no-scroll");
  if (!hadOpen) return;
  /** @type {HTMLElement | null} */ (lastFocus)?.focus();
  lastFocus = null;
}

function openSettings() {
  const body = $("settingsBody");
  if (!body) return;
  const theme = document.documentElement.dataset.theme === "dark" ? "داكن" : "فاتح";
  body.innerHTML = `
    <div class="settings-group">
      <h3>🎨 المظهر</h3>
      <div class="setting-row"><span>الثيم الحالي</span><span>${theme}</span></div>
      <div class="setting-row"><span>حجم خط المصحف</span>
        <select id="settingsQuranFont">${[18, 24, 30]
          .map((size) => `<option value="${size}" ${size === Number(read(KEYS.quranFontSize, 24)) ? "selected" : ""}>${size}px</option>`)
          .join("")}</select></div>
      <div class="setting-row"><span>نوع التقويم</span>
        <select id="settingsCalendarType">
          <option value="hijri" ${read(KEYS.calendarType, "hijri") === "hijri" ? "selected" : ""}>هجري</option>
          <option value="gregorian" ${read(KEYS.calendarType, "hijri") === "gregorian" ? "selected" : ""}>ميلادي</option>
        </select></div>
    </div>
    <div class="settings-group">
      <h3>🕌 الصلاة</h3>
      <div class="setting-row"><span>قبل الأذان بـ</span>
        <select id="settingsNotifBefore">${[5, 10, 15]
          .map((value) => `<option value="${value}" ${value === Number(read(KEYS.notifBefore, 10)) ? "selected" : ""}>${value} د</option>`)
          .join("")}</select></div>
      <div class="setting-row"><span>طريقة الحساب</span>
        <select id="settingsCalcMethod">${[5, 4, 3, 2, 1, 8, 12]
          .map((value) => `<option value="${value}" ${value === Number(read(KEYS.calcMethod, 5)) ? "selected" : ""}>${escapeHtml(methodName(value))}</option>`)
          .join("")}</select></div>
    </div>
    <div class="settings-group">
      <h3>📻 الإذاعة</h3>
      <div class="setting-row"><span>مستوى الصوت</span>
        <input id="settingsVolume" type="range" min="0" max="100" value="${Number(read(KEYS.radioVolume, 80))}"></div>
    </div>
    <div class="settings-group">
      <h3>💾 البيانات</h3>
      <div class="quiz-actions">
        <button class="btn ghost" data-role="export-data">📤 تصدير JSON</button>
        <button class="btn ghost" data-role="import-data">📥 استيراد</button>
        <button class="btn ghost" data-role="reset-all">🗑️ مسح كل البيانات</button>
      </div>
    </div>
    <div class="settings-group">
      <h3>ℹ️ عن التطبيق</h3>
      <p class="meta">الإصدار ${APP_VERSION} — «بوابة النور»</p>
      <p class="meta"><a href="../site/noor.html">🌐 موقع نور الهدى</a> · <a href="../../index.html">📚 المكتبة الإسلامية</a></p>
    </div>`;
  const settingsModal = $("settingsModal");
  if (lastFocus === null) lastFocus = document.activeElement;
  if (settingsModal) {
    settingsModal.hidden = false;
    focusFirst(settingsModal);
  }
  document.body.classList.add("no-scroll");
  body.querySelector("#settingsQuranFont")?.addEventListener("change", (event) => {
    write(KEYS.quranFontSize, Number(/** @type {HTMLInputElement} */ (event.target).value));
    renderTab();
  });
  body.querySelector("#settingsCalendarType")?.addEventListener("change", (event) => {
    write(KEYS.calendarType, /** @type {HTMLSelectElement} */ (event.target).value);
    tickDate();
  });
  body.querySelector("#settingsNotifBefore")?.addEventListener("change", (event) => {
    write(KEYS.notifBefore, Number(/** @type {HTMLSelectElement} */ (event.target).value));
  });
  body.querySelector("#settingsCalcMethod")?.addEventListener("change", (event) => {
    write(KEYS.calcMethod, Number(/** @type {HTMLSelectElement} */ (event.target).value));
  });
  body.querySelector("#settingsVolume")?.addEventListener("change", (event) => {
    const value = Number(/** @type {HTMLInputElement} */ (event.target).value);
    write(KEYS.radioVolume, value);
    if (state.audio) state.audio.volume = value / 100;
  });
  body.querySelector('[data-role="reset-all"]')?.addEventListener("click", resetAll);
}

async function resetAll() {
  if (!confirm("⚠️ سيتم حذف كل بياناتك المحفوظة. هل أنت متأكد؟")) return;
  await destroyIDB();
  for (const key of storageKeys()) remove(key);
  closeModals();
  location.reload();
}

/** يفعّل التبويب المطلوب عبر الرابط العميق `#tab/xyz`. */
function applyHash() {
  const match = location.hash.match(/^#tab\/([a-z]+)/);
  if (match && match[1] !== state.tab) switchTab(match[1]);
}

window.addEventListener("hashchange", applyHash);

boot();