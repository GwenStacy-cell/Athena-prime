import { PermissionFlagsBits } from 'discord.js';
import embed from '../embed.js';
import db from '../database.js';
import { isAuthorized, isBotOwnerSync } from '../utils/helpers.js';

async function handleMassRole(context, role, action) {
  const guild = context.guild;
  const executor = context.author || context.user;
  
  const highestBotRole = guild.members.me.roles.highest.position;
  const highestUserRole = context.member?.roles.highest.position;

  if (role.position >= highestBotRole) {
    const reply = { embeds: [embed.danger('Hierarchy Error', 'My highest role must be above the role you are trying to manage.')] };
    return context.reply ? await context.reply(reply) : await context.editReply(reply);
  }
  
  if (!isBotOwnerSync(executor.id) && guild.ownerId !== executor.id && role.position >= highestUserRole) {
    const reply = { embeds: [embed.danger('Hierarchy Error', 'Your highest role must be above the role you are trying to manage.')] };
    return context.reply ? await context.reply(reply) : await context.editReply(reply);
  }

  const isSlash = !!context.commandName;
  if (isSlash) await context.deferReply();
  
  const actionName = action === 'add' ? 'Add' : action === 'remove' ? 'Remove' : action === 'strip' ? 'Strip' : 'Restore';
  
  const initialReply = { embeds: [embed.success(`Mass ${actionName} Started`, `Processing \`${role.name}\`...`)] };
  let statusMessage;
  if (isSlash) {
    statusMessage = await context.editReply(initialReply);
  } else {
    statusMessage = await context.reply(initialReply);
  }

  try {
    const members = await guild.members.fetch();
    let successCount = 0;
    let failCount = 0;
    
    let targets;
    if (action === 'add') {
      targets = members.filter(m => !m.roles.cache.has(role.id));
    } else if (action === 'remove') {
      targets = members.filter(m => m.roles.cache.has(role.id));
    } else if (action === 'strip') {
      targets = members.filter(m => m.roles.cache.has(role.id));
      const targetIds = Array.from(targets.keys());
      db.saveMassRole(guild.id, role.id, targetIds);
    } else if (action === 'restore') {
      const savedIds = db.getMassRole(guild.id, role.id) || [];
      if (savedIds.length === 0) {
        return statusMessage.edit({ embeds: [embed.warn('No Backup', `No backup found for \`${role.name}\`. Nothing to restore.`)] }).catch(() => null);
      }
      targets = members.filter(m => savedIds.includes(m.id) && !m.roles.cache.has(role.id));
    }
    
    if (targets.size === 0) {
      const finishEmbed = embed.success(`Mass ${actionName} Completed`, `Nobody needed the role changed!`);
      return statusMessage.edit({ embeds: [finishEmbed] }).catch(() => null);
    }
    
    const targetArray = Array.from(targets.values());
    
    for (let i = 0; i < targetArray.length; i += 50) {
      const chunk = targetArray.slice(i, i + 50);
      await Promise.allSettled(chunk.map(async m => {
        try {
          if (action === 'add' || action === 'restore') await m.roles.add(role);
          else await m.roles.remove(role);
          successCount++;
        } catch (e) {
          failCount++;
        }
      }));
    }
    
    const finishEmbed = embed.success(
      `Mass ${actionName} Completed`, 
      `Successfully processed ${action === 'add' || action === 'restore' ? 'addition' : 'removal'} for **${successCount}** members.\nFailed: **${failCount}**`
    );
    await statusMessage.edit({ embeds: [finishEmbed] }).catch(() => null);
  } catch (err) {
    console.error(err);
    const errEmbed = embed.danger('Execution Error', 'Something went wrong during mass role assignment.');
    await statusMessage.edit({ embeds: [errEmbed] }).catch(() => null);
  }
}

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
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.danger('Unauthorized', 'You do not have permission to use this command.')] });
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
        return interaction.reply({ embeds: [embed.danger('Unauthorized', 'You do not have permission.')] });
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
        return interaction.reply({ embeds: [embed.danger('Unauthorized', 'You do not have permission.')] });
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
  },
  {
    name: 'massaddrole',
    slashHidden: true,
    description: 'Adds a role to all members in the server.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      { name: 'role', description: 'The role to add to everyone', type: 8, required: true }
    ],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return;
      
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [embed.warn('Command Error', 'Usage: `!massaddrole <@role>`')] });
      
      await handleMassRole(message, role, 'add');
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.danger('Unauthorized', 'You do not have permission.')] });
      }
      const role = interaction.options.getRole('role');
      await handleMassRole(interaction, role, 'add');
    }
  },
  {
    name: 'massremoverole',
    slashHidden: true,
    description: 'Removes a role from all members in the server.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      { name: 'role', description: 'The role to remove from everyone', type: 8, required: true }
    ],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return;
      
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [embed.warn('Command Error', 'Usage: `!massremoverole <@role>`')] });
      
      await handleMassRole(message, role, 'remove');
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.danger('Unauthorized', 'You do not have permission.')] });
      }
      const role = interaction.options.getRole('role');
      await handleMassRole(interaction, role, 'remove');
    }
  },
  {
    name: 'massstrip',
    slashHidden: true,
    description: 'Removes a role from all members and saves the list to restore later.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      { name: 'role', description: 'The role to strip', type: 8, required: true }
    ],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return;
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [embed.warn('Command Error', 'Usage: `!massstrip <@role>`')] });
      await handleMassRole(message, role, 'strip');
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.danger('Unauthorized', 'You do not have permission.')] });
      }
      const role = interaction.options.getRole('role');
      await handleMassRole(interaction, role, 'strip');
    }
  },
  {
    name: 'massrestore',
    slashHidden: true,
    description: 'Restores a role to members who had it stripped via massstrip.',
    category: 'moderation',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      { name: 'role', description: 'The role to restore', type: 8, required: true }
    ],
    async executePrefix(message) {
      if (!(await isAuthorized(message.author, message.guild))) return;
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [embed.warn('Command Error', 'Usage: `!massrestore <@role>`')] });
      await handleMassRole(message, role, 'restore');
    },
    async executeSlash(interaction) {
      if (!(await isAuthorized(interaction.user, interaction.guild))) {
        return interaction.reply({ embeds: [embed.danger('Unauthorized', 'You do not have permission.')] });
      }
      const role = interaction.options.getRole('role');
      await handleMassRole(interaction, role, 'restore');
    }
  }
];
