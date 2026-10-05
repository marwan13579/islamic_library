/**
 * Search modal UI component for the Islamic Library website.
 * RTL, dark mode, responsive, keyboard navigation.
 * @module components/search-modal
 */

import { searchAll, quickSearch, getSmartSuggestions, processQuery } from "../lib/unified-search.js";
import { registerDataSources, resultCategories } from "../lib/search-content.js";
import { prefetchCorpus } from "../lib/search-corpora.js";
import { HIGHLIGHT_OPEN, HIGHLIGHT_CLOSE } from "../lib/search.js";

/**
 * فئات البحث: الاسم والأيقونة لكل فئة، بالترتيب الذي يُعرض به الشريط.
 *
 * ولا يُبنى الشريطُ من هذه القائمة مباشرةً، بل من تقاطعها مع
 * `resultCategories()`، فالفئةُ التي لم يعد لها مصدرٌ تختفي بدل أن تحتلّ
 * مكانًا وتُظهر «لا نتائج» في كل ضغطة.
 */
const FILTERS = [
  { id: "قرآن", label: "القرآن", icon: "📖" },
  { id: "آيات", label: "آيات المصحف", icon: "🕌" },
  { id: "تفسير", label: "التفسير", icon: "📚" },
  { id: "معاني", label: "معاني الكلمات", icon: "🪔" },
  { id: "حديث", label: "الحديث", icon: "📕" },
  { id: "أذكار", label: "الأذكار", icon: "🤲" },
  { id: "أدعية", label: "الأدعية", icon: "🤲" },
  { id: "قرّاء", label: "القرّاء", icon: "🎙️" },
  { id: "إذاعة", label: "الإذاعات", icon: "📻" },
  { id: "فيديو", label: "الفيديو", icon: "🎬" },
  { id: "كتب", label: "الكتب", icon: "📚" },
  { id: "فتاوى", label: "الفتاوى", icon: "📜" },
  { id: "خطب", label: "الخطب", icon: "🗣️" },
  { id: "تاريخ", label: "التاريخ", icon: "🏛️" },
  { id: "حصن المسلم", label: "حصن المسلم", icon: "🛡️" },
  { id: "اختبارات", label: "الاختبارات", icon: "🧠" },
  { id: "أسئلة", label: "أسئلة وأجوبة", icon: "❓" },
  { id: "تعليم", label: "الدروس", icon: "📚" },
  { id: "منهج", label: "المنهج", icon: "📖" },
  { id: "سيرة", label: "السيرة", icon: "🕌" },
  { id: "علماء", label: "العلماء", icon: "👤" },
  { id: "أسماء الله", label: "أسماء الله", icon: "ﷲ" },
  { id: "أقوال", label: "أقوال السلف", icon: "❝" },
  { id: "أطفال", label: "الأطفال", icon: "🧒" },
  { id: "قصص", label: "القصص والأنبياء", icon: "🌟" },
  { id: "مناسبات", label: "المناسبات", icon: "🌙" },
  { id: "أدوات", label: "الأدوات", icon: "🛠️" },
  { id: "حاسبات", label: "الحاسبات", icon: "🧮" },
  { id: "مدن", label: "المدن", icon: "🏙️" },
  { id: "أقسام", label: "الأقسام", icon: "🧭" },
  { id: "صفحات", label: "الصفحات", icon: "📄" },
];

/**
 * يبني الشريطَ من الفئات التي تُنتج نتائج فقط.
 * @returns {{id: string, label: string, icon: string}[]}
 */
function availableFilters() {
  let have = [];
  try {
    have = resultCategories();
  } catch {
    // قبل التسجيل: الشريطُ الافتراضيّ كاملًا حتى لا يختفي فجأة.
    have = FILTERS.map((filter) => filter.id);
  }
  const known = new Set(have);
  const list = FILTERS.filter((filter) => known.has(filter.id));
  return [{ id: "all", label: "الكل", icon: "🌐" }, ...list];
}

const HISTORY_KEY = "search-history";
const MAX_HISTORY = 10;

let activeFilter = "all";
let currentResults = [];
let selectedIndex = -1;
let isOpen = false;
let debounceTimer = null;

/**
 * Create the search modal DOM element.
 */
