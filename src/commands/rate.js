import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import embed from '../embed.js';
import db from '../database.js';

// REPLACE THIS ID WITH YOUR SPECIFIC RATING CHANNEL ID
export const ALLOWED_CHANNEL_ID = 'YOUR_CHANNEL_ID_HERE'; 

export const commands = [
  {
    name: 'rate',
    description: 'Post an edit for others to rate from 1 to 5 stars.',
    aliases: ['edit'],
    executePrefix: async (message, args) => {
      // Channel Check
      if (message.channel.id !== ALLOWED_CHANNEL_ID && ALLOWED_CHANNEL_ID !== 'YOUR_CHANNEL_ID_HERE') {
        return message.reply(`This command can only be used in <#${ALLOWED_CHANNEL_ID}>.`).then(m => setTimeout(() => m.delete().catch(() => null), 5000));
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
  const rateEmbed = embed.build({
    title: `Rate ${message.author.username}'s Edit`,
    description: `<a:1z:1517089474369032253> **Current Rating**\n0.0/5 (0 votes)\n\n**Media**\n[Click to view](${mediaUrl})\n\n**User Ratings**\n_No ratings yet_`,
    color: '#2b2d31'
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
    const sentMessage = await message.channel.send({ content: `Submitted by ${message.author}`, embeds: [rateEmbed], components: [row1, row2] });
    
    db.createEditRating(sentMessage.id, {
      authorId: message.author.id,
      authorName: message.author.username,
      mediaUrl: mediaUrl
    });

    await message.delete().catch(() => null);

  } catch (err) {
    console.error('Failed to post edit rating:', err);
    message.reply('An error occurred while posting your edit.').catch(() => null);
  }
}
