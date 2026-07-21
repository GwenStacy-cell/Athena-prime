import { PermissionFlagsBits } from 'discord.js';
import embed from '../embed.js';
import db from '../database.js';

export const commands = [
  {
    name: 'sticky',
    description: 'Manage sticky messages in the current channel.',
    aliases: ['stick'],
    async executePrefix(message, args) {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} You must have **Manage Messages** permissions to use sticky commands.`)] });
      }

      if (args.length === 0) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!sticky set <message>\` or \`!sticky remove\``)] });
      }

      const action = args[0].toLowerCase();

      if (action === 'remove') {
        const removed = db.removeStickyMessage(message.guild.id, message.channel.id);
        if (removed) {
          return message.reply({ embeds: [embed.success('Sticky Removed', 'The sticky message for this channel has been removed.')] });
        } else {
          return message.reply({ embeds: [embed.info('Not Found', 'There is no active sticky message in this channel.')] });
        }
      }

      if (action === 'set') {
        const content = args.slice(1).join(' ');
        if (!content) {
          return message.reply({ embeds: [embed.warn('Command Error', `${message.author} You must provide a message to set. Example: \`!sticky set Welcome to general!\``)] });
        }

        db.setStickyMessage(message.guild.id, message.channel.id, content);
        
        return message.reply({ embeds: [embed.success('Sticky Set', `Sticky message has been configured for this channel.\n\n**Preview:**\n> ${content}`)] });
      }

      return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Invalid action. Usage: \`!sticky set <message>\` or \`!sticky remove\``)] });
    }
  }
];