export function createSearchModal() {
  if (document.getElementById("searchModal")) return;
  
  const modal = document.createElement("div");
  modal.id = "searchModal";
  modal.className = "search-modal-overlay";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "البحث الشامل");
  modal.innerHTML = `
    <div class="search-modal-backdrop"></div>
    <div class="search-modal-container">
      <div class="search-modal-header">
        <div class="search-modal-input-wrap">
          <span class="search-modal-icon">🔍</span>
          <input 
            type="search" 
            id="searchModalInput" 
            class="search-modal-input" 
            placeholder="ماذا تبحث عنه أو ماذا تحتاج؟" 
            aria-label="البحث الشامل"
            autocomplete="off"
          >
          <button id="searchModalClear" class="search-modal-clear" type="button" aria-label="مسح">✕</button>
        </div>
        <div class="search-modal-filters" id="searchModalFilters"></div>
      </div>
      <div class="search-modal-body" id="searchModalBody">
        <div class="search-modal-suggestions" id="searchModalSuggestions"></div>
        <div class="search-modal-results" id="searchModalResults" hidden></div>
        <div class="search-modal-empty" id="searchModalEmpty" hidden>لم نجد نتيجة مطابقة.</div>
        <div class="search-modal-history" id="searchModalHistory" hidden></div>
      </div>
      <div class="search-modal-footer">
        <span class="search-modal-hint">Ctrl+K أو / للبحث</span>
        <span class="search-modal-hint">Esc للإغلاق</span>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add styles
  if (!document.getElementById("searchModalStyles")) {
    const styles = document.createElement("style");
    styles.id = "searchModalStyles";
    styles.textContent = getSearchModalStyles();
    document.head.appendChild(styles);
  }
  
  setupSearchModalEvents();
  renderFilters();
  loadHistory();
  mountSearchTrigger();
}

/**
 * زرٌّ يفتح البحث، للصفحات التي لا تملك حقلًا في ترويستها.
 *
 * كان الفهرس وحده يملك حقل بحث، فصارت بقية الصفحات تُركّب النافذة بلا مدخل:
 * الاختصار على لوحة المفاتيح موجود، لكن لا زرّ يراه أحد. والصفحة التي تملك حقلًا
 * ظاهرًا أصلًا (كـ `#search` في الفهرس) لا يُزرع لها زرّ ثانٍ.
 *
 * @returns {void}
 */
function mountSearchTrigger() {
  if (!document.body) return;
  if (document.getElementById("searchFab")) return;
  if (document.getElementById("search") || document.querySelector("[data-search-trigger]")) return;

  const button = document.createElement("button");
  button.id = "searchFab";
  button.type = "button";
  button.className = "search-fab";
  button.setAttribute("aria-label", "البحث الشامل");
  button.title = "البحث الشامل — Ctrl+K";
  button.innerHTML = "🔍";
  button.addEventListener("click", () => openSearchModal());
  document.body.appendChild(button);
}

/**
 * Get search modal CSS styles.
 */
