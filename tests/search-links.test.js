"use strict";

/**
 * الروابط السياقية في البحث، وعمق السورة في التفسير.
 *
 * `?s=N` كان مكتوبًا في شريط التنقّل ولا يقرأه شيء، فالسابق والتالي
 * في صفحة التفسير كانا يعيدان الصفحة ولا السورة. والبحث كان يحمل حقل
 * `page` في أنواعه ولا يستعمله، فالنتيجة لا تُصل إلى صفحة مجموعتها.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** شيفرة صفحة البحث، ومعها دالّة `contextLink` نفسها. */
function contextLinkOf() {
  const html = read("23-search.html");
  const body = html.match(/function contextLink\(hit,\s*type\)\{[\s\S]*?\n\}/);
  assert.ok(body, "دالّة contextLink غير موجودة — فحصُ الروابط السياقية لا معنى له");
  /*nolint no-new-func*/
  const build = new Function(`${body[0]}; return contextLink;`);
  return build();
}

test("التففسير يفتح سورةً بالرابط العميق", () => {
  const html = read("35-tafsir.html");
  assert.match(html, /URLSearchParams\(location\.search\)\.get\("s"\)/, "الصفحة لا تقرأ ?s=");
  assert.match(html, /a\.href = `\?s=\$\{s\}`/, "شريط التنقّل لا يبني ?s=");
  /* لم يبقَ بناءُ ?juz= الميت. */
  assert.doesNotMatch(html, /href = `\?juz=/, "بقي رابط ?juz= الميت في الصفحة");
  /* والحدّ من عدد السور في البيان، لا من رقمٍ ثابت. */
  assert.match(html, /const last = parts\.surahs\.length;/, "الحدّ ثابت على ١١٤");
  assert.match(html, /if \(sura\.no < last\)/, "شريط التنقّل لم يقرأ الحدّ من البيان");
});

test("كل نوع بحث له صفحة مجموعة قائمة", () => {
  const html = read("23-search.html");
  const types = [...html.matchAll(/\{id:"([a-z]+)",\s*label:"[^"]+",\s*page:"([^"]*)"\}/g)];
  assert.ok(types.length >= 6, `أنواع بصفحة ${types.length}`);
  for (const [, id, page] of types) {
    assert.ok(page, `${id}: بلا صفحة مجموعة`);
    assert.ok(fs.existsSync(path.join(ROOT, page)), `${id}: الصفحة مفقودة ${page}`);
  }
});

test("الرابط السياقي للتفسير يذهب إلى سورته لا إلى الجذر", () => {
  const link = contextLinkOf();
  const tafsir = { id: "tafsir-2-255", type: "tafsir", extra: [2, 255] };
  assert.equal(link(tafsir, { page: "35-tafsir.html" }), "35-tafsir.html?s=2");

  const hisn = { id: "hisn-1", type: "hisn" };
  assert.equal(link(hisn, { page: "36-hisn.html" }), "36-hisn.html?no=1");

  /* بلا عمقٍ فيعود إلى صفحة المجموعة نفسها. */
  assert.equal(link({ id: "binbaz-1", type: "fatwa" }, { page: "37-fatwa.html" }), "37-fatwa.html");

  /* ولا صفحة مجموعة فبلا رابطٍ ثانٍ. */
  assert.equal(link({ id: "x", type: "fatwa" }, { page: "" }), null);
  assert.equal(link({ id: "x", type: "fatwa" }, null), null);
});

test("الرابط الأساسي للقارئ لم يتغيّر", () => {
  /* الرابط الدقيق يبقى أولًا، فلم يتغيّر سلوك النتيجة. */
  const html = read("23-search.html");
  assert.match(html, /reader\.html\?type=\$\{encodeURIComponent\(hit\.type\)\}&id=/, "الرابط الدقيق تغيّر");
  assert.match(html, /r\.link/, "لم يبقَ الرابط الأساسي");
});
