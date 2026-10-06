/**
 * يضيف الأدوات الناقصة من فهرس الموقع إلى وحدة tools في ar/en.
 * أسماء الكتب (b0..b21) تبقى بالعربية كمحتوى، والوصف يُترجم.
 * @scripts/add-tools-locale.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const AR = {
  noorapp: ["بوابة النور — التطبيق", "مصحف وأذكار ومواقيت وإذاعة وزكاة وبطاقات — يعمل بدون إنترنت"],
  quizbank: ["الاختبارات والشهادات", "بنك أسئلة بثلاثة أنواع، تحدٍّ أسبوعي، وشهادات إتمام تُرسم على canvas"],
  groupkhatma: ["الختمة الجماعية", "وزّع الأجزاء بين المشاركين وتابع الإنجاز والإهداء"],
  cardmaker: ["صانع البطاقات الدعوية", "حوّل أي آية أو حديث أو ذكر لبطاقة صورة قابلة للتحميل والمشاركة"],
  quranfull: ["القرآن الكريم", "المصحف كاملًا — سور، أجزاء، بحث، تلاوة، ترجمة وتفسير"],
  dailysystem: ["نظام حياة المسلم", "يومك مرتبط بالصلاة — صلاة، ذكر، وقرآن مع كل وقت"],
  adhkar: ["الأذكار الشاملة", "١٢ قسمًا: الصباح، المساء، النوم، بعد الصلاة، الوضوء، الاستغفار وغيرها"],
  dhikrkit: ["نور الذكر", "أذكار وأدعية وأحاديث في مكان واحد، مع سبحة عدّاد ورابط يُشارك لبلّغ الذكر"],
  mushaf: ["مُصحَفي", "تتبّع حفظ القرآن الكريم كاملًا"],
  hadithcol: ["الحديث الشريف", "مختارات من الكتب الستة، موثّقة بالراوي والدرجة"],
  arbaeen: ["الأربعون النووية", "٤٢ حديثًا جامعًا بشرح مختصر"],
  kidsadab: ["قصص الآداب للأطفال", "سبع قصص قصيرة عن الأخلاق الجميلة"],
  gtasbeeh: ["تسبيح جماعي", "عدّاد منفصل لكل فرد في المجلس"],
  noorcompanion: ["رفيق النور", "تذكير إيماني هادئ يضبطه أنت: الفاصل الزمني ونوع المحتوى والوضع الهادئ"],
  visiting: ["آداب الزيارة والعيادة", "عيادة المريض، العزاء، والتهنئة"],
  voiceazkar: ["سجّل صوتك بالأذكار", "مسجّل شخصي لصوتك وأنت تذكر الله"],
  prayertimes: ["مواقيت الصلاة", "الفجر إلى العشاء، عدّ تنازلي، طرق حساب ومذاهب متعددة"],
  sitesdir: ["دليل المواقع الإسلامية", "١٨ موقع مرجعي بشرح أقسام كل موقع"],
  libfatwa: ["الفتاوى", "فتاوى موثّقة مصنّفة في العبادات والمعاملات والفقه والآداب"],
  libtafsir: ["التفسير الميسر", "تفسير كل آية من القرآن الكريم مع معناها — ١١٤ سورة"],
  libsiraj: ["السراج في بيان غريب القرآن", "معاني غريب ألفاظ القرآن — ٦١١١ لغوًا في ١١٤ سورة مع نصّ الآية وبحث في الكلمات"],
  libhisn: ["حصن المسلم", "أذكار الصباح والمساء والنوم والطعام — ١٣٢ بابًا مع الصوت"],
  libkhutbah: ["الخطب", "خطب ودروس في العقيدة والتزكية والأخلاق"],
  libtarikh: ["التاريخ الإسلامي", "أحداث من هجرة النبي ﷺ إلى نهاية الدولة العثمانية"],
  islamicvideos: ["مكتبة الفيديو الإسلامية", "تعلّم، شاهد، واستفد — قنوات يوتيوب موثّقة مصنّفة بالعمر واللغة والمجال"],
  libquiz: ["الاختبارات", "٥٨٢٠ سؤالًا في التفسير والفقه والعقيدة والحديث، بتصحيح فوري"],
  b0: ["نونية القحطاني بصوت فارس عباد", "تلاوة صوتية — ملفك الخاص على درايف"],
  b1: ["البداية والنهاية", "ابن كثير — ملفك الخاص على درايف"],
  b2: ["القرآن الكريم - كلمة في صورة", "ملفك الخاص على درايف"],
  b3: ["رسائل من القرآن", "ملفك الخاص على درايف"],
  b4: ["رسائل من النبي", "ملفك الخاص على درايف"],
  b5: ["على خطى الرسول", "ملفك الخاص على درايف"],
  b6: ["رسائل من الصحابة", "ملفك الخاص على درايف"],
  b7: ["رسائل من التابعين", "ملفك الخاص على درايف"],
  b8: ["الرحيق المختوم", "صفي الرحمن المباركفوري — ملفك الخاص على درايف"],
  b9: ["كلمة", "ملفك الخاص على درايف"],
  b10: ["ما لا يسع المسلم جهله", "ملفك الخاص على درايف"],
  b11: ["100 سؤال وجواب في عقيدة التوحيد", "ملفك الخاص على درايف"],
  b12: ["التفسير الميسر", "ملفك الخاص على درايف"],
  b13: ["اليوم الآخر 2 — القيامة الكبرى", "ملفك الخاص على درايف"],
  b14: ["أصول الدعوة", "عبد الكريم زيدان — ملفك الخاص على درايف"],
  b15: ["أول مرة أتدبر القرآن", "دليلك لفهم وتدبر القرآن من الفاتحة إلى الناس — ملفك الخاص"],
  b16: ["فقه الدعوة إلى الله", "فقه النصح والإرشاد والأمر بالمعروف — ملفك الخاص"],
  b17: ["مدينة الأقوياء", "ملفك الخاص على درايف"],
  b18: ["سيف الله خالد بن الوليد", "ملفك الخاص على درايف"],
  b19: ["في الحب والحياة", "د. مصطفى محمود — ملفك الخاص على درايف"],
  b20: ["الجامع الصحيح للبخاري كاملًا", "ملفك الخاص على درايف"],
  b21: ["مائة من عظماء أمة الإسلام", "غيّروا مجرى التاريخ — ملفك الخاص على درايف"]
};

const EN = {
  noorapp: ["Noor Gateway — App", "Mushaf, adhkar, prayer times, radio, zakat and cards — works offline"],
  quizbank: ["Quizzes & Certificates", "Question bank in three types, a weekly challenge, and completion certificates drawn on canvas"],
  groupkhatma: ["Group Khatmah", "Distribute parts among participants and track progress and dedication"],
  cardmaker: ["Dua Card Maker", "Turn any verse, hadith or dhikr into a downloadable, shareable image card"],
  quranfull: ["The Holy Quran", "Complete Mushaf — surahs, parts, search, recitation, translation and tafsir"],
  dailysystem: ["Muslim Life System", "Your day tied to prayer — prayer, dhikr and Quran at each prayer time"],
  adhkar: ["Comprehensive Adhkar", "12 sections: morning, evening, sleep, after prayer, wudu, istighfar and more"],
  dhikrkit: ["Noor of Dhikr", "Adhkar, du'as and hadiths in one place, with a counter tasbeeh and a shareable link"],
  mushaf: ["My Mushaf", "Track your complete Quran memorization"],
  hadithcol: ["The Noble Hadith", "Selections from the Six Books, documented with narrator and grade"],
  arbaeen: ["Al-Arba'in al-Nawawi", "42 hadiths collected with a brief explanation"],
  kidsadab: ["Adab Stories for Kids", "Seven short stories about good morals"],
  gtasbeeh: ["Group Tasbeeh", "A separate counter for each person in the gathering"],
  noorcompanion: ["Noor Companion", "A calm faith reminder you configure: interval, content type and calm mode"],
  visiting: ["Visiting & Condolence Etiquette", "Visiting the sick, condolences and congratulations"],
  voiceazkar: ["Record Your Adhkar", "A personal voice recorder while you remember Allah"],
  prayertimes: ["Prayer Times", "Fajr to Isha, countdown, multiple calculation methods and schools"],
  sitesdir: ["Islamic Sites Directory", "18 reference sites with an explanation of each site's sections"],
  libfatwa: ["Fatwas", "Documented fatwas classified in worship, transactions, fiqh and etiquette"],
  libtafsir: ["Tafsir al-Muyassar", "Tafsir of every verse of the Quran with its meaning — 114 surahs"],
  libsiraj: ["Al-Siraj fi Bayan Ghareeb al-Quran", "Meanings of rare Quranic words — 6111 terms in 114 surahs with verse text and word search"],
  libhisn: ["Hisn al-Muslim", "Morning, evening, sleep and food adhkar — 132 chapters with audio"],
  libkhutbah: ["Khutbahs", "Khutbahs and lessons in aqeedah, purification and ethics"],
  libtarikh: ["Islamic History", "Events from the Prophet's Hijrah to the end of the Ottoman state"],
  islamicvideos: ["Islamic Video Library", "Learn, watch and benefit — documented YouTube channels classified by age, language and field"],
  libquiz: ["Quizzes", "5820 questions in tafsir, fiqh, aqeedah and hadith, with instant correction"],
  b0: ["نونية القحطاني بصوت فارس عباد", "Audio recitation — your own file on Drive"],
  b1: ["البداية والنهاية", "Ibn Kathir — your own file on Drive"],
  b2: ["القرآن الكريم - كلمة في صورة", "Your own file on Drive"],
  b3: ["رسائل من القرآن", "Your own file on Drive"],
  b4: ["رسائل من النبي", "Your own file on Drive"],
  b5: ["على خطى الرسول", "Your own file on Drive"],
  b6: ["رسائل من الصحابة", "Your own file on Drive"],
  b7: ["رسائل من التابعين", "Your own file on Drive"],
  b8: ["الرحيق المختوم", "Safi al-Rahman al-Mubarakpuri — your own file on Drive"],
  b9: ["كلمة", "Your own file on Drive"],
  b10: ["ما لا يسع المسلم جهله", "Your own file on Drive"],
  b11: ["100 سؤال وجواب في عقيدة التوحيد", "Your own file on Drive"],
  b12: ["التفسير الميسر", "Your own file on Drive"],
  b13: ["اليوم الآخر 2 — القيامة الكبرى", "Your own file on Drive"],
  b14: ["أصول الدعوة", "Abd al-Karim Zaydan — your own file on Drive"],
  b15: ["أول مرة أتدبر القرآن", "Your guide to understanding and reflecting on the Quran — your own file"],
  b16: ["فقه الدعوة إلى الله", "Your own file on Drive"],
  b17: ["مدينة الأقوياء", "Your own file on Drive"],
  b18: ["سيف الله خالد بن الوليد", "Your own file on Drive"],
  b19: ["في الحب والحياة", "Dr. Mustafa Mahmoud — your own file on Drive"],
  b20: ["الجامع الصحيح للبخاري كاملًا", "Your own file on Drive"],
  b21: ["مائة من عظماء أمة الإسلام", "They changed the course of history — your own file on Drive"]
};

function load(file) { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
function save(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf-8'); }

for (const [lang, table] of [['ar', AR], ['en', EN]]) {
  const file = path.join(ROOT, 'locales', lang, 'tools.json');
  const data = load(file);
  data.tools = data.tools || {};
  let added = 0;
  for (const [id, [name, desc]] of Object.entries(table)) {
    if (data.tools[id] === undefined) {
      data.tools[id] = { name, desc };
      added++;
    } else {
      if (data.tools[id].name === undefined) data.tools[id].name = name;
      if (data.tools[id].desc === undefined) data.tools[id].desc = desc;
    }
  }
  save(file, data);
  console.log(`${lang}: ${added} tools added, total ${Object.keys(data.tools).length}`);
}
console.log('done');
