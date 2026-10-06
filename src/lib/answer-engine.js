/**
 * Answer Engine — يجمع نتائج البحث في إجابة منظمة مع مصادر وروابط.
 *
 * يعتمد على النتائج من `unified-search` ويضيف عليها:
 * - إزالة التكرار
 * - تجميع المحتوى المتشابه
 * - تقسيم الإجابة إلى أقسام
 * - عرض المصادر
 * - اقتراح أسئلة مرتبطة
 *
 * بدون AI خارجي. كل القواعد محلية.
 * @module lib/answer-engine
 */

import { normalizeAr } from "./text.js";

/* =========================================================
 * TIER SYSTEM — ترتيب المصادر حسب الأولوية الشرعية
 * ========================================================= */

const SOURCE_TIERS = {
  quran: 1,
  quran_ayah: 1,
  hadith: 1,
  authenticated_hadith: 1,
  tafsir: 2,
  siraj: 2,
  fatwa: 2,
  khutbah: 2,
  seerah: 3,
  history: 3,
  lesson: 3,
  book: 3,
  article: 3,
  tool: 4,
  page: 4,
  general: 4,
};

export { SOURCE_TIERS };

const SOURCE_TIER_LABELS = {
  1: "مصدر شرعي أساسي",
  2: "مصدر شرعي معتمد",
  3: "مصدر تعليمي",
  4: "مصدر عام",
};

/* =========================================================
 * CONTENT TYPE DETECTION
 * ========================================================= */

const TYPE_LABELS = {
  quran: "آية قرآنية",
  quran_ayah: "آية قرآنية",
  hadith: "حديث",
  authenticated_hadith: "حديث",
  tafsir: "تفسير",
  siraj: "تفسير",
  fatwa: "فتوى",
  khutbah: "خطبة",
  seerah: "سيرة",
  history: "تاريخ",
  lesson: "درس",
  book: "كتاب",
  article: "مقال",
  tool: "أداة",
  page: "صفحة",
  general: "محتوى",
};

const TYPE_ICONS = {
  quran: "📖",
  quran_ayah: "📖",
  hadith: "📕",
  authenticated_hadith: "📕",
  tafsir: "📚",
  siraj: "🪔",
  fatwa: "⚖️",
  khutbah: "🗣️",
  seerah: "🕌",
  history: "🏛️",
  lesson: "📚",
  book: "📖",
  article: "📝",
  tool: "🛠️",
  page: "📄",
  general: "📋",
};

/* =========================================================
 * DEDUPLICATION
 * ========================================================= */

/**
 * يقارن نصين بعد التطبيع ويعيد درجة التشابه (0..1).
 * يستخدم n-grams صغيرة لسرعة عالية.
 */
export function textSimilarity(a, b) {
  const ta = normalizeAr(a || "");
  const tb = normalizeAr(b || "");
  if (!ta || !tb) return 0;
  if (ta === tb) return 1;

  const n = 3;
  const buildGrams = (text) => {
    const grams = new Set();
    const norm = text.replace(/\s+/g, " ");
    for (let i = 0; i <= norm.length - n; i++) {
      grams.add(norm.slice(i, i + n));
    }
    return grams;
  };

  const ga = buildGrams(ta);
  const gb = buildGrams(tb);
  if (!ga.size || !gb.size) return 0;

  let intersection = 0;
  for (const g of ga) {
    if (gb.has(g)) intersection += 1;
  }
  const smaller = Math.min(ga.size, gb.size);
  return smaller > 0 ? intersection / smaller : 0;
}

/**
 * يزيل النتائج المكررة بحد أدنى 80% تشابه.
 * يحتفظ بالنتيجة ذات الدرجة الأعلى والأولوية الأفضل.
 */
export function deduplicateResults(results, threshold = 0.8) {
  const unique = [];
  const seen = new Set();

  for (const r of results) {
    const key = `${normalizeAr(r.title || "").slice(0, 50)}|${normalizeAr(r.summary || r.description || "").slice(0, 80)}`;
    const docText = `${r.title || ""} ${r.summary || r.description || ""}`;

    let isDuplicate = false;
    for (const u of unique) {
      const uText = `${u.title || ""} ${u.summary || u.description || ""}`;
      if (textSimilarity(docText, uText) >= threshold) {
        isDuplicate = true;
        if (r.score > u.score) {
          unique.splice(unique.indexOf(u), 1);
          unique.push(r);
        }
        break;
      }
    }
    if (!isDuplicate) {
      seen.add(key);
      unique.push(r);
    }
  }

  return unique.sort((a, b) => b.score - a.score);
}

/* =========================================================
 * TOPIC CLUSTERING
 * ========================================================= */

