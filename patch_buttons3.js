import fs from "fs";
let sec = fs.readFileSync("src/commands/security.js", "utf8");

const startStr = "const row2 = new ActionRowBuilder().addComponents(\n      new ButtonBuilder().setCustomId('am_tgl_fonts')";
const endStr = "panelContainer.addActionRowComponents(row1, row2, row3, row4, row5);";

const startIdx = sec.indexOf(startStr);
const endIdx = sec.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const newRows = `const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('am_tgl_fonts').setLabel('Big Fonts').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_hiddenurl').setLabel('Hidden URLs').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_filecheck').setLabel('File Check').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_selfbot').setLabel('Selfbot Detection').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_global_links').setLabel('Allow ALL Links').setStyle(ButtonStyle.Secondary)
    );
  
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('am_tgl_global_invites').setLabel('Global Invites').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_channel_configs').setLabel('\u2699\ufe0f Configure Channels').setStyle(ButtonStyle.Primary)
    );

    const row4 = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('am_select_granular_role')
        .setPlaceholder('Select Target Role to Configure Bypasses...')
        .setMinValues(1)
        .setMaxValues(1)
    );
  
    panelContainer.addActionRowComponents(row1, row2, row3, row4);`;

    sec = sec.substring(0, startIdx) + newRows + sec.substring(endIdx + endStr.length);
    fs.writeFileSync("src/commands/security.js", sec);
    console.log("Success");
} else {
    console.log("Failed: " + startIdx + ", " + endIdx);
}
