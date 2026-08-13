import { PermissionFlagsBits } from 'discord.js';
import embed from '../embed.js';

export const commands = [
  {
    name: 'snipe',
    description: 'Snipe the last deleted message in this channel.',
    category: 'utility',
    // Allowed for everyone by default, admins can restrict it via Discord permissions if needed
    async executePrefix(message, args) {
      if (!message.client.snipeCache) {
        return message.reply({ embeds: [embed.warn('No Targets', 'There is nothing to snipe in this channel.')] }).catch(() => null);
      }

      const sniped = message.client.snipeCache.get(message.channel.id);
      if (!sniped) {
        return message.reply({ embeds: [embed.warn('No Targets', 'There is nothing to snipe in this channel.')] }).catch(() => null);
      }

      // Check if it's too old (e.g., > 1 hour)
      if (Date.now() - sniped.timestamp > 3600000) {
        message.client.snipeCache.delete(message.channel.id);
        return message.reply({ embeds: [embed.warn('Expired', 'The last sniped message has expired.')] }).catch(() => null);
      }

      const snipeEmbed = embed.build({
        description: `> ${sniped.content}`,
        color: '#2b2d31'
      });

      snipeEmbed.setAuthor({ 
        name: sniped.author.tag, 
        iconURL: sniped.author.displayAvatarURL({ dynamic: true }) 
      });

      snipeEmbed.setFooter({ text: `Sniped by ${message.author.tag} • ${new Date(sniped.timestamp).toLocaleTimeString()}` });

      if (sniped.image) {
        snipeEmbed.setImage(sniped.image);
      }

      await message.reply({ embeds: [snipeEmbed] }).catch(() => null);
    }
  }
];
