import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

const regex = /if \(interaction\.customId === 'ytstats_refresh'\) \{[\s\S]*?catch \(e\) \{[\s\S]*?\}[\s\S]*?\}/;
js = js.replace(regex, "");

fs.writeFileSync("src/commands/ytstats.js", js);
