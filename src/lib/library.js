/**
 * واجهة قراءة المكتبة: تصفح الفئات والعناصر.
 *
 * كل عملية هنا تقرأ أقل قدر ممكن من الملفات: قائمة الفئة وحدها ثم جزء
 * العنصر الذي يحمل النص. لا صفحة في المكتبة تحمّل أكثر من مئتي كيلوبايت.
 * @module lib/library
 */

import { collectionMeta, listShard, itemShard, load, orderIndex, tafsirOf, hisnIndex, hisnBab } from "./shards.js";
import { read as readStorage, write as writeStorage, KEYS } from "./storage.js";

/** عدد العناصر في صفحة القوائم. */
export const PAGE_SIZE = 30;

/** @typedef {import("./shards.js").Summary} Summary */
/** @typedef {import("./shards.js").CollectionMeta} CollectionMeta */

/**
 * نافذة من ترتيب معكوس: تُقرأ الملفات من آخرها وتُعكس كل واحدة، فيصير
 * العنصرالأوّل هو الأحدث. هكذا «الأقدم» لا يكلّف أكثر من «الأحدث»: صفحة
 * واحدة من النهاية لا كل القوائم.
 * @param {number} count عدد ملفات القوائم
 * @param {number} start أول عنصر مطلوب
 * @param {number} per عدد عناصر الصفحة
 * @param {(index: number) => Promise<Summary[]>} read
 * @returns {Promise<Summary[]>}
 */
async function reversedWindow(count, start, per, read) {
  let need = start + per;
  /** @type {Summary[]} */
  const head = [];
  /* المجموع في ترتيب العرض لا معكوسه: العنصر صفر فيه أوّل الصفحة،
     والمعكوس يجعله آخرها فيعود كل صفحة إلى نفسها. */
  for (let index = count - 1; index >= 0 && need > 0; index -= 1) {
    const part = await read(index);
    for (let at = part.length - 1; at >= 0 && need > 0; at -= 1) {
      head.push(part[at]);
      need -= 1;
    }
  }
  return head.slice(start, start + per);
}

/**
 * نافذة بترتيب الملفات كما هي: من أوّلها إلى آخرها.
 * @param {number} count
 * @param {number} start
 * @param {number} per
 * @param {(index: number) => Promise<Summary[]>} read
 * @returns {Promise<Summary[]>}
 */
async function forwardWindow(count, start, per, read) {
  const perShard = await firstSize(read, count);
  const first = Math.floor(start / perShard);
  const offset = start - first * perShard;
  /** @type {Summary[]} */
  const rows = [];
  for (let index = first; index < count && rows.length < offset + per; index += 1) {
    rows.push(...(await read(index)));
  }
  return rows.slice(offset, offset + per);
}

/**
 * @param {(index: number) => Promise<Summary[]>} read
 * @param {number} count
 * @returns {Promise<number>} عدد عناصر أول ملف
 */
async function firstSize(read, count) {
  if (!count) return 1;
  return (await read(0)).length || 1;
}

/**
 * اتجاه «الأحدث» في مجموعة واحدة.
 *
 * البناء يرتّب القوائم تنازليًا بالتاريخ، فحيث وُجد تاريخ كانت «الأحدث»
 * أول الملفات. وحيث لم يوجد — الفتاوى والتاريخ والاختبارات، لا تاريخ
 * فيها أصلًا — بقي ترتيب المصدر، وهو تصاعدي بالمعرّف، فصارت «الأحدث»
 * آخر الملفات. فالتصريح في البيان `listOrder` يوفّر التخمين.
 * @param {CollectionMeta} meta
 * @param {string} sort
 * @returns {boolean} هل يُقرأ من النهاية
 */
function reversed(meta, sort) {
  const newestAtEnd = meta.listOrder !== "desc";
  return sort === "oldest" ? !newestAtEnd : newestAtEnd;
}

/**
 * ترتيب العرض: الأحدث، الأقدم. لا ثالثَ، إذ لا قياس للكثرة في المصدر.
 *
 * الترتيبُ ترتيبُ البناء معكوسًا أو كما هو، لا ترتيبٌ يُعاد اشتقاقه من
 * الحقول: فمفتاحٌ زمني مشتقّ من `d` يخرج بالمجموعات التي تشترك في
 * تاريخها، وبلا تاريخٍ أصلًا يقع على الرقم الأخير من المعرّف فيرتب
 * المجموعةَ ترتيبًا لم يقصده أحد. و`order.json` صورة محسوبة من هنا،
 * فأينما غاب الفهرس حُسب الترتيب، وحيثما حُسب بفئه نفسها — يمنع
 * `tests/library-sort-index.test.js` افتراقهما.
 * @param {CollectionMeta} meta
 * @param {Summary[]} items
 * @param {string} sort
 * @returns {Summary[]}
 */
