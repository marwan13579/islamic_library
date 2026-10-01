import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright-core";
const ROOT="/home/abokhaled/Documents/إسلامى/islamic_library";
const EXE=path.join(process.env.HOME,".cache/ms-playwright/chromium-1243/chrome-linux64/chrome");
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".woff2":"font/woff2",".webmanifest":"application/manifest+json"};
const server=await new Promise(r=>{const s=http.createServer((q,p)=>{let f=path.join(ROOT,decodeURIComponent(q.url.split("?")[0]));
 if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,"index.html");
 if(!f.startsWith(ROOT)||!fs.existsSync(f))return void p.writeHead(404).end("404");
 p.writeHead(200,{"content-type":MIME[path.extname(f)]??"application/octet-stream"});fs.createReadStream(f).pipe(p);});s.listen(0,"127.0.0.1",()=>r(s));});
const base=`http://127.0.0.1:${server.address().port}`;
const b=await chromium.launch({executablePath:EXE,args:["--no-sandbox"]});
let bad=0;
for(const page of ["src/site/noor.html","src/app/app.html"]){
  const ctx=await b.newContext(); const t=await ctx.newPage();
  const errs=[]; t.on("pageerror",e=>errs.push(e.message));
  await t.goto(`${base}/${page}`,{waitUntil:"load"}); await t.waitForTimeout(900);
  const res=await t.evaluate(()=>{
    const out=[];
    for(const u of document.querySelectorAll("use")){
      const svg=u.closest("svg"); const r=svg.getBoundingClientRect();
      const id=(u.getAttribute("href")||"").slice(1);
      let box=0;
      try{ box=(svg.getBBox()||{}).width||0; }catch(e){ box=0; }
      out.push({id, w:Math.round(r.width), h:Math.round(r.height),
        found:!!(id&&document.getElementById(id)), box:Math.round(box)});
    }
    return out;});
  console.log(`\n▸ ${page}`);
  if(!res.length)console.log("   (لا توجد أيقونات)");
  for(const i of res){
    // أيقونة مخفية عمدًا (زر العودة للأعلى قبل التمرير) ليست خللًا
    const hiddenByDesign = i.w===0 && i.h===0;
    const ok = i.found && (hiddenByDesign || (i.w>0&&i.h>0&&i.box>0));
    if(!ok)bad++;
    console.log(`   ${ok?"✔":"✘"} #${i.id.padEnd(14)} مرسومة=${i.w}x${i.h} هندسة=${i.box} رمز=${i.found}`);
  }
  if(errs.length){console.log("   أخطاء:",errs.join(" | "));bad+=errs.length;}
  await ctx.close();
}
await b.close(); server.close();
console.log(bad?`\n✘ مشاكل: ${bad}`:"\n✔ كل الأيقونات تُرسم");
process.exit(bad?1:0);
