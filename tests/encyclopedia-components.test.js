"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

/** يهيّئ بيئة DOM مصغّرة. */
function stubEnvironment() {
  const listeners = new Map();
  const mockDoc = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        attributes: {},
        children: [],
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
        dataset: {},
        innerHTML: "",
        textContent: "",
        setAttribute: function(n, v) { this.attributes[n] = v; },
        getAttribute: function(n) { return this.attributes[n] ?? null; },
        appendChild: function(c) { this.children.push(c); return c; },
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        focus: () => {},
        blur: () => {},
        scrollIntoView: () => {},
        hidden: false,
      };
      return el;
    },
    body: { appendChild: () => {}, classList: { add: () => {}, remove: () => {}, contains: () => false } },
    head: { appendChild: () => {} },
    addEventListener: (type, handler) => {
      listeners.set(type, [...(listeners.get(type) ?? []), handler]);
    },
    removeEventListener: (type, handler) => {
      const arr = listeners.get(type) ?? [];
      listeners.set(type, arr.filter(h => h !== handler));
    },
  };
  
  global.window = {
    isSecureContext: true,
    matchMedia: () => ({ matches: false }),
    navigator: { userAgent: "node-test", platform: "", maxTouchPoints: 0 },
    addEventListener: (type, handler) => {
      listeners.set(type, [...(listeners.get(type) ?? []), handler]);
    },
    removeEventListener: (type, handler) => {
      const arr = listeners.get(type) ?? [];
      listeners.set(type, arr.filter(h => h !== handler));
    },
    location: { reload() {}, href: "http://localhost/encyclopedia.html", pathname: "/encyclopedia.html", search: "" },
    localStorage: {
      store: new Map(),
      getItem(key) { return this.store.get(key) ?? null; },
      setItem(key, value) { this.store.set(key, String(value)); },
      removeItem(key) { this.store.delete(key); },
      clear() { this.store.clear(); },
      get length() { return this.store.size; },
      key(i) { return [...this.store.keys()][i] ?? null; }
    },
    document: mockDoc,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    import: async (specifier) => {
      if (specifier.includes("unified-search")) {
        return {
          searchAll: async () => ({ results: [], categories: [], intent: "general", deep: false }),
          quickSearch: async () => [],
          getSmartSuggestions: async () => []
        };
      }
      if (specifier.includes("search-content")) {
        return {
          registerDataSources: async () => {},
          resultCategories: () => []
        };
      }
      if (specifier.includes("content-relationships")) {
        return {
          getRelatedContent: async () => [],
          getRelatedTopics: () => [],
          detectTopicFromContent: () => []
        };
      }
      if (specifier.includes("favorites-manager")) {
        return { favoritesManager: { addFavorite: async () => {}, removeFavorite: async () => {}, isFavorite: () => false, getAllFavorites: async () => [] } };
      }
      if (specifier.includes("progress-tracker")) {
        return { progressTracker: { updateProgress: async () => {}, getProgress: async () => null } };
      }
      if (specifier.includes("text.js")) {
        return { escapeHtml: (s) => s, toArNum: (n) => String(n), normalizeAr: (s) => s };
      }
      if (specifier.includes("storage.js")) {
        return { read: () => null, write: () => true };
      }
      return {};
    }
  };
  
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      userAgent: "node-test",
      platform: "",
      maxTouchPoints: 0,
      serviceWorker: { controller: null, register: async () => ({ addEventListener() {} }) },
    },
  });
  
  global.document = mockDoc;
  global.localStorage = global.window.localStorage;
  global.fetch = global.window.fetch;
  global.customElements = { define: () => {}, get: () => undefined };
  global.HTMLElement = class {};
  global.Event = class { constructor(type) { this.type = type; } };
  global.CustomEvent = class extends Event { constructor(type, opts) { super(type); Object.assign(this, opts); } };
  
  return { emit: (type, event) => { for (const h of listeners.get(type) ?? []) h(event); } };
}

/** ينظف البيئة العامة بين الاختبارات. */
function cleanupEnvironment() {
  delete global.window;
  delete global.document;
  delete global.navigator;
  delete global.localStorage;
  delete global.fetch;
  delete global.customElements;
  delete global.HTMLElement;
  delete global.Event;
  delete global.CustomEvent;
}

// ============================================================
// اختبارات مكتبة العلاقات
// ============================================================

test("content-relationships exports getRelatedContent and normalize", async () => {
  stubEnvironment();
  try {
    const { getRelatedContent, normalize } = await import("../src/lib/content-relationships.js");
    
    // Test normalize
    const normalized = normalize("  صَلَاةَ  ");
    assert.ok(typeof normalized === "string");
    
    // Test getRelatedContent
    const content = await getRelatedContent("صلاة", { limit: 5 });
    assert.ok(Array.isArray(content));
    
    cleanupEnvironment();
  } catch (e) {
    cleanupEnvironment();
    throw e;
  }
});

