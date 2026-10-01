"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "dist");
const ROOT_ASSET = /\.(?:html|js|css|svg|ico|pdf)$/i;

fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.mkdirSync(OUTPUT, { recursive: true });

for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.isFile() && (ROOT_ASSET.test(entry.name) || entry.name === "_headers" || entry.name === "manifest.webmanifest")) {
    fs.copyFileSync(path.join(ROOT, entry.name), path.join(OUTPUT, entry.name));
  }
}

for (const directory of ["icons", "src", "vendor"]) {
  fs.cpSync(path.join(ROOT, directory), path.join(OUTPUT, directory), { recursive: true });
}

const sw = fs.readFileSync(path.join(OUTPUT, "sw.js"), "utf8");
const shell = sw.match(/const SHELL = \[([\s\S]*?)\n\];/);
if (!shell) throw new Error("Could not read the service worker shell asset list.");

const missing = [...shell[1].matchAll(/["']([^"']+)["']/g)]
  .map((match) => match[1].replace(/^\.\//, ""))
  .filter((asset) => !fs.existsSync(path.join(OUTPUT, asset)));
if (missing.length) {
  throw new Error(`Deployment output is missing service-worker assets:\n${missing.join("\n")}`);
}

console.log(`Prepared Cloudflare Pages output in dist/ (${missing.length === 0 ? "service-worker assets verified" : "failed"}).`);