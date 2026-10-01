/**
 * تلاوة القرآن المسموع.
 *
 * المصدر: `api.quran.com/api/v4/chapter_recitations/{reciter}/{chapter}` وهو
 * ملف واحد لكل سورة، فيكفي طلبًا واحدًا بدل ملف لكل آية.
 *
 * كل القارئين هنا أرقامهم من قائمة `resources/recitations` الرسمية، وقد
 * تحقّق `tests/quran-audio.test.js` من وجود ملف لكل قارئ.
 */

/** رابط التلاوة الكامل. */
export const QURAN_AUDIO_BASE = "https://api.quran.com/api/v4/chapter_recitations";

/**
 * @typedef {object} Reciter
 * @property {number} id
 * @property {string} name
 * @property {string} style
 */

/** @type {Reciter[]} */
export const RECITERS = [
  { id: 7, name: "مشاري راشد العفاسي", style: "مرتّل" },
  { id: 2, name: "عبد الباسط عبد الصمد", style: "مرتّل" },
  { id: 1, name: "عبد الباسط عبد الصمد", style: "مجوّد" },
  { id: 3, name: "عبد الرحمن السديس", style: "مرتّل" },
  { id: 9, name: "محمد صديق المنشاوي", style: "مرتّل" },
  { id: 10, name: "سعود الشريم", style: "مرتّل" },
  { id: 12, name: "محمود خليل الحصري", style: "المعلّم" },
];

/** القارئ الافتراضي. */
export const DEFAULT_RECITER = 7;

/**
 * يبني رابط طلب تلاوة سورة.
 * @param {number} reciter
 * @param {number} chapter رقم السورة من ١ إلى ١١٤
 */
export function chapterAudioUrl(reciter, chapter) {
  return `${QURAN_AUDIO_BASE}/${reciter}/${chapter}`;
}

/** @param {number} chapter */
export function isValidChapter(chapter) {
  return Number.isInteger(chapter) && chapter >= 1 && chapter <= 114;
}

/** @param {number} reciter */
export function isKnownReciter(reciter) {
  return RECITERS.some((item) => item.id === reciter);
}

/**
 * يستخرج رابط الصوت من ردّ الواجهة البرمجية.
 * @param {unknown} payload
 * @returns {string | null}
 */
export function audioUrlOf(payload) {
  const url = payload?.audio_file?.audio_url;
  return typeof url === "string" && url.endsWith(".mp3") ? url : null;
}

/**
 * يقرّر تشغيل التلاوة أم إيقافها حسب حالتها.
 * @param {HTMLAudioElement} audio
 * @returns {"pause" | "play"}
 */
export function nextPlayState(audio) {
  return audio.paused ? "play" : "pause";
}
