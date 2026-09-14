import fs from "fs";
let js = fs.readFileSync("src/commands/loader.js", "utf8");

// Add import
const importStr = "import { commands as shortcutsCmds } from './shortcuts.js';\n";
if (!js.includes(importStr)) {
    js = importStr + js;
}

// Add to allCommands array
if (!js.includes("...shortcutsCmds,")) {
    js = js.replace("uploadCmd,", "...shortcutsCmds,\n  uploadCmd,");
}

fs.writeFileSync("src/commands/loader.js", js);
console.log("Updated loader.js");
