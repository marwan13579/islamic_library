/**
 * منطق مكتبة الفيديو: البحث والفلترة والاختيار والترقيم.
 *
 * كل ما هنا بعيدٌ عن الـDOM عمدًا، ليُختبَر في node بلا متصفح، ولتبقى
 * الواجهة عرضًا لا قرارًا. من أراد تغيير سلوك المكتبة لا يمسّ الصفحة.
 *
 * البحث عربي حقيقي: يُطبَّع النص (تشكيل، همزات، تاء مربوطة، ألف مقصورة)
 * قبل المطابقة، فيجد «ال trustworthiness» ما كتبه «ال trustworthiness».
 * @module lib/video-library
 */

import { normalizeAr } from "./text.js";
import { CHANNELS, AGE_GROUPS, CATEGORIES, TRUST_LEVELS } from "../data/islamic-channels.js";

/** @typedef {import("../data/islamic-channels.js").Channel} Channel */

/* ------------------------------------------------------------- الاستعلام */

/**
 * حالة البحث والفلترة. الحقول كلها اختيارية.
 * @typedef {object} Query
 * @property {string} [text] نص البحث
 * @property {string} [category] معرّف تصنيف أو "all"
 * @property {string} [age] معرّف فئة عمرية أو "all"
 * @property {string} [language] ar | en | both | all
 * @property {string} [trust] recommended | educational | curated | all
 * @property {boolean} [featuredOnly] المختارات فقط
 * @property {boolean} [favoritesOnly] المفضلة فقط
 * @property {boolean} [includeUnverified] يُستعمل في المراجعة فقط
 */

/** @returns {Query} استعلام فارغ */
export function emptyQuery() {
  return {
    text: "",
    category: "all",
    age: "all",
    language: "all",
    trust: "all",
    featuredOnly: false,
    favoritesOnly: false,
    includeUnverified: false,
  };
}

/* ------------------------------------------------------------- الفهرسة */

/**
 * ما نبحث فيه فعلًا: الاسمان والوصفان والتصنيفات والفئة العمرية
 * والكلمات المفتاحية — لا أكثر، فلا نصيب لقناة أن تُذكر بنصف كلمة.
 * @param {Channel} channel
 * @returns {string} نص مطبَّع
 */
export function searchIndex(channel) {
  const categoryLabels = CATEGORIES.filter((item) => channel.categories.includes(item.id)).map(
    (item) => item.label,
  );
  const ageLabels = AGE_GROUPS.filter((item) => channel.ageGroups.includes(item.id)).map(
    (item) => item.label,
  );
  const trustLabels = TRUST_LEVELS.filter((item) => item.trustLevel === channel.trustLevel).map(
    (item) => item.label,
  );
  return normalizeAr(
    [
      channel.nameAr,
      channel.nameEn,
      channel.descriptionAr,
      channel.descriptionEn ?? "",
      channel.keywords.join(" "),
      categoryLabels.join(" "),
      ageLabels.join(" "),
      trustLabels.join(" "),
    ].join(" "),
  );
}

/**
 * فهرس جاهز للقنوات المعروضة، يُبنى مرة واحدة لا في كل ضغطة مفتاح.
 * لا يدخل الفهرس إلا ما ثبتت رسميته — إلا بطلب صريح من وضع المراجعة.
 * @param {Channel[]} [channels]
 * @param {boolean} [withUnverified] أدرج ما ينتظر التحقق (مراجعة فقط)
 * @returns {{ channel: Channel, index: string }[]}
 */
export function buildIndex(channels = CHANNELS, withUnverified = false) {
  return publishable(channels, withUnverified).map((channel) => ({
    channel,
    index: searchIndex(channel),
  }));
}

/**
 * القنوات التي يجوز عرضها: لها رابط، موثّقة، غير موقوفة.
 * قوائم المراجعة لا تدخل هنا إلا بطلب صريح — وإلا خرج ما لم يثبت
 * رسميةً إلى القارئ.
 * @param {Channel[]} [channels]
 * @param {boolean} [withUnverified] أدرج ما ينتظر المراجعة
 * @returns {Channel[]}
 */
