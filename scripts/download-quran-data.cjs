const fs=require("node:fs");
const path=require("node:path");

const ENDPOINT="https://api.alquran.cloud/v1/quran/quran-uthmani";
const EXPECTED_SURAHS=114;
const EXPECTED_AYAHS=6236;
const output=path.resolve(__dirname,"../vendor/quran-arabic.json");

async function main(){
  const response=await fetch(ENDPOINT,{signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error(`Quran source returned HTTP ${response.status}`);
  const payload=await response.json();
  const source=payload?.data;
  if(payload?.code!==200||!Array.isArray(source?.surahs)||source.surahs.length!==EXPECTED_SURAHS) throw new Error("Unexpected Quran source structure");

  let globalNumber=1;
  const surahs=source.surahs.map((surah,surahIndex)=>{
    if(surah.number!==surahIndex+1||!Array.isArray(surah.ayahs)||surah.ayahs.length===0) throw new Error(`Invalid surah structure at ${surahIndex+1}`);
    const ayahs=surah.ayahs.map((ayah,ayahIndex)=>{
      if(ayah.numberInSurah!==ayahIndex+1||ayah.number!==globalNumber||typeof ayah.text!=="string"||!ayah.text.trim()||!Number.isInteger(ayah.juz)||!Number.isInteger(ayah.page)) throw new Error(`Invalid ayah ${surah.number}:${ayahIndex+1}`);
      globalNumber++;
      return {n:ayah.numberInSurah,text:ayah.text,global:ayah.number,juz:ayah.juz,page:ayah.page,hizb:ayah.hizbQuarter};
    });
    return {number:surah.number,name:surah.name,englishName:surah.englishName,ayahCount:surah.ayahs.length,revelationType:surah.revelationType,ayahs};
  });
  if(globalNumber-1!==EXPECTED_AYAHS) throw new Error(`Expected ${EXPECTED_AYAHS} ayahs, received ${globalNumber-1}`);

  const data={
    source:{name:"AlQuran.cloud API",endpoint:ENDPOINT,edition:source.edition.identifier,license:"Arabic Quran text for non-commercial reproduction; source attribution retained.",retrievedAt:new Date().toISOString().slice(0,10)},
    surahs
  };
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(data));
  console.log(`Saved ${surahs.length} surahs and ${globalNumber-1} ayahs to ${path.relative(process.cwd(),output)}.`);
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
