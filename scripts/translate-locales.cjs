/**
 * Batch translation script for Islamic Library locale files
 * Translates English base → target language for all modules
 * Uses LibreTranslate API with fallback
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'https://libretranslate.com/translate';
const BATCH_SIZE = 3;
const DELAY_MS = 300;

// Language code mapping: locale dir → [LibreTranslate code, native label]
const LANG_MAP = {
  id: ['id', 'Bahasa Indonesia'],
  bn: ['bn', 'বাংলা'],
  ms: ['ms', 'Bahasa Melayu'],
  hi: ['hi', 'हिन्दी'],
  sw: ['sw', 'Kiswahili'],
  ha: ['ha', 'Hausa'],
  th: ['th', 'ไทย'],
  vi: ['vi', 'Tiếng Việt'],
  uk: ['uk', 'Українська'],
  ru: ['ru', 'Русский'],
  it: ['it', 'Italiano'],
  pt: ['pt', 'Português'],
  nl: ['nl', 'Nederlands'],
  pl: ['pl', 'Polski'],
  sv: ['sv', 'Svenska'],
  no: ['nb', 'Norsk'],
  da: ['da', 'Dansk'],
  fi: ['fi', 'Suomi'],
  el: ['el', 'Ελληνικά'],
  cs: ['cs', 'Čeština'],
  ro: ['ro', 'Română'],
  hu: ['hu', 'Magyar'],
  zh-CN: ['zh-Hans', '简体中文'],
  zh-TW: ['zh-Hant', '繁體中文'],
};

const MODULES = fs.readdirSync(path.join(__dirname, '..', 'locales', 'en')).filter(f => f.endsWith('.json'));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateText(text, targetLang, retries = 2) {
  if (!text || typeof text !== 'string' || text.trim() === '') return text;
  
  // Skip very long text (likely content, not UI)
  if (text.length > 500) return text;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: 'en',
          target: targetLang,
          format: 'text'
        })
      });

      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }

      if (!res.ok) {
        if (attempt === retries) return text;
        await sleep(1000);
        continue;
      }

      const data = await res.json();
      if (data.translatedText && data.translatedText !== text) {
        return data.translatedText;
      }
      return text;
    } catch (e) {
      if (attempt === retries) return text;
      await sleep(1000);
    }
  }
  return text;
}

async function translateObject(obj, targetLang) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return translateText(obj, targetLang);
  }
  if (Array.isArray(obj)) {
    const results = [];
    for (const item of obj) {
      results.push(await translateObject(item, targetLang));
    }
    return results;
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await translateObject(value, targetLang);
    }
    return result;
  }
  return obj;
}

async function translateLocale(langCode, ltCode) {
  const localeDir = path.join(__dirname, '..', 'locales', langCode);
  const enDir = path.join(__dirname, '..', 'locales', 'en');

  console.log(`\n=== Translating ${langCode} (${ltCode}) ===`);

  for (const module of MODULES) {
    const srcPath = path.join(enDir, module);
    const destPath = path.join(localeDir, module);

    if (!fs.existsSync(srcPath)) {
      console.log(`  ${module}: source missing, skip`);
      continue;
    }

    const srcData = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
    const destData = JSON.parse(fs.readFileSync(destPath, 'utf-8'));

    // Check if already translated (not English copy)
    const srcSample = JSON.stringify(srcData).substring(0, 200);
    const destSample = JSON.stringify(destData).substring(0, 200);
    
    if (srcSample !== destSample) {
      console.log(`  ${module}: already translated, skip`);
      continue;
    }

    process.stdout.write(`  ${module}: translating `);
    const translated = await translateObject(srcData, ltCode);
    
    // Preserve _meta if it exists
    if (destData._meta) translated._meta = destData._meta;
    
    fs.writeFileSync(destPath, JSON.stringify(translated, null, 2) + '\n', 'utf-8');
    console.log('✓');
    
    await sleep(DELAY_MS);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let langsToTranslate;

  if (args.length > 0) {
    langsToTranslate = args.map(l => l.trim()).filter(l => LANG_MAP[l]);
  } else {
    langsToTranslate = Object.keys(LANG_MAP);
  }

  console.log(`Translating ${langsToTranslate.length} languages: ${langsToTranslate.join(', ')}`);
  console.log(`Modules per language: ${MODULES.length}`);

  for (const langCode of langsToTranslate) {
    const ltCode = LANG_MAP[langCode][0];
    await translateLocale(langCode, ltCode);
  }

  console.log('\n=== All translations complete ===');
}

main().catch(console.error);