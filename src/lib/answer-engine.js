/**
 * Answer Engine — يجمع نتائج البحث في إجابة منظمة مع مصادر وأدلة وروابط.
 *
 * يعتمد على نتائج البحث الداخلي والخارجي ويضيف عليها:
 * - التحقق من الأدلة الشرعية وفصل نوع كل معلومة (آية، حديث، تفسير، فتوى، أداة)
 * - إزالة التكرار والتداخل (Deduplication & Clustering)
 * - استخراج وتقسيم الأسئلة متعددة الأجزاء (Multi-part topics)
 * - عدم اختراع أي معلومة أو حديث أو آية، وتقديم تنبيه عند نقص المحتوى
 * - تقسيم الإجابة: ملخص، تفاصيل، أدلة ومصادر، مواضيع مرتبطة، أسئلة مقترحة
 *
 * بدون AI خارجي أو اتصال بـ APIs خارجية.
 * @module lib/answer-engine
 */

import { normalizeAr } from "./text.js";
import { correctSpelling, expandAlias, ALIASES } from "./search-aliases.js";
import { getRelatedTopics, expandTopicKeywords } from "./knowledge-graph.js";

/* =========================================================
 * TIER SYSTEM — ترتيب المصادر حسب الأولوية الشرعية
 * ========================================================= */

const SOURCE_TIERS = {
  quran: 1,
  quran_ayah: 1,
  surah: 1,
  ayah: 1,
  verse: 1,
  hadith: 1,
  authenticated_hadith: 1,
  tafsir: 2,
  siraj: 2,
  hisn: 2,
  dhikr: 2,
  dua: 2,
  fatwa: 2,
  khutbah: 2,
  khutbahs: 2,
  seerah: 2,
  story: 3,
  prophet: 3,
  history: 3,
  lesson: 3,
  reflection: 3,
  action: 3,
  book: 3,
  article: 3,
  quiz: 3,
  questions: 3,
  tool: 4,
  tools: 4,
  page: 4,
  general: 4,
  reciter: 4,
  radio: 4,
  city: 4,
};

export { SOURCE_TIERS };

const SOURCE_TIER_LABELS = {
  1: "مصدر شرعي أساسي (القرآن والحديث)",
  2: "مصدر شرعي معتمد (تفسير وفتاوى وسيرة)",
  3: "محتوى تعليمي وتاريخي",
  4: "أدوات ومحتوى عام",
};

/* =========================================================
 * CONTENT TYPE DETECTION
 * ========================================================= */

const TYPE_LABELS = {
  quran: "آية قرآنية",
  quran_ayah: "آية قرآنية",
  surah: "سورة قرآنية",
  ayah: "آية قرآنية",
  verse: "آية قرآنية",
  hadith: "حديث نبوي",
  authenticated_hadith: "حديث نبوي",
  tafsir: "تفسير",
  siraj: "غريب القرآن",
  hisn: "حصن المسلم",
  dhikr: "أذكار",
  dua: "دعاء",
  fatwa: "فتوى شرعية",
  khutbah: "خطبة",
  khutbahs: "خطبة",
  seerah: "سيرة نبوية",
  story: "قصة نبوية",
  prophet: "قصة نبي",
  history: "تاريخ إسلامي",
  lesson: "درس تعليمي",
  reflection: "تدبر",
  action: "عمل صالح",
  book: "كتاب",
  article: "مقال",
  quiz: "اختبار",
  questions: "سؤال",
  tool: "أداة إسلامية",
  tools: "أداة إسلامية",
  page: "صفحة",
  general: "محتوى",
  reciter: "قارئ وتلاوة",
  radio: "إذاعة إسلامية",
  city: "مواقيت مدينة",
};

