import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");
let match = js.match(/const helpModules = \[[\s\S]*?\];/);
if (match) {
  let emojis = match[0].match(/<:[a-zA-Z0-9_]+:\d+>/g);
  console.log([...new Set(emojis)]);
}
