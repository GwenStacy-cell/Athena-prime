import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import cv2 from '../cv2.js';
import db from '../database.js';

const STAR = '⭐'; // Standard star emoji based on user's screenshot

export function buildRateEmbed(authorName, avgRating, totalVotes, latestRatings, mediaUrl, accentColor) {
  const embed = new EmbedBuilder()
    .setTitle(`RATE ${authorName.toUpperCase()}'S EDIT`)
    .setDescription(`${STAR} **Current Rating**\n${avgRating}/5 (${totalVotes} vote${totalVotes !== 1 ? 's' : ''})\n\n**User Ratings**\n${latestRatings || '_No ratings yet_'}`)
    .setColor('#2b2d31')
    .setFooter({ text: 'Athena Prime Killer' })
    .setTimestamp();
    
  if (mediaUrl) {
    embed.setImage(mediaUrl);
  }
  
  return embed;
}

export function makeRateComponents() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rate_edit_1').setLabel('1').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_edit_2').setLabel('2').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_edit_3').setLabel('3').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_edit_4').setLabel('4').setEmoji('⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('rate_edit_5').setLabel('5').setEmoji('⭐').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rate_edit_delete').setLabel('Remove').setStyle(ButtonStyle.Danger)
  );
  
  return [row1, row2];
}

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
            return message.reply(cv2.danger('Permission Denied', 'You must be a Server Administrator to set the rating channel.'));
          }
          const channelId = channelMatch ? channelMatch[1] : args[0];
          db.setRateChannel(message.guild.id, channelId);
          return message.reply(cv2.success('Channel Configured', `The designated edit rating channel is now <#${channelId}>.`));
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
  const guildConfig = message.guild ? db.getGuildConfig(message.guild.id) : null;
  const authorName = message.author.globalName || message.author.username;
  const accentColor = guildConfig?.accentColor || null;

  const embed = buildRateEmbed(authorName, '0.0', 0, null, mediaUrl, accentColor);
  const components = makeRateComponents();

  try {
    const sentMessage = await message.reply({ embeds: [embed], components });

    db.createEditRating(sentMessage.id, {
      authorId: message.author.id,
      authorName: authorName,
      mediaUrl: mediaUrl
    });
  } catch (err) {
    console.error('Failed to post edit rating:', err);
    message.reply('An error occurred while posting your edit.').catch(() => null);
  }
}
