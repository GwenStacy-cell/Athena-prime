import fs from "fs";
let js = fs.readFileSync("src/commands/ytstats.js", "utf8");

// Add the Auto-Setup button to row1
js = js.replace(
  "new ButtonBuilder().setCustomId('ytstats_bind').setLabel('Bind YouTube VC').setStyle(ButtonStyle.Primary),",
  "new ButtonBuilder().setCustomId('ytstats_bind').setLabel('Bind Existing VC').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId('ytstats_auto').setLabel('Auto-Setup Channels').setStyle(ButtonStyle.Primary),"
);

// Add the Auto-Setup modal handler
const oldModalHandler = `  if (interaction.customId === 'ytstats_bind') {`;
const newModalHandler = `  if (interaction.customId === 'ytstats_auto') {
    const modal = new ModalBuilder().setCustomId('ytstats_auto_modal').setTitle('Auto-Setup YT Channels');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('yt_handle')
          .setLabel('YouTube Handle')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('@MrBeast')
      )
    );
    return interaction.showModal(modal);
  }

  if (interaction.customId === 'ytstats_bind') {`;
js = js.replace(oldModalHandler, newModalHandler);

fs.writeFileSync("src/commands/ytstats.js", js);
