/**
 * أوقات النهي عن الصلاة.
 *
 * القاعدة شرعية سمعية: المنع من الصلاة في ثلاثة أوقات وردت في السنّة، ولم
 * يعرضه القرآن نصًّا مستقلًّا. فالمرتكز القرآني هنا هو أنّ الصلاة لها أوقات
 * محدّدة يجب حفظها، لا أنّ هذه الأوقات الثلاثة ذُكرت بنصّها.
 *
 * لذلك:
 *  - كل آية في هذه الوحدة **متحقَّق منها آليًّا** مقابل `vendor/quran-arabic.json`
 *    في `tests/forbidden-times.test.js`، وهي основа التوقيت لا نصّ المنع.
 *  - الأوقات الثلاثة نفسها من السنّة، ولا تحمل تخريجًا؛ فهي مُدرجة في
 *    `npm run review` تحت «يحتاج مراجعة» حتى يثبّتها أهل العلم برقمها.
 *
 * @module data/forbidden-times
 */

/**
 * @typedef {object} ForbiddenWindow
 * @property {string} id
 * @property {string} title
 * @property {string} detail الحكم بالعربية
 * @property {[string, string]} bounds مفتاحا المواقيت اللذان يحدّان النافذة
 * @property {number} [padMinutes] تمديد قبل الموعد وبعده بالدقائق
 * @property {Array<{ayah: string, ref: string}>} evidence آيات التوقيت
 * @property {string} note ملاحظة تربوية
 */

/** @type {ForbiddenWindow[]} */
export const FORBIDDEN_PRAYER_TIMES = [
  {
    id: "dawn",
    title: "من طلوع الفجر إلى طلوع الشمس",
    detail: "تُترك الصلاة حتى تطلع الشمس.",
    bounds: ["Fajr", "Sunrise"],
    evidence: [
      {
        ayah: "﴿ إِنَّ ٱلصَّلَوٰةَ كَانَتْ عَلَى ٱلْمُؤْمِنِينَ كِتَـٰبًۭا مَّوْقُوتًۭا ﴾",
        ref: "النساء: ١٠٣",
      },
    ],
    note: "يعلو الفجر بعد صلاة الفجر، فإذا اشتدّ ضوء الشمس وطلعت من المشرق ارتفعت الصلاة.",
  },
  {
    id: "zenith",
    title: "وقت استواء الشمس وزوالها",
    detail: "إذا استوت الشمس في كبد السماء حرُم الردّ إلى زوالها.",
    bounds: ["Dhuhr", "Dhuhr"],
    padMinutes: 15,
    evidence: [
      {
        ayah: "﴿ حَٰفِظُوا۟ عَلَى ٱلصَّلَوٰتِ وَٱلصَّلَوٰةِ ٱلْوُسْطَىٰ وَقُومُوا۟ لِلَّهِ قَـٰنِتِينَ ﴾",
        ref: "البقرة: ٢٣٨",
      },
    ],
    note: "هذا أوجز الأوقات الثلاثة، ومدّته نحو ربع ساعة: قبل الظهر قليلًا وبعده قليلًا.",
  },
  {
    id: "asr-to-sunset",
    title: "من ارتفاع العصر إلى غروب الشمس",
    detail: "إذا احمرّ العصر حرُم أداء الصلاة حتى تغرب الشمس.",
    bounds: ["Asr", "Maghrib"],
    evidence: [
      {
        ayah: "﴿ إِنَّ ٱلصَّلَوٰةَ كَانَتْ عَلَى ٱلْمُؤْمِنِينَ كِتَـٰبًۭا مَّوْقُوتًۭا ﴾",
        ref: "النساء: ١٠٣",
      },
    ],
    note: "احمرار الشمس دليل على قرب الغروب، فإذا غابت صلّيت المغرب.",
  },
];

/**
 * يحوّل "05:12" إلى دقائق من منتصف الليل.
 * @param {string | undefined} value
 * @returns {number | null}
 */
export function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * يحسب بداية النافذة ونهايتها بالدقائق، جاهزَين للعرض.
 * @param {ForbiddenWindow} window
 * @param {Record<string, string>} timings مواقيت اليوم من AlAdhan
 * @returns {{id: string, title: string, detail: string, from: number | null, to: number | null, note: string} | null}
 */
export function resolveWindow(window, timings) {
  const [fromKey, toKey] = window.bounds;
  const pad = window.padMinutes ?? 0;

  let from = parseClock(timings?.[fromKey]);
  let to = parseClock(timings?.[toKey]);
  if (from === null || to === null) return null;

  if (window.padMinutes) {
    // نافذة حول الموعد: قبله وبعده
    from = from - pad;
    return {
      id: window.id,
      title: window.title,
      detail: window.detail,
      from: (from + 1440) % 1440,
      to: (to + pad) % 1440,
      note: window.note,
    };
  }

  if (to < from) to += 1440; // النافذة تعبر منتصف الليل
  return { id: window.id, title: window.title, detail: window.detail, from, to, note: window.note };
}

/**
 * يحوّل الدقائق إلى نصّ «ساعة و٢٠ دقيقة».
 * @param {number} total
 * @returns {string}
 */
export function humanMinutes(total) {
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}`;
}

/**
 * يبني نصّ النافذة: «من ٠٥:١٢ إلى ٠٦:٠٣».
 * @param {ReturnType<typeof resolveWindow>} window
 * @returns {string}
 */
export function windowText(window) {
  if (!window) return "—";
  return `من ${humanMinutes(window.from)} إلى ${humanMinutes(window.to)}`;
}