const TYPE_ICONS = {
  quran: "📖",
  quran_ayah: "📖",
  surah: "📖",
  ayah: "📖",
  verse: "📖",
  hadith: "📕",
  authenticated_hadith: "📕",
  tafsir: "📚",
  siraj: "🪔",
  hisn: "🛡️",
  dhikr: "🤲",
  dua: "🤲",
  fatwa: "⚖️",
  khutbah: "🗣️",
  khutbahs: "🗣️",
  seerah: "🕌",
  story: "🌟",
  prophet: "🌟",
  history: "🏛️",
  lesson: "📚",
  reflection: "📓",
  action: "🌿",
  book: "📖",
  article: "📝",
  quiz: "🧠",
  questions: "🧠",
  tool: "🛠️",
  tools: "🛠️",
  page: "📄",
  general: "📋",
  reciter: "🎙️",
  radio: "📻",
  city: "🏙️",
};

/* =========================================================
 * DEDUPLICATION
 * ========================================================= */

/**
 * يقارن نصين بعد التطبيع ويعيد درجة التشابه (0..1).
 * @param {string} a
 * @param {string} b
 * @returns {number}
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
 * يزيل النتائج المكررة مع دمج روابط المصادر المرتبطة.
 * @param {object[]} results
 * @param {number} [threshold=0.8]
 * @returns {object[]}
 */
