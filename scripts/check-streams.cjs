"use strict";

/**
 * فحص روابط البث في 32-radio-hub.html.
 * المحطات الميتة تظهر كأزرار صامتة لا تُصدر أي خطأ، لذا نتحقق منها شبكيًا.
 * التشغيل:  node scripts/check-streams.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "32-radio-hub.html");
const html = fs.readFileSync(FILE, "utf8");

const streams = [...html.matchAll(/\["([^"]+)","(https?:\/\/[^"]+)"\]/g)].map((m) => ({
  name: m[1],
  url: m[2],
}));

if (!streams.length) {
  console.log("✔ لا توجد روابط بث");
  process.exit(0);
}

const http = require("http");
const https = require("https");
const { URL } = require("url");

/** يقرأ ترويسات البث فقط ثم يغلق الاتصال، بلا تنزيل البث كاملًا. */
function probe(url, redirects = 0) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(url);
    } catch {
      return resolve({ code: "ERR", type: "invalid-url" });
    }
    const lib = u.protocol === "https:" ? https : http;
    // بعض شبكات البث (مثل zeno) ترد 401 على الطلبات المبسّطة،
    // فنحاكي ترويسات المتصفح كي لا نُسقط محطة سليمة.
    const req = lib.get(
      url,
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          accept: "audio/webm,audio/ogg,audio/*;q=0.9,*/*;q=0.8",
          "accept-language": "ar,en;q=0.8",
          "accept-encoding": "identity",
        },
        timeout: 15000,
      },
      (res) => {
        const loc = res.headers.location;
        if (loc && res.statusCode >= 300 && res.statusCode < 400 && redirects < 4) {
          res.resume();
          return resolve(probe(new URL(loc, url).href, redirects + 1));
        }
        const out = {
          code: res.statusCode,
          type: res.headers["content-type"] || "",
        };
        res.destroy();
        resolve(out);
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => resolve({ code: "ERR", type: e.code || e.message }));
  });
}

async function main(){
  const DEAD = [];
  let ok = 0;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let first = true;
  for (const s of streams) {
    // خادم البث يحدّ المعدّل فيرد 500 عند تتابع الطلبات
    if (!first) await sleep(900);
    first = false;
    let r = await probe(s.url, 3);
    if (r.code === 500 || r.code === "ERR") {
      await sleep(1600);
      r = await probe(s.url, 3);
    }
    const good = r.code === 200 && /audio|octet-stream|mpeg/i.test(r.type);
    console.log(`  ${good ? "✔" : "✘"} ${r.code} ${String(r.type).padEnd(24)} ${s.name}`);
    if (good) ok++;
    else DEAD.push(`${s.name} — ${s.url}`);
  }

  console.log(`\n${ok}/${streams.length} محطة تعمل`);
  if (DEAD.length) {
    console.log("\n✘ محطات ميتة يجب حذفها أو تحديثها:");
    DEAD.forEach((d) => console.log("   " + d));
    process.exit(1);
  }
  console.log("✔ كل المحطات تعمل");
}

main();
