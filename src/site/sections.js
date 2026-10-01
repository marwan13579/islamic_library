/**
 * تعريف أقسام موقع «نور الهدى» — مصدر واحد يغذّي الهيدر والفهرس والـ SPA.
 * @module site/sections
 */

/** @typedef {{ id: string, title: string, icon: string, blurb: string }} SectionDef */

/** @type {SectionDef[]} */
export const SECTIONS = [
  { id: "home", title: "الرئيسية", icon: "i-book", blurb: "تعلَّمْ أحكامَ دينِك" },
  { id: "manhaj", title: "منهج سلف الأمة", icon: "i-book", blurb: "مقدمة منهجية مفصّلة" },
  { id: "scholars", title: "أعلام السلف", icon: "i-users", blurb: "من.grid قابل للبحث" },
  { id: "sayings", title: "أقوال السلف", icon: "i-sparkle", blurb: "من اقتباسات" },
  { id: "sections", title: "الدروس الفقهية", icon: "i-mosque", blurb: "تسعة دروس" },
  { id: "seerah", title: "السيرة النبوية", icon: "i-history", blurb: "محطات مرتّبة زمنيًا" },
  { id: "prophets", title: "قصص الأنبياء", icon: "i-star", blurb: "مع البحث" },
  { id: "duas", title: "أدعية المناسبات", icon: "i-beads", blurb: "أدعية مصنّفة" },
  { id: "names", title: "أسماء الله الحسنى", icon: "i-star", blurb: "بحث فوري" },
  { id: "adhkar", title: "الأذكار", icon: "i-beads", blurb: "الصباح والمساء" },
  { id: "kids", title: "ركن الأطفال", icon: "i-sparkle", blurb: "مبسّط وتربوي" },
  { id: "tools", title: "أدوات إسلامية", icon: "i-qibla", blurb: "القبلة والمواقيت" },
  { id: "quiz", title: "الاختبارات", icon: "i-quiz", blurb: "بنك الأسئلة وتحدّي الأسبوع" },
  { id: "certs", title: "شهاداتي", icon: "i-check", blurb: "شهادات إتمام تُحفظ عندك" },
  { id: "ask", title: "اسأل سؤالًا", icon: "i-link", blurb: "توجيه ونقل" },
  { id: "qa", title: "أسئلة وأجوبة", icon: "i-lightbulb", blurb: "أسئلة شائعة" },
  { id: "about", title: "عن الموقع", icon: "i-lightbulb", blurb: "منهاجنا ومصادرنا" },
  { id: "privacy", title: "سياسة الخصوصية", icon: "i-shield", blurb: "بياناتك عندك" },
];