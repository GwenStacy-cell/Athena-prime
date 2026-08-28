import fs from 'fs';
let code = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

// Add gw_manage_, gw_end_, gw_reroll_ to the main handler condition
code = code.replace(
  "if (interaction.customId.startsWith('gw_mode_') || interaction.customId.startsWith('gw_setup_') || interaction.customId.startsWith('gw_start_') || interaction.customId === 'gw_join') {",
  "if (interaction.customId.startsWith('gw_mode_') || interaction.customId.startsWith('gw_setup_') || interaction.customId.startsWith('gw_start_') || interaction.customId.startsWith('gw_manage_') || interaction.customId.startsWith('gw_end_') || interaction.customId.startsWith('gw_reroll_') || interaction.customId === 'gw_join') {"
);

// Add the gw_manage_ logic inside the block before gw_mode_
const gwManageLogic = `
        if (interaction.customId.startsWith('gw_manage_')) {
          const modal = new ModalBuilder()
            .setCustomId(\`gw_manage_modal_\${managerId}\`)
            .setTitle('Manage Giveaway');

          const msgInput = new TextInputBuilder()
            .setCustomId('message_id')
            .setLabel('Giveaway Message ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(msgInput));
          return interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('gw_end_')) {
          const { endGiveaway } = await import('../commands/giveaway.js');
          const targetMsgId = interaction.customId.replace('gw_end_', '');
          const gwData = db.getGiveaway(targetMsgId);
          if (!gwData || gwData.ended) return interaction.reply({ content: 'Giveaway not found or already ended.', ephemeral: true });
          
          await interaction.reply({ content: 'Ending giveaway...', ephemeral: true });
          await endGiveaway(interaction.client, targetMsgId, gwData);
          return interaction.editReply({ content: 'Giveaway ended successfully!' });
        }

        if (interaction.customId.startsWith('gw_reroll_')) {
          const targetMsgId = interaction.customId.replace('gw_reroll_', '');
          const gwData = db.getGiveaway(targetMsgId);
          if (!gwData || !gwData.ended) return interaction.reply({ content: 'Giveaway not found or is still active. End it first!', ephemeral: true });
          
          const participants = gwData.participants || [];
          if (participants.length === 0) return interaction.reply({ content: 'Nobody entered this giveaway.', ephemeral: true });
          
          const newWinnerId = participants[Math.floor(Math.random() * participants.length)];
          const EMOJI_WINNER = '<a:giveaway:1533844904604864603>';
          
          // Reply publicly in the channel instead of ephemeral
          return interaction.channel.send({ content: \`Rerolled the giveaway! The new winner is <@\${newWinnerId}>! \${EMOJI_WINNER}\` });
        }
`;

code = code.replace(
  "if (interaction.isStringSelectMenu() && interaction.customId.startsWith('gw_mode_')) {",
  gwManageLogic + "\n        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('gw_mode_')) {"
);

// Add the modal handler
const modalLogic = `
      if (interaction.customId.startsWith('gw_manage_modal_')) {
        const targetMsgId = interaction.fields.getTextInputValue('message_id');
        const gwData = db.getGiveaway(targetMsgId);
        
        if (!gwData) {
          return interaction.reply({ content: 'No giveaway found in database with that Message ID.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
          .setTitle('Manage Giveaway')
          .setDescription(\`Prize: **\${gwData.prize}**\\nStatus: **\${gwData.ended ? 'Ended' : 'Active'}**\\nEntries: **\${(gwData.participants || []).length}**\`)
          .setColor('#5865F2');

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(\`gw_end_\${targetMsgId}\`).setLabel('End Giveaway').setStyle(ButtonStyle.Danger).setDisabled(gwData.ended),
          new ButtonBuilder().setCustomId(\`gw_reroll_\${targetMsgId}\`).setLabel('Reroll Winner').setStyle(ButtonStyle.Secondary).setDisabled(!gwData.ended)
        );

        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }
`;

code = code.replace(
  "if (interaction.customId.startsWith('gw_setup_modal_')) {",
  modalLogic + "\n      if (interaction.customId.startsWith('gw_setup_modal_')) {"
);

fs.writeFileSync('src/events/interactionCreate.js', code);
console.log("Injected manage logic successfully!");
