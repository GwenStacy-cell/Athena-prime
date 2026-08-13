import { ChannelType } from 'discord.js';
import embed from '../embed.js';
import { isAuthorized, logToSecurityChannel } from '../utils/helpers.js';

export const createChannelCmd = {
  name: 'createchannel',
  description: 'Creates a new text channel',
  slashHidden: true, // prefix only
  async executeSlash() {},
  async executePrefix(message, args) {
    if (!await isAuthorized(message.author, message.guild)) return;
    
    if (!args[0]) {
      return message.reply({ embeds: [embed.error('Missing Argument', 'Please provide a name for the channel.\n**Usage:** `!createchannel <name>`')] });
    }

    const name = args.join('-');
    const channel = await message.guild.channels.create({ 
      name, 
      type: ChannelType.GuildText,
      reason: `Created via !createchannel by ${message.author.tag}`
    }).catch(() => null);

    if (!channel) return message.reply({ embeds: [embed.error('Error', 'Failed to create channel.')] });
    
    await message.reply({ embeds: [embed.success('Channel Created', `Successfully created <#${channel.id}>.`)] });
    
    // Log to security channel as Firewall
    const logEmbed = embed.log(
      'LOG: FIREWALL TRIGGERED',
      `Manual channel creation via bot command.`,
      [
        { name: 'Channel', value: `<#${channel.id}> (${channel.name})` },
        { name: 'Admin', value: `${message.author.tag} (<@${message.author.id}>)` }
      ],
      'security'
    );
    await logToSecurityChannel(message.guild, logEmbed);
  }
};

export const deleteChannelCmd = {
  name: 'deletechannel',
  description: 'Deletes a channel by mention, ID, or name',
  slashHidden: true, // prefix only
  async executeSlash() {},
  async executePrefix(message, args) {
    if (!await isAuthorized(message.author, message.guild)) return;
    
    if (!args[0]) {
      return message.reply({ embeds: [embed.error('Missing Argument', 'Please mention a channel, provide its ID, or its exact name.\n**Usage:** `!deletechannel #channel`')] });
    }

    let targetChannel = message.mentions.channels.first();
    
    if (!targetChannel) {
      const search = args.join(' ').toLowerCase();
      targetChannel = message.guild.channels.cache.get(args[0]) || 
                      message.guild.channels.cache.find(c => c.name.toLowerCase() === search.replace(/^#/, ''));
    }
    
    if (!targetChannel) {
      return message.reply({ embeds: [embed.error('Not Found', 'Could not find that channel in this server.')] });
    }
    
    const name = targetChannel.name;
    const deleted = await targetChannel.delete(`Deleted via !deletechannel by ${message.author.tag}`).catch(() => null);
    
    if (!deleted) {
      return message.reply({ embeds: [embed.error('Error', 'Failed to delete channel. Check my permissions or hierarchy.')] });
    }

    await message.reply({ embeds: [embed.success('Channel Deleted', `Successfully deleted **#${name}**.`)] });
    
    // Log to security channel as Firewall
    const logEmbed = embed.log(
      'LOG: FIREWALL TRIGGERED',
      `Manual channel deletion via bot command.`,
      [
        { name: 'Channel', value: `**#${name}**` },
        { name: 'Admin', value: `${message.author.tag} (<@${message.author.id}>)` }
      ],
      'security'
    );
    await logToSecurityChannel(message.guild, logEmbed);
  }
};

export default [createChannelCmd, deleteChannelCmd];
