/**
 * قائمة مرشّحين لفحص قنوات YouTube الرسمية.
 *
 * لماذا ملف منفصل عن بيانات المكتبة:
 *   - `src/data/islamic-channels.js` هو ما تعرضه الواجهة، وما أراجعه بتجريدي.
 *   - وهذا الملف تجهيزٌ لاكتشاف الروابط: مقترحاتHandles نجرّبها على YouTube
 *     فنعرف أيّها رسمي موجود وأيّها لا وجود له، فلا يدخل شيءٌ إلى البيانات
 *     بلا رابطٍ حيّ.
 *
 * طريقة الاستعمال:
 *   node scripts/verify-video-channels.mjs            # يفحص ويطبع تقريرًا
 *   node scripts/verify-video-channels.mjs --json     # ناتج JSON جاهز للآلة
 *
 * النتيجة تُبنى عليها البيانات يدويًا: لا سكربت يكتب في ملف البيانات تلقائيًا،
 * فالقرار-editorial (من هذه القناة للجهة، وما يناسب أيّ فئة عمرية) قرار إنسان.
 */

/**
 * @typedef {object} Candidate
 * @property {string} label الاسم المتوقّع منّا (للمقارنة مع اسم قناة YouTube)
 * @property {string} url رابط مقترح (handle أو /user/ أو /c/ أو /channel/)
 * @property {string} [note] لماذا هو مرشّح
 */

