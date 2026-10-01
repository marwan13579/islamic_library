(function(){
  try{
    const probeKey="__islamic_library_storage_probe__"+Math.random();
    window.localStorage.setItem(probeKey,"1");
    window.localStorage.removeItem(probeKey);
    window.__APP_STORAGE_PERSISTENT__=true;
    return;
  }catch(e){}

  const entries=new Map();
  const fallback={
    get length(){ return entries.size; },
    key(index){ return Array.from(entries.keys())[index]??null; },
    getItem(key){ return entries.has(String(key))?entries.get(String(key)):null; },
    setItem(key,value){ entries.set(String(key),String(value)); },
    removeItem(key){ entries.delete(String(key)); },
    clear(){ entries.clear(); }
  };
  let installed=false;
  try{
    Object.defineProperty(window,"localStorage",{configurable:true,value:fallback});
    installed=window.localStorage===fallback;
  }catch(e){}
  window.__APP_STORAGE_PERSISTENT__=!installed;
  if(!installed||typeof document==="undefined") return;

  const showWarning=()=>{
    const warning=document.createElement("div");
    warning.setAttribute("role","status");
    warning.setAttribute("aria-live","polite");
    warning.style.cssText="position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:12px;right:12px;z-index:10000;display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:680px;margin-inline:auto;padding:10px 14px;background:#fff4d6;color:#493700;border:1px solid #d8ad43;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.2);font:600 .82rem/1.5 Cairo,sans-serif";
    const message=document.createElement("span");
    message.textContent="التخزين الدائم غير متاح؛ بيانات هذه الجلسة مؤقتة ولن تبقى بعد إغلاق الصفحة.";
    const close=document.createElement("button");
    close.type="button";
    close.textContent="إخفاء";
    close.setAttribute("aria-label","إخفاء تنبيه التخزين المؤقت");
    close.style.cssText="flex:none;padding:5px 9px;border:1px solid currentColor;border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer";
    close.addEventListener("click",()=>warning.remove());
    warning.append(message,close);
    document.body.prepend(warning);
  };
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",showWarning,{once:true});
  else showWarning();
})();