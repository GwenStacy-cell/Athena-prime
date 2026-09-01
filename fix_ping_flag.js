import fs from "fs";
let code = fs.readFileSync("src/commands/utility.js", "utf8");

code = code.replaceAll("flags: 16384", "flags: MessageFlags.IsComponentsV2");

fs.writeFileSync("src/commands/utility.js", code);
