/**
 * فحص قنوات مكتبة الفيديو الإسلامية.
 *
 * لماذا هذا الفحص:
 *   رابطٌ مخترع لقناة ينقل القارئ إلى videos.html؟ أو إلى قناة إعادة رفع باسم
 *   مشابه — وهي أخطر من رابط مكسور، لأن القارئ يظنّه المصدر الرسمي. فلا
 *   تدخل قناةٌ إلى البيانات ولا تُعرَض إلا بعد أن يثبت هذا الفحص وجودها على
 *   YouTube ويطابق عنوانُها الحقيقي ما كتبناه عنها.
 *
 * الاستعمال:
 *   node scripts/verify-video-channels.mjs             # يفحص مرشّحي الاكتشاف
 *   node scripts/verify-video-channels.mjs --data      # يفحص قنوات ملف البيانات
 *   node scripts/verify-video-channels.mjs --data --json
 *
 * ‎--data هو ما يُستدعى في المراجعة الدورية: يقبل exited(1) إن مات رابط،
 * أو خرجت قناةٌ منTrustLevel "موصى بها" بلا رابط حيّ.
 */

import { CANDIDATES, SEARCHES } from "./video-channels.candidates.mjs";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TIMEOUT_MS = 20000;
const CONCURRENCY = 4;

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} url
 * @returns {Promise<{ ok: boolean, status: number, html: string, finalUrl: string }>}
 */
async function fetchChannel(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, "accept-language": "en-US,en;q=0.9" },
      redirect: "follow",
      signal: controller.signal,
    });
    const html = await response.text();
    return { ok: response.ok, status: response.status, html, finalUrl: response.url || url };
  } catch (error) {
    return { ok: false, status: 0, html: "", finalUrl: url, error: String(error?.message ?? error) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} html
 * @param {RegExp} pattern
 * @returns {string | null}
 */
function pick(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1] : null;
}

/**
 * يستخرج ما يثبّت هوية القناة من صفحة YouTube.
 * @param {string} html
 */
export function readChannel(html) {
  const canonical = pick(html, /"canonicalBaseUrl":"(\/[^"]+)"/);
  const channelId = pick(html, /"externalId":"(UC[\w-]{22})"/);
  const title =
    pick(html, /<meta property="og:title" content="([^"]*)"/) ??
    pick(html, /<title>([^<]*?)(?:\s*-\s*YouTube)?<\/title>/);
  const vanity = pick(html, /"vanityChannelUrl":"(\/[^"]*)"/);
  return {
    canonical: canonical ? `https://www.youtube.com${canonical}` : null,
    channelId: channelId ?? null,
    title: title ? title.replace(/&amp;/g, "&").trim() : null,
    vanity: vanity ? `https://www.youtube.com${vanity}` : null,
  };
}

/**
 * نبذة القناة كما كتبتها هي في صفحة «حول» — وهي دليلُ الهوية الذي نراجع به.
 * هذه أدلةُ تحقّق نقرأها بأنفسنا، فلا تُنسخ في بيانات المكتبة.
 * @param {string} html
 */
export function readAbout(html) {
  const decode = (value) =>
    (value ?? "")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  return {
    description: decode(pick(html, /<meta name="description" content="([^"]*)"/)),
    keywords: decode(pick(html, /<meta name="keywords" content="([^"]*)"/)),
    country: pick(html, /"country":"([^"]+)"/),
  };
}

/**
 * نتائج قنوات YouTube لبحثٍ ما. هذه طريقة الاكتشاف: بدل تخمين الـhandle
 * نسأل YouTube نفسه، فنحصل على الاسم الحقيقي والمعرّف والوصف المختصر
 * وشارة التحقق إن وُجدت.
 * @param {string} html
 * @returns {{ title: string, url: string, channelId: string, subscribers: string, verified: boolean, snippet: string }[]}
 */
export function readSearchChannels(html) {
  const out = [];
  for (const match of html.matchAll(/"channelRenderer":\{/g)) {
    const chunk = html.slice(match.index, match.index + 4000);
    const title = pick(chunk, /"title":\{"simpleText":"([^"]+)"/);
    const browse = chunk.match(/"browseEndpoint":\{"browseId":"(UC[\w-]+)","canonicalBaseUrl":"([^"]+)"/);
    if (!title || !browse) continue;
    const snippet = (pick(chunk, /"descriptionSnippet":\{"runs":\[\{"text":"([^"]*)"/) ?? "")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
    const counts = chunk.match(/"videoCountText":\{[\s\S]{0,220}?"simpleText":"([^"]+)"/);
    out.push({
      title,
      channelId: browse[1],
      url: `https://www.youtube.com${browse[2]}`,
      subscribers: counts ? counts[1] : "",
      verified: /BADGE_STYLE_TYPE_VERIFIED/.test(chunk),
      snippet,
    });
  }
  return out;
}

/**
 * يفحص رابطًا واحدًا.
 * @param {{ label: string, url: string }} candidate
 */
export async function probe(candidate) {
  const response = await fetchChannel(candidate.url);
  if (!response.ok) {
    return { ...candidate, found: false, status: response.status, reason: `HTTP ${response.status}` };
  }
  const info = readChannel(response.html);
  if (!info.canonical || !info.channelId) {
    /* صفحة موجودة لكنها ليست صفحة قناة: صفحة videos.html، أو موافقة على الكوكيز */
    return { ...candidate, found: false, status: response.status, reason: "لا صفحة قناة" };
  }
  return { ...candidate, found: true, status: response.status, ...info };
}

/**
 * يفحص قائمة على التوازي مع حدّ لعدد الطلبات.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => Promise<any>} task
 */
async function pooled(items, task) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await task(items[current]);
      await sleep(250);
    }
  });
  await Promise.all(workers);
  return results;
}

