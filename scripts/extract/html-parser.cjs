"use strict";

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const IMPLICIT_CLOSERS = {
  li: new Set(["li"]),
  p: new Set([
    "p", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
    "blockquote", "table", "hr", "pre",
  ]),
  dt: new Set(["dt", "dd"]),
  dd: new Set(["dt", "dd"]),
  option: new Set(["option"]),
};

function parseAttributes(source) {
  const attributes = {};
  const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attributes[name] = value;
  }
  return attributes;
}

/**
 * Parses a small, well-formed HTML fragment into a plain node tree.
 * Supported: elements, attributes, text, comments, void elements and the
 * implicit closing rules needed by the generated lesson markup.
 */
function parseFragment(html) {
  const root = { type: "root", children: [] };
  const stack = [root];
  const tagPattern = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<!doctype[^>]*>|<\/([a-zA-Z][a-zA-Z0-9:-]*)\s*>|<([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let cursor = 0;
  let match;

  const top = () => stack[stack.length - 1];
  const push = (node) => top().children.push(node);

  while ((match = tagPattern.exec(html))) {
    const text = html.slice(cursor, match.index);
    if (text) push({ type: "text", value: text });
    cursor = match.index + match[0].length;

    if (match[0].startsWith("<!") || match[0].startsWith("</")) {
      if (match[1]) {
        const closing = match[1].toLowerCase();
        const index = stack.findLastIndex((node) => node.tag === closing);
        if (index > 0) stack.length = index;
      }
      continue;
    }
    const tag = match[2].toLowerCase();
    const attributes = parseAttributes(match[3] ?? "");

    const closers = IMPLICIT_CLOSERS[tag];
    if (closers) {
      while (stack.length > 1 && closers.has(top().tag)) stack.pop();
    }

    const node = { type: "element", tag, attributes, children: [] };
    push(node);
    if (!VOID_TAGS.has(tag) && !match[3].trim().endsWith("/")) stack.push(node);
  }

  const tail = html.slice(cursor);
  if (tail) push({ type: "text", value: tail });
  return root;
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ");
}

function textOf(node) {
  if (!node) return "";
  if (node.type === "text") return node.value;
  if (node.type === "root") return node.children.map(textOf).join("");
  if (node.type === "element") return node.children.map(textOf).join("");
  return "";
}

/** Returns the node's own text without the text of nested elements. */
function directText(node) {
  return node.children
    .filter((child) => child.type === "text")
    .map((child) => child.value)
    .join("");
}

function classList(node) {
  return (node.attributes?.class ?? "").split(/\s+/).filter(Boolean);
}

function hasClass(node, name) {
  return classList(node).includes(name);
}

function elements(node, tag) {
  const out = [];
  for (const child of node.children ?? []) {
    if (child.type !== "element") continue;
    if (!tag || child.tag === tag) out.push(child);
    out.push(...elements(child, tag));
  }
  return out;
}

module.exports = {
  VOID_TAGS,
  parseFragment,
  collapseWhitespace,
  textOf,
  directText,
  classList,
  hasClass,
  elements,
};