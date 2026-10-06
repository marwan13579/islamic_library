/**
 * مسارات التعلم الإسلامية — من المبتدئ إلى المتقدم.
 * كل مسار يحتوي على مستويات ووحدات محلية بدون AI.
 * @module data/learning-paths
 */

export const LEARNING_PATHS = [
  {
    id: "salah",
    title: "مسار تعلم الصلاة",
    icon: "🕌",
    description: "من تعلم الوضوء إلى إتقان الصلاة بشرحها",
    color: "emerald",
    levels: [
      {
        title: "مبتدئ",
        items: [
          { title: "الوضوء الصحيح", url: "24-ibadat.html", type: "lesson" },
          { title: "أركان الصلاة", url: "24-ibadat.html", type: "lesson" },
          { title: "دليل الصلاة خطوة بخطوة", url: "4-salah.html", type: "video" },
        ],
      },
      {
        title: "متوسط",
        items: [
          { title: "سنن الصلاة", url: "24-ibadat.html", type: "lesson" },
          { title: "أذكار بعد الصلاة", url: "25-azkar-shamila.html", type: "dhikr" },
          { title: "صلاة الجماعة", url: "24-ibadat.html", type: "lesson" },
        ],
      },
      {
        title: "متقدم",
        items: [
          { title: "مبطلات الصلاة", url: "24-ibadat.html", type: "lesson" },
          { title: "أحكام السهو", url: "src/site/noor.html#sections", type: "lesson" },
          { title: "صلاة المسافر والمريض", url: "24-ibadat.html", type: "lesson" },
        ],
      },
    ],
  },
  {
    id: "quran",
    title: "مسار تعلم القرآن",
    icon: "📖",
    description: "من تعلم الحروف إلى الختمة والفهم",
    color: "emerald",
    levels: [
      {
        title: "مبتدئ",
        items: [
          { title: "حفظ سورة الفاتحة", url: "30-quran-full.html", type: "quran" },
          { title: "حفظ سور قصيرة", url: "30-quran-full.html", type: "quran" },
          { title: "تجويد المبتدئين", url: "30-quran-full.html", type: "lesson" },
        ],
      },
      {
        title: "متوسط",
        items: [
          { title: "ختم القرآن", url: "2-mushaf.html", type: "quran" },
          { title: "التدبر اليومي", url: "16-tadabbur.html", type: "quran" },
          { title: "الورد اليومي", url: "17-wird.html", type: "quran" },
        ],
      },
      {
        title: "متقدم",
        items: [
          { title: "تفسير السور", url: "35-tafsir.html", type: "quran" },
          { title: "غريب القرآن", url: "43-siraj.html", type: "quran" },
          { title: "الاختبارات القرآنية", url: "41-quiz.html", type: "quiz" },
        ],
      },
    ],
  },
  {
    id: "aqeedah",
    title: "مسار العقيدة",
    icon: "☝️",
    description: "من أساسيات التوحيد إلى عمق الإيمان",
    color: "indigo",
    levels: [
      {
        title: "مبتدئ",
        items: [
          { title: "أركان الإيمان", url: "src/site/noor.html#manhaj", type: "lesson" },
          { title: "أسماء الله الحسنى", url: "5-asmaulhusna.html", type: "lesson" },
          { title: "الفرق بين التوحيد والشرك", url: "src/site/noor.html#manhaj", type: "lesson" },
        ],
      },
      {
        title: "متوسط",
        items: [
          { title: "صفات الله", url: "src/site/noor.html#manhaj", type: "lesson" },
          { title: "الملائكة والكتب", url: "src/site/noor.html#manhaj", type: "lesson" },
          { title: "اليوم الآخر", url: "src/site/noor.html#manhaj", type: "lesson" },
        ],
      },
      {
        title: "متقدم",
        items: [
          { title: "القدر", url: "src/site/noor.html#manhaj", type: "lesson" },
          { title: "النفاق وأسبابه", url: "src/site/noor.html#manhaj", type: "lesson" },
          { title: "اختبار العقيدة", url: "41-quiz.html", type: "quiz" },
        ],
      },
    ],
  },
  {
    id: "fiqh",
    title: "مسار الفقه",
    icon: "⚖️",
    description: "من الطهارة إلى المعاملات والمواريث",
    color: "teal",
    levels: [
      {
        title: "مبتدئ",
        items: [
          { title: "الطهارة والوضوء", url: "24-ibadat.html", type: "lesson" },
          { title: "أحكام الصلاة", url: "24-ibadat.html", type: "lesson" },
          { title: "أحكام الصيام", url: "24-ibadat.html", type: "lesson" },
        ],
      },
      {
        title: "متوسط",
        items: [
          { title: "الزكاة وحساب النصاب", url: "10-zakat.html", type: "calc" },
          { title: "أحكام الحج والعمرة", url: "11-hajj-umrah.html", type: "lesson" },
          { title: "المواريث", url: "14-mawarith.html", type: "calc" },
        ],
      },
      {
        title: "متقدم",
        items: [
          { title: "المعاملات المالية", url: "src/site/noor.html#sections", type: "lesson" },
          { title: "الأسرة والزواج", url: "src/site/noor.html#sections", type: "lesson" },
          { title: "اختبار الفقه", url: "41-quiz.html", type: "quiz" },
        ],
      },
    ],
  },
  {
    id: "seerah",
    title: "مسار السيرة",
    icon: "🕌",
    description: "من المولد إلى الوفاة بخطوات واضحة",
    color: "amber",
    levels: [
      {
        title: "مبتدئ",
        items: [
          { title: "مولد النبي ﷺ", url: "9-seerah.html", type: "story" },
          { title: "بدء الوحي", url: "9-seerah.html", type: "story" },
          { title: "الهجرة", url: "9-seerah.html", type: "story" },
        ],
      },
      {
        title: "متوسط",
        items: [
          { title: "غزوة بدر", url: "9-seerah.html", type: "story" },
          { title: "غزوة أحد", url: "9-seerah.html", type: "story" },
          { title: "الصلح الحديبي", url: "9-seerah.html", type: "story" },
        ],
      },
      {
        title: "متقدم",
        items: [
          { title: "فتح مكة", url: "9-seerah.html", type: "story" },
          { title: "حجة الوداع", url: "9-seerah.html", type: "story" },
          { title: "وفاة النبي ﷺ", url: "9-seerah.html", type: "story" },
        ],
      },
    ],
  },
  {
    id: "adhkar",
    title: "مسار الأذكار",
    icon: "🤲",
    description: "من أذكار الصباح إلى الأذكار اليومية",
    color: "rose",
    levels: [
      {
        title: "مبتدئ",
        items: [
          { title: "أذكار الصباح", url: "25-azkar-shamila.html#sabah", type: "dhikr" },
          { title: "أذكار المساء", url: "25-azkar-shamila.html#masaa", type: "dhikr" },
          { title: "أذكار النوم", url: "25-azkar-shamila.html#nawm", type: "dhikr" },
        ],
      },
      {
        title: "متوسط",
        items: [
          { title: "أذكار بعد الصلاة", url: "25-azkar-shamila.html", type: "dhikr" },
          { title: "أذكار الطعام", url: "25-azkar-shamila.html", type: "dhikr" },
          { title: "أدعية القرآن", url: "25-azkar-shamila.html", type: "dhikr" },
        ],
      },
      {
        title: "متقدم",
        items: [
          { title: "أذكار السفر", url: "25-azkar-shamila.html", type: "dhikr" },
          { title: "أذكار الخوف والكرب", url: "25-azkar-shamila.html", type: "dhikr" },
          { title: "سبحة التسبيح", url: "15-tasbeeh-jamai.html", type: "dhikr" },
        ],
      },
    ],
  },
];

export const PATH_STORAGE_KEY = "learning-paths-progress";

export function getPathProgress(pathId) {
  try {
    const data = JSON.parse(localStorage.getItem(PATH_STORAGE_KEY) || "{}");
    return data[pathId] || {};
  } catch {
    return {};
  }
}

export function updatePathProgress(pathId, levelIndex, itemIndex, completed) {
  try {
    const data = JSON.parse(localStorage.getItem(PATH_STORAGE_KEY) || "{}");
    if (!data[pathId]) data[pathId] = {};
    const key = `${levelIndex}-${itemIndex}`;
    data[pathId][key] = { completed, date: new Date().toISOString() };
    localStorage.setItem(PATH_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // silent fail
  }
}

export function getPathOverallProgress(pathId) {
  const path = LEARNING_PATHS.find((p) => p.id === pathId);
  if (!path) return 0;
  const progress = getPathProgress(pathId);
  let total = 0;
  let done = 0;
  path.levels.forEach((level, li) => {
    level.items.forEach((_, ii) => {
      total++;
      if (progress[`${li}-${ii}`]?.completed) done++;
    });
  });
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
