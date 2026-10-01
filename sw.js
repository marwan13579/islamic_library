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
 *   5) الإشعارات تُعرض من هنا لتعمل عند إغلاق الصفحة (أندرويد).
 *
 * ملاحظة: عند كل نشر ارفع CACHE_VERSION ليتخلّص المستخدم من الكاش القديم.
 */

const CACHE_VERSION = "islamic-library-v33";
const CACHE = CACHE_VERSION;

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
  "./hub-return.js",
  "./calculations.js",
  "./backup-core.js",
  "./service-messages.js",
  "./khatma-core.js",
  "./tailwind.generated.css",
  "./fonts.css",
  "./vendor/quran-arabic.json",
  "./vendor/html2canvas.min.js",
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
  "./23-search.html", "./24-ibadat.html", "./25-azkar-shamila.html", "./26-daily-system.html",
  "./27-hadith.html", "./28-hijri.html", "./29-prayer-times.html", "./30-quran-full.html",
  "./31-card-maker.html", "./32-radio-hub.html",
  // بنية المشروع الجديدة
  "./src/site/noor.html", "./src/site/site.css", "./src/site/site.js",
  "./src/site/render.js", "./src/site/sections.js", "./src/assets/icons.svg",
  "./src/app/app.html", "./src/app/app.css", "./src/app/app.js", "./src/app/tabs.js",
  "./src/app/quran-read.js",
  "./src/lib/review.js", "./src/data/review-references.js", "./src/data/lessons-extra.js", "./src/data/forbidden-times.js", "./src/lib/quran-audio.js", "./src/lib/serve-hint.js", "./src/site/review.html", "./src/types.js", "./tools.css",
  "./src/lib/text.js", "./src/lib/storage.js", "./src/lib/dates.js", "./src/lib/islamic.js",
  "./src/lib/api.js", "./src/lib/share.js", "./src/lib/b64.js", "./src/lib/idb.js",
  "./src/lib/pwa.js",
  "./src/components/theme.js", "./src/components/modal.js", "./src/components/toast.js",
  "./src/components/blocks.js", "./src/components/certificate.js", "./src/components/quiz.js",
  "./src/data/manhaj-lessons.js", "./src/data/lessons.js", "./src/data/scholars.js",
  "./src/data/sayings.js", "./src/data/seerah.js", "./src/data/prophets.js", "./src/data/kids.js",
  "./src/data/qa.js", "./src/data/duas.js", "./src/data/adhkar.js", "./src/data/daily.js",
  "./src/data/names99.js", "./src/data/question-bank.js", "./src/data/app-athkar.js",
  "./src/data/app-duas.js", "./src/data/hadiths.js", "./src/data/radio.js",
  "./src/data/hijri-events.js", "./src/data/app-daily.js", "./src/data/cities.js",
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

const absolute = (url) => new URL(url, SCOPE).href;

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
});

/* ------------------------------ الإشعارات ------------------------------ */

async function showNotification({ title, body, tag }) {
  if (self.registration.showNotification) {
    await self.registration.showNotification(title, {
      body,
      tag,
      dir: "rtl",
      lang: "ar",
      icon: absolute("icons/icon-192.png"),
      badge: absolute("icons/favicon-32.png"),
      vibrate: [200, 100, 200],
      requireInteraction: false,
      data: { url: absolute("src/app/app.html#tab/prayer") },
    });
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || absolute("src/app/app.html#tab/prayer");
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
    }
    return;
  }

  // 2) التنقّل بين الصفحات: شبكة أولًا ثم الكاش ثم صفحة عدم الاتصال.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy).catch(() => {}));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE);
          const cached =
            (await cache.match(request)) ||
            (await cache.match(absolute(url.pathname.replace(SCOPE.pathname, "")))) ||
            (await cache.match(APP_SHELL));
          return cached || (await cache.match(OFFLINE_PAGE)) || Response.error();
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

  // 4) أي مورد آخر داخل النطاق (مسارات ديناميكية): يمرّ للشبكة دون تخزين —
  //    تفاديًا لتخزين ردود لا نعرف صلاحيتها.
});
