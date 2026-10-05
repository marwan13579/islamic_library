"use strict";

/**
 * إدماج الإذاعات بالقرّاء في صفحة واحدة.
 *
 * ما يفحصه: أن المحطة المفحوصة لا تتكرّر بما في البيان، ولا تُعرض بثًّا
 * غير آمن، وأن الاسم الواحد يربط القارئَ بمحطتِه وبسورِه في الاتجاهين،
 * وأن الصفحة القديمة تحيل إلى الجديدة فلا تموت روابطٌ قديمة.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

test("☑ الإذاع: المحطة المفحوصة مقدَّمة، ولا تكرار ولا بثٌّ غير آمن", async () => {
  const { mergedStations, streamKey } = await load("src/lib/audio-hub.js");
  const { LIVE_STATIONS } = await load("src/data/radio-live.js");
  const radio = JSON.parse(read("content/radio.json"));

  const merged = mergedStations(radio);
  assert.equal(merged.length, radio.length - 1 + 3, "العدد لا يطابق ما في البيان");
  assert.deepEqual(
    merged.slice(0, LIVE_STATIONS.length).map((s) => s.link),
    LIVE_STATIONS.map((s) => s.link),
    "المحطات المفحوصة ليست أول القائمة",
  );
  assert.ok(merged.slice(0, LIVE_STATIONS.length).every((s) => s.featured), "فقدت علامة الفحص");

  const keys = merged.map((s) => streamKey(s.link));
  assert.equal(new Set(keys).size, keys.length, "محطةٌ مكرَّرة في القائمة");
  assert.ok(
    merged.every((s) => /^https:/i.test(s.link)),
    "بثٌّ غير آمن في القائمة: المتصفّح يحجبه كمحتوى مخلوط",
  );
  for (const station of LIVE_STATIONS) assert.match(station.link, /^https:\/\//);
});

test("☑ الإدماج: لكل قارئٍ بثُه، ولكل محطةٍ سورُ صاحبها", async () => {
  const { mergedStations, stationForReciter, reciterForStation, buildReciterIndex } =
    await load("src/lib/audio-hub.js");
  const radio = JSON.parse(read("content/radio.json"));
  const stations = mergedStations(radio);
  const reciters = (JSON.parse(read("content/reciters.json")).reciters || []);

  const index = buildReciterIndex(reciters);
  assert.ok(index.length > 100, `فهرس القرّاء قصير: ${index.length}`);

  const husary = reciters.find((r) => r.name.includes("الحصري"));
  const station = stationForReciter(husary, stations);
  assert.ok(station, "الحصري بلا إذاعة");
  assert.match(station.link, /alhussary/);

  /* الرحلة كاملة: محطة البث تردّ إلى القارئ، فتفتح سوره. */
  const back = reciterForStation(station, index);
  assert.equal(back.name, husary.name);

  let paired = 0;
  for (const reciter of reciters) if (stationForReciter(reciter, stations)) paired += 1;
  assert.ok(paired > 100, `قرّاءٌ بلا إذاعة: ${paired} من ${reciters.length}`);

  /* ولا خطأ في الاتجاه: محطةٌ لغير القرّاء لا تُحسَب لأحد. */
  const other = stations.find((s) => /ترجمه|translation/i.test(s.name));
  if (other) assert.equal(reciterForStation(other, index), null);
});

test("☑ الصفحة: الإذاعات في صفحة القرّاء، والقديمة تحيل إليها", () => {
  const page = read("40-reciters.html");
  assert.match(page, /mergedStations/, "الإذاعات غير مدمجة");
  assert.match(page, /stationForReciter/, "لا رابط من القارئ إلى بثّه");
  assert.match(page, /reciterForStation/, "لا رابط من الإذاعة إلى سور صاحبها");
  assert.match(page, /from_hash|FROM_HASH/, "لا رابط عميق لتبويب الإذاعات");
  assert.match(page, /live: true|live\)/, "البثُّ الحيُّ بلا وسمٍ للمشغّل");
  /* المحطات المفحوصة وحدها تُفحص شبكيًا، فلا بُدّ أن يقرأ الفحص هذا الملف. */
  assert.match(read("scripts/check-streams.cjs"), /data[\s\\\/]+radio-live\.js/);

  const old = read("32-radio-hub.html");
  assert.match(old, /url=40-reciters\.html#radio/, "الصفحة القديمة لا تحيل إلى الجديدة");
  assert.match(old, /name="robots"[^>]*noindex/, "صفحة تحيلة قابلة للفهرسة");
  assert.match(old, /href="40-reciters\.html#radio"/, "لا رابط احتياطي لمن لم تُنتقل صفحته");
});

test("☑ المشغّل: البثُّ الحيُّ بلا شريط تقدّمٍ ولا وقت", async () => {
  const source = read("src/lib/player.js");
  assert.match(source, /markLive/, "لا وضعٌ للبث الحيّ في المشغّل");
  assert.match(source, /Number\.isFinite\(audio\.duration\)/, "المدّة غيرُ مفحوصة");
  assert.match(read("library.css"), /\[data-live="1"\]/, "شريط التقدّم يظهر في البث الحيّ");
});