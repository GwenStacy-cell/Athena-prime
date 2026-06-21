import { PermissionFlagsBits } from 'discord.js';
import embed from '../embed.js';
import { isAuthorized } from '../utils/helpers.js';

export const commands = [
  {
    name: 'addrole',
    description: 'Adds one or more roles to a user.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageRoles],
    async executePrefix(message) {
      if (!isAuthorized(message.guild, message.member)) return;
      
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
        if (message.guild.ownerId !== message.author.id && role.position >= highestUserRole) {
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
    }
  },
  {
    name: 'removerole',
    description: 'Removes one or more roles from a user.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageRoles],
    async executePrefix(message) {
      if (!isAuthorized(message.guild, message.member)) return;
      
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
        if (message.guild.ownerId !== message.author.id && role.position >= highestUserRole) {
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
    }
  },
  {
    name: 'striproles',
    description: 'Removes ALL roles from a user (except @everyone and managed roles).',
    category: 'moderation',
    permissions: [PermissionFlagsBits.ManageRoles],
    async executePrefix(message) {
      if (!isAuthorized(message.guild, message.member)) return;
      
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
        if (role.position >= highestBotRole || (message.guild.ownerId !== message.author.id && role.position >= highestUserRole)) {
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
    }
  }
];
