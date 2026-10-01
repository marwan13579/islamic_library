/**
 * بانيات HTML لأقسام الموقع — كل ناتج نصّي يمرّ عبر `escapeHtml`.
 * @module site/render
 */

import { escapeHtml, richText, highlight, toArNum } from "../lib/text.js";
import { renderBlocks } from "../components/blocks.js";

/**
 * @param {string} icon اسم الرمز في السبرايت
 * @param {string} label نص بديل لقارئات الشاشة
 */
export function icon(icon, label) {
  return `<svg class="icon" aria-hidden="true"><use href="#${escapeHtml(icon)}"/></svg>${label ? `<span class="sr-only">${escapeHtml(label)}</span>` : ""}`;
}

/**
 * @param {{ icon: string, title: string, sub?: string }} head
 * @param {string} body
 */
export function sectionHead({ icon: name, title, sub }, body) {
  return `<header class="section-head">
    <span class="icon-box">${icon(name)}</span>
    <div><h2>${escapeHtml(title)}</h2>${sub ? `<p>${escapeHtml(sub)}</p>` : ""}</div>
  </header>${body}`;
}

const cardOpen = (role, id) =>
  `<button type="button" class="card" data-open="${escapeHtml(role)}" data-id="${escapeHtml(id)}">`;
const cardClose = "</button>";

/* ------------------------- scholars / prophets ------------------------- */

/** @param {import("../data/scholars.js").Scholar[]} items @param {string} query */
export function scholarsGrid(items, query = "") {
  return `<div class="cards-grid">${items
    .map(
      (item, index) => `${cardOpen("scholar", String(index))}
      <div class="card-top"><span class="avatar">${escapeHtml(item.initial)}</span>
        <div><h3>${highlight(item.name, query)}</h3>
        <span class="meta">${escapeHtml(item.era)} · ${escapeHtml(item.tag)}</span></div></div>
      <p>${highlight(item.bio, query)}</p>${cardClose}`,
    )
    .join("")}</div>`;
}

/** @param {import("../data/prophets.js").Prophet[]} items @param {string} query */
export function prophetsGrid(items, query = "") {
  return `<div class="cards-grid">${items
    .map(
      (item, index) => `${cardOpen("prophet", String(index))}
      <div class="card-top"><span class="emoji">${escapeHtml(item.emoji)}</span>
        <div><h3>${highlight(item.title, query)}</h3></div></div>
      <p>${highlight(item.desc, query)}</p>${cardClose}`,
    )
    .join("")}</div>`;
}

/* ------------------------------ sayings ------------------------------ */

/** @param {import("../data/sayings.js").Saying[]} items */
export function sayingsGrid(items) {
  return `<div class="cards-grid">${items
    .map(
      (item, index) => `<div class="card" data-open="saying" data-id="${index}" role="button" tabindex="0">
      <p>«${escapeHtml(item.txt)}»</p>
      <span class="meta">— ${escapeHtml(item.author)} · ${escapeHtml(item.src)}</span>
    </div>`,
    )
    .join("")}</div>`;
}

/* ------------------------------ seerah ------------------------------ */

/** @param {import("../data/seerah.js").SeerahStop[]} items */
export function seerahTimeline(items) {
  return `<ul class="timeline">${items
    .map(
      (item, index) => `<li data-open="seerah" data-id="${index}" role="button" tabindex="0">
      <span class="year">${escapeHtml(item.year)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.desc)}</p></li>`,
    )
    .join("")}</ul>`;
}

/* ------------------------------ lessons ------------------------------ */

/** @param {import("../data/lessons.js").Lesson[]} lessons @param {string} [activeCat] */
export function lessonsGrid(lessons, activeCat = "") {
  const filtered = activeCat ? lessons.filter((item) => item.catKey === activeCat) : lessons;
  if (filtered.length === 0) return `<p class="empty">لا توجد دروس في هذا التصنيف.</p>`;
  return `<div class="cards-grid">${filtered
    .map((lesson) => {
      const label = /** @type {Record<string, string>} */ ({
        fard: "فرض",
        sunnah: "سنّة",
        mubah: "مباح",
      })[lesson.type] ?? lesson.type;
      return `${cardOpen("lesson", lesson.id)}
      <div class="card-top"><span class="icon-box">${icon(lesson.icon)}</span>
        <div><h3>${escapeHtml(lesson.title)}</h3>
        <span class="meta"><span class="badge">${escapeHtml(lesson.cat)}</span>
        <span class="badge type-${escapeHtml(lesson.type)}">${label}</span></span></div></div>
      <p>${escapeHtml(lesson.desc)}</p>
      <span class="meta">📖 ${toArNum(lesson.body.length)} قسمًا · 🎯 ${toArNum(lesson.quiz.length)} سؤالًا</span>
      ${cardClose}`;
    })
    .join("")}</div>`;
}

