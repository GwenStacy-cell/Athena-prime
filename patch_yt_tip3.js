import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

js = js.replace("layout!Subs: {count}\\`).`", "layout!`");

fs.writeFileSync("src/commands/ytstats.js", js);
