import fs from 'fs';
let code = fs.readFileSync('src/events/interactionCreate.js', 'utf8');

const regexManage = /if \(interaction\.customId\.startsWith\('gw_manage_'\)\) \{[\s\S]*?return interaction\.showModal\(modal\);\n\s*\}/m;

const replacementManage = `if (interaction.customId.startsWith('gw_manage_')) {
          const allGw = db.getActiveGiveaways() || [];
          const guildGw = allGw.filter(g => g.guildId === interaction.guild.id);
          
          if (guildGw.length === 0) {
            return interaction.reply({ content: 'There are no active or ended giveaways stored in this server.', ephemeral: true });
          }

          // Discord Select Menu allows max 25 options
          const recentGw = guildGw.slice(-25).reverse();

          const options = recentGw.map(gw => {
            return {
              label: gw.prize.length > 50 ? gw.prize.substring(0, 47) + '...' : gw.prize,
              description: \`\${gw.ended ? 'Ended' : 'Active'} | \${gw.participants?.length || 0} Entries\`,
              value: gw.messageId
            };
          });

          const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('gw_manage_select')
              .setPlaceholder('Select a giveaway to manage...')
              .addOptions(options)
          );

          return interaction.reply({ content: 'Select a giveaway from the list below:', components: [selectRow], ephemeral: true });
        }
        
        if (interaction.isStringSelectMenu() && interaction.customId === 'gw_manage_select') {
          const targetMsgId = interaction.values[0];
          const gwData = db.getGiveaway(targetMsgId);
          
          if (!gwData) {
            return interaction.update({ content: 'Giveaway no longer exists in database.', components: [] });
          }

          const embed = new EmbedBuilder()
            .setTitle('Manage Giveaway')
            .setDescription(\`Prize: **\${gwData.prize}**\\nStatus: **\${gwData.ended ? 'Ended' : 'Active'}**\\nEntries: **\${(gwData.participants || []).length}**\`)
            .setColor('#5865F2');

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(\`gw_end_\${targetMsgId}\`).setLabel('End Giveaway').setStyle(ButtonStyle.Danger).setDisabled(gwData.ended),
            new ButtonBuilder().setCustomId(\`gw_reroll_\${targetMsgId}\`).setLabel('Reroll Winner').setStyle(ButtonStyle.Secondary).setDisabled(!gwData.ended)
          );

          return interaction.update({ content: '', embeds: [embed], components: [row] });
        }`;

code = code.replace(regexManage, replacementManage);

// Remove the old modal handler since we are replacing it
const regexModalHandler = /if \(interaction\.customId\.startsWith\('gw_manage_modal_'\)\) \{[\s\S]*?ephemeral: true \}\);\n\s*\}/m;
code = code.replace(regexModalHandler, "");

fs.writeFileSync('src/events/interactionCreate.js', code);
console.log("Replaced modal with dropdown!");
