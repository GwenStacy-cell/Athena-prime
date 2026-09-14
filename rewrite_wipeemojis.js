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

      const container = cv2.buildContainer(
        'Emoji Wipe Sequence', 
        `**WARNING:** Are you sure you want to permanently delete ALL \`${message.guild.emojis.cache.size}\` custom emojis in this server? This action **cannot be undone**.`
      );

      const confirmBtn = new ButtonBuilder().setCustomId('confirm_wipe_emojis').setLabel('Confirm Wipe').setStyle(ButtonStyle.Secondary);
      const cancelBtn = new ButtonBuilder().setCustomId('cancel_wipe_emojis').setLabel('Cancel').setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

      const msg = await message.reply({ 
        components: [container, row],
        flags: MessageFlags.IsComponentsV2
      });

      const collector = msg.createMessageComponentCollector({ time: 30000 });

      collector.on('collect', async i => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: 'You cannot use this button.', flags: 64 }).catch(()=>{});
        }

        if (i.customId === 'cancel_wipe_emojis') {
          collector.stop('cancelled');
          const cancelContainer = cv2.buildContainer('Emoji Wipe Sequence', 'Operation cancelled by user.');
          return i.update({ components: [cancelContainer], flags: MessageFlags.IsComponentsV2 }).catch(()=>{});
        }

        if (i.customId === 'confirm_wipe_emojis') {
          collector.stop('confirmed');
          
          let deleted = 0;
          const emojis = Array.from(message.guild.emojis.cache.values());
          const total = emojis.length;
          const loadingEmoji = "<a:loading:1542155051286396938>";

          const buildProgressContainer = () => cv2.buildContainer(
            'Emoji Wipe Sequence', 
            `${loadingEmoji} **Deleting Emojis:** \`${deleted} / ${total}\`\n-# Please wait, this may take a moment depending on Discord rate limits.`
          );

          await i.update({ components: [buildProgressContainer()], flags: MessageFlags.IsComponentsV2 }).catch(()=>{});

          for (let idx = 0; idx < emojis.length; idx++) {
            try {
              await emojis[idx].delete();
              deleted++;
            } catch (err) {
              console.error(`Failed to delete emoji ${emojis[idx].name}:`, err);
            }

            // Update UI every 5 deletions to prevent Discord edit rate limits (5 per 5 seconds)
            if (deleted % 5 === 0 && deleted !== total) {
              await msg.edit({ components: [buildProgressContainer()], flags: MessageFlags.IsComponentsV2 }).catch(()=>{});
            }
          }

          const successEmoji = "<:emoji_16:1533860111704002665>";
          const finalContainer = cv2.buildContainer('Emoji Wipe Sequence', `${successEmoji} Successfully deleted **${deleted}** emojis from the server.`);
          await msg.edit({ components: [finalContainer], flags: MessageFlags.IsComponentsV2 }).catch(()=>{});
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          const timeoutContainer = cv2.buildContainer('Emoji Wipe Sequence', 'Operation timed out.');
          msg.edit({ components: [timeoutContainer], flags: MessageFlags.IsComponentsV2 }).catch(()=>{});
        }
      });
    }
  }
];
