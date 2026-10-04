const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const calculations = require("../calculations.js");
const khatma = require("../khatma-core.js");
const backups = require("../backup-core.js");
const serviceMessages = require("../service-messages.js");

const root = path.join(__dirname, "..");

function inheritanceShare(result, label){
  const row=result.rows.find(([name])=>name===label);
  assert.ok(row,`missing heir share for ${label}`);
  return row[1];
}

test("zakat is due at the gold nisab boundary",()=>{
  const result=calculations.calculateZakat({goldPrice:100,cash:8500});
  assert.equal(result.status,"due");
  assert.equal(result.nisab,8500);
  assert.equal(result.amount,212.5);
});

test("zakat rejects missing gold price and wealth below nisab",()=>{
  assert.equal(calculations.calculateZakat({cash:10000}).status,"missing-gold-price");
  const result=calculations.calculateZakat({goldPrice:100,cash:8499});
  assert.equal(result.status,"below-nisab");
  assert.equal(result.amount,0);
});

test("gold valuation and fitr totals reject invalid inputs",()=>{
  assert.equal(calculations.calculateGoldValue(10,21,100),1000);
  assert.equal(calculations.calculateGoldValue(10,25,100),null);
  assert.equal(calculations.calculateFitr(3,20),60);
  assert.equal(calculations.calculateFitr(-1,20),0);
});

test("inheritance applies the husband and parents umariyyatain shares",()=>{
  const result=calculations.calculateInheritance({gender:"f",husbandAlive:true,motherAlive:true,fatherAlive:true});
  assert.equal(inheritanceShare(result,"الزوج"),1/2);
  assert.equal(inheritanceShare(result,"الأم"),1/6);
  assert.ok(Math.abs(inheritanceShare(result,"الأب")-1/3)<1e-12);
  assert.equal(result.flags.length,0);
});

test("inheritance divides children residue at two to one",()=>{
  const result=calculations.calculateInheritance({gender:"m",wives:1,sons:1,daughters:1,fatherAlive:true,motherAlive:true});
  assert.equal(inheritanceShare(result,"الزوجة"),1/8);
  assert.equal(inheritanceShare(result,"الأم"),1/6);
  assert.equal(inheritanceShare(result,"الأب"),1/6);
  assert.ok(Math.abs(inheritanceShare(result,"الأبناء الذكور (مجتمعين، لكل ابن ضعف البنت)")/inheritanceShare(result,"البنات (مجتمعات)")-2)<1e-12);
  assert.equal(result.flags.length,0);
});

test("inheritance reports shares it cannot allocate",()=>{
  const result=calculations.calculateInheritance({gender:"f",daughters:1});
  assert.equal(inheritanceShare(result,"البنت"),1/2);
  assert.equal(result.flags.length,1);
});

test("prayer-time clock carries rounded minutes and wraps midnight",()=>{
  assert.equal(calculations.formatPrayerClock(17.9999),"٦:٠٠ م");
  assert.equal(calculations.formatPrayerClock(23.9999),"١٢:٠٠ ص");
  assert.equal(calculations.formatPrayerClock(NaN),"—");
});

test("prayer times are ordered for a Cairo spring fixture",()=>{
  const times=calculations.computePrayerTimes(30.0444,31.2357,new Date(2024,2,20),2,{fajr:19.5,isha:17.5},1);
  const ordered=[times.fajr,times.sunrise,times.dhuhr,times.asr,times.maghrib,times.isha];
  assert.ok(ordered.every(Number.isFinite));
  assert.deepEqual([...ordered].sort((a,b)=>a-b),ordered);
  assert.ok(times.fajr>3&&times.fajr<6);
  assert.ok(times.maghrib>17&&times.maghrib<20);
});

test("bundled Quran corpus preserves the complete Uthmani text and source attribution",()=>{
  const corpus=require("../vendor/quran-arabic.json");
  assert.equal(corpus.source.edition,"quran-uthmani");
  assert.match(corpus.source.license,/non-commercial/i);
  assert.equal(corpus.surahs.length,114);
  assert.equal(corpus.surahs.reduce((sum,surah)=>sum+surah.ayahs.length,0),6236);
  let globalNumber=1;
  corpus.surahs.forEach((surah,index)=>{
    assert.equal(surah.number,index+1);
    assert.equal(surah.ayahCount,surah.ayahs.length);
    surah.ayahs.forEach((ayah,ayahIndex)=>{
      assert.equal(ayah.n,ayahIndex+1);
      assert.equal(ayah.global,globalNumber++);
      assert.match(ayah.text,/\p{Script=Arabic}/u);
      assert.ok(Number.isInteger(ayah.juz)&&Number.isInteger(ayah.page));
    });
  });
});

