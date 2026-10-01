module.exports={
  content:{relative:true,files:["./*.html"]},
  darkMode:"class",
  theme:{
    extend:{
      colors:{
        emerald:{50:"#ecfdf5",100:"#d1fae5",500:"#10b981",600:"#059669",700:"#047857",800:"#065f46",850:"#064e3b",900:"#022c22",950:"#011c16"},
        gold:{300:"#fde047",400:"#facc15",500:"#eab308",600:"#ca8a04",700:"#a16207"}
      },
      fontFamily:{
        cairo:["Cairo","sans-serif"],
        amiri:["Amiri","serif"],
        quran:["Scheherazade New","Amiri","serif"],
        ruqaa:["Aref Ruqaa","Amiri","serif"]
      }
    }
  },
  safelist:[
    {pattern:/^(?:bg|text|border)-(?:slate|emerald|gold)-(?:50|100|200|300|400|500|600|700|800|850|900|950)(?:\/(?:10|20|30|40|50|60|70|80|90))?$/,variants:["hover","focus","active"]}
  ]
};