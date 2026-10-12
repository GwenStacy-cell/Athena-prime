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
  const statusLabel = system.enabled ? 'ONLINE & ACTIVE' : 'OFFLINE & PAUSED';

  // Determine current announcement setting text
  let announceSettingText = 'Current Channel (Active Chat)';
  const currentMode = system.announceMode || (system.announceChannelId ? 'channel' : 'current');
  if (currentMode === 'dm') {
    announceSettingText = 'Direct Message (User DM)';
  } else if (currentMode === 'disabled') {
    announceSettingText = 'Disabled (No Alerts)';
  } else if (system.announceChannelId) {
    announceSettingText = `<#${system.announceChannelId}> (Dedicated Channel)`;
  } else {
    announceSettingText = 'Current Channel (Where chatting)';
  }

  const cmdChannelText = system.cmdChannelId ? `<#${system.cmdChannelId}> (Restricted)` : 'All Channels (Unrestricted)';

  let rewardsText = 'None configured';
  if (Object.keys(system.roleRewards || {}).length > 0) {
    rewardsText = Object.entries(system.roleRewards)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([level, roleId]) => `Level ${level} -> <@&${roleId}>`)
      .join('\n-# • ');
  }

  let multipliersText = 'None configured (1.0x default)';
  if (Object.keys(system.multipliers || {}).length > 0) {
    multipliersText = Object.entries(system.multipliers)
      .map(([roleId, mult]) => `<@&${roleId}> (${mult}x)`)
      .join('\n-# • ');
  }

  const allUsers = db.getTopUsersXp(guildId, 99999);
  const totalTracked = allUsers.length;

  const container = {
    type: 17,
    components: [
      {
        type: 10,
        content:
          `# XP Manager\n` +
          `-# **__Interactive Leveling & XP Control Matrix__**\n\n` +
          `-# • **System Status:** ${statusIcon} **${statusLabel}**\n` +
          `-# • **Announcement Mode / Destination:** **${announceSettingText}**\n` +
          `-# • **Commands Channel:** **${cmdChannelText}**\n` +
          `-# • **Active Tracked Members:** **${totalTracked} users**\n` +
          `-# • **Base XP Rate:** **15 - 25 XP / msg (60s cooldown)**`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content:
          `-# **__Current Rewards & Multipliers__**\n` +
          `-# • **Level Role Rewards:**\n-# • ${rewardsText}\n\n` +
          `-# • **Role XP Boost Multipliers:**\n-# • ${multipliersText}`
      },
      { type: 14, divider: true },
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: 'xp_mode_select',
            placeholder: `Mode: ${currentMode === 'channel' ? 'Dedicated Channel' : currentMode === 'dm' ? 'Direct Message' : currentMode === 'disabled' ? 'Disabled' : 'Current Channel'}`,
            options: [
              { label: 'Current Channel', value: 'current', description: 'Announce in the active chat where member leveled up', default: currentMode === 'current' },
              { label: 'Direct Message (DM)', value: 'dm', description: 'Send level up card directly to member DMs', default: currentMode === 'dm' },
              { label: 'Dedicated Channel', value: 'channel_modal', description: 'Set specific announcement channel by ID', default: currentMode === 'channel' },
              { label: 'Disabled', value: 'disabled', description: 'Mute all level-up announcements', default: currentMode === 'disabled' }
            ]
          }
        ]
      },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'xp_toggle',       label: system.enabled ? 'Disable System' : 'Enable System', style: system.enabled ? 4 : 3 },
          { type: 2, custom_id: 'xp_set_announce', label: 'Announce Channel', style: 2 },
          { type: 2, custom_id: 'xp_set_cmd',      label: 'Command Channel',  style: 2 },
          { type: 2, custom_id: 'xp_clear',        label: 'Reset Setup',      style: 4 }
        ]
      },
      {
        type: 1,
        components: [
          { type: 6, custom_id: 'xp_add_reward', placeholder: 'Select role to add as Level Reward...', min_values: 1, max_values: 1 }
        ]
      },
      {
        type: 1,
        components: [
          { type: 6, custom_id: 'xp_add_multiplier', placeholder: 'Select roles for 1.5x XP Boost...', min_values: 1, max_values: 10 }
        ]
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: '-# Athena Prime Defense Matrix • Leveling System'
      }
    ]
  };

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
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
