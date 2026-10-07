/*
 * عامل الخدمة — المكتبة الإسلامية
 * ------------------------------------------------------------------
 * الاستراتيجيات:
 *   1) App shell والملفات المُدرجة مسبقًا: Cache-First (سرعة + عمل بدون إنترنت).
 *   2) أي مورد آخر داخل النطاق: Stale-While-Revalidate.
 *   3) التنقّل بين الصفحات: الشبكة أولًا، وإن فشل نقدّم الصفحة من الكاش
 *      أو صفحة offline.html.
 *   4) طلبات خارج النطاق (مصادر خارجية: المصحف، المواقيت، الإذاعة):
 *      الشبكة فقط — لا تُخزَّن ردود القرآن دائمًا (مسؤولية قانونية/شرعية).
 *   5) الإشعارات تُعرض من هنا لا من الصفحة: فيعمل ترحيبُ كل فتح
 *      وأذانُ وقته بعد إغلاق الصفحة، وفيعمّ كل صفحات الموقع.
 *
 * ملاحظة: عند كل نشر ارفع CACHE_VERSION ليتخلّص المستخدم من الكاش القديم.
 */

const CACHE_VERSION = "islamic-library-v46";
const CACHE = CACHE_VERSION;

/**
 * ذاكرة المحتوى منفصلة عن الـshell: لها ميزانيتها، وتُمحى مع ارتفاع
 * CACHE_VERSION لأن المحتوى يتغيّر بالنشر لا بتثبيت التطبيق.
 */
const CONTENT_CACHE = `${CACHE_VERSION}-content`;

const SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./favicon.ico",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png",
  "./storage-fallback.js",
  "./notify-boot.js",
  "./hub-return.js",
  "./calculations.js",
  "./backup-core.js",
  "./service-messages.js",
  "./khatma-core.js",
  "./daily-content.js",
  "./daily-companion.js",
  "./daily-home.js",
  "./daily-companion.css",
  "./engage.js",
  "./engage.css",
  // دليل المكتبة: منطق الجولة التعريفية وتنسيقها.
  "./intro-tour.js", "./intro-tour.css",
  "./fonts.css",
  "./vendor/quran-arabic.json",
  "./vendor/fontawesome/css/all.min.css",
  "./vendor/fontawesome/webfonts/fa-solid-900.woff2",
  "./vendor/fontawesome/webfonts/fa-regular-400.woff2",
  "./vendor/fontawesome/webfonts/fa-brands-400.woff2",
  "./vendor/fontawesome/webfonts/fa-v4compatibility.woff2",
  "./vendor/fonts/cairo/arabic-300.css", "./vendor/fonts/cairo/arabic-400.css",
  "./vendor/fonts/cairo/arabic-600.css", "./vendor/fonts/cairo/arabic-700.css",
  "./vendor/fonts/cairo/arabic-800.css", "./vendor/fonts/cairo/arabic-900.css",
  "./vendor/fonts/amiri/arabic-400.css", "./vendor/fonts/amiri/arabic-400-italic.css",
  "./vendor/fonts/amiri/arabic-700.css", "./vendor/fonts/scheherazade-new/arabic-400.css",
  "./vendor/fonts/scheherazade-new/arabic-700.css", "./vendor/fonts/aref-ruqaa/arabic-400.css",
  "./vendor/fonts/aref-ruqaa/arabic-700.css", "./vendor/fonts/reem-kufi/arabic-400.css",
  "./vendor/fonts/reem-kufi/arabic-700.css",
  "./vendor/fonts/cairo/files/cairo-arabic-300-normal.woff2", "./vendor/fonts/cairo/files/cairo-arabic-400-normal.woff2",
  "./vendor/fonts/cairo/files/cairo-arabic-600-normal.woff2", "./vendor/fonts/cairo/files/cairo-arabic-700-normal.woff2",
  "./vendor/fonts/cairo/files/cairo-arabic-800-normal.woff2", "./vendor/fonts/cairo/files/cairo-arabic-900-normal.woff2",
  "./vendor/fonts/amiri/files/amiri-arabic-400-normal.woff2", "./vendor/fonts/amiri/files/amiri-arabic-400-italic.woff2",
  "./vendor/fonts/amiri/files/amiri-arabic-700-normal.woff2", "./vendor/fonts/scheherazade-new/files/scheherazade-new-arabic-400-normal.woff2",
  "./vendor/fonts/scheherazade-new/files/scheherazade-new-arabic-700-normal.woff2",
  "./vendor/fonts/aref-ruqaa/files/aref-ruqaa-arabic-400-normal.woff2", "./vendor/fonts/aref-ruqaa/files/aref-ruqaa-arabic-700-normal.woff2",
  "./vendor/fonts/reem-kufi/files/reem-kufi-arabic-400-normal.woff2", "./vendor/fonts/reem-kufi/files/reem-kufi-arabic-700-normal.woff2",
  "./33-academy.html", "./34-khatma.html",
  "./1-adhkar.html", "./2-mushaf.html", "./3-arbaeen.html", "./4-salah.html", "./5-asmaulhusna.html",
  "./6-munasabat.html", "./7-ramadan.html", "./8-qasas-anbiya.html", "./9-seerah.html", "./10-zakat.html",
  "./11-hajj-umrah.html", "./12-mustajab.html", "./13-kids-adab.html", "./14-mawarith.html",
  "./15-tasbeeh-jamai.html", "./16-tadabbur.html", "./17-wird.html", "./18-qada.html",
  "./19-adab-ziyara.html", "./20-voice-azkar.html", "./21-sites-directory.html", "./22-qibla.html",
  "./24-ibadat.html", "./25-azkar-shamila.html", "./26-daily-system.html",
  "./27-hadith.html", "./28-hijri.html", "./29-prayer-times.html", "./30-quran-full.html",
  "./31-card-maker.html", "./32-radio-hub.html",
  // المكتبة المستوردة — صفحاتها وأصولها القليلة فقط.
  "./library.css", "./35-tafsir.html", "./36-hisn.html", "./37-fatwa.html",
  "./38-khutbah.html", "./39-tarikh.html", "./40-reciters.html", "./41-quiz.html",
  "./42-athan.html", "./43-siraj.html", "./reader.html",
  // الموسوعة الإسلامية
  "./encyclopedia.html", "./encyclopedia.css",
  // رفيق النور: ملفّان فقط. المحتوى ١٥٥ ك.ب يُجلَب عند أول تذكير لا عند الدخول.
  "./noor-companion.js", "./noor-content.js", "./44-noor-companion.html",
  // مكتبة الفيديو الإسلامية: صفحتان وملف تنسيق واحد ووحدتا منطق وبيانات فقط.
  "./islamic-videos/index.html", "./islamic-videos/favorites/index.html", "./islamic-videos/videos.css",
  "./src/data/islamic-channels.js", "./src/lib/video-library.js", "./src/lib/video-library-ui.js",
  "./src/lib/shards.js", "./src/lib/library.js", "./src/lib/search.js",
  "./src/lib/content-url.js",
  "./src/lib/search-aliases.js", "./src/lib/search-registry.js", "./src/lib/unified-search.js",
  "./src/lib/search-content.js", "./src/lib/search-corpora.js", "./src/components/search-modal.js",
  "./src/lib/content-ui.js", "./src/lib/audio-store.js", "./src/lib/player.js",
  "./src/lib/audio-hub.js",
  // بيان المحتوى على شبكة التوزيع (gh-pages) يُجلَب عند الطلب لا يُخزَّن هنا.
  // بنية المشروع الجديدة
  "./src/site/noor.html", "./src/site/site.css", "./src/site/site.js",
  "./src/site/render.js", "./src/site/sections.js", "./src/assets/icons.svg",
  "./src/app/app.html", "./src/app/app.css", "./src/app/app.js", "./src/app/tabs.js",
  "./src/app/quran-read.js",
  "./src/lib/review.js", "./src/data/review-references.js", "./src/data/lessons-extra.js", "./src/data/forbidden-times.js", "./src/lib/quran-audio.js", "./src/lib/serve-hint.js", "./src/site/review.html", "./src/types.js", "./tools.css",
  "./src/lib/text.js", "./src/lib/storage.js", "./src/lib/dates.js", "./src/lib/islamic.js",
   "./src/lib/api.js", "./src/lib/share.js", "./src/lib/b64.js", "./src/lib/idb.js",
   "./src/lib/content-relationships.js", "./src/lib/favorites-manager.js", "./src/lib/magnetic.js",
  "./src/lib/pwa.js",
  "./src/lib/auto-notify.js",
  "./src/components/theme.js", "./src/components/modal.js", "./src/components/toast.js",
  "./src/components/blocks.js", "./src/components/certificate.js", "./src/components/quiz.js",
