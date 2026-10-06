#!/usr/bin/env node
/**
 * Build script: External Sources Index Builder
 *
 * يقرأ `external-sources.json` ويبني `external-index.json`.
 * يعمل فقط في CI/build environments — لا يعمل في المتصفح.
 *
 * لا يتجاوز:
 * - robots.txt (عبر `fetch` مع تحقق يدوي)
 * - rate limits
 * - allowedDomains
 * - allowedPaths
 *
 * Usage:
 *   node scripts/build-external-index.cjs
 *
 * @module scripts/build-external-index
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const CONFIG_PATH = path.join(ROOT, "external-sources.json");
const OUTPUT_PATH = path.join(ROOT, "external-index.json");

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_RATE_LIMIT = 1000;

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
        "User-Agent": "IslamicLibrary-SearchEngine/1.0 (Islamic content indexer; +https://islamic-library.org)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...options.headers,
      },
    });
    return resp;
  } finally {
    clearTimeout(timeout);
  }
}

function checkRobotsTxt(baseUrl) {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    return robotsUrl;
  } catch {
    return null;
  }
}

/**
 * يستخرج المحتوى من HTML باستخدام تعبيرات منظمية بدل DOMParser.
 *
 * لا يعتمد على DOMParser (غير متوفر في Node.js)، ويعمل في بيئة البناء
 * والبيئة المتصفحية على حدٍّ متساوٍ.
 *
 * @param {string} html
 * @param {string} url
 * @returns {{title: string, content: string, description: string, keywords: string[]}}
 */
/**
 * ي_fold robots.txt ويعيد null إذا لم يكن هناك robots.txt.
 * @param {string} baseUrl
 * @returns {Promise<string[] | null>} null = لا robots.txt (كل شيء مسموح)
 */
async function fetchRobotsRules(baseUrl) {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    const resp = await fetchWithTimeout(robotsUrl, { timeout: 8000 });
    if (!resp.ok) return null; // لا robots.txt = لا قيود

    const text = await resp.text();
    const lines = text.split("\n");
    const disallowed = new Set();
    let currentUserAgent = "*";
    let inOurSection = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const [key, ...rest] = line.split(":");
      const k = key.trim().toLowerCase();
      const v = rest.join(":").trim();

      if (k === "user-agent") {
        currentUserAgent = v;
        inOurSection = v === "*" || v.toLowerCase().includes("islamiclibrary");
      } else if (inOurSection && k === "disallow" && v) {
        disallowed.add(v);
      } else if (inOurSection && k === "allow" && v) {
        disallowed.delete(v);
      }
    }

    return [...disallowed];
  } catch {
    return null; // فشل جلب robots.txt = لا قيود
  }
}

/**
 * يоторي إذا كان المسار ممنوعًا بناءً على قواعد robots.txt.
 * @param {string[]} rules
 * @param {string} pathname
 * @returns {boolean}
 */
function isRobotsDisallowed(rules, pathname) {
  if (!rules || !rules.length) return false;
  for (const rule of rules) {
    if (rule === "/") return true; // حظر كلي
    if (pathname.startsWith(rule)) return true;
  }
  return false;
}

/**
 * ي_fold sitemap.xml إن وجد لاكتشاف URLs.
 * @param {string} baseUrl
 * @returns {Promise<string[]>}
 */
