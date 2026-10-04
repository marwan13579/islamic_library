/**
 * واجهة بطاقات مكتبة الفيديو: الرسم، والمفضلة، وآخر ما شوهد، والمشاركة.
 *
 * كل ما يمسّ التخزين يمرّ هنا، فمفتاحان جديدان هما كل ما يلزم حذف القسم
 * لاحقًا: `video_favorites` و`video_recent` في `src/lib/storage.js`.
 * @module lib/video-library-ui
 */

import { escapeHtml, toArNum, normalizeAr } from "./text.js";
import { read, write, KEYS } from "./storage.js";
import { shareOrCopy } from "./share.js";
import { TRUST_LEVELS } from "../data/islamic-channels.js";

/** @typedef {import("../data/islamic-channels.js").Channel} Channel */

/** أقصى عدد لقنوات «آخر ما شاهدت». */
export const RECENT_LIMIT = 8;

/** @type {Map<string, { id: string, emoji: string, label: string, hint: string }>} */
const TRUST_CACHE = new Map(
  TRUST_LEVELS.map((level) => [level.id, level]),
);

/* --------------------------------------------------------------- التخزين */

/** @returns {string[]} معرّفات القنوات المفضلة */
export function readFavorites() {
  const list = read(KEYS.videoFavorites, []);
  return Array.isArray(list) ? list.filter((id) => typeof id === "string") : [];
}

/**
 * @param {string} id
 * @returns {boolean} هل صارت في المفضلة بعد التبديل
 */