function getSearchModalStyles() {
  return `
    .search-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 5vh 16px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s ease, visibility 0.2s ease;
    }
    .search-modal-overlay.open {
      opacity: 1;
      visibility: visible;
    }
    .search-modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .search-modal-container {
      position: relative;
      width: 100%;
      max-width: 720px;
      max-height: 80vh;
      background: var(--card, #FFFAF0);
      border: 1px solid var(--line, rgba(19,50,44,.14));
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: translateY(-20px);
      transition: transform 0.2s ease;
    }
    .search-modal-overlay.open .search-modal-container {
      transform: translateY(0);
    }
    .search-modal-header {
      padding: 16px 16px 12px;
      border-bottom: 1px solid var(--line, rgba(19,50,44,.14));
      flex-shrink: 0;
    }
    .search-modal-input-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--paper-2, #EFE5CF);
      border: 1px solid var(--line, rgba(19,50,44,.14));
      border-radius: 14px;
      padding: 4px 6px 4px 14px;
      transition: border-color 0.2s;
    }
    .search-modal-input-wrap:focus-within {
      border-color: var(--gold-soft, #C9A24B);
    }
    .search-modal-icon {
      font-size: 1.2rem;
      flex-shrink: 0;
    }
    .search-modal-input {
      flex: 1;
      border: 0;
      background: transparent;
      color: var(--ink, #13322C);
      font-family: "Cairo", system-ui, sans-serif;
      font-size: 1rem;
      padding: 10px 0;
      outline: none;
      min-width: 0;
    }
    .search-modal-input::placeholder {
      color: var(--ink-soft, #3D5B53);
      opacity: 0.7;
    }
    .search-modal-clear {
      border: 0;
      background: none;
      color: var(--ink-soft, #3D5B53);
      cursor: pointer;
      font-size: 1rem;
      padding: 6px 10px;
      border-radius: 8px;
      line-height: 1;
      flex-shrink: 0;
    }
    .search-modal-clear:hover {
      background: var(--line, rgba(19,50,44,.14));
    }
    .search-fab {
      position: fixed;
      inset-inline-start: 16px;
      bottom: calc(16px + env(safe-area-inset-bottom, 0px));
      z-index: 46;
      width: 46px;
      height: 46px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      border: 1px solid var(--line, rgba(19,50,44,.14));
      background: var(--card, #FFFAF0);
      color: var(--ink, #13322C);
      font-size: 1.1rem;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(0, 0, 0, .18);
      transition: transform .15s ease, background .15s ease;
    }
    .search-fab:hover {
      transform: scale(1.06);
      background: var(--paper-2, #EFE5CF);
    }
    .search-fab:focus-visible {
      outline: 2px solid var(--gold, #9C7420);
      outline-offset: 2px;
    }
    /* صفحة فيها مشغّل ثابت أسفلها: الزر يصعد فوقه ولا يستقرّ تحته. */
    body:has(.lib-player:not([hidden])) .search-fab {
      bottom: calc(84px + env(safe-area-inset-bottom, 0px));
    }
    .search-modal-filters {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-top: 10px;
      scrollbar-width: none;
    }
    .search-modal-filters::-webkit-scrollbar {
      display: none;
    }
    .search-modal-filter {
      font-family: "Cairo", system-ui, sans-serif;
      font-weight: 600;
      font-size: 0.75rem;
      padding: 5px 12px;
      border-radius: 999px;
      border: 1px solid var(--line, rgba(19,50,44,.14));
      background: var(--paper, #F6EFDF);
      color: var(--ink-soft, #3D5B53);
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .search-modal-filter[aria-pressed="true"] {
      background: var(--ink, #13322C);
      color: var(--paper, #F6EFDF);
      border-color: var(--ink, #13322C);
    }
    .search-modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      min-height: 120px;
      max-height: 50vh;
      scrollbar-width: thin;
    }
    .search-modal-results {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    /* السمة hidden وحدها لا تكفي: قاعدة display:flex أعلاه تتقدّم على قاعدة
       المتصفح فيبقى العنصر ظاهرًا بعد إخفائه، فتتراكم النتائج القديمة. */
    .search-modal-results[hidden],
    .search-modal-history[hidden] {
      display: none;
    }
    .search-modal-category {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--gold, #9C7420);
      padding: 8px 0 4px;
      margin-top: 8px;
      border-bottom: 1px solid var(--line, rgba(19,50,44,.14));
    }
    .search-modal-category:first-child {
      margin-top: 0;
    }
    .search-modal-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background: var(--paper, #F6EFDF);
      border: 1px solid var(--line, rgba(19,50,44,.14));
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      text-decoration: none;
      color: inherit;
    }
    .search-modal-item:hover,
    .search-modal-item.selected {
      background: var(--paper-2, #EFE5CF);
      border-color: var(--gold-soft, #C9A24B);
    }
    .search-modal-item-icon {
      font-size: 1.4rem;
      flex-shrink: 0;
      width: 32px;
      text-align: center;
    }
    .search-modal-item-content {
      flex: 1;
      min-width: 0;
    }
    .search-modal-item-title {
      font-family: "Amiri", serif;
      font-size: 1rem;
      font-weight: 700;
      color: var(--ink, #13322C);
      margin: 0 0 2px;
      line-height: 1.3;
    }
    .search-modal-item-desc {
      font-size: 0.82rem;
      color: var(--ink-soft, #3D5B53);
      margin: 0;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .search-modal-item-meta {
      font-size: 0.72rem;
      color: var(--gold, #9C7420);
      margin-top: 4px;
    }
    .search-modal-item-action {
      font-family: "Cairo", system-ui, sans-serif;
      font-weight: 700;
      font-size: 0.78rem;
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--gold, #9C7420);
      color: #2b1e05;
      border: 0;
      cursor: pointer;
      flex-shrink: 0;
      text-decoration: none;
      display: inline-block;
    }
    .search-modal-empty {
      text-align: center;
      color: var(--ink-soft, #3D5B53);
      padding: 30px 20px;
      font-size: 0.95rem;
    }
    .search-modal-history {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .search-modal-history-title {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--ink-soft, #3D5B53);
      margin-bottom: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .search-modal-history-clear {
      font-size: 0.7rem;
      color: var(--gold, #9C7420);
      background: none;
      border: 0;
      cursor: pointer;
      font-family: "Cairo", system-ui, sans-serif;
    }
    .search-modal-history-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: var(--paper, #F6EFDF);
      border: 1px solid var(--line, rgba(19,50,44,.14));
      border-radius: 12px;
      cursor: pointer;
      font-size: 0.9rem;
      color: var(--ink, #13322C);
    }
    .search-modal-history-item:hover {
      background: var(--paper-2, #EFE5CF);
    }
    .search-modal-footer {
      padding: 10px 16px;
      border-top: 1px solid var(--line, rgba(19,50,44,.14));
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-shrink: 0;
    }
    .search-modal-hint {
      font-size: 0.72rem;
      color: var(--ink-soft, #3D5B53);
      font-family: "Cairo", system-ui, sans-serif;
    }
    .search-modal-loading {
      text-align: center;
      color: var(--ink-soft, #3D5B53);
      padding: 20px;
      font-size: 0.9rem;
    }
    .search-modal-no-results {
      text-align: center;
      padding: 30px 20px;
    }
    .search-modal-no-results h3 {
      font-family: "Amiri", serif;
      font-size: 1.1rem;
      margin: 0 0 8px;
      color: var(--ink, #13322C);
    }
    .search-modal-no-results p {
      font-size: 0.85rem;
      color: var(--ink-soft, #3D5B53);
      margin: 0;
    }
    
    @media (max-width: 600px) {
      .search-modal-overlay {
        padding: 2vh 8px;
        align-items: flex-start;
      }
      .search-modal-container {
        max-height: 90vh;
        border-radius: 16px;
      }
      .search-modal-input {
        font-size: 0.95rem;
      }
      .search-modal-item-title {
        font-size: 0.92rem;
      }
      .search-modal-item-desc {
        font-size: 0.78rem;
      }
      .search-modal-item-action {
        font-size: 0.72rem;
        padding: 5px 10px;
      }
    }
    
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        .search-modal-container,
        .search-modal-input-wrap,
        .search-modal-filter,
        .search-modal-item,
        .search-fab,
        .search-modal-history-item {
          background: var(--card, #122E28);
          border-color: var(--line, rgba(239,227,201,.16));
          color: var(--ink, #EFE3C9);
        }
        .search-modal-item-title {
          color: var(--ink, #EFE3C9);
        }
        .search-modal-item-desc {
          color: var(--ink-soft, #A9BDB4);
        }
        .search-modal-item:hover,
        .search-fab:hover,
        .search-modal-item.selected {
          background: var(--paper-2, #102A25);
        }
        .search-modal-filter[aria-pressed="true"] {
          background: var(--ink, #EFE3C9);
          color: var(--paper, #0C201C);
        }
      }
    }
    :root[data-theme="dark"] {
      .search-modal-container,
      .search-modal-input-wrap,
      .search-modal-filter,
      .search-modal-item,
      .search-fab,
      .search-modal-history-item {
        background: var(--card, #122E28);
        border-color: var(--line, rgba(239,227,201,.16));
        color: var(--ink, #EFE3C9);
      }
      .search-modal-item-title {
        color: var(--ink, #EFE3C9);
      }
      .search-modal-item-desc {
        color: var(--ink-soft, #A9BDB4);
      }
      .search-modal-item:hover,
      .search-fab:hover,
      .search-modal-item.selected {
        background: var(--paper-2, #102A25);
      }
      .search-modal-filter[aria-pressed="true"] {
        background: var(--ink, #EFE3C9);
        color: var(--paper, #0C201C);
      }
    }
  `;
}

