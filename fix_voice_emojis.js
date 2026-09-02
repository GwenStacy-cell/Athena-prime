import fs from "fs";
let js = fs.readFileSync("src/utils/voice.js", "utf8");

js = js.replace(/<a:a_fheartSpinWhite:1516523707181433109>/g, "<a:a_fheartSpinWhite:1533844790314143955>");
js = js.replace(/<:00XO:1516521724689256550>/g, "<a:ArrowHeart:1544688958196158525>");

fs.writeFileSync("src/utils/voice.js", js);
