/**
 * حفظ تلاوات القرآن للعمل بلا إنترنت.
 *
 * يخزّن الصوت في Cache Storage لا في IndexedDB: الملفات كبيرة ومتتالية
 * والاسم هو المفتاح، وهذا ما تفعله Cache Storage أصلًا.
 * @module lib/audio-store
 */

/** اسم مخزن الصوت. */
const CACHE = "quran-audio-v1";

/** @returns {Promise<Cache|null>} */
async function open() {
  if (!("caches" in window)) return null;
  try {
    return await caches.open(CACHE);
  } catch {
    return null;
  }
}

/**
 * يحفظ تلاوة، ويبلّغ عن نسبة التقدّم.
 * @param {string} url
 * @param {(ratio: number) => void} [onProgress] نسبة ما نزل من ٠ إلى ١
 * @returns {Promise<boolean>} هل حُفظ؟
 */
export async function cacheAudio(url, onProgress) {
  const cache = await open();
  if (!cache) return false;
  if (await cache.match(url)) {
    if (onProgress) onProgress(1);
    return true;
  }

  const response = await fetch(url);
  if (!response.ok) return false;

  /* التقدّم يحتاج قراءة التدفّق بأنفسها؛ ومن لا يعرضه يكفيه“快تمل”. */
  const total = Number(response.headers.get("content-length")) || 0;
  if (!onProgress || !response.body || !total) {
    await cache.put(url, response.clone());
    if (onProgress) onProgress(1);
    return true;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(1, got / total));
  }
  const blob = new Blob(chunks, { type: "audio/mpeg" });
  await cache.put(url, new Response(blob, { headers: { "content-type": "audio/mpeg" } }));
  onProgress(1);
  return true;
}

/**
 * يحذف تلاوة محفوظة.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function removeAudio(url) {
  const cache = await open();
  if (!cache) return false;
  return cache.delete(url);
}

/** @typedef {{url: string, bytes: number}} CachedAudio */

/**
 * يسرد التلاوات المحفوظة وحجمها.
 * @returns {Promise<CachedAudio[]>}
 */
export async function listAudio() {
  const cache = await open();
  if (!cache) return [];
  const keys = await cache.keys();
  const out = [];
  for (const request of keys) {
    const response = await cache.match(request);
    const length = Number(response?.headers.get("content-length")) || 0;
    const blob = response ? await response.blob() : null;
    out.push({ url: request.url, bytes: blob ? blob.size : length });
  }
  return out.sort((a, b) => b.bytes - a.bytes);
}

/** @returns {Promise<number>} الحجم الكلمي بالبايت */
export async function audioSize() {
  const rows = await listAudio();
  return rows.reduce((sum, row) => sum + row.bytes, 0);
}

/** @returns {Promise<number>} عدد المحذوف */
export async function clearAudio() {
  const cache = await open();
  if (!cache) return 0;
  const keys = await cache.keys();
  for (const key of keys) await cache.delete(key);
  return keys.length;
}