/** @param {import("../data/manhaj-lessons.js").ManhajLesson[]} lessons */
export function manhajGrid(lessons, activeMcat = "") {
  const filtered = activeMcat ? lessons.filter((item) => item.mcat === activeMcat) : lessons;
  return `<div class="cards-grid">${filtered
    .map(
      (lesson) => `${cardOpen("manhaj", lesson.id)}
      <div class="card-top"><span class="icon-box">${icon(lesson.icon)}</span>
        <div><h3>${escapeHtml(lesson.title)}</h3>
        <span class="meta"><span class="badge">${escapeHtml(lesson.cat)}</span></span></div></div>
      <p>${escapeHtml(lesson.desc)}</p>${cardClose}`,
    )
    .join("")}</div>`;
}

/** يبني جسم نافذة الدرس. */
export function lessonModal(item) {
  const faq = (item.faq ?? []).length
    ? `<div class="accordion">${item.faq
      .map((entry) => `<details><summary>${escapeHtml(entry.q)}</summary><p>${richText(entry.a)}</p></details>`)
      .join("")}</div>`
    : "";
  const sources = (item.sources ?? []).length
    ? `<div class="sources-box"><h3>المصادر</h3><ul>${item.sources
      .map((source) => `<li>${escapeHtml(source)}</li>`)
      .join("")}</ul></div>`
    : "";
  return `${renderBlocks(item.body)}${sources}${faq}`;
}

/* ------------------------------ names ------------------------------ */

/** @param {import("../data/names99.js").NameOfGod[]} items @param {string} query */
export function namesGrid(items, query = "") {
  if (items.length === 0) return `<p class="empty">لا توجد نتائج مطابقة.</p>`;
  return `<div class="cards-grid">${items
    .map(
      (item, index) => `<div class="card" data-open="name" data-id="${index}" role="button" tabindex="0">
      <h3>${highlight(item.n, query)}</h3><p>${highlight(item.m, query)}</p></div>`,
    )
    .join("")}</div>`;
}

/* ------------------------------ duas ------------------------------ */

/** @param {Record<string, import("../types.js").DuaCategory>} duas @param {string} active */
export function duasList(duas, active = "") {
  const keys = Object.keys(duas).filter((key) => !active || key === active);
  return keys
    .map(
      (key) => `<h3>${escapeHtml(duas[key].title)}</h3>
      <div class="cards-grid">${duas[key].items
        .map(
          (item, index) => `<div class="card">
          <p>${escapeHtml(item.txt)}</p><span class="meta">${escapeHtml(item.src)}</span>
          <button type="button" class="btn ghost" data-role="copy-dua" data-copy-dua="${escapeHtml(key)}-${index}">📋 نسخ</button>
        </div>`,
        )
        .join("")}</div>`,
    )
    .join("");
}

/* ------------------------------ adhkar ------------------------------ */

/** @param {Record<string, { title: string, items: { txt: string, src: string }[] }>} adhkar */
export function adhkarList(adhkar) {
  return Object.entries(adhkar)
    .map(
      ([key, group]) => `<h3>${escapeHtml(group.title)}</h3>
      <div class="cards-grid">${group.items
        .map(
          (item) => `<div class="card"><p>${escapeHtml(item.txt)}</p>
          <span class="meta">${escapeHtml(item.src)}</span></div>`,
        )
        .join("")}</div>`,
    )
    .join("");
}

/* ------------------------------ kids ------------------------------ */

/** @param {import("../data/kids.js").KidLesson[]} items */
export function kidsGrid(items) {
  return `<div class="cards-grid">${items
    .map(
      (item, index) => `${cardOpen("kid", String(index))}
      <div class="card-top"><span class="emoji">${escapeHtml(item.emoji)}</span>
        <div><h3>${escapeHtml(item.title)}</h3><span class="meta">${escapeHtml(item.age)}</span></div></div>
      <p>${escapeHtml(item.desc)}</p>${cardClose}`,
    )
    .join("")}</div>`;
}

/* ------------------------------ qa ------------------------------ */

/** @param {import("../data/qa.js").QaItem[]} items */
export function qaGrid(items) {
  return `<div class="accordion">${items
    .map(
      (item) => `<details><summary>${escapeHtml(item.q)}</summary><p>${richText(item.a)}</p></details>`,
    )
    .join("")}</div>`;
}

/* ------------------------------ misc ------------------------------ */

/** @param {string} ayah @param {string} ref */
export function ayahCard(ayah, ref) {
  return `<div class="ayah-card">${escapeHtml(ayah)}<span class="ref">${escapeHtml(ref)}</span></div>`;
}

/** @param {Array<{ date: string, title: string }>} events @param {boolean} isToday */
export function hijriEventsList(events, isToday) {
  return `<div class="cards-grid">${events
    .map(
      (event) => `<div class="card ${isToday(event.date) ? "today" : ""}">
      <span class="badge">${escapeHtml(event.date)}</span><h3>${escapeHtml(event.title)}</h3></div>`,
    )
    .join("")}</div>`;
}