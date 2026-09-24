import { PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { calculateXpForLevel } from '../utils/xpEngine.js';
import { generateRankCard, generateLeaderboard } from '../utils/canvasCards.js';

const TROPHY = '<a:trophy:1533859922599481577>';
const COIN = '<a:Boost2:1533859928949784776>';

export async function buildXpDashboard(guildId) {
  const { ActionRowBuilder, RoleSelectMenuBuilder, MessageFlags } = await import('discord.js');
  const system = db.getXpSystem(guildId);

  const ON  = '<:on:1533844867191406672>';
  const OFF = '<:off:1533844858983157851>';
  const statusIcon = system.enabled ? ON : OFF;

  let rewardsText = 'None';
  if (Object.keys(system.roleRewards || {}).length > 0) {
    rewardsText = Object.entries(system.roleRewards)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([level, roleId]) => `**Level ${level}**: <@&${roleId}>`)
      .join('\n');
  }

  let multipliersText = 'None';
  if (Object.keys(system.multipliers || {}).length > 0) {
    multipliersText = Object.entries(system.multipliers)
      .map(([roleId, mult]) => `<@&${roleId}> (**${mult}x**)`)
      .join('\n');
  }

  const container = {
    type: 17,
    components: [
      {
        type: 10,
        content:
          `## XP Manager\n` +
          `Welcome to the Interactive XP Control Panel.\n\n` +
          `**Status**: ${statusIcon}\n` +
          `**Announce Channel**: ${system.announceChannelId ? `<#${system.announceChannelId}>` : 'Not Set'}\n` +
          `**Command Channel**: ${system.cmdChannelId ? `<#${system.cmdChannelId}>` : 'Not Set'}`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: `-# Role Rewards (Auto-Milestones): ${rewardsText} \u2022 XP Multipliers (1.5x Auto-Boost): ${multipliersText}`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: `-# Athena Bulletproof Security System \u2022 V1.0.0`
      },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'xp_toggle',       label: system.enabled ? 'Disable System' : 'Enable System', style: system.enabled ? 4 : 3 },
          { type: 2, custom_id: 'xp_set_announce', label: 'Announce Ch (ID)', style: 1 },
          { type: 2, custom_id: 'xp_set_cmd',      label: 'Command Ch (ID)',  style: 1 },
          { type: 2, custom_id: 'xp_clear',        label: 'Clear Setup',      style: 4 },
          { type: 2, custom_id: 'xp_save',         label: 'Save Setup',       style: 3 }
        ]
      }
    ]
  };

  const selectRow1 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('xp_add_reward')
      .setPlaceholder('Select roles to automatically add as Level Reward')
      .setMinValues(1).setMaxValues(10)
  );

  const selectRow2 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('xp_add_multiplier')
      .setPlaceholder('Select roles to automatically grant a 1.5x XP Boost')
      .setMinValues(1).setMaxValues(10)
  );

  return { components: [container, selectRow1, selectRow2], flags: MessageFlags.IsComponentsV2 };
}

export const commands = [
  {
    name: 'xpsetup',
    description: 'Launch the Interactive XP Manager Control Panel.',
    category: 'admin',
    permissions: [PermissionFlagsBits.ManageGuild],
    options: [],
    async executePrefix(message) {
      const payload = await buildXpDashboard(message.guild.id);
      await message.reply(payload);
    },
    async executeSlash(interaction) {
      const payload = await buildXpDashboard(interaction.guild.id);
      await interaction.reply({ ...payload });
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
        return interaction.reply({ content: 'The XP system is currently disabled.' });
      }

      if (system.cmdChannelId && interaction.channelId !== system.cmdChannelId) {
        return interaction.reply({ content: `Please use this command in <#${system.cmdChannelId}>.` });
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
        return interaction.reply({ content: 'The XP system is currently disabled.' });
      }

      if (system.cmdChannelId && interaction.channelId !== system.cmdChannelId) {
        return interaction.reply({ content: `Please use this command in <#${system.cmdChannelId}>.` });
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
