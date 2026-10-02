import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import { MessageFlags } from 'discord.js';
import cv2 from '../cv2.js';
import db from '../database.js';

const STAR = '<:1z:1517089474369032253>';

function makeStars(n) {
  return STAR.repeat(n);
}

export function buildRateContainer(authorName, authorId, avgRating, totalVotes, latestRatings, mediaUrl, accentColor) {
  // Parse accent color to integer — same way cv2 does it
  const accentInt = accentColor
    ? parseInt(accentColor.replace('#', ''), 16)
    : 0x5865F2;

  const container = {
    type: 17,
    accent_color: accentInt,
    spoiler: false,
    components: [
      {
        type: 10,
        content: `## **${authorName}'s Edit**`
      },
      { type: 14, divider: true },
      {
        type: 12,
        items: [{ media: { url: mediaUrl } }]
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: `${STAR} **Current Rating**\n**${avgRating}/5** (${totalVotes} vote${totalVotes !== 1 ? 's' : ''})\n\n**User Ratings**\n${latestRatings || '_No ratings yet_'}`
      },
      { type: 14, divider: true },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'rate_edit_1', label: '1', emoji: { id: '1517089474369032253' }, style: 2 },
          { type: 2, custom_id: 'rate_edit_2', label: '2', emoji: { id: '1517089474369032253' }, style: 2 },
          { type: 2, custom_id: 'rate_edit_3', label: '3', emoji: { id: '1517089474369032253' }, style: 2 },
          { type: 2, custom_id: 'rate_edit_4', label: '4', emoji: { id: '1517089474369032253' }, style: 2 },
          { type: 2, custom_id: 'rate_edit_5', label: '5', emoji: { id: '1517089474369032253' }, style: 2 },
        ]
      },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'rate_edit_delete', label: 'Remove', style: 4 }
        ]
      },
      { type: 14, divider: true },
      { type: 10, content: `-# **Athena Bulletproof Security System · V1.0.0**` }
    ]
  };

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
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
  const authorId = message.author.id;
  const accentColor = guildConfig?.accentColor || null;

  const payload = buildRateContainer(authorName, authorId, '0.0', 0, null, mediaUrl, accentColor);

  try {
    const sentMessage = await message.reply(payload);

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

export { makeStars };
