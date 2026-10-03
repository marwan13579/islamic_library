/**
 * واجهة تصفح مشتركة لصفحات المكتبة المستوردة.
 *
 * الفتاوى والخطب والتاريخ صفحة واحدة في الأصل، اختلافها في الاسم
 * والمصدر فقط. فصارت الواجهة هنا وصفحاتها تستدعيها.
 * @module lib/content-ui
 */

import { escapeHtml, toArNum, normalizeAr } from "./text.js";
import { collectionMeta } from "./shards.js";
import { browse, browseCategory, PAGE_SIZE } from "./library.js";

/** اسم كل مجموعة ووجهتها في المكتبة. */
export const COLLECTIONS = {
  fatwa: {
    title: "الفتاوى",
    page: "37-fatwa.html",
    of: "الدكتور عبد الرحمن بن ناصر البراك",
    lead: "فتاوى موثّقة مرتّبة وتصنيفها محفوظ، فتُقرأ الفتاوى واحدةً واحدة ولا تُحمَّل المكتبة كلها.",
  },
  khutbahs: {
    title: "الخطب",
    page: "38-khutbah.html",
    of: "إدارة الشؤون الإسلامية",
    lead: "خطب ودروس محاضرات، مقسّمة إلى مراحل وأحوال، تُقرأ بصفح واحد.",
  },
  history: {
    title: "التاريخ الإسلامي",
    page: "39-tarikh.html",
    of: "موقع الإسلام",
    lead: "أحداث مرتّبة من هجرة النبي ﷺ إلى نهاية الدولة العثمانية، تقرأها زمنيًا.",
  },
};

/** ترتيب العرض المخيَّل للصفحات. */
const SORTS = [
  { id: "newest", label: "الأحدث" },
  { id: "oldest", label: "الأقدم" },
];

/**
 * ينظّف نصًّا markdown خفيفًا إلى HTML.
 *
 * الفراغات في المصدر عشوائية: الخطب مسطّرة بالمسافات البادئة، والتاريخ
 * فقرة واحدة طويلة. فتُزاح المسافات، وتُطرح السطور الخالية، ويبقى سطر
 * في الفقرة سطرًا جديدًا — وهو ما يجعل فهرس الخطبة يبدو فهرسًا.
 * @param {string} value
 * @returns {string}
 */
export function renderBody(value) {
  const blocks = String(value || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.replace(/[ \t ]+/g, " ").trim())
        .filter(Boolean)
    )
    .filter((lines) => lines.length);

  return blocks
    .map((lines) => {
      const head = lines[0];
      if (head.startsWith("### ")) {
        return `<h3>${escapeHtml(head.slice(4))}</h3>` +
          lines.slice(1).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
      }
      const body = lines
        .map((line) => escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"))
        .join("<br>");
      return `<p>${body}</p>`;
    })
    .join("");
}

/**
 * قيمة من عنوان الصفحة.
 * @param {string} name
 * @param {string} [fallback]
 * @returns {string}
 */
export function param(name, fallback = "") {
  return new URLSearchParams(location.search).get(name) || fallback;
}

/** يبني ترقيم الصفحات. */
function paintPager(box, page, pages, go) {
  box.innerHTML = "";
  if (pages <= 1) return;

  const prev = document.createElement("button");
  prev.type = "button";
  prev.textContent = "السابق";
  prev.disabled = page <= 1;
  prev.addEventListener("click", () => go(page - 1));

  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "التالي";
  next.disabled = page >= pages;
  next.addEventListener("click", () => go(page + 1));

  const cur = document.createElement("span");
  cur.className = "cur";
  cur.textContent = `صفحة ${toArNum(page)} من ${toArNum(pages)}`;

  box.append(prev, cur, next);
}

/**
 * يركّب صفحة تصفح كاملة لمجموعة.
 * @param {string} type مفتاح من `COLLECTIONS`
 * @param {{sorts: HTMLElement, chips: HTMLElement, search: HTMLInputElement, list: HTMLElement, count: HTMLElement, pager: HTMLElement}} refs
 * @returns {Promise<void>}
 */
