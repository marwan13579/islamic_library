/**
 * محطات البث التي فُحصت واحدًا واحدًا، فهي مقدَّمةٌ في صفحة القرّاء والتلاوة.
 *
 * بقية الإذاعات في `content/radio.json` (١٧٦ محطة) تُعرض تحتها، وهذا ما
 * يُقدَّم أولًا: خوادم البث تخفت أحيانًا، فالمحطة التي ثبتت عملها اليوم
 * خيرٌ من المحطة الأجمل في الورق.
 *
 * يفحصها `npm run check:streams`، فما ثبت موته يُحذف هنا أو يُصحَّح رابطه.
 * @module data/radio-live
 */

/** @typedef {{ name: string, link: string, category: string }} LiveStation */

/** @type {LiveStation[]} */
export const LIVE_STATIONS = [
  { name: "الشيخ محمد صديق المنشاوي", link: "https://qurango.net/radio/mohammed_siddiq_alminshawi", category: "إذاعات القراء" },
  { name: "الشيخ محمود خليل الحصري", link: "https://qurango.net/radio/mahmoud_khalil_alhussary", category: "إذاعات القراء" },
  { name: "الشيخ مصطفى إسماعيل", link: "https://qurango.net/radio/mustafa_ismail", category: "إذاعات القراء" },
  { name: "الشيخ ماهر المعيقلي", link: "https://qurango.net/radio/maher_al_muaiqly", category: "إذاعات القراء" },
  { name: "الشيخ سعود الشريم", link: "https://qurango.net/radio/saud_alshuraim", category: "إذاعات القراء" },
  { name: "إذاعة التفسير", link: "https://qurango.net/radio/tafseer", category: "تفسير وعلوم القرآن" },
  { name: "إذاعة الرقية الشرعية", link: "https://qurango.net/radio/roqiah", category: "أذكار ورقية" },
  { name: "الشيخ محمود علي البنا", link: "https://stream.zeno.fm/pyc8kax6f2zuv", category: "إذاعات القراء" },
  { name: "الشيخ فارس عباد", link: "https://server.emancity.com:9994/stream", category: "تفسير وعلوم القرآن" },
];