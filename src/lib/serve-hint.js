/**
 * حارس التشغيل المحلي — سكربت عادي (ليس وحدة ES) ليعمل من بروتوكول file: أيضًا.
 *
 * وحدات ES-modules لا تعمل عند الفتح مباشرة من القرص، لأن المتصفح يمنع
 * استيراد السكربتات من أصل null. فإذا فُتحت الصفحة بنقرة مزدوجة بدت فارغة
 * بلا سبب ظاهر. هذا الحارس يكتشف الحالة ويعرض سببًا واضحًا وطريقة التشغيل.
 *
 * الاستخدام:  <script src="../lib/serve-hint.js"></script>
 * يجب أن يسبق وسم الوحدة في ترتيب الملف.
 */
(function () {
  "use strict";

  if (location.protocol !== "file:") return;

  var TITLE = "الصفحة تحتاج تشغيلًا عبر خادم";
  var BODY =
    "<p>فُتحت هذه الصفحة مباشرة من القرص، ولذلك لم تعمل وحداتها. وهذا خطأ شائع.</p>";

  var STEPS =
    "<ol>" +
    '<li>افتح الطرفية داخل مجلد المشروع.</li>' +
    "<li>نفّذ الأمر: <code>npm run serve</code></li>" +
    '<li>افتح العنوان: <code>http://localhost:8765</code></li>' +
    "</ol>";

  var NOTE =
    "<p class='serve-note'>وحدات ES وعامل الخدمة لا يعملان إلا عبر http أو https، " +
    "ولذلك لا يظهر التطبيق ولا يعمل دون اتصال.</p>";

  var STYLE =
    ".serve-note{font-size:.85rem;opacity:.75;margin-top:12px}" +
    ".serve-box{max-width:620px;margin:48px auto;padding:28px 26px;border-radius:16px;" +
    "font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.9}" +
    ".serve-box h2{font-size:1.3rem;margin:0 0 12px}" +
    ".serve-box ol{margin:12px 0;padding-inline-start:22px}" +
    ".serve-box li{margin-block-end:8px}" +
    ".serve-box code{display:inline-block;padding:2px 10px;border-radius:8px;" +
    "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92rem;" +
    "background:rgba(127,127,127,.16);direction:ltr}" +
    ".serve-bar{margin:0;padding:14px 20px;font-size:.92rem;line-height:1.8;" +
    "background:#8a5a00;color:#fff;text-align:center}" +
    ".serve-bar code{background:rgba(255,255,255,.22);padding:2px 8px;border-radius:6px;direction:ltr}";

  function fill(target) {
    target.innerHTML =
      '<div class="serve-box">' +
      "<h2>" +
      TITLE +
      "</h2>" +
      BODY +
      STEPS +
      NOTE +
      "</div>";
  }

  function bar() {
    var el = document.createElement("div");
    el.className = "serve-bar";
    el.innerHTML =
      "تنبيه: هذه الصفحة تعمل بالكامل عبر خادم محلي. نفّذ " +
      "<code>npm run serve</code> ثم افتح <code>http://localhost:8765</code>";
    return el;
  }

  function run() {
    var style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);

    // صفحة تعتمد على وحدات: عناصرها فارغة، فنملؤها بالسبب.
    var empty = null;
    var candidates = document.querySelectorAll("main, [role=main]");
    for (var i = 0; i < candidates.length; i += 1) {
      if (!candidates[i].textContent.trim()) {
        empty = candidates[i];
        break;
      }
    }
    if (empty) return void fill(empty);

    // صفحة تعمل: نكتفي بشريط تنبيه أعلى المحتوى.
    document.body.insertBefore(bar(), document.body.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
