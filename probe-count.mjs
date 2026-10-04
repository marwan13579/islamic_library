import { chromium } from "playwright-core";
import fs from "node:fs"; import path from "node:path"; import http from "node:http";
const ROOT = process.cwd();
const MIME = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".svg":"image/svg+xml",".woff2":"font/woff2",".webmanifest":"application/manifest+json",".ico":"image/x-icon" };
const server = http.createServer((req,res)=>{
  let f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f,"index.html");
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) return void res.writeHead(404).end("404");
  res.writeHead(200,{"content-type":MIME[path.extname(f)] ?? "application/octet-stream"});
  fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args:["--no-sandbox"] });
const PAGES = fs.readdirSync(ROOT).filter(f=>f.endsWith(".html") && f!=="offline.html").sort();
let total = 0; const per = [];
for (const page of PAGES) {
  const ctx = await browser.newContext(); const tab = await ctx.newPage();
  await tab.goto(`${base}/${page}`, { waitUntil:"load", timeout:20000 });
  await tab.waitForTimeout(650);
  const n = await tab.evaluate(()=>[...document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a[href^="#"]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&!el.disabled&&!el.hidden&&el.offsetParent!==null;}).length);
  total += n; per.push(`${page}:${n}`);
  await ctx.close();
}
console.log(per.join(" "));
console.log("TOTAL clickable across pages =", total);
await browser.close(); server.close();