/**
 * يكتشف الأقسام الفرعية للسؤال بناءً على الكلمات المفتاحية.
 * مثلاً: "ما الصلاة وشروطها وأركانها ومبطلاتها؟"
 * → topics: ["الصلاة", "شروط الصلاة", "أركان الصلاة", "مبطلات الصلاة"]
 */
export function detectSubTopics(query) {
  const words = normalizeAr(query).split(" ").filter((w) => w.length >= 3);
  if (words.length <= 1) return [query];

  const conjunctions = ["و", "أو", "ثم", "أيضا", "كذلك", "ومع", "بعد", "حتى"];
  const filtered = words.filter((w) => !conjunctions.includes(w));

  if (filtered.length <= 2) return [query];

  const topics = [];
  const seen = new Set();
  seen.add(normalizeAr(query));

  for (let i = 0; i < filtered.length; i++) {
    for (let j = i + 1; j < Math.min(i + 4, filtered.length); j++) {
      const phrase = filtered.slice(i, j + 1).join(" ");
      if (phrase.length >= 4 && !seen.has(phrase)) {
        seen.add(phrase);
        topics.push(phrase);
      }
    }
  }

  return topics.length > 0 ? topics : [query];
}

/**
 * يصنّف النتائج حسب الموضوعات الفرعية.
 */
export function clusterResultsByTopic(results, topics) {
  const clusters = new Map();
  for (const t of topics) clusters.set(t, []);

  const fallback = [];
  for (const r of results) {
    const rText = normalizeAr(`${r.title} ${r.summary || r.description || ""}`);
    let bestTopic = null;
    let bestScore = 0;

    for (const t of topics) {
      const nt = normalizeAr(t);
      if (rText.includes(nt)) {
        const score = nt.length / (t.length || 1);
        if (score > bestScore) {
          bestScore = score;
          bestTopic = t;
        }
      }
    }

    if (bestTopic) {
      clusters.get(bestTopic).push(r);
    } else {
      fallback.push(r);
    }
  }

  return { clusters, fallback };
}

/* =========================================================
 * ANSWER ASSEMBLY
 * ========================================================= */

/**
 * يبني الإجابة النهائية من النتائج.
 */
export function assembleAnswer(rawQuery, results, options = {}) {
  const query = options.normalizedQuery || rawQuery;
  const topics = detectSubTopics(query);
  const deduped = deduplicateResults(results);
  const { clusters, fallback } = clusterResultsByTopic(deduped, topics);

  const internalResults = [];
  const externalResults = [];

  for (const r of deduped) {
    if (r.externalSource) {
      externalResults.push(r);
    } else {
      internalResults.push(r);
    }
  }

  const answer = {
    query: rawQuery,
    normalizedQuery: query,
    intent: options.intent || "general",
    totalResults: deduped.length,
    internalCount: internalResults.length,
    externalCount: externalResults.length,
    topics: [],
    internal: {
      summary: "",
      sections: [],
      sources: [],
    },
    external: {
      summary: "",
      sections: [],
      sources: [],
    },
    relatedQuestions: [],
    zeroResult: deduped.length === 0,
  };

  if (internalResults.length === 0 && externalResults.length === 0) {
    return answer;
  }

  // Build internal answer
  if (internalResults.length > 0) {
    answer.internal.summary = buildSummary(internalResults.slice(0, 3));
    answer.internal.sections = buildSections(clusters, fallback.filter((r) => !r.externalSource), topics);
    answer.internal.sources = buildSourceList(internalResults);
  }

  // Build external answer
  if (externalResults.length > 0) {
    answer.external.summary = buildSummary(externalResults.slice(0, 3));
    answer.external.sections = buildSections({ "مصادر خارجية": externalResults }, [], ["مصادر خارجية"]);
    answer.external.sources = buildSourceList(externalResults);
  }

  // Related questions
  answer.relatedQuestions = generateRelatedQuestions(deduped, query);

  return answer;
}

function buildSummary(topResults) {
  if (!topResults.length) return "";
  const best = topResults[0];
  let summary = best.summary || best.description || "";
  if (summary.length > 300) summary = summary.slice(0, 297) + "...";
  return summary;
}

