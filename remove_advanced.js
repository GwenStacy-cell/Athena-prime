import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const oldStr = "\"`!automod config` - Open Interactive Automod configuration `[extra owners]`\",\"`!automod advanced` - Global link & invite toggles `[extra owners]`\",";
const newStr = "\"`!automod config` - Open Interactive Automod configuration `[extra owners]`\",";

js = js.replace(oldStr, newStr);
fs.writeFileSync("src/commands/utility.js", js);
console.log("Removed advanced!");
