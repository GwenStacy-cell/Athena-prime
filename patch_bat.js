import fs from "fs";
let js = fs.readFileSync("src/utils/voice.js", "utf8");
js = js.replace(/<a:bat1:1451690277126275267>/g, "<a:bat:1451690277126275267>");
fs.writeFileSync("src/utils/voice.js", js);
