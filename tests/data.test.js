"use strict";

/**
 * فحص دخان: يتأكد أن كل وحدة تُحمَّل بلا أخطاء، وأن البيانات مطابقة للمخزون.
 * لا يحتاج متصفحًا لأن الوحدات لا تلمس الـ DOM وقت التحميل.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = path.join(root, "src");

const MODULES = [
  "lib/text.js",
  "lib/storage.js",
  "lib/dates.js",
  "lib/islamic.js",
  "lib/api.js",
  "lib/share.js",
  "lib/b64.js",
  "lib/idb.js",
  "components/theme.js",
  "components/modal.js",
  "components/toast.js",
  "components/blocks.js",
  "components/certificate.js",
  "components/quiz.js",
  "site/sections.js",
  "site/render.js",
  "data/manhaj-lessons.js",
  "data/lessons.js",
  "data/scholars.js",
  "data/sayings.js",
  "data/seerah.js",
  "data/prophets.js",
  "data/kids.js",
  "data/qa.js",
  "data/duas.js",
  "data/adhkar.js",
  "data/daily.js",
  "data/names99.js",
  "data/question-bank.js",
  "data/app-athkar.js",
  "data/app-duas.js",
  "data/hadiths.js",
  "data/radio.js",
  "data/hijri-events.js",
  "data/app-daily.js",
  "data/cities.js",
];

test("all modules parse and load", async () => {
  for (const relative of MODULES) {
    const file = path.join(src, relative);
    assert.ok(fs.existsSync(file), `missing ${relative}`);
    await import(`file://${file}`);
  }
});

test("extracted and merged content keeps the documented inventory", async () => {
  const manhaj = await import(`file://${path.join(src, "data/manhaj-lessons.js")}`);
  const lessons = await import(`file://${path.join(src, "data/lessons.js")}`);
  const scholars = await import(`file://${path.join(src, "data/scholars.js")}`);
  const names = await import(`file://${path.join(src, "data/names99.js")}`);
  const bank = await import(`file://${path.join(src, "data/question-bank.js")}`);

  assert.equal(manhaj.MANHAJ_LESSONS.length, 12);
  assert.equal(lessons.LESSONS.length, 9);
  assert.equal(scholars.SCHOLARS.length, 25);
  assert.equal(names.NAMES99.length, 99);
  assert.equal(bank.QUESTION_BANK_SIZE, 154);

  const mcat = new Set(manhaj.MANHAJ_LESSONS.map((item) => item.mcat));
  assert.deepEqual([...mcat].sort(), ["akhlaq", "aqeedah", "bidah", "ittiba", "usul"]);
});

test("lesson bodies are structured blocks, never raw HTML", async () => {
  const { MANHAJ_LESSONS } = await import(`file://${path.join(src, "data/manhaj-lessons.js")}`);
  const { LESSONS } = await import(`file://${path.join(src, "data/lessons.js")}`);
  const allowed = new Set([
    "section", "h3", "p", "ul", "ol", "evidence", "hadith", "quote", "note", "warn", "group",
  ]);
  for (const lesson of [...MANHAJ_LESSONS, ...LESSONS]) {
    assert.ok(Array.isArray(lesson.body) && lesson.body.length > 0, `${lesson.id} بلا محتوى`);
    const walk = (blocks) => {
      for (const block of blocks) {
        assert.ok(allowed.has(block.type), `نوع كتلة غير معروف: ${block.type}`);
        for (const [key, value] of Object.entries(block)) {
          if (typeof value === "string") {
            assert.ok(!/<[a-z/]/i.test(value), `HTML داخل ${lesson.id}.${block.type}.${key}`);
          }
        }
        if (block.children) walk(block.children);
      }
    };
    walk(lesson.body);
  }
});

test("every quiz question carries its explanation", async () => {
  const { QUESTION_BANK } = await import(`file://${path.join(src, "data/question-bank.js")}`);
  for (const category of Object.values(QUESTION_BANK)) {
    for (const question of category.questions) {
      assert.ok(question.e, `${question.q} بلا تعليل`);
      assert.ok(["easy", "medium", "hard"].includes(question.d));
      assert.ok(["mc", "tf", "fill"].includes(question.t));
      if (question.t === "mc") assert.equal(question.o.length, 4);
      if (question.t === "fill") assert.ok(Array.isArray(question.a) && question.a.length > 0);
    }
  }
});