"use strict";

const fs = require("node:fs");
const vm = require("node:vm");

/** Extracts inline <script> bodies from an HTML file. */
function scriptBodies(html) {
  const bodies = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const attributes = match[1] ?? "";
    if (/\bsrc\s*=/.test(attributes)) continue;
    if (/type\s*=\s*["'](?!text\/javascript|application\/javascript|module)[^"']*["']/i.test(attributes)) continue;
    bodies.push(match[2]);
  }
  return bodies;
}

function skipString(source, index) {
  const quote = source[index];
  index += 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === quote) return index + 1;
    index += 1;
  }
  return index;
}

/** Finds the index just past a balanced expression starting at `start`. */
function findExpressionEnd(source, start) {
  let depth = 0;
  let index = start;
  const templateStack = [];
  while (index < source.length) {
    const char = source[index];
    if (char === "/" && source[index + 1] === "/") {
      const end = source.indexOf("\n", index);
      index = end === -1 ? source.length : end + 1;
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (char === "'" || char === '"') {
      index = skipString(source, index);
      continue;
    }
    if (char === "`") {
      index = skipTemplate(source, index);
      continue;
    }
    if (char === "{" || char === "[" || char === "(") {
      depth += 1;
      index += 1;
      continue;
    }
    if (char === "}" || char === "]" || char === ")") {
      depth -= 1;
      index += 1;
      if (depth === 0) {
        let probe = index;
        while (probe < source.length && /\s/.test(source[probe])) probe += 1;
        if (source[probe] === "," || source[probe] === ";") index = probe + 1;
        templateStack.length = 0;
        return index;
      }
      continue;
    }
    index += 1;
  }
  templateStack.length = 0;
  return source.length;
}

function skipTemplate(source, start) {
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (char === "`") return index + 1;
    if (char === "$" && source[index + 1] === "{") {
      index = findExpressionEnd(source, index + 1) + 1;
      continue;
    }
    index += 1;
  }
  return index;
}

/** Collects top-level `const|let|var NAME = <expression>;` declarations. */
function topLevelDeclarations(source) {
  const declarations = new Map();
  const pattern = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm;
  let match;
  while ((match = pattern.exec(source))) {
    const name = match[1];
    const valueStart = match.index + match[0].length;
    const end = findExpressionEnd(source, valueStart);
    declarations.set(name, source.slice(valueStart, end).replace(/[,;\s]+$/, ""));
    pattern.lastIndex = end;
  }
  return declarations;
}

const SANDBOX_GLOBALS = {
  Intl,
  Date,
  Math,
  JSON,
  console: { log() {}, warn() {}, error() {} },
  toAr: (value) => String(value),
  toArNum: (value) => String(value),
  normalize: (value) => String(value),
};

/** Evaluates selected top-level declarations from an HTML file's inline scripts. */
function evaluateDeclarations(htmlPath, names) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const source = scriptBodies(html).join("\n;\n");
  const declarations = topLevelDeclarations(source);
  const missing = names.filter((name) => !declarations.has(name));
  if (missing.length) {
    throw new Error(`تعذّر العثور على: ${missing.join(", ")} في ${htmlPath}`);
  }
  const code = names.map((name) => `const ${name} = ${declarations.get(name)};`).join("\n");
  const context = vm.createContext({ ...SANDBOX_GLOBALS });
  const exported = vm.runInContext(`(() => { ${code}\nreturn { ${names.join(", ")} }; })()`, context, {
    filename: htmlPath,
  });
  return exported;
}

module.exports = { scriptBodies, topLevelDeclarations, evaluateDeclarations };