/** @type {Candidate[]} */
export const CANDIDATES = [
  /* ---------------------------------------------- جهات معروفة (التي ذكرها صاحب المكتبة) */
  { label: "Yaqeen Institute", url: "https://www.youtube.com/@yaqeeninstituteofficial", note: "مؤسسة بحثية إسلامية" },
  { label: "Bayyinah Institute", url: "https://www.youtube.com/user/BayyinahInstitute", note: "معهد بيّنة" },
  { label: "Bayyinah / Nouman Ali Khan", url: "https://www.youtube.com/@bayyinah", note: "قناة بيّنة" },
  { label: "Mufti Menk", url: "https://www.youtube.com/@MuftiMenk", note: "الشيخ المفتي ناصر منصور" },
  { label: "Omar Suleiman", url: "https://www.youtube.com/@OmarSuleiman", note: "د. عمر سليمان — يقين" },
  { label: "Yasir Qadhi", url: "https://www.youtube.com/@YasirQadhi", note: "د. ياسر القاضي" },
  { label: "Quran Central", url: "https://www.youtube.com/@QuranCentralInc", note: "مركز القرآن" },
  { label: "OnePath Network", url: "https://www.youtube.com/@OnePathNetwork", note: "شبكة OnePath" },
  { label: "Learn with Zakaria", url: "https://www.youtube.com/@learnwithzakaria", note: "تعليم الأطفال" },

  /* ------------------------------------------------- الإنجليزية: دروس ومحاضرات */
  { label: "Just One Muslim", url: "https://www.youtube.com/@JustOneMuslim", note: "عبد الرحمن بن يوسف" },
  { label: "Saudi Islamic TV", url: "https://www.youtube.com/@SaudiIslamicTV", note: "عاصم الحاكم — الدين النصيحة" },
  { label: "Al-Ninowy", url: "https://www.youtube.com/@AlNinowy", note: "د. محمد بن يحيى الننوي" },
  { label: "Muhammad Alshareef", url: "https://www.youtube.com/@MuhammadAlshareef", note: "خطيب ومحاضر" },
  { label: "FreeQuranEducation", url: "https://www.youtube.com/@FreeQuranEducation", note: "تعليم القرآن" },
  { label: "Ali Hamza", url: "https://www.youtube.com/@AliHamzaOfficial", note: "خطيب ومحاضر" },
  { label: "The Muslim Skeptic", url: "https://www.youtube.com/@TheMuslimSkeptic", note: "أسئلة والشبهات" },
  { label: "Muhamed Ghilan", url: "https://www.youtube.com/@MohamedGhilan", note: "د. محمد قيلان" },
  { label: "Shaykh Muhammad al-Jaseeh", url: "https://www.youtube.com/@MuhammadAljaseeh", note: "شيخ-services" },
  { label: "Yassir", url: "https://www.youtube.com/@YassirQadhi", note: "مكرّر — للتحقق من التكرار" },
  { label: "Omar Ali", url: "https://www.youtube.com/@OmarAliOfficial", note: "د. عمر علي" },
  { label: "Madani Propagation", url: "https://www.youtube.com/@MadaniPropagation", note: "دعوة" },
  { label: "Islamic Center", url: "https://www.youtube.com/@TheIslamicCenter", note: "مركز إسلامي" },
  { label: "Aqedah", url: "https://www.youtube.com/@Aqeedah", note: "العقيدة" },
  { label: "Shaykh Muhammad Yahya", url: "https://www.youtube.com/@MuhammadYahya", note: "خطيب" },

  /* ------------------------------------------------------- قرآن وتجويد وتلاوة */
  { label: "Mishary Rashid Alafasy", url: "https://www.youtube.com/@MisharyAlafasy", note: "الشيخ مشاري العفاسي" },
  { label: "Abu Bakr Al Shatri", url: "https://www.youtube.com/@AbuBakrAlShatri", note: "أبو بكر الشاطري" },
  { label: "Hani Ar Rifai", url: "https://www.youtube.com/@HaniArRifai", note: "الحاني الرفاعي" },
  { label: "Abdul Basit Abdus Samad", url: "https://www.youtube.com/@AbdulBasitAbdulSamad", note: "عبد الباسط" },
  { label: "Mahmoud Khalil Al-Harasy", url: "https://www.youtube.com/@MahmoudKhalilAlHarasy", note: "محمود خليل الحراسي" },
  { label: "Saood ash-Shuraym", url: "https://www.youtube.com/@SaoodashShuraym", note: "سعود الشريم" },
  { label: "Youssef Abdullah", url: "https://www.youtube.com/@YousefAbdullah", note: "يوسف عبدالله" },
  { label: "Ibrahim Al Akhdar", url: "https://www.youtube.com/@IbrahimAlakhdar", note: "إبراهيم الأخضر" },

  /* ------------------------------------------------------- أطفال ومراهقون */
  { label: "One4Kids", url: "https://www.youtube.com/@One4Kids", note: "أطفال" },
  { label: "Noor Kids", url: "https://www.youtube.com/@NoorKids", note: "أطفال" },
  { label: "Kids Islamic School", url: "https://www.youtube.com/@KidsIslamicSchool", note: "أطفال" },
  { label: "Quran for Kids", url: "https://www.youtube.com/@QuranForKids", note: "قرآن للأطفال" },
  { label: "Little Muslim Kids", url: "https://www.youtube.com/@LittleMuslimKids", note: "أطفال" },
  { label: "Bayyinah Kids", url: "https://www.youtube.com/@BayyinahKids", note: "أطفال" },
  { label: "Learn Islam", url: "https://www.youtube.com/@LearnIslam", note: "أطفال" },
  { label: "Salam Kids", url: "https://www.youtube.com/@SalamKids", note: "أطفال" },
  { label: "Tarteel Kids", url: "https://www.youtube.com/@TarteelKids", note: "أطفال" },
  { label: "Islamic Kids", url: "https://www.youtube.com/@IslamicKids", note: "أطفال" },
  { label: "Kids Learn Islam", url: "https://www.youtube.com/@KidsLearnIslam", note: "أطفال" },
  { label: "Noor Islamic Kids", url: "https://www.youtube.com/@NoorIslamicKids", note: "أطفال" },

  /* ------------------------------------------------------- جهات عربية رسمية */
  { label: "Al-Azhar Al-Sharif", url: "https://www.youtube.com/@AlAzharAlSharif", note: "الأزهر الشريف" },
  { label: "Al-Azhar", url: "https://www.youtube.com/@AlAzhar", note: "الأزهر" },
  { label: "Dar Al-Ifta Al-Masriya", url: "https://www.youtube.com/@DarAlIftaAlMasriya", note: "دار الإفتاء المصرية" },
  { label: "Al-M Complex", url: "https://www.youtube.com/@Alcomplex", note: "مجمع الملك فهد — المصحف المرتل" },
  { label: "King Fahd Complex", url: "https://www.youtube.com/user/kingfahdcomplex", note: "مجمع الملك فهد ل-print القرآن" },
  { label: "Tarteel", url: "https://www.youtube.com/@Tarteel", note: "تطبيق تبارك" },
  { label: "Quran Arabic", url: "https://www.youtube.com/@QuranArabic", note: "قرآن" },
  { label: "Islamic Channel", url: "https://www.youtube.com/@IslamicChannel", note: "قناة إسلامية" },
  { label: "Sheikh Ibn Baz", url: "https://www.youtube.com/@IbnBaz", note: "شيخ ابن باز" },
  { label: "Sheikh Ibn Uthaymeen", url: "https://www.youtube.com/@IbnUthaymeen", note: "شيخ ابن عثيمين" },
  { label: "Al Muntada", url: "https://www.youtube.com/@AlMuntada", note: "المنتدى" },
  { label: "Saeed Ali", url: "https://www.youtube.com/@SaeedAli", note: "دعوة" },
  { label: "Madina Quran", url: "https://www.youtube.com/@MadinaQuran", note: "قرآن" },
  { label: "Noor Quran", url: "https://www.youtube.com/@NoorQuran", note: "قرآن" },
  { label: "Al Quran Al Kareem", url: "https://www.youtube.com/@AlQuranAlKareem", note: "قرآن كريم" },
  { label: "Islamic Reminder", url: "https://www.youtube.com/@IslamicReminder", note: "تذكير" },
  { label: "Muslim Reminder", url: "https://www.youtube.com/@MuslimReminder", note: "تذكير مسلم" },
  { label: "Quran Recitations", url: "https://www.youtube.com/@QuranRecitations", note: "تلاوات" },
  { label: "Kids Arabic Islam", url: "https://www.youtube.com/@KidsArabicIslam", note: "أطفال بالعربية" },
  { label: "Quran Kids Arabic", url: "https://www.youtube.com/@QuranKidsArabic", note: "أطفال قرآن بالعربية" },
  { label: "AhlulQuran", url: "https://www.youtube.com/@AhlulQuran", note: "أهل القرآن" },
  { label: "Tadrees", url: "https://www.youtube.com/@Tadrees", note: "تعليم" },
  { label: "Midad", url: "https://www.youtube.com/@Midad", note: "منصة مِداد" },
  { label: "Bayan Al Islam", url: "https://www.youtube.com/@BayanAlIslam", note: "بيان الإسلام" },
  { label: "Al Baqiah", url: "https://www.youtube.com/@AlBaqiah", note: ".Reminder" },
  { label: "Huda TV", url: "https://www.youtube.com/@HudaTV", note: "تعليم" },
  { label: "Sabeel", url: "https://www.youtube.com/@Sabeel", note: "طريق" },
  { label: "Noor TV", url: "https://www.youtube.com/@NoorTV", note: "نور" },
];

