"use strict";

/**
 * كلفة الترتيب: «الأحدث» و«الأقدم» اتجاها ترتيب القوائم، فيكفي أن تُقرأ
 * نافذة من طرفها. وكان كل ترتيب آخر يقرأ القوائم كلها — عشرة ميغابايت
 * للفتاوى — ليرتّب ثلاثين عنصرًا فقط.
 *
 * القياس في ملف مستقل: `lib/shards` يحفظ ما قرأه في ذاكرة واحدة للصفحة،
 * فلو سبق هذا الملف اختبارٌ آخر لما قيس شيء.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");

/** المسارات التي طُلبت فعلًا. */
const served = [];

/** يخدم ملفات المحتوى من القرص ويسجّل كل طلب. */
globalThis.fetch = async (url) => {
  const file = path.join(CONTENT, String(url).replace(/^.*content\//, ""));
  served.push(String(url));
  if (!fs.existsSync(file)) {
    return { ok: false, status: 404, json: async () => { throw new Error("غير موجود"); } };
  }
  const text = fs.readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

/** @param {string} type @returns {number} عدد ملفات القوائم المقروءة */
const listReads = (type) => served.filter((u) => u.includes(`library/${type}/list/`)).length;

test("صفحة «الأحدث» تقرأ ملفًّا واحدًا لا القوائم كلها", async () => {
  const { browse } = await import(path.join(ROOT, "src/lib/library.js"));
  await browse("fatwa", { page: 1, perPage: 30, sort: "newest" });
  assert.equal(listReads("fatwa"), 1, `قرأت ${listReads("fatwa")} ملفًا`);
});

test("صفحة «الأقدم» تقرأ ملفًّا واحدًا لا القوائم كلها", async () => {
  const { browse } = await import(path.join(ROOT, "src/lib/library.js"));
  served.length = 0;
  await browse("fatwa", { page: 1, perPage: 30, sort: "oldest" });
  assert.equal(listReads("fatwa"), 1, `قرأت ${listReads("fatwa")} ملفًا`);
});

test("صفحة بعيدة لا تمسح القوائم كلها", async () => {
  const { browse } = await import(path.join(ROOT, "src/lib/library.js"));
  const shards = await import(path.join(ROOT, "src/lib/shards.js"));

  /* مجموعة لكل اتجاه، فلا تخفيه ذاكرة الملفات المحمّلة في الاختبارين قبله. */
  served.length = 0;
  await browse("fatwa", { page: 400, perPage: 30, sort: "newest" });
  const fatwa = await shards.collectionMeta("fatwa");
  const forward = listReads("fatwa");
  assert.ok(
    forward < fatwa.listFiles.length,
    `الصفحة ٤٠٠ من الفتاوى قرأت ${forward} من ${fatwa.listFiles.length} ملفًا`,
  );

  served.length = 0;
  await browse("history", { page: 100, perPage: 30, sort: "oldest" });
  const history = await shards.collectionMeta("history");
  const backward = listReads("history");
  assert.ok(
    backward < history.listFiles.length,
    `الصفحة ١٠٠ من التاريخ قرأت ${backward} من ${history.listFiles.length} ملفًا`,
  );
});