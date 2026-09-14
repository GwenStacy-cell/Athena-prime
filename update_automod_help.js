import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const oldStr = "\"`!automod config` - Open Interactive Automod configuration `[extra owners]`\",\"`!automod advanced` - Global link & invite toggles `[extra owners]`\",\"`!automod bypass add @role` - Bypass specific modules `[extra owners]`\",\"`!automod bypass list` - View bypassed roles `[extra owners]`\",";

const newStr = "\"`!automod [config|advanced|bypass]` - Central dashboard for all Automod filters, global toggles, and role bypasses `[extra owners]`\",";

js = js.replace(oldStr, newStr);
fs.writeFileSync("src/commands/utility.js", js);
console.log("Replaced!");