/**
 * Render filter tabs.
 */
function renderFilters() {
  const container = document.getElementById("searchModalFilters");
  if (!container) return;
  
  container.innerHTML = availableFilters().map(f => `
    <button class="search-modal-filter" type="button" data-filter="${f.id}" aria-pressed="${f.id === activeFilter ? "true" : "false"}">
      ${f.icon} ${f.label}
    </button>
  `).join("");
  
  container.querySelectorAll(".search-modal-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      container.querySelectorAll(".search-modal-filter").forEach(b => {
        b.setAttribute("aria-pressed", b.dataset.filter === activeFilter ? "true" : "false");
      });
      performSearch();
    });
  });
}

/**
 * Setup event listeners for the search modal.
 */
function setupSearchModalEvents() {
  const modal = document.getElementById("searchModal");
  const input = document.getElementById("searchModalInput");
  const clearBtn = document.getElementById("searchModalClear");
  const backdrop = modal.querySelector(".search-modal-backdrop");
  
  // Close on backdrop click
  backdrop.addEventListener("click", closeSearchModal);
  
  // Clear button
  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.hidden = true;
    activeFilter = "all";
    renderFilters();
    showHistory();
    input.focus();
  });
  
  // Input events
  input.addEventListener("input", () => {
    clearBtn.hidden = !input.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => performSearch(), 200);
  });
  
  // Keyboard events
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSearchModal();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateResults(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateResults(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectResult();
    }
  });
  
  // Global keyboard shortcut
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      openSearchModal();
    } else if (e.key === "/" && !isTyping(e)) {
      e.preventDefault();
      openSearchModal();
    } else if (e.key === "Escape" && isOpen) {
      closeSearchModal();
    }
  });
}

