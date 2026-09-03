import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const oldStr = "`!upload` `\"name.exe\"` - Upload an executable file safely bypassing discord blocks `[public]`'] }";
const newStr = "`!upload` `\"name.exe\"` - Upload an executable file safely bypassing discord blocks `[public]`', '`!quote` `<msg_id|@user>` `[theme]` - Generate an aesthetic canvas quote `[public]`', '`!quotemaker` - Interactive canvas quote generator `[public]`'] }";

js = js.replace(oldStr, newStr);

fs.writeFileSync("src/commands/utility.js", js);
