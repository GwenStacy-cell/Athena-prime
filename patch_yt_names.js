import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

js = js.replace(/🔴 Subs: /g, 'Subs: ');
js = js.replace(/🎬 Videos: /g, 'Videos: ');
js = js.replace(/👀 Views: /g, 'Views: ');

fs.writeFileSync("src/commands/ytstats.js", js);