export function deduplicateResults(results, threshold = 0.8) {
  const unique = [];

  for (const r of results) {
    const docText = `${r.title || ""} ${r.summary || r.description || ""}`;
    let duplicateIndex = -1;

    for (let i = 0; i < unique.length; i++) {
      const u = unique[i];
      const uText = `${u.title || ""} ${u.summary || u.description || ""}`;
      if (textSimilarity(docText, uText) >= threshold) {
        duplicateIndex = i;
        break;
      }
    }

    if (duplicateIndex >= 0) {
      const existing = unique[duplicateIndex];
      if (!existing.relatedSources) existing.relatedSources = [];
      if (r.route && r.route !== existing.route) {
        existing.relatedSources.push({
          title: r.title,
          route: r.route,
          sourceName: r.sourceName || r.sourceId || "مصدر إضافي",
        });
      }
      // الاحتفاظ بالأعلى درجة
      if ((r.score || 0) > (existing.score || 0)) {
        r.relatedSources = existing.relatedSources;
        unique[duplicateIndex] = r;
      }
    } else {
      unique.push({ ...r, relatedSources: [] });
    }
  }

  return unique.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/* =========================================================
 * TOPIC CLUSTERING & MULTI-PART QUESTIONS
 * ========================================================= */

/**
 * يكتشف الأقسام والموضوعات الفرعية للسؤال، ويعالج الضمائر المتصلة (مثل: ما الصلاة وشروطها وأركانها ومبطلاتها).
 * @param {string} query
 * @returns {string[]}
 */
export function detectSubTopics(query) {
  const clean = String(query || "").replace(/[؟?!\.,،]/g, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [query];

  const clauses = [];
  let current = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (
      current.length > 0 &&
      (w === "ثم" ||
        w === "أو" ||
        w === "وكذلك" ||
        w === "وما" ||
        w === "و" ||
        (w.startsWith("و") && w.length >= 4 && !["واحد", "وقت", "والله", "والدين"].includes(w)))
    ) {
      clauses.push(current.join(" "));
      let stripped = w;
      if (w === "وما" || w === "و") {
        stripped = "";
      } else if (w.startsWith("وما") && w.length > 3) {
        stripped = w.slice(3);
      } else if (w.startsWith("و") && w.length >= 4) {
        stripped = w.slice(1);
      }
      current = stripped ? [stripped] : [];
    } else {
      current.push(w);
    }
  }
  if (current.length) clauses.push(current.join(" "));

  const validClauses = clauses.filter(Boolean);
  if (validClauses.length <= 1) return [query];

  const baseRaw = validClauses[0].replace(/^(?:ما|ماذا|ماهو|ماهي|ما هي|ما هو|كيف|أين|اين|متى|هل|أريد|اريد)\s+/i, "").trim();
  const rootNoun = baseRaw.replace(/^(?:فضل|حكم|شروط|اركان|أركان|مبطلات|معنى|تعريف|كيفية|صفة)\s+/i, "").trim() || baseRaw;

  const topics = [baseRaw || validClauses[0]];
  for (let i = 1; i < validClauses.length; i++) {
    let p = validClauses[i].replace(/^(?:ما|ماذا|ماهو|ماهي|ما هي|ما هو)\s+/i, "").trim();
    if (p.endsWith("ها") && rootNoun) {
      topics.push(`${p.slice(0, -2)} ${rootNoun}`);
    } else if (p.endsWith("ه") && rootNoun) {
      topics.push(`${p.slice(0, -1)} ${rootNoun}`);
    } else if (p.length >= 2) {
      topics.push(p);
    }
  }
  return topics.length > 0 ? topics : [query];
}

/**
 * يصنّف النتائج حسب الموضوعات الفرعية.
 * @param {object[]} results
 * @param {string[]} topics
 * @returns {{clusters: Map<string, object[]>, fallback: object[]}}
 */
export function clusterResultsByTopic(results, topics) {
  const clusters = new Map();
  for (const t of topics) clusters.set(t, []);

  const fallback = [];
  for (const r of results) {
    const rText = normalizeAr(`${r.title || ""} ${r.summary || r.description || ""}`);
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
 * يبني الإجابة المنظمة المتكاملة من النتائج بدون اختلاق أي معلومات.
 * @param {string} rawQuery
 * @param {object[]} results
 * @param {object} [options={}]
 * @returns {object}
 */
export function assembleAnswer(rawQuery, results, options = {}) {
  const query = options.normalizedQuery || normalizeAr(rawQuery);
  const intent = options.intent || classifyQuestion(rawQuery);
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
    intent,
    totalResults: deduped.length,
    internalCount: internalResults.length,
    externalCount: externalResults.length,
    topics,
    disclaimer: "",
    internal: {
      summary: "",
      evidence: [], // آيات وأحاديث مخصصة
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
    noResultNotice: "",
  };

  if (intent === "ruling") {
    answer.disclaimer =
      "المعلومات التالية مستخرجة من محتوى الموقع الموثّق (الفتاوى والتفاسير المعتمدة)، وليست فتوى مستحدثة من المحرك.";
  }

  if (internalResults.length === 0 && externalResults.length === 0) {
    // Enhanced zero-result handling with spell-check, alternatives, related topics
    const words = query.split(/\s+/).filter(w => w.length >= 2);
    const spellFixes = words.map(w => correctSpelling(w)).filter((w, i) => w !== words[i]);
    const expandedTerms = words.map(w => expandAlias(w)).filter((w, i) => w !== words[i]);
    
    // Get related topics from knowledge graph
    const relatedTopics = getRelatedTopics(query).slice(0, 5);
    const expandedKeywords = words.flatMap(w => expandTopicKeywords(w)).slice(0, 5);
    
    // Build alternative suggestions
    const alternatives = [];
    if (spellFixes.length > 0) {
      alternatives.push({ type: "spell", text: spellFixes.join(" "), label: "تصحيح إملائي" });
    }
    if (expandedTerms.length > 0) {
      alternatives.push({ type: "alias", text: expandedTerms.join(" "), label: "مرادف/مصطلح بديل" });
    }
    if (words.length > 2) {
      // Suggest shorter query
      alternatives.push({ type: "shorten", text: words.slice(0, 2).join(" "), label: "استعلام أقصر" });
    }
    if (relatedTopics.length > 0) {
      alternatives.push({ type: "related", text: relatedTopics[0], label: "موضوع مرتبط" });
    }
    if (expandedKeywords.length > 0) {
      alternatives.push({ type: "keyword", text: expandedKeywords[0], label: "كلمة مفتاحية مقترحة" });
    }

    answer.noResultNotice = "لم أجد في محتوى الموقع الحالي معلومات كافية للإجابة عن هذا السؤال.";
    answer.zeroResultAlternatives = alternatives;
    answer.zeroResultRelatedTopics = relatedTopics;
    answer.zeroResultExpandedKeywords = expandedKeywords;
    return answer;
  }

  // 1. بناء إجابة المحتوى الداخلي
  if (internalResults.length > 0) {
    answer.internal.summary = buildSummary(internalResults.slice(0, 4));
    answer.internal.evidence = extractPrimaryEvidence(internalResults);
    answer.internal.sections = buildSections(clusters, fallback.filter((r) => !r.externalSource), topics);
    answer.internal.sources = buildSourceList(internalResults);
  }

  // 2. بناء إجابة المصادر الخارجية (مفصولة بوضوح)
  if (externalResults.length > 0) {
    answer.external.summary = buildSummary(externalResults.slice(0, 3));
    answer.external.sections = buildSections({ "نتائج من مصادر خارجية": externalResults }, [], ["نتائج من مصادر خارجية"]);
    answer.external.sources = buildSourceList(externalResults);
  }

  // 3. أسئلة مقترحة مستنبطة من المحتوى الحقيقي
  answer.relatedQuestions = generateRelatedQuestions(deduped, query);

  return answer;
}

/**
 * استخراج الأدلة الشرعية الأساسية (القرآن والأحاديث الموثقة)
 */
function extractPrimaryEvidence(results) {
  const evidence = [];
  const seen = new Set();

  for (const r of results) {
    const tier = SOURCE_TIERS[r.type] || 4;
    if (tier === 1) {
      const key = `${r.type}-${r.title}`;
      if (seen.has(key)) continue;
      seen.add(key);

      evidence.push({
        type: r.type,
        typeLabel: TYPE_LABELS[r.type] || "دليل شرعي",
        icon: TYPE_ICONS[r.type] || "📖",
        title: r.title,
        text: r.summary || r.description || "",
        route: r.route || "#",
        sourceId: r.sourceId,
      });
      if (evidence.length >= 6) break;
    }
  }

  return evidence;
}

function buildSummary(topResults) {
  if (!topResults.length) return "";
  const best = topResults[0];
  let text = best.summary || best.description || "";
  if (!text && topResults[1]) text = topResults[1].summary || topResults[1].description || "";
  if (text.length > 350) text = text.slice(0, 347).trim() + "…";
  return text;
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
      items: items.slice(0, 6).map(enrichItem),
    });
  }

  if (fallback.length > 0) {
    const seenItems = new Set();
    const existingIds = new Set();
    for (const s of sections) {
      for (const item of s.items) existingIds.add(item.id || item.title);
    }
    const unique = fallback.filter((r) => {
      const key = r.id || r.title;
      if (seenItems.has(key) || existingIds.has(key)) return false;
      seenItems.add(key);
      return true;
    });

    if (unique.length > 0) {
      sections.push({
        title: "نتائج إضافية ذات صلة",
        type: unique[0].type || "general",
        icon: TYPE_ICONS[unique[0].type] || "📋",
        tier: SOURCE_TIERS[unique[0].type] || 4,
        items: unique.slice(0, 6).map(enrichItem),
      });
    }
  }

  return sections.sort((a, b) => a.tier - b.tier);
}

