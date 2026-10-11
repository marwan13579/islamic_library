/**
 * Lightweight i18n bootstrap for tool pages
 * Loads locale data and exposes window.__i18n for the language selector
 */
(function() {
  const STORAGE_KEY = "site-locale";
  const LANG_ROUTES = {
    ar: { dir: "rtl", label: "العربية" }, en: { dir: "ltr", label: "English" },
    fr: { dir: "ltr", label: "Français" }, es: { dir: "ltr", label: "Español" },
    de: { dir: "ltr", label: "Deutsch" }, it: { dir: "ltr", label: "Italiano" },
    pt: { dir: "ltr", label: "Português" }, nl: { dir: "ltr", label: "Nederlands" },
    pl: { dir: "ltr", label: "Polski" }, sv: { dir: "ltr", label: "Svenska" },
    no: { dir: "ltr", label: "Norsk" }, da: { dir: "ltr", label: "Dansk" },
    fi: { dir: "ltr", label: "Suomi" }, el: { dir: "ltr", label: "Ελληνικά" },
    cs: { dir: "ltr", label: "Čeština" }, ro: { dir: "ltr", label: "Română" },
    hu: { dir: "ltr", label: "Magyar" }, uk: { dir: "ltr", label: "Українська" },
    ru: { dir: "ltr", label: "Русский" }, tr: { dir: "ltr", label: "Türkçe" },
    fa: { dir: "rtl", label: "فارسی" }, ur: { dir: "rtl", label: "اردو" },
    bn: { dir: "ltr", label: "বাংলা" }, hi: { dir: "ltr", label: "हिन्दी" },
    id: { dir: "ltr", label: "Bahasa Indonesia" }, ms: { dir: "ltr", label: "Bahasa Melayu" },
    "zh-CN": { dir: "ltr", label: "简体中文" }, "zh-TW": { dir: "ltr", label: "繁體中文" },
    ja: { dir: "ltr", label: "日本語" }, ko: { dir: "ltr", label: "한국어" },
    th: { dir: "ltr", label: "ไทย" }, vi: { dir: "ltr", label: "Tiếng Việt" },
    sw: { dir: "ltr", label: "Kiswahili" }
  };

  let currentLang = "ar";
  let messages = {};

  function detectLocale() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LANG_ROUTES[saved]) return saved;
    } catch(e) {}
    const browser = (navigator.language || "ar").split("-")[0];
    const exact = (navigator.language || "").trim();
    if (LANG_ROUTES[exact]) return exact;
    if (LANG_ROUTES[browser]) return browser;
    return "ar";
  }

  async function loadLocale(lang) {
    const modules = ['common', 'navigation', 'tools'];
    const results = {};
    for (const mod of modules) {
      try {
        const url = `locales/${lang}/${mod}.json`;
        const res = await fetch(url);
        if (res.ok) {
          results[mod] = await res.json();
        }
      } catch(e) {
        // Fallback to Arabic
        try {
          const url = `locales/ar/${mod}.json`;
          const res = await fetch(url);
          if (res.ok) results[mod] = await res.json();
        } catch(e2) {}
      }
    }
    return results;
  }

  function t(key, vars = {}) {
    const dict = messages;
    const path = key.split('.');
    let text = path.reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : null), dict);
    if (text === null && dict.common) {
      text = path.reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : null), dict.common);
    }
    if (text === null) text = key;

    Object.entries(vars).forEach(([k, v]) => {
      text = String(text).replaceAll(`{${k}}`, String(v));
    });
    return text;
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = t(key);
      if (text && text !== key) {
        if (el.tagName === 'INPUT' && el.placeholder !== undefined) {
          el.placeholder = text;
        } else {
          el.textContent = text;
        }
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const text = t(key);
      if (text && text !== key) el.placeholder = text;
    });
  }

  function applyDir(lang) {
    const html = document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', LANG_ROUTES[lang]?.dir || 'ltr');
    html.classList.toggle('rtl', LANG_ROUTES[lang]?.dir === 'rtl');
    html.classList.toggle('ltr', LANG_ROUTES[lang]?.dir !== 'rtl');
  }

  async function setLocale(lang) {
    if (!LANG_ROUTES[lang]) return;
    currentLang = lang;
    applyDir(lang);
    messages = await loadLocale(lang);
    applyTranslations();
    try { localStorage.setItem(STORAGE_KEY, lang); } catch(e) {}
    window.dispatchEvent(new CustomEvent('locale-change', { detail: { lang } }));
  }

  async function init() {
    currentLang = detectLocale();
    applyDir(currentLang);
    messages = await loadLocale(currentLang);
    applyTranslations();
    
    // Expose i18n interface for language-selector.js
    window.__i18n = {
      lang: () => currentLang,
      dir: () => LANG_ROUTES[currentLang]?.dir || 'ltr',
      t: (key) => t(key),
      tCommon: (key) => t('common.' + key),
      tHome: (key) => t('home.' + key),
      setLocale: setLocale,
      localeList: () => Object.entries(LANG_ROUTES).map(([code, meta]) => ({ code, ...meta })),
      localeLabel: () => LANG_ROUTES[currentLang]?.label || currentLang,
      onLocaleChange: (cb) => window.addEventListener('locale-change', cb)
    };
    
    // Update language button label
    const label = document.getElementById('langBtnLabel');
    if (label) label.textContent = LANG_ROUTES[currentLang]?.label || currentLang;
  }

  // Expose init for module scripts
  window.__i18nBoot = init;
  
  // Auto-init when DOM is ready
  function tryInit() {
    if (document.getElementById('langBtn') && document.getElementById('langMenu')) {
      init();
    } else {
      // Retry after a short delay
      setTimeout(tryInit, 50);
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();