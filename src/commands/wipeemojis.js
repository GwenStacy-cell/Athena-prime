import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import cv2 from '../cv2.js';
import { isBotOwnerSync, isExtraOwner } from '../utils/helpers.js';

export const commands = [
  {
    name: 'wipeemojis',
    description: 'Delete all custom emojis from this server',
    category: 'moderation',
    async executePrefix(message, args) {
      if (message.author.id !== message.guild.ownerId && !isBotOwnerSync(message.author.id) && !isExtraOwner(message.guild.id, message.author.id)) {
        return message.reply(cv2.danger('Access Denied', 'You do not have permission to use this command.'));
      }

      if (message.guild.emojis.cache.size === 0) {
        return message.reply(cv2.warn('No Emojis', 'There are no custom emojis to delete in this server.'));
      }

      const confirmBtn = new ButtonBuilder().setCustomId('confirm_wipe_emojis').setLabel('CONFIRM WIPE').setStyle(ButtonStyle.Danger).setEmoji('1523766340752642109');
      const cancelBtn = new ButtonBuilder().setCustomId('cancel_wipe_emojis').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('1533860128015519895');
      const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

      const msg = await message.reply({ 
        content: `**WARNING:** Are you sure you want to permanently delete ALL \`${message.guild.emojis.cache.size}\` custom emojis in this server? This action **cannot be undone**.`,
        components: [row]
      });

      const collector = msg.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async i => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: 'You cannot use this button.', flags: 64 });
        }

        if (i.customId === 'cancel_wipe_emojis') {
          collector.stop('cancelled');
          return i.update({ content: 'Operation cancelled.', components: [] });
        }

        if (i.customId === 'confirm_wipe_emojis') {
          collector.stop('confirmed');
          await i.update({ content: 'Deleting all emojis... this may take a moment depending on rate limits.', components: [] });

          let deleted = 0;
          const emojis = Array.from(message.guild.emojis.cache.values());
          
          for (const emoji of emojis) {
            try {
              await emoji.delete();
              deleted++;
            } catch (err) {
              console.error(`Failed to delete emoji ${emoji.name}:`, err);
            }
          }

          await msg.edit(cv2.success('Emojis Wiped', `Successfully deleted **${deleted}** emojis from the server.`));
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          msg.edit({ content: 'Operation timed out.', components: [] }).catch(()=>{});
        }
      });
    }
  }
];
