#!/usr/bin/env node
/**
 * Build script: External Sources Index Builder
 *
 * يقرأ `external-sources.json` ويبني `external-index.json`.
 * يعمل فقط في بيئة Node.js (build time) — لا يعمل في المتصفح.
 *
 * يحترم:
 * - robots.txt
 * - rate limits
 * - allowedDomains
 * - allowedPaths
 * - لا يفهرس الإنترنت بالكامل، يقتصر على المصادر المحددة فقط.
 *
 * Usage:
 *   node scripts/build-external-index.mjs
 *
 * @module scripts/build-external-index
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "external-sources.json");
const OUTPUT_PATH = path.join(ROOT, "external-index.json");

const DEFAULT_TIMEOUT = 12000;
const DEFAULT_RATE_LIMIT = 1500;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || DEFAULT_TIMEOUT);

  try {
    const resp = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "IslamicLibrary-SearchEngine/1.0 (Islamic reference indexer; +https://islamic-library.org)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...options.headers,
      },
    });
    return resp;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * جلب وفحص قواعد robots.txt
 * @param {string} baseUrl
 * @returns {Promise<string[] | null>} null = لا قيود معلنة
 */
async function fetchRobotsRules(baseUrl) {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    const resp = await fetchWithTimeout(robotsUrl, { timeout: 6000 });
    if (!resp.ok) return null;

    const text = await resp.text();
    const lines = text.split("\n");
    const disallowed = new Set();
    let inOurSection = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const [key, ...rest] = line.split(":");
      const k = key.trim().toLowerCase();
      const v = rest.join(":").trim();

      if (k === "user-agent") {
        inOurSection = v === "*" || v.toLowerCase().includes("islamiclibrary");
      } else if (inOurSection && k === "disallow" && v) {
        disallowed.add(v);
      } else if (inOurSection && k === "allow" && v) {
        disallowed.delete(v);
      }
    }

    return [...disallowed];
  } catch {
    return null;
  }
}

function isRobotsDisallowed(rules, pathname) {
  if (!rules || !rules.length) return false;
  for (const rule of rules) {
    if (rule === "/") return true;
    if (pathname.startsWith(rule)) return true;
  }
  return false;
}

function extractContent(html, url) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : "";

  const descMatch =
    html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
  let description = descMatch ? descMatch[1].trim() : "";

  const kwMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']*)["']/i);
  let keywords = kwMatch ? kwMatch[1].split(",").map((k) => k.trim()).filter(Boolean) : [];

  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    title = h1Match ? h1Match[1].trim() : url;
  }

  return {
    title,
    content: clean,
    description: description || clean.slice(0, 200),
    keywords,
  };
}

function isSourceAllowed(source, url) {
  if (!source.allowedDomains || !source.allowedDomains.length) return true;
  try {
    const hostname = new URL(url).hostname;
    const domainOk = source.allowedDomains.some((d) => hostname === d || hostname.endsWith("." + d));
    if (!domainOk) return false;

    if (source.allowedPaths && source.allowedPaths.length) {
      const pathname = new URL(url).pathname;
      const pathOk = source.allowedPaths.some((p) => pathname === p || pathname.startsWith(p));
      if (!pathOk) return false;
    }
  } catch {
    return false;
  }
  return true;
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}

/**
 * بناء الوثائق المرجعية الأساسية للمصدر من أقسامه ووصفه
 */
function createCuratedDocs(source) {
  const docs = [];
  const host = new URL(source.url).hostname;

  // 1. Main source entry
  docs.push({
    id: `${source.id}-main`,
    title: source.name,
    content: `${source.name}. ${source.description}. الرابط: ${source.url}`,
    description: source.description,
    keywords: [source.category, source.name, ...(source.sections || [])],
    url: source.url,
    canonicalUrl: source.url,
    sourceId: source.id,
    sourceName: source.name,
    sourceDomain: host,
    type: source.category || "reference",
    category: source.category || "مصادر خارجية",
    language: source.language || "ar",
    fetchedAt: new Date().toISOString(),
    contentHash: hashString(source.description),
  });

  // 2. Sections entries
  if (Array.isArray(source.sections)) {
    source.sections.forEach((sec, idx) => {
      docs.push({
        id: `${source.id}-sec-${idx + 1}`,
        title: `${source.name} — ${sec}`,
        content: `${sec}. من أقسام موقع ${source.name}: ${source.description}`,
        description: sec,
        keywords: [source.name, sec, source.category],
        url: source.url,
        canonicalUrl: source.url,
        sourceId: source.id,
        sourceName: source.name,
        sourceDomain: host,
        type: source.category || "reference",
        category: source.category || "مصادر خارجية",
        language: source.language || "ar",
        fetchedAt: new Date().toISOString(),
        contentHash: hashString(sec),
      });
    });
  }

  return docs;
}

async function crawlSource(source, maxPages) {
  const docs = [...createCuratedDocs(source)];
  if (!source.crawl) return docs;

  const visited = new Set();
  const queue = [source.url];
  const startHost = new URL(source.url).hostname;
  const rateLimit = source.rateLimitMs || DEFAULT_RATE_LIMIT;

  let robotsRules = null;
  if (source.respectRobots !== false) {
    robotsRules = await fetchRobotsRules(source.url);
  }

  while (queue.length > 0 && docs.length < (maxPages || source.maxPages || 100)) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    if (!isSourceAllowed(source, current)) continue;

    try {
      const parsed = new URL(current);
      if (robotsRules && isRobotsDisallowed(robotsRules, parsed.pathname)) {
        console.log(`  [skip robots] ${current}`);
        continue;
      }

      const resp = await fetchWithTimeout(current);
      if (!resp.ok) continue;

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) continue;

      const html = await resp.text();
      const content = extractContent(html, current);

      if (content.content.length < 50) continue;

      docs.push({
        id: `${source.id}-${docs.length + 1}`,
        title: content.title,
        content: content.content.slice(0, 4000),
        description: content.description,
        keywords: content.keywords,
        url: current,
        canonicalUrl: current,
        sourceId: source.id,
        sourceName: source.name,
        sourceDomain: startHost,
        type: source.category || "article",
        category: source.category || "مصادر خارجية",
        language: source.language || "ar",
        fetchedAt: new Date().toISOString(),
        contentHash: hashString(content.content.slice(0, 500)),
      });

      await sleep(rateLimit);
    } catch (e) {
      console.error(`  [error] ${current}: ${e.message}`);
    }
  }

  return docs;
}

async function main() {
  console.log("=== External Sources Index Builder ===\n");

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const enabledSources = (config.sources || []).filter((s) => s.enabled);

  console.log(`Total active external sources: ${enabledSources.length}\n`);

  const allDocs = [];
  const sourcesInfo = [];

  for (const source of enabledSources) {
    console.log(`Processing: ${source.name} (${source.url})`);
    const docs = await crawlSource(source, source.maxPages);
    allDocs.push(...docs);
    sourcesInfo.push({
      id: source.id,
      name: source.name,
      url: source.url,
      indexedPages: docs.length,
      lastCrawl: new Date().toISOString(),
      status: "ok",
    });
  }

  const output = {
    version: 1,
    builtAt: new Date().toISOString(),
    sources: sourcesInfo,
    docs: allDocs,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.log(`\n[Success] Generated ${allDocs.length} external documents in ${OUTPUT_PATH}`);
  console.log(`Sources configured: ${sourcesInfo.length}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
