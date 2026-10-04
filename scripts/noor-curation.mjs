/**
 * قائمة انتقاء محتوى «رفيق النور» — مصدر البناء الوحيد.
 *
 * لماذا هذا الملف؟
 *   نصّ القرآن والحديث والأذكار لا يُكتب ولا يُولَّد، بل يُؤخذ من مواضعه
 *   الموثوقة داخل المشروع. لذلك يبقى كل نصّ إمّا مستخرجًا برمجيًّا من
 *   `vendor/quran-arabic.json` أو من وحدات البيانات `src/data/*.js`، وإمّا
 *   مكتوبًا هنا بوضوح على أنه «عبرة» أو «عمل عملي» من إعدادنا، لا يُنسب
 *   إلى النبي ﷺ ولا إلى كتابٍ ولا إلى مفسّر.
 *
 * ما لا يُنسَب إلى أحد:
 *   reflections / actions — تأليف تحريري: شرح تعليمي أو اقتراح عمل،
 *   يُوسم `origin: "editorial"` فلا يُقدَّم على أنه شرع ولا على أنه كلام
 *   النبي ﷺ.
 *
 * ما يُنسَب إلى مصدره:
 *   verses / hadith / dhikr / dua / stories / lessons — تُنسب بسطرها
 *   ومصدرها، ويشترط وجود `source` وإلا رفض البناء.
 *
 * لإضافة عنصر: عدّل هنا ثم نفّذ `npm run build:noor`.
 */

/* -------------------------------------------------------------------------
 * 1) موضوع كل آية:  "سورة:آية"  ->  قائمة الموضوعات.
 *    تُبنى آيات المستودع آليًّا من مفاتيح هذه الخريطة، فلا يمكن أن تنتقي
 *    آية بلا موضوع ولا موضوع لآية غير مختارة.
 *    لا يُكتب نصّ الآية هنا: يُستخرج حرفيًّا من vendor/quran-arabic.json.
 * ---------------------------------------------------------------------- */
export const VERSE_TOPICS = {
  "2:152": ["dhikr"],
  "2:153": ["patience"],
  "2:155": ["patience"],
  "2:156": ["patience"],
  "2:163": ["tawheed"],
  "2:186": ["dua"],
  "2:196": ["hajj"],
  "2:197": ["hajj"],
  "2:222": ["tawbah"],
  "2:238": ["salah"],
  "2:255": ["tawheed"],
  "2:261": ["charity"],
  "2:267": ["charity"],
  "2:271": ["charity"],
  "3:2": ["tawheed"],
  "3:8": ["dua"],
  "3:18": ["tawheed"],
  "3:31": ["seerah"],
  "3:41": ["dhikr"],
  "3:53": ["dua"],
  "3:102": ["taqwa"],
  "3:134": ["tawbah"],
  "3:185": ["akhrat"],
  "3:200": ["patience"],
  "4:32": ["quran"],
  "4:59": ["justice"],
  "4:103": ["salah"],
  "5:8": ["justice"],
  "5:82": ["quran"],
  "7:88": ["dhikr"],
  "7:137": ["quds"],
  "7:204": ["quran"],
  "8:46": ["patience"],
  "9:18": ["quran", "knowledge"],
  "9:118": ["tawbah"],
  "10:87": ["salah"],
  "11:6": ["rizq"],
  "12:9": ["quds"],
  "12:10": ["quds"],
  "12:27": ["quds"],
  "12:28": ["quds"],
  "12:51": ["quds"],
  "12:55": ["quds"],
  "12:83": ["patience"],
  "12:87": ["quds"],
  "12:90": ["quds", "khutbah"],
  "12:100": ["tawbah"],
  "12:109": ["quran"],
  "13:28": ["dhikr"],
  "13:43": ["patience"],
  "14:41": ["parents"],
  "15:26": ["time"],
  "15:97": ["quran", "knowledge"],
  "16:90": ["taqwa"],
  "16:97": ["taqwa"],
  "17:23": ["parents"],
  "17:24": ["parents"],
  "17:88": ["quran"],
  "19:58": ["akhlaq"],
  "20:8": ["tawheed"],
  "20:14": ["salah"],
  "20:114": ["quran"],
  "21:7": ["seerah"],
  "21:8": ["quds"],
  "21:9": ["quds"],
  "21:87": ["dua"],
  "21:107": ["akhlaq"],
  "22:27": ["taqwa"],
  "24:1": ["quran"],
  "24:35": ["quran"],
  "24:36": ["dhikr"],
  "24:37": ["salah"],
  "25:20": ["tawbah"],
  "25:63": ["akhlaq", "seerah"],
  "25:70": ["tawbah"],
  "29:45": ["salah"],
  "29:60": ["rizq"],
  "29:69": ["rizq"],
  "31:14": ["parents"],
  "31:15": ["parents"],
  "31:22": ["akhlaq"],
  "33:21": ["seerah", "khutbah"],
  "33:56": ["salah"],
  "38:29": ["dhikr"],
  "39:10": ["patience"],
  "39:53": ["tawbah"],
  "40:7": ["tawheed"],
  "40:60": ["dua"],
  "42:25": ["tawbah"],
  "42:40": ["akhlaq"],
  "46:15": ["parents"],
  "49:11": ["akhlaq", "khutbah"],
  "49:13": ["taqwa"],
  "49:15": ["quran", "knowledge"],
  "51:22": ["rizq"],
  "55:26": ["time"],
  "56:79": ["quran"],
  "57:20": ["charity"],
  "57:25": ["justice"],
  "58:11": ["quran", "khutbah", "knowledge"],
  "59:7": ["obedience"],
  "59:22": ["tawheed"],
  "62:10": ["salah"],
  "64:17": ["charity"],
  "65:2": ["rizq"],
  "65:3": ["rizq"],
  "66:8": ["tawbah"],
  "68:48": ["dua"],
  "73:20": ["salah"],
  "89:1": ["time"],
  "89:2": ["time"],
  "89:3": ["time"],
  "93:3": ["dua"],
  "94:5": ["patience"],
  "94:6": ["patience"],
  "97:1": ["qadr"],
  "102:1": ["time"],
  "102:2": ["time"],
  "103:1": ["charity"],
  "103:2": ["charity"],
  "103:3": ["charity"],
  "105:1": ["protection"],
  "108:2": ["dua"],
  "112:1": ["tawheed"],
  "112:2": ["tawheed"],
  "112:3": ["tawheed"],
  "112:4": ["tawheed"],
  "113:1": ["protection"],
  "114:1": ["protection"],
};

