/**
 * Knowledge Graph — خريطة المعرفة للمحتوى الإسلامي.
 *
 * تربط الموضوعات ببعضها البعض:
 * - آيات → أحاديث → تفسير → كتب → أذكار → مواضيع مرتبطة
 *
 * تستخدم في:
 * - اقتراح مواضيع مرتبطة
 * - فهم نية المستخدم
 * - توسيع الاستعلام
 * - تجميع النتائج
 *
 * بدون AI خارجي. كل العلاقات معرّفة يدوياً أو مستخرجة من البيانات الموجودة.
 * @module lib/knowledge-graph
 */

import { normalizeAr } from "./text.js";
import { SOURCE_TIERS } from "./answer-engine.js";

/**
 * خريطة الموضوعات المركزية والعلاقات بينها.
 * يُمكن توسيعها تلقائياً من `ENCYCLOPEDIA_CATEGORIES` و`TOPIC_RELATIONSHIPS`.
 */
const KNOWLEDGE_MAP = {
  صلاة: {
    quran: ["الصلاة", "أقم الصلاة", "الموتى", "الصلاة", "ركوع", "سجود"],
    hadith: ["صلاة", "الصلوات", "إمام", "جماعة", "سنة", "أذان", "إقامة"],
    tafsir: ["الصلاة", "أقم", "مواقيت"],
    fiqh: ["طهارة", "وضوء", "غسل", "تيمم", "أذان", "إقامة", "فرائض", "سنن", "مبطلات", "سهو", "مسافر", "مريض", "جمع", "قصر", "جمعة", "عيد"],
    adhkar: ["أذكار بعد الصلاة", "أذكار الصباح", "أذكار المساء", "تسبيح", "استغفار"],
    tools: ["مواقيت الصلاة", "القبلة", "أذان", "مسبحة"],
    occasions: ["جمعة", "عيد الفطر", "عيد الأضحى", "رمضان"],
    relatedTopics: ["وضوء", "أذان", "قبلة", "صيام", "زكاة", "طهارة"],
  },
  وضوء: {
    fiqh: ["وضوء", "أركان", "سنن", "مبطلات", "مسح", "خف", "نواجذ"],
    relatedTopics: ["صلاة", "طهارة", "غسل", "تيمم", "مسجد"],
  },
  زكاة: {
    quran: ["زكاة", "صدقة", "إنفاق", "فقراء", "مساكين"],
    hadith: ["زكاة", "صدقة", "نصاب", "خراج", "عشر"],
    fiqh: ["نصاب ذهب", "نصاب فضة", "زكاة المال", "زكاة التجارة", "زكاة الأنعام", "زكاة الزرع", "زكاة المعادن", "زكاة الفطر", "مصارف الزكاة"],
    tools: ["حاسبة زكاة"],
    relatedTopics: ["صدقة", "مال", "نصاب", "فقر"],
  },
  صيام: {
    quran: ["صيام", "رمضان", "إفطار", "سحور"],
    hadith: ["صيام", "رمضان", "صائم", "سحور", "إفطار", "ليلة القدر"],
    fiqh: ["نية", "إفطار", "سحور", "قضاء", "كفارة", "فدية", "مسافر", "مريض"],
    adhkar: ["دعاء الصائم", "دعاء الإفطار", "دعاء السحور"],
    relatedTopics: ["رمضان", "زكاة الفطر", "اعتكاف", "ليلة القدر"],
  },
  قرآن: {
    quran: ["آية", "سورة", "جزء", "حزب", "تلاوة", "حفظ", "تجويد"],
    tafsir: ["تفسير", "معنى", "غريب", "ناسخ", "منسوخ"],
    tools: ["مصحف", "تلاوة", "تجويد", "تفسير", "حفظ", "ختمة", "ورد"],
    relatedTopics: ["تفسير", "حديث", "أذكار", "صلاة"],
  },
  حديث: {
    quran: ["حديث", "تلاوة", "حفظ"],
    tafsir: ["تفسير", "معنى"],
    fiqh: ["أحكام"],
    relatedTopics: ["سيرة", "فقه", "عقيدة", "أخلاق"],
  },
  حج: {
    quran: ["حج", "بيت", "كعبة", "صفا", "مروة", "عرفات"],
    hadith: ["حج", "عمرة", "إحرام", "طواف", "سعي", "رمي"],
    fiqh: ["إحرام", "طواف", "سعي", "وقوف", "رمي", "ذبح", "تحلل"],
    relatedTopics: ["عمرة", "إحرام", "مناسك", "عيد الأضحى"],
  },
  ذكر: {
    quran: ["ذكر", "تسبيح", "تهليل", "تحميد", "تكبير", "استغفار"],
    hadith: ["ذكر", "تسبيح", "تهليل", "دعاء", "استغفار", "أذكار"],
    adhkar: ["صباح", "مساء", "نوم", "استيقاظ", "بعد صلاة", "مسجد", "سفر", "طعام"],
    tools: ["مسبحة", "عداد"],
    relatedTopics: ["دعاء", "استغفار", "توبة"],
  },
  موت: {
    quran: ["موت", "وفاة", "بعث", "حساب", "ميزان", "صراط"],
    hadith: ["موت", "وفاة", "قبر", "عذاب", "نعيم", "حوض"],
    relatedTopics: ["آخرة", "جنة", "نار", "عزاء", "إيمان"],
  },
  بر: {
    hadith: ["بر", "والدين", "صلة", "رحم"],
    akhlaq: ["بر", "صلة", "إحسان", "عفو"],
    relatedTopics: ["والدين", "صلة رحم", "إحسان", "أخلاق"],
  },
  مال: {
    fiqh: ["ربا", "بيع", "إجارة", "مضاربة", "وقف", "هبة"],
    relatedTopics: ["زكاة", "صدقة", "فقه معاملات", "اقتصاد"],
  },
  نساء: {
    fiqh: ["حجاب", "خمار", "جلباب", "عورة", "ستر"],
    relatedTopics: ["أسرة", "زواج", "طلاق", "أطفال"],
  },
};

