"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "dist");
const ROOT_ASSET = /\.(?:html|js|css|svg|ico|pdf)$/i;

fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.mkdirSync(OUTPUT, { recursive: true });

for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.isFile() && (ROOT_ASSET.test(entry.name) || entry.name === "manifest.webmanifest")) {
    fs.copyFileSync(path.join(ROOT, entry.name), path.join(OUTPUT, entry.name));
  }
}

for (const directory of ["icons", "src", "vendor", "content", "islamic-videos", "locales"]) {
  const from = path.join(ROOT, directory);
  if (!fs.existsSync(from)) continue;
  fs.cpSync(from, path.join(OUTPUT, directory), { recursive: true });
}

const sw = fs.readFileSync(path.join(OUTPUT, "sw.js"), "utf8");
const shell = sw.match(/const SHELL = \[([\s\S]*?)\n\];/);
if (!shell) throw new Error("Could not read the service worker shell asset list.");

const missing = [...shell[1].matchAll(/["']([^"']+)["']/g)]
  .map((match) => match[1].replace(/^\.\//, ""))
  .filter((asset) => !fs.existsSync(path.join(OUTPUT, asset)));
if (missing.length) {
  throw new Error(`Deployment output is missing service-worker assets:\n${missing.join("\n")}`);
}

/* ---------------------------------------------------------------------------
 * robots.txt و sitemap.xml
 *
  * المشروع يُنشر على Vercel فقط، والنطاق ثابت إلا إذا
  * تم تغييره عبر المتغيّر SITE_ORIGIN. القيمة الافتراضية
  * نطاق مشروع Vercel (https://islamic-library-green.vercel.app).
  * ------------------------------------------------------------------------- */

const ORIGIN = (process.env.SITE_ORIGIN || "https://islamic-library-green.vercel.app").replace(/\/+$/, "");

const SITE_PAGES = [
  ["", "رفيق المسلم اليومي — الصلاة والورد وآية اليوم والأذكار"],
  ["encyclopedia.html", "الموسوعة الإسلامية — موسوعة رقمية شاملة: قرآن، حديث، تفسير، عقيدة، فقه، سيرة، أذكار، تاريخ، مكتبة، أدوات"],
  ["30-quran-full.html", "القرآن الكريم — مصحف كامل بتلاوة وترجمة وتفسير"],
  ["25-azkar-shamila.html", "أذكار الصباح والمساء والنوم وبعد الصلاة كاملة"],
  ["1-adhkar.html", "نور الذكر — أذكار وأدعية وأحاديث"],
  ["29-prayer-times.html", "مواقيت الصلاة مع العدّ التنازلي"],
  ["22-qibla.html", "اتجاه القبلة"],
  ["17-wird.html", "ورد القراءة اليومي وخطة الختمة"],
  ["34-khatma.html", "الختمة الجماعية — وزّع الأجزاء وتابع الإنجاز"],
  ["27-hadith.html", "الأحاديث الشريف موثّقة"],
  ["3-arbaeen.html", "الأربعون النووية بشرح مختصر"],
  ["15-tasbeeh-jamai.html", "التسبيح الجماعي"],
  ["18-qada.html", "متابعة صيام القضاء"],
  ["10-zakat.html", "حاسبة الزكاة"],
  ["14-mawarith.html", "حاسبة المواريث"],
  ["28-hijri.html", "التقويم الهجري والمناسبات"],
  ["31-card-maker.html", "صانع البطاقات الدعوية"],
  ["26-daily-system.html", "نظام حياة المسلم — يومك مرتبط بالصلاة"],
  ["24-ibadat.html", "دليل العبادات — الوضوء والصلاة والصيام والزكاة"],
  ["11-hajj-umrah.html", "دليل الحج والعمرة"],
  ["12-mustajab.html", "أوقات الإجابة والدعاء"],
  ["8-qasas-anbiya.html", "قصص الأنبياء"],
  ["9-seerah.html", "السيرة النبوية"],
  ["5-asmaulhusna.html", "أسماء الله الحسنى"],
  ["src/site/noor.html", "نور الهدى — المنهج التعليمي والدروس والاختبارات"],
  ["src/app/app.html", "بوابة النور — المصحف والأذكار والمواقيت"],
  ["islamic-videos/", "مكتبة الفيديو الإسلامية — قنوات يوتيوب موثّقة مصنّفة بالعمر واللغة والمجال"],
];

const escapeXml = (value) => String(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...SITE_PAGES.map(([path, description]) => [
    "  <url>",
    `    <loc>${escapeXml(`${ORIGIN}/${path}`)}</loc>`,
    "    <changefreq>weekly</changefreq>",
    "    <priority>0.7</priority>",
    `    <description>${escapeXml(description)}</description>`,
    "  </url>",
  ].join("\n")),
  "</urlset>",
  "",
].join("\n");

const robots = [
  "User-agent: *",
  "Allow: /",
  "",
  "# بلا إعلانات ولا تتبّع، فلا حاجة لحظر شيء.",
  `Sitemap: ${ORIGIN}/sitemap.xml`,
  "",
].join("\n");

fs.writeFileSync(path.join(OUTPUT, "sitemap.xml"), sitemap, "utf8");
fs.writeFileSync(path.join(OUTPUT, "robots.txt"), robots, "utf8");

console.log(`Prepared Vercel output in dist/ (${missing.length === 0 ? "service-worker assets verified" : "failed"}).`);
console.log(`Sitemap and robots.txt written for ${ORIGIN} (${SITE_PAGES.length} pages). Override with SITE_ORIGIN.`);