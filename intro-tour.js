/*
 * دليل المكتبة — intro-tour.js
 * ------------------------------------------------------------------
 * جولةٌ تعريفية تُعرّف الزائر الجديد بالموقع وبكلّ ما فيه: ما هو، ولوحة
 * اليوم، وأقسامه السبعة، وكيف يستعمله، ومن أين يبدأ. تظهر مرّة واحدة عند
 * أوّل فتح، وتبقى مفتوحةً بزرّ «دليل المكتبة» في ترويسة الفهرس.
 *
 * قواعد ملتزم بها:
 *  - لا نصّ ديني هنا: تعريفٌ بالموقع وأدواته فقط، والمصدر الفريد لأي نصٍّ
 *    شرعي ملفات المحتوى المولّدة.
 *  - كل نصّ يُدرَج بـ textContent لا بـ innerHTML.
 *  - الأسماء والأعداد تُقرأ من الفهرس نفسه، فلا يَعِد الجولةُ بعدادٍ
 *    يخالف ما على الأرض ولا برابطٍ/page غير موجودة.
 *  - لا تسجيل ولا تتبّع: يُحفظ في جهاز الزائر «رأيتُ الجولة» ورقم الخطوة
 *    التي وقف عندها، تحت بادئة `hub-intro-` فلا تمسّ مفاتيح الأدوات.
 *  - صامتة إن غاب محرّكها: لا استثناء ولا زرّ بلا اسم.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SiteIntro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ==================== ثوابت ==================== */

  /** يُرفع عند تغيّر الجولة كلّها فيُعاد عرضها للزائر القديم. */
  const VERSION = "1";
  const SEEN_KEY = "hub-intro-seen";
  const STEP_KEY = "hub-intro-step";
  const AUTO_OPEN_MS = 700;

  /** ٠١٢… للعدّاد، كما في بقية صفحات الموقع. */
  const toArNum = (value) => String(value).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

  /* ==================== النصوص ==================== */

  const STR = {
    ar: {
      kicker: "دليل المكتبة",
      stepOf: (index, total) => `الخطوة ${toArNum(index)} من ${toArNum(total)}`,
      close: "إغلاق الدليل",
      skip: "تخطَّ",
      prev: "السابق",
      next: "التالي",
      start: "ابدأ الآن",
      dialogLabel: "دليل المكتبة: تعريف بالموقع وبأدواته",
      sectionsEmpty: "لم تُقرأ أقسام الفهرس بعد.",
      steps: {
        welcome: {
          emoji: "🕌",
          title: "أهلًا بك في المكتبة الإسلامية",
          parts: [
            {
              type: "p",
              text: "هذه كلُّ أدوات المسلم في صفحة واحدة: القرآن والحديث، والأذكار والأدعية، ومواقيت الصلاة والقبلة والتسبيح، وأدوات التعلّم والقصص والحاسبات الشرعية.",
            },
            {
              type: "p",
              text: "بلا تسجيل وبلا إعلانات، وتعمل بلا إنترنت، وما تكتبه يبقى على جهازك وحدك لا يراه أحد.",
            },
            {
              type: "note",
              text: "وصدقةٌ جارية: كلُّ صفحة تفتحها ينتفع بها من يأتي بعدك، ومشاركتُها لك أولًا.",
            },
          ],
          links: [],
        },
        today: {
          emoji: "💚",
          title: "ابدأ من لوحة «اليوم»",
          parts: [
            { type: "p", text: "في أعلى الصفحة لوحةُ اليوم، وهي أوّل ما ينبغي أن تبدأ منه كلَّ يوم:" },
            {
              type: "list",
              items: [
                "الصلاة القادمة والعدّ التنازلي عليها، وكلُّ مواقيت اليوم.",
                "وردك اليومي: خطةُ القراءة، وصفحاتُك، وأيامُك المتتالية.",
                "آيةُ اليوم وذكرُه، مع نسخهما ومشاركتهما.",
                "اختصاراتٌ سريعة تفتح أكثر ما تستعمله من أدوات.",
              ],
            },
          ],
          links: [{ label: "اذهب إلى لوحة اليوم", href: "#dcRoot" }],
        },
        sections: {
          emoji: "🗂️",
          title: "المكتبة أقسام، وكلُّ أداة في قسمها",
          parts: [
            { type: "p", text: "شريطُ الأقسام فوق الفهرس ينقلك إلى قسمٍ بضغطة:" },
            { type: "sections" },
          ],
          links: [],
        },
        how: {
          emoji: "🧭",
          title: "كيف تستعملها",
          parts: [
            {
              type: "list",
              items: [
                "🔎 بحثٌ سريع: اكتب كلمةً في مربع البحث أعلى الصفحة فيصفّي الأدوات.",
                "🧭 شريطُ الأقسام: ينقلك إلى القسم الذي تريد.",
                "★ المفضّلة: نجمةٌ على البطاقة تُبقي أدواتك في أوّل القائمة.",
                "📝 ملاحظة: تكتب لنفسك على أي بطاقة، وتبقى لك وحدك.",
                "🕘 «الأحدث استخدامًا»: يرتّب الفهرس بما فتحته أخيرًا.",
                "🌙 الوضعُ الليلي: من زرّ اللغة والسمة في لوحة اليوم نفسها.",
                "📲 التثبيت: زرّ «تثبيت التطبيق» أعلى الصفحة يضيفها إلى شاشتك.",
                "💾 نسختُك: تصديرُ تقدّمك واستعادته بملفٍّ واحد متى شئت.",
              ],
            },
          ],
          links: [{ label: "الكتالوج التعريفي (PDF)", href: "catalog.pdf" }],
        },
        begin: {
          emoji: "✨",
          title: "من أين تبدأ",
          parts: [
            { type: "p", text: "إن كنت جديدًا فلا تحار وابدأ بهذه:" },
            {
              type: "cards",
              items: [
                { emoji: "📖", label: "القرآن الكريم", href: "30-quran-full.html", desc: "سورٌ وأجزاء وتلاوةٌ وترجمة" },
                { emoji: "🤲", label: "الأذكار الشاملة", href: "25-azkar-shamila.html", desc: "أذكار الصباح والمساء والنوم" },
                { emoji: "🕐", label: "مواقيت الصلاة", href: "29-prayer-times.html", desc: "بموقعك وبطريقتك في الحساب" },
              ],
            },
            {
              type: "note",
              text: "وكلُّ ما هنا وسيلةٌ تُنظّمك، لا مقياسٌ تتفاخر به؛ فالنيةُ لله وحده، ولكلِّ عملٍ ما توى.",
            },
          ],
          links: [{ label: "تصفّح كل الأدوات", href: "#sections" }],
        },
      },
    },

    en: {
      kicker: "Site guide",
      stepOf: (index, total) => `Step ${index} of ${total}`,
      close: "Close the guide",
      skip: "Skip",
      prev: "Back",
      next: "Next",
      start: "Start now",
      dialogLabel: "Site guide: what this site is and what is inside it",
      sectionsEmpty: "The index sections could not be read yet.",
      steps: {
        welcome: {
          emoji: "🕌",
          title: "Welcome to the Islamic Library",
          parts: [
            {
              type: "p",
              text: "Every Muslim's tool in one page: Qur'an and hadith, adhkar and duas, prayer times, qibla and tasbih, plus learning tools, stories and Sharia calculators.",
            },
            {
              type: "p",
              text: "No sign-up and no ads, it works offline, and whatever you write stays on your device where nobody else sees it.",
            },
            {
              type: "note",
              text: "And it is a recurring charity: every page someone opens benefits whoever comes after you — sharing is a gain for you first.",
            },
          ],
          links: [],
        },
        today: {
          emoji: "💚",
          title: "Start from today's board",
          parts: [
            { type: "p", text: "At the top of the page sits today's board — the right place to begin every day:" },
            {
              type: "list",
              items: [
                "The next prayer with a live countdown, and all of today's times.",
                "Your daily reading: the plan, the pages you read, and your streak.",
                "A verse and a dhikr of the day, with copy and share.",
                "Shortcuts that open the tools you use most.",
              ],
            },
          ],
          links: [{ label: "Go to today's board", href: "#dcRoot" }],
        },
        sections: {
          emoji: "🗂️",
          title: "The library is sections, and every tool sits in one",
          parts: [
            { type: "p", text: "The bar above the index takes you to any section with one tap:" },
            { type: "sections" },
          ],
          links: [],
        },
        how: {
          emoji: "🧭",
          title: "How to use it",
          parts: [
            {
              type: "list",
              items: [
                "🔎 Quick search: type a word in the search box and the tools filter.",
                "🧭 The section bar: jump to the section you want.",
                "★ Favourites: a star on a card keeps your tools at the top.",
                "📝 Notes: write for yourself on any card; it stays yours.",
                "🕘 “Recently used”: sorts the index by what you opened last.",
                "🌙 Dark mode: from the theme button inside today's board.",
                "📲 Install: the “install app” button at the top adds it to your home screen.",
                "💾 Your backup: export your progress and restore it from one file.",
              ],
            },
          ],
          links: [{ label: "The introductory catalog (PDF)", href: "catalog.pdf" }],
        },
        begin: {
          emoji: "✨",
          title: "Where to begin",
          parts: [
            { type: "p", text: "If you are new, do not overthink — start with these:" },
            {
              type: "cards",
              items: [
                { emoji: "📖", label: "The Holy Qur'an", href: "30-quran-full.html", desc: "Surahs, juz, recitation and translation" },
                { emoji: "🤲", label: "Complete Adhkar", href: "25-azkar-shamila.html", desc: "Morning, evening and sleep adhkar" },
                { emoji: "🕐", label: "Prayer Times", href: "29-prayer-times.html", desc: "By your location and your method" },
              ],
            },
            {
              type: "note",
              text: "All of this is a means that organises you, not a measure to show off with; the intention belongs to Allah alone.",
            },
          ],
          links: [{ label: "Browse all tools", href: "#sections" }],
        },
      },
    },
  };

  const STEP_ORDER = ["welcome", "today", "sections", "how", "begin"];

  /* ==================== بناء الخطوات ==================== */

  /**
   * خطوات الجولة كلّها، جاهزةً للتصيير.
   *
   * @param {string} lang "ar" أو "en"
   * @param {Array<{id: string, name: string, count: string, href: string, blurb: string}>} catalogs
   * @returns {Array<{id: string, emoji: string, title: string, parts: Array<object>, links: Array<object>}>}
   */
  function stepsFor(lang, catalogs) {
    const dict = STR[lang] || STR.ar;
    const sections = Array.isArray(catalogs) ? catalogs : [];
    return STEP_ORDER.map((id) => {
      const step = dict.steps[id];
      return {
        id,
        emoji: step.emoji,
        title: step.title,
        parts: step.parts.map((part) => {
          if (part.type === "sections") return { type: "sections", items: sections.slice() };
          if (part.type === "list") return { type: "list", items: part.items.slice() };
          return Object.assign({}, part);
        }),
        links: (step.links || []).map((link) => Object.assign({}, link)),
      };
    });
  }

  /* ==================== التخزين ==================== */

  function read(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      /* التخزين ممتلئ أو محظور: الجولة تعمل بلا حفظ ولا تنكسر. */
    }
  }

  /** هل رأى هذه النسخة من الجولة؟ */
  const hasSeen = () => read(SEEN_KEY) === VERSION;

  /** الخطوة التي وقف عندها الزائر، فتفتح الجولة اليدوية عندها. */
  function savedStep(total) {
    const value = Number(read(STEP_KEY));
    if (!Number.isInteger(value) || value < 0) return 0;
    return Math.min(value, Math.max(0, total - 1));
  }

  /* ==================== قراءة فهرس الأدوات ==================== */

  /**
   * أقسام الفهرس مقروءةً من الصفحة نفسها: الاسم من الشريط، والعدد من
   * العدّاد المعروض، فالجولة لا تَعِدُ بما لا يعرضه الفهرس.
   *
   * @param {Document} [doc]
   * @returns {Array<{id: string, name: string, count: string, href: string, blurb: string}>}
   */
  function catalogsFromDocument(doc) {
    const source = doc || (typeof document !== "undefined" ? document : null);
    if (!source) return [];
    return [...source.querySelectorAll("#cats [data-cat]")].map((node) => {
      const id = node.getAttribute("data-cat");
      const block = source.getElementById("sec-" + id);
      const heading = block?.querySelector(".h");
      const counter = heading?.querySelector(".section-count");
      const name = (heading?.childNodes[0]?.textContent || node.textContent || "").trim();
      return {
        id,
        name,
        count: counter ? counter.textContent.trim() : "",
        href: "#sec-" + id,
        blurb: (block?.getAttribute("data-blurb") || "").trim(),
      };
    });
  }

  /* ==================== عناصر الواجهة ==================== */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else node.setAttribute(key, value === true ? "" : String(value));
    }
    for (const child of children || []) if (child) node.appendChild(child);
    return node;
  }

  /** الأقسام: الاسم وعددُ أدواته ووصفُه، وكلُّ قسمٍّ رابطٌ إليه. */
  function sectionsList(items, lang) {
    const list = el("div", { class: "it-sections" });
    if (!items.length) {
      list.appendChild(el("p", { class: "it-p", text: lang === "en" ? STR.en.sectionsEmpty : STR.ar.sectionsEmpty }));
      return list;
    }
    for (const item of items) {
      const top = el("span", { class: "it-sec-top" }, [el("span", { class: "it-sec-name", text: item.name || item.id })]);
      if (item.count) top.appendChild(el("span", { class: "it-sec-count", text: toArNum(item.count) }));
      list.appendChild(
        el("a", { class: "it-sec", href: item.href }, [
          top,
          el("span", { class: "it-sec-blurb", text: item.blurb }),
        ]),
      );
    }
    return list;
  }

  /** بطاقات البداية: أدواتٌ بصفٍّ واحد، كلُّ بطاقةٍ رابطٌ مباشر. */
  function cardsList(items) {
    return el(
      "div",
      { class: "it-cards" },
      items.map((item) =>
        el("a", { class: "it-card", href: item.href }, [
          el("span", { class: "it-card-emoji", "aria-hidden": "true", text: item.emoji }),
          el("span", { class: "it-card-name", text: item.label }),
          el("span", { class: "it-card-desc", text: item.desc }),
        ]),
      ),
    );
  }

  function renderParts(body, parts, lang) {
    for (const part of parts) {
      if (part.type === "p") body.appendChild(el("p", { class: "it-p", text: part.text }));
      else if (part.type === "note") body.appendChild(el("p", { class: "it-note", text: part.text }));
      else if (part.type === "list") {
        body.appendChild(el("ul", { class: "it-list" }, part.items.map((item) => el("li", { text: item }))));
      } else if (part.type === "sections") body.appendChild(sectionsList(part.items));
      else if (part.type === "cards") body.appendChild(cardsList(part.items));
    }
  }

  /* ==================== التحكّم ==================== */

  /**
   * يبني الجولة ويربطها بزرّ الفهرس، ويعرضها أوّلَ مرّة.
   *
   * @param {{button?: Element, catalogs?: Array<object>}} [options]
   * @returns {{open: Function, close: Function, isOpen: Function, steps: Function}|null}
   */
  function boot(options) {
    const opts = options || {};
    if (typeof document === "undefined" || !document.body) return null;

    let lang = document.documentElement.lang === "en" ? "en" : "ar";
    const button = opts.button || document.getElementById("introBtn");
    const catalogs = opts.catalogs || catalogsFromDocument();
    let steps = stepsFor(lang, catalogs);
    let index = 0;
    let dialog = null;

    /** النافذة تُبنى عند أوّل فتح وتُعاد بناؤها عند تبديل اللغة. */
    function ensureDialog() {
      if (dialog) dialog.remove();
      dialog = buildDialog();
      document.body.appendChild(dialog);
      const next = dialog.querySelector("#itNext");
      dialog.querySelector(".it-x").addEventListener("click", close);
      dialog.querySelector("#itSkip").addEventListener("click", close);
      dialog.querySelector("#itPrev").addEventListener("click", () => go(index - 1));
      next.addEventListener("click", () => {
        if (index >= steps.length - 1) close();
        else go(index + 1);
      });
      /* رابط داخلي (#dcRoot مثلًا) ينقل الصفحة، فلا يبقى الدليل فوقها. */
      dialog.addEventListener("click", (event) => {
        const target = event.target;
        const link = target && target.closest ? target.closest('a[href^="#"]') : null;
        if (link ? dialog.contains(link) : target === dialog) close();
      });
      dialog.addEventListener("keydown", onKey);
      dialog.addEventListener("close", () => write(SEEN_KEY, VERSION));
      return dialog;
    }

    function onKey(event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const forward = document.documentElement.dir === "ltr"
        ? event.key === "ArrowRight"
        : event.key === "ArrowLeft";
      event.preventDefault();
      go(index + (forward ? 1 : -1));
    }

    function buildDialog() {
      const dict = STR[lang] || STR.ar;
      return el("dialog", { class: "it-modal", id: "itModal", "aria-label": dict.dialogLabel }, [
        el("div", { class: "it-in" }, [
          el("div", { class: "it-head" }, [
            el("span", { class: "it-emoji", "aria-hidden": "true" }),
            el("div", { class: "it-headings" }, [
              el("p", { class: "it-kicker", id: "itKicker", text: dict.kicker }),
              el("h2", { class: "it-title", id: "itTitle" }),
            ]),
            el("button", { class: "it-x", type: "button", "aria-label": dict.close, title: dict.close, text: "✕" }),
          ]),
          el("div", { class: "it-body", id: "itBody" }),
          el("div", { class: "it-foot" }, [
            el("button", { class: "it-btn ghost", type: "button", id: "itSkip", text: dict.skip }),
            el("div", { class: "it-dots", id: "itDots", "aria-hidden": "true" }),
            el("div", { class: "it-nav" }, [
              el("button", { class: "it-btn", type: "button", id: "itPrev", text: dict.prev }),
              el("button", { class: "it-btn primary", type: "button", id: "itNext", text: dict.next }),
            ]),
          ]),
        ]),
      ]);
    }

    function render() {
      const dict = STR[lang] || STR.ar;
      const step = steps[index];
      const last = index === steps.length - 1;
      dialog.querySelector(".it-emoji").textContent = step.emoji;
      dialog.querySelector("#itKicker").textContent = dict.stepOf(index + 1, steps.length) + " · " + dict.kicker;
      dialog.querySelector("#itTitle").textContent = step.title;

      const body = dialog.querySelector("#itBody");
      body.textContent = "";
      renderParts(body, step.parts, lang);
      for (const link of step.links) {
        body.appendChild(el("a", { class: "it-jump", href: link.href, text: link.label }));
      }

      const dots = dialog.querySelector("#itDots");
      dots.textContent = "";
      steps.forEach((_, position) => {
        dots.appendChild(el("span", { class: "it-dot" + (position === index ? " on" : "") }));
      });

      dialog.querySelector("#itSkip").textContent = dict.skip;
      dialog.querySelector("#itPrev").textContent = dict.prev;
      dialog.querySelector("#itPrev").disabled = index === 0;
      dialog.querySelector("#itNext").textContent = last ? dict.start : dict.next;
    }

    function go(target) {
      const next = Math.min(Math.max(0, target), steps.length - 1);
      if (next === index) return;
      index = next;
      write(STEP_KEY, String(index));
      render();
      dialog.querySelector("#itBody").scrollTop = 0;
      dialog.querySelector("#itNext").focus();
    }

    function open(at) {
      const start = at === undefined ? savedStep(steps.length) : at;
      /* من أنهى الجولة تبدأ من أوّلها، لا من آخر خطوةٍ محفوظة. */
      index = start >= steps.length - 1 ? 0 : Math.min(Math.max(0, start), steps.length - 1);
      write(STEP_KEY, String(index));
      ensureDialog();
      render();
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute("open", "");
      dialog.querySelector("#itNext").focus();
    }

    function close() {
      if (!dialog) return;
      if (dialog.close) dialog.close();
      else dialog.removeAttribute("open");
    }

    if (button) button.addEventListener("click", () => open());

    /* تبديل لغة الفهرس يبدّل لغة الدليل، والمفتوح يتغيّر لغتُه في الحال. */
    new MutationObserver(function () {
      const next = document.documentElement.lang === "en" ? "en" : "ar";
      if (next === lang || !dialog) return;
      lang = next;
      steps = stepsFor(lang, catalogs);
      const wasOpen = dialog.open;
      ensureDialog();
      render();
      if (wasOpen) {
        if (dialog.showModal) dialog.showModal();
        else dialog.setAttribute("open", "");
        dialog.querySelector("#itNext").focus();
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

    /* أوّل فتح: تعريفٌ واحد لا يتكرّر، ولا إزعاج لمن جاء رابطًا مباشرًا. */
    if (!hasSeen() && !location.hash) {
      setTimeout(function () {
        if (!hasSeen() && !location.hash) open(0);
      }, AUTO_OPEN_MS);
    }

    return {
      open,
      close,
      isOpen: () => Boolean(dialog && dialog.open),
      steps: () => steps.map((step) => step.id),
    };
  }

  /* ==================== تشغيل تلقائي ==================== */

  /* في الصفحة وحدها؛ والعقدة (للاختبارات) لا تُعرّف `document` فلا تعمل. */
  if (typeof document !== "undefined" && typeof window !== "undefined" && !window.siteIntro) {
    window.siteIntro = boot() || null;
  }

  return {
    VERSION,
    SEEN_KEY,
    STEP_KEY,
    AUTO_OPEN_MS,
    STR,
    STEP_ORDER,
    stepsFor,
    catalogsFromDocument,
    hasSeen,
    savedStep,
    boot,
  };
});
