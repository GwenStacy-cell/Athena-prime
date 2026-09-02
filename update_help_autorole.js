import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const original = "`!autoreact` - Open the Auto-React Configuration Dashboard `[extra owners]`'] }";
const updated = "`!autoreact` - Open the Auto-React Configuration Dashboard `[extra owners]`', '`!autorole` - Open the AutoRole & Vanity Engine Dashboard `[extra owners]`'] }";

js = js.replace(original, updated);
fs.writeFileSync("src/commands/utility.js", js);