"./src/components/reader-tools.js", "./src/components/search-modal.js", "./src/components/encyclopedia-nav.js",
  "./src/components/breadcrumbs.js", "./src/components/content-card.js", "./src/components/favorites-btn.js", "./src/components/search-box.js",
  "./src/data/manhaj-lessons.js", "./src/data/lessons.js", "./src/data/scholars.js",
  "./src/data/sayings.js", "./src/data/seerah.js", "./src/data/prophets.js", "./src/data/kids.js",
  "./src/data/qa.js", "./src/data/duas.js", "./src/data/adhkar.js", "./src/data/daily.js",
  "./src/data/names99.js", "./src/data/question-bank.js", "./src/data/app-athkar.js",
  "./src/data/app-duas.js", "./src/data/hadiths.js", "./src/data/radio.js", "./src/data/radio-live.js",
   "./src/data/hijri-events.js", "./src/data/app-daily.js", "./src/data/cities.js",
"./src/data/encyclopedia-categories.js", "./src/lib/encyclopedia.js", "./src/components/related-content.js", "./src/lib/progress.js",
    "./src/app/encyclopedia-main.js",   "./src/lib/progress-tracker.js", "./src/components/export-import.js",
  "./ask.html",
  "./src/lib/i18n.js", "./src/data/learning-paths.js",
  "./src/components/language-selector.js", "./src/lib/accessibility.js",
  "./src/components/accessibility-widget.js",
  "./src/lib/answer-engine.js", "./src/lib/knowledge-graph.js", "./src/lib/external-sources.js",
  "./src/lib/ask-search.js",
  "./locales/ar/common.json", "./locales/ar/navigation.json", "./locales/ar/home.json",
  "./locales/ar/quran.json", "./locales/ar/hadith.json", "./locales/ar/prayer.json",
  "./locales/ar/adhkar.json", "./locales/ar/library.json", "./locales/ar/tools.json",
  "./locales/ar/settings.json", "./locales/ar/accessibility.json", "./locales/ar/learn.json",
  "./locales/ar/stories.json", "./locales/ar/search.json", "./locales/ar/errors.json",
  "./locales/ar/forms.json",
  "./locales/en/common.json", "./locales/en/navigation.json", "./locales/en/home.json",
  "./locales/en/quran.json", "./locales/en/hadith.json", "./locales/en/prayer.json",
  "./locales/en/adhkar.json", "./locales/en/library.json", "./locales/en/tools.json",
  "./locales/en/settings.json", "./locales/en/accessibility.json", "./locales/en/learn.json",
  "./locales/en/stories.json", "./locales/en/search.json", "./locales/en/errors.json",
  "./locales/en/forms.json",
  "./locales/fr/common.json",
  "./locales/es/common.json", "./locales/de/common.json", "./locales/tr/common.json",
  "./locales/fa/common.json", "./locales/ur/common.json", "./locales/zh-CN/common.json",
  "./locales/ja/common.json", "./locales/ko/common.json", "./locales/it/common.json",
  "./locales/pt/common.json", "./locales/nl/common.json", "./locales/pl/common.json",
  "./locales/sv/common.json", "./locales/no/common.json", "./locales/da/common.json",
  "./locales/fi/common.json", "./locales/el/common.json", "./locales/cs/common.json",
  "./locales/ro/common.json", "./locales/hu/common.json", "./locales/uk/common.json",
  "./locales/ru/common.json", "./locales/bn/common.json", "./locales/hi/common.json",
  "./locales/id/common.json", "./locales/ms/common.json", "./locales/th/common.json",
  "./locales/vi/common.json", "./locales/sw/common.json", "./locales/ha/common.json",
  "./locales/am/common.json",
];

