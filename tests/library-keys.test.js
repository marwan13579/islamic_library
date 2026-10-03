"use strict";

/**
 * كل مفتاح تكتبه أي صفحة يجب أن يكون مُعرَّفًا في ثلاثة مواضع:
 *   1) `KEYS` في src/lib/storage.js  — ليُقبل عند الاستيراد
 *   2) `IMPORT_TYPES` فيه            — ليُفحص نوعه
 *   3) `ALLOWED_KEYS` في backup-core.js — ليمرّ في التصدير
 *
 * غياب أيٍّ منها لا يُظهر خطأ: البيانات تُسقَط بصمت عند التصدير
 * وتُرفض بصمت عند الاستيراد، فيفقد المستخدم سجلّه بلا رسالة.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const load = (rel) => import(path.join(ROOT, rel)).then((m) => m);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/** يجمع الملفات التي قد تكتب في التخزين. */
function pageFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".kilo") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:html|js|cjs|mjs)$/.test(entry.name)) out.push(full);
    }
  };
  walk(ROOT);
  return out;
}

/** مفاتيح التخزين التي تكتبها الصفحات، بالمفتاح الحرفي. */
function writtenKeys() {
  const found = new Map();
  const patterns = [
    /(?:readStorage|writeStorage)\(\s*["']([^"']+)["']/g,
    /localStorage\.(?:get|set)Item\(\s*["']([^"']+)["']/g,
    /\bKEYS\.\w+/g,
  ];
  for (const file of pageFiles()) {
    if (file.startsWith(path.join(ROOT, "tests"))) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const key = match[1] || match[0];
        if (!found.has(key)) found.set(key, path.relative(ROOT, file));
      }
    }
  }
  return found;
}

test("مفاتيح الصفحات مُعرَّفة في storage.js", async () => {
  const { KEYS, IMPORT_TYPES } = await load("src/lib/storage.js");
  const known = new Set(Object.values(KEYS));
  const missing = [];
  for (const [key, where] of writtenKeys()) {
    if (key.startsWith("KEYS.")) continue;
    if (!known.has(key) && !IMPORT_TYPES[key]) missing.push(`${key} (${where})`);
  }
  assert.deepEqual(missing, [], `مفاتيح بلا تعريف في KEYS/IMPORT_TYPES:\n${missing.join("\n")}`);
});

test("مفاتيح الصفحات مُدرجة في قائمة التصدير", () => {
  const backup = read("backup-core.js");
  const listed = new Set([...backup.matchAll(/"([a-z0-9_-]+)"/gi)].map((m) => m[1]));
  const missing = [];
  for (const [key, where] of writtenKeys()) {
    if (key.startsWith("KEYS.")) continue;
    if (!listed.has(key)) missing.push(`${key} (${where})`);
  }
  assert.deepEqual(missing, [], `مفاتيح تسقط من التصدير:\n${missing.join("\n")}`);
});

test("مفاتيح المكتبة المستوردة محفوظة", async () => {
  const { KEYS, IMPORT_TYPES } = await load("src/lib/storage.js");
  for (const name of [
    "tasbihDaily", "quizLevel", "quizHistory",
    "athanTimings", "athanCoords", "athanMethod", "athanAutoAudio", "athanNotifOff",
  ]) {
    assert.ok(KEYS[name], `KEYS.${name} غير معرّف`);
  }
  // كل مفتاح جديد يجب أن يُقبل نوعه عند الاستيراد
  assert.equal(IMPORT_TYPES[KEYS.quizHistory], "array");
  assert.equal(IMPORT_TYPES[KEYS.quizLevel], "string");
  assert.equal(IMPORT_TYPES[KEYS.athanMethod], "number");
  assert.equal(IMPORT_TYPES[KEYS.athanAutoAudio], "boolean");
  assert.equal(IMPORT_TYPES[KEYS.athanCoords], "object");
});

test("مفاتيح المكتبة المستوردة تمرّ في التصدير والاستيراد فعليًا", async () => {
  const backups = require(path.join(ROOT, "backup-core.js"));
  const { importKnownKeys } = await load("src/lib/storage.js");

  const store = new Map([
    ["lib-quiz-history", JSON.stringify([{ score: 80 }])],
    ["lib-quiz-level", "متوسط"],
    ["gtasbeeh-daily", JSON.stringify({ "2026-10-03": 33 })],
    ["athan_timings", JSON.stringify({ Fajr: "04:52" })],
    ["athan_coords", JSON.stringify({ latitude: 21.4, longitude: 39.8 })],
    ["athan_method", "5"],
    ["athan_auto_audio", "true"],
    ["athan_notif_off", "false"],
  ]);
  const storage = {
    length: store.size,
    key: (i) => [...store.keys()][i],
    getItem: (k) => (store.has(k) ? store.get(k) : null),
  };

  const backup = backups.createBackup(storage);
  const missing = [...store.keys()].filter((k) => !(k in JSON.parse(backup).data));
  assert.deepEqual(missing, [], `سقطت من التصدير:\n${missing.join("\n")}`);

  const parsed = JSON.parse(backup).data;
  const { written, rejected } = importKnownKeys(parsed);
  assert.deepEqual(rejected, [], `رُفضت عند الاستيراد:\n${rejected.join("\n")}`);
  assert.equal(written.length, store.size);
});

test("الاستيراد يفكّ غلاف النسخة ولا يرفض كل شيء", async () => {
  const backups = require(path.join(ROOT, "backup-core.js"));
  const { importKnownKeys } = await load("src/lib/storage.js");

  const store = new Map([["bookmarks", JSON.stringify({ "fatwa:1": true })]]);
  const storage = {
    length: store.size,
    key: (i) => [...store.keys()][i],
    getItem: (k) => (store.has(k) ? store.get(k) : null),
  };
  const envelope = JSON.parse(backups.createBackup(storage));

  // app.js كان يمرّر الغلاف كما هو، فيرفض format وversion وcreatedAt وdata
  // ولا يبقى إلا رسالة «لا يحتوي الملف على بيانات معروفة».
  assert.ok(envelope.data && typeof envelope.data === "object", "الغلاف بلا data");
  const { written, rejected } = importKnownKeys(envelope.data);
  assert.deepEqual(rejected, [], `رُفضت:\n${rejected.join("\n")}`);
  assert.deepEqual(written, ["bookmarks"]);
});

test("الاستيراد يفكّ ترميز JSON لكل الأنواع", async () => {
  const { importKnownKeys, IMPORT_TYPES } = await load("src/lib/storage.js");
  const cases = [
    ["bookmarks", '{"a":1}', "object"],
    ["certificates", '[{"id":1}]', "array"],
    ["calc_method", "5", "number"],
    ["focus_mode", "true", "boolean"],
    ["theme", '"dark"', "string"],
  ];
  for (const [key, raw, type] of cases) {
    assert.equal(IMPORT_TYPES[key], type, `${key} نوعه متوقع ${type}`);
    const { written, rejected } = importKnownKeys({ [key]: raw });
    assert.ok(written.includes(key), `${key} رُفض值为 ${raw}`);
  }
});