/**
 * استعلامات الاكتشاف بالاسم.
 *
 * حين يخطئ تخمين الـhandle، يظهر هنا الاسم الصحيح في ردّ YouTube نفسه:
 * الاسم والمعرّف والم.description المختصر وشارة التحقق. فلا يُكتب في البيانات
 * إلا ما رجع من هنا ثم يثبت فحص `--data` أنه حيّ.
 *
 * @type {string[]}
 */
export const SEARCHES = [
  /* ------------------------------------------------------- إنجليزية: جهات ودروس */
  "Omar Suleiman official channel",
  "Nouman Ali Khan official",
  "Mufti Menk official channel",
  "Quran Central official",
  "OnePath Network",
  "Learn with Zakaria",
  "Just One Muslim Abdul Rahman",
  "Saudi Islamic TV Assim Al Hakeem",
  "Muhammad Al Ninowy official",
  "Muhammad Alshareef official",
  "The Muslim Skeptic",
  "Mohamed Ghilan official",
  "Tarteel app official",
  "Bayyinah Institute official",
  "Shaykh Assim Al Hakeem official",
  "FreeQuranEducation official",
  "Shaykh Muhammad Alshareef official",
  "Deen Radio official",
  "Yasir Qadhi official channel",

  /* --------------------------------------------------------- إنجليزية: أطفال */
  "One4Kids Islamic kids",
  "Noor Kids Islamic stories for kids",
  "Bayyinah Kids Islamic",
  "Quran for kids Islamic english",
  "Islamic stories for kids english",
  "Kids Islamic School channel",
  "Islamic kids academy youtube",
  "noor islamic kids channel",
  "Learn with Zakaria kids islamic",

  /* ------------------------------------------------------ إنجليزية: قرآن وتلاوة */
  "Mishary Rashid Alafasy official channel",
  "Saood ash Shuraym official channel",
  "Abdul Basit Abdus Samad official channel",
  "Abu Bakr Al Shatri recitation",
  "Mahmoud Khalil Al Harasy official",
  "Hani Ar Rifai official channel",
  "Quran memorization for kids islamic",
  "Learn Quranic Arabic official",
  "Tajweed rules english official channel",

  /* ------------------------------------------------------------- جهات عربية */
  "الأزهر الشريف قناة يوتيوب",
  "دار الإفتاء المصرية قناة يوتيوب",
  "مجمع الملك فهد لطباعة المصحف الشريف قناة",
  "الشيخ ابن باز قناة يوتيوب",
  "الشيخ ابن عثيمين قناة يوتيوب",
  "الشيخ محمد بن عبد الرحمن آل الشيخ قناة",
  "الشيخ عبد الرحمن بن ناصر البراك",
  "الشيخ صالح بن عبد الله الشيخ",

  /* ------------------------------------------------------- قرآن وتجويد عرب */
  "المصحف المرتل قناة مشاري العفاسي",
  "أبو بكر الشاطري قناة تلاوة",
  "محمد صديق المنشاوي قناة تلاوة",
  "سورة البقرة كاملة تلاوة مرتلة",
  "إسلام ويب قناة يوتيوب",
  "قناة إسلام ويب",
  "قناة نبراس للعلوم الشرعية",
  "قناة شرح حديث",

  /* ------------------------------------------------------------- أطفال عرب */
  "قرآن كريم للأطفال تلوين",
  "قصص إسلامية للأطفال قناة",
  "أدعية للأطفال قرآن قناة",
  "أناشيد إسلامية للأطفال",
  "تعليم الصلاة للأطفال قناة",
  "براعم ترتيل للأطفال",
  "تربية إسلامية للأطفال قناة",
  "أخلاق الأطفال إسلام قناة",
  "موقع kids islamic بالعربية",
  "جميع سنن الفطر",

  /* ------------------------------------------- أسئلة وشبهات ومحاضرات وفتاوى */
  "Shaykh Muhammad Alshareef doubts",
  "Ask Quran Islam official channel",
  "محاضرات دروس إسلامية قناة",
  "فتاوى دار الإفتاء المصرية يوتيوب",
  "خطيب ومحاضر إسلامي يوتيوب",
];
