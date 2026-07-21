import { PermissionFlagsBits } from 'discord.js';
import embed from '../embed.js';
import db from '../database.js';

export const commands = [
  {
    name: 'sticky',
    description: 'Manage sticky messages in the current channel.',
    aliases: ['stick'],
    type: 1,
    options: [
      {
        name: 'set',
        description: 'Set a sticky message for this channel',
        type: 1, // SUB_COMMAND
        options: [
          {
            name: 'message',
            description: 'The text to stick to the bottom of the channel',
            type: 3, // STRING
            required: true
          }
        ]
      },
      {
        name: 'remove',
        description: 'Remove the sticky message from this channel',
        type: 1 // SUB_COMMAND
      }
    ],
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
    },
    async executeSlash(interaction) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} You must have **Manage Messages** permissions to use sticky commands.`)] });
      }

      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'remove') {
        const removed = db.removeStickyMessage(interaction.guild.id, interaction.channel.id);
        if (removed) {
          return interaction.reply({ embeds: [embed.success('Sticky Removed', 'The sticky message for this channel has been removed.')] });
        } else {
          return interaction.reply({ embeds: [embed.info('Not Found', 'There is no active sticky message in this channel.')] });
        }
      }

      if (subcommand === 'set') {
        const content = interaction.options.getString('message');
        db.setStickyMessage(interaction.guild.id, interaction.channel.id, content);
        return interaction.reply({ embeds: [embed.success('Sticky Set', `Sticky message has been configured for this channel.\n\n**Preview:**\n> ${content}`)] });
      }
    }
  }
];