/**
 * Check if user is typing in an input.
 */
function isTyping(event) {
  const target = event.target;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** حُملت مدوّدة المصحف من قبل؟ فلا نُعيد جدولة التحميل. */
let quranWarmed = false;

/**
 * يسخّن مدوّدة آيات المصحف في وقت الفراغ. مرةً واحدة في الجلسة.
 * @returns {void}
 */
function warmQuranCorpus() {
  if (quranWarmed) return;
  quranWarmed = true;
  const idle = typeof requestIdleCallback === "function"
    ? requestIdleCallback
    : (fn) => setTimeout(fn, 2500);
  idle(() => prefetchCorpus("quran"));
}

/**
 * Open the search modal.
 */
export async function openSearchModal() {
  if (!document.getElementById("searchModal")) {
    createSearchModal();
  }
  // النافذة تُقرأ بعد الإنشاء لا قبله: `createSearchModal` قد لا تفعل شيئًا إن
  // كانت النافذة موجودة، وقد تنشئها الآن، فالقراءة الأولى كانت تُبقي `modal`
  // فارغًا ثم `modal.classList` يُسقط الفتح كلّه.
  const modal = document.getElementById("searchModal");
  if (!modal) return;
  const input = document.getElementById("searchModalInput");
  if (!input) return;

  // المصادر تُحمَّل الآن في الخلفية، لا عند أوّل حرف: تفتح النافذة فالبحث
  // يجد كل المحتوى جاهزًا. والمهمّة نفسها تتوقّع في `performSearch` أيضًا،
  // فمن يفتح النافذة ويكتب فورًا لا ينتظر شيئًا. ورفضُها هنا يُتجاهل عمدًا:
  // فتح النافذة لا يجوز أن يقع بسبب مصدرٍ واحد.
  registerDataSources().catch(() => {});

  // مدوّدةُ آيات المصحف وحدها تُسخَّن في وقت الفراغ: أكثرُ ما يُبحث عنه نصًّا،
  // وأثقلُها على الشبكة. فلا ينتظر أوّلُ سؤالٍ عن آيةٍ تنزيلَها، ولا تُحمَّل
  // إن لم تُفتح النافذة أصلًا. `requestIdleCallback` غيرُ موجودٍ في سفاري
  // القديم، فمهلةٌ قصيرة بديلًا منه.
  warmQuranCorpus();

  modal.classList.add("open");
  isOpen = true;
  input.value = "";
  activeFilter = "all";
  renderFilters();
  showHistory();
  input.focus();
  
  // Load smart suggestions
  const suggestions = await getSmartSuggestions();
  renderSuggestions(suggestions);
}

/**
 * Close the search modal.
 */
export function closeSearchModal() {
  const modal = document.getElementById("searchModal");
  if (modal) {
    modal.classList.remove("open");
    isOpen = false;
  }
}

/**
 * Perform search with current query and filter.
 */
async function performSearch() {
  if (!document.getElementById("searchModal")) return;
  
  const input = document.getElementById("searchModalInput");
  const query = input.value.trim();
  
  if (!query) {
    showHistory();
    return;
  }
  
  showLoading();

  const category = activeFilter === "all" ? null : activeFilter;
  // مصدرٌ واحد يفشل تحميله لا يُسقط البحث: ما سُجّل يُبحث فيه، وما لم يُسجَّل
  // يُبحث عنه في المحاولة التالية.
  await registerDataSources().catch(() => {});
  // الشريطُ يُبنى من فئات المصادر، فبعد أوّل تسجيلٍ يصير ما لم يعد له مصدرٌ
  // خارجَ الشريط بدل أن يُظهر «لا نتائج» دائمًا.
  renderFilters();
  try {
    // النصّ العميق (آيات، تفسير، غريب) يحتاج أوّلَ تحميلٍ للمدوّدة، والسقفُ
    // هنا أوسعُ من سَقف المصادر الصغيرة، وإلّا أنهى البحثُ قرب اكتماله.
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 9000)
    );
    const { results, categories, intent } = await Promise.race([
      searchAll(query, {
        limit: 50,
        category,
        onPhase: (phase) => setLoadingText(phase === "relaxed"
          ? "واسع البحث بكلمات الاستعلام..."
          : "يبحث في نصوص القرآن والحديث..."),
      }),
      timeoutPromise
    ]);
    
    currentResults = results;
    selectedIndex = -1;
    
    if (results.length === 0) {
      showNoResults(query);
    } else {
      renderResults(results, categories, intent);
    }
  } catch (error) {
    if (error.message !== "timeout") {
      console.error("Search error:", error);
    }
    showNoResults(query);
  }
}