const SCOPE = new URL(self.registration.scope);
const APP_SHELL = new URL("index.html", SCOPE).href;
const OFFLINE_PAGE = new URL("offline.html", SCOPE).href;
const PRECACHED = new Set(SHELL.map((asset) => new URL(asset, SCOPE).href));

const API_HOSTS = [
  "api.aladhan.com",
  "api.alquran.cloud",
  "api.quran.com",
  "cdn.islamic.network",
  "qurango.net",
  "api.bigdatacloud.net",
];

/** أصلُ شبكة توزيع المحتوى (فرع gh-pages). */
const CONTENT_CDN_ORIGIN = "https://marwan13579.github.io";

const absolute = (url) => new URL(url, SCOPE).href;

/* أقصى مدّة يقبلها setTimeout: أسبوع واحد، وما فوقها يُجدول تكرارًا. */
const MAX_TIMEOUT = 2147483647;

/* نافذة التعويض: أذانٌ فات من هذه المدّة يُعلن عند الاستيقاظ، وما فوقها يُهمَل. */
const CATCHUP_GRACE = 20 * 60 * 1000;

/* ------------------------------ التثبيت ------------------------------ */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // نضيف كل ملف على حدة: فشل ملف واحد لا يُفشل التثبيت كله
        Promise.all(
          SHELL.map((asset) =>
            cache
              .add(new Request(absolute(asset), { cache: "reload" }))
              .catch(() => console.warn("[sw] تعذّر تخزين", asset)),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("islamic-library-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
  if (event.data && event.data.type === "notify") {
    event.waitUntil(showNotification(event.data));
  }
  if (event.data && event.data.type === "greet") {
    // الصفحة تطلب الترحيب في أوّل زيارة لا يتحكّم فيها العامل بعد.
    event.waitUntil(greetOnOpen(event.data.url).catch(() => false));
  }
  if (event.data && event.data.type === "schedule-athan") {
    /* waitUntil من الحدث لا من النطاق: self.waitUntil غير موجودة أصلًا،
       والنداء منها يرمي TypeError داخل العامل. */
    event.waitUntil(
      scheduleAthan(event.data.schedule || []).then((count) => {
        if (event.ports && event.ports[0]) event.ports[0].postMessage({ type: "scheduled", count });
      }),
    );
  }
  if (event.data && event.data.type === "cancel-athan") {
    event.waitUntil(cancelAthan());
  }
});

/* ------------------------------ جدولة الأذان ------------------------------ */

/**
 * المؤقّتات تُجدول هنا لا في الصفحة: مؤقّت الصفحة يموت بإغلاقها،
 * أما هذا فيبقى ما دام المتصفح مفتوحًا فيلفية أو في مقدمة.
 * @type {Map<string, number>}
 */
const ATHAN_TIMERS = new Map();

/** مخزن الجدول الصامد: العامل يُقتل بعد خمول قصير فيفقد ذاكرته. */
const SCHEDULE_STORE = "athan-schedule";

/** مخزن حالة الإشعارات: متى رحّبنا، وأي صلاة أعلنّاها، فلا يتكرّر شيء. */
const STATE_STORE = "notify-state";

/** رابطا المخزنين داخل نطاقه. */
const SCHEDULE_URL = new URL("./__athan", SCOPE).href;
const STATE_URL = new URL("./__notify-state", SCOPE).href;

/**
 * @typedef {{key: string, name: string, at: number, href: string}} AthanEntry
 */

/** @returns {Promise<any>} ما في مخزن، أو null إن لم يوجد أو تعذّر. */
async function readStore(store, url) {
  try {
    const cache = await caches.open(store);
    const response = await cache.match(url);
    return response ? await response.json() : null;
  } catch {
    return null;
  }
}

/** @param {string} url @param {any} data */
async function writeStore(store, url, data) {
  try {
    const cache = await caches.open(store);
    await cache.put(url, new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } }));
  } catch {
    /* التخزين ممتلئ أو محظور: يبقى في الذاكرة لهذه الجلسة */
  }
}

