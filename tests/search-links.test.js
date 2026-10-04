"use strict";

/**
 * الروابط السياقية في التفسير، والرابط الأساسي للقارئ.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

test("التفسير يفتح سورةً بالرابط العميق", () => {
  const html = read("35-tafsir.html");
  assert.match(html, /URLSearchParams\(location\.search\)\.get\("s"\)/, "الصفحة لا تقرأ ?s=");
  assert.match(html, /a\.href = `\?s=\$\{s\}`/, "شريط التنقّل لا يبني ?s=");
  assert.doesNotMatch(html, /href = `\?juz=/, "بقي رابط ?juz= الميت في الصفحة");
  assert.match(html, /const last = parts\.surahs\.length;/, "الحدّ ثابت على ١١٤");
  assert.match(html, /if \(sura\.no < last\)/, "شريط التنقّل لم يقرأ الحدّ من البيان");
});

test("الرابط الأساسي للقارئ لم يتغيّر", () => {
  const html = read("reader.html");
  assert.match(html, /reader\.html\?type=\$\{encodeURIComponent\(recent\.type\)\}&id=\$\{encodeURIComponent\(recent\.id\)\}/, "الرابط الدقيق تغيّر");
});
