/**
 * تحميل محتوى المكتبة المقسّم من `content/`.
 *
 * المحتوى ٢٤٩ ميغابايت فلا يُحمَّل دفعة واحدة. كل شيء هنا يقرأ ملفًا واحدًا
 * عند الحاجة ثم يحتفظ به في الذاكرة، مع دمج الطلبات المتزامنة على الملف نفسه
 * حتى لا يُطلب مرتين عند ضغط المستخدم زرّين معًا.
 *
 * يُبنى المحتوى بـ `scripts/build-content-library.cjs`.
 * @module lib/shards
 */

/** جذر المحتوى على القرص/CDN. */
export const CONTENT_ROOT = "content";

/**
 * @typedef {object} Summary
 * @property {string} id معرّف العنصر
 * @property {string} t النوع: fatwa أو khutbahs أو history أو quiz
 * @property {string} ti العنوان
 * @property {string} su الملخّص
 * @property {string[]} c الفئات
 * @property {string} a المؤلف أو الشيخ
 * @property {string} d التاريخ نصًّا
 * @property {number} r دقائق القراءة
 * @property {0|1} au هل يوجد صوت — ١ إن كان للعنصر تسجيل
 * @property {[number, number]} p موضع العنصر في جزء المحتوى
 */

/** @type {Map<string, Promise<any>>} الطلبات المعلّقة حسب مسار الملف. */
const pending = new Map();

/** @type {Map<string, any>} الملفات المقروءة. */
const cache = new Map();

/** @type {Map<string, {n: number, at: number}>} عدّاد الاستعمال لكل ملف. */
const usage = new Map();

/** @type {Promise<any>|null} */
let manifestPromise = null;

/**
 * يبني مسار ملف داخل جذر المحتوى.
 * @param {...string} parts
 * @returns {string}
 */
function contentPath(...parts) {
  return `${CONTENT_ROOT}/${parts.join("/")}`;
}

/**
 * يقرأ ملف JSON من المحتوى ويخزّنه.
 * الطلب الثاني لنفس الملف ينتظر الأول بدل أن يُنشئ طلبًا جديدًا.
 * @param {string} path مسار نسبي داخل `content/`
 * @returns {Promise<any>}
 */
export function load(path) {
  const hit = cache.get(path);
  if (hit !== undefined) {
    usage.set(path, { n: (usage.get(path)?.n || 0) + 1, at: Date.now() });
    return Promise.resolve(hit);
  }
  const flying = pending.get(path);
  if (flying) return flying;

  const request = fetch(`${CONTENT_ROOT}/${path}`, { cache: "force-cache" })
    .then((res) => {
      if (!res.ok) throw new Error(`تعذّر تحميل ${path} (${res.status})`);
      return res.json();
    })
    .then((data) => {
      cache.set(path, data);
      usage.set(path, { n: 1, at: Date.now() });
      return data;
    })
    .catch((error) => {
      /* تفشل شبكة واحدة كان يُقفل القسم كلَّ الجلسة: نخرج الوعد المرفوض
         من المخزن حتى تُحاول الصفحة التالية من جديد. */
      if (cache.get(path) === undefined) usage.delete(path);
      throw error;
    })
    .finally(() => {
      pending.delete(path);
    });

  pending.set(path, request);
  return request;
}

/** @returns {Promise<any>} بيان المحتوى الإجمالي. */
export function manifest() {
  if (!manifestPromise) {
    manifestPromise = load("manifest.json").catch((error) => {
      manifestPromise = null;
      throw error;
    });
  }
  return manifestPromise;
}

/**
 * @typedef {object} CollectionMeta
 * @property {string} type
 * @property {number} count
 * @property {string[]} listFiles
 * @property {"desc"|"asc"} listOrder اتجاه ترتيب ملفات القوائم: «desc» فالأحدث أولها
 * @property {string[]} itemFiles
 * @property {{name: string, count: number}[]} categories
 */

/** @type {Map<string, Promise<CollectionMeta>>} */
const metaCache = new Map();

/**
 * بيان مجموعة واحدة: عدد عناصرها، ملفاتها، وفئاتها.
 * @param {string} type
 * @returns {Promise<CollectionMeta>}
 */
export function collectionMeta(type) {
  if (!metaCache.has(type)) {
    const request = load(`library/${type}/meta.json`).catch((error) => {
      metaCache.delete(type);
      throw error;
    });
    metaCache.set(type, request);
  }
  return /** @type {Promise<CollectionMeta>} */ (metaCache.get(type));
}

/**
 * صفحة ملخّصات واحدة. القوائم مرتّبة الأحدث أولًا.
 * @param {string} type
 * @param {number} index
 * @returns {Promise<Summary[]>}
 */
export function listShard(type, index) {
  return load(`library/${type}/list/${String(index).padStart(3, "0")}.json`);
}

