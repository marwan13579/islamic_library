/**
 * أدوات القارئ: تفضيلات القراءة، والفهرس، والبحث في النص.
 *
 * صفحة واحدة لكل هذه الخيارات تكرّرها في كل قارئ، ولا واحدة منها في
 * القارئ الحاضر. فجُمعت هنا، و`reader.html` يستعملها، ويصلح أن يستعملها
 * قارئٌ آخر: يكفي أن يمرّر له عنصرًا فيه المتن ويقبل دالّتَي نسخ ومشاركة.
 *
 * التفضيلات في التخزين المحليّ وحده، فليس فيها حساب ولا إرسال شيء.
 * @module components/reader-tools

 */

import { read, write, KEYS } from "../lib/storage.js";

/** الخطوط المتاحة: نسخٌ للقراءة وخطٌّ للحديث والنظام. */
const FONTS = {
  amiri: { label: "أميري", stack: '"Amiri", "Cairo", serif' },
  cairo: { label: "حديث", stack: '"Cairo", "Amiri", sans-serif' },
  system: { label: "النظام", stack: "system-ui, sans-serif" },
};

/** ثلاثة مواضع للتباعد، من الضيّق إلى الواسع. */
const LINES = { tight: 1.8, normal: 2.15, loose: 2.6 };

/** @param {string} name @param {Record<string, unknown>} table */
function pick(name, table, fallback) {
  const saved = read(name, fallback);
  return Object.hasOwn(table, String(saved)) ? String(saved) : fallback;
}

/**
 * يطبّق تفضيلات القراءة على الجذر.
 *
 * الحجم يُخزَّن في مفتاح الحجم العامّ `KEYS.fontSize` فيتّفق القارئ مع
 * الموقع كلّه، والخطّ والتباعد لهما مفتاحاهما.
 */
function applyPrefs() {
  const root = document.documentElement;
  const font = FONTS[pick(KEYS.readerFont, FONTS, "amiri")];
  const line = LINES[pick(KEYS.readerLine, LINES, "normal")];
  const scale = read(KEYS.fontSize, 1);
  root.style.setProperty("--rf", font.stack);
  root.style.setProperty("--rl", String(line));
  root.style.setProperty("--fs", String(typeof scale === "number" ? scale : 1));
}

function button(label, title) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "rtool";
  el.textContent = label;
  if (title) el.title = title;
  return el;
}

/**
 * فهرس المتن: عناوينه بترتيب وروده.
 * @param {HTMLElement} body
 * @returns {{head: HTMLElement, rows: {label: string, target: HTMLElement}[]}}
 */
