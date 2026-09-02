import fs from "fs";
let js = fs.readFileSync("src/utils/voice.js", "utf8");
js = js.replace(/<a:thunder:1516523058742169674>/g, "<a:thunder:1533844816557768764>");
js = js.replace(/<a:bat1:1516523055642579016>/g, "<a:bat1:1451690277126275267>");
fs.writeFileSync("src/utils/voice.js", js);
