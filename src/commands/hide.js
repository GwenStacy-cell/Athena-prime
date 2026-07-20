import { PermissionFlagsBits } from 'discord.js';
import embed from '../embed.js';
import { isAuthorized } from '../utils/helpers.js';

export const commands = [
  {
    name: 'hide',
    description: 'Hides a channel (or your current VC/text channel) from @everyone.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    options: [
      {
        name: 'channel',
        description: 'The channel to hide',
        type: 7, // CHANNEL
        required: false
      }
    ],
    async executePrefix(message, args) {
      if (!(await isAuthorized(message.author, message.guild))) {
        return message.reply({ embeds: [embed.error('Unauthorized', 'You do not have permission to use this command.')] });
      }

      let targetChannel = message.channel;
      
      if (args[0]) {
        const parsedId = args[0].replace(/<#|>/g, '');
        const found = await message.guild.channels.fetch(parsedId).catch(() => null);
        if (found) targetChannel = found;
        else return message.reply({ embeds: [embed.error('Error', 'Invalid channel provided.')] });
      } else if (message.member.voice.channel) {
        // Default to VC if they are in one and didn't specify a channel
        targetChannel = message.member.voice.channel;
      }

      try {
        await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, {
          ViewChannel: false
        });
        await message.reply({ embeds: [embed.success('Channel Hidden', `**${targetChannel.name}** is now hidden from @everyone.`)] });
      } catch (err) {
        await message.reply({ embeds: [embed.error('Error', 'Failed to hide the channel. Check my permissions.')] });
      }
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.error('Unauthorized', 'You do not have permission to use this command.')] });
      }

      let targetChannel = interaction.options.getChannel('channel') || (interaction.member.voice.channel ? interaction.member.voice.channel : interaction.channel);

      try {
        await targetChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          ViewChannel: false
        });
        await interaction.reply({ embeds: [embed.success('Channel Hidden', `**${targetChannel.name}** is now hidden from @everyone.`)] });
      } catch (err) {
        await interaction.reply({ embeds: [embed.error('Error', 'Failed to hide the channel. Check my permissions.')] });
      }
    }
  },
  {
    name: 'unhide',
    description: 'Unhides a channel (or your current VC/text channel) for @everyone.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageChannels],
    options: [
      {
        name: 'channel',
        description: 'The channel to unhide',
        type: 7,
        required: false
      }
    ],
    async executePrefix(message, args) {
      if (!(await isAuthorized(message.author, message.guild))) {
        return message.reply({ embeds: [embed.error('Unauthorized', 'You do not have permission to use this command.')] });
      }

      let targetChannel = message.channel;
      
      if (args[0]) {
        const parsedId = args[0].replace(/<#|>/g, '');
        const found = await message.guild.channels.fetch(parsedId).catch(() => null);
        if (found) targetChannel = found;
        else return message.reply({ embeds: [embed.error('Error', 'Invalid channel provided.')] });
      } else if (message.member.voice.channel) {
        targetChannel = message.member.voice.channel;
      }

      try {
        await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, {
          ViewChannel: null
        });
        await message.reply({ embeds: [embed.success('Channel Unhidden', `**${targetChannel.name}** is now visible to @everyone.`)] });
      } catch (err) {
        await message.reply({ embeds: [embed.error('Error', 'Failed to unhide the channel. Check my permissions.')] });
      }
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.error('Unauthorized', 'You do not have permission to use this command.')] });
      }

      let targetChannel = interaction.options.getChannel('channel') || (interaction.member.voice.channel ? interaction.member.voice.channel : interaction.channel);

      try {
        await targetChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
          ViewChannel: null
        });
        await interaction.reply({ embeds: [embed.success('Channel Unhidden', `**${targetChannel.name}** is now visible to @everyone.`)] });
      } catch (err) {
        await interaction.reply({ embeds: [embed.error('Error', 'Failed to unhide the channel. Check my permissions.')] });
      }
    }
  }
];