function enrichItem(item) {
  const type = item.type || "general";
  const tier = SOURCE_TIERS[type] || 4;
  return {
    ...item,
    type,
    tier,
    typeLabel: TYPE_LABELS[type] || "محتوى",
    icon: TYPE_ICONS[type] || "📋",
    tierLabel: SOURCE_TIER_LABELS[tier] || "مصدر",
  };
}

function buildSourceList(results) {
  const sources = [];
  const seen = new Set();

  for (const r of results) {
    const key = `${r.sourceId || r.sourceName}|${r.route || r.title}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const type = r.type || "general";
    const tier = SOURCE_TIERS[type] || 4;

    sources.push({
      sourceId: r.sourceId || r.sourceName,
      title: r.title,
      route: r.route,
      type,
      tier,
      tierLabel: SOURCE_TIER_LABELS[tier] || "مصدر",
      typeLabel: TYPE_LABELS[type] || "محتوى",
      icon: TYPE_ICONS[type] || "📋",
      category: r.category,
      sourceName: r.sourceName || null,
      externalSource: Boolean(r.externalSource),
      canonicalUrl: r.canonicalUrl || r.route,
    });
  }

  return sources.sort((a, b) => a.tier - b.tier);
}

function generateRelatedQuestions(results, query) {
  const questions = [];
  const seen = new Set();
  seen.add(normalizeAr(query));

  const topicWords = normalizeAr(query)
    .split(" ")
    .filter((w) => w.length >= 3 && !["التي", "الذي", "عن", "في", "من", "إلى", "على"].includes(w));

  const questionTemplates = [
    "ما حكم {topic}؟",
    "ما فضل {topic}؟",
    "ما شروط {topic}؟",
    "ما أركان {topic}؟",
    "ما مبطلات {topic}؟",
    "كيفية {topic} في الإسلام؟",
    "أحاديث نبوية عن {topic}؟",
    "آيات من القرآن عن {topic}؟",
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

  // إضافة أسئلة من عناوين النتائج ذات الصلة
  for (const r of results) {
    if (questions.length >= 8) break;
    if (r.title && !seen.has(normalizeAr(r.title)) && r.title.length < 50) {
      if (r.type === "fatwa" || r.type === "quiz") {
        questions.push(r.title);
        seen.add(normalizeAr(r.title));
      }
    }
  }

  return questions.slice(0, 8);
}

/* =========================================================
 * QUESTION CLASSIFICATION & INTENT
 * ========================================================= */

export function classifyQuestion(query) {
  const q = normalizeAr(query);

  const patterns = [
    { type: "howto", keywords: ["طريقة", "خطوات", "كيفية", "كيف", "ازاي", "ازى", "شلون", "صفة"] },
    { type: "ruling", keywords: ["حكم", "يجوز", "حرام", "حلال", "فرض", "واجب", "سنة", "مباح", "مكروه", "يبطل", "تصح", "يصح"] },
    { type: "virtue", keywords: ["فضل", "فضيلة", "ثواب", "أجر", "نعيم", "جزاء", "منزلة"] },
    { type: "when", keywords: ["متى", "وقت", "أوقات", "مواقيت", "ساعة"] },
    { type: "where", keywords: ["أين", "مكان", "موقع", "فين", "وين", "قبلة"] },
    { type: "why", keywords: ["لماذا", "لم", "سبب", "علة", "حكمة", "ليه", "ليش"] },
    { type: "comparison", keywords: ["فرق", "فارق", "بين", "الفرق", "مقارنة"] },
    { type: "story", keywords: ["قصة", "قصص", "حدث", "حكاية", "غزوة", "سيرة"] },
    { type: "definition", keywords: ["ما هو", "ما هي", "شو", "ايه", "إيه", "ماذا", "ماهو", "ماهي", "المقصود", "معنى"] },
  ];

  for (const { type, keywords } of patterns) {
    for (const kw of keywords) {
      if (q.includes(kw)) return type;
    }
  }

  return "general";
}

/**
 * يعرض نصائح بديلة للاستعلام عند عدم وجود نتائج كافية.
 * @param {string} query
 * @param {object} registry
 * @returns {object[]}
 */
export function suggestAlternatives(query, registry) {
  const words = normalizeAr(query).split(" ").filter((w) => w.length >= 3);
  const suggestions = [];

  if (words.length > 1) {
    suggestions.push({ type: "shorten", text: words.slice(0, 2).join(" ") });
  }

  const expanded = [];
  for (const w of words) {
    const sources = registry && typeof registry.getAll === "function" ? registry.getAll() : [];
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