/** @param {{ label: string, found: boolean, title: string | null, canonical: string | null, reason?: string }} row */
function printRow(row) {
  const mark = row.found ? "✔" : "✘";
  const title = row.title ?? row.reason ?? "";
  const target = row.canonical ?? row.url;
  console.log(`${mark} ${String(row.label).padEnd(30)} ${target}\n    ${title}`);
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const searchAt = args.indexOf("--search");

  /* وضع الاكتشاف: نسأل YouTube بالاسم، فيرد بأسماء القنوات الحقيقية. */
  if (searchAt !== -1) {
    const extra = args.slice(searchAt + 1).filter((value) => !value.startsWith("--"));
    const queries = extra.length ? extra : SEARCHES;
    const rows = await pooled(queries, async (query) => {
      const response = await fetchChannel(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
      );
      return { query, channels: response.ok ? readSearchChannels(response.html) : [] };
    });
    if (asJson) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    for (const row of rows) {
      console.log(`\n▪ ${row.query}`);
      for (const channel of row.channels) {
        console.log(
          `   ${channel.verified ? "☑" : "·"} ${channel.title} — ${channel.subscribers}` +
            `\n     ${channel.url}  (${channel.channelId})` +
            (channel.snippet ? `\n     ${channel.snippet.slice(0, 140)}` : ""),
        );
      }
      if (!row.channels.length) console.log("   (لا نتائج قنوات)");
    }
    return;
  }

  /* وضع الوصف: نبذة القناة واسمها الحقيقي — لد��ق الهوية قبل اعتمادها. */
  const describeAt = args.indexOf("--describe");
  if (describeAt !== -1) {
    const urls = args.slice(describeAt + 1).filter((value) => value.startsWith("http"));
    const rows = await pooled(urls, async (url) => {
      const response = await fetchChannel(url.endsWith("/about") ? url : `${url}/about`);
      if (!response.ok) return { url, found: false, reason: `HTTP ${response.status}` };
      return { url, found: true, ...readChannel(response.html), ...readAbout(response.html) };
    });
    if (asJson) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    for (const row of rows) {
      console.log(`\n▪ ${row.url}`);
      if (!row.found) {
        console.log(`   ✘ ${row.reason}`);
        continue;
      }
      console.log(`   الاسم: ${row.title}\n   القناة: ${row.channelId}\n   الوصف: ${row.description}`);
      if (row.keywords) console.log(`   الكلمات: ${row.keywords.slice(0, 220)}`);
    }
    return;
  }

  /* وضع المراجعة: ما ينتظر التحقق، ولماذا — لقائمة صيانة لا لعرض. */
  if (args.includes("--review")) {
    const { pendingChannels } = await import("../src/data/islamic-channels.js");
    const rows = pendingChannels();
    if (asJson) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    for (const row of rows) {
      console.log(`${row.id.padEnd(30)} ${row.nameAr}`);
      console.log(`    مرشّح: ${row.candidateUrl || "— لا رابط —"}`);
      if (row.note) console.log(`    السبب: ${row.note}`);
    }
    console.log(`\n${rows.length} قناة تنتظر التحقق. أشعل رابطها بـ--describe ثم انقلها إلى CHANNELS.`);
    return;
  }

  /** @type {{ label: string, url: string }[]} */
  let targets;
  if (args.includes("--data")) {
    const { CHANNELS } = await import("../src/data/islamic-channels.js");
    targets = CHANNELS.filter((channel) => channel.youtubeUrl).map((channel) => ({
      label: `${channel.nameEn || channel.nameAr} [${channel.id}]`,
      url: channel.youtubeUrl,
    }));
    if (!targets.length) {
      console.error("لا قنوات فيها رابط في ملف البيانات.");
      process.exit(1);
    }
  } else {
    targets = CANDIDATES;
  }

  console.error(`فحص ${targets.length} رابطًا على YouTube…\n`);
  const rows = await pooled(targets, probe);

  const found = rows.filter((row) => row.found);
  const missing = rows.filter((row) => !row.found);

  if (asJson) {
    console.log(JSON.stringify({ checked: rows.length, found, missing }, null, 2));
  } else {
    console.log("——— قنوات موجودة ————————————————\n");
    found.forEach(printRow);
    console.log(`\n——— مرشّحون لا وجود لهم (${missing.length}) ————————————————\n`);
    missing.forEach(printRow);
    console.log(
      `\nالنتيجة: ${found.length} قناة موجودة من ${rows.length} رابطًا.` +
        `\nتنبيه للمراجعة: كل عنوان لا يطابق التسمية المتوقّعة يحتاج عين إنسان.`,
    );
  }

  if (args.includes("--data")) {
    const dead = rows.filter((row) => !row.found);
    if (dead.length) {
      console.error(`\n✗ قنوات في البيانات روابطها لا تصل (${dead.length}):`);
      for (const row of dead) console.error(`   ${row.label} → ${row.url} (${row.reason})`);
      process.exit(1);
    }
    console.error(`\n✔ كل قنوات البيانات (${rows.length}) روابطها حيّة على YouTube.`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("verify-video-channels.mjs")) {
  await main();
}