/** @returns {Promise<AthanEntry[]>} الجدول المحفوظ */
async function readStoredSchedule() {
  const data = await readStore(SCHEDULE_STORE, SCHEDULE_URL);
  return Array.isArray(data) ? data : [];
}

/** @param {AthanEntry[]} schedule */
async function writeStoredSchedule(schedule) {
  await writeStore(SCHEDULE_STORE, SCHEDULE_URL, schedule);
}

/* ------------------------------ حالة الإشعارات ------------------------------ */

/** @typedef {{ greetAt: number, announced: Record<string, number> }} NotifyState */

/** @type {Promise<NotifyState> | null} تُقرأ مرّة ثم يبقى في الذاكرة */
let statePromise = null;

/** @type {Promise<any>} طابور التعديلات: تعديلان متزامنان لا يضيع أحدهما */
let stateQueue = Promise.resolve();

/** @returns {Promise<NotifyState>} */
function readState() {
  statePromise ||= readStore(STATE_STORE, STATE_URL).then((data) => ({
    greetAt: Number(data && data.greetAt) || 0,
    announced: data && data.announced && typeof data.announced === "object" ? data.announced : {},
  }));
  return statePromise;
}

/**
 * يغيّر حالة الإشعارات ويحفظها.
 * @param {(current: NotifyState) => NotifyState} change
 * @returns {Promise<NotifyState>}
 */
function patchState(change) {
  const next = stateQueue.then(async () => {
    const current = await readState();
    const value = change(current);
    statePromise = Promise.resolve(value);
    await writeStore(STATE_STORE, STATE_URL, value);
    return value;
  });
  stateQueue = next.catch(() => {});
  return next;
}

/**
 * يجدول إشعارًا لكل صلاة في اليوم، ويلغي ما سبق جدولته.
 * @param {AthanEntry[]} schedule
 * @returns {Promise<number>} كم مؤقّتًا قائمًا
 */
async function scheduleAthan(schedule) {
  await clearTimers();
  await writeStoredSchedule(schedule);
  const armed = armAthan(schedule);
  await catchUpAthan(schedule);
  return armed;
}

/**
 * يشدّ المؤقّتات من جدول، متجاوزًا الأوقات التي فاتت.
 * @param {AthanEntry[]} schedule
 * @returns {number} كم مؤقّتًا قائمًا
 */
function armAthan(schedule) {
  for (const entry of schedule) {
    const at = Number(entry && entry.at);
    if (!Number.isFinite(at)) continue;
    const delay = at - Date.now();
    if (delay <= 0 || delay > MAX_TIMEOUT) continue;
    ATHAN_TIMERS.set(
      entry.key,
      setTimeout(() => {
        ATHAN_TIMERS.delete(entry.key);
        /* الجهاز قد ينام فلا يُطلق المؤقّت في موعده، فيستيقظ متأخرًا.
           نفحص الفارق: أذان فات بيوم لا يُنبَه، وأذان تأخّر دقيقة يُنبَه. */
        const late = Date.now() - at;
        if (late > 10 * 60 * 1000) return;
        fireAthan(entry).catch(() => {});
      }, delay),
    );
  }
  return ATHAN_TIMERS.size;
}

/**
 * يؤخّر مواعيد اليوم الغد: لولاه لسقط الجدول بعد آخر صلاة، وبقي
 * الموقع مغلقًا أيامًا فلا أذان ولا تنبيه. وما هو قادم يُبقى على حاله.
 * @param {AthanEntry[]} schedule
 * @returns {AthanEntry[]} جدولٌ جديد، وما لم يتغيّر فيه يبقى نفسه
 */
function rollover(schedule) {
  const now = Date.now();
  return schedule.map((entry) => {
    const at = Number(entry && entry.at);
    if (!Number.isFinite(at) || at > now) return entry;
    const next = new Date(at);
    next.setDate(next.getDate() + 1);
    return { ...entry, at: next.getTime() };
  });
}

