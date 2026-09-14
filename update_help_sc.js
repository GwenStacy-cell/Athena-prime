import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const oldStr = "commands: [\"`!afk [reason]` - Set AFK status `[public]`\", \"`/bump` - Set bump reminder `[public]`\", \"`!avatar / !banner [@user]` - View avatars `[public]`\", \"`!status` - Security health overview `[public]`\"";
const newStr = "commands: [\"`!shortcuts enable|disable` - View and manage pre-added shortcuts `[admin]`\", \"`!afk [reason]` - Set AFK status `[public]`\", \"`/bump` - Set bump reminder `[public]`\", \"`!avatar / !banner [@user]` - View avatars `[public]`\", \"`!status` - Security health overview `[public]`\"";

js = js.replace(oldStr, newStr);
fs.writeFileSync("src/commands/utility.js", js);
console.log("Updated utility.js help menu");
