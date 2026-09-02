import fs from "fs";
let lines = fs.readFileSync("src/commands/security.js", "utf8").split(/\r?\n/);
let startIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("return { embeds: [dashboardEmbed], components: [row, row2] };")) {
    startIndex = i;
    break;
  }
}

if (startIndex !== -1) {
  lines.splice(startIndex, 1, 
    "  dashboardEmbed.components.push(row);",
    "  dashboardEmbed.components.push(row2);",
    "  return dashboardEmbed;"
  );
  fs.writeFileSync("src/commands/security.js", lines.join("\n"));
}