/** يفرّغ المؤقّتات من الذاكرة فقط، بلا مساس بالمحفوظ. */
async function clearTimers() {
  for (const id of ATHAN_TIMERS.values()) clearTimeout(id);
  ATHAN_TIMERS.clear();
}

/** يلغي كل المؤقّتات ويمحو المحفوظ. */
async function cancelAthan() {
  await clearTimers();
  await writeStoredSchedule([]);
}

/**
 * يُعلن أذانًا فات ونام الجهاز أو أُغلق الموقع: فإن استيقظ العامل
 * والصلاة ما زالت في نافذتها يُنبَه عنها، ولا يُعلَن إلا مرّة واحدة.
 * @param {AthanEntry[]} schedule
 * @returns {Promise<boolean>} هل أُعلن أذانٌ فات؟
 */
async function catchUpAthan(schedule) {
  const now = Date.now();
  const pending = [];
  const announced = (await readState()).announced;
  for (const entry of schedule) {
    const at = Number(entry && entry.at);
    if (!Number.isFinite(at) || at > now || now - at > CATCHUP_GRACE) continue;
    if (Number(announced[entry.key]) === at) continue;
    pending.push(entry);
  }
  for (const entry of pending) await fireAthan(entry);
  return pending.length > 0;
}

/**
 * يُبقي الجدول قائمًا ما دام الموقع مغلقًا: يؤخّر ما فات، ويشدّ
 * المؤقّتات على الباقي، ويُعلن ما فات وهو في نافذته.
 * @param {AthanEntry[]} schedule
 * @returns {Promise<number>} كم مؤقّتًا قائمًا
 */
async function keepScheduleFresh(schedule) {
  // الإلغاء 먼저: كل فتحٍ يُعيد الجدولة، لولا الإلغاء لبقي المؤقّت
  // القديم حيًّا ينبّه عن الصلاة مرّتين.
  await clearTimers();
  const rolled = rollover(schedule);
  if (rolled.some((entry, index) => entry !== schedule[index])) await writeStoredSchedule(rolled);
  const armed = armAthan(rolled);
  await catchUpAthan(rolled);
  return armed;
}

/**
 * يُعلن الأذان ويكتب في الحالة أنه أعلن، لئلّا يُعلَن مرّتين.
 * @param {AthanEntry} entry
 * @returns {Promise<void>}
 */
async function fireAthan(entry) {
  await announceAthan(entry);
  await patchState((state) => ({ ...state, announced: { ...state.announced, [entry.key]: entry.at } }));
}

/**
 * يُعلن الأذان: إشعار لكل الأصوات، ورسالة للصفحة المفتوحة فتشغّل الصوت.
 * @param {{key: string, name: string, href: string}} entry
 */
async function announceAthan(entry) {
  await showNotification({
    title: `🕌 حان الآن وقت صلاة ${entry.name}`,
    body: "حي على الصلاة، حي على الفلاح",
    tag: `athan-${entry.key}`,
    url: entry.href,
  });
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "athan-now", name: entry.name });
  }
}

/* العامل يُقتل ويُبعث: نُعيد شدّ المؤقّتات من المحفوظ قبل أن ينام. */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    readStoredSchedule().then((schedule) => keepScheduleFresh(schedule)).catch(() => {}),
  );
});

/* استيقاظٌ مجدول بلا فتحٍ للصفحة: يُعلَن ما فات ولم يُعلَن. */
self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "athan-check") return;
  event.waitUntil(readStoredSchedule().then((schedule) => catchUpAthan(schedule)).catch(() => {}));
});

/* ------------------------------ الإشعارات ------------------------------ */

/** أقل فاصل بين ترحيبَين: فتحان متجاوران لا يصنعان إشعارين. */
const GREET_DEDUPE = 10 * 1000;

/** نقرُ المستخدم على الإشعار فتحَ صفحة: لا نرحّب به على هذا الفتح. */
const CLICK_GRACE = 60 * 1000;

/** @type {number} متى فتح آخر إشعار صفحةً */
let openedFromClickAt = 0;

/**
 * ترحيبٌ يليق بوقت اليوم — نصوصُ الصفحة نفسها، فنفس اللغة في كل مكان.
 * @param {number} hour
 * @returns {string}
 */
