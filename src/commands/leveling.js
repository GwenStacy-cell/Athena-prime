import { PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { calculateXpForLevel } from '../utils/xpEngine.js';
import { generateRankCard, generateLeaderboard } from '../utils/canvasCards.js';

const TROPHY = '<a:trophy:1517636666825773058>';
const COIN = '<a:Boost2:1517637137388929147>';

export const commands = [
  {
    name: 'xpsetup',
    description: 'Configure the XP & Leveling system.',
    category: 'admin',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [
      {
        name: 'toggle',
        description: 'Enable or disable the XP system',
        type: 1,
        options: [{ name: 'enabled', description: 'Enable?', type: 5, required: true }]
      },
      {
        name: 'channel',
        description: 'Set the designated channel for level ups and leveling commands',
        type: 1,
        options: [{ name: 'target', description: 'Channel', type: 7, required: true }]
      },
      {
        name: 'add_reward',
        description: 'Add a role reward for a specific level',
        type: 1,
        options: [
          { name: 'level', description: 'Level required', type: 4, required: true },
          { name: 'role', description: 'Role to give', type: 8, required: true }
        ]
      },
      {
        name: 'add_multiplier',
        description: 'Add an XP multiplier for a specific role',
        type: 1,
        options: [
          { name: 'role', description: 'Role', type: 8, required: true },
          { name: 'multiplier', description: 'Multiplier (e.g. 1.5)', type: 10, required: true }
        ]
      }
    ],
    async executeSlash(interaction) {
      const sub = interaction.options.getSubcommand();
      const system = db.getXpSystem(interaction.guild.id);

      if (sub === 'toggle') {
        system.enabled = interaction.options.getBoolean('enabled');
        db.setXpSystem(interaction.guild.id, system);
        return interaction.reply({ embeds: [embed.success('XP System', `Leveling is now **${system.enabled ? 'Enabled' : 'Disabled'}**.`)] });
      }
      
      if (sub === 'channel') {
        const channel = interaction.options.getChannel('target');
        system.levelChannelId = channel.id;
        db.setXpSystem(interaction.guild.id, system);
        return interaction.reply({ embeds: [embed.success('XP System', `Level up announcements and leveling commands are now restricted to <#${channel.id}>.`)] });
      }

      if (sub === 'add_reward') {
        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');
        system.roleRewards[String(level)] = role.id;
        db.setXpSystem(interaction.guild.id, system);
        return interaction.reply({ embeds: [embed.success('XP System', `Users will now receive <@&${role.id}> at **Level ${level}**.`)] });
      }

      if (sub === 'add_multiplier') {
        const role = interaction.options.getRole('role');
        const mult = interaction.options.getNumber('multiplier');
        system.multipliers[role.id] = mult;
        db.setXpSystem(interaction.guild.id, system);
        return interaction.reply({ embeds: [embed.success('XP System', `Users with <@&${role.id}> will now gain **${mult}x** XP.`)] });
      }
    }
  },

  {
    name: 'rank',
    description: 'View your current rank and XP.',
    category: 'leveling',
    options: [
      { name: 'user', description: 'User to view', type: 6, required: false }
    ],
    async executeSlash(interaction) {
      const system = db.getXpSystem(interaction.guild.id);
      if (!system || !system.enabled) {
        return interaction.reply({ content: 'The XP system is currently disabled.', ephemeral: true });
      }

      if (system.levelChannelId && interaction.channelId !== system.levelChannelId) {
        return interaction.reply({ content: `Please use this command in <#${system.levelChannelId}>.`, ephemeral: true });
      }

      await interaction.deferReply();
      const targetUser = interaction.options.getUser('user') || interaction.user;
      let targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) targetMember = { user: targetUser, displayName: targetUser.username }; // Fallback

      const allUsers = db.getTopUsersXp(interaction.guild.id, 99999);
      let rank = allUsers.findIndex(u => u.userId === targetUser.id) + 1;
      
      const userXp = db.getUserXp(interaction.guild.id, targetUser.id);
      if (rank === 0 && userXp.xp > 0) {
        rank = allUsers.length + 1; // Fallback if not found in cache for some reason
      } else if (rank === 0) {
        rank = '-';
      }

      const requiredXp = calculateXpForLevel(userXp.level + 1);
      
      const attachment = await generateRankCard(targetMember, userXp.xp, userXp.level, rank, requiredXp);
      await interaction.editReply({ content: `${COIN} **${targetMember.displayName}'s Rank** ${TROPHY}`, files: [attachment] });
    }
  },

  {
    name: 'leaderboard',
    description: 'View the server XP leaderboard.',
    category: 'leveling',
    options: [
      { name: 'page', description: 'Page number', type: 4, required: false }
    ],
    async executeSlash(interaction) {
      const system = db.getXpSystem(interaction.guild.id);
      if (!system || !system.enabled) {
        return interaction.reply({ content: 'The XP system is currently disabled.', ephemeral: true });
      }

      if (system.levelChannelId && interaction.channelId !== system.levelChannelId) {
        return interaction.reply({ content: `Please use this command in <#${system.levelChannelId}>.`, ephemeral: true });
      }

      await interaction.deferReply();
      
      const allUsers = db.getTopUsersXp(interaction.guild.id, 100);
      const totalPages = Math.max(1, Math.ceil(allUsers.length / 10));
      const page = Math.max(1, Math.min(interaction.options.getInteger('page') || 1, totalPages));
      
      const startIdx = (page - 1) * 10;
      const paginatedUsers = allUsers.slice(startIdx, startIdx + 10);
      
      if (paginatedUsers.length === 0) {
        return interaction.editReply({ content: 'No users have gained XP yet!' });
      }

      const attachment = await generateLeaderboard(interaction.guild, paginatedUsers, page, totalPages);
      await interaction.editReply({ content: `${TROPHY} **Server Leaderboard** ${COIN}`, files: [attachment] });
    }
  }
];
