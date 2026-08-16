import { ChannelType } from 'discord.js';
import cv2 from '../cv2.js';
import { isAuthorized, logToSecurityChannel } from '../utils/helpers.js';

export const createChannelCmd = {
  name: 'createchannel',
  description: 'Creates a new text channel',
  slashHidden: true, // prefix only
  async executeSlash() {},
  async executePrefix(message, args) {
    if (!await isAuthorized(message.author, message.guild)) return;
    
    if (!args[0]) {
      return message.reply(cv2.error('Missing Argument', 'Please provide a name for the channel.\n**Usage:** `!createchannel <name>`'));
    }

    const name = args.join('-');
    const channel = await message.guild.channels.create({ 
      name, 
      type: ChannelType.GuildText,
      reason: `Created via !createchannel by ${message.author.tag}`
    }).catch(() => null);

    if (!channel) return message.reply(cv2.error('Error', 'Failed to create channel.'));
    
    await message.reply(cv2.success('Channel Created', `Successfully created <#${channel.id}>.`));
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
      return message.reply(cv2.error('Missing Argument', 'Please mention a channel, provide its ID, or its exact name.\n**Usage:** `!deletechannel #channel`'));
    }

    let targetChannel = message.mentions.channels.first();
    
    if (!targetChannel) {
      const search = args.join(' ').toLowerCase();
      targetChannel = message.guild.channels.cache.get(args[0]) || 
                      message.guild.channels.cache.find(c => c.name.toLowerCase() === search.replace(/^#/, ''));
    }
    
    if (!targetChannel) {
      return message.reply(cv2.error('Not Found', 'Could not find that channel in this server.'));
    }
    
    const name = targetChannel.name;
    const deleted = await targetChannel.delete(`Deleted via !deletechannel by ${message.author.tag}`).catch(() => null);
    
    if (!deleted) {
      return message.reply(cv2.error('Error', 'Failed to delete channel. Check my permissions or hierarchy.'));
    }

    await message.reply(cv2.success('Channel Deleted', `Successfully deleted **#${name}**.`));
  }
};

export const commands = [createChannelCmd, deleteChannelCmd];
