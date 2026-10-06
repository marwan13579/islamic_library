/**
 * يضيف وحدة accessibility.json الناقصة لكل اللغات من الإنجليزية كقاعدة آمنة.
 * @scripts/add-accessibility-locale.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALES = path.join(ROOT, 'locales');

const MODULES = fs.readdirSync(path.join(LOCALES, 'en')).filter(f => f.endsWith('.json'));
const LANGUAGES = fs.readdirSync(LOCALES).filter(d => {
  const p = path.join(LOCALES, d);
  return fs.statSync(p).isDirectory();
});

let created = 0;
for (const lang of LANGUAGES) {
  for (const mod of MODULES) {
    const target = path.join(LOCALES, lang, mod);
    if (fs.existsSync(target)) continue;
    const data = JSON.parse(JSON.stringify(JSON.parse(fs.readFileSync(path.join(LOCALES, 'en', mod), 'utf-8'))));
    data._meta = { language: lang, status: 'needs_translation', baseLanguage: 'en' };
    fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    created++;
  }
}
console.log(`created ${created} missing namespace files for ${LANGUAGES.length} languages`);
console.log('done');
