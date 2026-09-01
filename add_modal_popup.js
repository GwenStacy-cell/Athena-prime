import fs from "fs";

let text = fs.readFileSync("src/events/interactionCreate.js", "utf8");

text = text.replace(
    "else if (customId === 'am_select_honeypot_channel') {\n        db.updateGuildConfig(guild.id, { honeypotChannelId: interaction.values[0] });\n        updated = true;\n      }",
    `else if (customId === 'am_select_honeypot_channel') {
        const channelId = interaction.values[0];
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const modal = new ModalBuilder()
          .setCustomId(\`modal_honeypot_\${channelId}\`)
          .setTitle('Honeypot Trap Setup');
          
        const bannerInput = new TextInputBuilder()
          .setCustomId('banner_url')
          .setLabel('Banner Image URL (Optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('https://example.com/banner.png');
          
        modal.addComponents(new ActionRowBuilder().addComponents(bannerInput));
        return interaction.showModal(modal);
      }`
);

fs.writeFileSync("src/events/interactionCreate.js", text);
