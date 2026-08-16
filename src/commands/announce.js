import { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import cv2 from '../cv2.js';
import { setGuildContext } from '../embed.js';
import db from '../database.js';

export const commands = [
  {
    name: 'announce',
    description: 'Launch the Interactive Announcement Builder UI.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageMessages],
    options: [],
    async executePrefix(message, args) {
      if (message.guild) setGuildContext(message.guild.id);
      
      const config = db.getGuildConfig(message.guild.id);
      const color = config.accentColor || '#5865F2';
      
      const previewEmbed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: 'Announcement Builder' })
        .setTitle('New Announcement')
        .setDescription('Click the buttons below to edit this announcement. You can seamlessly add links, images, and multiple lines of text!')
        .setThumbnail(message.guild.members.me.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: 'Target Channel: Not Set' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ann_edit_text')
          .setLabel('Edit Content')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ann_edit_media')
          .setLabel('Edit Media')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('ann_edit_channel')
          .setLabel('Set Channel')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('ann_publish')
          .setLabel('Publish')
          .setStyle(ButtonStyle.Success)
      );

      await message.channel.send({ embeds: [previewEmbed], components: [row] });
      // Delete the trigger message to keep chat clean
      await message.delete().catch(() => null);
    },
    async executeSlash(interaction) {
      if (interaction.guild) setGuildContext(interaction.guild.id);

      const config = db.getGuildConfig(interaction.guild.id);
      const color = config.accentColor || '#5865F2';

      const previewEmbed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: 'Announcement Builder' })
        .setTitle('New Announcement')
        .setDescription('Click the buttons below to edit this announcement. You can seamlessly add links, images, and multiple lines of text!')
        .setThumbnail(interaction.guild.members.me.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: 'Target Channel: Not Set' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ann_edit_text')
          .setLabel('Edit Content')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ann_edit_media')
          .setLabel('Edit Media')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('ann_edit_channel')
          .setLabel('Set Channel')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('ann_publish')
          .setLabel('Publish')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ embeds: [previewEmbed], components: [row] });
    }
  }
];
