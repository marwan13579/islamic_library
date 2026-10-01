/**
 * أدوات قراءة المصحف: تلوين التجويد، التفسير، والترجمة كلمة بكلمة.
 * منقولة من ملف «النُّور وصَلِّ لِي.html» ومكيَّفة على بنية المشروع.
 * @module app/quran-read
 */

import { fetchJson } from "../lib/api.js";
import { escapeHtml, toArNum } from "../lib/text.js";

const QURAN_API = "https://api.quran.com/api/v4";
const ALQURAN_API = "https://api.alquran.cloud/v1";

/** أنواع التفسير المتاحة: المفتاح كما يتوقّعه AlQuran Cloud. */
export const TAFSIR_TYPES = [
  { key: "ar.muyassar", label: "الميسّر" },
  { key: "ar.jalalayn", label: "الجلالين" },
  { key: "en.sahih", label: "English" },
];

/** يحوّل مفتاح التفسير إلى معرّف النسخة في AlQuran Cloud. */
export const editionId = (type) => String(type ?? TAFSIR_TYPES[0].key).replace(".", "-");

/**
 * يُحمّل نصّ السورة ملوّنًا بأحكام التجويد.
 * @param {number} number رقم السورة
 * @returns {Promise<Array<{numberInSurah:number,text:string,html:string}>>}
 */
export async function loadTajweed(number) {
  const payload = await fetchJson(
    `${QURAN_API}/quran/verses/uthmani_tajweed?chapter_number=${number}`,
    { timeout: 12000 },
  );
  const verses = payload?.verses;
  if (!Array.isArray(verses) || !verses.length) throw new Error("لا توجد بيانات تجويد");
  return verses.map((verse, index) => {
    const html = String(verse.text_uthmani_tajweed ?? "")
      // الوسم الأصلي <tajweed class="x">، وأحيانًا بلا علامات اقتباس
      .replace(/<tajweed\s+class=("?)([a-z_0-9]+)\1?>/gi, '<span class="tj-$2">')
      .replace(/<\/tajweed>/gi, "</span>");
    return {
      numberInSurah: index + 1,
      text: html.replace(/<[^>]+>/g, ""),
      html,
    };
  });
}

/**
 * يُحمّل السورة مع ترجمة كل كلمة ومعانيها.
 * @param {number} number رقم السورة
 * @returns {Promise<Array<{numberInSurah:number,words:Array,translation:string}>>}
 */
export async function loadWordByWord(number) {
  const payload = await fetchJson(
    `${QURAN_API}/verses/by_chapter/${number}?words=true&word_fields=text_uthmani,translation&per_page=300`,
    { timeout: 15000 },
  );
  const verses = payload?.verses;
  if (!Array.isArray(verses) || !verses.length) throw new Error("لا توجد بيانات ترجمة");
  return verses.map((verse, index) => ({
    numberInSurah: index + 1,
    words: Array.isArray(verse.words) ? verse.words : [],
    translation: String(verse.translations?.[0]?.text ?? ""),
  }));
}

/**
 * يُحمّل تفسير السورة.
 * @param {number} number رقم السورة
 * @param {string} type نوع التفسير من TAFSIR_TYPES
 * @returns {Promise<Array<{numberInSurah:number,text:string}>>}
 */
export async function loadTafsir(number, type) {
  const edition = editionId(type);
  const payload = await fetchJson(
    `${ALQURAN_API}/surah/${number}/${edition}?language=ar`,
    { timeout: 12000 },
  );
  const ayahs = payload?.data ?? [];
  if (!Array.isArray(ayahs) || !ayahs.length) throw new Error("لا يوجد تفسير لهذه السورة");
  return ayahs.map((ayah, index) => ({
    numberInSurah: ayah.numberInSurah ?? index + 1,
    text: String(ayah.text ?? ""),
  }));
}

/* ------------------------------ العرض ------------------------------ */

/**
 * يرسم نصّ السورة (عادي أو ملوّن بالتجويد).
 * @param {{numberInSurah:number,text:string,html?:string}[]} verses
 * @param {HTMLElement} body
 * @param {number} fontSize
 */
export function renderVerses(verses, body, fontSize) {
  body.innerHTML = verses
    .map((verse) => {
      const content = verse.html ?? escapeHtml(verse.text);
      return (
        `<span class="ayah" data-ayah="${verse.numberInSurah}">${content} ` +
        `<span class="ayah-number">۝${toArNum(verse.numberInSurah)}</span></span> `
      );
    })
    .join("");
  body.style.setProperty("--quran-fs", `${fontSize}px`);
}

/**
 * يرسم الترجمة كلمة بكلمة.
 * @param {Array<{numberInSurah:number,words:Array,translation:string}>} verses
 * @param {HTMLElement} body
 * @param {number} fontSize
 */
export function renderWordByWord(verses, body, fontSize) {
  body.style.setProperty("--quran-fs", `${fontSize}px`);
  body.innerHTML = verses
    .map((verse) => {
      const words = verse.words
        .map((word) => {
          const arabic = escapeHtml(word.text_uthmani ?? word.text ?? "");
          const meaning = escapeHtml(word.translation?.text ?? "");
          return `<span class="wbw-word">${arabic}${meaning ? `<b>${meaning}</b>` : ""}</span>`;
        })
        .join(" ");
      return (
        `<span class="ayah wbw-ayah" data-ayah="${verse.numberInSurah}">${words} ` +
        `<span class="ayah-number">۝${toArNum(verse.numberInSurah)}</span></span>` +
        (verse.translation
          ? `<span class="wbw-translate">${escapeHtml(verse.translation)}</span>`
          : "")
      );
    })
    .join("");
}

/**
 * يرسم نصّ التفسير، مميّزًا بدايات الآيات.
 * @param {{numberInSurah:number,text:string}[]} entries
 * @param {HTMLElement} holder
 * @param {string} label اسم نوع التفسير
 */
export function renderTafsir(entries, holder, label) {
  holder.innerHTML =
    `<p class="note-line">التفسير: ${escapeHtml(label)}</p>` +
    entries
      .map(
        (entry) =>
          `<p class="tafsir-ayah">الآية ${toArNum(entry.numberInSurah)}</p>` +
          `<p>${escapeHtml(entry.text)}</p>`,
      )
      .join("");
  holder.hidden = false;
}

/**
 * يبني نصّ آية مع مرجعها للنسخ والمشاركة.
 * @param {{name:string,number:number}} surah
 * @param {{numberInSurah:number,text:string}} ayah
 * @returns {string}
 */
export function ayahWithRef(surah, ayah) {
  const ref = `${surah.name} — الآية ${toArNum(ayah.numberInSurah)}`;
  return `${ayah.text}\n﴿${ref}﴾`;
}
