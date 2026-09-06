import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");
let match = js.match(/function buildHelpContainer[\s\S]*?return \{/);
if (match) console.log(match[0]);
