(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.IslamicBackup=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const FORMAT="islamic-library-backup";
  const VERSION=1;
  const MAX_BYTES=5*1024*1024;
  const MAX_KEYS=1000;
  const MAX_KEY_LENGTH=200;
  const MAX_VALUE_LENGTH=1024*1024;
  const BLOCKED_KEYS=new Set(["__proto__","prototype","constructor"]);
  const ALLOWED_KEYS=new Set([
    "theme","font-size","readLessons","lessonScroll","bookmarks","quizStats","weeklyDone","certificates",
    "reader_font","reader_line","reader_last",
    "tasbihCount","totalTasbih","stats","calendar_type","continue-state","askDraft","last_tab",
    "khatma_state","khatma_assignees","khatma_dedication","prayer_city","user_coords","calc_method",
    "quran_font_size","focus_mode","quran_bookmarks","quran_ward","athkar_progress","athkar_streak",
    "prayer_tracker","notif_enabled","notif_before","reciter","radio_volume","sadaka_cards","card_state",
    "lib-theme-pref","hub-lang","hub-favorites","hub-notes","hub-lastused","hub-ramadan-loc",
    "nour-progress","gtasbeeh-custom","gtasbeeh-phrase","gtasbeeh-goal","gtasbeeh-people",
    "current_surah","tasbeeh_target","tasbih_index","prayer_timings","sleep_minutes","total_all_tasbeeh","sadaka_archived",
    "tadabbur-entries","wird-goal","wird-log","qada-owed","qada-done","mushaf-progress",
    "mushaf-reviewdates","mushaf-daily","mushaf-streak","mushaf-lastday","mushaf-markedtoday",
    "azkar-shamila-progress","daily-system-state","daily-system-streak","daily-system-lastfull",
    "hadith-favorites","prayertimes-state","prayertimes-notify","quran-settings","quran-bookmarks",
    "quran-notes","quran-lastpos",    "ramadan-day","ramadan-state","ramadan-itikaf","ramadan-eidlist",
    // المكتبة المستوردة: التسبيح اليومي، سجل الاختبار، وإعدادات الأذان.
    "gtasbeeh-daily","lib-quiz-level","lib-quiz-history",
    "athan_timings","athan_coords","athan_method","athan_auto_audio","athan_notif_off",
    // مكتبة الفيديو الإسلامية: المفضلة وآخر ما شوهد
    "video_favorites","video_recent",
    // رفيق النور: إعدادات التذكير، وسجلّ ما عُرض، والإحصاءات، وأعمال اليوم.
    "noor-settings","noor-shown","noor-stats","noor-actions",
  ]);

  function createBackup(storage,createdAt=new Date()){
    if(!storage||!Number.isInteger(storage.length)||storage.length>MAX_KEYS) throw new Error("حجم التخزين يتجاوز الحد المسموح للتصدير.");
    const data=Object.create(null);
    for(let index=0;index<storage.length;index++){
      const key=storage.key(index);
      if(typeof key!=="string"||!key||key.length>MAX_KEY_LENGTH||BLOCKED_KEYS.has(key)||!ALLOWED_KEYS.has(key)) continue;
      const value=storage.getItem(key);
      if(typeof value!=="string"||value.length>MAX_VALUE_LENGTH) throw new Error("توجد بيانات تتجاوز الحد المسموح للتصدير.");
      data[key]=value;
    }
    const backup={format:FORMAT,version:VERSION,createdAt:createdAt.toISOString(),data};
    const text=JSON.stringify(backup);
    if(new TextEncoder().encode(text).byteLength>MAX_BYTES) throw new Error("حجم النسخة الاحتياطية أكبر من 5 ميجابايت.");
    return text;
  }

  function parseBackup(text){
    if(typeof text!=="string"||new TextEncoder().encode(text).byteLength>MAX_BYTES) throw new Error("الملف أكبر من الحد المسموح.");
    let backup;
    try{backup=JSON.parse(text);}catch(error){throw new Error("ملف النسخة الاحتياطية ليس JSON صالحًا.");}
    if(!backup||backup.format!==FORMAT||backup.version!==VERSION||!backup.data||typeof backup.data!=="object"||Array.isArray(backup.data)) throw new Error("صيغة النسخة الاحتياطية غير مدعومة.");
    const keys=Object.keys(backup.data);
    if(!keys.length||keys.length>MAX_KEYS) throw new Error("عدد عناصر النسخة الاحتياطية غير صالح.");
    const entries=[];
    let total=0;
    for(const key of keys){
      const value=backup.data[key];
      if(!key||key.length>MAX_KEY_LENGTH||BLOCKED_KEYS.has(key)||!ALLOWED_KEYS.has(key)||typeof value!=="string"||value.length>MAX_VALUE_LENGTH) throw new Error("النسخة تحتوي مفتاحًا أو قيمة غير صالحة.");
      total+=new TextEncoder().encode(key).byteLength+new TextEncoder().encode(value).byteLength;
      if(total>MAX_BYTES) throw new Error("بيانات النسخة تتجاوز الحد المسموح.");
      entries.push([key,value]);
    }
    return {createdAt:typeof backup.createdAt==="string"?backup.createdAt:"غير معروف",entries};
  }

  function restoreBackup(storage,backup){
    let restored=0;
    const failed=[];
    for(const [key,value] of backup.entries){
      try{storage.setItem(key,value);restored++;}catch(error){failed.push(key);}
    }
    return {restored,failed};
  }

  return Object.freeze({FORMAT,VERSION,MAX_BYTES,createBackup,parseBackup,restoreBackup});
});