/* -------------------------------------------------------------------------
 * 2) ربط السور بالموضوعات: عند إتمام المستخدم سورة تُختار مادة التدبر
 *    من هذه الموضوعات. أرقام السور مستخرجة من `content/surahs.json`.
 * ---------------------------------------------------------------------- */
export const SURAH_TOPICS = {
  2: ["tawheed", "patience", "charity"],
  3: ["tawheed", "tawbah", "dua", "obedience"],
  4: ["justice", "charity", "salah"],
  5: ["justice", "quran"],
  7: ["quds", "quran", "tawheed"],
  11: ["quds", "patience"],
  12: ["quds", "patience", "justice", "tawbah"],
  13: ["dhikr", "patience"],
  14: ["quds", "dua"],
  16: ["akhlaq", "taqwa", "tawheed"],
  17: ["quran", "parents"],
  19: ["akhlaq", "quds"],
  20: ["tawheed", "salah", "quran", "seerah"],
  21: ["quds", "akhlaq", "seerah"],
  22: ["hajj"],
  24: ["dhikr", "quran"],
  25: ["tawbah", "quds", "akhrat"],
  29: ["rizq", "quds"],
  31: ["parents", "akhlaq"],
  33: ["salah", "seerah", "obedience"],
  38: ["dhikr", "tawbah"],
  39: ["tawbah", "justice", "rizq"],
  40: ["dua", "tawheed"],
  42: ["akhlaq", "justice"],
  46: ["quds", "parents"],
  49: ["akhlaq", "quran", "khutbah"],
  51: ["rizq", "tawheed"],
  55: ["dhikr", "knowledge", "time"],
  56: ["quran"],
  57: ["tawheed", "charity"],
  58: ["quran", "akhlaq", "khutbah"],
  59: ["obedience", "tawheed"],
  62: ["time", "salah"],
  64: ["charity", "khutbah"],
  65: ["rizq", "taqwa"],
  66: ["tawbah"],
  67: ["tawheed", "taqwa", "time"],
  68: ["time", "dua", "akhrat"],
  71: ["quds"],
  73: ["quran", "salah"],
  89: ["time", "patience"],
  93: ["dua"],
  94: ["patience"],
  97: ["qadr"],
  102: ["time"],
  103: ["time", "charity"],
  104: ["akhlaq"],
  105: ["protection"],
  108: ["dua"],
  112: ["tawheed"],
  113: ["protection"],
  114: ["protection"],
};

