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
    
    if (!args.length) {
      return message.reply(cv2.error('Missing Argument', 'Please mention one or more channels, provide their IDs, or names separated by commas.\n**Usage:** `!deletechannel #channel1, 1234567890`'));
    }

    const inputString = args.join(' ');
    let targets = inputString.includes(',') ? inputString.split(',').map(s => s.trim()).filter(Boolean) : inputString.split(/\s+/).filter(Boolean);
    
    if (!inputString.includes(',') && targets.length > 1 && !inputString.includes('<#')) {
      const exactMatch = message.guild.channels.cache.find(c => c.name.toLowerCase() === inputString.toLowerCase().replace(/^#/, ''));
      if (exactMatch) targets = [inputString];
    }
    
    let deletedCount = 0;
    let failedCount = 0;
    
    for (const search of targets) {
      const channelId = search.replace(/<#|>/g, '');
      let targetChannel = message.guild.channels.cache.get(channelId) || 
                          message.guild.channels.cache.find(c => c.name.toLowerCase() === search.toLowerCase().replace(/^#/, ''));
      
      if (targetChannel) {
        const deleted = await targetChannel.delete(`Deleted via !deletechannel by ${message.author.tag}`).catch(() => null);
        if (deleted) deletedCount++;
        else failedCount++;
      } else {
        failedCount++;
      }
    }
    
    if (deletedCount === 0) {
      return message.reply(cv2.error('Error', 'Could not delete any of the specified channels. Check IDs, names, or permissions.'));
    }

    const msg = `Successfully deleted **${deletedCount}** channel(s).` + (failedCount > 0 ? `\nFailed to delete **${failedCount}**.` : '');
    await message.reply(cv2.success('Channels Deleted', msg)).catch(() => null);
  }
};

export const commands = [createChannelCmd, deleteChannelCmd];
