import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(
    "new ButtonBuilder().setCustomId(`bp_all_${roleId}`).setLabel('Bypass All').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId(`bp_reset_${roleId}`).setLabel('Reset All').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId(`bp_back`).setLabel('Back to Overview').setStyle(ButtonStyle.Secondary)",
    "new ButtonBuilder().setCustomId(`bp_all_${roleId}`).setLabel('Bypass All').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId(`bp_reset_${roleId}`).setLabel('Reset All').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId(`bp_back`).setLabel('Back to Overview').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId(`bp_save_${roleId}`).setLabel('Save').setStyle(ButtonStyle.Success)"
);

fs.writeFileSync("src/commands/security.js", text);
