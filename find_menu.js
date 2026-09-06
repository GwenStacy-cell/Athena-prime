import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");
let match = js.match(/function buildHelpContainer[\s\S]*?rawComponents\.push\(\{ type: 1, components:/);
if (match) console.log(js.slice(match.index, match.index + 2000));
