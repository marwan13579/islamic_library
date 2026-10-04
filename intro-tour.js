/*
 * دليل المكتبة — intro-tour.js
 * ------------------------------------------------------------------
 * جولةٌ تعريفية شاملة تُعرّف الزائر الجديد بالموقع وبكلّ ما فيه: ما هو،
 * ولوحة اليوم، وكل ميزات الفهرس، ثم **كل أداة** في قسمها باسمها ووصفها
 * ورابطها، ثم المواضع الأخرى، ثم من أين يبدأ. تظهر مرّة واحدة عند أوّل
 * فتح، وتبقى مفتوحةً بزرّ «دليل المكتبة» في ترويسة الفهرس.
 *
 * قواعد ملتزم بها:
 *  - لا نصّ ديني هنا: تعريفٌ بالموقع وأدواته فقط، والمصدر الفريد لأي نصٍّ
 *    شرعي ملفات المحتوى المولّدة.
 *  - كل نصّ يُدرَج بـ textContent لا بـ innerHTML.
 *  - الأسماء والأعداد والوصف كلُّها تُقرأ من الفهرس نفسه بعد تصييره، فلا
 *    يَعِد الجولةُ بعدادٍ يخالف ما على الأرض ولا برابطٍ أو صفحة غير موجودة.
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
  const VERSION = "2";
  const SEEN_KEY = "hub-intro-seen";
  const STEP_KEY = "hub-intro-step";
  const AUTO_OPEN_MS = 700;

  /** خطواتٌ تُكتب نصوصها هنا، وبينها خطوةٌ لكل قسم من أقسام الفهرس. */
  const FIXED_STEPS = ["welcome", "today", "how", "sections", "elsewhere", "begin"];

  /** مواضعٌ خارج بطاقات الفهرس تُعرَّف في خطوةٍ خاصة، بمعرّفاتها. */
  const PINS = ["noor", "noorapp", "islamicvideos"];

  /** رمزٌ لكل قسم، يُقرأ من اسم القسم لا يُختلق. */
  const CAT_EMOJI = {
    dhikr: "🤲",
    quran: "📖",
    learn: "🕌",
    stories: "🌟",
    calc: "🧮",
    books: "🗂️",
  };

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
      dialogLabel: "دليل المكتبة: تعريف شامل بالموقع وبكل أدواته",
      sectionsEmpty: "لم تُقرأ أقسام الفهرس بعد.",
      gotoSection: "اذهب إلى هذا القسم في الفهرس",
      stats: {
        tools: "أداة في الفهرس",
        sections: "أقسام",
        languages: "لغتان: عربي وإنجليزي",
      },
      steps: {
        welcome: {
          emoji: "🕌",
          title: "أهلًا بك في المكتبة الإسلامية",
          parts: [
            {
              type: "p",
              text: "هذه كلُّ أدوات المسلم في صفحة واحدة: القرآن والحديث، والأذكار والأدعية، ومواقيت الصلاة والقبلة والتسبيح، وأدوات التعلّم والقصص والحاسبات وكتب ومواقع مرجعية.",
            },
            { type: "stats" },
            {
              type: "p",
              text: "بلا تسجيل وبلا إعلانات، ويعمل بلا إنترنت بعد أوّل فتح، وما تكتبه يبقى على جهازك وحدك لا يراه أحد.",
            },
            {
              type: "note",
              text: "وصدقةٌ جارية: كلُّ صفحة تفتحها ينتفع بها من يأتي بعدك، ومشاركتُها لك أوّلًا.",
            },
          ],
        },
        today: {
          emoji: "💚",
          title: "لوحة «اليوم»: أوّل ما تفتحه كلَّ يوم",
          parts: [
            {
              type: "p",
              text: "في أعلى الصفحة لوحةُ اليوم، وهي التي تراها قبل الفهرس، فيها كلُّ ما يخصّ يومك:",
            },
            {
              type: "list",
              items: [
                "🕌 الصلاة القادمة: اسمها ووقتها وبعدّادٍ تنازلي، مع كل مواقيت اليوم.",
                "💚 وردك اليومي: خطة تختارها (ورد صغير أو متوسط أو كبير، أو ختمة في سبعة أو خمسة عشر أو ثلاثين يومًا، أو صفحة تحدّدها)، وعدّاد صفحاتك اليومي، وأيامك المتتالية.",
                "📖 آيةُ اليوم وذكرُه، مع نسخهما ومشاركتهما.",
                "🕘 «ماذا تريد أن تفعل الآن؟»: تسع بطاقات تفتح أسرع ما تستعمله.",
                "⚡ اختصارات سريعة: القرآن، الأذكار، المواقيت، القبلة، الفهرس، التسبيح، الورد.",
                "🔔 تذكير الصلاة قبل الأذان بوقتٍ تختاره، وهو اختياريّ مطفأ حتى تضغط «تفعيل التذكيرات».",
                "🌙 الوضع الليلي وزرُّ اللغة داخل اللوحة نفسها.",
                "✅ وعند إتمام الورد تظهر شاشةُ إتمام تعرض آيةً أو حديثًا أو فائدةً أو دعاءً **بذكر مصدره** — لا أكثر من ذلك.",
              ],
            },
          ],
          links: [{ label: "اذهب إلى لوحة اليوم", href: "#dcRoot" }],
        },
        how: {
          emoji: "🧭",
          title: "كلُّ ما في صفحة الفهرس",
          parts: [
            {
              type: "list",
              items: [
                "🔎 بحثٌ سريع يكتب في الاسم والوصف معًا فيصفّي البطاقات فورًا.",
                "🧭 شريطُ الأقسام ينقلك إلى أيِّ قسم بضغطة، وفيه عدّاد أدوات كل قسم.",
                "★ نجمةٌ على البطاقة تضيفها إلى مفضّلتك، ولوحة «مفضّلتي» في أسفل الصفحة تجمعها لك.",
                "📝 ملاحظةٌ تكتبها على أي بطاقة، وتبقى لك وحدك في جهازك.",
                "🕘 ترتيبُ الفهرس: «الكل» أو «الأحدث استخدامًا» بما فتحته أخيرًا.",
                "🌐 زرُّ اللغة يبدّل كل اسم ووصف بين العربية والإنجليزية ويقلب اتجاه الصفحة.",
                "🌙 زرُّ السمة يبدّل بين الفاتح والداكن ويحفظ اختيارك.",
                "📲 زرُّ «تثبيت التطبيق» يضيف الموقع إلى شاشتك فيفتح كتطبيق مستقلّ.",
                "💾 التصدير والاستيراد: ملفٌّ واحد فيه كل تقدّمك — الورد والحفظ والأذكار والإحصاءات.",
                "📖 الكتالوج التعريفي: دليلٌ مطبوع بالموقع كله، للقراءة أو المشاركة.",
                "🧭 دليلُ المكتبة: هذه الجولة نفسها، تُفتح في أي وقت.",
                "📴 يعمل بلا إنترنت: تُخزَّن الصفحة وأصولها في جهازك أوّل مرّة.",
                "🔒 لا تسجيل ولا تتبّع ولا إعلانات، ولا خوادم تستقبل ما تكتبه.",
              ],
            },
          ],
          links: [{ label: "الكتالوج التعريفي (PDF)", href: "catalog.pdf" }],
        },
        sections: {
          emoji: "🗂️",
          title: "أقسامُ الفهرس، وأدواتُها",
          parts: [
            {
              type: "p",
              text: "كلُّ أداة في قسمها، وشريطُ الأقسام فوق الفهرس ينقلك إليه بضغطة. وفي الخطوات التالية أداةُ أداة:",
            },
            { type: "sections" },
          ],
        },
        elsewhere: {
          emoji: "🧩",
          title: "مواضعُ أخرى داخل الموقع",
          parts: [
            { type: "pins" },
            {
              type: "note",
              text: "وربما بحثتَ عن شيءٍ ولم تجده: الفهرس يعرض ما فيه الموقع كلّه، ومن هذه المواضع تبدأ، ومن زرّ «العودة إلى المكتبة» الراجع إلى هنا في أي صفحة.",
            },
          ],
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
      dialogLabel: "Site guide: a full introduction to the site and all its tools",
      sectionsEmpty: "The index sections could not be read yet.",
      gotoSection: "Go to this section in the index",
      stats: {
        tools: "tools in the index",
        sections: "sections",
        languages: "two languages: Arabic and English",
      },
      steps: {
        welcome: {
          emoji: "🕌",
          title: "Welcome to the Islamic Library",
          parts: [
            {
              type: "p",
              text: "Every Muslim's tool in one page: Qur'an and hadith, adhkar and duas, prayer times, qibla and tasbih, plus learning tools, stories, Sharia calculators, books and reference sites.",
            },
            { type: "stats" },
            {
              type: "p",
              text: "No sign-up and no ads, it works offline after the first visit, and whatever you write stays on your device where nobody else sees it.",
            },
            {
              type: "note",
              text: "And it is a recurring charity: every page someone opens benefits whoever comes after you — sharing is a gain for you first.",
            },
          ],
        },
        today: {
          emoji: "💚",
          title: "Today's board: the first thing to open each day",
          parts: [
            {
              type: "p",
              text: "At the top of the page, above the index, sits today's board — everything about your day is in it:",
            },
            {
              type: "list",
              items: [
                "🕌 The next prayer: its name, its time, a live countdown, and all of today's times.",
                "💚 Your daily reading: a plan you choose (a small, medium or large reading, a 7, 15 or 30-day khatma, or pages you set), today's counter, and your streak.",
                "📖 A verse and a dhikr of the day, with copy and share.",
                "🕘 “What do you want to do now?”: nine cards that open what you use most.",
                "⚡ Shortcuts: the Qur'an, adhkar, prayer times, qibla, the index, tasbih, and the reading plan.",
                "🔔 A prayer reminder before the adhan at a lapse you choose — optional and off until you press “enable reminders”.",
                "🌙 Dark mode and the language button live in the same board.",
                "✅ When you finish the reading, a completion screen shows a verse, hadith, benefit or dua **with its reference** — nothing more.",
              ],
            },
          ],
          links: [{ label: "Go to today's board", href: "#dcRoot" }],
        },
        how: {
          emoji: "🧭",
          title: "Everything on the index page",
          parts: [
            {
              type: "list",
              items: [
                "🔎 Quick search covers the name and the description at once, and filters the cards as you type.",
                "🧭 The section bar takes you to any section with one tap, and shows each section's tool count.",
                "★ A star on a card adds it to your favourites, and the “favourites” board at the bottom collects them.",
                "📝 A note you write on any card stays yours, on your device only.",
                "🕘 Sort: “all” or “recently used”, by what you opened last.",
                "🌐 The language button switches every name and description between Arabic and English and flips the page direction.",
                "🌙 The theme button switches between light and dark and remembers your choice.",
                "📲 The “install app” button adds the site to your home screen so it opens as an app.",
                "💾 Export and import: one file carries all your progress — reading, bookmarks, adhkar, statistics.",
                "📖 The introductory catalog: the whole site as a printable guide, to read or share.",
                "🧭 The site guide: this very tour, openable at any time.",
                "📴 It works offline: the page and its assets are cached on your device after the first visit.",
                "🔒 No sign-up, no tracking, no ads, and no server receives what you write.",
              ],
            },
          ],
          links: [{ label: "The introductory catalog (PDF)", href: "catalog.pdf" }],
        },
        sections: {
          emoji: "🗂️",
          title: "The index sections and their tools",
          parts: [
            {
              type: "p",
              text: "Every tool sits in its section, and the section bar above the index takes you there in one tap. The next steps walk through them tool by tool:",
            },
            { type: "sections" },
          ],
        },
        elsewhere: {
          emoji: "🧩",
          title: "Other places inside the site",
          parts: [
            { type: "pins" },
            {
              type: "note",
              text: "And if you looked for something and did not find it: the index lists everything the site holds, these are the places to start from, and the “back to the library” link brings you here from any page.",
            },
          ],
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

  /* ==================== قراءة الفهرس بعد تصييره ==================== */

  /**
   * أقسامُ الفهرس وأدواتُها مقروءةً من الصفحة: الاسم والعدد والوصف من
   * النصّ المصيَّر، فلا يمكن للجولة أن تخالف ما يراه الزائر.
   *
   * @param {Document} [doc]
   * @returns {Array<{id: string, name: string, count: string, blurb: string, href: string, tools: Array<object>}>}
   */
  function sectionsFromDocument(doc) {
    const source = doc || (typeof document !== "undefined" ? document : null);
    if (!source) return [];
    return [...source.querySelectorAll("#sections .section-block")].map((block) => {
      const heading = block.querySelector(".h");
      const counter = heading?.querySelector(".section-count");
      return {
        id: block.getAttribute("data-section") || block.id.replace(/^sec-/, ""),
        name: (heading?.childNodes[0]?.textContent || "").trim(),
        count: counter ? counter.textContent.trim() : "",
        blurb: (block.getAttribute("data-blurb") || "").trim(),
        href: "#" + block.id,
        tools: [...block.querySelectorAll(".tool")].map((card) => ({
          id: card.getAttribute("data-tool") || "",
          emoji: (card.querySelector(".emoji")?.textContent || "").trim(),
          name: (card.querySelector(".name")?.textContent || "").trim(),
          desc: (card.querySelector(".desc")?.textContent || "").trim(),
          href: card.querySelector("a")?.getAttribute("href") || "#",
        })),
      };
    });
  }

  /** بحثٌ عن أداةٍ بمعرّفها في كل الأقسام. */
  function toolById(sections, id) {
    for (const section of sections) {
      for (const tool of section.tools) if (tool.id === id) return tool;
    }
    return null;
  }

  /* ==================== بناء الخطوات ==================== */

  /**
   * خطوات الجولة كلّها: ست خطواتٍ ثابتة، وبينها خطوةٌ لكل قسمٍ تعرض
   * أدواته بالاسم والوصف والرابط.
   *
   * @param {string} lang "ar" أو "en"
   * @param {Array<object>} [sections]
   * @returns {Array<{id: string, emoji: string, title: string, parts: Array<object>, links: Array<object>}>}
   */
  function stepsFor(lang, sections) {
    const dict = STR[lang] || STR.ar;
    const list = Array.isArray(sections) ? sections : [];
    const tools = list.reduce((sum, section) => sum + section.tools.length, 0);
    const stats = [
      { value: tools ? toArNum(tools) : "—", label: dict.stats.tools },
      { value: list.length ? toArNum(list.length) : "—", label: dict.stats.sections },
      { value: "", label: dict.stats.languages },
    ];

    /** نسخةٌ مستقلّة من المقطع، فالخطوات لا تتشارك كائناتها. */
    const copy = (part) => {
      const next = Object.assign({}, part);
      if (Array.isArray(next.items)) next.items = next.items.slice();
      return next;
    };

    const fixed = FIXED_STEPS.map((id) => {
      const step = dict.steps[id];
      const parts = step.parts.map((part) => {
        if (part.type === "sections") return { type: "sections", items: list.slice() };
        if (part.type === "stats") return { type: "stats", items: stats };
        if (part.type === "pins") return { type: "cards", items: pinsFor(list) };
        return copy(part);
      });
      return {
        id,
        emoji: step.emoji,
        title: step.title,
        parts,
        links: (step.links || []).map((link) => Object.assign({}, link)),
      };
    });

    /* خطوةٌ لكل قسم: أدواتُه كاملةً، مرتّبةً كما في الفهرس. */
    const perSection = list.map((section) => ({
      id: "cat:" + section.id,
      emoji: CAT_EMOJI[section.id] || "🗂️",
      title: section.name || section.id,
      parts: [
        { type: "note", text: section.blurb },
        { type: "tools", items: section.tools.map((tool) => Object.assign({}, tool)) },
      ],
      links: [{ label: dict.gotoSection, href: section.href }],
    }));

    /* خطوةُ الأقسام تسبق خطواتَ الأقسام نفسها، فنفصلها بينهما. */
    const at = FIXED_STEPS.indexOf("sections");
    return [...fixed.slice(0, at + 1), ...perSection, ...fixed.slice(at + 1)];
  }

  /** مواضعٌ خارج الفهرس، أسماؤها ووصفُها من بطاقاته هو. */
  function pinsFor(sections) {
    return PINS.map((id) => toolById(sections, id))
      .filter(Boolean)
      .map((tool) => ({ emoji: tool.emoji, label: tool.name, href: tool.href, desc: tool.desc }));
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

  /* ==================== عناصر الواجهة ==================== */

  /** الروابط الخارجية تفتح في تبويب جديد، كما في الفهرس. */
  function linkAttrs(href) {
    const external = /^https?:\/\//i.test(href || "");
    return external ? { href, target: "_blank", rel: "noopener" } : { href };
  }

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

  /** عدّاداتُ الفهرس كما هي: الأدوات والأقسام واللغات. */
  function statsList(items) {
    return el(
      "div",
      { class: "it-stats" },
      items.map((item) =>
        el("div", { class: "it-stat" }, [
          item.value ? el("span", { class: "it-stat-n", text: item.value }) : null,
          el("span", { class: "it-stat-l", text: item.label }),
        ]),
      ),
    );
  }

  /** الأقسام: الاسم وعددُ أدواته ووصفُه، وكلُّ قسمٍّ رابطٌ إليه. */
  function sectionsList(items, lang) {
    const list = el("div", { class: "it-sections" });
    if (!items.length) {
      list.appendChild(el("p", { class: "it-p", text: STR[lang]?.sectionsEmpty || STR.ar.sectionsEmpty }));
      return list;
    }
    for (const item of items) {
      const top = el("span", { class: "it-sec-top" }, [
        el("span", { class: "it-sec-name", text: item.name || item.id }),
      ]);
      if (item.count) top.appendChild(el("span", { class: "it-sec-count", text: toArNum(item.count) }));
      list.appendChild(
        el("a", Object.assign({ class: "it-sec" }, linkAttrs(item.href)), [
          top,
          el("span", { class: "it-sec-blurb", text: item.blurb }),
        ]),
      );
    }
    return list;
  }

  /** أدواتُ قسمٍ واحد: الاسم والوصف والرابط — كما في الفهرس بعينه. */
  function toolsList(items) {
    return el(
      "div",
      { class: "it-tools" },
      items.map((tool) =>
        el("a", Object.assign({ class: "it-tool" }, linkAttrs(tool.href)), [
          el("span", { class: "it-tool-emoji", "aria-hidden": "true", text: tool.emoji }),
          el("span", { class: "it-tool-text" }, [
            el("span", { class: "it-tool-name", text: tool.name }),
            el("span", { class: "it-tool-desc", text: tool.desc }),
          ]),
        ]),
      ),
    );
  }

  /** بطاقات البداية: أدواتٌ بصفٍّ واحد، كلُّ بطاقةٍ رابطٌ مباشر. */
  function cardsList(items) {
    return el(
      "div",
      { class: "it-cards" },
      items.map((item) =>
        el("a", Object.assign({ class: "it-card" }, linkAttrs(item.href)), [
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
      else if (part.type === "note") {
        if (part.text) body.appendChild(el("p", { class: "it-note", text: part.text }));
      } else if (part.type === "list") {
        body.appendChild(el("ul", { class: "it-list" }, part.items.map((item) => el("li", { text: item }))));
      } else if (part.type === "stats") body.appendChild(statsList(part.items));
      else if (part.type === "sections") body.appendChild(sectionsList(part.items, lang));
      else if (part.type === "tools") body.appendChild(toolsList(part.items));
      else if (part.type === "cards") body.appendChild(cardsList(part.items));
    }
  }

  /* ==================== التحكّم ==================== */

  /**
   * يبني الجولة ويربطها بزرّ الفهرس، ويعرضها أوّلَ مرّة.
   *
   * @param {{button?: Element, sections?: Array<object>}} [options]
   * @returns {{open: Function, close: Function, isOpen: Function, steps: Function}|null}
   */
  function boot(options) {
    const opts = options || {};
    if (typeof document === "undefined" || !document.body) return null;

    let lang = document.documentElement.lang === "en" ? "en" : "ar";
    const button = opts.button || document.getElementById("introBtn");
    let sections = opts.sections || sectionsFromDocument();
    let steps = stepsFor(lang, sections);
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
        body.appendChild(
          el("a", Object.assign({ class: "it-jump", text: link.label }, linkAttrs(link.href))),
        );
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
      /* الفتح اليدوي إلى خطوةٍ بعينها يحترمها، والزرّ يستأنف من حيث توقّف
         الزائر — إلا إن كان أنهى الجولة، فيبدأها من أوّلها. */
      const explicit = at !== undefined;
      const start = explicit ? at : savedStep(steps.length);
      index = start >= steps.length - 1 && !explicit
        ? 0
        : Math.min(Math.max(0, start), steps.length - 1);
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
      /* البطاقات مصيَّرةٌ باللغة الجديدة، فتُقرأ من جديد. */
      sections = opts.sections || sectionsFromDocument();
      steps = stepsFor(lang, sections);
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
    FIXED_STEPS,
    PINS,
    stepsFor,
    sectionsFromDocument,
    toolById,
    hasSeen,
    savedStep,
    boot,
  };
});