/* -------------------------------------------------------------------------
 * 4) العبَر: تأليف تحريري يشرح معنى الآية في جملة أو جملتين، لا يُنسب إلى
 *    مفسّر. حقل `about` هو مرجع الآية التي يشرحها، فيربطه المحرّك بها.
 * ---------------------------------------------------------------------- */
export const REFLECTIONS = [
  { id: "rf_001", topic: "patience", about: "94:5", title: "اليُسر مع العُسر",
    text: "المؤمن لا ينتظر أن ينكشف عنه الشدة قبل أن يعمل، بل يعمل وهو في العسر نفسه، لأن الفرج يأتي في جواره لا بعده بمدة طويلة." },
  { id: "rf_002", topic: "patience", about: "2:153", title: "الصبر عمل لا حال",
    text: "قرنت الآية الصبر بالصلاة والاستعانة به، فجعلته عملا يعين عليه الدعاء والصلاة، لا مزاجا ينتظر فيه." },
  { id: "rf_003", topic: "patience", about: "8:46", title: "مع الصابرين",
    text: "حين قال الله إن مع الصابرين لم يقل إن مع المحتسبين فقط، فكل من صبر وهو يعلم أن الله معه فهو من الصابرين." },
  { id: "rf_004", topic: "patience", about: "12:83", title: "جميلا لا غاضبا",
    text: "الصبر الجميل هو الذي يحفظ فيه الإنسان إيمانه ولسانه معا، فلا ينفجر فيغضب ولا ينسحق فييأس." },
  { id: "rf_005", topic: "patience", about: "2:155", title: "بلاء ثم عطاء",
    text: "أخبر الله عباده في الآية أن البأس والضراء والكرب ستمر، وأن بعدها الخير، فلا يحزن من لم ير بعد." },
  { id: "rf_006", topic: "quran", about: "17:88", title: "اقرأ ثم اعمل",
    text: "أمر الله نبيه صلى الله عليه وسلم أن يقرأ القرآن ولم يكتف بذلك، بل جعل القراءة سببا لشيء آخر، فمن يقرأ ويتوقف عند الحرف لا ينال المقصود." },
  { id: "rf_007", topic: "quran", about: "7:204", title: "مبارك ليتدبر",
    text: "وصف القرآن بأنه مبارك، ووصف أهله بأنهم يتفكرون فيه، فالمنفعة الحقيقية هي ما يستفاد منه في العمل." },
  { id: "rf_008", topic: "quran", about: "20:114", title: "زدني علما",
    text: "دعاء نبينا صلى الله عليه وسلم زدني علما دعاء بزيادة، أي بأن يجد في علمه ما ينفعه بعد ما وجد، لا بأن يتوقف عند أول ما وجد." },
  { id: "rf_009", topic: "quran", about: "56:79", title: "لا يمسه إلا المطهرون",
    text: "قيل في تفسير ذلك: لا يتلى القرآن إلا قلب نقي، فيكون صفاء القلب شرطا في الأجر لا مجرد نظافة اليد." },
  { id: "rf_010", topic: "dhikr", about: "13:28", title: "الذكر طمأنينة",
    text: "جعلت الآية طمأنينة القلب اسما لذكر الله، فكل قلق لا يزول بالذكر فهو قلب معلّق بغير الله." },
  { id: "rf_011", topic: "dhikr", about: "2:152", title: "كثيرا",
    text: "أمر الله بذكره كثيرا ولم يكتف بحساب، لأن القلوب تحتاج تجديدا متكررا لا جرعة واحدة في العمر." },
  { id: "rf_012", topic: "dhikr", about: "24:36", title: "بيوت تذكر",
    text: "وصف الله بيوت المؤمنين بأنها أذن الله أن ترفع فيها ذكره، فبيت لا يذكر فيه الله إلا استثناء لا يستحق الوصف." },
  { id: "rf_013", topic: "dua", about: "2:186", title: "قريب يجاب",
    text: "جاء الجواب في الآية نفسها قبل السؤال فإني قريب، فليحسن السؤال ممن يعلم أنه ليس ممن يُعرض عنه." },
  { id: "rf_014", topic: "dua", about: "3:8", title: "لا تزغ قلوبنا",
    text: "دعاء نبينا صلى الله عليه وسلم في آخر البقرة لم يسأل الثبات على الهدى وحده، بل أن لا تزاغ القلوب بعد الهدى." },
  { id: "rf_015", topic: "tawbah", about: "39:53", title: "لا تقنطوا",
    text: "جاء النهي عن اليأس في الآية بعد ذكر الذنوب مباشرة، لأن اليأس أخطر من الذنب نفسه، والباب مفتوح مهما كثر الذنب." },
  { id: "rf_016", topic: "tawbah", about: "66:8", title: "توبة ناصحة",
    text: "وصف الله التوبة إليه بأنها نصح، فلا تقبل توبة لا صدق فيها ولا خلوص منها إلى غير الله." },
  { id: "rf_017", topic: "charity", about: "2:267", title: "في السراء والضراء",
    text: "سمى الله الإنفاق في الرخاء قبل الشدة، والأصعب هو الإنفاق في الرخاء حين لا يضطر إليه أحد." },
  { id: "rf_018", topic: "charity", about: "2:261", title: "مثل الذي ينفق",
    text: "شبه الله المنفق بحبة تلقى في الأرض سبعمائة تعطي سبعمائة، وهي في يد الله لا في يد صاحبها." },
  { id: "rf_019", topic: "charity", about: "64:17", title: "لا تبطلوها",
    text: "الصدقة تبطلها المن والأذى لا قلة المبلغ، ولذلك حذر المتصدق من أن يظن أن قليله لا يقبل." },
  { id: "rf_020", topic: "taqwa", about: "3:102", title: "حق تقاته",
    text: "أمر الله بالتقوى وبيّن أنها تؤخذ حقا لا جزئيا، ولذلك ربطها في الآية بحكمه على الذين أعرضوا." },
  { id: "rf_021", topic: "akhlaq", about: "49:13", title: "أكرمكم أتقاكم",
    text: "جعل الله معيار شرف الإنسان تقواه لا ماله ولا نسبه، وهي معيار لا ينال إلا بالعمل." },
  { id: "rf_022", topic: "akhlaq", about: "49:11", title: "لا يسخر قوم من قوم",
    text: "نهاى الله السخرية من القوم بعضهم من بعض ولم يستثن أحدا، لأن السخرية جرح يظلم صاحبه قبل أن يصل." },
  { id: "rf_023", topic: "parents", about: "17:23", title: "رحمة تقطع",
    text: "حرم الله قطع رحمة الوالدين، فمن أضاف إلى والديه ضرا فقد خالف أمر خالقه لهما." },
  { id: "rf_024", topic: "parents", about: "31:14", title: "إحسانا ووقوفا",
    text: "لم يكتف الله بالأمر بالإحسان للوالدين، بل أمر بالاستغفار لهما في صلاتك، فالوالدان أمانة إلهية." },
  { id: "rf_025", topic: "time", about: "103:1", title: "والعصر",
    text: "قسم الله بالزمان، والزمان يمضي ولا يوقف، فمن وفّر عمره لا وجد إلا ذكرا نافعا." },
  { id: "rf_026", topic: "time", about: "62:10", title: "عند رجال",
    text: "لم يقل عند دوركم بل عند رجال، والتحذير من الغفلة عن الصلاة بين الأذان والإقامة." },
  { id: "rf_027", topic: "rizq", about: "65:3", title: "مخرجا ورزقا",
    text: "من اتقى الله جعل له مخرجا ورزقه، والرزق عند الله لا يضمن لأحد بأسباب، لكنه مضمون لمن اتقى." },
  { id: "rf_028", topic: "quds", about: "12:87", title: "لا تيأسوا",
    text: "نهاه يوسف قومه أن ييأسوا من روح الله، واليأس لا يقع إلا في قلب يظن أن التدبير بيده." },
  { id: "rf_029", topic: "quds", about: "12:100", title: "نزعة تترك",
    text: "رأى يوسف في قصر فرعون ما يخافه على نفسه فتركه، فترك ما يشبهه اختارا عليه الزنزهة." },
  { id: "rf_030", topic: "seerah", about: "33:21", title: "في رسول الله أسوة",
    text: "أوجبت الآية على المؤمن أن يتأسى برسول الله صلى الله عليه وسلم في الخلق لا في شيء آخر." },
  { id: "rf_031", topic: "salah", about: "29:45", title: "الصلاة مانع ومعين",
    text: "قرن الله بين الأمرين: تنهى عن الفحشاء والمنكر، وتعين على الخير، فهي لا تمنع فقط بل تدفع إلى ما هو خير." },
  { id: "rf_032", topic: "justice", about: "4:59", title: "أطيعوا الله وأطيعوا الرسول",
    text: "أوجبت الآية أداء الأمانات إلى أهلها، فالإهمال في حق الله كالإهمال في حق الناس." },
  { id: "rf_033", topic: "akhrat", about: "25:20", title: "عذاب الآخرة",
    text: "ذكّر الله عباده بالعاقبة حين دعتهم دنياهم، فمن غلبته الدنيا على قلبه لم ينل ما وُعد به." },
  { id: "rf_034", topic: "obedience", about: "21:107", title: "لا تخالفوا في المعروف",
    text: "قال لهم ما أريد أن أخالفكم إلى ما أنهاكم عنه، فطاعة الأدنى في المعروف لا تعني طاعة الله في المعروف." },
];

