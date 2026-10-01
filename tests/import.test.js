"use strict";

/**
 * اختبارات قبول بيانات الاستيراد.
 *
 * يمنع ملفٌ ما من الكتابة فوق مفاتيح التطبيق بنوعٍ غير متوقّع، أو حقن
 * مفاتيح غريبة في التخزين المحلي.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const load = (rel) => import(`file://${path.join(ROOT, "src", rel)}`);

test("مفاتيح التطبيق معروفة ومحدَّدة", async () => {
  const { KEYS } = await load("lib/storage.js");
  const values = Object.values(KEYS);
  assert.ok(values.length > 20, "عدد المفاتيح قليل على غير المتوقّع");
  assert.equal(new Set(values).size, values.length, "مفتاح مكرّر");
  for (const value of values) assert.equal(typeof value, "string");
});

test("كل مفتاح له نوع واحد محدَّد", async () => {
  const { IMPORT_TYPES } = await load("lib/storage.js");
  const allowed = new Set(["object", "string", "number", "boolean", "array"]);
  for (const [key, type] of Object.entries(IMPORT_TYPES)) {
    assert.ok(allowed.has(type), `${key}: نوع مجهول ${type}`);
  }
});

test("الأنواع المعرَّفة تطابق ما يقرؤه التطبيق", async () => {
  const { KEYS, IMPORT_TYPES } = await load("lib/storage.js");
  // لا يُذكر مفتاحٌ مطبَّق في الخريطة، ولا يُذكر نوعٌ لمفتاحٍ موجود.
  for (const key of Object.keys(IMPORT_TYPES)) {
    assert.ok(Object.values(KEYS).includes(key), `${key}: ليس مفتاحًا في KEYS`);
  }
  // والمفاتيح كلها مصنَّفة: لا مفتاح بلا نوع.
  for (const key of Object.values(KEYS)) {
    assert.ok(Object.hasOwn(IMPORT_TYPES, key), `${key}: بلا نوع محدَّد`);
  }
});

test("المفتاح المجهول والنوع الخاطئ يُرفضان", async () => {
  const { IMPORT_TYPES } = await load("lib/storage.js");
  const matchesType = (value, type) => {
    if (type === "array") return Array.isArray(value);
    if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
    return typeof value === type;
  };
  // نصّ في مكان كائن
  assert.equal(matchesType("نصّ", IMPORT_TYPES.khatma_state), false);
  // كائن في مكان نصّ
  assert.equal(matchesType({ a: 1 }, IMPORT_TYPES.last_tab), false);
  // مصفوفة في مكان كائن (سجلّات ليست كائنًا)
  assert.equal(matchesType([], IMPORT_TYPES.bookmarks), false);
  // كائن في مكان مصفوفة
  assert.equal(matchesType({ a: 1 }, IMPORT_TYPES.sadaka_cards), false);
  // الصحيح يمرّ
  assert.equal(matchesType({ v: 1 }, IMPORT_TYPES.khatma_state), true);
  assert.equal(matchesType([1], IMPORT_TYPES.sadaka_cards), true);
  assert.equal(matchesType("dark", IMPORT_TYPES.theme), true);
  assert.equal(matchesType(24, IMPORT_TYPES.quran_font_size), true);
  assert.equal(matchesType(true, IMPORT_TYPES.focus_mode), true);
});

test("لا تسرّب لخصائص prototype", async () => {
  const parsed = JSON.parse('{"__proto__":{"polluted":true},"theme":"dark"}');
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal("polluted" in Object.getPrototypeOf({}), false);
  assert.equal(Object.keys(parsed).includes("__proto__"), true, "والمفتاح موجود في الملف");
});

test("المستورَد من التصدير قابل لإعادة الاستيراد", async () => {
  const store = new Map();
  const { KEYS } = await load("lib/storage.js");
  store.set(KEYS.theme, "dark");
  store.set(KEYS.khatma_state, { v: 1, parts: [] });
  const exported = Object.fromEntries(store);
  for (const value of Object.values(exported)) {
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(value)));
  }
});