/**
 * ترتيب عناصر مجموعة في كل فرز، مواضعًا لا نصوصًا.
 *
 * يولّده `scripts/build-order-index.cjs` من القوائم نفسها. وحين يغيب —
 * محتوى بُني قبل إضافته — يعود `null` فيقرأ المتصل القوائم كلها، فتبقى
 * النتيجة صحيحة ويكون الثمن هو التحميل وحده.
 * @param {string} type
 * @returns {Promise<{v: number, type: string, count: number, orders: Record<string, number[]>}|null>}
 */
export function orderIndex(type) {
  return load(`library/${type}/order.json`).catch((error) => {
    /* غياب الفهرس ليس خطأً: يعود المتصل إلى الطريق القديم. */
    if (!/\(404\)|404/.test(String((error && error.message) || ""))) throw error;
    return null;
  });
}

/**
 * جزء محتوى كامل. يُحمَّل عند فتح عنصر فقط.
 * @param {string} type
 * @param {number} index
 * @returns {Promise<any[]>}
 */
export function itemShard(type, index) {
  return load(`library/${type}/items/part-${String(index).padStart(3, "0")}.json`);
}

/** @returns {Promise<any>} فهرس البحث: عدد المستندات ودلاء المصطلحات. */
export function searchManifest() {
  return load("search/manifest.json");
}

/**
 * دلو مصطلحات. الحرف الأول من المصطلح يحدّد الدلو، فإن قسّمه البناءُ
 * بالحرف الثاني فيُؤخذ الجزء الذي يطابق prefix.
 * @param {string} file
 */
export function searchFile(file) {
  return load(`search/${file}`);
}

/**
 * شريحة من بيانات المستندات، ٣٠٠٠ مستند في كل شريحة.
 * @param {number} index
 */
export function searchDocs(index) {
  return load(`search/docs/${String(index).padStart(3, "0")}.json`);
}

/** @returns {Promise<any>} فهرس سور القرآن. */
export function surahIndex() {
  return load("surahs.json");
}

/**
 * تفسير سورة كاملة.
 * @param {number} number من ١ إلى ١١٤
 */
export function tafsirOf(number) {
  return load(`tafsir/sura-${String(number).padStart(3, "0")}.json`);
}

/** @returns {Promise<any>} فهرس أبواب حصن المسلم. */
export function hisnIndex() {
  return load("hisn/index.json");
}

/**
 * باب من حصن المسلم.
 * @param {number} no
 */
export function hisnBab(no) {
  return load(`hisn/bab-${String(no).padStart(3, "0")}.json`);
}

/** @returns {Promise<any>} فهرس سور «السراج في بيان غريب القرآن». */
export function sirajIndex() {
  return load("siraj/index.json");
}

/**
 * غريب سورة بعينها: مدخلاتها بمعانيها، ملف واحد لكل سورة.
 * @param {number} no من ١ إلى ١١٤
 */
export function sirajOf(no) {
  return load(`siraj/sura-${String(no).padStart(3, "0")}.json`);
}

/**
 * دلو كلمات الغريب على أول حرف: بحث «غُلْف» يقرأ دلو «غ» وحده.
 * @param {string} letter حرف واحد بعد التطبيع
 */
export function sirajTerms(letter) {
  return load(`siraj/terms/${letter}.json`);
}

/**
 * مقدمة الكتاب أو خاتمته.
 * @param {"muqaddima"|"khatima"} which
 */
export function sirajFront(which) {
  return load(`siraj/${which}.json`);
}

/** @returns {Promise<any>} القرّاء الـ١٥٨. */
export function reciters() {
  return load("reciters.json");
}

/**
 * الإذاعات.
 *
 * ولا تُعرض إلا ما كان بثًّا آمنًا: الموقع يُقدَّم على `https`، فالمتصفح
 * يمنع مصدر `http` كمحتوى مخلوط فلا يعمل، ولا في صفحة `http` واحدة.
 * والتصفية هنا لا في قائمة البيانات، فمن أعيد بناء المحتوى لا عاد
 * الإذاعة المكسورة إلى الظهور.
 * @returns {Promise<any[]>}
 */
export function stations() {
  return load("radio.json").then((list) =>
    list.filter((station) => /^https:/i.test(String(station.link || station.url || ""))));
}

/**
 * يفرّغ ذاكرة الملفات. يُستدعى عند الحاجة إلى استعادة الذاكرة،
 * مع الإبقاء على البيان لأن الواجهة تعتمد عليه في كل نداء.
 * @param {{ keepManifest?: boolean }} [options]
 */
export function trim(options = {}) {
  const { keepManifest = true } = options;
  const entries = [...cache.entries()];
  entries.sort((a, b) => {
    const ua = usage.get(a[0]) || { n: 0, at: 0 };
    const ub = usage.get(b[0]) || { n: 0, at: 0 };
    if (ua.n !== ub.n) return ua.n - ub.n;
    return ua.at - ub.at;
  });
  for (const [path] of entries) {
    if (keepManifest && path === "manifest.json") continue;
    cache.delete(path);
    usage.delete(path);
  }
}

/** @returns {{cached: number, pending: number}} حالة الذاكرة للاختبار. */
export function cacheStats() {
  return { cached: cache.size, pending: pending.size };
}