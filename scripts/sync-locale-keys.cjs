/**
 * يضيف المفاتيح الجديدة التي يحتاجها الفهرس (index.html) إلى ملفَي ar/en،
 * ثم يزامن الوحدات الناقصة لكل اللغات الأخرى من الإنجليزية كقاعدة آمنة.
 *
 * لا يمسّ أي مفتاح موجود ولا يعيد ترتيب المفاتيح؛ ي only-append.
 * @scripts/sync-locale-keys.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALES = path.join(ROOT, 'locales');

/* ---------- مفاتيح جديدة للوحدة common ---------- */
const NEW_COMMON = {
  ar: {
    installApp: "تثبيت التطبيق",
    introGuide: "دليل المكتبة",
    searchAria: "البحث الشامل في الموقع",
    searchPlaceholderMain: "ماذا تبحث عنه أو ماذا تحتاج؟",
    placeholderNote: "ملاحظتك الخاصة على هذه الأداة...",
    ariaNote: "ملاحظتك الخاصة على هذه الأداة",
    catalogLabel: "الكتالوج التعريفي (PDF)",
    noToolsMatch: "لا توجد أدوات مطابقة لبحثك.",
    installToast: "استخدم قائمة المتصفح (⋮ أو ≡) ثم «تثبيت» أو «إضافة إلى الشاشة الرئيسية» لتثبيت التطبيق",
    installToastIOS: "شارك الصفحة ثم اختر «إضافة إلى الشاشة الرئيسية» لتثبيت التطبيق 📱",
    backupExported: "تم تصدير {count} قيمة من أدوات المكتبة.",
    backupCreateFailed: "تعذر إنشاء النسخة الاحتياطية.",
    backupTooLarge: "الملف أكبر من الحد المسموح (5 ميجابايت).",
    backupConfirm: "النسخة من {date} وتحتوي {count} قيمة. سيتم دمجها مع بياناتك الحالية دون حذف مفاتيح أخرى. متابعة؟",
    backupRestoredPartial: "استُعيد {restored} قيمة، وتعذر حفظ {failed}؛ قد يكون التخزين المؤقت أو المساحة ممتلئة.",
    backupImported: "تم استيراد {restored} قيمة ودمجها. أُعيد تحميل الأدوات بالتحديث.",
    backupReadFailed: "تعذر قراءة النسخة الاحتياطية."
  },
  en: {
    installApp: "Install App",
    introGuide: "Library Guide",
    searchAria: "Search the whole site",
    searchPlaceholderMain: "What are you looking for or what do you need?",
    placeholderNote: "Your personal note on this tool...",
    ariaNote: "Personal note on this tool",
    catalogLabel: "Catalog (PDF)",
    noToolsMatch: "No tools match your search.",
    installToast: "Use the browser menu (⋮ or ≡) then “Install” or “Add to Home Screen” to install the app",
    installToastIOS: "Share the page then choose “Add to Home Screen” to install the app 📱",
    backupExported: "Exported {count} values from the library tools.",
    backupCreateFailed: "Could not create the backup.",
    backupTooLarge: "The file is larger than the allowed limit (5 MB).",
    backupConfirm: "The backup is from {date} and contains {count} values. It will be merged with your current data without deleting other keys. Continue?",
    backupRestoredPartial: "Restored {restored} values, failed to save {failed}; the cache or storage may be full.",
    backupImported: "Imported and merged {restored} values. Reloading the tools.",
    backupReadFailed: "Could not read the backup."
  }
};

