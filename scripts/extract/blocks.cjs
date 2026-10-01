"use strict";

const {
  parseFragment,
  collapseWhitespace,
  textOf,
  directText,
  hasClass,
  elements,
} = require("./html-parser.cjs");

const REF_CLASS = "ref";

/** Flattens inline markup into text with `**bold**` markers and no raw HTML. */
function inlineText(node) {
  const walk = (current) => {
    if (current.type === "text") return current.value;
    if (current.type === "root") return current.children.map(walk).join("");
    if (current.type !== "element") return "";
    const inner = current.children.map(walk).join("");
    const bold = current.tag === "strong" || current.tag === "b";
    const italic = current.tag === "em" || current.tag === "i";
    const wrapped = bold ? `**${inner}**` : italic ? `_${inner}_` : inner;
    if (current.tag === "br") return "\n";
    return wrapped;
  };
  return collapseWhitespace(walk(node)).trim();
}

function plainText(node) {
  return collapseWhitespace(textOf(node)).trim();
}

function takeRef(node) {
  const refs = elements(node).filter((child) => hasClass(child, REF_CLASS));
  if (refs.length === 0) return "";
  const text = plainText(refs[0]);
  for (const ref of refs) ref.children.length = 0;
  return text;
}

function trimPunctuation(value) {
  return value.replace(/^["'\s]+|["'\s]+$/g, "");
}

function listItems(node) {
  return elements(node, "li")
    .map((item) => inlineText(item))
    .filter((item) => item.length > 0);
}

function convertChildren(node) {
  const blocks = [];
  let buffer = [];

  const flush = () => {
    for (const child of buffer) {
      const block = convertNode(child);
      if (block) blocks.push(block);
    }
    buffer = [];
  };

  for (const child of node.children ?? []) {
    if (child.type === "element" && (child.tag === "div" || child.tag === "section")) {
      flush();
      const block = convertNode(child);
      if (block) blocks.push(block);
      continue;
    }
    if (child.type === "text" && child.value.trim() === "") continue;
    buffer.push(child);
  }
  flush();
  return blocks;
}

function convertNode(node) {
  if (node.type === "text") {
    const text = collapseWhitespace(node.value).trim();
    return text ? { type: "p", text } : null;
  }
  if (node.type !== "element") return null;
  if (node.children.length === 0) return null;

  if (hasClass(node, "lesson-section")) {
    const heading = elements(node, "h3")[0] ?? elements(node, "h4")[0] ?? null;
    const title = heading ? plainText(heading) : "";
    if (heading) heading.children.length = 0;
    return {
      type: "section",
      title,
      children: convertChildren(node),
    };
  }

  if (hasClass(node, "evidence")) {
    const ayah = elements(node).find((child) => hasClass(child, "ayah"));
    const text = ayah ? plainText(ayah) : "";
    return { type: "evidence", ayah: text, ref: takeRef(node) };
  }

  if (hasClass(node, "hadith")) {
    const ref = takeRef(node);
    const text = trimPunctuation(inlineText(node).replace(/\s*\[\s*\]\s*$/, ""));
    return { type: "hadith", text, ref };
  }

  if (hasClass(node, "salaf-quote")) {
    const quote = elements(node).find((child) => hasClass(child, "txt"));
    const author = elements(node).find((child) => hasClass(child, "author"));
    return {
      type: "quote",
      text: trimPunctuation(quote ? plainText(quote) : plainText(node)),
      scholar: author ? plainText(author) : "",
    };
  }

  if (hasClass(node, "note-box")) return { type: "note", text: inlineText(node) };
  if (hasClass(node, "warn-box")) return { type: "warn", text: inlineText(node) };

  switch (node.tag) {
    case "h3":
    case "h4":
      return { type: "h3", text: plainText(node) };
    case "p":
      return { type: "p", text: inlineText(node) };
    case "ul":
    case "ol":
      return { type: node.tag === "ol" ? "ol" : "ul", items: listItems(node) };
    default:
      break;
  }

  const children = convertChildren(node);
  if (children.length === 1) return children[0];
  return children.length ? { type: "group", children } : null;
}

/** Converts a raw lesson/manhaj HTML body into JSON blocks (never HTML). */
function htmlToBlocks(html) {
  if (!html || !html.trim()) return [];
  const tree = parseFragment(html);
  const blocks = convertChildren(tree);
  return blocks.filter(Boolean);
}

module.exports = { htmlToBlocks, inlineText, plainText, directText };