/**
 * External Sources Manager — إدارة وفحص المصادر الخارجية.
 *
 * يعتمد على ملف `external-sources.json` للقائمة المركزية.
 * لا يفهرس أي مصدد بدون إذن صريح في الإعدادات.
 * يحترم robots.txt و rate limits.
 *
 * في الإصدار الحالي (static site):
 * - المصادر مطفأة افتراضياً (enabled: false)
 * - الفهرسة تُجرى في build time فقط عبر Node.js script
 * - في المتصفح: يقرأ الفهرس المحفوظ فقط ولا يطلب خارج النطاق
 *
 * @module lib/external-sources
 */

/* =========================================================
 * CONFIG LOADING
 * ========================================================= */

const DEFAULT_CONFIG_URL = "./external-sources.json";

let cachedConfig = null;
let externalIndexCache = null;

export async function loadExternalConfig(configUrl) {
  const url = configUrl || DEFAULT_CONFIG_URL;
  if (cachedConfig && cachedConfig._url === url) return cachedConfig;

  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    cachedConfig = { ...data, _url: url };
    return cachedConfig;
  } catch (e) {
    return { version: 0, sources: [] };
  }
}

export function getCachedConfig() {
  return cachedConfig;
}

/* =========================================================
 * SOURCE OPERATIONS
 * ========================================================= */

/**
 * يعيد قائمة المصادر المفعلة فقط.
 */
export async function getActiveSources(configUrl) {
  const config = await loadExternalConfig(configUrl);
  if (!config.sources || !Array.isArray(config.sources)) return [];
  return config.sources.filter((s) => s.enabled);
}

/**
 * يعيد مصدراً واحداً بالمعرف.
 */
export async function getSourceById(sourceId, configUrl) {
  const config = await loadExternalConfig(configUrl);
  return config.sources.find((s) => s.id === sourceId) || null;
}

/**
 * يتحقق إذا كان النطاق مسموحاً بهذا المصدر.
 */
export function isDomainAllowed(source, url) {
  if (!source.allowedDomains || !source.allowedDomains.length) return true;
  try {
    const hostname = new URL(url).hostname;
    return source.allowedDomains.some((d) => hostname === d || hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

/**
 * يتحقق إذا كان المسار مسموحاً بهذا المصدر.
 */
export function isPathAllowed(source, url) {
  if (!source.allowedPaths || !source.allowedPaths.length) return true;
  try {
    const pathname = new URL(url).pathname;
    return source.allowedPaths.some((p) => pathname === p || pathname.startsWith(p));
  } catch {
    return false;
  }
}

/**
 * يتحقق من كل شروط السماح.
 */
export function isSourceAllowed(source, url) {
  return isDomainAllowed(source, url) && isPathAllowed(source, url);
}

/**
 * يحسب التأخير المطلوب بين الطلبات لهذا المصدر.
 */
export function getRateLimit(source) {
  return Math.max(500, source.rateLimitMs || 1000);
}

/* =========================================================
 * EXTERNAL INDEX LOADING (pre-fetched at build time)
 * ========================================================= */

/**
 * يحمل الفهرس الخارجي من ملف محلي.
 * يُفترض أن الفهرس بُني في build time ولا يحوي طلبات خارجية.
 */
export async function loadExternalIndex(indexUrl) {
  if (externalIndexCache) return externalIndexCache;

  try {
    const resp = await fetch(indexUrl || "./external-index.json", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    externalIndexCache = data;
    return data;
  } catch {
    return { docs: [], sources: [], builtAt: null };
  }
}

export function getExternalIndexCache() {
  return externalIndexCache;
}

export function clearExternalIndexCache() {
  externalIndexCache = null;
}

/**
 * يبحث داخل الفهرس الخارجي.
 */
export function searchExternalIndex(query, normalizedQuery, options = {}) {
  if (!externalIndexCache || !externalIndexCache.docs) return [];

  const q = normalizedQuery || query.toLowerCase();
  if (!q) return [];

  const limit = options.limit || 20;
  const scored = [];

  for (const doc of externalIndexCache.docs) {
    const titleScore = scoreText(doc.title || "", q);
    const contentScore = scoreText(doc.content || "", q) * 0.6;
    const keywordScore = (doc.keywords || []).reduce((sum, kw) => sum + scoreText(kw, q) * 0.3, 0);

    const total = titleScore + contentScore + keywordScore;
    if (total > 0) {
      scored.push({
        id: doc.id,
        title: doc.title,
        summary: doc.content ? doc.content.slice(0, 300) : "",
        route: doc.url,
        sourceId: doc.sourceId,
        score: total,
        matchType: titleScore > contentScore ? "title" : "content",
        type: doc.type || "article",
        category: doc.category || "مصادر خارجية",
        externalSource: true,
        sourceName: doc.sourceName,
        sourceDomain: doc.sourceDomain,
        fetchedAt: doc.fetchedAt,
        canonicalUrl: doc.canonicalUrl || doc.url,
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

function scoreText(text, query) {
  const nt = normalizeAr(text || "");
  const nq = normalizeAr(query || "");
  if (!nt || !nq) return 0;
  if (nt === nq) return 10;
  if (nt.includes(nq)) return 5;

  const terms = nq.split(" ").filter((w) => w.length >= 3);
  let hits = 0;
  for (const t of terms) {
    if (nt.includes(t)) hits += 1;
  }
  return hits * 0.5;
}

/**
 * يعيد إحصائيات الفهرس الخارجي.
 */
export function getExternalIndexStats() {
  if (!externalIndexCache) return null;
  return {
    totalDocs: externalIndexCache.docs?.length || 0,
    sources: externalIndexCache.sources?.length || 0,
    builtAt: externalIndexCache.builtAt || null,
    lastIndexed: externalIndexCache.lastIndexed || null,
  };
}