export function publishable(channels = CHANNELS, withUnverified = false) {
  return channels.filter((channel) => {
    if (channel.disabled) return false;
    if (withUnverified) return true;
    return channel.verified && Boolean(channel.youtubeUrl);
  });
}

/* -------------------------------------------------------------- البحث */

/**
 * هل يطابق النص القناة؟ كل كلمات البحث يجب أن ترد (AND)، فالبحث
 * الضيّق أضيق، والعرب يشتكون من بحث يُعطي كل شيء.
 * @param {string} index نص مطبَّع من searchIndex
 * @param {string} needle نص البحث بعد التطبيع
 * @returns {boolean}
 */
export function matchesText(index, needle) {
  const query = normalizeAr(needle);
  if (!query) return true;
  return query.split(" ").every((word) => word.length > 0 && index.includes(word));
}

/* ------------------------------------------------------------- الفلترة */

/**
 * هل تنتمي القناة إلى فئة عمرية؟ «الجميع» يعني مناسب للجميع،
 * ومن اختار فئة بعينها لا يرى ما لم يصرّح بأنه منها.
 * @param {Channel} channel
 * @param {string} age
 * @returns {boolean}
 */
export function matchesAge(channel, age) {
  if (!age || age === "all") return true;
  return channel.ageGroups.includes(/** @type {any} */ (age));
}

/**
 * فلترة اللغة. و«العربية + English» تعني محتوى bilingual فعلًا:
 * إما أن القناة تحمل ["both"]، وإما أنها تنشر بلغتين ["ar","en"].
 * فالقناة العربية التي لها نسخة إنجليزية تُرى تحت الفئتين، لا في واحدة.
 * @param {Channel} channel
 * @param {string} language ar | en | both | all
 * @returns {boolean}
 */
export function matchesLanguage(channel, language) {
  if (!language || language === "all") return true;
  if (language === "both") {
    return channel.language.includes("both") ||
      (channel.language.includes("ar") && channel.language.includes("en"));
  }
  return channel.language.includes(/** @type {any} */ (language));
}

/**
 * @param {Channel} channel
 * @param {string} category
 * @returns {boolean}
 */
export function matchesCategory(channel, category) {
  if (!category || category === "all") return true;
  return channel.categories.includes(category);
}

/**
 * @param {Channel} channel
 * @param {string} trust
 * @returns {boolean}
 */
export function matchesTrust(channel, trust) {
  if (!trust || trust === "all") return true;
  return channel.trustLevel === trust;
}

/**
 * الترتيب: المختارات أولًا، ثم الموصى بها، ثم بالاسم العربي.
 * هكذا لا تختفي القنوات الجيدة في نهاية قائمة.
 * @param {Channel} a
 * @param {Channel} b
 * @returns {number}
 */
export function byRank(a, b) {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  if (a.trustLevel !== b.trustLevel) return a.trustLevel === "recommended" ? -1 : 1;
  return a.nameAr.localeCompare(b.nameAr, "ar");
}

/**
 * ينفّذ الاستعلام على فهرس مبنيّ مسبقًا.
 * @param {{ channel: Channel, index: string }[]} index
 * @param {Query} query
 * @param {Set<string>} [favorites] معرّفات المفضلة
 * @returns {Channel[]}
 */
export function runQuery(index, query, favorites = new Set()) {
  const needle = query.text ?? "";
  return index
    .filter(({ channel, index: text }) => {
      if (query.favoritesOnly && !favorites.has(channel.id)) return false;
      if (query.featuredOnly && !channel.featured) return false;
      if (!matchesText(text, needle)) return false;
      if (!matchesCategory(channel, query.category)) return false;
      if (!matchesAge(channel, query.age)) return false;
      if (!matchesLanguage(channel, query.language)) return false;
      if (!matchesTrust(channel, query.trust)) return false;
      return true;
    })
    .map((entry) => entry.channel)
    .sort(byRank);
}

/* ------------------------------------------------------------ الترقيم */

/** عدد البطاقات في الصفحة الواحدة. */
export const PAGE_SIZE = 12;