/* -------------------------------------------------------------------------
 * 5) الأعمال العملية: اقتراحات يومية اختيارية. لا تقدم على أنها شرع،
 *    ولا تجبر المستخدم عليها، ولا تدخل في حساب ولا تنسب لها نقاط.
 * ---------------------------------------------------------------------- */
export const ACTIONS = [
  { id: "ac_001", text: "سامح إنسانا أذاك ثم قل له كلمة طيبة", topic: "akhlaq" },
  { id: "ac_002", text: "تصدق ولو بالقليل", topic: "charity" },
  { id: "ac_003", text: "اتصل بوالديك ولو بثلاث كلمات", topic: "parents" },
  { id: "ac_004", text: "اقرأ صفحة إضافية من المصحف", topic: "quran" },
  { id: "ac_005", text: "استغفر الله عشرا", topic: "tawbah" },
  { id: "ac_006", text: "صل على النبي صلى الله عليه وسلم", topic: "dua" },
  { id: "ac_007", text: "ساعد محتاجا ولو بمشورة", topic: "charity" },
  { id: "ac_008", text: "أصلح بين متخاصمين بكلمة واحدة", topic: "akhlaq" },
  { id: "ac_009", text: "اذكر الله بعد صلاتك", topic: "dhikr" },
  { id: "ac_010", text: "استغفار عند النوم، فإنها إجابة دعوة", topic: "tawbah" },
  { id: "ac_011", text: "اصبر على أمر يضايقك ولا ترد الإساءة بالإساءة", topic: "patience" },
  { id: "ac_012", text: "اتق الله حيثما كنت: أتم عملك ولو وحدك", topic: "taqwa" },
  { id: "ac_013", text: "هيئ مكانا للقرآن قبل النوم", topic: "quran" },
  { id: "ac_014", text: "اكتب ملاحظة على آية توقفت عندها", topic: "quran" },
  { id: "ac_015", text: "ادع الله رافع يديك بعد الصلاة", topic: "dua" },
  { id: "ac_016", text: "احترس من الكلام الذي لا يفيد", topic: "akhlaq" },
  { id: "ac_017", text: "ادع الله بعين واحدة تشغل قلبك", topic: "dua" },
  { id: "ac_018", text: "أخرج زكاة مال مستحق ولو يسيرا", topic: "charity" },
  { id: "ac_019", text: "ادع لأخيك بظهر الغيب", topic: "akhlaq" },
  { id: "ac_020", text: "اقرأ سورة الملك ولو آية واحدة", topic: "quran" },
  { id: "ac_021", text: "تابع وردك اليومي ولو ركعة واحدة", topic: "salah" },
  { id: "ac_022", text: "اتق معصية تكررها وأتركها اليوم", topic: "taqwa" },
];

