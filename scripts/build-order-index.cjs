"use strict";

/**
 * يبني `content/library/<type>/order.json`: ترتيب عناصر المجموعة في كل فرز.
 *
 * لماذا هذا الملف: الترتيب الصحيح لا يُعرف إلا بترتيب الجميع، وكان
 * المتصل يقرأ كل قوائم المجموعة، فالسؤال الأول للفتاوى عشرة ميغابايت،
 * والصفحة الستّمئة تسع ميغابايت. وهذا الملف يحمل الترتيب وحده — مواضعَ
 * لا نصوصًا — فيقرأ المتصل هذا الصغير ثم الجزء الذي تقع فيه الصفحة.
 *
 * يُشتقّ من قوائم `content/` الموجودة، فلا يحتاج مصدرًا ولا يمسّ نصًّا.
 * وغيابه ليس خطأً: يعود المتصل إلى الترتيب بقراءة القوائم كلها.
 *
 *   node scripts/build-order-index.cjs          # كل المجموعات
 *   node scripts/build-order-index.cjs fatwa    # مجموعة واحدة
 *   node scripts/build-order-index.cjs --check  # لا يكتب، يفحص فقط
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LIBRARY = path.join(ROOT, "content", "library");

/**
 * اتجاه «الأحدث» في مجموعة واحدة: يُقرأ من طرف القوائم أم من أولها.
 *
 * مكرَّر عن `reversed()` في `src/lib/library.js`، ومنه يجيء شرط أنهما
 * متطابقان، و`tests/library-sort-index.test.js` يمنع افتراقهما.
 * @param {{listOrder?: string}} meta
 * @returns {boolean}
 */
function newestAtEnd(meta) {
  return meta.listOrder !== "desc";
}

function buildOrder(type, check) {
  const dir = path.join(LIBRARY, type);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));

  const rows = [];
  for (const name of meta.listFiles) {
    const shard = JSON.parse(fs.readFileSync(path.join(dir, "list", name), "utf8"));
    for (const row of Array.isArray(shard) ? shard : shard.items || []) rows.push(row);
  }
  if (rows.length !== meta.count) {
    throw new Error(`${type}: القوائم فيها ${rows.length} والبيان يقول ${meta.count}`);
  }

  /* الفهرس ترتيبُ البناء نفسُه معكوسًا أو كما هو، لا ترتيبٌ يُعاد
     اشتقاقه من الحقول. وفارقُ ذلك ليس تجميليًا: فحين اشتُقّ مفتاحٌ زمني
     من `d` خرجت الخطبةُ عن ترتيبها في المواريخ المشتركة — ١٢٧٧ تاريخًا
     مكررًا في ٤٥٣١ خطبة، فرُتّبت غير ترتيبها؛ وفي الاختبار لا تاريخ
     أصلًا، فوقع المفتاحُ على الرقم الأخير من المعرّف، وهو في ٥٨٢٠
     سؤالًا لا يزيد على ٢٠ قيمة، فجمعت الأسئلةَ بأرقامها متفرّقةً ورتّبت
     المجموعةَ ترتيبًا لم يقصده أحد.

     فحقلُ التاريخ ليس ترتيبًا، وترتيبُ البناء هو الترتيب. */
  const every = rows.map((_, at) => at);
  const newest = newestAtEnd(meta) ? [...every].reverse() : every;
  const oldest = [...newest].reverse();

  /* ولا ثالثَ هنا: الحقل `r` دقائق قراءة لا عددُ مرّات، فترتيبه «الأكثر»
     ترتيبٌ بلا سند. فمن لا يجد في مصدره قياسًا للكثرة لا يدّعيه. */
  const orders = { newest, oldest };
  for (const [name, list] of Object.entries(orders)) {
    if (list.length !== rows.length) throw new Error(`${type}/${name}: الطول ${list.length}`);
    if (new Set(list).size !== rows.length) throw new Error(`${type}/${name}: فيه تكرار`);
  }

  const target = path.join(dir, "order.json");
  const text = `${JSON.stringify({ v: 1, type, count: rows.length, orders })}\n`;

  if (check) {
    const have = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
    if (have !== text) {
      throw new Error(`${type}: الفهرس لا يطابق القوائم — نفّذ npm run build:order`);
    }
    return { index: 0, lists: 0 };
  }

  fs.writeFileSync(target, text);
  let lists = 0;
  for (const name of meta.listFiles) lists += fs.statSync(path.join(dir, "list", name)).size;
  const kb = Math.round(fs.statSync(target).size / 1024);
  console.log(
    `${type.padEnd(9)} ${String(kb).padStart(4)} ك.ب مقابل ${(lists / 1048576).toFixed(1)} م.ب` +
      ` — ${Math.round(lists / 1024 / kb)}× أصغر`,
  );
  return { index: kb, lists: Math.round(lists / 1024) };
}

const args = process.argv.slice(2);
const check = args.includes("--check");
const only = args.filter((arg) => !arg.startsWith("--"));
const types = only.length
  ? only
  : fs
      .readdirSync(LIBRARY)
      .filter((name) => fs.statSync(path.join(LIBRARY, name)).isDirectory())
      .filter((name) => fs.existsSync(path.join(LIBRARY, name, "meta.json")));

const report = types.map((type) => buildOrder(type, check));
if (check) {
  console.log(`✔ فهارس الترتيب مطابقة للقوائم (${types.length} مجموعة)`);
} else {
  const index = report.reduce((sum, row) => sum + row.index, 0);
  const lists = report.reduce((sum, row) => sum + row.lists, 0);
  console.log(`\nالإجمالي: ${index} ك.ب فهرس مقابل ${(lists / 1024).toFixed(1)} م.ب قوائم.`);
}
