/**
 * إدماج الإذاعات في صفحة القرّاء والتلاوة.
 *
 * كان الإذاع في صفحةٍ وحدها بقائمةٍ من تسع محطات، والقرّاء في صفحةٍ أخرى
 * ب١٥٨ قارئًا وتلاواتهم المخزَّنة، فتنقّل المستخدم بين صفحتين ليسمع
 * الشيخَ نفسَه: مرةً تلاوةً مخزَّنة ومرةً بثًّا حيًّا. الوحدات هنا تجمع
 * القائمتين في قائمةٍ واحدة، وتربط كل قارئٍ بمحطتِه وبتلاواتِه.
 *
 * ما لا تحتمله الاختبارات: أن يعمل ذلك في متصفّحٍ حقيقي — `check:browser`.
 * @module lib/audio-hub
 */

import { normalizeAr } from "./text.js";
import { LIVE_STATIONS } from "../data/radio-live.js";

/**
 * ألفاظٌ عاطلة في أسماء الإذاعات: تشترك فيها كل المحطات، فمن طابق بها
 * صار كلُّ قارئٍ يطابق كلَّ محطة.
 * @type {Set<string>}
 */
const NOISE = new Set([
  "اذاعه", "اذاعات", "بث", "مباشر", "الشيخ", "الدكتور", "دكتور",
  "قران", "القران", "كريم", "وروان", "حصن", "من", "الي", "عليه", "السلام", "تعليم",
]);

/**
 * كلمات الاسم التي تميّث صاحبه.
 * @param {string} name
 * @returns {string[]} كلماتٌ بلا تشكيل ولا ألفاظٍ عاطلة
 */
export function nameTokens(name) {
  return normalizeAr(name)
    .split(" ")
    .filter((word) => word.length >= 3 && !NOISE.has(word));
}

/**
 * @param {{link?: string, url?: string}} station
 * @returns {string}
 */
export function stationLink(station) {
  return String(station?.link || station?.url || "");
}

/**
 * @param {{name?: string}} station
 * @returns {string}
 */
export function stationName(station) {
  return String(station?.name || "");
}

/**
 * مفتاح البث: آخرُ الجزء في روابط الإذاعة، وهو اسم المحطة عند خادم
 * واحد. فالمحطة نفسها برابطَين (مضيفٌ 기본ي ومضيفٌ احتياطي) محطّةٌ واحدة.
 * @param {string} link
 * @returns {string}
 */
export function streamKey(link) {
  const slug = /\/radio\/([^/?#]+)/.exec(String(link || ""));
  return slug ? slug[1] : String(link || "");
}

/**
 * يدمج المحطات المفحوصة بما بقي من البيان، بلا تكرار.
 *
 * المحطة المفحوصة تُقدَّم على نظيرتها في البيان، لأن رابطها ثبتت
 * صلاحيته. والبثُّ الآمن وحده: الموقع على `https` فيحجب المتصفّح مصدر
 * `http` كمحتوى مخلوط فلا يُسمع.
 *
 * @param {object[]} curated المحطات المفحوصة
 * @param {object[]} list ما بقي من البيان
 * @returns {object[]} المحطات مجمّعة، ولكلٍّ `featured` يدلّ على المفحوصة
 */
export function mergeStations(curated, list) {
  const seen = new Set();
  const merged = [];
  const take = (station, featured) => {
    const link = stationLink(station);
    if (!/^https:/i.test(link)) return;
    const key = streamKey(link);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push({ ...station, link, featured });
  };
  for (const station of curated || []) take(station, true);
  for (const station of list || []) take(station, false);
  return merged;
}

/**
 * المحطات المفحوصة أولًا، ثم ما بقي من `content/radio.json`.
 * @param {object[]} list محطات البيان
 * @returns {object[]}
 */
export function mergedStations(list) {
  return mergeStations(LIVE_STATIONS, list);
}

/**
 * محطة البث التي لهذا القارئ، إن سمّاه اسمُها.
 * @param {{name?: string}} reciter
 * @param {object[]} stations
 * @returns {object|null}
 */
export function stationForReciter(reciter, stations) {
  const wanted = [...new Set(nameTokens(reciter?.name))];
  if (wanted.length < 2) return null;
  for (const station of stations || []) {
    const words = new Set(nameTokens(stationName(station)));
    if (wanted.every((word) => words.has(word))) return station;
  }
  return null;
}

/**
 * فهرس القرّاء بأسمائهم، فيصل من محطة البث إلى تلاوات صاحبها.
 * @param {object[]} reciters
 * @returns {{words: string[], reciter: object}[]}
 */
export function buildReciterIndex(reciters) {
  const entries = [];
  const seen = new Set();
  for (const reciter of reciters || []) {
    const words = [...new Set(nameTokens(reciter?.name))];
    if (words.length < 2) continue;
    const key = words.sort().join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ words, reciter });
  }
  return entries;
}

/**
 * القارئ صاحب هذه المحطة، أو `null` إن لم تسمّه الإذاعة.
 * @param {{name?: string}} station
 * @param {{words: string[], reciter: object}[]} index من `buildReciterIndex`
 * @returns {object|null}
 */
export function reciterForStation(station, index) {
  const words = new Set(nameTokens(stationName(station)));
  if (!words.size) return null;
  for (const entry of index || []) {
    if (entry.words.every((word) => words.has(word))) return entry.reciter;
  }
  return null;
}