/**
 * يعيد الموضوعات المرتبطة بموضوع معين.
 */
export function getRelatedTopics(topic) {
  const normalized = normalizeAr(topic);
  for (const [key, data] of Object.entries(KNOWLEDGE_MAP)) {
    if (normalizeAr(key).includes(normalized) || normalized.includes(normalizeAr(key))) {
      return data.relatedTopics || [];
    }
  }
  return [];
}

/**
 * يعيد الكلمات المفتاحية الموسّعة لموضوع معين.
 */
export function expandTopicKeywords(topic) {
  const normalized = normalizeAr(topic);
  const keywords = new Set();

  for (const [key, data] of Object.entries(KNOWLEDGE_MAP)) {
    if (normalizeAr(key).includes(normalized) || normalized.includes(normalizeAr(key))) {
      for (const arr of Object.values(data)) {
        for (const w of arr) {
          keywords.add(normalizeAr(w));
        }
      }
      break;
    }
  }

  return [...keywords];
}

/**
 * يعطي درجة importance لموضوع داخل الاستعلام.
 */
export function topicImportance(topic, query) {
  const nt = normalizeAr(topic);
  const nq = normalizeAr(query);
  if (nq.includes(nt)) return 1.0;
  if (nt.includes(nq) && nq.length >= 3) return 0.9;
  const words = nq.split(" ").filter((w) => w.length >= 3);
  for (const w of words) {
    if (nt.includes(w)) return 0.7;
  }
  return 0;
}

/**
 * يبني رسم بياني بسيط من النتائج للاستخدام في الـ UI.
 */
export function buildKnowledgeGraph(results) {
  const nodes = new Map();
  const edges = [];

  for (const r of results) {
    const id = r.id || r.title;
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        title: r.title,
        type: r.type,
        category: r.category,
        tier: SOURCE_TIERS[r.type] || 4,
      });
    }
  }

  for (const r of results) {
    const id = r.id || r.title;
    const related = getRelatedTopics(r.title || "");
    for (const rel of related) {
      const match = results.find((x) => normalizeAr(x.title || "").includes(normalizeAr(rel)));
      if (match) {
        edges.push({ from: id, to: match.id || match.title, relation: rel });
      }
    }
  }

  return {
    nodes: [...nodes.values()].sort((a, b) => a.tier - b.tier),
    edges,
  };
}
