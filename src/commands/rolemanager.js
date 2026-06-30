import { PermissionFlagsBits } from 'discord.js';
import embed from '../embed.js';
import { isAuthorized, isBotOwnerSync } from '../utils/helpers.js';

export const commands = [
  {
    name: 'addrole',
    description: 'Adds one or more roles to a user.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageRoles],
    options: [
      { name: 'user', description: 'The user to add roles to', type: 6, required: true },
      { name: 'role1', description: 'First role to add', type: 8, required: true },
      { name: 'role2', description: 'Second role to add', type: 8, required: false },
      { name: 'role3', description: 'Third role to add', type: 8, required: false },
      { name: 'role4', description: 'Fourth role to add', type: 8, required: false },
      { name: 'role5', description: 'Fifth role to add', type: 8, required: false }
    ],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return;
      
      const target = message.mentions.members.first();
      const roles = message.mentions.roles;
      
      if (!target || roles.size === 0) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Usage: `!addrole <@user> <@role1> [@role2...]`')] });
      }
      
      const addedRoles = [];
      const failedRoles = [];
      
      const highestBotRole = message.guild.members.me.roles.highest.position;
      const highestUserRole = message.member.roles.highest.position;

      for (const [id, role] of roles) {
        if (role.position >= highestBotRole) {
          failedRoles.push(`${role.name} (Bot hierarchy too low)`);
          continue;
        }
        if (!isBotOwnerSync(message.author.id) && message.guild.ownerId !== message.author.id && role.position >= highestUserRole) {
          failedRoles.push(`${role.name} (Your hierarchy too low)`);
          continue;
        }
        
        try {
          await target.roles.add(role);
          addedRoles.push(role.name);
        } catch (err) {
          failedRoles.push(`${role.name} (Error)`);
        }
      }
      
      let replyDesc = `Target: ${target}\n`;
      if (addedRoles.length > 0) replyDesc += `**Added:** ${addedRoles.join(', ')}\n`;
      if (failedRoles.length > 0) replyDesc += `**Failed:** ${failedRoles.join(', ')}\n`;
      
      await message.reply({ embeds: [embed.success('Role Assignment', replyDesc)] });
      await message.reply({ embeds: [embed.success('Role Assignment', replyDesc)] });
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.danger('Unauthorized', 'You do not have permission to use this command.')], ephemeral: true });
      }
      
      await interaction.deferReply();
      const targetUser = interaction.options.getUser('user');
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!target) {
        return interaction.editReply({ embeds: [embed.warn('Command Error', 'User not found.')] });
      }
      
      const roles = [];
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) roles.push(role);
      }
      
      const addedRoles = [];
      const failedRoles = [];
      const highestBotRole = interaction.guild.members.me.roles.highest.position;
      const highestUserRole = interaction.member.roles.highest.position;

      for (const role of roles) {
        if (role.position >= highestBotRole) {
          failedRoles.push(`${role.name} (Bot hierarchy too low)`);
          continue;
        }
        if (!isBotOwnerSync(interaction.user.id) && interaction.guild.ownerId !== interaction.user.id && role.position >= highestUserRole) {
          failedRoles.push(`${role.name} (Your hierarchy too low)`);
          continue;
        }
        try {
          await target.roles.add(role);
          addedRoles.push(role.name);
        } catch (err) {
          failedRoles.push(`${role.name} (Error)`);
        }
      }
      
      let replyDesc = `Target: ${target}\n`;
      if (addedRoles.length > 0) replyDesc += `**Added:** ${addedRoles.join(', ')}\n`;
      if (failedRoles.length > 0) replyDesc += `**Failed:** ${failedRoles.join(', ')}\n`;
      
      await interaction.editReply({ embeds: [embed.success('Role Assignment', replyDesc)] });
    }
  },
  {
    name: 'removerole',
    description: 'Removes one or more roles from a user.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageRoles],
    options: [
      { name: 'user', description: 'The user to remove roles from', type: 6, required: true },
      { name: 'role1', description: 'First role to remove', type: 8, required: true },
      { name: 'role2', description: 'Second role to remove', type: 8, required: false },
      { name: 'role3', description: 'Third role to remove', type: 8, required: false },
      { name: 'role4', description: 'Fourth role to remove', type: 8, required: false },
      { name: 'role5', description: 'Fifth role to remove', type: 8, required: false }
    ],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return;
      
      const target = message.mentions.members.first();
      const roles = message.mentions.roles;
      
      if (!target || roles.size === 0) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Usage: `!removerole <@user> <@role1> [@role2...]`')] });
      }
      
      const removedRoles = [];
      const failedRoles = [];
      
      const highestBotRole = message.guild.members.me.roles.highest.position;
      const highestUserRole = message.member.roles.highest.position;

      for (const [id, role] of roles) {
        if (role.position >= highestBotRole) {
          failedRoles.push(`${role.name} (Bot hierarchy too low)`);
          continue;
        }
        if (!isBotOwnerSync(message.author.id) && message.guild.ownerId !== message.author.id && role.position >= highestUserRole) {
          failedRoles.push(`${role.name} (Your hierarchy too low)`);
          continue;
        }
        
        try {
          await target.roles.remove(role);
          removedRoles.push(role.name);
        } catch (err) {
          failedRoles.push(`${role.name} (Error)`);
        }
      }
      
      let replyDesc = `Target: ${target}\n`;
      if (removedRoles.length > 0) replyDesc += `**Removed:** ${removedRoles.join(', ')}\n`;
      if (failedRoles.length > 0) replyDesc += `**Failed:** ${failedRoles.join(', ')}\n`;
      
      await message.reply({ embeds: [embed.success('Role Removal', replyDesc)] });
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.danger('Unauthorized', 'You do not have permission.')], ephemeral: true });
      }
      
      await interaction.deferReply();
      const targetUser = interaction.options.getUser('user');
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!target) {
        return interaction.editReply({ embeds: [embed.warn('Command Error', 'User not found.')] });
      }
      
      const roles = [];
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) roles.push(role);
      }
      
      const removedRoles = [];
      const failedRoles = [];
      const highestBotRole = interaction.guild.members.me.roles.highest.position;
      const highestUserRole = interaction.member.roles.highest.position;

      for (const role of roles) {
        if (role.position >= highestBotRole) {
          failedRoles.push(`${role.name} (Bot hierarchy too low)`);
          continue;
        }
        if (!isBotOwnerSync(interaction.user.id) && interaction.guild.ownerId !== interaction.user.id && role.position >= highestUserRole) {
          failedRoles.push(`${role.name} (Your hierarchy too low)`);
          continue;
        }
        try {
          await target.roles.remove(role);
          removedRoles.push(role.name);
        } catch (err) {
          failedRoles.push(`${role.name} (Error)`);
        }
      }
      
      let replyDesc = `Target: ${target}\n`;
      if (removedRoles.length > 0) replyDesc += `**Removed:** ${removedRoles.join(', ')}\n`;
      if (failedRoles.length > 0) replyDesc += `**Failed:** ${failedRoles.join(', ')}\n`;
      
      await interaction.editReply({ embeds: [embed.success('Role Removal', replyDesc)] });
    }
  },
  {
    name: 'striproles',
    description: 'Removes ALL roles from a user (except @everyone and managed roles).',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageRoles],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return;
      
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({ embeds: [embed.warn('Command Error', 'Usage: `!striproles <@user>`')] });
      }
      
      const highestBotRole = message.guild.members.me.roles.highest.position;
      const highestUserRole = message.member.roles.highest.position;
      
      let count = 0;
      let failedCount = 0;

      const rolesToRemove = target.roles.cache.filter(role => 
        role.id !== message.guild.id && !role.managed
      );

      for (const [id, role] of rolesToRemove) {
        if (role.position >= highestBotRole || (!isBotOwnerSync(message.author.id) && message.guild.ownerId !== message.author.id && role.position >= highestUserRole)) {
          failedCount++;
          continue;
        }
        try {
          await target.roles.remove(role);
          count++;
        } catch (e) {
          failedCount++;
        }
      }
      
      await message.reply({ embeds: [embed.success('Roles Stripped', `Successfully stripped **${count}** roles from ${target}. Failed to remove **${failedCount}** roles (hierarchy/permissions).`)] });
      await message.reply({ embeds: [embed.success('Roles Stripped', `Successfully stripped **${count}** roles from ${target}. Failed to remove **${failedCount}** roles (hierarchy/permissions).`)] });
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.danger('Unauthorized', 'You do not have permission.')], ephemeral: true });
      }
      
      await interaction.deferReply();
      const targetUser = interaction.options.getUser('user');
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!target) {
        return interaction.editReply({ embeds: [embed.warn('Command Error', 'User not found.')] });
      }
      
      const highestBotRole = interaction.guild.members.me.roles.highest.position;
      const highestUserRole = interaction.member.roles.highest.position;
      
      let count = 0;
      let failedCount = 0;

      const rolesToRemove = target.roles.cache.filter(role => 
        role.id !== interaction.guild.id && !role.managed
      );

      for (const [id, role] of rolesToRemove) {
        if (role.position >= highestBotRole || (!isBotOwnerSync(interaction.user.id) && interaction.guild.ownerId !== interaction.user.id && role.position >= highestUserRole)) {
          failedCount++;
          continue;
        }
        try {
          await target.roles.remove(role);
          count++;
        } catch (e) {
          failedCount++;
        }
      }
      
      await interaction.editReply({ embeds: [embed.success('Roles Stripped', `Successfully stripped **${count}** roles from ${target}. Failed to remove **${failedCount}** roles.`)] });
    }
  }
];
