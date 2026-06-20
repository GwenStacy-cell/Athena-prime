import { PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { isBotOwnerSync } from '../utils/helpers.js';

export const commands = [
  {
    name: 'moveprotect',
    description: 'Manage move protection for users (Server Owner & Bot Owner only).',
    category: 'admin',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'add',
        description: 'Add a user to the move protection list.',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'user', description: 'The user to protect', type: 6, required: true }
        ]
      },
      {
        name: 'remove',
        description: 'Remove a user from the move protection list.',
        type: 1, // SUB_COMMAND
        options: [
          { name: 'user', description: 'The user to unprotect', type: 6, required: true }
        ]
      },
      {
        name: 'list',
        description: 'List all move-protected users.',
        type: 1 // SUB_COMMAND
      }
    ],
    async executeSlash(interaction) {
      // Security Check: Only Server Owner and Bot Owner
      if (interaction.user.id !== interaction.guild.ownerId && !isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ embeds: [embed.danger('Access Denied', 'Only the **Server Owner** and **Bot Owner** can use the move protection command.')], ephemeral: true });
      }

      const subCommand = interaction.options.getSubcommand();

      if (subCommand === 'add') {
        const target = interaction.options.getUser('user');
        if (target.bot) return interaction.reply({ embeds: [embed.warn('Invalid Target', 'You cannot move-protect bots.')], ephemeral: true });

        const added = db.addMoveProtectedUser(interaction.guild.id, target.id);
        if (added) {
          return interaction.reply({ embeds: [embed.success('Move Protection Enabled', `**${target.tag}** is now protected. If an admin attempts to move them, they will be instantly dragged back and the admin will be warned/punished.`)], ephemeral: true });
        } else {
          return interaction.reply({ embeds: [embed.warn('Already Protected', `**${target.tag}** is already on the move protection list.`)], ephemeral: true });
        }
      }

      if (subCommand === 'remove') {
        const target = interaction.options.getUser('user');
        
        const removed = db.removeMoveProtectedUser(interaction.guild.id, target.id);
        if (removed) {
          return interaction.reply({ embeds: [embed.success('Move Protection Disabled', `**${target.tag}** has been removed from the move protection list.`)], ephemeral: true });
        } else {
          return interaction.reply({ embeds: [embed.warn('Not Protected', `**${target.tag}** is not on the move protection list.`)], ephemeral: true });
        }
      }

      if (subCommand === 'list') {
        const protectedIds = db.getMoveProtectedUsers(interaction.guild.id);
        if (!protectedIds || protectedIds.length === 0) {
          return interaction.reply({ embeds: [embed.info('Move Protection List', 'No users are currently protected.')], ephemeral: true });
        }

        const userList = protectedIds.map(id => `<@${id}>`).join('\n');
        return interaction.reply({ embeds: [embed.info('Move Protected Users', userList)], ephemeral: true });
      }
    }
  }
];
