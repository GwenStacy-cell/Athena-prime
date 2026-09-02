import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

js = js.replace(/\\uD83D\\uDD34 /g, '');

fs.writeFileSync("src/commands/ytstats.js", js);