function order(meta, items, sort) {
  if (sort === "oldest") return reversed(meta, sort) ? items : [...items].reverse();
  return reversed(meta, sort) ? [...items].reverse() : items;
}

/** كل ملخّصات مجموعة، حين لا يتوفّر فهرس الترتيب. */
async function allSummaries(type, meta) {
  const out = [];
  for (let index = 0; index < meta.listFiles.length; index += 1) {
    out.push(...(await listShard(type, index)));
  }
  return out;
}

/**
 * الملخّصات الموضوعة في مواضعها من الفهرس، بقراءة الأجزاء التي تقع فيها.
 *
 * كل الأجزاء كاملة عدا الأخير، فموضعٌ ب 나머 القسمة يدل على جزئه. ولا
 * يُقرأ إلا ما تدور عليه الصفحة، فقد تقع عناصر صفحة «الأكثر»
 * في شتّى الأجزاء، فتُقرأ كلها معًا لا واحدًا بعد واحد.
 * @param {string} type
 * @param {CollectionMeta} meta
 * @param {number[]} positions
 * @returns {Promise<Summary[]>}
 */
async function summariesAt(type, meta, positions) {
  const perShard = meta.listPerShard || 500;
  const last = meta.listFiles.length - 1;
  const wanted = [...new Set(positions.map((at) => Math.min(Math.floor(at / perShard), last)))];

  const shards = await Promise.all(wanted.map((at) => listShard(type, at)));
  const byIndex = new Map(wanted.map((at, seat) => [at, shards[seat]]));

  const out = [];
  for (const position of positions) {
    const index = Math.min(Math.floor(position / perShard), last);
    const row = byIndex.get(index)[position - index * perShard];
    if (row) out.push(row);
  }
  return out;
}

/**
 * يقرأ صفحة من قائمة مجموعة، بلا تحميل كل القوائم.
 * @param {string} type
 * @param {{page?: number, perPage?: number, sort?: string}} [options]
 * @returns {Promise<{items: Summary[], total: number, page: number, pages: number, hasMore: boolean}>}
 */
export async function browse(type, options = {}) {
  const { page = 1, perPage = PAGE_SIZE, sort = "newest" } = options;
  const meta = await collectionMeta(type);
  const per = Math.max(1, Math.min(200, perPage));
  const current = Math.max(1, page);
  const start = (current - 1) * per;
  const read = (index) => listShard(type, index);

  /* الترتيب لا يعرفه إلا الجميع، والجميع هنا ترتيبٌ حُسب مرةً واحدة
     وحُفظ في `order.json` مواضعَ لا نصوصًا، فيقرأه المتصل ثم الجزء
     الذي تقع فيه الصفحة: جزءًا واحدًا أو اثنين أيًّا كانت الصفحة.
     وحيث يغيب الفهرس يقف طريق النافذة، وهو يقرأ من طرف القوائم
     إلى طرفها.

     وثالثٌ لا يعود: الترتيب بدقائق القراءة يكذب على قارئه، إذ لا قياس
     لكَم قُرئ في المصدر أصلًا. فبقي الأحدثُ والأقدم وحدهما. */
  const index = await orderIndex(type);
  const ranked = index && index.orders && index.orders[sort];

  let window;
  if (ranked) {
    window = await summariesAt(type, meta, ranked.slice(start, start + per));
  } else if (reversed(meta, sort)) {
    window = await reversedWindow(meta.listFiles.length, start, per, read);
  } else {
    window = await forwardWindow(meta.listFiles.length, start, per, read);
  }
  return {
    items: window,
    total: meta.count,
    page: current,
    pages: Math.max(1, Math.ceil(meta.count / per)),
    hasMore: start + per < meta.count,
  };
}

/**
 * يختار أسئلة من تصنيف على عشوائية، للاختبارات.
 *
 * مواضعها في ملفات التصنيف، وهي ملخّصات لا نصوص، فتُقرأ كلها — بضع
 * مئات كيلوبايت — ثم لا يُحمَّل من العناصر إلا ما وقع عليه الاختيار.
 * @param {string} type
 * @param {string} category
 * @param {number} count
 * @returns {Promise<Summary[]>}
 */
