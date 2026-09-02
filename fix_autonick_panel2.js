import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = `  const row = new ActionRowBuilder().addComponents(toggleBtn, editBtn, syncBtn);
  const row2 = new ActionRowBuilder().addComponents(restoreBtn);
  return { embeds: [dashboardEmbed], components: [row, row2] };`;

const newCode = `  const row = new ActionRowBuilder().addComponents(toggleBtn, editBtn, syncBtn);
  const row2 = new ActionRowBuilder().addComponents(restoreBtn);
  dashboardEmbed.components.push(row);
  dashboardEmbed.components.push(row2);
  return dashboardEmbed;`;

js = js.replace(oldCode, newCode);
fs.writeFileSync("src/commands/security.js", js);
