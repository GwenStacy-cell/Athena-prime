import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");
let match = js.match(/const menuOptions = (\[[\s\S]*?\]);/);
if (match) console.log(match[1]);