/* ---------- مفاتيح جديدة للوحدة home (شبكة «ماذا تريد أن تفعل؟») ---------- */
const NEW_HOME = {
  ar: {
    ask: {
      quran: "أريد قراءة القرآن",
      salah: "أريد تعلم الصلاة",
      morningAdhkar: "أريد أذكار الصباح",
      prayerTimes: "أريد معرفة مواقيت الصلاة",
      hadith: "أريد البحث عن حديث",
      fiqh: "أريد تعلم الفقه",
      seerah: "أريد قراءة السيرة",
      story: "أريد قصة نبي",
      dua: "أريد دعاء",
      term: "أريد معرفة معنى مصطلح إسلامي",
      book: "أريد كتابًا",
      quiz: "أريد اختبارًا",
      zakat: "أريد حاسبة الزكاة",
      qibla: "أريد اتجاه القبلة",
      tasbeeh: "أريد السبحة الإلكترونية",
      kids: "أريد قسم الأطفال",
      path: "أريد مسار تعلم"
    }
  },
  en: {
    ask: {
      quran: "I want to read the Quran",
      salah: "I want to learn prayer",
      morningAdhkar: "I want morning adhkar",
      prayerTimes: "I want prayer times",
      hadith: "I want to search hadith",
      fiqh: "I want to learn fiqh",
      seerah: "I want to read the Seerah",
      story: "I want a prophet's story",
      dua: "I want a du'a",
      term: "I want an Islamic term's meaning",
      book: "I want a book",
      quiz: "I want a quiz",
      zakat: "I want the zakat calculator",
      qibla: "I want the qibla direction",
      tasbeeh: "I want the digital tasbeeh",
      kids: "I want the kids section",
      path: "I want a learning path"
    }
  }
};

function loadJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/* 1) إضافة المفاتيح إلى ar/en دون مسح أي شيء موجود */
for (const lang of ['ar', 'en']) {
  const commonFile = path.join(LOCALES, lang, 'common.json');
  const common = loadJSON(commonFile);
  const added = [];
  for (const [k, v] of Object.entries(NEW_COMMON[lang])) {
    if (common.common[k] === undefined) {
      common.common[k] = v;
      added.push(k);
    }
  }
  saveJSON(commonFile, common);

  const homeFile = path.join(LOCALES, lang, 'home.json');
  const home = loadJSON(homeFile);
  const addedHome = [];
  for (const [k, v] of Object.entries(NEW_HOME[lang].ask)) {
    home.home.ask = home.home.ask || {};
    if (home.home.ask[k] === undefined) {
      home.home.ask[k] = v;
      addedHome.push(k);
    }
  }
  saveJSON(homeFile, home);
  console.log(`${lang}: +${added.length} common keys, +${addedHome.length} home keys`);
}

/* 2) مزامنة المفاتيح الجديدة في common.json لكل اللغات الأخرى (قاعدة إنجليزية) */
const LANGUAGES = fs.readdirSync(LOCALES).filter(d => {
  const p = path.join(LOCALES, d);
  return fs.statSync(p).isDirectory() && d !== 'ar' && d !== 'en';
});

let synced = 0;
for (const lang of LANGUAGES) {
  const commonFile = path.join(LOCALES, lang, 'common.json');
  if (!fs.existsSync(commonFile)) continue;
  const common = loadJSON(commonFile);
  common.common = common.common || {};
  let changed = false;
  for (const [k, v] of Object.entries(NEW_COMMON.en)) {
    if (common.common[k] === undefined) {
      common.common[k] = v;
      changed = true;
    }
  }
  if (changed) {
    saveJSON(commonFile, common);
    synced++;
  }
}
console.log(`synced common keys into ${synced} other languages`);

/* 3) إنشاء الوحدات الناقصة لكل اللغات من الإنجليزية (قاعدة آمنة قابلة للترجمة لاحقًا) */
const MODULES = fs.readdirSync(path.join(LOCALES, 'en')).filter(f => f.endsWith('.json'));
let created = 0;
for (const lang of LANGUAGES) {
  for (const mod of MODULES) {
    const target = path.join(LOCALES, lang, mod);
    if (!fs.existsSync(target)) {
      const data = loadJSON(path.join(LOCALES, 'en', mod));
      data._meta = { language: lang, status: 'needs_translation', baseLanguage: 'en' };
      saveJSON(target, data);
      created++;
    }
  }
}
console.log(`created ${created} missing namespace files (English base) for ${LANGUAGES.length} languages`);
console.log('done');