function buildSections(clusters, fallback, topics) {
  const sections = [];

  for (const [topic, items] of clusters) {
    if (!items.length) continue;
    sections.push({
      title: topic,
      type: items[0].type || "general",
      icon: TYPE_ICONS[items[0].type] || "📋",
      tier: SOURCE_TIERS[items[0].type] || 4,
      items: items.slice(0, 5),
    });
  }

  if (fallback.length > 0) {
    const existingTitles = new Set(sections.map((s) => s.title));
    const seenItems = new Set();
    const existingItems = [];
    for (const s of sections) {
      for (const item of s.items) {
        existingItems.push(item.id || item.title);
      }
    }
    const unique = fallback.filter((r) => {
      const key = r.id || r.title;
      if (seenItems.has(key)) return false;
      seenItems.add(key);
      return !existingItems.includes(key);
    });
    if (unique.length > 0) {
      sections.push({
        title: "نتائج إضافية",
        type: unique[0].type || "general",
        icon: TYPE_ICONS[unique[0].type] || "📋",
        tier: SOURCE_TIERS[unique[0].type] || 4,
        items: unique.slice(0, 5),
      });
    }
  }

  return sections.sort((a, b) => a.tier - b.tier);
}

function buildSourceList(results) {
  const sources = [];
  const seen = new Set();

  for (const r of results) {
    const key = `${r.sourceId}|${r.route}`;
    if (seen.has(key)) continue;
    seen.add(key);

    sources.push({
      sourceId: r.sourceId,
      title: r.title,
      route: r.route,
      type: r.type,
      tier: SOURCE_TIERS[r.type] || 4,
      tierLabel: SOURCE_TIER_LABELS[SOURCE_TIERS[r.type] || 4],
      typeLabel: TYPE_LABELS[r.type] || "محتوى",
      icon: TYPE_ICONS[r.type] || "📋",
      category: r.category,
    });
  }

  return sources.sort((a, b) => a.tier - b.tier);
}

function generateRelatedQuestions(results, query) {
  const questions = [];
  const seen = new Set();
  seen.add(normalizeAr(query));

  const topicWords = normalizeAr(query).split(" ").filter((w) => w.length >= 3);

  const questionTemplates = [
    "ما حكم {topic}؟",
    "ما فضل {topic}؟",
    "ما شروط {topic}؟",
    "ما أركان {topic}؟",
    "ما مبطلات {topic}؟",
    "كيفية {topic}؟",
    "أركان {topic}؟",
    "شروط {topic}؟",
    "مبطلات {topic}؟",
    "فضيلة {topic}؟",
  ];

  for (const word of topicWords.slice(0, 3)) {
    for (const template of questionTemplates) {
      const q = template.replace("{topic}", word);
      if (!seen.has(normalizeAr(q))) {
        seen.add(normalizeAr(q));
        questions.push(q);
      }
      if (questions.length >= 8) break;
    }
    if (questions.length >= 8) break;
  }

  return questions.slice(0, 8);
}

/* =========================================================
 * QUESTION CLASSIFICATION
 * ========================================================= */

export function classifyQuestion(query) {
  const q = normalizeAr(query);
  const words = q.split(" ");

  const patterns = [
    { type: "howto", keywords: ["طريقة", "خطوات", "كيفية", "كيف"] },
    { type: "ruling", keywords: ["حكم", "يجوز", "حرام", "حلال", "فرض", "واجب", "سنة", "مباح", "مكروه"] },
    { type: "virtue", keywords: ["فضل", "فضيلة", "ثواب", "أجر", "نعيم"] },
    { type: "when", keywords: ["متى", "وقت", "أوقات"] },
    { type: "where", keywords: ["أين", "مكان", "موقع"] },
    { type: "why", keywords: ["لماذا", "لم", "سبب", "علة"] },
    { type: "comparison", keywords: ["فرق", "فارق", "بين", "الفرق"] },
    { type: "story", keywords: ["قصة", "قصص", "حدث", "حكاية"] },
    { type: "definition", keywords: ["ما هو", "ما هي", "شو", "ايه", "إيه", "ماذا", "ماهو", "ماهي"] },
  ];

  for (const { type, keywords } of patterns) {
    for (const kw of keywords) {
      if (q.includes(kw)) return type;
    }
  }

  return "general";
}

/**
 * يعرض نصيحتين مقترحتين للاستعلام عند عدم وجود نتائج.
 */
export function suggestAlternatives(query, registry) {
  const words = normalizeAr(query).split(" ").filter((w) => w.length >= 3);
  const suggestions = [];

  if (words.length > 1) {
    suggestions.push({ type: "shorten", text: words.slice(0, 2).join(" ") });
  }

  const expanded = [];
  for (const w of words) {
    const sources = registry.getAll();
    for (const src of sources) {
      const norm = normalizeAr(src.title || "");
      if (norm.includes(w) && !expanded.includes(src.title)) {
        expanded.push(src.title);
      }
    }
  }
  for (const t of expanded.slice(0, 3)) {
    suggestions.push({ type: "browse", text: t });
  }

  return suggestions;
}
