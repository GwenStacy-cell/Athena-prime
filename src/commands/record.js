import { ChannelType, PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

export const commands = [
  {
    name: 'record',
    slashHidden: true,
    description: 'Setup the voice logging channel',
    aliases: ['voicelog', 'vclogs', 'setuplogs'],
  async executePrefix(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.channel.send({ embeds: [embed.error('Permission Denied', 'You need Administrator permissions to setup voice records.', [], message.guild.id)] });
    }

    try {
      let channel = message.guild.channels.cache.find(c => c.name === 'voice-records' && c.type === ChannelType.GuildText);
      
      if (!channel) {
        channel = await message.guild.channels.create({
          name: 'voice-records',
          type: ChannelType.GuildText,
          topic: '🎙️ Automated Voice Join/Leave Records',
          permissionOverwrites: [
            {
              id: message.guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel] // Hide from normal members
            }
          ]
        });
      }

      db.updateGuildConfig(message.guild.id, { voiceLogChannel: channel.id });
      
      message.channel.send({ embeds: [embed.success('Voice Records Setup', `Successfully setup voice logging in <#${channel.id}>.\nAll VC joins and leaves will be recorded there.`, [], message.guild.id)] });
      
    } catch (error) {
      console.error(error);
      message.channel.send({ embeds: [embed.error('Setup Failed', 'Failed to create the voice records channel. Check my permissions.', [], message.guild.id)] });
    }
  }
}
];
