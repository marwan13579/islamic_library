(function(){
  const inLibrary=location.pathname.split("/").includes("islamic_library");
  const link=document.createElement("a");
  link.href=inLibrary?"index.html":"islamic_library/index.html";
  link.className="hub-return";
  link.setAttribute("aria-label","العودة إلى المكتبة الإسلامية");
  link.textContent="‹ المكتبة";
  link.style.cssText="position:fixed;inset-inline-start:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 82px);z-index:120;background:#0f4d38;color:#fff;text-decoration:none;font-family:Cairo,sans-serif;font-size:.78rem;font-weight:700;padding:8px 14px;border:1px solid rgba(201,162,39,.65);border-radius:999px;box-shadow:0 3px 12px rgba(0,0,0,.2)";
  document.body.appendChild(link);
})();