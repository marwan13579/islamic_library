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
  try {
    if (await cache.match(url)) {
      if (onProgress) onProgress(1);
      return true;
    }

    const response = await fetch(url);
    if (!response.ok) return false;

    /* التقدّم يحتاج قراءة التدفّق بأنفسها؛ ومن لا يعرضه يكفيه فاكتمال. */
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
    /* نحفظ الحجم في الترويسة: لولاه لقينا نقرأ كل ملف مرّة أخرى
       في listAudio لنعرف حجمه. */
    await cache.put(
      url,
      new Response(blob, {
        headers: { "content-type": "audio/mpeg", "content-length": String(blob.size) },
      }),
    );
    onProgress(1);
    return true;
  } catch {
    /* امتلاء الحصة أو انقطاع الشبكة أو إلغاء المستخدم: لا نُبلّغ به
       على أنه نجاح. وتعرض الصفحة رسالة الفشل. */
    return false;
  }
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
 * نقرأ الترويسة فقط: قراءة الملف كله كانت تُحمّل كل ما حُفظ في الذاكرة
 * دفعة واحدة — عشرات الميغابايت على هاتف فيه ١٥٠ تلاوة.
 * @returns {Promise<CachedAudio[]>}
 */
export async function listAudio() {
  const cache = await open();
  if (!cache) return [];
  const keys = await cache.keys();
  const out = [];
  for (const request of keys) {
    const response = await cache.match(request);
    if (!response) continue;
    let bytes = Number(response.headers.get("content-length")) || 0;
    if (!bytes) {
      // ملف حُفظ قبل حفظ الترويسة: نقيسه مرة واحدة ثم نسجّل مقاسه.
      const blob = await response.blob();
      bytes = blob.size;
      try {
        await cache.put(
          request,
          new Response(blob, {
            headers: { "content-type": blob.type || "audio/mpeg", "content-length": String(bytes) },
          }),
        );
      } catch {
        /* نكتفي بالحجم في هذه الجلسة إن رفض المتصفح الكتابة */
      }
    }
    out.push({ url: request.url, bytes });
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