/**
 * Show a search field with the matched terms marked.
 *
 * `search.js` wraps matches in `[[H]]`/`[[/H]]` and hands back raw text, so the
 * markup is this component's decision. Escaping happens first: the markers carry
 * no HTML characters, so turning them into `<mark>` afterwards cannot inject
 * anything, and nothing reaches the DOM except escaped text plus those two tags.
 *
 * @param {string} escaped نصٌّ مُهرَّب مسبقًا
 * @returns {string}
 */
function withHighlight(escaped) {
  return String(escaped).split(HIGHLIGHT_OPEN).join("<mark>").split(HIGHLIGHT_CLOSE).join("</mark>");
}

/**
 * Show loading state.
 *
 * The body holds the state panels themselves (suggestions, results, empty,
 * history), so it must never be rewritten: doing so leaves `renderResults`
 * with no container and the modal frozen on "جارٍ البحث..." forever.
 * The spinner is one node appended to the body and removed by `hideLoading`.
 */
function showLoading() {
  hideLoading();
  for (const id of ["searchModalSuggestions", "searchModalResults", "searchModalEmpty", "searchModalHistory"]) {
    const panel = document.getElementById(id);
    if (panel) panel.hidden = true;
  }
  const loading = document.createElement("div");
  loading.id = "searchModalLoading";
  loading.className = "search-modal-loading";
  loading.textContent = "جارٍ البحث...";
  document.getElementById("searchModalBody").appendChild(loading);
}

/**
 * يبدّل نصّ الانتظار دون إعادة بناء اللوح، فيعرف المستخدم أن البحث وسعَ
 * مداه إلى نصوص القرآن لا أنّه hung.
 * @param {string} text
 */
function setLoadingText(text) {
  const loading = document.getElementById("searchModalLoading");
  if (loading) loading.textContent = text;
}

/**
 * Hide the loading indicator if it is showing.
 */
function hideLoading() {
  const loading = document.getElementById("searchModalLoading");
  if (loading) loading.remove();
}

/**
 * Show search history.
 */
function showHistory() {
  hideLoading();
  const history = getHistory();
  const container = document.getElementById("searchModalHistory");
  const suggestions = document.getElementById("searchModalSuggestions");
  const results = document.getElementById("searchModalResults");
  const empty = document.getElementById("searchModalEmpty");
  
  if (suggestions) suggestions.hidden = true;
  if (results) results.hidden = true;
  if (empty) empty.hidden = true;
  
  if (history.length === 0) {
    container.hidden = true;
    return;
  }
  
  container.hidden = false;
  container.innerHTML = `
    <div class="search-modal-history-title">
      <span>🕐 آخر عمليات البحث</span>
      <button class="search-modal-history-clear" type="button">مسح السجل</button>
    </div>
    ${history.map(h => `
      <div class="search-modal-history-item" data-query="${escapeHtml(h)}">
        <span>🕐</span>
        <span>${escapeHtml(h)}</span>
      </div>
    `).join("")}
  `;
  
  container.querySelector(".search-modal-history-clear").addEventListener("click", clearHistory);
  container.querySelectorAll(".search-modal-history-item").forEach(item => {
    item.addEventListener("click", () => {
      const q = item.dataset.query;
      document.getElementById("searchModalInput").value = q;
      document.getElementById("searchModalClear").hidden = false;
      performSearch();
    });
  });
}

