import { PermissionFlagsBits } from 'discord.js';
import cv2 from '../cv2.js';

export const commands = [
  {
    name: 'snipe',
    description: 'Snipe the last deleted message in this channel.',
    category: 'utility',
    // Allowed for everyone by default, admins can restrict it via Discord permissions if needed
    async executePrefix(message, args) {
      if (!message.client.snipeCache) {
        return message.reply(cv2.warn('No Targets', 'There is nothing to snipe in this channel.')).catch(() => null);
      }

      const sniped = message.client.snipeCache.get(message.channel.id);
      if (!sniped) {
        return message.reply(cv2.warn('No Targets', 'There is nothing to snipe in this channel.')).catch(() => null);
      }

      // Check if it's too old (e.g., > 1 hour)
      if (Date.now() - sniped.timestamp > 3600000) {
        message.client.snipeCache.delete(message.channel.id);
        return message.reply(cv2.warn('Expired', 'The last sniped message has expired.')).catch(() => null);
      }

      const timeStr = new Date(sniped.timestamp).toLocaleTimeString();
      const desc = `-# **${sniped.author.tag}** • ${timeStr}\n> ${sniped.content}`;
      const reply = cv2.info('Sniped Message', desc);
      await message.reply(reply).catch(() => null);
    }
  }
];