export function toggleFavorite(id) {
  const list = readFavorites();
  const index = list.indexOf(id);
  if (index === -1) list.push(id);
  else list.splice(index, 1);
  write(KEYS.videoFavorites, list);
  return index === -1;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isFavorite(id) {
  return readFavorites().includes(id);
}

/**
 * آخر ما شوهد: معرّف القناة ووقت فتحها وتصنيفها. لا نخزّن ما يُرى على
 * YouTube ولا أي بيانات شخصية — معرّف ووقت فقط، ويُمسح من المستخدم.
 * @returns {{ id: string, at: number, category: string }[]}
 */
export function readRecent() {
  const list = read(KEYS.videoRecent, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item.id === "string" && Number.isFinite(item.at))
    .slice(0, RECENT_LIMIT);
}

/**
 * @param {Channel} channel
 */
export function markWatched(channel) {
  const entry = {
    id: channel.id,
    at: Date.now(),
    category: channel.categories[0] ?? "",
  };
  const rest = readRecent().filter((item) => item.id !== channel.id);
  write(KEYS.videoRecent, [entry, ...rest].slice(0, RECENT_LIMIT));
}

/** @param {string} key */
export function clearRecent(key = KEYS.videoRecent) {
  write(key, []);
}

/* -------------------------------------------------------------- الحماية */

/**
 * رابط المشاهدة لا يُبنى من بيانات المستخدم ولا من نصّ يُحقن في الصفحة:
 * نحوّل ما في البيانات إلى نطاق YouTube مباشرة. وهذا حارس إضافي بعد
 * `publishable` الذي لا يعرض إلا ما ثبت.
 * @param {Channel} channel
 * @returns {string} رابط آمن أو نص فارغ
 */
export function channelUrl(channel) {
  if (!channel.verified || !channel.youtubeUrl) return "";
  try {
    const url = new URL(channel.youtubeUrl);
    if (url.protocol !== "https:") return "";
    if (url.hostname !== "www.youtube.com" && url.hostname !== "youtube.com") return "";
    if (!/^\/(?:@[\w.\-]+|channel\/UC[\w-]{22}|user\/[\w.\-]+|c\/[\w.\-]+)\/?$/.test(url.pathname)) {
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}

/**
 * صورة رمزية بالحرف الأول: نرسمها في CSS بدل جلب شعار القناة من
 * شبكة YouTube. فتبقى الصفحة خفيفة (بلا طلب خارجي) ولا نلمس شعارات
 * غيرنا، والقارئ يرى ما يكفي.
 * @param {Channel} channel
 * @returns {string}
 */
export function avatarMark(channel) {
  const source = normalizeAr(channel.nameAr || channel.nameEn || "?");
  const letter = Array.from(source.replace(/[^a-z\p{Script=Arabic}0-9]/gu, ""))[0] ?? "؟";
  return escapeHtml(letter.toUpperCase());
}

/** @param {Channel} channel */
export function trustBadge(channel) {
  const level = TRUST_CACHE.get(channel.trustLevel);
  if (!level) return "";
  return `<span class="vbadge vbadge--${channel.trustLevel}" title="${escapeHtml(level.hint)}">${level.emoji} ${escapeHtml(level.label)}</span>`;
}

/* ---------------------------------------------------------------- الرسم */

/**
 * بطاقة قناة. رابط المشاهدة يفتح تبويبًا جديدًا بلاferrer، ولا نضع
 * iframe ولا صورة خارجية: البطاقة نصّ ورابط فقط.
 * @param {Channel} channel
 * @param {{ favorites?: string[], recent?: number[] }} [state]
 * @returns {string} بطاقة HTML
 */
export function channelCard(channel, state = {}) {
  const favorites = state.favorites ?? readFavorites();
  const liked = favorites.includes(channel.id);
  const url = channelUrl(channel);
  const ages = (channel.ageGroups ?? []).map((age) => `<span class="vtag">${escapeHtml(age)}</span>`).join("");
  return `<article class="vcard${channel.featured ? " vcard--featured" : ""}" data-id="${escapeHtml(channel.id)}">
  <div class="vcard__top">
    <span class="vavatar" aria-hidden="true">${avatarMark(channel)}</span>
    <div class="vcard__names">
      <h3 class="vcard__title">${escapeHtml(channel.nameAr)}</h3>
      <p class="vcard__en" dir="ltr">${escapeHtml(channel.nameEn)}</p>
    </div>
    <button class="vstar${liked ? " is-on" : ""}" type="button" data-fav="${escapeHtml(channel.id)}"
      aria-pressed="${liked ? "true" : "false"}"
      aria-label="${liked ? "إزالة" : "إضافة"} ${escapeHtml(channel.nameAr)} ${liked ? "من" : "إلى"} المفضلة">${liked ? "★" : "☆"}</button>
  </div>
  <p class="vcard__desc">${escapeHtml(channel.descriptionAr)}</p>
  <div class="vcard__badges">${trustBadge(channel)}${channel.featured ? '<span class="vbadge vbadge--star">⭐ مختارات</span>' : ""}</div>
  <ul class="vcats">${ages}</ul>
  <div class="vcard__acts">
    <a class="vbtn vbtn--go" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"
      data-watch="${escapeHtml(channel.id)}" aria-label="مشاهدة قناة ${escapeHtml(channel.nameAr)} على يوتيوب">▶ مشاهدة القناة</a>
    <button class="vbtn vbtn--share" type="button" data-share="${escapeHtml(channel.id)}" aria-label="مشاركة قناة ${escapeHtml(channel.nameAr)}">↗ مشاركة</button>
  </div>
</article>`;
}

/* --------------------------------------------------------------- المشاركة */

/**
 * مشاركة قناة: Web Share API إن وُجد، 否则 نسخ الرابط.
 * @param {Channel} channel
 * @returns {Promise<"shared"|"copied"|"cancelled">}
 */
export function shareChannel(channel) {
  const url = channelUrl(channel);
  return shareOrCopy({
    title: `${channel.nameAr} — مكتبة الفيديو الإسلامية · نور الهدى`,
    text: channel.descriptionAr,
    url: url || `${location.origin}/islamic-videos/`,
  });
}

/**
 * بطاقة «ماذا أشاهد الآن» — اقتراح واحد كبير.
 * @param {Channel | null} channel
 * @returns {string}
 */
export function spotlightCard(channel) {
  if (!channel) return '<p class="vempty">لا اقتراح الآن.</p>';
  return `<article class="vspot" data-id="${escapeHtml(channel.id)}">
  <span class="vavatar vavatar--lg" aria-hidden="true">${avatarMark(channel)}</span>
  <div class="vspot__body">
    <h3 class="vcard__title">${escapeHtml(channel.nameAr)}</h3>
    <p class="vcard__en" dir="ltr">${escapeHtml(channel.nameEn)}</p>
    <p class="vcard__desc">${escapeHtml(channel.descriptionAr)}</p>
    <div class="vcard__badges">${trustBadge(channel)}</div>
  </div>
  <a class="vbtn vbtn--go" href="${escapeHtml(channelUrl(channel))}" target="_blank" rel="noopener noreferrer"
    data-watch="${escapeHtml(channel.id)}">▶ مشاهدة</a>
</article>`;
}