export async function mountCollection(type, refs) {
  const info = COLLECTIONS[type];
  const meta = await collectionMeta(type);
  let page = Math.max(1, Number(param("page", "1")) || 1);
  let sort = param("sort", "newest");
  let category = param("cat", "");
  let term = "";

  /** شريط الترتيب. */
  for (const item of SORTS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lib-chip";
    btn.textContent = item.label;
    btn.setAttribute("aria-pressed", item.id === sort ? "true" : "false");
    btn.addEventListener("click", () => {
      sort = item.id;
      for (const node of refs.sorts.children) {
        node.setAttribute("aria-pressed", node.textContent === item.label ? "true" : "false");
      }
      go();
    });
    refs.sorts.appendChild(btn);
  }

  /** شريط التصنيفات: «الكل» ثم كل فئة تحمل عددها. */
  const all = document.createElement("button");
  all.type = "button";
  all.className = "lib-chip";
  all.textContent = "الكل";
  all.setAttribute("aria-pressed", category ? "false" : "true");
  all.addEventListener("click", () => {
    category = "";
    page = 1;
    go();
  });
  refs.chips.appendChild(all);

  for (const group of meta.categories || []) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "lib-chip";
    /* عدّاد الفئات في البيان يعدّ التكرارات، وعدّاد التصنيف يعدّ العناصر.
       والفارق ظاهر: «الجهاد والسير» ٩٦ في الشارة و٦٧ في القائمة نفسها،
       فيلزم واحدٌ منهما. والقائمة هي التي تُعرض، فالعدّاد منها. */
    const count = (meta.catIndex && meta.catIndex[group.name]?.count) ?? group.count;
    chip.innerHTML = `${escapeHtml(group.name)}<span class="n">${toArNum(count)}</span>`;
    chip.setAttribute("aria-pressed", group.name === category ? "true" : "false");
    chip.addEventListener("click", () => {
      category = group.name;
      page = 1;
      go();
    });
    refs.chips.appendChild(chip);
  }

  /** يعرض صفحة واحدة. */
  async function go(target) {
    if (target) page = target;
    refs.list.innerHTML = `<p class="lib-state">جارٍ التحميل…</p>`;
    refs.count.textContent = "";

    try {
      await paint(target);
    } catch (error) {
      /* كان الفشل يترك «جارٍ التحميل…» إلى الأبد: لا قائمة ولا رسالة. */
      refs.list.innerHTML =
        `<p class="lib-empty">تعذّر تحميل المحتويات.</p>` +
        `<p class="lib-state">${escapeHtml(messageOf(error))}</p>`;
      refs.count.textContent = "";
    }
  }

  /** @param {string} message */
  function messageOf(error) {
    const text = error && error.message ? String(error.message) : "";
    if (/تعذّر تحميل/.test(text)) return text;
    return "تحقّق من الاتصال ثم أعد المحاولة.";
  }

  async function paint() {
    let rows;
    let total;
    if (term) {
      /* البحث داخل الصفحة فلترة على العناوين والملخّصات، ولا يُحمَّل
         النص الكامل. ستّ شاشات يكفي أن يجد المعنى موضعه. */
      const seen = [];
      for (let p = 1; p <= 6; p += 1) {
        const chunk = await browse(type, { page: p, perPage: PAGE_SIZE, sort });
        seen.push(...chunk.items);
        if (!chunk.hasMore) break;
      }
      /* التطبيع لا المطابقة الحرفية: «زكاه» كانت لا تجد «الزكاة»،
         و«القران» لا تجد «القرآن» لاختلاف التاء المربوطة. */
      const needle = normalizeAr(term);
      const hits = needle
        ? seen.filter((row) => normalizeAr(`${row.ti} ${row.su}`).includes(needle))
        : [];
      total = hits.length;
      const start = (page - 1) * PAGE_SIZE;
      rows = hits.slice(start, start + PAGE_SIZE);
    } else if (category) {
      const chunk = await browseCategory(type, category, { page, perPage: PAGE_SIZE, sort });
      rows = chunk.items;
      total = chunk.total;
    } else {
      const chunk = await browse(type, { page, perPage: PAGE_SIZE, sort });
      rows = chunk.items;
      total = chunk.total;
    }

    refs.list.innerHTML = "";
    if (!rows.length) {
      refs.list.innerHTML = `<p class="lib-empty">لا نتائج هنا.</p>`;
    } else {
      for (const row of rows) refs.list.appendChild(paintCard(row, type));
    }
    refs.count.textContent = `${toArNum(total)} عنصرًا · ${info.title}`;
    paintPager(refs.pager, page, Math.max(1, Math.ceil(total / PAGE_SIZE)), go);
    document.title = `${info.title} · المكتبة الإسلامية`;
  }

  /** بطاقة قابلة للفتح. */
  function paintCard(row, kind) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "lib-card";
    el.innerHTML =
      `<p class="t">${escapeHtml(row.ti)}</p>` +
      (row.su ? `<p class="s">${escapeHtml(row.su)}</p>` : "") +
      `<span class="m">` +
      (row.a ? `<span class="lib-badge">${escapeHtml(row.a)}</span>` : "") +
      (row.d ? `<span class="lib-badge">${escapeHtml(row.d)}</span>` : "") +
      (row.r ? `<span class="lib-badge">${toArNum(row.r)} دقائق</span>` : "") +
      `</span>`;
    el.addEventListener("click", () => {
      location.href = `reader.html?type=${encodeURIComponent(kind)}&id=${encodeURIComponent(row.id)}`;
    });
    return el;
  }

  let timer = 0;
  refs.search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      term = refs.search.value.trim();
      page = 1;
      go();
    }, 260);
  });

  await go();
}