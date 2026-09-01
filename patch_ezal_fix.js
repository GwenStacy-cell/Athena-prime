import fs from "fs";
let js = fs.readFileSync("src/commands/ezal.js", "utf8");
js = js.replace(/newPanel\.content = ''<:off:1533844858983157851> Failed\/Skipped \(No JTC Setup\): \\`\$\{failCount\}\\` servers\.'\);/g, 
"await sent.edit(`<:ticks:1533860039213842565> **Global JTC Sync Complete!**\\nUpdated \\`${successCount}\\` panels.\\n<:off:1533844858983157851> Failed/Skipped (No JTC Setup): \\`${failCount}\\` servers.`);");
fs.writeFileSync("src/commands/ezal.js", js);