/**
 * Show smart suggestions.
 */
function renderSuggestions(suggestions) {
  hideLoading();
  const container = document.getElementById("searchModalSuggestions");
  const history = document.getElementById("searchModalHistory");
  const results = document.getElementById("searchModalResults");
  const empty = document.getElementById("searchModalEmpty");
  
  if (history) history.hidden = true;
  if (results) results.hidden = true;
  if (empty) empty.hidden = true;
  
  if (suggestions.length === 0) {
    container.hidden = true;
    return;
  }
  
  container.hidden = false;
  container.innerHTML = `
    <div class="search-modal-category">💡 اقتراحات</div>
    ${suggestions.map(s => `
      <a class="search-modal-item" href="${escapeHtml(s.route || "#")}" data-id="${escapeHtml(s.id || "")}">
        <span class="search-modal-item-icon">${escapeHtml(s.icon || "📌")}</span>
        <div class="search-modal-item-content">
          <p class="search-modal-item-title">${withHighlight(escapeHtml(s.title))}</p>
          <p class="search-modal-item-desc">${withHighlight(escapeHtml(s.description || ""))}</p>
        </div>
        <span class="search-modal-item-action">فتح</span>
      </a>
    `).join("")}
  `;
  
  container.querySelectorAll(".search-modal-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      closeSearchModal();
      if (item.dataset.id) {
        addToHistory(item.querySelector(".search-modal-item-title").textContent);
      }
      const href = item.getAttribute("href");
      if (href && href !== "#") {
        window.location.href = href;
      }
    });
  });
}

/**
 * Render search results.
 */
function renderResults(results, categories, intent) {
  hideLoading();
  const container = document.getElementById("searchModalResults");
  const suggestions = document.getElementById("searchModalSuggestions");
  const history = document.getElementById("searchModalHistory");
  const empty = document.getElementById("searchModalEmpty");
  
  if (suggestions) suggestions.hidden = true;
  if (history) history.hidden = true;
  if (empty) empty.hidden = true;
  
  container.hidden = false;
  
  const grouped = {};
  for (const r of results) {
    if (!grouped[r.category]) {
      grouped[r.category] = [];
    }
    grouped[r.category].push(r);
  }
  
  container.innerHTML = categories.map(cat => {
    const items = grouped[cat] || [];
    return `
      <div class="search-modal-category">${escapeHtml(cat)} (${items.length})</div>
      ${items.map(r => `
        <a class="search-modal-item" href="${escapeHtml(r.route || "#")}" data-index="${r.index || 0}">
          <span class="search-modal-item-icon">${escapeHtml(r.icon || "📄")}</span>
          <div class="search-modal-item-content">
            <p class="search-modal-item-title">${withHighlight(escapeHtml(r.title))}</p>
            ${r.description ? `<p class="search-modal-item-desc">${withHighlight(escapeHtml(r.description))}</p>` : ""}
            ${r.where ? `<p class="search-modal-item-desc">${escapeHtml(r.where)}</p>` : ""}
            ${r.matchType ? `<span class="search-modal-item-meta">${getMatchLabel(r.matchType, r)}</span>` : ""}
          </div>
          <span class="search-modal-item-action">فتح</span>
        </a>
      `).join("")}
    `}).join("");
  
  // Add click handlers
  container.querySelectorAll(".search-modal-item").forEach((item, idx) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      closeSearchModal();
      const title = item.querySelector(".search-modal-item-title").textContent;
      addToHistory(title);
      const href = item.getAttribute("href");
      if (href && href !== "#") {
        window.location.href = href;
      }
    });
  });
}

/**
 * Show no results state.
 */