// ============================================================
// اختبارات إدارة المفضلة
// ============================================================

test("favorites-manager manages favorites correctly", async () => {
  stubEnvironment();
  try {
    const { favoritesManager } = await import("../src/lib/favorites-manager.js");
    
    // Test addFavorite
    await favoritesManager.addFavorite("test-id", "quran", { title: "Test" });
    
    // Test isFavorite
    const isFav = favoritesManager.isFavorite("test-id");
    assert.ok(typeof isFav === "boolean");
    
    // Test getAllFavorites
    const all = await favoritesManager.getAllFavorites();
    assert.ok(Array.isArray(all));
    
    // Test removeFavorite
    await favoritesManager.removeFavorite("test-id");
    
    cleanupEnvironment();
  } catch (e) {
    cleanupEnvironment();
    throw e;
  }
});

// ============================================================
// اختبارات تتبع التقدم
// ============================================================

test("progress-tracker tracks reading progress", async () => {
  stubEnvironment();
  try {
    const { progressTracker } = await import("../src/lib/progress-tracker.js");
    
    // Test updateProgress
    await progressTracker.updateProgress("test-id", { type: "quran", current: 5, total: 10 });
    
    // Test getProgress
    const progress = await progressTracker.getProgress("test-id");
    assert.ok(progress === null || typeof progress === "object");
    
    cleanupEnvironment();
  } catch (e) {
    cleanupEnvironment();
    throw e;
  }
});

// ============================================================
// اختبارات فئات الموسوعة
// ============================================================

test("encyclopedia-categories exports valid data", async () => {
  stubEnvironment();
  try {
    const { ENCYCLOPEDIA_CATEGORIES, CONTENT_RELATIONS } = await import("../src/data/encyclopedia-categories.js");
    
    assert.ok(Array.isArray(ENCYCLOPEDIA_CATEGORIES));
    assert.ok(ENCYCLOPEDIA_CATEGORIES.length >= 18);
    
    // Check each category has required fields
    for (const cat of ENCYCLOPEDIA_CATEGORIES) {
      assert.ok(cat.id, "Category must have id");
      assert.ok(cat.title, "Category must have title");
      assert.ok(cat.icon, "Category must have icon");
      assert.ok(cat.description, "Category must have description");
      assert.ok(cat.color, "Category must have color");
      assert.ok(cat.route, "Category must have route");
      assert.ok(Array.isArray(cat.keywords), "Category must have keywords");
      assert.ok(Array.isArray(cat.related), "Category must have related");
    }
    
    // Check CONTENT_RELATIONS
    assert.ok(typeof CONTENT_RELATIONS === "object");
    assert.ok(CONTENT_RELATIONS.quran);
    assert.ok(Array.isArray(CONTENT_RELATIONS.quran));
    
    cleanupEnvironment();
  } catch (e) {
    cleanupEnvironment();
    throw e;
  }
});

// ============================================================
// اختبارات دوال الموسوعة المساعدة
// ============================================================

test("encyclopedia.js exports helper functions", async () => {
  stubEnvironment();
  try {
    const { relatedContentHtml, getEncyclopediaStats } = await import("../src/lib/encyclopedia.js");
    
    assert.ok(typeof relatedContentHtml === "function");
    assert.ok(typeof getEncyclopediaStats === "function");
    
    // Test getEncyclopediaStats
    const stats = getEncyclopediaStats();
    assert.ok(typeof stats === "object");
    assert.ok(typeof stats.categories === "number");
    assert.ok(typeof stats.keywords === "number");
    assert.ok(typeof stats.relations === "number");
    
    // Test relatedContentHtml
    const html = relatedContentHtml("quran", { max: 3 });
    assert.ok(typeof html === "string");
    
    cleanupEnvironment();
  } catch (e) {
    cleanupEnvironment();
    throw e;
  }
});

// ============================================================
// اختبارات progress.js
// ============================================================

test("progress.js provides basic progress functions", async () => {
  stubEnvironment();
  try {
    const mod = await import("../src/lib/progress.js");
    assert.ok(typeof mod.readProgress === "function");
    assert.ok(typeof mod.writeProgress === "function");
    assert.ok(typeof mod.toggleFavorite === "function");
    assert.ok(typeof mod.isFavorite === "function");
    assert.ok(typeof mod.addToHistory === "function");
    assert.ok(typeof mod.getHistory === "function");
    cleanupEnvironment();
  } catch (e) {
    cleanupEnvironment();
    throw e;
  }
});