"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const src = (relative) => `file://${path.join(__dirname, "..", "src", relative)}`;

const loadUi = () => import(src("site/render.js"));
const loadBlocks = () => import(src("components/blocks.js"));

const loadData = Promise.all([
  import(src("data/scholars.js")),
  import(src("data/sayings.js")),
  import(src("data/seerah.js")),
  import(src("data/prophets.js")),
  import(src("data/lessons.js")),
  import(src("data/manhaj-lessons.js")),
  import(src("data/names99.js")),
  import(src("data/duas.js")),
  import(src("data/adhkar.js")),
  import(src("data/kids.js")),
  import(src("data/qa.js")),
  import(src("data/daily.js")),
]).then(([scholars, sayings, seerah, prophets, lessons, manhaj, names, duas, adhkar, kids, qa, daily]) => ({
  scholars: scholars.SCHOLARS,
  sayings: sayings.SAYINGS,
  seerah: seerah.SEERAH,
  prophets: prophets.PROPHETS,
  lessons: lessons.LESSONS,
  manhaj: manhaj.MANHAJ_LESSONS,
  names: names.NAMES99,
  duas: duas.DUAS,
  adhkar: adhkar.ADHKAR,
  kids: kids.KIDS,
  qa: qa.QA,
  daily: daily.DAILY_VERSES,
}));

const SCRIPTS = /<\/?script/i;

test("grids render Arabic content and escape every caption", async () => {
  const [{ scholars, prophets, names, qa }, ui] = await Promise.all([loadData, loadUi()]);
  const hostile = [{ ...scholars[0], bio: `<script>alert("x")</script>`, name: `سليم & <>名字` }];
  const html = ui.scholarsGrid(hostile, "سليم");
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, SCRIPTS);
  assert.match(html, /<mark>سليم<\/mark>/);
  assert.match(html, /&amp;/);

  assert.match(ui.prophetsGrid(prophets), /data-open="prophet"/);
  assert.match(ui.namesGrid(names), /data-open="name"/);
  assert.match(ui.qaGrid(qa), /<details>/);
});

test("empty states are friendly instead of blank", async () => {
  const ui = await loadUi();
  assert.match(ui.namesGrid([], ""), /لا توجد نتائج/);
  assert.match(ui.lessonsGrid([], ""), /لا توجد دروس/);
});

test("lesson modal keeps sources, FAQ and structured blocks", async () => {
  const [dataset, ui, renderer] = await Promise.all([loadData, loadUi(), loadBlocks()]);
  const lesson = dataset.lessons.find((item) => item.id === "ghusl");
  const html = ui.lessonModal(lesson);
  assert.match(html, /lesson-section/);
  assert.match(html, /sources-box/);
  assert.match(html, /<details>/);
  assert.doesNotMatch(html, SCRIPTS);

  const text = renderer.blocksToText(lesson.body);
  assert.match(text, /تعريفه ومشروعيته/);
  assert.doesNotMatch(text, /\*\*/, "علامات التمييز لا تظهر في النص المنسوخ");
});

test("every block type renders without leaking raw markup", async () => {
  const renderer = await loadBlocks();
  const sample = [
    { type: "section", title: "قسم", children: [{ type: "p", text: "فقرة **غامقة**" }] },
    { type: "h3", text: "عنوان" },
    { type: "p", text: "نص" },
    { type: "ul", items: ["أول", "ثانٍ"] },
    { type: "ol", items: ["واحد"] },
    { type: "evidence", ayah: "﴿آية﴾", ref: "البقرة: ٢٥٥" },
    { type: "hadith", text: "حديث", ref: "البخاري" },
    { type: "quote", text: "قول", scholar: "عالم" },
    { type: "note", text: "ملاحظة" },
    { type: "warn", text: "تحذير" },
    { type: "group", children: [{ type: "p", text: "مجمّع" }] },
  ];
  const html = renderer.renderBlocks(sample);
  for (const marker of ["lesson-section", "<h3>", "<ul>", "<ol>", "evidence", "hadith", "salaf-quote", "note-box", "warn-box", "<strong>غامقة</strong>"]) {
    assert.ok(html.includes(marker), `missing ${marker}`);
  }
  assert.doesNotMatch(html, SCRIPTS);
});