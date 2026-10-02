import { ChannelType } from 'discord.js';
import cv2 from '../cv2.js';
import { isAuthorized, logToSecurityChannel } from '../utils/helpers.js';

export const createChannelCmd = {
  name: 'createchannel',
  description: 'Creates a new text channel in the server.',
  slashHidden: true,
  async executeSlash() {},
  async executePrefix(message, args) {
    if (!await isAuthorized(message.author, message.guild)) return;

    if (!args.length) {
      return message.reply(cv2.warn('Missing Argument', 'Please provide a channel name.\n**Usage:** `!createchannel <name>`'));
    }

    const channelName = args.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!channelName) {
      return message.reply(cv2.warn('Invalid Name', 'Channel name must contain valid characters (letters, numbers, dashes).'));
    }

    const newChannel = await message.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      reason: `Created via !createchannel by ${message.author.tag}`
    }).catch(() => null);

    if (!newChannel) {
      return message.reply(cv2.danger('Error', 'Failed to create channel. Check my permissions.'));
    }

    await message.reply(cv2.success('Channel Created', `Successfully created ${newChannel}.\n**Name:** \`${newChannel.name}\``));
  }
};

export const deleteChannelCmd = {
  name: 'deletechannel',
  description: 'Deletes one or more channels. Separate multiple with commas or spaces.',
  slashHidden: true,
  async executeSlash() {},
  async executePrefix(message, args) {
    if (!await isAuthorized(message.author, message.guild)) return;

    if (!args.length) {
      return message.reply(cv2.warn('Missing Argument', 'Please mention one or more channels or provide their IDs.\n**Usage:** `!deletechannel #channel1, 1234567890, #channel3`'));
    }

    const inputString = args.join(' ');
    let targets = inputString.includes(',')
      ? inputString.split(',').map(s => s.trim()).filter(Boolean)
      : inputString.split(/\s+/).filter(Boolean);

    // If no commas and multiple space-tokens, check if it's one multi-word name
    if (!inputString.includes(',') && targets.length > 1 && !inputString.includes('<#')) {
      const exactMatch = message.guild.channels.cache.find(c => c.name.toLowerCase() === inputString.toLowerCase().replace(/^#/, ''));
      if (exactMatch) targets = [inputString];
    }

    let deletedCount = 0;
    let failedCount = 0;

    for (const search of targets) {
      const channelId = search.replace(/<#|>/g, '');
      const targetChannel = message.guild.channels.cache.get(channelId) ||
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
      return message.reply(cv2.danger('Error', 'Could not delete any of the specified channels. Check IDs, names, or my permissions.'));
    }

    const msg = `Successfully deleted **${deletedCount}** channel(s).` + (failedCount > 0 ? `\nFailed to delete **${failedCount}**.` : '');
    await message.reply(cv2.success('Channels Deleted', msg)).catch(() => null);
  }
};

export const commands = [createChannelCmd, deleteChannelCmd];
