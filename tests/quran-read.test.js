"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const load = (relative) => import(`file://${path.join(__dirname, "..", "src", relative)}`);

/** بديل DOM بسيط يكفي لاختبار دوال الرسم. */
function fakeBody() {
  return {
    innerHTML: "",
    style: { props: {}, setProperty(name, value) { this.props[name] = value; } },
  };
}

test("tafsir type keys map to AlQuran Cloud edition ids", async () => {
  const { TAFSIR_TYPES, editionId } = await load("app/quran-read.js");
  assert.deepEqual(TAFSIR_TYPES.map((t) => t.key), ["ar.muyassar", "ar.jalalayn", "en.sahih"]);
  assert.equal(editionId("ar.muyassar"), "ar-muyassar");
  assert.equal(editionId("ar.jalalayn"), "ar-jalalayn");
  assert.equal(editionId("en.sahih"), "en-sahih");
  assert.equal(editionId(), "ar-muyassar", "الافتراضي هو الميسّر");
});

test("renderVerses marks ayah numbers and honours font size", async () => {
  const { renderVerses } = await load("app/quran-read.js");
  const body = fakeBody();
  renderVerses(
    [
      { numberInSurah: 1, text: "بِسْمِ ٱللَّهِ" },
      { numberInSurah: 2, text: "ٱلْحَمْدُ" },
    ],
    body,
    34,
  );
  assert.equal(body.style.props["--quran-fs"], "34px");
  assert.match(body.innerHTML, /data-ayah="1"/);
  assert.match(body.innerHTML, /data-ayah="2"/);
  assert.match(body.innerHTML, /۝١/);
  assert.match(body.innerHTML, /۝٢/);
  assert.match(body.innerHTML, /بِسْمِ ٱللَّهِ/);
});

test("renderVerses escapes plain text but keeps trusted tajweed markup", async () => {
  const { renderVerses } = await load("app/quran-read.js");
  const body = fakeBody();
  renderVerses(
    [
      { numberInSurah: 1, text: "<script>alert(1)</script>" },
      {
        numberInSurah: 2,
        text: "قَالَ",
        html: 'قَالَ <span class="tj-madd">قَالَ</span>',
      },
    ],
    body,
    28,
  );
  assert.match(body.innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(body.innerHTML, /<script>/);
  assert.match(body.innerHTML, /class="tj-madd"/);
});

test("renderWordByWord pairs each word with its meaning", async () => {
  const { renderWordByWord } = await load("app/quran-read.js");
  const body = fakeBody();
  renderWordByWord(
    [
      {
        numberInSurah: 1,
        words: [
          { text_uthmani: "ٱلْحَمْدُ", translation: { text: "All praise" } },
          { text_uthmani: "لِلَّهِ" },
        ],
        translation: "All praise is for Allah",
      },
    ],
    body,
    30,
  );
  assert.match(body.innerHTML, /wbw-word/);
  assert.match(body.innerHTML, /ٱلْحَمْدُ<b>All praise<\/b>/);
  assert.match(body.innerHTML, /لِلَّهِ<\/span>/, "الكلمة بلا معنى تبقى بلا <b>");
  assert.match(body.innerHTML, /wbw-translate/);
  assert.match(body.innerHTML, /All praise is for Allah/);
  assert.equal(body.style.props["--quran-fs"], "30px");
});

test("renderWordByWord escapes word and translation payloads", async () => {
  const { renderWordByWord } = await load("app/quran-read.js");
  const body = fakeBody();
  renderWordByWord(
    [
      {
        numberInSurah: 1,
        words: [{ text_uthmani: "<img onerror=alert(1)>", translation: { text: "<b>x</b>" } }],
        translation: "<script>alert(2)</script>",
      },
    ],
    body,
    24,
  );
  assert.doesNotMatch(body.innerHTML, /<img/);
  assert.doesNotMatch(body.innerHTML, /<script>/);
  assert.match(body.innerHTML, /&lt;img onerror=alert\(1\)&gt;/);
});

test("renderWordByWord survives a verse with no words", async () => {
  const { renderWordByWord } = await load("app/quran-read.js");
  const body = fakeBody();
  assert.doesNotThrow(() =>
    renderWordByWord([{ numberInSurah: 7, words: [], translation: "" }], body, 22),
  );
  assert.match(body.innerHTML, /data-ayah="7"/);
});

test("renderTafsir labels the source and reveals the holder", async () => {
  const { renderTafsir } = await load("app/quran-read.js");
  const holder = { innerHTML: "", hidden: true };
  renderTafsir(
    [
      { numberInSurah: 1, text: "تفسير الآية الأولى" },
      { numberInSurah: 2, text: "تفسير <b>الثانية</b>" },
    ],
    holder,
    "الميسّر",
  );
  assert.equal(holder.hidden, false);
  assert.match(holder.innerHTML, /التفسير: الميسّر/);
  assert.match(holder.innerHTML, /الآية ١/);
  assert.match(holder.innerHTML, /الآية ٢/);
  assert.match(holder.innerHTML, /&lt;b&gt;الثانية&lt;\/b&gt;/);
});

test("ayahWithRef appends a quoted reference in Arabic numerals", async () => {
  const { ayahWithRef } = await load("app/quran-read.js");
  assert.equal(
    ayahWithRef({ name: "البقرة", number: 2 }, { numberInSurah: 255, text: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ" }),
    "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ\n﴿البقرة — الآية ٢٥٥﴾",
  );
});