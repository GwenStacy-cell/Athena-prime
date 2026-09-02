import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

// Add !calculator and !upload to the utilities commands list
const originalUtility = "`!setup` - Quick-bind log channel, quarantine VC and quarantine role `[extra owners]`', '`!dev` - View Lead Architect & Developer details `[public]`'] }";
const updatedUtility = "`!setup` - Quick-bind log channel, quarantine VC and quarantine role `[extra owners]`', '`!dev` - View Lead Architect & Developer details `[public]`', '`!calc` / `!calculator` - Launch an interactive CV2 calculator `[public]`', '`!upload` `\"name.exe\"` - Upload an executable file safely bypassing discord blocks `[public]`'] }";

js = js.replace(originalUtility, updatedUtility);

fs.writeFileSync("src/commands/utility.js", js);
