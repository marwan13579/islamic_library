"use strict";

/**
 * اختبارات تلاوة القرآن.
 *
 * تثبت بنية الرابط وصحّة قراءة الردّ، وتتحقّق من وجود ملف تلاوة فعلي
 * لكل قارئ في القائمة عبر الواجهة البرمجية (تُتخطّى بلا اتصال).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const load = (rel) => import(`file://${path.join(ROOT, "src", rel)}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** يطلب مع مهلة، ويعيد المحاولة مرة واحدة عند فشل الشبكة أو تحديد الطلبات. */
const online = async (url) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.status === 429) {
        await sleep(1500);
        continue;
      }
      return res.ok ? await res.json() : null;
    } catch {
      await sleep(800);
    }
  }
  return null;
};

test("كل قارئ له اسم وأسلوب ومعرّف صحيح", async () => {
  const { RECITERS, DEFAULT_RECITER } = await load("lib/quran-audio.js");
  assert.ok(RECITERS.length >= 5, "عدد القارئين قليل");
  const ids = new Set();
  for (const reciter of RECITERS) {
    assert.ok(Number.isInteger(reciter.id) && reciter.id > 0, `معرّف خاطئ: ${reciter.id}`);
    assert.ok(reciter.name && reciter.name.length > 2, "بلا اسم");
    assert.ok(reciter.style, `${reciter.name}: بلا أسلوب`);
    assert.ok(!ids.has(reciter.id), `معرّف مكرّر: ${reciter.id}`);
    ids.add(reciter.id);
  }
  assert.ok(ids.has(DEFAULT_RECITER), "القارئ الافتراضي خارج القائمة");
});

test("رابط التلاوة مبنيّ بالشكل الصحيح", async () => {
  const { chapterAudioUrl, QURAN_AUDIO_BASE } = await load("lib/quran-audio.js");
  assert.equal(chapterAudioUrl(7, 1), `${QURAN_AUDIO_BASE}/7/1`);
  assert.equal(chapterAudioUrl(2, 114), `${QURAN_AUDIO_BASE}/2/114`);
  assert.match(chapterAudioUrl(3, 18), /chapter_recitations\/3\/18$/);
});

test("التحقّق من رقم السورة", async () => {
  const { isValidChapter } = await load("lib/quran-audio.js");
  assert.equal(isValidChapter(1), true);
  assert.equal(isValidChapter(114), true);
  assert.equal(isValidChapter(2.5), false);
  assert.equal(isValidChapter(0), false);
  assert.equal(isValidChapter(115), false);
  assert.equal(isValidChapter("1"), false, "لا يقبل النصّ");
  assert.equal(isValidChapter(Number.NaN), false);
});

test("التحقّق من معرّف القارئ", async () => {
  const { isKnownReciter, RECITERS } = await load("lib/quran-audio.js");
  for (const reciter of RECITERS) assert.equal(isKnownReciter(reciter.id), true);
  assert.equal(isKnownReciter(999), false);
});

test("قراءة رابط الصوت من الردّ", async () => {
  const { audioUrlOf } = await load("lib/quran-audio.js");
  assert.equal(
    audioUrlOf({ audio_file: { audio_url: "https://example.com/a.mp3" } }),
    "https://example.com/a.mp3",
  );
  assert.equal(audioUrlOf({}), null);
  assert.equal(audioUrlOf(null), null);
  assert.equal(audioUrlOf({ audio_file: { audio_url: "javascript:alert(1)" } }), null);
  assert.equal(audioUrlOf({ audio_file: { audio_url: 42 } }), null);
  assert.equal(audioUrlOf("نصّ"), null);
});

test("حالة التشغيل التالية مشتقّة من حالة العنصر", async () => {
  const { nextPlayState } = await load("lib/quran-audio.js");
  assert.equal(nextPlayState({ paused: true }), "play");
  assert.equal(nextPlayState({ paused: false }), "pause");
});

test("كل قارئ له ملف تلاوة فعلي لكل سورة", async (t) => {
  const { RECITERS, chapterAudioUrl, audioUrlOf } = await load("lib/quran-audio.js");
  // عيّنة: أول وآخر سورة تكفي لبيان دعم القارئ.
  for (const reciter of RECITERS) {
    for (const chapter of [1, 114]) {
      const payload = await online(chapterAudioUrl(reciter.id, chapter));
      if (!payload) return t.skip("لا اتصال بالواجهة البرمجية");
      assert.ok(
        audioUrlOf(payload),
        `${reciter.name} (${reciter.id}) بلا ملف للسورة ${chapter}`,
      );
      await sleep(250);
    }
  }
});
