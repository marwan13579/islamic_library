/*
 * واجهة «الرفيق اليومي» على الصفحة الرئيسية — daily-home.js
 * ------------------------------------------------------------------
 * يبني لوحة اليوم داخل <div id="dcRoot"> التي تضيفها index.html،
 * فوق فهرس الأدوات القائم (لا يمسّه ولا يحذف منه شيئًا).
 *
 * قواعد ملتزم بها:
 *  - النصّ الديني يُدرَج بـ textContent لا بـ innerHTML، فلا مجال
 *    ل injecting محتوى، ولا يُعاد صياغة النصّ القرآني ولا غيره.
 *  - كل الروابط指向 صفحات موجودة (يفحصها tests/daily-companion.test.js).
 *  - لا إعلانات، ولا تسجيل، ولا إزعاج: التذكيرات اختيارية ومطفأة.
 *  - إن غاب المحرّك أو المحتوى، يختفي القسم بصمت ولا يتعطّل شيء.
 */
(function () {
  "use strict";

  var host = document.getElementById("dcRoot");
  var DC = window.DailyCompanion;
  if (!host || !DC) return;

  var THEME_KEY = "lib-theme-pref";
  var TICKED_KEY = "dc-tapped";
  var CELEBRATED_KEY = "dc-celebrated";
  var FIRED_KEY = "dc-fired";

  var SHORTCUTS = [
    { emoji: "📖", label: "القرآن", href: "30-quran-full.html" },
    { emoji: "🤲", label: "الأذكار", href: "25-azkar-shamila.html" },
    { emoji: "🕌", label: "مواقيت الصلاة", href: "29-prayer-times.html" },
    { emoji: "🧭", label: "القبلة", href: "22-qibla.html" },
    { emoji: "📚", label: "المكتبة", href: "#sections" },
    { emoji: "📿", label: "التسبيح", href: "15-tasbeeh-jamai.html" },
    { emoji: "💚", label: "ورد اليوم", href: "17-wird.html" },
  ];

  var ACTIONS = [
    { emoji: "🕌", label: "مواقيت الصلاة", href: "29-prayer-times.html" },
    { emoji: "📖", label: "القرآن الكريم", href: "30-quran-full.html" },
    { emoji: "🤲", label: "الأذكار", href: "25-azkar-shamila.html" },
    { emoji: "📿", label: "التسبيح", href: "15-tasbeeh-jamai.html" },
    { emoji: "🧭", label: "اتجاه القبلة", href: "22-qibla.html" },
    { emoji: "🌅", label: "أذكار الصباح", href: "25-azkar-shamila.html#sabah" },
    { emoji: "🌙", label: "أذكار النوم", href: "25-azkar-shamila.html#nawm" },
    { emoji: "📚", label: "التعلّم", href: "src/site/noor.html" },
    { emoji: "💚", label: "الصدقة الجارية", href: "31-card-maker.html" },
  ];

  /** نصوص الواجهة — العربي أساس، والإنجليزي لتبديل اللغة في الفهرس. */
  var STR = {
    ar: {
      ask: "ماذا تحبّ أن تفعل اليوم؟",
      prayer: "الصلاة القادمة",
      current: "الصلاة الحالية",
      remaining: "المتبقّي على دخولها",
      allTimes: "كل المواقيت",
      wird: "وردك اليومي",
      startWird: "ابدأ وردك",
      changePlan: "غيّر الخطة",
      pause: "إيقاف مؤقّت",
      resume: "استئناف",
      reset: "إعادة ضبط",
      keepReading: "متابعة القراءة",
      addPages: "أضفت",
      page: "صفحة",
      days: "يوم",
      best: "أطول سلسلة",
      verse: "آية اليوم",
      dhikr: "ذكر اليوم",
      tap: "اضغط للعدّ",
      copy: "نسخ",
      share: "مشاركة",
      save: "حفظ",
      saved: "محفوظ",
      nowTitle: "ماذا تريد أن تفعل الآن؟",
      moreTools: "عرض كل الأدوات",
      reminders: "التذكيرات",
      remindersAsk: "تريد تذكيرات يومية اختيارية؟",
      remindersNote: "التذكيرات اختيارية ولا تُطلب إلا بإذنك، وتعمل ما دمت في هذه الصفحة. ولإيقافها تمامًا أوقفها من هنا.",
      enable: "تفعيل التذكيرات",
      done: "التذكيرات مفعّلة",
      doneNoPerm: "اسمح بالإذن أولًا من إعدادات المتصفح لتعمل التذكيرات.",
      off: "إيقاف كل التذكيرات",
      onPrayer: "مواقيت الصلاة",
      onWird: "ورد القرآن",
      onMorning: "أذكار الصباح",
      onEvening: "أذكار المساء",
      onDaily: "تذكير يومي",
      shareCta: "إذا وجدت الموقع نافعًا، شاركه مع من تحبّ 🤍",
      shareSite: "شارك الموقع",
      planTitle: "اختر وردك",
      planNote: "الصفحة تتذكّر خطتك، ويمكنك إيقافها أو تغييرها متى شئت.",
      customPages: "صفحات في اليوم",
      start: "ابدأ",
      cancel: "إلغاء",
      pickTitle: "ما شاء الله 🤍",
      pickDone: "أتممت وردك اليوم.",
      continueRead: "تابع القراءة",
      shareReward: "شارك الأجر",
      useLocation: "استخدم موقعي الفعلي",
      copied: "نُسخ النص.",
      copiedFail: "تعذّر النسخ — حدّده يدويًا.",
      savedOk: "حُفظت لك.",
      planOn: "بدأت وردك: ",
      planOff: "أُوقف الورد مؤقّتًا.",
      planReset: "أُعيد ضبط الورد.",
      noContent: "لا يوجد محتوى اليوم.",
      streakOn: "أتممت وردك ",
      streakOne: "يومًا متتاليًا.",
      streakMany: "أيام متتالية.",
      allAzkar: "كل الأذكار",
    },
    en: {
      ask: "What would you like to do today?",
      prayer: "Next prayer",
      current: "Current prayer",
      remaining: "Time remaining",
      allTimes: "All prayer times",
      wird: "Your daily reading",
      startWird: "Start your reading",
      changePlan: "Change plan",
      pause: "Pause",
      resume: "Resume",
      reset: "Reset",
      keepReading: "Continue reading",
      addPages: "Add",
      page: "pages",
      days: "days",
      best: "Best streak",
      verse: "Verse of the day",
      dhikr: "Dhikr of the day",
      tap: "Tap to count",
      copy: "Copy",
      share: "Share",
      save: "Save",
      saved: "Saved",
      nowTitle: "What do you want to do now?",
      moreTools: "See all tools",
      reminders: "Reminders",
      remindersAsk: "Would you like optional daily reminders?",
      enable: "Enable reminders",
      done: "Reminders are on",
      off: "Turn off all reminders",
      onPrayer: "Prayer times",
      onWird: "Qur'an reading",
      onMorning: "Morning adhkar",
      onEvening: "Evening adhkar",
      onDaily: "Daily reminder",
      shareCta: "If you found this useful, share it with someone you love 🤍",
      shareSite: "Share the site",
      planTitle: "Choose your reading",
      planNote: "The page remembers your plan; pause or change it any time.",
      customPages: "pages per day",
      start: "Start",
      cancel: "Cancel",
      pickTitle: "Mashallah 🤍",
      pickDone: "You completed today's reading.",
      continueRead: "Continue reading",
      shareReward: "Share the reward",
      copied: "Copied.",
      copiedFail: "Copy failed — select the text manually.",
      savedOk: "Saved for you.",
      noContent: "No content today.",
    },
  };

  var lang = document.documentElement.lang === "en" ? "en" : "ar";

  function t(key) {
    return (STR[lang] && STR[lang][key]) || STR.ar[key] || key;
  }

  /* ==================== أدوات DOM ==================== */

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "text") node.textContent = String(value);
        else if (key === "html") node.innerHTML = value;
        else if (key === "class") node.className = value;
        else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2).toLowerCase(), value);
        else if (value === true) node.setAttribute(key, "");
        else node.setAttribute(key, String(value));
      });
    }
    (Array.isArray(children) ? children : children ? [children] : []).forEach(function (child) {
      if (child === null || child === undefined) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function section(className, title, icon) {
    var box = el("section", { class: className });
    if (title) {
      box.appendChild(el("h3", null, [el("span", { text: icon + " " + title })]));
    }
    return box;
  }

  /* ==================== تنبيه صغير ==================== */

  var veil = null;
  var toastTimer = null;

  function toast(message, withButton) {
    if (!veil) {
      veil = el("div", { class: "dc-veil", hidden: true, role: "status", "aria-live": "polite" });
      document.body.appendChild(veil);
    }
    clear(veil);
    var box = el("div", { class: "dc-toast" }, [el("span", { text: message })]);
    if (withButton) {
      box.appendChild(el("button", {
        class: "dc-btn ghost",
        type: "button",
        text: "حسنًا",
        onclick: function () { veil.hidden = true; },
      }));
    }
    veil.appendChild(box);
    veil.hidden = false;
    if (!withButton) {
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { if (veil) veil.hidden = true; }, 2600);
    } else if (toastTimer) {
      clearTimeout(toastTimer);
    }
  }

  /* ==================== الوضع الليلي ==================== */

  function isDark() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") return attr === "dark";
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function toggleTheme(button) {
    var next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch (error) { /* التخزين معطّل */ }
    button.textContent = next === "dark" ? "☀ نهاري" : "☾ ليلي";
    button.setAttribute("aria-label", next === "dark" ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي");
  }

  function themeButton() {
    var dark = isDark();
    var button = el("button", {
      class: "dc-theme-toggle",
      type: "button",
      text: dark ? "☀ نهاري" : "☾ ليلي",
      "aria-label": dark ? "التبديل إلى الوضع النهاري" : "التبديل إلى الوضع الليلي",
      onclick: function () { toggleTheme(button); },
    });
    return button;
  }

  /* ==================== ١) التحية والاختصارات ==================== */

  function buildHero() {
    var hero = el("section", { class: "dc-hero" });
    hero.appendChild(el("p", { class: "dc-greet", text: "السلام عليكم ورحمة الله وبركاته 🌿" }));
    var ask = el("p", { class: "dc-ask" }, [document.createTextNode(t("ask") + " ")]);
    ask.appendChild(themeButton());
    hero.appendChild(ask);

    var quick = el("div", { class: "dc-quick" });
    SHORTCUTS.forEach(function (item) {
      quick.appendChild(el("a", { href: item.href }, [
        el("span", { class: "dc-emoji", "aria-hidden": "true", text: item.emoji }),
        el("span", { text: item.label }),
      ]));
    });
    hero.appendChild(quick);
    return hero;
  }

  /* ==================== ٢) الصلاة القادمة ==================== */

  var countdownNode = null;

  function buildPrayer() {
    var card = section("dc-card", t("prayer"), "🕌");
    var state = DC.prayerState();

    if (!state) {
      card.appendChild(el("p", { class: "dc-sub", text: "تعذّر حساب المواقيت على هذا المتصفح." }));
      card.appendChild(el("div", { class: "dc-btns" }, [
        el("a", { class: "dc-btn primary", href: "29-prayer-times.html", text: "افتح صفحة المواقيت" }),
      ]));
      return card;
    }

    var now = new Date();
    card.appendChild(el("p", {
      class: "dc-prayer-now",
      text: t("current") + ": " + (state.current ? state.current.name + " — " + state.current.clock : "—"),
    }));

    var row = el("div", { class: "dc-prayer-next" });
    if (state.next) {
      row.appendChild(el("span", { class: "dc-prayer-name", text: state.next.name }));
      row.appendChild(el("span", { class: "dc-prayer-time", text: state.next.clock }));
      countdownNode = el("p", { class: "dc-count", text: "--:--", role: "timer", "aria-live": "off" });
      card.appendChild(row);
      card.appendChild(countdownNode);
      card.appendChild(el("p", { class: "dc-count-label", text: t("remaining") }));
    } else {
      row.appendChild(el("span", { class: "dc-prayer-name", text: "—" }));
      card.appendChild(row);
      card.appendChild(el("p", { class: "dc-count-label", text: "مضى وقت آخر صلاة اليوم — الفجر قادم." }));
      countdownNode = null;
    }

    var times = el("div", { class: "dc-times" });
    state.all.forEach(function (prayer) {
      var isNext = state.next && state.next.id === prayer.id;
      times.appendChild(el("div", { class: "dc-time" + (isNext ? " is-next" : "") }, [
        el("span", { class: "l", text: prayer.name }),
        el("span", { class: "v", text: prayer.clock }),
      ]));
    });
    card.appendChild(times);
    card.appendChild(el("div", { class: "dc-btns" }, [
      el("a", { class: "dc-btn", href: "29-prayer-times.html", text: t("allTimes") }),
      el("button", {
        class: "dc-btn ghost",
        type: "button",
        text: t("useLocation"),
        onclick: useGeolocation,
      }),
    ]));
    return card;
  }

  function useGeolocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        DC.setLocation(pos.coords.latitude, pos.coords.longitude, t("useLocation"));
        refreshPrayer();
        toast("حُفظ موقعك.");
      },
      function () { toast("تعذّر تحديد موقعك."); },
      { timeout: 8000, maximumAge: 600000 }
    );
  }

  function refreshPrayer() {
    var old = host.querySelector(".dc-card[data-prayer]");
    if (!old) return;
    var next = buildPrayer();
    next.setAttribute("data-prayer", "");
    old.replaceWith(next);
  }

  function tickCountdown() {
    if (!countdownNode || !countdownNode.isConnected) return;
    var state = DC.prayerState();
    if (!state || !state.next) {
      countdownNode.textContent = "--:--";
      return;
    }
    countdownNode.textContent = DC.countdown(state.next.at.getTime() - new Date().getTime());
  }

  var secondTimer = null;

  /* ==================== ٣) الورد اليومي ==================== */

  var wirdBox = null;

  function buildWird() {
    var card = section("dc-card", t("wird"), "📖");
    var state = DC.wirdState();

    if (!state.active) {
      card.appendChild(el("p", { class: "dc-sub", text: "اختر وردك اليومي، وتذكّرك الصفحة به كل يوم." }));
      card.appendChild(el("div", { class: "dc-btns" }, [
        el("button", { class: "dc-btn primary", type: "button", text: t("startWird"), onclick: openPlanModal }),
        el("a", { class: "dc-btn", href: "17-wird.html", text: t("keepReading") }),
      ]));
      return card;
    }

    card.appendChild(el("div", { class: "dc-wird-line" }, [
      el("span", { class: "dc-wird-nums", text: state.done + " / " + state.goal + " " + t("page") }),
      el("span", { class: "dc-sub", text: state.plan.label + (state.paused ? " · متوقّف" : "") }),
    ]));

    var bar = el("div", { class: "dc-bar" + (state.complete ? " is-done" : "") }, [
      el("i", { style: "width:" + state.percent + "%" }),
    ]);
    card.appendChild(bar);

    card.appendChild(el("div", { class: "dc-wird-meta" }, [
      el("span", { text: state.remainingToday > 0 ? t("remaining") + " " + state.remainingToday + " " + t("page") : t("pickDone") }),
      el("span", { text: t("best") + ": " + DC.getStreak().best }),
    ]));

    card.appendChild(el("div", { class: "dc-stepper" }, [
      el("label", { class: "dc-sub", for: "dcPages", text: t("addPages") }),
      el("input", { id: "dcPages", type: "number", min: "1", max: String(DC.QURAN_PAGES), value: "1", inputmode: "numeric" }),
      el("button", {
        class: "dc-btn primary",
        type: "button",
        text: t("addPages"),
        onclick: function () {
          var input = document.getElementById("dcPages");
          var amount = Number(input ? input.value : 0);
          DC.logPages(amount);
          var after = DC.wirdState();
          if (after.complete) celebrate();
          refreshWird();
        },
      }),
    ]));

    var buttons = el("div", { class: "dc-btns" }, [
      el("a", { class: "dc-btn primary", href: "30-quran-full.html", text: t("keepReading") }),
      el("button", { class: "dc-btn", type: "button", text: t("changePlan"), onclick: openPlanModal }),
      el("button", {
        class: "dc-btn ghost",
        type: "button",
        text: state.paused ? t("resume") : t("pause"),
        onclick: function () {
          if (state.paused) DC.resumePlan(); else DC.pausePlan();
          refreshWird();
        },
      }),
      el("button", {
        class: "dc-btn ghost",
        type: "button",
        text: t("reset"),
        onclick: function () {
          if (!window.confirm("سيُصفّر تقدّم هذا الورد. متابعة؟")) return;
          DC.resetPlan(state.plan.id);
          refreshWird();
          toast(t("planReset"));
        },
      }),
    ]);
    card.appendChild(buttons);

    var streak = DC.syncStreak();
    if (streak.current > 0) {
      card.appendChild(el("p", { class: "dc-streak" }, [
        el("span", { "aria-hidden": "true", text: "🔥" }),
        el("span", {
          text: t("streakOn") + DC.toArabicDigits(streak.current)
            + (streak.current === 1 ? " " + t("streakOne") : " " + t("streakMany")),
        }),
      ]));
    }
    return card;
  }

  function refreshWird() {
    var old = host.querySelector(".dc-card[data-wird]");
    if (!old) return;
    var next = buildWird();
    next.setAttribute("data-wird", "");
    old.replaceWith(next);
  }

  /* ==================== ٤) نافذة اختيار الخطة ==================== */

  var planDialog = null;

  function openPlanModal() {
    if (!planDialog) planDialog = buildPlanDialog();
    var current = DC.getPlan();
    Array.prototype.forEach.call(planDialog.querySelectorAll(".dc-plan"), function (button) {
      button.setAttribute("aria-pressed", current && button.getAttribute("data-plan") === current.id ? "true" : "false");
    });
    var custom = planDialog.querySelector("#dcCustomPages");
    if (custom) custom.hidden = !current || current.id !== "custom";
    planDialog.showModal ? planDialog.showModal() : planDialog.setAttribute("open", "");
  }

  function buildPlanDialog() {
    var dialog = el("dialog", { class: "dc-modal", "aria-label": t("planTitle") });
    var inner = el("div", { class: "dc-modal-in" });
    inner.appendChild(el("h2", null, [el("span", { text: "💚 " + t("planTitle") })]));
    inner.appendChild(el("p", { class: "dc-sub", text: t("planNote") }));

    var grid = el("div", { class: "dc-plans" });
    DC.PLANS.forEach(function (plan) {
      var button = el("button", {
        class: "dc-plan",
        type: "button",
        "data-plan": plan.id,
        "aria-pressed": "false",
      }, [
        el("span", { class: "n", text: plan.label }),
        el("span", { class: "d", text: plan.id === "custom" ? plan.note : plan.pages + " صفحة · " + plan.note }),
      ]);
      button.addEventListener("click", function () {
        Array.prototype.forEach.call(grid.querySelectorAll(".dc-plan"), function (other) {
          other.setAttribute("aria-pressed", other === button ? "true" : "false");
        });
        var custom = inner.querySelector("#dcCustomPages");
        if (custom) custom.hidden = plan.id !== "custom";
        startPlan(plan.id);
      });
      grid.appendChild(button);
    });
    inner.appendChild(grid);

    var custom = el("label", { class: "dc-remind-row", id: "dcCustomPages", hidden: true, for: "dcCustomInput" }, [
      el("span", { text: t("customPages") }),
    ]);
    var input = el("input", { id: "dcCustomInput", type: "number", min: "1", max: String(DC.QURAN_PAGES), value: "5", inputmode: "numeric" });
    input.addEventListener("change", function () { startPlan("custom"); });
    custom.appendChild(input);
    inner.appendChild(custom);

    inner.appendChild(el("div", { class: "dc-btns" }, [
      el("button", { class: "dc-btn ghost", type: "button", text: t("cancel"), onclick: function () { closeDialog(dialog); } }),
    ]));
    dialog.appendChild(inner);
    document.body.appendChild(dialog);
    return dialog;
  }

  function startPlan(id) {
    var pages = Number((document.getElementById("dcCustomInput") || {}).value);
    var plan = DC.startPlan(id, { pagesPerDay: pages });
    if (!plan) return;
    closeDialog(planDialog);
    refreshWird();
    toast(t("planOn") + plan.label);
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (dialog.close) dialog.close(); else dialog.removeAttribute("open");
  }

  /* ==================== ٥) شاشة الإتمام ==================== */

  var celebrated = null;

  function celebrate() {
    if (celebrated) return;
    celebrated = true;
    var pick = DC.completionPick();
    if (!pick) return;

    var dialog = el("dialog", { class: "dc-modal", "aria-label": t("pickTitle") });
    var inner = el("div", { class: "dc-modal-in dc-done" });
    inner.appendChild(el("p", { class: "dc-mashallah", text: t("pickTitle") }));
    inner.appendChild(el("p", { class: "dc-sub", text: t("pickDone") }));
    inner.appendChild(el("span", { class: "dc-done-kind", text: pick.emoji + " " + pick.kind }));
    inner.appendChild(el("p", { class: "dc-done-text", text: pick.text }));
    if (pick.ref) inner.appendChild(el("p", { class: "dc-done-ref", text: "المصدر: " + pick.ref }));
    inner.appendChild(el("div", { class: "dc-btns" }, [
      el("button", {
        class: "dc-btn primary",
        type: "button",
        text: t("continueRead"),
        onclick: function () { closeDialog(dialog); },
      }),
      el("button", {
        class: "dc-btn",
        type: "button",
        text: t("shareReward"),
        onclick: function () { doShare(pick); },
      }),
      el("button", {
        class: "dc-btn ghost",
        type: "button",
        text: t("copy"),
        onclick: function () {
          DC.copy(pick.text + (pick.ref ? "\nالمصدر: " + pick.ref : "")).then(function (ok) {
            toast(ok ? t("copied") : t("copiedFail"));
          });
        },
      }),
    ]));
    dialog.appendChild(inner);
    document.body.appendChild(dialog);
    dialog.showModal ? dialog.showModal() : dialog.setAttribute("open", "");
    try { localStorage.setItem(CELEBRATED_KEY, DC.dateKey()); } catch (error) { /* لا شيء */ }
  }

  /** إتمام الورد次日 فتح الصفحة: نرحّب به دون إزعاج. */
  function maybeCelebrateOnOpen() {
    var state = DC.wirdState();
    if (!state.active || !state.complete) return;
    var seen = null;
    try { seen = localStorage.getItem(CELEBRATED_KEY); } catch (error) { /* لا شيء */ }
    if (seen === DC.dateKey()) return;
    setTimeout(celebrate, 700);
  }

  /* ==================== ٦) المشاركة ==================== */

  function doShare(item) {
    var text = DC.shareText(item);
    if (navigator.share) {
      navigator.share({ title: DC.SITE_NAME, text: text }).catch(function (error) {
        if (error && error.name === "AbortError") return;
        DC.copy(text).then(function (ok) { toast(ok ? t("copied") : t("copiedFail")); });
      });
      return;
    }
    DC.copy(text).then(function (ok) { toast(ok ? t("copied") : t("copiedFail")); });
  }

  /* ==================== ٧) المحتوى اليومي ==================== */

  function iconButton(label, handler) {
    return el("button", { class: "dc-btn ghost", type: "button", text: label, onclick: handler });
  }

  function buildVerse() {
    var card = section("dc-card", t("verse"), "🌿");
    var verse = DC.dailyVerse();
    if (!verse) {
      card.appendChild(el("p", { class: "dc-sub", text: t("noContent") }));
      return card;
    }
    card.appendChild(el("p", { class: "dc-verse", text: verse.text }));
    card.appendChild(el("p", { class: "dc-ref", text: verse.ref }));
    card.appendChild(el("div", { class: "dc-btns" }, [
      iconButton("📋 " + t("copy"), function () {
        DC.copy(verse.text + "\n" + verse.ref).then(function (ok) { toast(ok ? t("copied") : t("copiedFail")); });
      }),
      el("button", { class: "dc-btn ghost", type: "button", text: "🤍 " + t("shareReward"), onclick: function () { doShare({ emoji: "🌿", text: verse.text, ref: verse.ref }); } }),
      el("button", {
        class: "dc-btn ghost",
        type: "button",
        "aria-pressed": DC.isSaved(verse.ref) ? "true" : "false",
        text: (DC.isSaved(verse.ref) ? "★ " : "☆ ") + (DC.isSaved(verse.ref) ? t("saved") : t("save")),
        onclick: function () {
          var now = DC.toggleSaved(verse);
          this.textContent = (now ? "★ " : "☆ ") + (now ? t("saved") : t("save"));
          this.setAttribute("aria-pressed", now ? "true" : "false");
          if (now) toast(t("savedOk"));
        },
      }),
    ]));
    return card;
  }

  function buildDhikr() {
    var card = section("dc-card", t("dhikr"), "🤲");
    var dhikr = DC.dailyDhikr ? DC.dailyDhikr() : DC.dailyHadith();
    if (!dhikr) {
      card.appendChild(el("p", { class: "dc-sub", text: t("noContent") }));
      return card;
    }
    card.appendChild(el("p", { class: "dc-dhikr", text: dhikr.text }));
    card.appendChild(el("p", { class: "dc-ref", text: dhikr.ref ? "المصدر: " + dhikr.ref : "" }));

    var counter = el("p", { class: "dc-tap" }, [
      el("span", { class: "n", text: "٠" }),
      el("span", { text: " " + t("tap") }),
    ]);
    var button = el("button", {
      class: "dc-btn",
      type: "button",
      text: "🤲 " + t("tap"),
      onclick: function () {
        var store = readTicks();
        var today = DC.dateKey();
        store[today] = (store[today] || 0) + 1;
        writeTicks(store);
        counter.firstChild.textContent = DC.toArabicDigits(store[today]);
      },
    });
    var ticks = readTicks();
    counter.firstChild.textContent = DC.toArabicDigits(ticks[DC.dateKey()] || 0);

    card.appendChild(counter);
    card.appendChild(el("div", { class: "dc-btns" }, [
      button,
      el("button", { class: "dc-btn ghost", type: "button", text: "🤍 " + t("shareReward"), onclick: function () { doShare({ emoji: "🤲", text: dhikr.text, ref: dhikr.ref }); } }),
      el("a", { class: "dc-btn ghost", href: "25-azkar-shamila.html", text: "كل الأذكار" }),
    ]));
    return card;
  }

  function readTicks() {
    try {
      var value = JSON.parse(localStorage.getItem(TICKED_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (error) { return {}; }
  }

  function writeTicks(value) {
    try { localStorage.setItem(TICKED_KEY, JSON.stringify(value)); } catch (error) { /* لا شيء */ }
  }

  /* ==================== ٨) «ماذا تريد أن تفعل الآن؟» ==================== */

  function buildActions() {
    var card = section("dc-card", t("nowTitle"), "🌿");
    var grid = el("div", { class: "dc-now" });
    ACTIONS.forEach(function (item) {
      grid.appendChild(el("a", { href: item.href }, [
        el("span", { class: "dc-emoji", "aria-hidden": "true", text: item.emoji }),
        el("span", { text: item.label }),
      ]));
    });
    card.appendChild(grid);
    card.appendChild(el("div", { class: "dc-btns" }, [
      el("a", { class: "dc-btn ghost", href: "#sections", text: t("moreTools") }),
    ]));
    return card;
  }

  /* ==================== ٩) التذكيرات الاختيارية ==================== */

  function buildReminders() {
    var card = section("dc-card", t("reminders"), "🔔");
    var prefs = DC.getReminders();
    var supported = DC.supportedNotifications();
    var permission = DC.notificationPermission();

    card.appendChild(el("p", { class: "dc-sub", text: supported ? t("remindersAsk") : "متصفحك لا يدعم الإشعارات." }));

    var master = el("button", {
      class: "dc-btn " + (prefs.enabled ? "" : "primary"),
      type: "button",
      "aria-pressed": prefs.enabled ? "true" : "false",
      text: !supported ? "غير مدعوم" : prefs.enabled ? t("done") : t("enable"),
    });
    master.addEventListener("click", function () {
      if (!DC.supportedNotifications()) return;
      if (!prefs.enabled) {
        askPermission(function (granted) {
          var next = DC.setReminders({ enabled: granted });
          prefs = next;
          this.setAttribute("aria-pressed", granted ? "true" : "false");
          this.textContent = granted ? t("done") : t("enable");
          if (granted) { refreshReminders(); toast(t("done")); }
        }.bind(this));
      } else {
        prefs = DC.setReminders({ enabled: false });
        this.setAttribute("aria-pressed", "false");
        this.textContent = t("enable");
      }
    });
    card.appendChild(el("div", { class: "dc-btns" }, [master]));

    if (prefs.enabled && permission !== "granted") {
      card.appendChild(el("p", { class: "dc-note", text: t("doneNoPerm") }));
    }

    var list = el("div", { class: "dc-remind-list" });
    if (prefs.enabled) {
      list.appendChild(reminderRow(t("onPrayer"), null, prefs.prayer, function (on) { prefs = DC.setReminders({ prayer: on }); }));
      [["wird", t("onWird")], ["morning", t("onMorning")], ["evening", t("onEvening")], ["daily", t("onDaily")]]
        .forEach(function (entry) {
          list.appendChild(reminderRow(entry[1], prefs[entry[0]].time, prefs[entry[0]].on, function (on) {
            prefs = DC.setReminders({});
            var patch = {};
            patch[entry[0]] = { on: on, time: prefs[entry[0]].time };
            prefs = DC.setReminders(patch);
          }));
        });
    }
    card.appendChild(list);

    if (prefs.enabled) {
      card.appendChild(el("div", { class: "dc-btns" }, [
        el("button", {
          class: "dc-btn ghost",
          type: "button",
          text: t("off"),
          onclick: function () {
            prefs = DC.setReminders({ enabled: false });
            refreshReminders();
          },
        }),
      ]));
    }
    card.appendChild(el("p", { class: "dc-note", text: t("remindersNote") }));
    return card;
  }

  function reminderRow(label, time, on, onChange) {
    var box = el("div", { class: "dc-remind-row" });
    var check = el("input", { type: "checkbox" });
    check.checked = Boolean(on);
    check.addEventListener("change", function () { onChange(check.checked); });
    box.appendChild(check);
    box.appendChild(el("label", { text: label }));
    if (time) {
      var picker = el("input", { type: "time", value: time, "aria-label": label });
      picker.addEventListener("change", function () {
        var patch = {};
        patch[timedName(label)] = { on: check.checked, time: picker.value };
        DC.setReminders(patch);
      });
      box.appendChild(picker);
    }
    return box;
  }

  /** يربط صفّ التذكير باسمه؛ تُستدعى مع نفس النصوص في اللغتين. */
  function timedName(label) {
    var names = ["wird", "morning", "evening", "daily"];
    for (var i = 0; i < names.length; i += 1) {
      if (STR.ar[names[i]] === label || STR.en[names[i]] === label) return names[i];
    }
    return "daily";
  }

  function refreshReminders() {
    var old = host.querySelector(".dc-card[data-remind]");
    if (!old) return;
    var next = buildReminders();
    next.setAttribute("data-remind", "");
    old.replaceWith(next);
  }

  function askPermission(done) {
    if (!DC.supportedNotifications()) return done(false);
    if (DC.notificationPermission() === "granted") return done(true);
    if (DC.notificationPermission() === "denied") return done(false);
    try {
      Notification.requestPermission().then(function (result) { done(result === "granted"); });
    } catch (error) {
      done(false);
    }
  }

  /* ==================== ١٠) جدولة التذكيرات ==================== */

  var REMINDER_MESSAGES = {
    wird: ["💚 ورد القرآن", "حان وقت وردك اليومي — صفحة أو صفحتان تكفيان."],
    morning: ["🌅 أذكار الصباح", "أذكار الصباح تنتظرك."],
    evening: ["🌆 أذكار المساء", "أذكار المساء تنتظرك."],
    daily: ["🤍 ذكر اليوم", "خذ وقتك مع آية اليوم وذكرها."],
  };

  function fireOnce(type, title, body) {
    var fired = {};
    try { fired = JSON.parse(localStorage.getItem(FIRED_KEY) || "{}"); } catch (error) { fired = {}; }
    var today = DC.dateKey();
    if (fired[today + "|" + type]) return false;
    fired[today + "|" + type] = 1;
    try { localStorage.setItem(FIRED_KEY, JSON.stringify(fired)); } catch (error) { /* لا شيء */ }
    return DC.showNotification(title, { body: body, tag: "dc-" + type });
  }

  function minutesOf(hhmm) {
    var match = /^(\d{2}):(\d{2})$/.exec(String(hhmm ?? ""));
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function checkReminders() {
    var prefs = DC.getReminders();
    if (!prefs.enabled || DC.notificationPermission() !== "granted") return;
    var now = new Date();
    var minutes = now.getHours() * 60 + now.getMinutes();

    if (prefs.prayer) {
      var state = DC.prayerState();
      if (state && state.next) {
        var diff = Math.round((state.next.at.getTime() - now.getTime()) / 60000);
        if (diff >= 0 && diff <= 1) {
          fireOnce("prayer-" + state.next.id, "🕌 " + state.next.name, "حان الآن وقت صلاة " + state.next.name + ".");
        }
      }
    }

    ["wird", "morning", "evening", "daily"].forEach(function (name) {
      if (!prefs[name].on) return;
      var target = minutesOf(prefs[name].time);
      if (target === null) return;
      if (minutes >= target && minutes - target < 30) {
        var messages = REMINDER_MESSAGES[name];
        fireOnce(name, messages[0], messages[1]);
      }
    });
  }

  /* ==================== ١١) زر مشاركة الموقع ==================== */

  function buildShareCta() {
    var box = el("section", { class: "dc-share-cta" });
    box.appendChild(el("p", { text: t("shareCta") }));
    var targets = DC.shareTargets("المكتبة الإسلامية — رفيق المسلم اليومي");
    var row = el("div", { class: "dc-btns" });
    row.style.justifyContent = "center";
    [
      ["واتساب", targets.whatsapp],
      ["تليجرام", targets.telegram],
      ["X", targets.x],
      ["فيسبوك", targets.facebook],
    ].forEach(function (pair) {
      row.appendChild(el("a", {
        class: "dc-btn ghost",
        href: pair[1],
        target: "_blank",
        rel: "noopener noreferrer",
        text: pair[0],
      }));
    });
    row.appendChild(el("button", {
      class: "dc-btn",
      type: "button",
      text: "🔗 " + t("shareSite"),
      onclick: function () { doShare({ emoji: "🤍", text: "المكتبة الإسلامية — رفيق المسلم اليومي", ref: "" }); },
    }));
    box.appendChild(row);
    return box;
  }

  /* ==================== التركيب ==================== */

  function render() {
    clear(host);
    host.appendChild(buildHero());

    var cards = el("div", { class: "dc-cards" });
    var prayer = buildPrayer();
    prayer.setAttribute("data-prayer", "");
    cards.appendChild(prayer);
    var wird = buildWird();
    wird.setAttribute("data-wird", "");
    cards.appendChild(wird);
    var verse = buildVerse();
    cards.appendChild(verse);
    var dhikr = buildDhikr();
    cards.appendChild(dhikr);
    var now = buildActions();
    cards.appendChild(now);
    var remind = buildReminders();
    remind.setAttribute("data-remind", "");
    cards.appendChild(remind);
    host.appendChild(cards);

    host.appendChild(buildShareCta());
    countdownNode = host.querySelector(".dc-count");
    tickCountdown();
  }

  render();

  setInterval(function () {
    tickCountdown();
    checkReminders();
  }, 30000);

  function startSecondTimer() {
    if (secondTimer) clearInterval(secondTimer);
    secondTimer = setInterval(function () { tickCountdown(); }, 1000);
  }

  startSecondTimer();

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      // ننبض كل ثانية والصفحة مرئية فقط — الصفحة في الخلفية بلا عدّاد ثوانٍ.
      startSecondTimer();
      tickCountdown();
      checkReminders();
    } else if (secondTimer) {
      clearInterval(secondTimer);
      secondTimer = null;
    }
  });

  // تبديل لغة الفهرس يغيّر نصوص هذه اللوحة أيضًا.
  new MutationObserver(function () {
    var next = document.documentElement.lang === "en" ? "en" : "ar";
    if (next === lang) return;
    lang = next;
    render();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  maybeCelebrateOnOpen();
  checkReminders();
})();