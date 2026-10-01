/**
 * غلاف مبسّط حول IndexedDB لتخزين المصحف للعمل بدون إنترنت.
 * @module lib/idb
 */

/** @type {IDBDatabase | null} */
let connection = null;

/** @type {Promise<IDBDatabase | null> | null} */
let opening = null;

/**
 * @param {IDBRequest} request
 * @returns {Promise<any>}
 */
function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * يفتح قاعدة البيانات (مرة واحدة).
 * @param {{ name?: string, store?: string, version?: number }} [options]
 * @returns {Promise<IDBDatabase | null>}
 */
function initIDB(options = {}) {
  if (connection) return Promise.resolve(connection);
  if (opening) return opening;
  const name = options.name ?? "noor_db";
  const store = options.store ?? "surahs";
  opening = new Promise((resolve) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }
    let request;
    try {
      request = indexedDB.open(name, options.version ?? 1);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "number" });
    };
    request.onsuccess = () => {
      connection = request.result;
      resolve(connection);
    };
    request.onerror = () => resolve(null);
  });
  return opening;
}

/**
 * @template T
 * @param {T} value سجل يحتوي `number` كمفتاح
 * @returns {Promise<boolean>}
 */
export async function idbPut(value) {
  const db = await initIDB();
  if (!db) return false;
  try {
    const tx = db.transaction("surahs", "readwrite");
    await promisify(tx.objectStore("surahs").put(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * @template T
 * @param {string} key
 * @returns {Promise<T | null>}
 */
export async function idbGet(key) {
  const db = await initIDB();
  if (!db) return null;
  try {
    const tx = db.transaction("surahs", "readonly");
    return (await promisify(tx.objectStore("surahs").get(key))) ?? null;
  } catch {
    return null;
  }
}

/** @returns {Promise<any[]>} */
export async function idbList() {
  const db = await initIDB();
  if (!db) return [];
  try {
    const tx = db.transaction("surahs", "readonly");
    return (await promisify(tx.objectStore("surahs").getAll())) ?? [];
  } catch {
    return [];
  }
}

/**
 * @param {number} limit أقصى عدد سور مخزّنة
 * @returns {Promise<number} عدد السور المحذوفة
 */
export async function trimOfflineCache(limit = 50) {
  const all = await idbList();
  if (all.length <= limit) return 0;
  const sorted = all.sort((a, b) => (a.cachedAt ?? 0) - (b.cachedAt ?? 0));
  const db = await initIDB();
  if (!db) return 0;
  const excess = sorted.slice(0, all.length - limit);
  try {
    const tx = db.transaction("surahs", "readwrite");
    const store = tx.objectStore("surahs");
    for (const item of excess) store.delete(item.number);
    await new Promise((resolve) => { tx.oncomplete = resolve; tx.onerror = resolve; });
    return excess.length;
  } catch {
    return 0;
  }
}

/** يحذف قاعدة البيانات بالكامل (يُستخدم في «مسح كل البيانات»). */
export async function destroyIDB() {
  try {
    connection?.close();
  } catch {
    /* تجاهُل */
  }
  connection = null;
  opening = null;
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase("noor_db");
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}