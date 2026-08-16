import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import cv2 from '../cv2.js';
import db from '../database.js';


export const commands = [
  {
    name: 'rate',
    slashHidden: true,
    description: 'Post an edit to be rated, or set the designated rating channel (Admin only).',
    aliases: ['edit'],
    executePrefix: async (message, args) => {
      // Admin Setup Check
      if (args.length > 0) {
        const channelMatch = args[0].match(/<#(\d+)>/);
        const isId = /^\d{17,19}$/.test(args[0]);
        
        if (channelMatch || isId) {
          if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply({ embeds: [cv2.danger('Permission Denied', 'You must be a Server Administrator to set the rating channel.')] });
          }
          const channelId = channelMatch ? channelMatch[1] : args[0];
          db.setRateChannel(message.guild.id, channelId);
          return message.reply({ embeds: [cv2.success('Channel Configured', `The designated edit rating channel is now <#${channelId}>.`)] });
        }
      }

      const configuredChannel = db.getRateChannel(message.guild.id);
      if (configuredChannel && message.channel.id !== configuredChannel) {
        return message.reply(`This command can only be used in <#${configuredChannel}>.`).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
      }

      // Extract Media URL
      let mediaUrl = null;
      if (message.attachments.size > 0) {
        mediaUrl = message.attachments.first().url;
      } else if (args.length > 0 && (args[0].startsWith('http://') || args[0].startsWith('https://'))) {
        mediaUrl = args[0];
      }

      if (!mediaUrl) {
        return message.reply('Please attach an image/video or provide a link to your edit!').then(m => setTimeout(() => m.delete().catch(() => null), 5000));
      }

      await createRateMessage(message, mediaUrl);
    }
  }
];

export async function createRateMessage(message, mediaUrl) {
  // Setup Base Embed
  const guildConfig = message.guild ? db.getGuildConfig(message.guild.id) : null;
  const rateEmbed = cv2.buildContainer({
    title: `Rate ${message.author.username}'s Edit`,
    description: `<a:1z:1517089474369032253> **Current Rating**\n0.0/5 (0 votes)\n\n**User Ratings**\n_No ratings yet_`,
    color: guildConfig?.accentColor || '#2b2d31'
  });

  const starEmoji = { id: '1517089474369032253' };

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rate_edit_1').setLabel('1').setEmoji(starEmoji).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_edit_2').setLabel('2').setEmoji(starEmoji).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_edit_3').setLabel('3').setEmoji(starEmoji).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_edit_4').setLabel('4').setEmoji(starEmoji).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_edit_5').setLabel('5').setEmoji(starEmoji).setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rate_edit_delete').setLabel('Remove').setStyle(ButtonStyle.Danger)
  );

  try {
    const sentMessage = await message.reply({ embeds: [rateEmbed], components: [row1, row2] });
    
    db.createEditRating(sentMessage.id, {
      authorId: message.author.id,
      authorName: message.author.username,
      mediaUrl: mediaUrl
    });

  } catch (err) {
    console.error('Failed to post edit rating:', err);
    message.reply('An error occurred while posting your edit.').catch(() => null);
  }
}
