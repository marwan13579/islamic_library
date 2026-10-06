/**
 * Tests for the "اسأل الموقع" Answer Engine.
 * @module tests/ask-engine.test
 */

import { test, describe } from "node:test";
import assert from "node:assert";
import {
  textSimilarity,
  deduplicateResults,
  detectSubTopics,
  clusterResultsByTopic,
  assembleAnswer,
  classifyQuestion,
  suggestAlternatives,
} from "../src/lib/answer-engine.js";
import { getRelatedTopics, expandTopicKeywords } from "../src/lib/knowledge-graph.js";
import { loadExternalConfig, getActiveSources, isDomainAllowed, isPathAllowed, isSourceAllowed, getRateLimit, clearExternalIndexCache } from "../src/lib/external-sources.js";

describe("Answer Engine", () => {
  test("textSimilarity identical strings", () => {
    assert.strictEqual(textSimilarity("الصلاة", "الصلاة"), 1);
  });

  test("textSimilarity similar strings", () => {
    const sim = textSimilarity("ما فضل الصلاة", "فضل الصلاة");
    assert.ok(sim > 0.5, `Expected > 0.5, got ${sim}`);
  });

  test("textSimilarity unrelated strings", () => {
    const sim = textSimilarity("الصلاة", "الزكاة");
    assert.ok(sim < 0.3, `Expected < 0.3, got ${sim}`);
  });

  test("deduplicateResults removes duplicates", () => {
    const results = [
      { id: "1", title: "فضل الصلاة", summary: "فضل الصلاة كثيرة", score: 80 },
      { id: "2", title: "فضل الصلاة", summary: "فضل الصلاة كثيرة جدا", score: 70 },
      { id: "3", title: "أركان الإسلام", summary: "أركان الإسلام خمسة", score: 60 },
    ];
    const unique = deduplicateResults(results);
    assert.strictEqual(unique.length, 2);
    assert.strictEqual(unique[0].id, "1");
  });

  test("detectSubTopics splits compound questions", () => {
    const topics = detectSubTopics("ما الصلاة وشروطها وأركانها");
    assert.ok(topics.length >= 2, `Expected >= 2 topics, got ${topics.length}`);
  });

  test("clusterResultsByTopic groups by topic", () => {
    const results = [
      { id: "1", title: "أركان الصلاة", summary: "", type: "hadith", category: "حديث" },
      { id: "2", title: "شروط الصلاة", summary: "", type: "fiqh", category: "فقه" },
      { id: "3", title: "الصلاة", summary: "", type: "quran", category: "قرآن" },
    ];
    const { clusters } = clusterResultsByTopic(results, ["الصلاة", "أركان"]);
    assert.ok(clusters.has("الصلاة"));
    assert.ok(clusters.has("أركان"));
  });

  test("assembleAnswer handles zero results", () => {
    const answer = assembleAnswer("سؤال غير موجود", [], { intent: "general" });
    assert.strictEqual(answer.zeroResult, true);
    assert.strictEqual(answer.internal.sections.length, 0);
  });

  test("assembleAnswer produces structured output", () => {
    const results = [
      { id: "1", title: "فضل الصلاة", summary: "الصلاة عمود الدين", type: "quran", category: "قرآن", score: 90, sourceId: "quran", route: "#" },
    ];
    const answer = assembleAnswer("ما فضل الصلاة", results, { intent: "general" });
    assert.ok(answer.internal.sections.length > 0);
    assert.ok(answer.internal.sources.length > 0);
    assert.ok(answer.relatedQuestions.length > 0);
  });

  test("classifyQuestion detects ruling intent", () => {
    assert.strictEqual(classifyQuestion("ما حكم الصلاة"), "ruling");
  });

  test("classifyQuestion detects virtue intent", () => {
    assert.strictEqual(classifyQuestion("ما فضل الصوم"), "virtue");
  });

  test("classifyQuestion detects howto intent", () => {
    assert.strictEqual(classifyQuestion("كيف أصلي"), "howto");
  });

  test("classifyQuestion falls back to general", () => {
    assert.strictEqual(classifyQuestion("الصلاة"), "general");
  });

  test("suggestAlternatives returns suggestions", () => {
    const mockRegistry = {
      getAll: () => [
        { title: "مواقيت الصلاة", searchable: true },
        { title: "أوقات الصلاة", searchable: true },
      ],
    };
    const suggestions = suggestAlternatives("صلاة", mockRegistry);
    assert.ok(suggestions.length > 0);
  });
});

describe("Knowledge Graph", () => {
  test("getRelatedTopics returns topics for prayer", () => {
    const related = getRelatedTopics("صلاة");
    assert.ok(Array.isArray(related));
    assert.ok(related.length > 0);
  });

  test("getRelatedTopics returns topics for fasting", () => {
    const related = getRelatedTopics("صيام");
    assert.ok(related.includes("رمضان") || related.length > 0);
  });

  test("expandTopicKeywords expands prayer", () => {
    const keywords = expandTopicKeywords("صلاة");
    assert.ok(keywords.length > 0);
    assert.ok(keywords.some((k) => k.includes("وضوء") || k.includes("طهارة")));
  });

  test("getRelatedTopics returns empty for unknown topic", () => {
    const related = getRelatedTopics("موضوع غير موجود");
    assert.ok(Array.isArray(related));
  });
});

describe("External Sources", () => {
  test("loadExternalConfig returns default for missing file", async () => {
    const config = await loadExternalConfig("nonexistent.json");
    assert.ok(config);
    assert.ok(Array.isArray(config.sources));
    assert.strictEqual(config.sources.length, 0);
  });

  test("loadExternalConfig reads valid file", async () => {
    clearExternalIndexCache();
    const config = await loadExternalConfig("./external-sources.json");
    assert.ok(config);
    assert.ok(typeof config.version === "number");
    assert.ok(Array.isArray(config.sources));
  });

  test("getActiveSources returns only enabled", async () => {
    const sources = await getActiveSources("./external-sources.json");
    assert.ok(Array.isArray(sources));
    for (const s of sources) {
      assert.strictEqual(s.enabled, true);
    }
  });

  test("isDomainAllowed checks allowed domains", () => {
    const source = { allowedDomains: ["example.com"], allowedPaths: [] };
    assert.strictEqual(isDomainAllowed(source, "https://example.com/page"), true);
    assert.strictEqual(isDomainAllowed(source, "https://other.com/page"), false);
  });

  test("isPathAllowed checks allowed paths", () => {
    const source = { allowedDomains: [], allowedPaths: ["/books/"] };
    assert.strictEqual(isPathAllowed(source, "https://example.com/books/page"), true);
    assert.strictEqual(isPathAllowed(source, "https://example.com/other/page"), false);
  });

  test("isSourceAllowed checks both domain and path", () => {
    const source = { allowedDomains: ["example.com"], allowedPaths: ["/books/"] };
    assert.strictEqual(isSourceAllowed(source, "https://example.com/books/page"), true);
    assert.strictEqual(isSourceAllowed(source, "https://example.com/other/page"), false);
    assert.strictEqual(isSourceAllowed(source, "https://other.com/books/page"), false);
  });

  test("getRateLimit returns minimum 500ms", () => {
    const source = { rateLimitMs: 200 };
    assert.strictEqual(getRateLimit(source), 500);
    const source2 = { rateLimitMs: 2000 };
    assert.strictEqual(getRateLimit(source2), 2000);
  });
});
