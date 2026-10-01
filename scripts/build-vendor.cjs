const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const modules=path.join(root,"node_modules");
const vendor=path.join(root,"vendor");
const fontSpecs={
  cairo:["300","400","600","700","800","900"],
  amiri:["400","400-italic","700"],
  "scheherazade-new":["400","700"],
  "aref-ruqaa":["400","700"],
  "reem-kufi":["400","700"]
};

function copy(source,destination){
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.copyFileSync(source,destination);
}

for(const [family,weights] of Object.entries(fontSpecs)){
  const packageRoot=path.join(modules,"@fontsource",family);
  for(const weight of weights){
    const stylesheet=`arabic-${weight}.css`;
    const sourceCss=path.join(packageRoot,stylesheet);
    copy(sourceCss,path.join(vendor,"fonts",family,stylesheet));
    const css=fs.readFileSync(sourceCss,"utf8");
    for(const match of css.matchAll(/url\(\.\/files\/([^\)]+)\)/g)){
      const file=match[1];
      copy(path.join(packageRoot,"files",file),path.join(vendor,"fonts",family,"files",file));
    }
  }
}

const fontAwesome=path.join(modules,"@fortawesome","fontawesome-free");
copy(path.join(fontAwesome,"css","all.min.css"),path.join(vendor,"fontawesome","css","all.min.css"));
fs.cpSync(path.join(fontAwesome,"webfonts"),path.join(vendor,"fontawesome","webfonts"),{recursive:true});
copy(path.join(modules,"html2canvas","dist","html2canvas.min.js"),path.join(vendor,"html2canvas.min.js"));

console.log("Built local vendor assets in vendor/.");