/**
 * يحوّل كتل المحتوى (JSON) إلى HTML ونص عادي للنسخ والطباعة.
 * @module components/blocks
 */

import { escapeHtml, richText } from "../lib/text.js";

/**
 * @param {import("../types.js").Block[]} blocks
 * @returns {string} HTML آمن (كل النصوص مهروبة).
 */
export function renderBlocks(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks.map(renderBlock).filter(Boolean).join("");
}

/**
 * @param {import("../types.js").Block} block
 * @returns {string}
 */
function renderBlock(block) {
  switch (block.type) {
    case "section":
      return `<section class="lesson-section">
  ${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}
  ${renderBlocks(block.children)}
</section>`;
    case "h3":
      return `<h3>${escapeHtml(block.text)}</h3>`;
    case "p":
      return `<p>${richText(block.text).replace(/\n/g, "<br>")}</p>`;
    case "ul":
      return `<ul>${block.items.map((item) => `<li>${richText(item)}</li>`).join("")}</ul>`;
    case "ol":
      return `<ol>${block.items.map((item) => `<li>${richText(item)}</li>`).join("")}</ol>`;
    case "evidence":
      return `<div class="evidence">
  <div class="ayah">${escapeHtml(block.ayah)}</div>
  ${block.ref ? `<span class="ref">${escapeHtml(block.ref)}</span>` : ""}
</div>`;
    case "hadith":
      return `<div class="hadith">
  <p>${escapeHtml(block.text)}</p>
  ${block.ref ? `<span class="ref">${escapeHtml(block.ref)}</span>` : ""}
</div>`;
    case "quote":
      return `<div class="salaf-quote">
  <div class="txt">${escapeHtml(block.text)}</div>
  ${block.scholar ? `<div class="author">${escapeHtml(block.scholar)}</div>` : ""}
</div>`;
    case "note":
      return `<div class="note-box">${richText(block.text)}</div>`;
    case "warn":
      return `<div class="warn-box">${richText(block.text)}</div>`;
    case "group":
      return renderBlocks(block.children);
    default:
      return "";
  }
}

/**
 * يحوّل الكتل إلى نص عادي (للنسخ وللطباعة).
 * @param {import("../types.js").Block[]} blocks
 * @returns {string}
 */
export function blocksToText(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((block) => {
      const heading = block.title ? `${block.title}\n` : "";
      const body = (block.text ?? block.ayah ?? "").replace(/\*\*?|\*/g, "");
      const items = block.items ? block.items.map((item) => `• ${item}`).join("\n") : "";
      const ref = block.ref ? ` [${block.ref}]` : "";
      const scholar = block.scholar ? ` — ${block.scholar}` : "";
      const children = block.children ? blocksToText(block.children) : "";
      return `${heading}${body}${ref}${scholar}${items}${children}`.trim();
    })
    .filter(Boolean)
    .join("\n\n");
}