function greetingBody(hour) {
  if (hour < 4) return "ليلة مباركة — طلبة الليل هم السادة أولياء الله.";
  if (hour < 11) return "صباح الخير — وردك اليومي وذكر الصباح في انتظارك.";
  if (hour < 15) return "السلام عليكم — لا تنسَ صلاة الضحى والاستغفار.";
  if (hour < 19) return "أهلًا بك — آية اليوم وذكر المساء بانتظارك.";
  if (hour < 23) return "مساء الخير — الأذكار ووردك الليلي في انتظارك.";
  return "ليلة مباركة — لا تهجر القرآن.";
}

/**
 * ترحيبٌ عند كل فتح للموقع: يفتحه المستخدم فيخرج له الإشعار وحده،
 * ولو كانت الصفحة نائمة. وعرضُه من هنا فيعمّ كل الصفحات — حتى التي
 * لا تحمل منها سطرًا واحدًا — ويعمل بعد إغفائها.
 * @param {string} [url] الصفحة التي فُتحت، فيفتحها النقر عليها
 * @returns {Promise<boolean>} هل عُرض الترحيب؟
 */
async function greetOnOpen(url) {
  const now = Date.now();
  // نقرُه على الإشعار فتحُ للموقع، والجواب معروف: لا ترحيبًا ثانيًا.
  if (now - openedFromClickAt < CLICK_GRACE) return false;
  /* الفاصل يُحسم في الطابور لا بعده: ففتحان في اللحظة نفسها لا
     يتساويان في الوقت فيمرّان كلاهما. */
  let allowed = false;
  await patchState((current) => {
    if (current.greetAt && now - current.greetAt < GREET_DEDUPE) return current;
    allowed = true;
    return { ...current, greetAt: now };
  });
  if (!allowed) return false;
  return showNotification({
    title: "🕌 المكتبة الإسلامية",
    body: greetingBody(new Date(now).getHours()),
    tag: "noor-greet",
    url: url || absolute("index.html"),
  });
}

/**
 * @param {{title: string, body: string, tag?: string, url?: string}} payload
 * @returns {Promise<boolean>} هل عُرض الإشعار؟ فرفضُ الإذن لا يُعطِّل شيئًا.
 */
