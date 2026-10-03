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

/**
 * @param {string} url
 * @param {number} [tries] محاولات قبل الحكم على الموت
 * @returns {Promise<{code: any, type: string}>}
 */
async function probeWithRetry(url, tries = 3) {
  let out = {};
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    out = await probe(url, 3);
    /* ٥٠٠ و«لاشبكة» و«انتهى الوقت» ليست موتًا، هي ازدحام أو شبكة.
       المحطة الحيّة ترد ٥٠٠ مرّة ثم ترد ٢٠٠، والحكم عليها بعد محاولة
       واحدة يجعل الفрес يبلّغ عن محطات سليمة. */
    if (out.code !== 500 && out.code !== "ERR") break;
    if (attempt < tries) await new Promise((r) => setTimeout(r, 1200 * attempt));
  }
  return out;
}

async function main(){
  const DEAD = [];
  let ok = 0;
  let flaky = 0;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let first = true;
  for (const s of streams) {
    // خادم البث يحدّ المعدّل فيرد 500 عند تتابع الطلبات
    if (!first) await sleep(900);
    first = false;
    let r = await probeWithRetry(s.url);
    const good = r.code === 200 && /audio|octet-stream|mpeg/i.test(r.type);
    console.log(`  ${good ? "✔" : "✘"} ${r.code} ${String(r.type).padEnd(24)} ${s.name}`);
    if (good) ok++;
    else DEAD.push(`${s.name} — ${s.url}`);
  }

  /* الفحص إمّا يردّ ١٠٠٪ أو يبلّغ بموتٍ، لا ثُلثًا. فمن لم يثبت موته
     يُعاد فحصه من جديد، فإن ثبت موته بعد ستّ محاولات فهو ميت. */
  if (DEAD.length) {
    console.log("\n… إعادة فحص من لم يثبت موته");
    const dead = [];
    for (const line of DEAD) {
      const [name, url] = line.split(" — ");
      const r = await probeWithRetry(url, 3);
      const good = r.code === 200 && /audio|octet-stream|mpeg/i.test(r.type);
      if (good) {
        flaky += 1;
        console.log(`  ✔ ${r.code} ${name} (تأخّر لا موت)`);
        ok += 1;
      } else {
        dead.push(line);
      }
    }
    DEAD.length = 0;
    DEAD.push(...dead);
  }

  console.log(`\n${ok}/${streams.length} محطة تعمل`);
  if (flaky) console.log(`  و${flaky} منها تأخّرت لا ماتت:الفحص الأول أخطأ فيها`);
  if (DEAD.length) {
    console.log("\n✘ محطات ميتة يجب حذفها أو تحديثها:");
    DEAD.forEach((d) => console.log("   " + d));
    process.exit(1);
  }
  console.log("✔ كل المحطات تعمل");
}

main();