/**
 * تقسيم لصفحات: لا نرسم مئة بطاقة دفعةً واحدة — المتصفح وال眼睛 يشكران.
 * الصفحة المطلوبة تُقصّ إلى مجالها وحده، ورقمٌ خارج المدى يُقرَّب
 * إلى أقرب صفحة موجودة، فلا تخرج الواجهة عن-range.
 * @template T
 * @param {T[]} items
 * @param {number} [size]
 * @param {number} [page] رقم الصفحة المطلوب (يبدأ من 1)
 * @returns {{ page: number, pages: number, slice: T[], total: number, hasMore: boolean }}
 */
export function paginate(items, size = PAGE_SIZE, page = 1) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const wanted = Math.floor(Number(page));
  const current = Math.min(Math.max(Number.isFinite(wanted) && wanted > 0 ? wanted : 1, 1), pages);
  return {
    page: current,
    pages,
    slice: items.slice((current - 1) * size, current * size),
    total,
    hasMore: current < pages,
  };
}

/* ------------------------------------------------------------ الاختيار */

/**
 * «شاهد وتعلم»: ثلاثة اقتراحات لا أكثر، من محتوى موثّق لا إيقافه.
 * @param {{ channel: Channel, index: string }[]} index
 * @param {Query} query
 * @param {number} [count]
 * @param {() => number} [random] مصدر العشوائية (للاختبار)
 * @returns {Channel[]}
 */
export function suggestionsFor(index, query, count = 3, random = Math.random) {
  const pool = runQuery(index, { ...emptyQuery(), ...query }).filter(
    (channel) => channel.verified && !channel.disabled,
  );
  return pick(pool, count, random);
}

/**
 * «ماذا أشاهد الآن»: من الموصى بها الموثّقة فقط، بلا تكرار.
 * @param {{ channel: Channel, index: string }[]} index
 * @param {number} [count]
 * @param {() => number} [random]
 * @param {string[]} [exclude] معرّفات مستبعدة
 * @returns {Channel[]}
 */
export function watchNow(index, count = 1, random = Math.random, exclude = []) {
  const pool = runQuery(index, emptyQuery()).filter(
    (channel) => channel.verified && channel.trustLevel === "recommended",
  );
  const fresh = pool.filter((channel) => !exclude.includes(channel.id));
  return pick(fresh.length ? fresh : pool, count, random);
}

/**
 * اختيار بلا تكرار: نختار من آخر الفهرس فيجدنا variety، ثم نخلط.
 * @template T
 * @param {T[]} pool
 * @param {number} count
 * @param {() => number} random
 * @returns {T[]}
 */
export function pick(pool, count, random = Math.random) {
  const remaining = [...pool];
  const out = [];
  while (remaining.length && out.length < count) {
    const index = Math.floor(random() * remaining.length) % remaining.length;
    out.push(remaining.splice(index, 1)[0]);
  }
  return out;
}

/**
 * «مختارات نور الهدى»: لا يدخلها إلا ما ثبتت رسميته وكان موصى به.
 * هذا هو الحارس الذي يمنع قناةً غير موثّقة من الظهور في الواجهة.
 * @param {Channel[]} [channels]
 * @returns {Channel[]}
 */
export function featuredChannels(channels = CHANNELS) {
  return publishable(channels)
    .filter((channel) => channel.featured && channel.trustLevel === "recommended")
    .sort(byRank);
}

/**
 * عدد القنوات لكل خيار فلترة، لبناء أزرار الفلترة بعناوين صادقة.
 * @param {{ channel: Channel, index: string }[]} index
 * @param {Query} query
 * @param {"category" | "age" | "language" | "trust"} facet
 * @returns {Map<string, number>}
 */
export function facetCounts(index, query, facet) {
  const base = runQuery(index, { ...emptyQuery(), ...query });
  const counts = new Map();
  for (const channel of base) {
    const values =
      facet === "category"
        ? channel.categories
        : facet === "age"
          ? channel.ageGroups
          : facet === "language"
            ? channel.language
            : [channel.trustLevel];
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}