async function showNotification({ title, body, tag, url }) {
  if (!self.registration.showNotification) return false;
  try {
    await self.registration.showNotification(title, {
      body,
      tag,
      dir: "rtl",
      lang: "ar",
      icon: absolute("icons/icon-192.png"),
      badge: absolute("icons/favicon-32.png"),
      vibrate: [200, 100, 200],
      requireInteraction: false,
      data: { url: absolute(url || "src/app/app.html#tab/prayer") },
    });
    return true;
  } catch {
    // الإذن لم يُمنح بعد: الصفحة لا تتعطّل، وتُجرّب في فتحٍ قادم.
    return false;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || absolute("src/app/app.html#tab/prayer");
  openedFromClickAt = Date.now();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => "focus" in client);
      if (open) {
        open.navigate(target);
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

/* -------------------------------- الجلب -------------------------------- */

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === SCOPE.origin;
  const insideScope = sameOrigin && url.pathname.startsWith(SCOPE.pathname);

  // 1) خارج النطاق أو مصدر خارجي: شبكة فقط، بلا تخزين دائم.
  if (!insideScope) {
    if (API_HOSTS.includes(url.hostname) && request.mode !== "navigate") {
      event.respondWith(fetch(request).catch(() => Response.error()));
    } else if (url.origin === CONTENT_CDN_ORIGIN) {
      // المحتوى على شبكة التوزيع: تخزينٌ عند الطلب بميزانيته،
      // فيبقى قابلًا للقراءة دون اتصال بعد أول فتح.
      event.respondWith(contentStrategy(request));
    }
    return;
  }

  // 2) التنقّل بين الصفحات: شبكة أولًا ثم الكاش ثم صفحة عدم الاتصال.
  if (request.mode === "navigate") {
    /* فتحُ صفحةٍ هو فتحُ الموقع: من هنا يخرج الترحيب في كل مرة، بلا
       أن تحمل الصفحات سطرًا واحدًا، ويبقى بعد إغفاء الصفحة. */
    event.waitUntil(greetOnOpen(url.href).catch(() => false));
    /* ومن استيقظ على جدولٍ قديم (الموقع مغلقٌ منذ يوم) جدّده قبل أن
       يفوته أذان: يؤخّر ما فات، ويعلَن ما فات في نافذته. */
    event.waitUntil(readStoredSchedule().then((schedule) => keepScheduleFresh(schedule)).catch(() => 0));
    event.respondWith(
      fetch(request)
        .then((response) => {
          // لا نخزّن رد خطأ: صفحة 404 مخزَّنة تبقى حتى رفع CACHE_VERSION.
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches
                .open(CACHE)
                .then((cache) => cache.put(request, copy))
                .catch(() => {}),
            );
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          const path = absolute(url.pathname.replace(SCOPE.pathname, ""));
          const isShellPage = path === APP_SHELL || path === absolute("");
          const cached =
            (await cache.match(request)) ||
            (await cache.match(path)) ||
            // صفحة الفهرس هي الصحيحة لصفحتها هي، أما صفحة أخرى مجهولة
            // فالأصدق أن يرى المستخدم صفحة عدم الاتصال، لا فهرسًا عنوانه
            // عن صفحة أخرى.

            (isShellPage
              ? await cache.match(APP_SHELL)
              : ((await cache.match(OFFLINE_PAGE)) || (await cache.match(APP_SHELL))));
          return cached || Response.error();
        }),
    );
    return;
  }

  // 3) ملفات مُدرجة مسبقًا: Cache-First.
  if (PRECACHED.has(url.href) || PRECACHED.has(absolute(url.pathname))) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone()).catch(() => {});
          return response;
        } catch {
          return Response.error();
        }
      }),
    );
    return;
  }

  // 4) أي مورد آخر داخل النطاق: يمرّ للشبكة دون تخزين.
});

/** ميزانية التخزين بايتًا. الـshell وحده نحو ٤ م.ب، والمحتوى ٢٨٣ م.ب. */
const CONTENT_BUDGET = 96 * 1024 * 1024;

/** ما خزّنّاه من المحتوى، حتى لا نكرّر الحساب في كل طلب. */
let contentBytes = null;

/**
 * يحسب حجم ما خُزّن من المحتوى.
 * @param {Cache} cache
 * @returns {Promise<number>}
 */
async function measureContent(cache) {
  const requests = await cache.keys();
  let total = 0;
  for (const request of requests) {
    const response = await cache.match(request);
    const size = Number(response?.headers.get("content-length")) || 0;
    total += size;
  }
  return total;
}

/**
 * يقرأ: من الذاكرة فورًا، وإلا من الشبكة ثم يُخزَّن ويُبتر من الأقدم
 * حين تتجاوز الميزانية.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function contentStrategy(request) {
  const cache = await caches.open(CONTENT_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (!response.ok) return response;
    const size = Number(response.headers.get("content-length")) || 0;
    // بلا حجم نعلمه لا نخزّن: قد يكون ملفًا ضخمًا فيتجاوز الميزانية وحده.
    if (!size) return response;
    if (contentBytes === null) contentBytes = await measureContent(cache);
    if (contentBytes + size > CONTENT_BUDGET) await trimContent(cache, size);
    await cache.put(request, response.clone());
    contentBytes = (contentBytes ?? 0) + size;
    return response;
  } catch {
    return cached || Response.error();
  }
}

/**
 * يحذف من الأقدم حتى تسع الميزانية.
 * @param {Cache} cache
 * @param {number} incoming حجم ما هو قادم
 */
async function trimContent(cache, incoming) {
  const requests = await cache.keys();
  let total = 0;
  const sizes = [];
  for (const request of requests) {
    const response = await cache.match(request);
    const size = Number(response?.headers.get("content-length")) || 0;
    sizes.push({ request, size });
    total += size;
  }
  for (const row of sizes) {
    if (total + incoming <= CONTENT_BUDGET) break;
    await cache.delete(row.request);
    total -= row.size;
  }
  contentBytes = total;
}