export async function sampleByCategory(type, category, count) {
  const meta = await collectionMeta(type);
  const entry = meta.catIndex && meta.catIndex[category];
  if (!entry || count < 1) return [];

  /** @type {Summary[]} */
  const pool = [];
  for (const file of entry.files) {
    pool.push(...(await load(`library/${type}/cat/${entry.dir}/${file}`)));
  }
  if (pool.length <= count) return pool;

  /* سحب بلا تكرار، مع سقف للمحاولات فلا تدور إلى الأبد. */
  const picked = [];
  const used = new Set();
  let guard = count * 20;
  while (picked.length < count && guard-- > 0) {
    const at = Math.floor(Math.random() * pool.length);
    if (used.has(at)) continue;
    used.add(at);
    picked.push(pool[at]);
  }
  return picked;
}

/**
 * يختار أسئلة من مجموعة كاملة بلا تصنيف.
 * @param {string} type
 * @param {number} count
 * @returns {Promise<Summary[]>}
 */
export async function sampleAll(type, count) {
  const meta = await collectionMeta(type);
  /** @type {Summary[]} */
  const pool = [];
  for (let index = 0; index < meta.listFiles.length; index += 1) {
    pool.push(...(await listShard(type, index)));
  }
  const picked = [];
  const used = new Set();
  let guard = count * 20;
  while (picked.length < count && guard-- > 0) {
    const at = Math.floor(Math.random() * pool.length);
    if (used.has(at)) continue;
    used.add(at);
    picked.push(pool[at]);
  }
  return picked;
}

/**
 * عدة ملفات إن كبر، فتُقرأ ما يكفي للصفحة المطلوبة ثم تتوقف.
 * @param {string} type
 * @param {string} category
 * @param {{page?: number, perPage?: number, sort?: string}} [options]
 */
export async function browseCategory(type, category, options = {}) {
  const { page = 1, perPage = PAGE_SIZE, sort = "newest" } = options;
  const meta = await collectionMeta(type);
  const entry = meta.catIndex && meta.catIndex[category];
  if (!entry) return { items: [], total: 0, page: 1, pages: 1, hasMore: false };

  const per = Math.max(1, Math.min(200, perPage));
  const current = Math.max(1, page);
  const start = (current - 1) * per;
  const total = entry.count;
  const read = (index) => load(`library/${type}/cat/${entry.dir}/${entry.files[index]}`);

  /* ملفات التصنيف محفوظة بترتيب القوائم نفسها، فينطبق عليها ما سبق. */
  let rows;
  if (reversed(meta, sort)) {
    rows = await reversedWindow(entry.files.length, start, per, read);
  } else {
    rows = await forwardWindow(entry.files.length, start, per, read);
  }

  return {
    items: rows,
    total,
    page: current,
    pages: Math.max(1, Math.ceil(total / per)),
    hasMore: start + per < total,
  };
}

/**
 * يفتح عنصرًا بمعرّفه. الموضع محفوظ في الملخّص فلا يُبحث في الأجزاء.
 * @param {string} type
 * @param {[number, number]} where [رقم الجزء، الموضع داخله]
 * @returns {Promise<any|null>}
 */
export async function openAt(type, where) {
  if (!Array.isArray(where)) return null;
  const [part, at] = where;
  if (!Number.isInteger(part) || !Number.isInteger(at)) return null;
  const items = await itemShard(type, part);
  return items[at] || null;
}

/* ------------------------------------------------ التفسير وحصن المسلم */

/**
 * فهرس السور المفسَّرة: اسم كل سورة وعدد آياتها في ملف واحد.
 * @returns {Promise<{source: string, count: number, surahs: any[]}>}
 */
export function tafsirIndex() {
  return load("tafsir/index.json");
}

/** @returns {Promise<{count: number, bab: any[]}>} فهرس أبواب حصن المسلم. */
export { hisnIndex };

/**
 * يقرأ سورة كاملة مع تفسير آياتها: ملف واحد لكل سورة.
 * @param {number} surah 1..114
 * @returns {Promise<{no: number, name: string, ayat: any[]}|null>}
 */
export async function readSurah(surah) {
  const no = Math.max(1, Math.min(114, Math.round(Number(surah) || 1)));
  try {
    return await tafsirOf(no);
  } catch {
    return null;
  }
}

