(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.IslamicServiceMessages=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  function locationError(error){
    if(error?.code===1) return "لم تسمح بإذن تحديد الموقع. يمكنك إدخال الإحداثيات يدويًا.";
    if(error?.code===2) return "تعذر تحديد موقع الجهاز. تحقق من GPS أو الشبكة وحاول مجددًا.";
    if(error?.code===3) return "انتهت مهلة تحديد الموقع. حاول مرة أخرى أو أدخل الإحداثيات يدويًا.";
    return "تعذر تحديد الموقع. أدخل الإحداثيات يدويًا أو حاول مرة أخرى.";
  }

  function microphoneError(error){
    if(["NotAllowedError","PermissionDeniedError","SecurityError"].includes(error?.name)) return "لم يُسمح باستخدام الميكروفون. راجع إذن الموقع في المتصفح وتأكد من فتح التطبيق عبر HTTPS أو localhost.";
    if(["NotFoundError","DevicesNotFoundError"].includes(error?.name)) return "لم يتم العثور على ميكروفون متصل بالجهاز.";
    if(["NotReadableError","TrackStartError"].includes(error?.name)) return "الميكروفون مشغول أو غير متاح. أغلق التطبيق الآخر وحاول مجددًا.";
    return "تعذر تشغيل الميكروفون. تحقق من توصيله وإذن المتصفح ثم حاول مجددًا.";
  }

  return Object.freeze({locationError,microphoneError});
});
