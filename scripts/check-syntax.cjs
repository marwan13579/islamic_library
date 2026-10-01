"use strict";

/**
 * فحص بناء الجملة لكل ملفات JavaScript في المشروع (scripts و tests و src).
 * يلتقط أخطاء مثل `ReferenceError` تدريجيًا عبر فحص ESM خلف Node.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const ROOTS = ["scripts", "src", "tests"];
const SKIP = new Set(["node_modules", ".git", "vendor"]);

/** @returns {string[]} */
function collect(directory) {
  if (!fs.existsSync(directory)) return [];
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (entry.name.endsWith(".js") || entry.name.endsWith(".cjs")) out.push(full);
  }
  return out;
}

const files = ROOTS.flatMap((name) => collect(path.join(root, name)));
const failures = [];

for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    failures.push(`${path.relative(root, file)}\n${String(error.stderr ?? error.message).trim()}`);
  }
}

if (failures.length) {
  console.error(`✗ فحص الجملة فشل في ${failures.length} ملفًا:\n`);
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(`✔ فحص الجملة سليم في ${files.length} ملفًا`);