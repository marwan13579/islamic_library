import fs from "node:fs";
import path from "node:path";

const exts = [".html", ".js", ".mjs", ".cjs", ".json", ".md"];
const urlRegex = /https?:\/\/[^\s"'`<>\]\)]+/g;
const domainMap = new Map();

function scan(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith(".") || f === "node_modules" || f === "dist") continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      scan(p);
    } else if (exts.some((ext) => f.endsWith(ext))) {
      try {
        const content = fs.readFileSync(p, "utf8");
        const matches = content.match(urlRegex);
        if (matches) {
          for (const u of matches) {
            try {
              const cleaned = u.replace(/[,\.;:\)]+$/, "");
              const parsed = new URL(cleaned);
              if (parsed.protocol === "http:" || parsed.protocol === "https:") {
                const host = parsed.hostname;
                if (!domainMap.has(host)) domainMap.set(host, []);
                domainMap.get(host).push({ url: cleaned, file: p });
              }
            } catch {}
          }
        }
      } catch {}
    }
  }
}

scan(".");
console.log("Total unique domains found:", domainMap.size);

const sorted = [...domainMap.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [host, list] of sorted.slice(0, 40)) {
  console.log(`- ${host} (${list.length} occurrences) e.g. ${list[0].url} in ${list[0].file}`);
}