/* -------------------------------------------------------------------------
 * 6) توجيه الصفحات: أي الموضوعات تُعرض في أي صفحة.
 *    `match` أنماط اسم الملف، والمطابقة جزئية ليشتغل مع `reader.html`
 *    ومن داخل `src/app/` و`src/site/`.
 * ---------------------------------------------------------------------- */
export const PAGE_ROUTES = [
  { match: ["30-quran-full", "quran", "reader", "17-wird", "34-khatma", "35-tafsir", "43-siraj", "2-mushaf"],
    page: "quran", feature: "reading", topics: ["quran"] },
  { match: ["1-adhkar", "25-azkar", "15-tasbeeh", "20-voice", "36-hisn"],
    page: "azkar", feature: "dhikr", topics: ["dhikr"] },
  { match: ["4-salah", "26-daily-system", "18-qada", "42-athan", "24-ibadat"],
    page: "prayer", feature: "salah", topics: ["salah"] },
  { match: ["29-prayer-times", "28-hijri"],
    page: "prayer", feature: "times", topics: ["salah", "time"] },
  /* القبلة مسألة اتجاهٍ في الصلاة لا مسألة وقت، فبقيت مع الصلاة وحدها.
     كان ربطها مع مواقيت الصلاة فيعطي آيةً واحدة للصفحتين دائمًا. */
  { match: ["22-qibla"],
    page: "prayer", feature: "qibla", topics: ["salah"] },
  { match: ["10-zakat"],
    page: "zakat", feature: "zakah", topics: ["charity", "khutbah"] },
  { match: ["3-arbaeen", "12-mustajab", "44-noor-companion"],
    page: "dua", feature: "invocation", topics: ["dua"] },
  { match: ["9-seerah", "6-munasabat", "39-tarikh", "38-khutbah"],
    page: "seerah", feature: "history", topics: ["seerah", "khutbah"] },
  { match: ["8-qasas-anbiya"],
    page: "stories", feature: "prophets", topics: ["quds"] },
  { match: ["5-asmaulhusna"],
    page: "names", feature: "tawheed", topics: ["tawheed"] },
  { match: ["27-hadith"],
    page: "hadith", feature: "hadith", topics: ["knowledge"] },
  { match: ["11-hajj-umrah"],
    page: "hajj", feature: "hajj", topics: ["hajj"] },
  { match: ["7-ramadan"],
    page: "ramadan", feature: "fasting", topics: ["taqwa", "time"] },
  { match: ["13-kids-adab", "19-adab-ziyara", "14-mawarith", "23-search", "41-quiz", "40-reciters", "32-radio", "21-sites", "37-fatwa", "33-academy", "31-card-maker"],
    page: "learn", feature: "library", topics: ["knowledge", "akhlaq"] },
  { match: ["16-tadabbur"],
    page: "quran", feature: "tadabbur", topics: ["quran"] },
  { match: ["index"],
    page: "home", feature: "hub", topics: ["dhikr", "khutbah"] },
];

