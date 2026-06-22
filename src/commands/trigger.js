import { PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

export const commands = [
  {
    name: 'trigger',
    description: 'Manage auto-responder triggers (like Carl-bot).',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [
      {
        name: 'create',
        description: 'Create a new trigger',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'match', description: 'The word or phrase to trigger on', type: 3, required: true },
          { name: 'response', description: 'The bot response', type: 3, required: true }
        ]
      },
      {
        name: 'remove',
        description: 'Remove an existing trigger',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'match', description: 'The exact trigger phrase to remove', type: 3, required: true }
        ]
      },
      {
        name: 'list',
        description: 'List all triggers in the server',
        type: 1 // SUB_COMMAND
      }
    ],

    async executePrefix(message, args) {
      if (args.length === 0) {
        return message.reply({ embeds: [embed.warn('Usage', '`!trigger <create|remove|list>`')] });
      }

      const sub = args[0].toLowerCase();
      
      if (sub === 'create') {
        const rest = args.slice(1).join(' ');
        const parts = rest.split('|');
        if (parts.length < 2) {
          return message.reply({ embeds: [embed.warn('Usage Error', 'Use `|` to separate match and response.\n**Example:** `!trigger create hello | hi there!`')] });
        }
        const match = parts[0].trim();
        let response = parts.slice(1).join('|').trim();
        
        // Support native attachments (images, GIFs, MP4s)
        if (!response && message.attachments.size > 0) {
          response = message.attachments.first().url;
        }
        
        if (!match || !response) return message.reply({ embeds: [embed.warn('Error', 'Match and response cannot be empty. You can provide text or upload a media attachment.')] });

        const success = db.addTrigger(message.guild.id, match, response);
        if (success) {
          await message.reply({ embeds: [embed.success('Trigger Created', `Whenever someone says \`${match}\`, I will respond.`)] });
        } else {
          await message.reply({ embeds: [embed.danger('Error', `A trigger for \`${match}\` already exists.`)] });
        }
      } 
      else if (sub === 'remove') {
        const match = args.slice(1).join(' ');
        if (!match) return message.reply({ embeds: [embed.warn('Usage Error', '**Example:** `!trigger remove hello`')] });
        
        const success = db.removeTrigger(message.guild.id, match);
        if (success) {
          await message.reply({ embeds: [embed.success('Trigger Removed', `Successfully deleted the trigger for \`${match}\`.`)] });
        } else {
          await message.reply({ embeds: [embed.warn('Not Found', `Could not find a trigger matching \`${match}\`.`)] });
        }
      }
      else if (sub === 'list') {
        const triggers = db.getTriggers(message.guild.id);
        if (triggers.length === 0) {
          return message.reply({ embeds: [embed.info('No Triggers', 'This server has no auto-responder triggers set up.')] });
        }
        
        const lines = triggers.map(t => `• **${t.match}**`);
        await message.reply({ embeds: [embed.info(`Active Triggers (${triggers.length})`, lines.join('\n'))] });
      }
    },

    async executeSlash(interaction) {
      const sub = interaction.options.getSubcommand();
      
      if (sub === 'create') {
        const match = interaction.options.getString('match').trim();
        let response = interaction.options.getString('response');
        if (response) response = response.trim();
        
        // If they provided a URL, use it directly. We don't need to transcode MP4s.
        if (!match || !response) return interaction.reply({ embeds: [embed.warn('Error', 'Match and response cannot be empty.')] });
        
        const success = db.addTrigger(interaction.guild.id, match, response);
        if (success) {
          const payload = { embeds: [embed.success('Trigger Created', `Whenever someone says \`${match}\`, I will respond.`)] };
          await interaction.reply(payload);
        } else {
          const payload = { embeds: [embed.danger('Error', `A trigger for \`${match}\` already exists.`)] };
          await interaction.reply(payload);
        }
      }
      else if (sub === 'remove') {
        const match = interaction.options.getString('match').trim();
        const success = db.removeTrigger(interaction.guild.id, match);
        if (success) {
          await interaction.reply({ embeds: [embed.success('Trigger Removed', `Successfully deleted the trigger for \`${match}\`.`)] });
        } else {
          await interaction.reply({ embeds: [embed.warn('Not Found', `Could not find a trigger matching \`${match}\`.`)] });
        }
      }
      else if (sub === 'list') {
        const triggers = db.getTriggers(interaction.guild.id);
        if (triggers.length === 0) {
          return interaction.reply({ embeds: [embed.info('No Triggers', 'This server has no auto-responder triggers set up.')] });
        }
        
        const lines = triggers.map(t => `• **${t.match}**`);
        await interaction.reply({ embeds: [embed.info(`Active Triggers (${triggers.length})`, lines.join('\n'))] });
      }
    }
  }
];