test("blocked browser storage uses memory and shows a persistence warning",()=>{
  const source=fs.readFileSync(path.join(root,"storage-fallback.js"),"utf8");
  const elements=[];
  const document={
    readyState:"complete",
    createElement(tag){
      const element={tag,style:{},attributes:{},children:[],listeners:{},setAttribute(key,value){this.attributes[key]=value;},append(...children){this.children.push(...children);},addEventListener(name,callback){this.listeners[name]=callback;},remove(){this.removed=true;}};
      elements.push(element);
      return element;
    },
    body:{prepend(element){this.firstChild=element;}}
  };
  const window={};
  Object.defineProperty(window,"localStorage",{configurable:true,get(){throw new Error("blocked");}});
  vm.runInNewContext(source,{window,document,Map});
  assert.equal(window.__APP_STORAGE_PERSISTENT__,false);
  window.localStorage.setItem("count",3);
  assert.equal(window.localStorage.getItem("count"),"3");
  assert.equal(window.localStorage.length,1);
  assert.match(document.body.firstChild.children[0].textContent,/لن تبقى بعد إغلاق الصفحة/);
  document.body.firstChild.children[1].listeners.click();
  assert.equal(document.body.firstChild.removed,true);
});

test("quota-restricted storage falls back when reads work but writes fail",()=>{
  const source=fs.readFileSync(path.join(root,"storage-fallback.js"),"utf8");
  const document={readyState:"loading",addEventListener(){}};
  const window={};
  Object.defineProperty(window,"localStorage",{configurable:true,value:{
    getItem(){return null;},
    setItem(){throw new Error("quota exceeded");},
    removeItem(){}
  }});
  vm.runInNewContext(source,{window,document,Map,Math});
  assert.equal(window.__APP_STORAGE_PERSISTENT__,false);
  window.localStorage.setItem("count",1);
  assert.equal(window.localStorage.getItem("count"),"1");
});

test("unified backup exports, validates, and merges string storage safely",()=>{
  const source=new Map([["hub-favorites","{\"academy\":true}"],["mushaf-progress","{\"1\":true}"],["unknown-key","payload"]]);
  const storage={get length(){return source.size;},key:index=>[...source.keys()][index]??null,getItem:key=>source.get(key)??null,setItem:(key,value)=>source.set(key,value)};
  const text=backups.createBackup(storage,new Date("2026-09-30T00:00:00.000Z"));
  const parsed=backups.parseBackup(text);
  assert.equal(parsed.entries.length,2);
  assert.equal(parsed.entries.some(([key])=>key==="unknown-key"),false);
  assert.equal(parsed.createdAt,"2026-09-30T00:00:00.000Z");
  source.set("local-only","keep");
  const result=backups.restoreBackup(storage,parsed);
  assert.equal(result.restored,2);
  assert.deepEqual(result.failed,[]);
  assert.equal(storage.getItem("local-only"),"keep");
  assert.equal(storage.getItem("mushaf-progress"),"{\"1\":true}");
});

test("unified backup rejects malformed, oversized, and unsafe entries",()=>{
  assert.throws(()=>backups.parseBackup("not json"),/JSON/);
  assert.throws(()=>backups.parseBackup(" ".repeat(backups.MAX_BYTES+1)),/أكبر/);
  const unsafe=`{"format":"${backups.FORMAT}","version":1,"data":{"valid":"value","__proto__":"{}"}}`;
  assert.throws(()=>backups.parseBackup(unsafe),/غير صالحة/);
  const unknown=`{"format":"${backups.FORMAT}","version":1,"data":{"quran-notes":"{}","unknown-key":"payload"}}`;
  assert.throws(()=>backups.parseBackup(unknown),/غير صالحة/);
});