function showNoResults(query) {
  hideLoading();
  const container = document.getElementById("searchModalResults");
  const suggestions = document.getElementById("searchModalSuggestions");
  const history = document.getElementById("searchModalHistory");
  const empty = document.getElementById("searchModalEmpty");
  
  if (suggestions) suggestions.hidden = true;
  if (history) history.hidden = true;
  if (container) container.hidden = true;
  
  empty.hidden = false;
  empty.innerHTML = `
    <div class="search-modal-no-results">
      <h3>لم نجد نتيجة مطابقة.</h3>
      <p>جرّب البحث بكلمات أخرى مثل: <strong>قرآن</strong>، <strong>أذكار</strong>، <strong>حديث</strong>، <strong>زكاة</strong></p>
    </div>
  `;
}

/**
 * Navigate results with keyboard.
 */
function navigateResults(direction) {
  const items = document.querySelectorAll(".search-modal-item");
  if (items.length === 0) return;
  
  items.forEach(i => i.classList.remove("selected"));
  
  if (direction > 0) {
    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
  } else {
    selectedIndex = Math.max(selectedIndex - 1, 0);
  }
  
  items[selectedIndex].classList.add("selected");
  items[selectedIndex].scrollIntoView({ block: "nearest" });
}

/**
 * Select the current highlighted result.
 */
function selectResult() {
  const items = document.querySelectorAll(".search-modal-item");
  if (items.length === 0) return;
  
  const target = selectedIndex >= 0 ? items[selectedIndex] : items[0];
  if (target) {
    target.click();
  }
}

/**
 * Get match type label.
 */
function getMatchLabel(matchType, result) {
  const labels = {
    exact: "مطابقة تامة",
    title: "مطابقة العنوان",
    keyword: "مطابقة الكلمة المفتاحية",
    content: "مطابقة المحتوى",
    category: "مطابقة التصنيف",
    // لفظٌ زائدٌ أخرجَ البحثَ إلى كلماتٍ مفردة، فيجب أن يعرف المستخدم أن
    // الجوابَ جاء بكلمةٍ من سؤاله لا بسؤاله كلّه.
    relaxed: "بكلمة من سؤالك",
    suggestion: "اقتراح"
  };
  if (matchType === "relaxed" && result?.sourceId === "library") return "مطابقة في المكتبة";
  return labels[matchType] || "";
}

/**
 * Escape HTML.
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get search history from localStorage.
 */
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

/**
 * Save search history to localStorage.
 */
function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Add a query to search history.
 */
export function addToHistory(query) {
  if (!query || !query.trim()) return;
  const history = getHistory().filter(h => h !== query.trim());
  history.unshift(query.trim());
  saveHistory(history);
}

/**
 * Clear search history.
 */
function clearHistory() {
  saveHistory([]);
  showHistory();
}

/**
 * Load and show history on open.
 */
function loadHistory() {
  // History is loaded when modal opens
}

/**
 * Setup inline search on a specific input element.
 * @param {string} inputId
 * @param {string} resultsId
 * @param {{placeholder?: string, minChars?: number}} [options]
 */
function setupInlineSearch(inputId, resultsId, options = {}) {
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  if (!input || !results) return;
  
  const minChars = options.minChars || 2;
  let timer = null;
  
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const query = input.value.trim();
    
    if (query.length < minChars) {
      results.innerHTML = "";
      return;
    }
    
    timer = setTimeout(async () => {
      const { results: searchResults } = await searchAll(query, { limit: 20 });
      renderInlineResults(results, searchResults, query);
    }, 250);
  });
}

/**
 * Render inline search results.
 */
function renderInlineResults(container, results, query) {
  if (results.length === 0) {
    container.innerHTML = '<div class="search-modal-empty">لا نتائج مطابقة.</div>';
    return;
  }
  
  container.innerHTML = results.map(r => `
    <a class="search-modal-item" href="${escapeHtml(r.route || "#")}">
      <span class="search-modal-item-icon">${escapeHtml(r.icon || "📄")}</span>
      <div class="search-modal-item-content">
        <p class="search-modal-item-title">${withHighlight(escapeHtml(r.title))}</p>
        <p class="search-modal-item-desc">${withHighlight(escapeHtml(r.description || ""))}</p>
      </div>
    </a>
  `).join("");
  
  container.querySelectorAll(".search-modal-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const href = item.getAttribute("href");
      if (href && href !== "#") {
        window.location.href = href;
      }
    });
  });
}
