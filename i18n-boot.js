/**
 * Lightweight i18n bootstrap for tool pages
 * Loads locale data and applies translations to data-i18n elements
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
      } catch(e) {}
    }
    return results;
  }

  function t(dict, key) {
    const path = key.split('.');
    let val = path.reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : null), dict);
    if (val === null && dict.common) {
      val = path.reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : null), dict.common);
    }
    return val || key;
  }

  function applyTranslations(dict) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = t(dict, key);
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
      const text = t(dict, key);
      if (text && text !== key) el.placeholder = text;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const text = t(dict, key);
      if (text && text !== key) el.title = text;
    });
  }

  function applyDir(lang) {
    const html = document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', LANG_ROUTES[lang]?.dir || 'ltr');
    html.classList.toggle('rtl', LANG_ROUTES[lang]?.dir === 'rtl');
    html.classList.toggle('ltr', LANG_ROUTES[lang]?.dir !== 'rtl');
  }

  async function initI18n() {
    const lang = detectLocale();
    applyDir(lang);
    const dict = await loadLocale(lang);
    applyTranslations(dict);
    window.__i18n = { lang: () => lang, t: (k) => t(dict, k), setLocale: async (l) => {
      applyDir(l);
      const d = await loadLocale(l);
      applyTranslations(d);
      try { localStorage.setItem(STORAGE_KEY, l); } catch(e) {}
    }};
  }

  window.__i18nBoot = initI18n;
  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
  } else {
    initI18n();
  }
})();