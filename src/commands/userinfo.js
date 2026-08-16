import { EmbedBuilder } from 'discord.js';
import cv2 from '../cv2.js';

export const commands = [
  {
    name: 'avatar',
    slashHidden: true,
    description: 'Displays the global and server avatar of a user.',
    category: 'utility',
    options: [
      {
        name: 'user',
        description: 'The user to get the avatar of',
        type: 6, // USER
        required: false
      }
    ],
    async executePrefix(message) {
      const target = message.mentions.users.first() || message.author;
      const member = message.guild.members.cache.get(target.id);
      await sendAvatar(message, target, member);
    },
    async executeSlash(interaction) {
      const target = interaction.options.getUser('user') || interaction.user;
      const member = interaction.guild.members.cache.get(target.id);
      await sendAvatar(interaction, target, member);
    }
  },
  {
    name: 'banner',
    .setImage(bannerUrl)
    .setFooter({ text: `Requested by ${context.author ? context.author.tag : context.user.tag}` });

  if (context.reply) {
    await context.reply({ embeds: [e] });
  }
}
