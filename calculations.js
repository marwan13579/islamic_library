(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.IslamicCalculations=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const DEG=value=>value*Math.PI/180;
  const RAD=value=>value*180/Math.PI;
  const ARABIC_DIGITS="٠١٢٣٤٥٦٧٨٩";

  function finiteNumber(value){
    const number=Number(value);
    return Number.isFinite(number)?number:0;
  }

  function toArabicDigits(value){
    return String(value).replace(/\d/g,digit=>ARABIC_DIGITS[digit]);
  }

  function julianDate(year,month,day){
    if(month<=2){year-=1;month+=12;}
    const century=Math.floor(year/100);
    const correction=2-century+Math.floor(century/4);
    return Math.floor(365.25*(year+4716))+Math.floor(30.6001*(month+1))+day+correction-1524.5;
  }

  function sunPosition(julianDay){
    const days=julianDay-2451545.0;
    const meanAnomaly=DEG((357.529+0.98560028*days)%360);
    const meanLongitude=(280.459+0.98564736*days)%360;
    const eclipticLongitude=DEG((meanLongitude+1.915*Math.sin(meanAnomaly)+0.020*Math.sin(2*meanAnomaly))%360);
    const obliquity=DEG(23.439-0.00000036*days);
    let rightAscension=RAD(Math.atan2(Math.cos(obliquity)*Math.sin(eclipticLongitude),Math.cos(eclipticLongitude)))/15;
    rightAscension=((rightAscension%24)+24)%24;
    const declination=RAD(Math.asin(Math.sin(obliquity)*Math.sin(eclipticLongitude)));
    let equationOfTime=meanLongitude/15-rightAscension;
    if(equationOfTime>12) equationOfTime-=24;
    if(equationOfTime<-12) equationOfTime+=24;
    return {declination,equationOfTime};
  }

  function hourAngle(latitude,declination,altitude){
    const phi=DEG(latitude), delta=DEG(declination), h=DEG(altitude);
    const cosine=(Math.sin(h)-Math.sin(phi)*Math.sin(delta))/(Math.cos(phi)*Math.cos(delta));
    if(!Number.isFinite(cosine)||cosine>1||cosine<-1) return null;
    return RAD(Math.acos(cosine))/15;
  }

  function asrElevation(latitude,declination,factor){
    return RAD(Math.atan(1/(factor+Math.tan(DEG(Math.abs(latitude-declination))))));
  }

  function computePrayerTimes(latitude,longitude,date,timezone,method,asrFactor){
    const empty={fajr:null,sunrise:null,dhuhr:null,asr:null,maghrib:null,isha:null};
    if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180||!(date instanceof Date)||!Number.isFinite(date.getTime())||!Number.isFinite(timezone)||!method||!Number.isFinite(asrFactor)||asrFactor<=0) return empty;
    const julianDay=julianDate(date.getFullYear(),date.getMonth()+1,date.getDate());
    const {declination,equationOfTime}=sunPosition(julianDay);
    const noon=12+timezone-longitude/15-equationOfTime;
    const fixedIsha=typeof method.isha==="string"?parseInt(method.isha,10):null;
    const ishaAngle=fixedIsha===null?method.isha:null;
    if(!Number.isFinite(method.fajr)||!(fixedIsha!==null||Number.isFinite(ishaAngle))) return empty;
    const fajrAngle=hourAngle(latitude,declination,-method.fajr);
    const sunriseAngle=hourAngle(latitude,declination,-0.833);
    const asrAngle=hourAngle(latitude,declination,asrElevation(latitude,declination,asrFactor));
    const ishaHourAngle=ishaAngle!==null?hourAngle(latitude,declination,-ishaAngle):null;
    const sunset=sunriseAngle!==null?noon+sunriseAngle:null;
    return {
      fajr:fajrAngle!==null?noon-fajrAngle:null,
      sunrise:sunriseAngle!==null?noon-sunriseAngle:null,
      dhuhr:noon,
      asr:asrAngle!==null?noon+asrAngle:null,
      maghrib:sunset,
      isha:fixedIsha!==null&&sunset!==null?sunset+fixedIsha/60:(ishaHourAngle!==null?noon+ishaHourAngle:null)
    };
  }

  function computeFajrMaghrib(latitude,longitude,date,timezone){
    if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180||!(date instanceof Date)||!Number.isFinite(date.getTime())||!Number.isFinite(timezone)) return {fajr:null,maghrib:null};
    const julianDay=julianDate(date.getFullYear(),date.getMonth()+1,date.getDate());
    const {declination,equationOfTime}=sunPosition(julianDay);
    const noon=12+timezone-longitude/15-equationOfTime;
    const fajrAngle=hourAngle(latitude,declination,-18);
    const sunsetAngle=hourAngle(latitude,declination,-0.833);
    return {fajr:fajrAngle!==null?noon-fajrAngle:null,maghrib:sunsetAngle!==null?noon+sunsetAngle:null};
  }

  function formatPrayerClock(decimalHour){
    if(!Number.isFinite(decimalHour)) return "—";
    const hour=((decimalHour%24)+24)%24;
    const minutes=Math.round(hour*60)%(24*60);
    const hour24=Math.floor(minutes/60), minute=minutes%60;
    const hour12=hour24%12||12;
    return toArabicDigits(hour12)+":"+toArabicDigits(String(minute).padStart(2,"0"))+(hour24<12?" ص":" م");
  }

  function calculateZakat(input={}){
    const price=Math.max(0,finiteNumber(input.goldPrice));
    const cash=Math.max(0,finiteNumber(input.cash));
    const goldValue=Math.max(0,finiteNumber(input.goldValue));
    const trade=Math.max(0,finiteNumber(input.trade));
    const debtsOwed=Math.max(0,finiteNumber(input.debtsOwed));
    const debtsOwe=Math.max(0,finiteNumber(input.debtsOwe));
    const nisab=price*85;
    const netWealth=cash+goldValue+trade+debtsOwed-debtsOwe;
    if(price<=0) return {status:"missing-gold-price",nisab,netWealth,amount:0};
    if(netWealth<nisab) return {status:"below-nisab",nisab,netWealth,amount:0};
    return {status:"due",nisab,netWealth,amount:netWealth*0.025};
  }

  function calculateGoldValue(grams,karat,price21){
    const weight=finiteNumber(grams), purity=finiteNumber(karat), price=finiteNumber(price21);
    if(weight<=0||purity<=0||purity>24||price<=0) return null;
    return weight*(purity/21)*price;
  }

  function calculateFitr(persons,amountPerPerson){
    const count=Math.max(0,Math.floor(finiteNumber(persons)));
    const amount=Math.max(0,finiteNumber(amountPerPerson));
    return count*amount;
  }

  function calculateInheritance(input={}){
    const male=input.gender==="m";
    const count=value=>Math.max(0,Math.floor(finiteNumber(value)));
    const sons=count(input.sons), daughters=count(input.daughters);
    const fatherAlive=!!input.fatherAlive, motherAlive=!!input.motherAlive;
    const estate=Math.max(0,finiteNumber(input.estate));
    const hasChild=sons>0||daughters>0;
    let spouseShare=0, spouseLabel="", spouseCount=0;
    if(male){
      spouseCount=Math.min(4,count(input.wives));
      if(spouseCount>0){spouseShare=hasChild?1/8:1/4;spouseLabel=spouseCount>1?"الزوجات (مجتمعات)":"الزوجة";}
    }else if(input.husbandAlive){
      spouseShare=hasChild?1/4:1/2;spouseLabel="الزوج";spouseCount=1;
    }

    let motherShare=0;
    if(motherAlive){
      if(hasChild) motherShare=1/6;
      else if(spouseShare>0&&fatherAlive) motherShare=(1-spouseShare)/3;
      else motherShare=1/3;
    }

    const fatherFixed=fatherAlive&&hasChild?1/6:0;
    const rows=[];
    const flags=[];
    if(spouseShare>0) rows.push([spouseLabel,spouseShare]);
    if(motherAlive) rows.push(["الأم",motherShare]);
    let consumed=spouseShare+motherShare;
    const percent=value=>(value*100).toLocaleString(undefined,{maximumFractionDigits:2})+"٪";

    if(hasChild){
      if(sons>0){
        if(fatherAlive){rows.push(["الأب",fatherFixed]);consumed+=fatherFixed;}
        const residue=Math.max(0,1-consumed);
        const units=sons*2+daughters;
        const unit=units>0?residue/units:0;
        if(sons>0) rows.push(["الأبناء الذكور (مجتمعين، لكل ابن ضعف البنت)",unit*2*sons]);
        if(daughters>0) rows.push(["البنات (مجتمعات)",unit*daughters]);
        consumed+=residue;
      }else{
        const daughterFixed=daughters===1?1/2:2/3;
        rows.push([daughters===1?"البنت":"البنات (مجتمعات)",daughterFixed]);
        consumed+=daughterFixed;
        if(fatherAlive){
          const remaining=Math.max(0,1-consumed-fatherFixed);
          rows.push(["الأب",fatherFixed+remaining]);
          consumed+=fatherFixed+remaining;
        }else{
          const remaining=Math.max(0,1-consumed);
          if(remaining>0.0001) flags.push("توجد نسبة "+percent(remaining)+" من التركة لم تُوزَّع في هذه الحالة (قد ترجع للبنات ردًّا أو لورثة آخرين كالإخوة أو الجد) — يلزم استشارة شرعية.");
        }
      }
    }else if(fatherAlive){
      const remaining=Math.max(0,1-consumed);
      rows.push(["الأب",remaining]);
      consumed+=remaining;
    }else{
      const remaining=Math.max(0,1-consumed);
      if(remaining>0.0001) flags.push("توجد نسبة "+percent(remaining)+" من التركة لم تُوزَّع (قد تعود لورثة آخرين كالإخوة أو الأجداد لم تُدخلهم هذه الحاسبة) — يلزم استشارة شرعية.");
    }

    if(rows.length===0&&flags.length===0) flags.push("أدخل بيانات الورثة لعرض الأنصبة.");
    return {rows,flags,estate,spouseCount};
  }

  return Object.freeze({
    julianDate,
    computePrayerTimes,
    computeFajrMaghrib,
    formatPrayerClock,
    calculateZakat,
    calculateGoldValue,
    calculateFitr,
    calculateInheritance
  });
});
