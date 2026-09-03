import fs from "fs";
let js = fs.readFileSync("src/commands/tier.js", "utf8");

js = js.replace(/🛡️/g, "<:emoji_16:1521464002046328944>");

fs.writeFileSync("src/commands/tier.js", js);