export function buildOutline(body) {
  const rows = [];
  for (const node of body.querySelectorAll("h2, h3, h4")) {
    if (!node.id) node.id = `h-${rows.length + 1}`;
    rows.push({ label: node.textContent || "", target: /** @type {HTMLElement} */ (node) });
  }

  const head = document.createElement("div");
  head.className = "router";
  head.hidden = true;

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "rlib-empty";
    empty.textContent = "لا عناوين في هذا المتن.";
    head.appendChild(empty);
  } else {
    const list = document.createElement("ol");
    list.className = "routline";
    for (const row of rows) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${row.target.id}`;
      link.textContent = row.label;
      item.appendChild(link);
      list.appendChild(item);
    }
    head.appendChild(list);
  }

  body.parentNode?.insertBefore(head, body);
  return { head, rows };
}

/**
 * يبرز كل ورودات النصّ داخل المتن ويعيد عددها.
 *
 * يمشي على عقد النصّ لا على الشيفرة، فلا يُعاد بناء HTML ولا يُدخل
 * وسومٌ من نصّ المتن. والكلمة تُطابَق بعد تجريد التشكيل والهمزات،
 * ف找到了 في «الصَّلاة» ما لم يُكتب على ما لم يُكتب في «الصلاه».
 * @param {HTMLElement} body
 * @param {string} query
 * @returns {number}
 */
export function findInBody(body, query) {
  for (const old of body.querySelectorAll("mark.rfind")) {
    old.replaceWith(document.createTextNode(old.textContent || ""));
  }
  body.normalize();

  const needle = String(query)
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .trim();
  if (needle.length < 2) return 0;

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  /** @type {Text[]} */
  const texts = [];
  let node = walker.nextNode();
  while (node) {
    texts.push(/** @type {Text} */ (node));
    node = walker.nextNode();
  }

  let hits = 0;
  for (const text of texts) {
    const source = text.textContent || "";
    if (!/[ً-ْـ]/.test(source) && !/[أإآ]/.test(source)) continue;
    /* ويُترك النصّ بلا تشكيل ولا همزة: لا يُطابَق بعد التجريد ولا داعي
       لت特的ه، ولئلّا نلفّ كل كلمة في وسم. */
    const folded = source.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا");
    const at = folded.toLowerCase().indexOf(needle.toLowerCase());
    if (at < 0) continue;

    const after = document.createElement("span");
    after.textContent = source.slice(at + needle.length);
    const mark = document.createElement("mark");
    mark.className = "rfind";
    mark.textContent = source.slice(at, at + needle.length);
    const before = document.createTextNode(source.slice(0, at));
    text.replaceWith(before, mark, after);
    hits += 1;
  }
  return hits;
}

/**
 * ينصب أدوات القارئ على متن element.
 *
 * @param {{body: HTMLElement, onCopy?: (text: string) => Promise<void>|void, onShare?: (text: string) => Promise<void>|void}} options
 * @returns {{outline: ReturnType<typeof buildOutline>}}
 */
export function mountReaderTools({ body, onCopy, onShare }) {
  applyPrefs();

  const bar = document.createElement("div");
  bar.className = "rtools";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "أدوات القراءة");

  /* الخطّ */
  const fontPicker = document.createElement("select");
  fontPicker.className = "rtool rsel";
  fontPicker.setAttribute("aria-label", "نوع الخط");
  for (const [key, font] of Object.entries(FONTS)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = font.label;
    fontPicker.appendChild(option);
  }
  fontPicker.value = pick(KEYS.readerFont, FONTS, "amiri");
  fontPicker.addEventListener("change", () => {
    write(KEYS.readerFont, fontPicker.value);
    applyPrefs();
  });
  bar.appendChild(fontPicker);

  /* الحجم، بمفتاحه العامّ */
  const smaller = button("أ−", "تصغير الخط");
  const larger = button("أ+", "تكبير الخط");
  const scaleNow = () => Number(read(KEYS.fontSize, 1));
  smaller.addEventListener("click", () => {
    write(KEYS.fontSize, Math.max(0.85, Number((scaleNow() - 0.1).toFixed(2))));
    applyPrefs();
  });
  larger.addEventListener("click", () => {
    write(KEYS.fontSize, Math.min(1.6, Number((scaleNow() + 0.1).toFixed(2))));
    applyPrefs();
  });
  bar.append(smaller, larger);

  /* التباعد */
  const linePicker = document.createElement("select");
  linePicker.className = "rtool rsel";
  linePicker.setAttribute("aria-label", "تباعد الأسطر");
  for (const [key, value] of Object.entries(LINES)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = { tight: "ضيّق", normal: "معتدل", loose: "واسع" }[key];
    linePicker.appendChild(option);
  }
  linePicker.value = pick(KEYS.readerLine, LINES, "normal");
  linePicker.addEventListener("change", () => {
    write(KEYS.readerLine, linePicker.value);
    applyPrefs();
  });
  bar.appendChild(linePicker);

  /* الفهرس */
  const outline = buildOutline(body);
  const toc = button("المحتويات", "فهرس العناوين");
  toc.setAttribute("aria-expanded", "false");
  toc.addEventListener("click", () => {
    outline.head.hidden = !outline.head.hidden;
    toc.setAttribute("aria-expanded", outline.head.hidden ? "false" : "true");
    if (!outline.head.hidden) outline.head.scrollIntoView({ block: "start" });
  });
  bar.appendChild(toc);

  /* البحث في النصّ */
  const findField = document.createElement("input");
  findField.type = "search";
  findField.className = "rtool rfind-field";
  findField.placeholder = "ابحث في النصّ";
  findField.setAttribute("aria-label", "البحث في نصّ هذا المتن");
  const hits = document.createElement("span");
  hits.className = "rhits";
  hits.setAttribute("aria-live", "polite");
  let found = 0;
  findField.addEventListener("input", () => {
    found = findInBody(body, findField.value);
    hits.textContent = findField.value.trim().length < 2 ? "" : `${found} موضعًا`;
    if (found) {
      const first = body.querySelector("mark.rfind");
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
  bar.append(findField, hits);

  /* النسخ والمشاركة */
  const plain = () => (body.textContent || "").trim();
  const copy = button("نسخ", "نسخ النصّ");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(plain());
      copy.textContent = "نُسخ ✓";
    } catch {
      copy.textContent = "تعذّر النسخ";
    }
    setTimeout(() => {
      copy.textContent = "نسخ";
    }, 1800);
  });
  bar.appendChild(copy);

  const share = button("مشاركة", "مشاركة العنوان");
  share.addEventListener("click", async () => {
    if (onShare) await onShare(plain());
    else if (navigator.share) await navigator.share({ title: document.title, url: location.href });
  });
  bar.appendChild(share);

  body.parentNode?.insertBefore(bar, body);
  return { outline };
}
