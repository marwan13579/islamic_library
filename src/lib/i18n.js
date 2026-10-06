/**
 * نظام ترجمة مركزي للموقع.
 * - يحمل اللغات المطلوبة
 * - يكتشف لغة المتصفح عند أول زيارة
 * - يحفظ اختيار المستخدم في localStorage
 * - يغيّر dir/lang تلقائيًا
 * - لا يعيد تحميل الصفحة عند تغيير اللغة
 * @module lib/i18n
 */

const STORAGE_KEY = "site-locale";
const BROWSER_KEY = "site-locale-detected";

const LANG_ROUTES = {
  ar: { dir: "rtl", label: "العربية", name: "Arabic" },
  en: { dir: "ltr", label: "English", name: "English" },
  fr: { dir: "ltr", label: "Français", name: "French" },
  es: { dir: "ltr", label: "Español", name: "Spanish" },
  de: { dir: "ltr", label: "Deutsch", name: "German" },
  it: { dir: "ltr", label: "Italiano", name: "Italian" },
  pt: { dir: "ltr", label: "Português", name: "Portuguese" },
  nl: { dir: "ltr", label: "Nederlands", name: "Dutch" },
  pl: { dir: "ltr", label: "Polski", name: "Polish" },
  sv: { dir: "ltr", label: "Svenska", name: "Swedish" },
  no: { dir: "ltr", label: "Norsk", name: "Norwegian" },
  da: { dir: "ltr", label: "Dansk", name: "Danish" },
  fi: { dir: "ltr", label: "Suomi", name: "Finnish" },
  el: { dir: "ltr", label: "Ελληνικά", name: "Greek" },
  cs: { dir: "ltr", label: "Čeština", name: "Czech" },
  ro: { dir: "ltr", label: "Română", name: "Romanian" },
  hu: { dir: "ltr", label: "Magyar", name: "Hungarian" },
  uk: { dir: "ltr", label: "Українська", name: "Ukrainian" },
  ru: { dir: "ltr", label: "Русский", name: "Russian" },
  tr: { dir: "ltr", label: "Türkçe", name: "Turkish" },
  fa: { dir: "rtl", label: "فارسی", name: "Persian" },
  ur: { dir: "rtl", label: "اردو", name: "Urdu" },
  bn: { dir: "ltr", label: "বাংলা", name: "Bengali" },
  hi: { dir: "ltr", label: "हिन्दी", name: "Hindi" },
  id: { dir: "ltr", label: "Bahasa Indonesia", name: "Indonesian" },
  ms: { dir: "ltr", label: "Bahasa Melayu", name: "Malay" },
  "zh-CN": { dir: "ltr", label: "简体中文", name: "Chinese Simplified" },
  "zh-TW": { dir: "ltr", label: "繁體中文", name: "Chinese Traditional" },
  ja: { dir: "ltr", label: "日本語", name: "Japanese" },
  ko: { dir: "ltr", label: "한국어", name: "Korean" },
  th: { dir: "ltr", label: "ไทย", name: "Thai" },
  vi: { dir: "ltr", label: "Tiếng Việt", name: "Vietnamese" },
  sw: { dir: "ltr", label: "Kiswahili", name: "Swahili" },
  ha: { dir: "ltr", label: "Hausa", name: "Hausa" },
  am: { dir: "ltr", label: "አማርኛ", name: "Amharic" },
};

let current = "ar";
let messages = {};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* تجاهل */
  }
}

function detectLocale() {
  const saved = readStorage(STORAGE_KEY, null);
  if (saved && LANG_ROUTES[saved]) return saved;

  const detected = readStorage(BROWSER_KEY, null);
  if (detected && LANG_ROUTES[detected]) return detected;

  const browser = (navigator.language || navigator.userLanguage || "ar").split("-")[0];
  const exact = (navigator.language || "").trim();
  if (LANG_ROUTES[exact]) return exact;
  if (LANG_ROUTES[browser]) return browser;

  return "ar";
}

export async function init() {
  current = detectLocale();
  await loadLocale(current);
  applyDir();
}

export async function loadLocale(lang) {
  if (!LANG_ROUTES[lang]) lang = "ar";
  if (messages[lang]) {
    current = lang;
    writeStorage(STORAGE_KEY, lang);
    return messages[lang];
  }

  try {
    const mod = await import(`../locales/${lang}/common.json`);
    messages[lang] = mod.default || mod;
  } catch {
    try {
      const mod = await import(`../locales/ar/common.json`);
      messages[lang] = mod.default || mod;
    } catch {
      messages[lang] = {};
    }
  }

  current = lang;
  writeStorage(STORAGE_KEY, lang);
  return messages[lang];
}

export function t(key, vars = {}) {
  const dict = messages[current] || {};
  let text = key.split(".").reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : null), dict);
  if (text === null) text = key;

  Object.entries(vars).forEach(([k, v]) => {
    text = String(text).replaceAll(`{${k}}`, String(v));
  });

  return text;
}

export function dir() {
  return LANG_ROUTES[current]?.dir || "rtl";
}

export function lang() {
  return current;
}

export function supported() {
  return Object.keys(LANG_ROUTES);
}

export function label(langCode) {
  return LANG_ROUTES[langCode]?.label || langCode;
}

export function applyDir() {
  const html = document.documentElement;
  if (!html) return;
  html.setAttribute("lang", current);
  html.setAttribute("dir", dir());
  html.classList.toggle("rtl", dir() === "rtl");
  html.classList.toggle("ltr", dir() === "ltr");
}

export function onLocaleChange(callback) {
  window.addEventListener("locale-change", callback);
  return () => window.removeEventListener("locale-change", callback);
}

export async function setLocale(lang) {
  if (!LANG_ROUTES[lang]) return;
  await loadLocale(lang);
  applyDir();
  window.dispatchEvent(new CustomEvent("locale-change", { detail: { lang } }));
}

export function getLocale() {
  return current;
}

export function getDir() {
  return dir();
}

export function isRtl() {
  return dir() === "rtl";
}

export function localeLabel() {
  return LANG_ROUTES[current]?.label || current;
}

export function localeList() {
  return Object.entries(LANG_ROUTES).map(([code, meta]) => ({ code, ...meta }));
}