test("external permission errors explain recovery steps",()=>{
  assert.match(serviceMessages.locationError({code:1}),/الإحداثيات يدويًا/);
  assert.match(serviceMessages.locationError({code:2}),/GPS/);
  assert.match(serviceMessages.locationError({code:3}),/مهلة/);
  assert.match(serviceMessages.microphoneError({name:"NotAllowedError"}),/HTTPS أو localhost/);
  assert.match(serviceMessages.microphoneError({name:"NotFoundError"}),/ميكروفون/);
  assert.match(serviceMessages.microphoneError({name:"NotReadableError"}),/مشغول/);
});

test("group khatma migrates and round-trips legacy progress without loss",()=>{
  const completed=Array.from({length:30},(_,index)=>index===0||index===12);
  const assignees={0:"أحمد",12:"سارة"};
  const state=khatma.createState(JSON.stringify(completed),JSON.stringify(assignees),"إهداء لوالدي");
  assert.deepEqual(state.participants,["أحمد","سارة"]);
  assert.deepEqual(khatma.progress(state),{completed:2,total:30,percent:7});
  assert.equal(khatma.toggle(state,1),true);
  assert.equal(khatma.assign(state,1,"محمد"),true);
  const saved=khatma.toLegacy(state);
  assert.equal(saved.completed[0],true);
  assert.equal(saved.completed[1],true);
  assert.equal(saved.assignees[12],"سارة");
  assert.equal(saved.assignees[1],"محمد");
  assert.equal(saved.dedication,"إهداء لوالدي");
});

test("group khatma safely resets malformed or out-of-range data",()=>{
  const state=khatma.createState("invalid","[]","");
  assert.equal(state.juz.length,30);
  assert.equal(khatma.progress(state).completed,0);
  assert.equal(khatma.assign(state,30,"اسم"),false);
  assert.equal(khatma.toggle(state,-1),false);
});

test("service worker refreshes known assets and bypasses dynamic requests",async()=>{
  const handlers={};
  const scope="https://example.test/islamic_library/";
  const entries=new Map([[scope+"index.html",{body:"app shell"}]]);
  const installedRequests=[];
  class RequestMock{
    constructor(url,options){this.url=url;this.cache=options.cache;}
  }
  const cache={
    addAll:async requests=>requests.forEach(request=>{installedRequests.push(request);if(!entries.has(request.url))entries.set(request.url,{body:"asset"});}),
    add:async request=>{installedRequests.push(request);if(!entries.has(request.url))entries.set(request.url,{body:"asset"});},
    match:async key=>entries.get(typeof key==="string"?key:key.url),
    put:async(key,value)=>entries.set(typeof key==="string"?key:key.url,value)
  };
  const caches={
    open:async()=>cache,
    keys:async()=>["islamic-library-v5","unrelated-cache"],
    delete:async()=>true
  };
  const self={registration:{scope},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,handler)=>handlers[name]=handler};
  vm.runInNewContext(fs.readFileSync(path.join(root,"sw.js"),"utf8"),{
    self,caches,URL,Set,Request:RequestMock,fetch:async()=>{throw new Error("offline");},Response:{error:()=>({body:"network error"})}
  });
  let installPromise;
  handlers.install({waitUntil(promise){installPromise=promise;}});
  await installPromise;
  assert.ok(installedRequests.length>0);
  assert.ok(installedRequests.every(request=>request.cache==="reload"));
  assert.ok(installedRequests.some(request=>request.url===scope+"vendor/quran-arabic.json"));
  function dispatch(request){
    const event={request,respondWith(promise){this.response=promise;},waitUntil(){}};
    handlers.fetch(event);
    return event;
  }
  assert.equal(dispatch({url:scope+"api/search?q=word",method:"GET",mode:"cors"}).response,undefined);
  assert.equal(dispatch({url:"https://api.example.test/data",method:"GET",mode:"cors"}).response,undefined);
  assert.equal(dispatch({url:scope+"submit",method:"POST",mode:"cors"}).response,undefined);
  const response=await dispatch({url:scope+"unknown-route",method:"GET",mode:"navigate"}).response;
  // صفحة عدم الاتصال تسبق الفهرس: صفحة غير معروفة تُفتح على ما يفهمه
  // المستخدم، لا على فهرس وشريط عنوانه يقول صفحة أخرى.
  assert.deepEqual(response,{body:"asset"});
  assert.equal(entries.has(scope+"offline.html"),true);
  const staticPage=dispatch({url:scope+"index.html?cache-bust=1",method:"GET",mode:"navigate"});
  assert.deepEqual(await staticPage.response,{body:"app shell"});
});
