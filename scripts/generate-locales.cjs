const fs = require('fs');
const path = require('path');

// Read English base
const enPath = path.join(__dirname, '../locales/en/common.json');
const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

// Languages to generate (code: nativeName)
const languages = {
  'it': { name: 'Italiano', dir: 'ltr' },
  'pt': { name: 'Português', dir: 'ltr' },
  'nl': { name: 'Nederlands', dir: 'ltr' },
  'pl': { name: 'Polski', dir: 'ltr' },
  'sv': { name: 'Svenska', dir: 'ltr' },
  'no': { name: 'Norsk', dir: 'ltr' },
  'da': { name: 'Dansk', dir: 'ltr' },
  'fi': { name: 'Suomi', dir: 'ltr' },
  'el': { name: 'Ελληνικά', dir: 'ltr' },
  'cs': { name: 'Čeština', dir: 'ltr' },
  'ro': { name: 'Română', dir: 'ltr' },
  'hu': { name: 'Magyar', dir: 'ltr' },
  'uk': { name: 'Українська', dir: 'ltr' },
  'ru': { name: 'Русский', dir: 'ltr' },
  'bn': { name: 'বাংলা', dir: 'ltr' },
  'hi': { name: 'हिन्दी', dir: 'ltr' },
  'id': { name: 'Bahasa Indonesia', dir: 'ltr' },
  'ms': { name: 'Bahasa Melayu', dir: 'ltr' },
  'zh-TW': { name: '繁體中文', dir: 'ltr' },
  'th': { name: 'ไทย', dir: 'ltr' },
  'vi': { name: 'Tiếng Việt', dir: 'ltr' },
  'sw': { name: 'Kiswahili', dir: 'ltr' },
  'ha': { name: 'Hausa', dir: 'ltr' },
  'am': { name: 'አማርኛ', dir: 'ltr' },
};

// For now, copy English as base - these need proper translation
// In production, use a translation service or manual translation
Object.entries(languages).forEach(([code, meta]) => {
  const localeDir = path.join(__dirname, `../locales/${code}`);
  if (!fs.existsSync(localeDir)) {
    fs.mkdirSync(localeDir, { recursive: true });
  }
  const localePath = path.join(localeDir, 'common.json');
  if (!fs.existsSync(localePath)) {
    // Add language metadata to each translation
    const localized = JSON.parse(JSON.stringify(enContent));
    // Add a marker that this needs translation
    localized._meta = {
      language: code,
      nativeName: meta.name,
      direction: meta.dir,
      status: 'needs_translation',
      baseLanguage: 'en'
    };
    fs.writeFileSync(localePath, JSON.stringify(localized, null, 2));
    console.log(`Created ${code}/common.json`);
  } else {
    console.log(`Skipped ${code}/common.json (exists)`);
  }
});

console.log('Done generating locale files');