"use strict";

/**
 * تقرير المراجعة العلمية (سطر الأمر).
 *
 * يعرض كل نصّ منسوب إلى أهله مع حالة تخريجه، ولا يحكم على صحّة النصّ.
 * يشارك تعريف المجموعات مع ورقة المراجعة في المتصفح عبر `src/lib/review.js`.
 *
 * التشغيل:  npm run review          # تقرير كامل
 *           npm run review -- --ci  # exit 1 إن وُجد نصّ بلا تخريج
 */

const path = require("node:path");

const SRC = path.join(__dirname, "..", "src");
const DATA = path.join(SRC, "data");

const pad = (text, width) => {
  const value = String(text ?? "");
  return value.length >= width ? value.slice(0, width - 1) + "…" : value + " ".repeat(width - value.length);
};

/** @type {{ATTRIBUTED: any[], entriesOf: Function, isBlocking: Function}} */
let shared;

async function collect() {
  shared ??= await import(`file://${path.join(SRC, "lib", "review.js")}`);
  const report = [];
  for (const group of shared.ATTRIBUTED) {
    const mod = await import(`file://${path.join(DATA, group.file)}`);
    report.push({ ...group, entries: shared.entriesOf(group, mod) });
  }
  return report;
}

function printReport(report) {
  const { isBlocking } = shared;
  let blocking = 0;

  console.log("=== تقرير المراجعة العلمية ===\n");
  console.log(
    pad("المجموعة", 24) + pad("عدد", 7) + pad("مخرَّج", 9) + pad("اسم مجموعة", 13) +
      pad("بلا تخريج", 12) + "الحكم",
  );
  console.log("-".repeat(78));

  for (const group of report) {
    const tally = { "مخرَّج": 0, "اسم مجموعة": 0, "بلا تخريج": 0, "آية": 0 };
    for (const entry of group.entries) tally[entry.status] += 1;
    const missing = tally["بلا تخريج"];
    if (missing && isBlocking(group)) blocking += missing;
    console.log(
      pad(group.label, 24) + pad(group.entries.length, 7) +
        pad(tally["مخرَّج"] + tally["آية"], 9) + pad(tally["اسم مجموعة"], 13) +
        pad(missing, 12) +
        (missing ? (isBlocking(group) ? "متخّص — يمنع النشر" : "يحتاج مراجعة") : "✔ موثّق"),
    );
  }

  for (const group of report) {
    const missing = group.entries.filter((entry) => entry.status === "بلا تخريج");
    if (!missing.length) continue;
    console.log(`\n--- بلا تخريج: ${group.label} (${missing.length}) ---`);
    for (const entry of missing) {
      console.log(`  • ${pad(entry.title, 30)} ${pad(entry.text.slice(0, 46), 48)}`);
    }
  }

  return blocking;
}

async function main() {
  const report = await collect();
  const blocking = printReport(report);
  if (process.argv.includes("--ci") && blocking > 0) {
    console.log(`\n✘ ${blocking} عنصرًا بلا تخريج — وضع --ci يفشل هنا.`);
    process.exitCode = 1;
  } else {
    console.log("\n✔ انتهى التقرير. الحكم على الصحّة لأهل العلم، لا للأداة.");
  }
}

/**
 * المصدر وحدة ESM ولا يمكن استدعاؤها من CJS إلا ديناميكيًا، لذا يُصدَّر
 * `collect` فقط. Definitions and rules are imported directly in the tests
 * from `src/lib/review.js`.
 */
module.exports = { collect, printReport };

if (require.main === module) main();
