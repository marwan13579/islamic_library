/* يقيس زمن صفحة واحدة بوضوح: كم زرًّا وكم استغرق. */
import { chromium } from "playwright-core";
import fs from "node:fs"; import path from "node:path"; import http from "node:http";
const ROOT = process.cwd();
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".png":"image/png", ".svg":"image/svg+xml", ".woff2":"font/woff2", ".webmanifest":"application/manifest+json", ".ico":"image/x-icon" };
const server = http.createServer((req,res)=>{
  let f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) return void res.writeHead(404).end("404");
  res.writeHead(200,{"content-type":MIME[path.extname(f)] ?? "application/octet-stream"});
  fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args:["--no-sandbox"] });
const pages = process.argv.slice(2);
for (const page of pages) {
  const ctx = await browser.newContext(); const tab = await ctx.newPage();
  const t0 = Date.now();
  await tab.goto(`${base}/${page}`, { waitUntil:"load", timeout:20000 });
  await tab.waitForTimeout(650);
  const sel = 'button,[role="button"],input[type="button"],input[type="submit"],a[href^="#"]';
  const count = await tab.evaluate((s)=>[...document.querySelectorAll(s)].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&!el.disabled&&!el.hidden&&el.offsetParent!==null;}).length, sel);
  let timeouts = 0;
  const per = [];
  for (let i=0;i<count;i++){
    const s0 = Date.now();
    try { await tab.locator(sel).nth(i).click({ timeout:2500, force:true, noWaitAfter:true }); }
    catch { timeouts++; }
    per.push(Date.now()-s0);
  }
  console.log(`${page}: ${count} زر · ${((Date.now()-t0)/1000).toFixed(1)}s · timeouts=${timeouts}`);
  await ctx.close();
}
await browser.close(); server.close();
