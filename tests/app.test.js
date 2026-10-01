"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const load = (relative) => import(`file://${path.join(root, "src", relative)}`);

const TAB_IDS = [
  "home", "quran", "khatma", "athkar", "prayer", "tracker",
  "dua", "media", "cards", "hadith", "zakat", "sadaka",
];

test("all twelve tabs render without unescaped markup", async () => {
  const tabs = await load("app/tabs.js");
  const renderers = {
    home: tabs.homeTab,
    quran: tabs.quranTab,
    khatma: tabs.khatmaTab,
    athkar: tabs.athkarTab,
    prayer: tabs.prayerTab,
    tracker: tabs.trackerTab,
    dua: tabs.duaTab,
    media: tabs.mediaTab,
    cards: tabs.cardsTab,
    hadith: tabs.hadithTab,
    zakat: tabs.zakatTab,
    sadaka: tabs.sadakaTab,
  };
  assert.deepEqual(Object.keys(renderers), TAB_IDS);
  for (const [id, render] of Object.entries(renderers)) {
    const html = render();
    assert.ok(html.length > 200, `${id} فارغ`);
    assert.doesNotMatch(html, /<\/?script/i, `${id} يحتوي وسوم script`);
    assert.doesNotMatch(html, /undefined/, `${id} يحتوي قيمة غير معرّفة`);
  }
});

test("zakat calculator panel honours the four real tabs", async () => {
  const tabs = await load("app/tabs.js");
  for (const kind of ["money", "gold", "stocks", "livestock"]) {
    const html = tabs.zakatPanelHtml(kind);
    assert.match(html, /zakatResult/);
    assert.match(html, /zakat/);
  }
  assert.match(tabs.zakatPanelHtml("gold"), /silverWeight/);
  assert.match(tabs.zakatPanelHtml("stocks"), /realEstateValue/);
});

test("search helpers filter Arabic text", async () => {
  const tabs = await load("app/tabs.js");
  const { HADITHS } = await load("data/hadiths.js");
  const { RADIO_STATIONS } = await load("data/radio.js");
  assert.match(tabs.hadithListHtml(HADITHS, "", "كلمتان"), /كلمتان خفيفتان/);
  assert.match(tabs.hadithListHtml(HADITHS, "", "لاشيء"), /لا توجد أحاديث/);
  assert.match(tabs.radioListHtml(RADIO_STATIONS, "", "الحصري"), /الحصري/);
});

test("every adhkar card displays its primary source link", async () => {
  const tabs = await load("app/tabs.js");
  const { ATHKAR_DATA } = await load("data/app-athkar.js");
  const html = ATHKAR_DATA.map((group) => tabs.renderAthkarItems(group)).join("");
  assert.equal((html.match(/class="ref" href="https:\/\//g) ?? []).length, 8);
  assert.match(html, /https:\/\/sunnah\.com\/muslim:597a/);
  assert.match(html, /رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ/);
  assert.doesNotMatch(html, /أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ/);
});

test("app pages ship a PWA manifest and security headers", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.lang, "ar");
  assert.equal(manifest.dir, "rtl");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.length >= 1);
  assert.ok(manifest.icons.every((icon) => icon.src.startsWith("./")));
  assert.ok(manifest.shortcuts.some((item) => item.name === "المصحف"));

  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  assert.match(sw, /src\/site\/noor\.html/);
  assert.match(sw, /src\/app\/app\.html/);
  assert.match(sw, /src\/data\/question-bank\.js/);

  const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
  for (const header of [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ]) {
    assert.match(headers, new RegExp(header));
  }
});

test("pages are RTL-first and keep zoom enabled", () => {
  for (const file of ["src/site/noor.html", "src/app/app.html"]) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(html, /<html lang="ar" dir="rtl"/);
    assert.doesNotMatch(html, /user-scalable=no/, "التكبير يجب أن يبقى مفعّلًا");
    assert.match(html, /skip-link/);
  }
});

test("app content inventory matches the honest numbers", async () => {
  const { ATHKAR_DATA } = await load("data/app-athkar.js");
  const { APP_DUAS } = await load("data/app-duas.js");
  const { HADITHS } = await load("data/hadiths.js");
  const { RADIO_STATIONS } = await load("data/radio.js");
  assert.equal(ATHKAR_DATA.length, 4);
  assert.equal(APP_DUAS.length, 13);
  assert.equal(HADITHS.length, 10);
  assert.equal(RADIO_STATIONS.length, 17);
  for (const station of RADIO_STATIONS) assert.match(station.url, /^https:\/\//);
});