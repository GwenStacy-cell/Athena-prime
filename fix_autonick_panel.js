import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");
js = js.replace(/const row = new ActionRowBuilder\(\)\.addComponents\(toggleBtn, editBtn, syncBtn\);\n    const row2 = new ActionRowBuilder\(\)\.addComponents\(restoreBtn\);\n    return \{ embeds: \[dashboardEmbed\], components: \[row, row2\] \};/m, 
`  const row = new ActionRowBuilder().addComponents(toggleBtn, editBtn, syncBtn);
  const row2 = new ActionRowBuilder().addComponents(restoreBtn);
  dashboardEmbed.components.push(row);
  dashboardEmbed.components.push(row2);
  return dashboardEmbed;`);
fs.writeFileSync("src/commands/security.js", js);