/* -------------------------------------------------------------------------
 * 7) التحقق: لا موضوع بلا آية، ولا آية بلا موضوع، ولا اسم موضوع مجهول.
 * ---------------------------------------------------------------------- */
export function assertTopicNamesAreKnown(extraTopics) {
  const known = new Set([
    ...Object.keys(VERSE_TOPICS).flatMap((k) => VERSE_TOPICS[k]),
    ...extraTopics,
  ]);
  const used = new Set([
    ...Object.keys(SURAH_TOPICS).flatMap((k) => SURAH_TOPICS[k]),
    ...PAGE_ROUTES.flatMap((r) => r.topics),
    ...REFLECTIONS.map((r) => r.topic),
    ...ACTIONS.map((a) => a.topic),
  ]);
  return [...used].filter((t) => !known.has(t));
}

/* -------------------------------------------------------------------------
 * 8) فحوص الانتقاء: تمنع بناءً فيه آية بلا موضوع أو آية مكررة.
 * ---------------------------------------------------------------------- */
export function assertCurationSanity(verseKeys) {
  const problems = [];
  const seen = new Set();
  for (const key of verseKeys) {
    if (seen.has(key)) problems.push(`verse picked twice: ${key}`);
    seen.add(key);
    if (!VERSE_TOPICS[key]) problems.push(`verse without topic: ${key}`);
  }
  for (const key of Object.keys(VERSE_TOPICS)) {
    if (!seen.has(key)) problems.push(`topic without verse: ${key}`);
  }
  return problems;
}