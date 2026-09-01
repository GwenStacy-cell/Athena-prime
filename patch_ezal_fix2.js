import fs from "fs";
let js = fs.readFileSync("src/commands/ezal.js", "utf8");
let lines = js.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("Failed/Skipped (No JTC Setup)")) {
    lines[i] = "              await sent.edit(`<:ticks:1533860039213842565> **Global JTC Sync Complete!**\\nUpdated \\`${successCount}\\` panels.\\n<:off:1533844858983157851> Failed/Skipped (No JTC Setup): \\`${failCount}\\` servers.`);";
  }
}
fs.writeFileSync("src/commands/ezal.js", lines.join("\n"));