/**
 * يقرأ بابًا من حصن المسلم مع أذكاره ورابط صوته.
 * @param {number} bab
 * @returns {Promise<any|null>}
 */
export async function readBab(bab) {
  const no = Math.max(1, Math.min(132, Math.round(Number(bab) || 1)));
  try {
    return await hisnBab(no);
  } catch {
    return null;
  }
}

/**
 * يبحث عن موضع عنصر داخل مجموعة بمعرّفه.
 * الموضع في دليل الموزّع بالتجزئة، فالطلب ملف واحد لا مسح.
 * @param {string} type
 * @param {string} id
 * @returns {Promise<[number, number]|null>}
 */
export async function findWhere(type, id) {
  const meta = await collectionMeta(type);
  const buckets = meta.idBuckets || 16;
  /* نفس دالة التجزئة المستعملة في البناء: FNV-1a ثم الفهرسة. */
  let value = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    value ^= id.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  const file = String((value >>> 0) % buckets).padStart(3, "0");
  const table = /** @type {Record<string, [number, number]>} */ (
    await load(`library/${type}/byid/${file}.json`)
  );
  return table[id] || null;
}

/**
 * يقرأ ملخّص العنصر من العنصر نفسه بعد فتحه.
 * @param {string} type
 * @param {string} id
 * @returns {Promise<Summary|null>}
 */
export async function findSummary(type, id) {
  const where = await findWhere(type, id);
  if (!where) return null;
  const item = await openAt(type, where);
  return item ? summarize(type, item, where) : null;
}

/**
 * يشتقّ ملخّصًا من عنصر كامل.
 * @param {string} type
 * @param {any} item
 * @param {[number, number]} where
 * @returns {Summary}
 */
export function summarize(type, item, where) {
  return {
    id: item.id,
    t: type,
    ti: item.title || "",
    su: item.summary || "",
    c: item.categories || [],
    a: item.author || "",
    d: item.dateText || item.dateIso || "",
    r: item.readingTime || 0,
    au: item.extra && item.extra.audio ? 1 : 0,
    p: where,
  };
}

/**
 * ملخّص العنصر مع نصّه المختصر: يفتح العنصر ويعيده بملخّصه.
 * @param {string} type
 * @param {string} id
 */
export async function readItem(type, id) {
  if (type === "tafsir") {
    const [, surah, ayah] = /^tafsir-(\d+)-(\d+)$/.exec(id) || [];
    if (!surah) return null;
    const sura = await readSurah(Number(surah));
    const row = sura && sura.ayat.find((a) => String(a.n) === String(ayah));
    if (!row) return null;
    return {
      id,
      type,
      surah: sura.no,
      surahName: sura.name,
      ayah: row.n,
      title: `${sura.name} · آية ${row.n}`,
      text: row.t,
      content: row.f,
      page: row.p,
      where: [Number(surah) - 1, sura.ayat.indexOf(row)],
    };
  }
  if (type === "hisn") {
    const [, bab] = /^hisn-(\d+)$/.exec(id) || [];
    if (!bab) return null;
    const opened = await readBab(Number(bab));
    if (!opened) return null;
    return {
      id,
      type,
      bab: opened.no,
      title: opened.title,
      audio: opened.audio,
      items: opened.items,
      content: opened.items.map((row) => row.t).join("\n\n"),
      where: [Number(bab) - 1, 0],
    };
  }
  const summary = await findSummary(type, id);
  if (!summary) return null;
  const item = await openAt(type, summary.p);
  if (!item) return null;
  return { ...item, summary: summary.su, categories: summary.c, author: summary.a || item.author };
}

/* ------------------------------------------------------------- المفضّلة */

/** @returns {string[]} معرّفات العناصر المحفوظة */
export function bookmarks() {
  const value = readStorage(KEYS.bookmarks, []);
  return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
}

/**
 * يضيف العنصر إلى المفضّلة أو يزيله.
 * @param {string} id
 * @returns {boolean} هل صار محفوظًا
 */
export function toggleBookmark(id) {
  const list = bookmarks();
  const at = list.indexOf(id);
  if (at === -1) list.unshift(id);
  else list.splice(at, 1);
  writeStorage(KEYS.bookmarks, list.slice(0, 200));
  return at === -1;
}

/** @param {string} id */
export function isBookmarked(id) {
  return bookmarks().includes(id);
}