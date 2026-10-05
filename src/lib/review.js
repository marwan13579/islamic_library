/**
 * تعريف مجموعات النصوص المنسوبة إلى أهلها، وقواعد تقدير قوّة التخريج.
 *
 * يشترك فيه سطران أمر:
 *  - `scripts/review-report.cjs` (تقرير الطرفية)
 *  - `src/site/review.html`      (ورقة المراجعة للمتصفح)
 *
 * القاعدة الوحيدة التي تفرضها الأداة: كل نصٍّ منسوب إلى النبي ﷺ أو الصحابة
 * أو السلف يجب أن يحمل تخريجًا. الأداة لا تحكم على صحة النصّ، فذلك لأهل العلم.
 *
 * @module lib/review
 */

import { ATHKAR_REFERENCES, FORBIDDEN_TIME_REFERENCES, normalizeAthkar, PROPHET_REFERENCES, SEERAH_REFERENCES } from "../data/review-references.js";

/** @typedef {"بلا تخريج"|"اسم مجموعة"|"مخرَّج"|"آية"} ReviewStatus */

/**
 * الدعاء أو الذكر القرآني يُذكر بسورة ورقم آية، وهو موثّق بنصّه لا بتخريج مختصر.
 * @param {string} ref
 */
const isQuranic = (ref) => /سورة|:\s*[\u0660-\u0669\u0030-\u0039]+$/.test(String(ref ?? "").trim());

/**
 * @typedef {object} ReviewEntry
 * @property {string} title
 * @property {string} text
 * @property {string} ref
 * @property {string | undefined} url
 * @property {ReviewStatus} status
 */

/**
 * @typedef {object} ReviewGroup
 * @property {string} id
 * @property {string} file
 * @property {string} label
 * @property {(mod: Record<string, unknown>) => unknown[]} read
 * @property {((item: any) => any[]) | undefined} expand
 * @property {(item: any) => string} title
 * @property {(item: any) => string} text
 * @property {(item: any) => string | undefined} ref
 * @property {((item: any) => string | undefined) | undefined} url
 * @property {boolean | undefined} advisory
 */

/** @type {ReviewGroup[]} */
export const ATTRIBUTED = [
  {
    id: "APP_DUAS",
    file: "app-duas.js",
    label: "الأدعية",
    read: (mod) => mod.APP_DUAS,
    title: (item) => item.title,
    text: (item) => item.text,
    ref: (item) => item.ref,
  },
  {
    id: "HADITHS",
    file: "hadiths.js",
    label: "الأحاديث",
    read: (mod) => mod.HADITHS,
    title: (item) => item.title,
    text: (item) => item.text,
    ref: (item) => item.ref,
  },
  {
    id: "ATHKAR_DATA",
    file: "app-athkar.js",
    label: "الأذكار",
    read: (mod) => mod.ATHKAR_DATA,
    expand: (data) =>
      data.flatMap((cat) =>
        (cat.items ?? []).map((item) => {
          const normalized = normalizeAthkar(item);
          return {
            ...normalized,
            ...(ATHKAR_REFERENCES[normalized.text] ?? {}),
            category: cat.category,
          };
        }),
      ),
    title: (item) => item.category,
    text: (item) => item.text,
    ref: (item) => item.ref,
    url: (item) => item.url,
  },
  {
    id: "SEERAH",
    file: "seerah.js",
    label: "محاور السيرة",
    read: (mod) => mod.SEERAH,
    title: (item) => `${item.year} — ${item.title}`,
    text: (item) => item.desc,
    ref: (item) => item.ref ?? SEERAH_REFERENCES[item.title]?.ref,
    url: (item) => SEERAH_REFERENCES[item.title]?.url,
    advisory: true,
  },
  {
    id: "PROPHETS",
    file: "prophets.js",
    label: "الأنبياء",
    read: (mod) => mod.PROPHETS,
    title: (item) => item.title,
    text: (item) => item.desc,
    ref: (item) => item.ref ?? PROPHET_REFERENCES[item.title]?.ref,
    url: (item) => PROPHET_REFERENCES[item.title]?.url,
    advisory: true,
  },
  {
    id: "SAYINGS",
    file: "sayings.js",
    label: "الأقوال",
    read: (mod) => mod.SAYINGS,
    title: (item) => item.author,
    text: (item) => item.txt,
    ref: (item) => item.src,
    advisory: true,
  },
  {
    id: "LESSONS",
    file: "lessons-extra.js",
    label: "دروس الآداب المضافة",
    read: (mod) => mod.EXTRA_LESSONS,
    /** فقرة الإجابة عن أي سؤال، وهي خلاصة الحكم داخل الدرس. */
    expand: (data) =>
      data.map((lesson) => ({
        ...lesson,
        summary: lesson.faq.map((item) => `${item.q} — ${item.a}`).join(" | "),
      })),
    title: (item) => `${item.title} (${item.cat})`,
    text: (item) => item.summary,
    ref: () => "",
    /** الأحكام الفقهية من تحرير الطالب، ومصدرها لم يُثبَّت بعد. */
    advisory: true,
  },
  {
    id: "FORBIDDEN_TIMES",
    file: "forbidden-times.js",
    label: "أوقات النهي عن الصلاة",
    read: (mod) => mod.FORBIDDEN_PRAYER_TIMES,
    expand: (data) =>
      data.map((window) => ({
        ...window,
        summary: `${window.detail} الآيات: ${window.evidence.map((e) => e.ref).join("، ")}`,
      })),
    title: (item) => item.title,
    text: (item) => item.summary,
    ref: (item) => FORBIDDEN_TIME_REFERENCES[item.id]?.ref,
    url: (item) => FORBIDDEN_TIME_REFERENCES[item.id]?.url,
    /** المنع من السنّة، والآيات أصل التوقيت لا نصّ المنع فيحدّه. */
    advisory: true,
  },
];

/**
 * يقدّر قوّة التخريج في نصّ واحد.
 * @param {string | undefined} ref
 * @returns {ReviewStatus}
 */
export function statusOf(ref) {
  const value = String(ref ?? "").trim();
  if (!value) return "بلا تخريج";
  if (isQuranic(value)) return "آية";
  return /[\u0660-\u0669\u0030-\u0039]/.test(value) ? "مخرَّج" : "اسم مجموعة";
}

/** تسمية مختصرة للحالة تُعرض للمستخدم. */
export const STATUS_LABEL = {
  "بلا تخريج": "يحتاج تخريجًا",
  "اسم مجموعة": "اسم مجموعة فقط",
  "مخرَّج": "مخرَّج",
  "آية": "آية",
};

/**
 * يحوّل وحدة بيانات إلى عناصر مراجعة.
 * @param {ReviewGroup} group
 * @param {Record<string, unknown>} mod
 * @returns {ReviewEntry[]}
 */
export function entriesOf(group, mod) {
  const raw = group.read(mod);
  const items = group.expand ? group.expand(raw) : raw;
  return items.map((item) => {
    const ref = group.ref(item) ?? "";
    return {
      title: group.title(item) || "(بلا عنوان)",
      text: group.text(item) || "",
      ref: String(ref),
      url: group.url?.(item),
      status: statusOf(ref),
    };
  });
}

/**
 * المجموعات التي absence تخريج فيها يمنع النشر.
 * @param {ReviewGroup} group
 */
export const isBlocking = (group) => !group.advisory;
