import fs from "fs";
let js = fs.readFileSync("src/utils/voice.js", "utf8");
js = js.replace(/<a:.*?:1451690277126275267>/g, "<a:\uD83E\uDD87:1451690277126275267>");
fs.writeFileSync("src/utils/voice.js", js);