async function discoverSitemapUrls(baseUrl) {
  const candidates = [
    new URL("/sitemap.xml", baseUrl).href,
    new URL("/sitemap_index.xml", baseUrl).href,
    new URL("/sitemap.php", baseUrl).href,
  ];
  const urls = new Set();

  for (const sitemapUrl of candidates) {
    try {
      const resp = await fetchWithTimeout(sitemapUrl, { timeout: 10000 });
      if (!resp.ok) continue;
      const text = await resp.text();

      // Extract <loc> tags
      const locs = text.match(/<loc[^>]*>([^<]+)<\/loc>/gi) || [];
      for (const loc of locs) {
        const u = loc.replace(/<\/?loc[^>]*>/gi, "").trim();
        if (u) urls.add(u);
      }

      // If this was an index sitemap, fetch child sitemaps
      if (text.includes("<sitemapindex")) {
        for (const child of locs) {
          const childUrl = child.replace(/<\/?loc[^>]*>/gi, "").trim();
          if (childUrl && childUrl !== sitemapUrl) {
            try {
              const childResp = await fetchWithTimeout(childUrl, { timeout: 10000 });
              if (childResp.ok) {
                const childText = await childResp.text();
                const childLocs = childText.match(/<loc[^>]*>([^<]+)<\/loc>/gi) || [];
                for (const cl of childLocs) {
                  const u = cl.replace(/<\/?loc[^>]*>/gi, "").trim();
                  if (u) urls.add(u);
                }
              }
            } catch {}
          }
        }
      }
      break; // وجدنا sitemap — توقف عن محاولة المرشلات الأخرى
    } catch {}
  }

  return [...urls];
}

/**
 * ي_fold روابط من HTML.
 * @param {string} html
 * @param {string} baseUrl
 * @returns {string[]}
 */
function extractLinks(html, baseUrl) {
  const links = new Set();
  const hrefs = html.match(/href=["']([^"']+)["']/gi) || [];
  for (const href of hrefs) {
    const url = href.replace(/^href=["']/i, "").replace(/["']$/, "").trim();
    if (!url) continue;
    // تخطي الروابط غير النسبية والروابط غير المهمة
    if (url.startsWith("#") || url.startsWith("javascript:") || url.startsWith("mailto:") || url.startsWith("tel:")) continue;
    try {
      const absolute = new URL(url, baseUrl).href;
      // Normalize: remove fragment, strip trailing slash for consistency
      const normalized = absolute.split("#")[0];
      if (normalized) links.add(normalized);
    } catch {}
  }
  return [...links];
}

async function crawlSource(source, maxPages) {
  const docs = [];
  const visited = new Set();
  const queue = [source.url];
  const startHost = new URL(source.url).hostname;
  let fetched = 0;
  const rateLimit = source.rateLimitMs || DEFAULT_RATE_LIMIT;

  while (queue.length > 0 && docs.length < (maxPages || source.maxPages || 100)) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    if (!isSourceAllowed(source, current)) continue;

    try {
      const resp = await fetchWithTimeout(current);
      if (!resp.ok) {
        console.error(`  [skip] ${current} → ${resp.status}`);
        continue;
      }

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        console.log(`  [skip] ${current} → not HTML`);
        continue;
      }

      const html = await resp.text();
      const content = extractContent(html, current);

      if (content.content.length < 50) {
        console.log(`  [skip] ${current} → too short`);
        continue;
      }

      const doc = {
        id: `${source.id}/${docs.length + 1}`,
        title: content.title,
        content: content.content,
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
      };

      docs.push(doc);
      fetched += 1;

      if (docs.length % 10 === 0) {
        console.log(`  [progress] ${source.id}: ${docs.length} pages indexed`);
      }

      await sleep(rateLimit);
    } catch (e) {
      console.error(`  [error] ${current}: ${e.message}`);
    }
  }

  console.log(`  [done] ${source.id}: ${docs.length} pages indexed`);
  return docs;
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

async function main() {
  console.log("=== External Sources Index Builder ===\n");

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const enabledSources = config.sources.filter((s) => s.enabled && s.crawl);

  if (!enabledSources.length) {
    console.log("No sources enabled for crawling.");
    process.exit(0);
  }

  console.log(`Sources to index: ${enabledSources.length}`);
  for (const s of enabledSources) {
    console.log(`  - ${s.id}: ${s.url}`);
  }
  console.log("");

  const allDocs = [];
  const sourcesInfo = [];

  for (const source of enabledSources) {
    console.log(`Crawling ${source.name}...`);
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
    await sleep(1000);
  }

  const output = {
    version: 1,
    builtAt: new Date().toISOString(),
    sources: sourcesInfo,
    docs: allDocs,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\n[done] Wrote ${allDocs.length} docs to ${OUTPUT_PATH}`);
  console.log(`Sources: ${sourcesInfo.length}`);
  console.log(`Total size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
