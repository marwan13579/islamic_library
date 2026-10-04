/**
 * إقلاعُ الإشعارات في كل صفحة — سطرٌ واحد يُحمَّل مع الصفحة.
 * ------------------------------------------------------------------
 * وحدة `src/lib/auto-notify.js` هي النظام كله، لكنّها وحدة ES
 * والصفحات القديمة (٤٦ صفحة) لا تحمل وحدات. فنجعل هذا الملفّ نصًّا
 * كلاسيكيًّا صغيرًا يجلب الوحدة عند الحاجة ويطلب الإذن ويعرض
 * الترحيب — فيعمل النظام في كل صفحة، ولو لم تُكتب فيها يدًا واحدة.
 *
 * بلا وحدات ES، وبالمسار النسبي لصفحته، فيفعل الشيء نفسه في الجذر
 * وفي `islamic-videos/`.
 */
(function () {
  var here = document.currentScript && document.currentScript.src;
  if (!here) return;
  /* لا نكتب `typeof import`: كلمة `import` وحدها في نصٍّ كلاسيكي
     خطأُ تحليل، فتفشل الملفّ بالكامل قبل التنفيذ. ونكتفي بعلامة
     `noModule` التي يضعها المتصفّح القديم سمةً في الوسم. */
  if ("noModule" in document.createElement("script")) return;
  import(new URL("src/lib/auto-notify.js", here).href)
    .then(function (notify) {
      return notify.boot({ url: location.href });
    })
    .catch(function () {
      /* متصفّح قديم بلا وحدات: تبقى بقية الصفحة كما هي */
    });
})();