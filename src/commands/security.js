import { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, TextDisplayBuilder, ContainerBuilder, MessageFlags } from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import db from '../database.js';
import cv2 from '../cv2.js';
import { 
  canModerate, 
  logToSecurityChannel, 
  getOrCreateQuarantineRole, 
  getOrCreateQuarantineChannel,
  isBotOwnerOrServerOwner,
  isBotOwnerOrServerOwnerStrict,
  isBotOwnerSync,
  isExtraOwner,
  syncQuarantinePermissions
} from '../utils/helpers.js';
import { connectToHomeVc, toggleBotDeafen } from '../utils/voice.js';
import { setupDashboardChannel } from '../utils/dashboardManager.js';
import { StringSelectMenuBuilder, UserSelectMenuBuilder, RoleSelectMenuBuilder } from 'discord.js';

// Toggle emoji constants — used throughout all security/config embeds
const TOGGLE_ON  = '<:on:1514996865030946847>';
const TOGGLE_OFF = '<:off:1514996861474177109>';

// ==========================================
// AUTO-UNQUARANTINE TIMER MAP
// key: `${guildId}-${userId}` -> setTimeout handle
// ==========================================
export const autoUnquarantineTimers = new Map();

/**
 * Parse a duration string into milliseconds.
 * Supports: 30s, 5m, 2h, 1d, or combos like 1h30m
 * Bare number = minutes. Default = 5 minutes.
 */
export function parseDuration(str) {
  if (!str) return 5 * 60 * 1000; // default 5m
  str = String(str).trim().toLowerCase();

  // Bare number → minutes
  if (/^\d+$/.test(str)) return Math.min(parseInt(str), 10080) * 60 * 1000;

  let ms = 0;
  const regex = /(\d+)([smhd])/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const val = parseInt(match[1]);
    switch (match[2]) {
      case 's': ms += val * 1000;         break;
      case 'm': ms += val * 60 * 1000;    break;
      case 'h': ms += val * 3600 * 1000;  break;
      case 'd': ms += val * 86400 * 1000; break;
    }
  }
  // Cap at 7 days
  return ms > 0 ? Math.min(ms, 7 * 86400 * 1000) : 5 * 60 * 1000;
}

/** Format ms into human-readable string e.g. "5m", "1h 30m" */
function formatDuration(ms) {
  const parts = [];
  const d = Math.floor(ms / 86400000); if (d) parts.push(`${d}d`);
  const h = Math.floor((ms % 86400000) / 3600000); if (h) parts.push(`${h}h`);
  const m = Math.floor((ms % 3600000) / 60000); if (m) parts.push(`${m}m`);
  const s = Math.floor((ms % 60000) / 1000); if (s && parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ') || '5m';
}

/**
 * Schedule an auto-unquarantine for a user.
 * Clears any existing timer for this user first.
 */
export function scheduleAutoUnquarantine(client, guildId, userId, durationMs) {
  const key = `${guildId}-${userId}`;
  // Clear existing timer if any
  if (autoUnquarantineTimers.has(key)) {
    clearTimeout(autoUnquarantineTimers.get(key));
  }
  const handle = setTimeout(async () => {
    autoUnquarantineTimers.delete(key);
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return;
      const botMember = guild.members.me;
      
      await executeUnquarantine(guild, member, botMember, 'auto');
    } catch (err) {
      console.error('[AutoUnquarantine]', err);
    }
  }, durationMs);
  autoUnquarantineTimers.set(key, handle);
}

export const commands = [
  // --- QUARANTINE COMMAND ---
  {
    name: 'quarantine',
    description: 'Isolates a user — strips roles, moves to quarantine VC, DMs them. Default duration: 5m.',
    category: 'security',
    permissions: [PermissionFlagsBits.ModerateMembers],
    options: [
      {
        name: 'user',
        description: 'The member to quarantine',
        type: 6,
        required: true
      },
      {
        name: 'duration',
        description: 'Duration e.g. 5m, 1h, 30s, 1d (default: 5m, max: 7d)',
        type: 3,
        required: false
      },
      {
        name: 'reason',
        description: 'Reason for the quarantine',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply(cv2.warn('Command Error', `${message.author} **Usage:** \`!quarantine <@user> [duration] [reason]\`\n\nExamples: \`!qr @user 10m spam\` / \`!qr @user 1h\``));
      }
      // args[0] = mention, args[1] could be duration or start of reason
      let remaining = args.slice(1);
      let durationMs = 5 * 60 * 1000; // default 5m
      if (remaining[0] && /^[\d]+[smhd]?$/i.test(remaining[0])) {
        durationMs = parseDuration(remaining[0]);
        remaining = remaining.slice(1);
      }
      const reason = remaining.join(' ').trim() || 'No reason provided';
      const result = await executeQuarantine(message.guild, target, message.member, reason, durationMs, message.client);
      if (result.success) await message.reply(result);
      else await message.reply(result.embed || cv2.danger('Quarantine Failed', result.message));
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const durationStr = interaction.options.getString('duration') || '5m';
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const durationMs = parseDuration(durationStr);

      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) return interaction.reply(cv2.warn('Command Error', `${interaction.user} Member not found.`));

      const result = await executeQuarantine(interaction.guild, target, interaction.member, reason, durationMs, interaction.client);
      if (result.success) await interaction.reply(result);
      else await interaction.reply(result.embed || cv2.danger('Quarantine Failed', result.message));
    }
  },

  // --- QR SHORT ALIAS ---
  {
    name: 'qr',
    description: 'Short alias for quarantine. Usage: /qr @user [duration] [reason]',
    category: 'security',
    permissions: [PermissionFlagsBits.ModerateMembers],
    options: [
      { name: 'user',     description: 'Member to quarantine', type: 6, required: true },
      { name: 'duration', description: 'Duration e.g. 5m 1h 1d (default 5m)', type: 3, required: false },
      { name: 'reason',   description: 'Reason',               type: 3, required: false }
    ],
    async executePrefix(message, args) {
      const target = message.mentions.members.first();
      if (!target) return message.reply(cv2.warn('Usage', `${message.author} **Usage:** \`!qr <@user> [duration] [reason]\``));
      let remaining = args.slice(1);
      let durationMs = 5 * 60 * 1000;
      if (remaining[0] && /^[\d]+[smhd]?$/i.test(remaining[0])) {
        durationMs = parseDuration(remaining[0]);
        remaining = remaining.slice(1);
      }
      const reason = remaining.join(' ').trim() || 'No reason provided';
      const result = await executeQuarantine(message.guild, target, message.member, reason, durationMs, message.client);
      if (result.success) await message.reply(result);
      else await message.reply(result.embed || cv2.danger('Quarantine Failed', result.message));
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const durationStr = interaction.options.getString('duration') || '5m';
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const durationMs = parseDuration(durationStr);
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) return interaction.reply(cv2.warn('Error', 'Member not found.'));
      const result = await executeQuarantine(interaction.guild, target, interaction.member, reason, durationMs, interaction.client);
      if (result.success) await interaction.reply(result);
      else await interaction.reply(result.embed || cv2.danger('Quarantine Failed', result.message));
    }
  },

  // --- UNQUARANTINE COMMAND ---
  {
    name: 'unquarantine',
    description: 'Restores a quarantined user to their original roles and lifts isolation.',
    category: 'security',
    permissions: [PermissionFlagsBits.ModerateMembers],
    options: [
      {
        name: 'user',
        description: 'The member to unquarantine',
        type: 6,
        required: true
      }
    ],
    async executePrefix(message) {
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply(cv2.warn('Command Error', `${message.author} Please mention a valid member to unquarantine.\n\n**Usage:** \`!unquarantine <@user>\``));
      }

      const result = await executeUnquarantine(message.guild, target, message.member);
      if (result.success) {
        await message.reply(result);
      } else {
        await message.reply(cv2.danger('Unquarantine Failed', result.message));
      }
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!target) {
        return interaction.reply(cv2.warn('Command Error', `${interaction.user} Member not found.`));
      }

      const result = await executeUnquarantine(interaction.guild, target, interaction.member);
      if (result.success) {
        await interaction.reply(result);
      } else {
        await interaction.reply(cv2.danger('Unquarantine Failed', result.message));
      }
    }
  },

  // --- EMERGENCY COMMANDS ---
  {
    name: 'emergency',
    slashHidden: true,
    description: 'Toggle Emergency Mode to strip permissions and hide channels.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'action',
        description: 'Start (mode) or Stop (end) the emergency',
        type: 3,
        required: true,
        choices: [
          { name: 'Enable Emergency Mode', value: 'mode' },
          { name: 'End Emergency', value: 'end' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const action = args[0]?.toLowerCase() === 'end' ? 'end' : 'mode';
      let statusMsg = null;
      const updateProgress = async (embedData) => {
        if (!statusMsg) statusMsg = await message.reply({ embeds: [embedData] }).catch(() => null);
        else await statusMsg.edit({ embeds: [embedData] }).catch(() => null);
      };
      const result = await handleEmergency(message.guild, message.member, action, updateProgress);
      if (statusMsg) await statusMsg.edit(result).catch(()=>null);
      else await message.reply(result);
    },
    async executeSlash(interaction) {
      const action = interaction.options.getString('action');
      await interaction.deferReply({ ephemeral: false }).catch(() => null);
      
      const updateProgress = async (embedData) => {
        await interaction.editReply({ embeds: [embedData] }).catch(() => null);
      };
      
      const result = await handleEmergency(interaction.guild, interaction.member, action, updateProgress);
      await interaction.editReply(result).catch(() => null);
    }
  },
  {
    name: 'endemergency',
    slashHidden: true,
    description: 'End an active Emergency Mode.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    async executePrefix(message, args) {
      let statusMsg = null;
      const updateProgress = async (embedData) => {
        if (!statusMsg) statusMsg = await message.reply({ embeds: [embedData] }).catch(() => null);
        else await statusMsg.edit({ embeds: [embedData] }).catch(() => null);
      };
      const result = await handleEmergency(message.guild, message.member, 'end', updateProgress);
      if (statusMsg) await statusMsg.edit(result).catch(()=>null);
      else await message.reply(result);
    },
    async executeSlash(interaction) {
      await interaction.deferReply({ ephemeral: false }).catch(() => null);
      
      const updateProgress = async (embedData) => {
        await interaction.editReply({ embeds: [embedData] }).catch(() => null);
      };
      
      const result = await handleEmergency(interaction.guild, interaction.member, 'end', updateProgress);
      await interaction.editReply(result).catch(() => null);
    }
  },

  // --- LOCKDOWN COMMAND ---
  {
    name: 'lockdown',
    slashHidden: true,
    description: 'Toggles text channel lockdown (on/off) preventing anyone from sending messages.',
    category: 'security',
    permissions: [PermissionFlagsBits.ManageChannels],
    options: [
      {
        name: 'mode',
        description: 'Lock or Unlock the channel',
        type: 3,
        required: true,
        choices: [
          { name: 'Enable Lockdown', value: 'on' },
          { name: 'Disable Lockdown', value: 'off' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const mode = args[0]?.toLowerCase() === 'off' ? 'off' : 'on';
      const result = await handleLockdown(message.guild, message.channel, message.member, mode);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const mode = interaction.options.getString('mode');
      const result = await handleLockdown(interaction.guild, interaction.channel, interaction.member, mode);
      await interaction.reply(result);
    }
  },

  // --- RAIDMODE COMMAND ---
  {
    name: 'raidmode',
    slashHidden: true,
    description: 'Toggles raid protection (locks joining members by auto-quarantining them instantly).',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'status',
        description: 'Turn raid mode ON or OFF',
        type: 3,
        required: true,
        choices: [
          { name: 'Enable Raid Protection', value: 'on' },
          { name: 'Disable Raid Protection', value: 'off' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const mode = args[0]?.toLowerCase() === 'on' ? 'on' : 'off';
      const result = await handleRaidMode(message.guild, message.member, mode);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const mode = interaction.options.getString('status');
      const result = await handleRaidMode(interaction.guild, interaction.member, mode);
      await interaction.reply(result);
    }
  },

  // --- WHITELIST COMMAND ---
  {
    name: 'whitelist',
    aliases: ['wl'],
    description: 'Manage Antinuke Whitelist for a User or Role.',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'target',
        description: 'Target User or Role to manage whitelist',
        type: 9, // Mentionable
        required: true
      }
    ],
    async executePrefix(message, args) {
      const allowed = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(message.author.id) || message.author.id === message.guild.ownerId || db.isExtraOwner(message.guild.id, message.author.id);
      if (!allowed) {
        return message.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
      }

      if (!args[0]) {
        const panel = await getWhitelistOverviewPanel(message.guild);
        return message.reply(panel);
      }

      const targetUser = message.mentions.users.first();
      const targetRole = message.mentions.roles.first();

      let targetId, type;
      if (targetUser) {
        targetId = targetUser.id;
        type = 'users';
      } else if (targetRole) {
        targetId = targetRole.id;
        type = 'roles';
      } else {
        // Fallback to checking if they provided an ID directly
        const rawId = args[0].replace(/[^0-9]/g, '');
        if (message.guild.roles.cache.has(rawId)) {
          targetId = rawId;
          type = 'roles';
        } else {
          // Assume user ID
          targetId = rawId;
          type = 'users';
        }
        
        if (!rawId) {
          return message.reply(cv2.warn('Invalid Target', 'Please mention a valid User or Role.'));
        }
      }

      const panel = await getWhitelistPanel(message.guild, targetId, type);
      await message.reply(panel);
    },
    async executeSlash(interaction) {
      const allowed = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(interaction.user.id) || interaction.user.id === interaction.guild.ownerId || db.isExtraOwner(interaction.guild.id, interaction.user.id);
      if (!allowed) {
        return interaction.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
      }

      const target = interaction.options.getMentionable('target');
      
      if (!target) {
        const panel = await getWhitelistOverviewPanel(interaction.guild);
        return interaction.reply(panel);
      }
      
      let targetId, type;
      if (target.user || !target.name) {
        // It's a user
        targetId = target.id;
        type = 'users';
      } else {
        // It's a role
        targetId = target.id;
        type = 'roles';
      }

      const panel = await getWhitelistPanel(interaction.guild, targetId, type);
      await interaction.reply(panel);
    }
  },

  // --- BLACKLIST COMMAND ---
  {
    name: 'blacklist',
    description: 'Manages word filter blacklists. Messages matching these terms are deleted and warned.',
    category: 'security',
    permissions: [PermissionFlagsBits.ModerateMembers],
    options: [
      {
        name: 'action',
        description: 'Choose blacklist action',
        type: 3,
        required: true,
        choices: [
          { name: 'Add Phrase', value: 'add' },
          { name: 'Remove Phrase', value: 'remove' },
          { name: 'List Phrases', value: 'list' }
        ]
      },
      {
        name: 'phrase',
        description: 'The word or phrase to add/remove (lowercase)',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const action = args[0]?.toLowerCase();
      const phrase = args.slice(1).join(' ');

      if (!action || (action !== 'list' && !phrase)) {
        return message.reply(cv2.warn('Command Error', `${message.author} Usage: \`!blacklist add <phrase>\`, \`!blacklist remove <phrase>\`, or \`!blacklist list\``));
      }

      const result = await handleBlacklist(message.guild, message.member, action, phrase);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const action = interaction.options.getString('action');
      const phrase = interaction.options.getString('phrase');

      if (action !== 'list' && !phrase) {
        return interaction.reply(cv2.warn('Command Error', `${interaction.user} Please specify a phrase parameter for this action.`));
      }

      const result = await handleBlacklist(interaction.guild, interaction.member, action, phrase);
      await interaction.reply(result);
    }
  },
  // --- AUTONICK COMMAND ---
  {
    name: 'autonick',
    description: 'Interactive Auto-nickname manager dashboard.',
    category: 'security',
    permissions: [PermissionFlagsBits.ManageNicknames],
    options: [],
    async executePrefix(message, args) {
      const payload = await buildAutonickDashboard(message.guild.id);
      await message.reply(payload);
    },
    async executeSlash(interaction) {
      const payload = await buildAutonickDashboard(interaction.guild.id);
      await interaction.reply(payload);
    }
  },

  // --- CONFIG COMMAND ---
  {
    name: 'config',
    description: 'Dynamically adjusts system parameters, warning ceilings, and security toggles.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'setting',
        description: 'Target setting parameter to configure',
        type: 3,
        required: true,
        choices: [
          { name: 'Anti-Nuke Protection Toggle', value: 'antinuke' },
          { name: 'Anti-Spam Filter Toggle', value: 'antispam' },
          { name: 'Anti-Invite Blocker Toggle', value: 'antiinvite' },
          { name: 'Max Warning Limit (1-10)', value: 'maxwarnings' }
        ]
      },
      {
        name: 'value',
        description: 'True/False for toggles, or numbers (1-10) for ceilings',
        type: 3,
        required: true
      }
    ],
    async executePrefix(message, args) {
      const setting = args[0]?.toLowerCase();
      const value = args[1]?.toLowerCase();

      if (!setting || !value) {
        return message.reply(cv2.warn('Command Error', `${message.author} Usage: \`!config <antinuke|antispam|antiinvite|maxwarnings> <on|off|number>\``));
      }

      const result = await handleConfig(message.guild, message.member, setting, value);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const setting = interaction.options.getString('setting');
      const value = interaction.options.getString('value');

      const result = await handleConfig(interaction.guild, interaction.member, setting, value);
      await interaction.reply(result);
    }
  },

  // --- MAXWARNINGS COMMAND ---
  {
    name: 'maxwarnings',
    description: 'Configure the maximum number of warnings before a member is auto-quarantined.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'limit',
        description: 'Maximum warnings allowed (1-10)',
        type: 4, // INTEGER
        required: true,
        min_value: 1,
        max_value: 10
      }
    ],
    async executePrefix(message, args) {
      const value = args[0];
      if (!value) {
        return message.reply(cv2.warn('Command Error', `${message.author} Usage: \`!maxwarnings <number>\``));
      }
      const result = await handleConfig(message.guild, message.member, 'maxwarnings', value.toString());
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const value = interaction.options.getInteger('limit');
      const result = await handleConfig(interaction.guild, interaction.member, 'maxwarnings', value.toString());
      await interaction.reply(result);
    }
  },

  // --- ANTINUKE COMMAND ---
  {
    name: 'antinuke',
    description: 'Configures the Anti-Nuke protections panel with buttons.',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'subcommand',
        description: 'Choose antinuke subcommand action',
        type: 3,
        required: true,
        choices: [
          { name: 'Open Config Panel', value: 'config' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const allowed = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(message.author.id) || message.author.id === message.guild.ownerId || db.isExtraOwner(message.guild.id, message.author.id);
      if (!allowed) {
        return message.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
      }
      
      const sub = args.join(' ').toLowerCase();

      if (sub === 'config' || sub === '') {
        const panel = await getAntinukeConfigPanel(message.guild);
        await message.reply(panel);
      } else {
        await message.reply(cv2.warn('Command Error', `${message.author} Usage: \`!antinuke config\``));
      }
    },
    async executeSlash(interaction) {
      const allowed = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(interaction.user.id) || interaction.user.id === interaction.guild.ownerId || db.isExtraOwner(interaction.guild.id, interaction.user.id);
      if (!allowed) {
        return interaction.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
      }

      const sub = interaction.options.getString('subcommand');

      if (sub === 'config') {
        const panel = await getAntinukeConfigPanel(interaction.guild);
        await interaction.reply(panel);
      }
    }
  },

  // --- SETHOMEVC COMMAND ---
  {
    name: 'sethomevc',
    description: 'Sets the Home Voice Channel for the bot to join and stay connected to.',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'channel',
        description: 'The Voice Channel (falls back to your current VC)',
        type: 7, // Channel
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = await isBotOwnerOrServerOwner(message.author, message.guild);
      if (!allowed) {
        return message.reply(cv2.danger('Permission Denied', `${message.author} This command is restricted to the Bot Owner and the Server Owner.`));
      }

      let channelId = args[0]?.replace(/[<#&>]/g, '');
      let channel = null;
      if (channelId) {
        channel = await message.guild.channels.fetch(channelId).catch(() => null);
      }
      if (!channel) {
        channel = message.mentions.channels.filter(c => c.isVoiceBased()).first();
      }
      if (!channel && args[0]) {
        channel = message.guild.channels.cache.find(c => c.name.toLowerCase() === args.join(' ').toLowerCase() && c.isVoiceBased());
      }
      if (!channel) {
        channel = message.member?.voice?.channel;
      }

      if (!channel || !channel.isVoiceBased()) {
        return message.reply(cv2.warn('Setup Error', `${message.author} Please mention a Voice Channel, specify its ID, or join a Voice Channel first.`));
      }

      db.updateGuildConfig(message.guild.id, { homeVcId: channel.id });
      connectToHomeVc(message.guild, channel.id);

      await message.reply(cv2.success('Home VC Configured', `Athena Prime has set **${channel.name}** (ID: \`${channel.id}\`) as its Home Voice Channel. The bot will now join and stay there.`));
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply(cv2.danger('Permission Denied', `${interaction.user} This command is restricted to the Bot Owner and the Server Owner.`));
      }

      const voiceChannel = interaction.options.getChannel('channel');
      let channel = voiceChannel || interaction.member?.voice?.channel;

      if (!channel || !channel.isVoiceBased()) {
        return interaction.reply(cv2.warn('Setup Error', `${interaction.user} Please specify a Voice Channel or join one first.`));
      }

      db.updateGuildConfig(interaction.guild.id, { homeVcId: channel.id });
      connectToHomeVc(interaction.guild, channel.id);

      await interaction.reply(cv2.success('Home VC Configured', `Athena Prime has set **${channel.name}** (ID: \`${channel.id}\`) as its Home Voice Channel. The bot will now join and stay there.`));
    }
  },

  // --- UNSETHOMEVC COMMAND ---
  {
    name: 'unsethomevc',
    description: 'Removes the Home Voice Channel setting and makes the bot leave the VC.',
    category: 'security',
    permissions: [],
    options: [],
    async executePrefix(message, args) {
      const allowed = await isBotOwnerOrServerOwner(message.author, message.guild);
      if (!allowed) {
        return message.reply(cv2.danger('Permission Denied', `${message.author} This command is restricted to the Bot Owner and the Server Owner.`));
      }

      db.updateGuildConfig(message.guild.id, { homeVcId: null });
      
      const { getVoiceConnection } = await import('@discordjs/voice');
      const connection = getVoiceConnection(message.guild.id);
      if (connection) connection.destroy();
      
      // Forcefully disconnect using Discord.js API to guarantee immediate leave
      await message.guild.members.me.voice.setChannel(null).catch(() => null);

      await message.reply(cv2.success('Home VC Removed', `Athena Prime's Home Voice Channel has been unset. The bot has disconnected from voice.`));
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply(cv2.danger('Permission Denied', `${interaction.user} This command is restricted to the Bot Owner and the Server Owner.`));
      }

      db.updateGuildConfig(interaction.guild.id, { homeVcId: null });
      
      const { getVoiceConnection } = await import('@discordjs/voice');
      const connection = getVoiceConnection(interaction.guild.id);
      if (connection) connection.destroy();
      
      // Forcefully disconnect using Discord.js API to guarantee immediate leave
      await interaction.guild.members.me.voice.setChannel(null).catch(() => null);

      await interaction.reply(cv2.success('Home VC Removed', `Athena Prime's Home Voice Channel has been unset. The bot has disconnected from voice.`));
    }
  },

  // --- SETGUILDAVATAR COMMAND ---
  {
    name: 'setguildavatar',
    description: "Sets the bot's custom server-specific guild member avatar.",
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'url',
        description: 'Direct image URL',
        type: 3,
        required: false
      },
      {
        name: 'image',
        description: 'Attach image file',
        type: 11,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
      if (!allowed) {
        return message.reply(cv2.danger('Permission Denied', `${message.author}  This command is restricted to the **Bot Owner** and **Server Owner** only. Extra Owners do not have access.`));
      }

      const url = args[0] || message.attachments.first()?.url;
      if (!url) {
        return message.reply(cv2.warn('Command Error', `${message.author} Please provide a direct image URL or attach an image.`));
      }

      const responseMsg = await message.reply(cv2.info('Updating Avatar', 'Attempting to configure guild-specific member avatar...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
        await message.client.rest.patch(`/guilds/${message.guild.id}/members/@me`, {
          body: { avatar: dataUri }
        });
        await responseMsg.edit(cv2.success('Avatar Configured', "Successfully updated the bot's server-specific avatar."));
      } catch (err) {
        console.error(err);
        await responseMsg.edit(cv2.danger('Update Failed', `Could not update avatar: ${err.message}`));
      }
    },
    async executeSlash(interaction) {
      const allowed = isBotOwnerOrServerOwnerStrict(interaction.user.id, interaction.guild);
      if (!allowed) {
        return interaction.reply(cv2.danger('Permission Denied', `${interaction.user}  This command is restricted to the **Bot Owner** and **Server Owner** only. Extra Owners do not have access.`));
      }

      const url = interaction.options.getString('url') || interaction.options.getAttachment('image')?.url;
      if (!url) {
        return interaction.reply(cv2.warn('Command Error', `${interaction.user} Please provide a direct image URL or attach an image.`));
      }

      await interaction.deferReply();

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
        await interaction.client.rest.patch(`/guilds/${interaction.guild.id}/members/@me`, {
          body: { avatar: dataUri }
        });
        await interaction.editReply(cv2.success('Avatar Configured', "Successfully updated the bot's server-specific avatar."));
      } catch (err) {
        console.error(err);
        await interaction.editReply(cv2.danger('Update Failed', `Could not update avatar: ${err.message}`));
      }
    }
  },

  // --- SETGUILDBANNER COMMAND ---
  {
    name: 'setguildbanner',
    description: "Sets the bot's custom server-specific guild member banner.",
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'url',
        description: 'Direct image URL',
        type: 3,
        required: false
      },
      {
        name: 'image',
        description: 'Attach image file',
        type: 11,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = isBotOwnerOrServerOwnerStrict(message.author.id, message.guild);
      if (!allowed) {
        return message.reply(cv2.danger('Permission Denied', `${message.author}  This command is restricted to the **Bot Owner** and **Server Owner** only. Extra Owners do not have access.`));
      }

      const url = args[0] || message.attachments.first()?.url;
      if (!url) {
        return message.reply(cv2.warn('Command Error', `${message.author} Please provide a direct image URL or attach an image.`));
      }

      const responseMsg = await message.reply(cv2.info('Updating Banner', 'Attempting to configure guild-specific member banner...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
        await message.client.rest.patch(`/guilds/${message.guild.id}/members/@me`, {
          body: { banner: dataUri }
        });
        await responseMsg.edit(cv2.success('Banner Configured', "Successfully updated the bot's server-specific banner."));
      } catch (err) {
        console.error(err);
        await responseMsg.edit(cv2.danger('Update Failed', `Could not update banner: ${err.message}`));
      }
    },
    async executeSlash(interaction) {
      const allowed = isBotOwnerOrServerOwnerStrict(interaction.user.id, interaction.guild);
      if (!allowed) {
        return interaction.reply(cv2.danger('Permission Denied', `${interaction.user}  This command is restricted to the **Bot Owner** and **Server Owner** only. Extra Owners do not have access.`));
      }

      const url = interaction.options.getString('url') || interaction.options.getAttachment('image')?.url;
      if (!url) {
        return interaction.reply(cv2.warn('Command Error', `${interaction.user} Please provide a direct image URL or attach an image.`));
      }

      await interaction.deferReply();

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
        await interaction.client.rest.patch(`/guilds/${interaction.guild.id}/members/@me`, {
          body: { banner: dataUri }
        });
        await interaction.editReply(cv2.success('Banner Configured', "Successfully updated the bot's server-specific banner."));
      } catch (err) {
        console.error(err);
        await interaction.editReply(cv2.danger('Update Failed', `Could not update banner: ${err.message}`));
      }
    }
  },

  // --- EXTRAOWNER COMMAND ---
  {
    name: 'extraowner',
    description: 'Manages extra owners who are immune to all moderation and can use all bot commands.',
    category: 'security',
    permissions: [],
    slashHidden: true,
    options: [
      {
        name: 'action',
        description: 'Choose action',
        type: 3,
        required: true,
        choices: [
          { name: 'Add Extra Owner', value: 'add' },
          { name: 'Remove Extra Owner', value: 'remove' },
          { name: 'List Extra Owners', value: 'list' }
        ]
      },
      {
        name: 'user',
        description: 'Target member for add/remove actions',
        type: 6,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = await isBotOwnerOrServerOwner(message.author, message.guild);
      if (!allowed) {
        return message.reply(cv2.danger('Permission Denied', `${message.author} Only the **Bot Owner** and **Server Owner** can manage extra owners.`));
      }

      const action = args[0]?.toLowerCase();
      let targetUser = message.mentions.users.first();
      
      if (!targetUser && args[1]) {
        targetUser = await message.client.users.fetch(args[1]).catch(() => null);
      }

      if (!action || (action !== 'list' && !targetUser)) {
        return message.reply(cv2.warn('Command Error', `${message.author} Usage: \`!extraowner add <@user|ID>\`, \`!extraowner remove <@user|ID>\`, or \`!extraowner list\``));
      }

      const result = await handleExtraOwner(message.guild, message.member, action, targetUser);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply(cv2.danger('Permission Denied', `${interaction.user} Only the **Bot Owner** and **Server Owner** can manage extra owners.`));
      }

      const action = interaction.options.getString('action');
      const targetUser = interaction.options.getUser('user');

      if (action !== 'list' && !targetUser) {
        return interaction.reply(cv2.warn('Command Error', `${interaction.user} Please specify a target user for this action.`));
      }

      const result = await handleExtraOwner(interaction.guild, interaction.member, action, targetUser);
      await interaction.reply(result);
    }
  },

  // --- GLOBAL BOT BLACKLIST COMMAND ---
  {
    name: 'userblacklist',
    description: '[BOT OWNER ONLY] Globally block a user from using Athena Prime commands.',
    category: 'security',
    permissions: [],
    slashHidden: true,
    options: [
      {
        name: 'action',
        description: 'Choose action',
        type: 3,
        required: true,
        choices: [
          { name: 'Flag User', value: 'add' },
          { name: 'Unflag User', value: 'remove' },
          { name: 'List Flagged', value: 'list' }
        ]
      },
      {
        name: 'user_id',
        description: 'Target user ID or mention',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) {
        return message.reply(cv2.danger('Permission Denied', `${message.author} Only the **Bot Owner** can manage the global bot blacklist.`));
      }

      const action = args[0]?.toLowerCase();
      let targetId = args[1]?.replace(/[<@!>]/g, '');

      if (!action || (action !== 'list' && !targetId)) {
        return message.reply(cv2.warn('Command Error', `${message.author} Usage: \`!userblacklist add <ID>\`, \`!userblacklist remove <ID>\`, or \`!userblacklist list\``));
      }

      const result = await handleBotBlacklist(action, targetId);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply(cv2.danger('Permission Denied', `${interaction.user} Only the **Bot Owner** can manage the global bot blacklist.`));
      }

      const action = interaction.options.getString('action');
      let targetId = interaction.options.getString('user_id')?.replace(/[<@!>]/g, '');

      if (action !== 'list' && !targetId) {
        return interaction.reply(cv2.warn('Command Error', `${interaction.user} Please specify a target user ID.`));
      }

      const result = await handleBotBlacklist(action, targetId);
      await interaction.reply(result);
    }
  },

  // --- BOTWHITELIST COMMAND ---
  {
    name: 'botwhitelist',
    description: 'Manages trusted bots that are allowed to be in the server (Anti-Nuke bot guard).',
    category: 'security',
    permissions: [],
    slashHidden: true,
    options: [
      {
        name: 'action',
        description: 'Choose action',
        type: 3,
        required: true,
        choices: [
          { name: 'Add Bot', value: 'add' },
          { name: 'Remove Bot', value: 'remove' },
          { name: 'List Bots', value: 'list' }
        ]
      },
      {
        name: 'bot_id',
        description: 'The bot\'s User ID (right-click → Copy ID)',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = await isBotOwnerOrServerOwner(message.author, message.guild);
      if (!allowed) {
        return message.reply(cv2.danger('Permission Denied', `${message.author} Only the **Bot Owner** and **Server Owner** can manage the bot whitelist.`));
      }
      const action = args[0]?.toLowerCase();
      const botId = args[1];
      if (!action || (action !== 'list' && !botId)) {
        return message.reply(cv2.warn('Usage', `${message.author} \`!botwhitelist add <botId>\`, \`!botwhitelist remove <botId>\`, or \`!botwhitelist list\``));
      }
      const result = await handleBotWhitelist(message.guild, action, botId);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply(cv2.danger('Permission Denied', `${interaction.user} Only the **Bot Owner** and **Server Owner** can manage the bot whitelist.`));
      }
      const action = interaction.options.getString('action');
      const botId = interaction.options.getString('bot_id');
      if (action !== 'list' && !botId) {
        return interaction.reply(cv2.warn('Error', `${interaction.user} Please provide the bot's User ID.`));
      }
      const result = await handleBotWhitelist(interaction.guild, action, botId);
      await interaction.reply(result);
    }
  },

  // --- ANTILINK COMMAND ---
  {
    name: 'antilink',
    description: 'Toggles anti-link protection that blocks ALL external URLs from non-moderators.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'status',
        description: 'Turn anti-link ON or OFF',
        type: 3,
        required: true,
        choices: [
          { name: 'Enable Anti-Link', value: 'on' },
          { name: 'Disable Anti-Link', value: 'off' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const mode = args[0]?.toLowerCase();
      if (mode !== 'on' && mode !== 'off') {
        return message.reply(cv2.warn('Command Error', `${message.author} Usage: \`!antilink <on|off>\``));
      }
      const result = await handleAntiLink(message.guild, message.member, mode);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const mode = interaction.options.getString('status');
      const result = await handleAntiLink(interaction.guild, interaction.member, mode);
      await interaction.reply(result);
    }
  },

  // --- SERVERINFO COMMAND ---
  {
    name: 'serverinfo',
    description: 'Displays comprehensive server statistics and security status.',
    category: 'security',
    permissions: [],
    async executePrefix(message) {
      const result = await getServerInfoEmbed(message.guild);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const result = await getServerInfoEmbed(interaction.guild);
      await interaction.reply(result);
    }
  },

  // --- USERINFO COMMAND ---
  {
    name: 'userinfo',
    description: 'Displays detailed information about a user including roles, warnings, and privileges.',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'user',
        description: 'The member to inspect (defaults to yourself)',
        type: 6,
        required: false
      }
    ],
    async executePrefix(message) {
      const target = message.mentions.members.first() || message.member;
      const result = await getUserInfoEmbed(message.guild, target);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!target) {
        return interaction.reply(cv2.warn('Command Error', `${interaction.user} Member not found.`));
      }

      const result = await getUserInfoEmbed(interaction.guild, target);
      await interaction.reply(result);
    }
  },

  // --- SECURITY COMMAND --- Enable/Disable ALL shields at once
  {
    name: 'security',
    aliases: ['ss'],
    description: 'Enables or disables ALL Athena Prime security features at once. (Bot Owner / Server Owner only)',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'action',
        description: 'Choose to enable or disable all security features',
        type: 3,
        required: true,
        choices: [
          { name: 'Enable All Security', value: 'enable_all' },
          { name: 'Disable All Security', value: 'disable_all' },
          { name: 'Security Status', value: 'status' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const allowed = isBotOwnerSync(message.author.id) || message.author.id === message.guild.ownerId;
      if (!allowed) {
        return message.reply(cv2.danger('Access Denied', ' Only the **Bot Owner** or **Server Owner** can use this command.'));
      }

      // Check if they used the `!ss` alias directly
      const cmdName = message.content.slice(process.env.DEFAULT_PREFIX?.length || 1).split(/ +/)[0].toLowerCase();
      let sub = args.join(' ').toLowerCase().trim();
      if (cmdName === 'ss') {
        sub = 'status';
      }

      const enable = (sub === 'enable all' || sub === 'enable_all');
      const disable = (sub === 'disable all' || sub === 'disable_all');
      const status = (sub === 'status');
      
      if (!enable && !disable && !status) {
        return message.reply(cv2.warn('Usage', `${message.author} Usage: \`!security enable all\`, \`!security disable all\`, or \`!security status\``));
      }

      if (status) {
        const panel = await getSecurityStatusPanel(message.guild);
        return message.reply(panel);
      }

      if (enable) {
        const config = db.getGuildConfig(message.guild.id);
        if (config.securityEnabled) {
          return message.reply(cv2.warn('Security Active', 'Security is already enabled on this server.'));
        }
        if (message.guild.memberCount < 200 && !isBotOwnerSync(message.author.id)) {
          return message.reply(cv2.danger('Requirement Not Met', 'Your server must have at least **200 members** to enable unbypassable security.\n\n*Bot Owners bypass this restriction.*'));
        }

        const initDisplay = new TextDisplayBuilder().setContent('# SECURITY SHIELD SEQUENCE\n\n<a:alert1:1533860044154732704> __**INITIALIZING SECURITY PROTOCOLS...**__');
        const initContainer = new ContainerBuilder().addTextDisplayComponents(initDisplay);
        const msg = await message.reply({ components: [initContainer], flags: MessageFlags.IsComponentsV2 });
        await runSecurityEnableSequence(message.guild, async (payload) => {
          await msg.edit(payload).catch(() => null);
        });
      } else if (disable) {
        const config = db.getGuildConfig(message.guild.id);
        if (!config.securityEnabled && !config.antiNukeEnabled) {
          return message.reply(cv2.warn('Security Inactive', 'Security is already disabled on this server.'));
        }

        const result = await handleSecurityToggleAll(message.guild, message.member, false);
        await message.reply(result);
      }
    },
    async executeSlash(interaction) {
      const allowed = isBotOwnerSync(interaction.user.id) || interaction.user.id === interaction.guild.ownerId;
      if (!allowed) {
        return interaction.reply(cv2.danger('Access Denied', ' Only the **Bot Owner** or **Server Owner** can use this command.'));
      }
      const action = interaction.options.getString('action');
      const enable = action === 'enable_all';
      const disable = action === 'disable_all';
      const status = action === 'status';

      if (status) {
        const panel = await getSecurityStatusPanel(interaction.guild);
        return interaction.reply(panel);
      }

      if (enable) {
        const config = db.getGuildConfig(interaction.guild.id);
        if (config.securityEnabled) {
          return interaction.reply(cv2.warn('Security Active', 'Security is already enabled on this server.'));
        }
        if (interaction.guild.memberCount < 200 && !isBotOwnerSync(interaction.user.id)) {
          return interaction.reply(cv2.danger('Requirement Not Met', 'Your server must have at least **200 members** to enable unbypassable security.\n\n*Bot Owners bypass this restriction.*'));
        }

        const initDisplay2 = new TextDisplayBuilder().setContent('# SECURITY SHIELD SEQUENCE\n\n<a:alert1:1533860044154732704> __**INITIALIZING SECURITY PROTOCOLS...**__');
        const initContainer2 = new ContainerBuilder().addTextDisplayComponents(initDisplay2);
        await interaction.reply({ components: [initContainer2], flags: MessageFlags.IsComponentsV2 });
        await runSecurityEnableSequence(interaction.guild, async (payload) => {
          await interaction.editReply(payload).catch(() => null);
        });
      } else if (disable) {
        const config = db.getGuildConfig(interaction.guild.id);
        if (!config.securityEnabled) {
          return interaction.reply(cv2.warn('Security Inactive', 'Security is already disabled on this server.'));
        }

        const result = await handleSecurityToggleAll(interaction.guild, interaction.member, false);
        await interaction.reply(result);
      }
    }
  },

  // --- QRMANAGER COMMAND --- Quarantine system setup and repair
  {
    name: 'qrmanager',
    description: 'Quarantine system manager — fix permissions, set role/channel/VC. (Admin only)',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'action',
        description: 'What to do',
        type: 3,
        required: true,
        choices: [
          { name: 'Setup & Fix All Permissions', value: 'setup' },
          { name: 'Set Quarantine Role',         value: 'setrole' },
          { name: 'Set Quarantine Text Channel', value: 'setchannel' },
          { name: 'Set Quarantine Voice Channel', value: 'setvc' },
          { name: 'View Status',                 value: 'status' }
        ]
      },
      {
        name: 'role',
        description: 'Role to set as quarantine role (for setrole)',
        type: 8,
        required: false
      },
      {
        name: 'channel',
        description: 'Channel to set (for setchannel or setvc)',
        type: 7,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const action = args[0]?.toLowerCase();
      if (!action) return message.reply(cv2.warn('Usage', 'Usage: `!qrmanager setup|setrole|setchannel|setvc|status`'));
      
      let role = message.mentions.roles.first() || null;
      let channel = message.mentions.channels.first() || null;
      
      if (!role && args[1] && action === 'setrole') {
        role = await message.guild.roles.fetch(args[1]).catch(() => null);
      }
      if (!channel && args[1] && (action === 'setchannel' || action === 'setvc')) {
        channel = await message.guild.channels.fetch(args[1]).catch(() => null);
      }
      
      const result = await handleQrManager(message.guild, message.member, action, role, channel);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      await interaction.deferReply();
      const action = interaction.options.getString('action');
      const role = interaction.options.getRole('role');
      const channel = interaction.options.getChannel('channel');
      const result = await handleQrManager(interaction.guild, interaction.member, action, role, channel);
      await interaction.editReply(result);
    }
  },



  // --- LINKSALLOW COMMAND --- Whitelist domains from anti-link filter
  {
    name: 'linksallow',
    description: 'Whitelist domains or allow ALL links. (Admin only)',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'action',
        description: 'What to do',
        type: 3,
        required: true,
        choices: [
          { name: 'Add Domain',        value: 'add' },
          { name: 'Remove Domain',     value: 'remove' },
          { name: 'List Domains',      value: 'list' },
          { name: 'Allow ALL Links',   value: 'allowall' },
          { name: 'Disallow All Links (reset)', value: 'disallowall' }
        ]
      },
      {
        name: 'domain',
        description: 'Domain to add/remove (e.g. youtube.com, tenor.com)',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const action = args[0]?.toLowerCase();
      const domain = args.slice(1).join(' ').trim();
      const nodomainActions = ['list', 'allowall', 'disallowall'];
      if (!action || (!nodomainActions.includes(action) && !domain)) {
        return message.reply(cv2.warn('Usage',
          `${message.author} \`!linksallow add <domain>\` / \`!linksallow remove <domain>\` / \`!linksallow list\` / \`!linksallow allowall\` / \`!linksallow disallowall\``
        ));
      }
      const result = await handleLinksAllow(message.guild, action, domain);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const action = interaction.options.getString('action');
      const domain = interaction.options.getString('domain');
      const nodomainActions = ['list', 'allowall', 'disallowall'];
      if (!nodomainActions.includes(action) && !domain) {
        return interaction.reply(cv2.warn('Missing Domain', 'Please provide a domain name.'));
      }
      const result = await handleLinksAllow(interaction.guild, action, domain);
      await interaction.reply(result);
    }
  },

  // --- MASSQUARANTINE COMMAND ---
  {
    name: 'massquarantine',
    description: 'Quarantine ALL members who have a specific role at once. (Admin only)',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'role',
        description: 'The role whose members will all be quarantined',
        type: 8,
        required: true
      },
      {
        name: 'reason',
        description: 'Reason for mass quarantine (shown in logs and DMs)',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const role = message.mentions.roles.first();
      if (!role) {
        return message.reply(cv2.warn('Usage', `${message.author} Usage: \`!massquarantine <@role> [reason]\``));
      }
      const reason = args.slice(1).join(' ').trim() || 'Mass quarantine by administrator';
      const statusMsg = await message.reply(cv2.info('Mass Quarantine Started', ` Quarantining all members with role <@&${role.id}>...`));
      const result = await handleMassQuarantine(message.guild, message.member, role, reason);
      await statusMsg.edit(result);
    },
    async executeSlash(interaction) {
      await interaction.deferReply();
      const role = interaction.options.getRole('role');
      const reason = interaction.options.getString('reason') || 'Mass quarantine by administrator';
      const result = await handleMassQuarantine(interaction.guild, interaction.member, role, reason);
      await interaction.editReply(result);
    }
  },

  // --- MASSUNQUARANTINE COMMAND ---
  {
    name: 'massunquarantine',
    description: 'Release ALL currently quarantined members in this server at once. (Admin only)',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [],
    async executePrefix(message) {
      const statusMsg = await message.reply(cv2.info('Mass Unquarantine Started', ' Releasing all quarantined members...'));
      const result = await handleMassUnquarantine(message.guild, message.member, message.client);
      await statusMsg.edit(result);
    },
    async executeSlash(interaction) {
      await interaction.deferReply();
      const result = await handleMassUnquarantine(interaction.guild, interaction.member, interaction.client);
      await interaction.editReply(result);
    }
  },

  // --- SCAN SERVER COMMAND ---
  {
    name: 'scanserver',
    slashHidden: true,
    description: 'Scan the server for unauthorized bots and manage them.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    async executePrefix(message) {
      if (!isBotOwnerOrServerOwnerStrict(message.author.id, message.guild) && !isExtraOwner(message.guild.id, message.author.id)) {
        return message.reply(cv2.danger('Permission Denied', 'Only Server Owners and Extra Owners can scan the server.'));
      }
      const result = await handleScanServer(message.guild);
      await message.reply(result);
    }
  },
  // --- LOCK APPS COMMAND ---
  {
    name: 'lockapps',
    slashHidden: true,
    description: 'Lock or unlock application commands for @everyone server-wide.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    async executePrefix(message, args) {
      if (!isBotOwnerOrServerOwnerStrict(message.author.id, message.guild) && !isExtraOwner(message.guild.id, message.author.id)) {
        return message.reply(cv2.danger('Permission Denied', 'Only Server Owners and Extra Owners can lock apps.'));
      }
      const mode = args[0]?.toLowerCase();
      if (mode !== 'on' && mode !== 'off') {
        return message.reply(cv2.warn('Invalid Usage', 'Usage: `!lockapps on` or `!lockapps off`'));
      }
      const statusMsg = await message.reply(cv2.info('Updating Channels', 'Processing permissions for all channels. This may take a moment...'));
      
      const allow = mode === 'off';
      let successCount = 0;
      
      for (const channel of message.guild.channels.cache.values()) {
        if (!channel.isTextBased() && channel.type !== ChannelType.GuildVoice) continue;
        try {
           await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
             UseApplicationCommands: allow ? null : false
           });
           successCount++;
        } catch(e) {}
      }
      
      if (allow) {
        await statusMsg.edit(cv2.success('Apps Unlocked', `Successfully unlocked application commands in ${successCount} channels for @everyone.`));
      } else {
        await statusMsg.edit(cv2.success('Apps Locked', `Successfully locked application commands in ${successCount} channels for @everyone.`));
      }
    }
  },
  // --- UNLOCK APPS COMMAND ---
  {
    name: 'unlockapps',
    slashHidden: true,
    description: 'Unlock application commands for @everyone server-wide.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    async executePrefix(message, args) {
      if (!isBotOwnerOrServerOwnerStrict(message.author.id, message.guild) && !isExtraOwner(message.guild.id, message.author.id)) {
        return message.reply(cv2.danger('Permission Denied', 'Only Server Owners and Extra Owners can unlock apps.'));
      }
      const statusMsg = await message.reply(cv2.info('Updating Channels', 'Processing permissions for all channels. This may take a moment...'));
      
      let successCount = 0;
      
      for (const channel of message.guild.channels.cache.values()) {
        if (!channel.isTextBased() && channel.type !== ChannelType.GuildVoice) continue;
        try {
           await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
             UseApplicationCommands: null
           });
           successCount++;
        } catch(e) {}
      }
      
      await statusMsg.edit(cv2.success('Apps Unlocked', `Successfully unlocked application commands in ${successCount} channels for @everyone.`));
    }
  }

];

// Helper to check for Bot Owner exclusively
async function isBotOwnerOnly(user) {
  const client = user.client;
  try {
    if (!client.application.owner) {
      await client.application.fetch();
    }
    const owner = client.application.owner;
    if (owner) {
      if (owner.id) return user.id === owner.id;
      if (owner.members) return owner.members.has(user.id);
    }
  } catch (error) {
    console.error(error);
  }
  return false;
}

/**
 * Helper to fetch a media link URL and convert it into a Buffer for Discord API uploads
 */
async function getImageBuffer(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP fetch failed with status: ${response.status} ${response.statusText}`);
    let contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // If it's a video file, convert it to a high-quality GIF using FFmpeg
    if (contentType.includes('video/mp4') || url.toLowerCase().includes('.mp4')) {
      const tempId = Math.random().toString(36).substring(2, 15);
      const tempMp4Path = path.join(os.tmpdir(), `athena_in_${tempId}.mp4`);
      const tempGifPath = path.join(os.tmpdir(), `athena_out_${tempId}.gif`);
      
      await fs.writeFile(tempMp4Path, buffer);
      
      await new Promise((resolve, reject) => {
        ffmpeg(tempMp4Path)
          .outputOptions([
            '-vf', 'fps=20,scale=min(iw\\,600):-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
            '-loop', '0',
            '-t', '15' // Max 15 seconds
          ])
          .toFormat('gif')
          .on('end', resolve)
          .on('error', (err) => reject(new Error(`FFmpeg conversion failed: ${err.message}`)))
          .save(tempGifPath);
      });
      
      buffer = await fs.readFile(tempGifPath);
      contentType = 'image/gif';
      
      // Cleanup temporary files
      await fs.unlink(tempMp4Path).catch(() => null);
      await fs.unlink(tempGifPath).catch(() => null);
    }

    return { buffer, contentType };
  } catch (error) {
    throw new Error(`Failed to resolve image buffer from media link: ${error.message}`);
  }
}

// ==========================================
// CORE ISOLATION/QUARANTINE ENGINE
// ==========================================

export async function executeQuarantine(guild, targetMember, moderator, reason, durationMs = null, client = null) {
  // 1. Untouchable Check
  if (isBotOwnerSync(targetMember.id) || guild.ownerId === targetMember.id) {
    return { 
      success: false, 
      embed: cv2.danger('Untouchable', `Command overridden. **${targetMember.user.tag}** is untouchable and immune to all moderation protocols.`)
    };
  }

  // 2. Extraowner Immunity (Bypass if moderator is Bot Owner/Server Owner)
  if (isExtraOwner(guild.id, targetMember.id)) {
    if (!isBotOwnerSync(moderator.id) && guild.ownerId !== moderator.id) {
       return { success: false, message: ' This user is an Extra Owner and cannot be quarantined by regular moderators.' };
    }
  }

  // 1. Check permission checks (if triggered by a moderator and not an auto-event)
  if (moderator.id !== guild.members.me.id && !canModerate(moderator, targetMember)) {
    return { success: false, message: `You do not have enough power to quarantine **${targetMember.user.tag}**.` };
  }

  // 2. Check if already quarantined
  const existingRecord = db.getQuarantine(guild.id, targetMember.id);
  if (existingRecord) {
    return { success: false, message: `**${targetMember.user.tag}** is already quarantined.` };
  }

  try {
    // 3. Resolve role and channel
    const quarantineRole = await getOrCreateQuarantineRole(guild);
    if (!quarantineRole) {
      return { success: false, message: 'Could not create or locate the Quarantined role.' };
    }

    const quarantineChannel = await getOrCreateQuarantineChannel(guild, quarantineRole);
    if (!quarantineChannel) {
      return { success: false, message: 'Could not create or locate the quarantine-zone channel.' };
    }

    // Ensure the quarantine channel explicitly allows the quarantine role to view + chat
    // (needed because syncQuarantinePermissions denies it on all channels)
    await quarantineChannel.permissionOverwrites.edit(quarantineRole, {
      ViewChannel:  true,
      SendMessages: true,
      Connect:      false, // no VC in text channel — just text
      ReadMessageHistory: true
    }, { reason: 'Quarantine zone access grant' }).catch(() => null);

    // BACKGROUND SYNC: Enforce isolation across the entire server
    // This dynamically hides all other channels from the quarantine role
    syncQuarantinePermissions(guild, quarantineRole, quarantineChannel.id).catch(() => null);

    // Capture target voice state
    const prevVoiceChannelId = targetMember.voice.channelId || null;

    // 4. Save original roles to DB (filter out managed integration roles and @everyone)
    const roleIdsToSave = targetMember.roles.cache
      .filter(r => !r.managed && r.id !== guild.id)
      .map(r => r.id);

    const expiresAt = durationMs ? Date.now() + durationMs : null;
    db.addQuarantine(guild.id, targetMember.id, roleIdsToSave, reason, prevVoiceChannelId, expiresAt);

    // If target is connected to voice and quarantineVcId is set, drag them to the isolated VC
    const config = db.getGuildConfig(guild.id);
    if (prevVoiceChannelId && config.quarantineVcId) {
      const qvc = await guild.channels.fetch(config.quarantineVcId).catch(() => null);
      if (qvc) {
        await targetMember.voice.setChannel(qvc, 'Quarantine Isolation Voice Movement').catch(() => null);
      }
    }

    // 5. Strip all roles and add quarantine role (preserving managed roles to avoid API crash)
    const managedRoles = targetMember.roles.cache.filter(r => r.managed).map(r => r.id);
    const newRoles = [...managedRoles, quarantineRole.id];
    
    await targetMember.roles.set(newRoles, `Quarantined by ${moderator.user?.tag || 'System'} | Reason: ${reason}`);

    // 6. Schedule auto-unquarantine if duration set
    if (durationMs && client) {
      scheduleAutoUnquarantine(client, guild.id, targetMember.id, durationMs);
    }

    // 7. DM target user
    const durationLabel = durationMs ? formatDuration(durationMs) : 'Until manually lifted';
    const dmEmbed = cv2.danger(
      'Server Isolation Notice',
      ` You have been placed under **Quarantine** in **${guild.name}**.`,
      [
        { name: 'Reason', value: reason },
        { name: 'Duration', value: durationLabel, inline: true },
        { name: 'Assigned By', value: `${moderator.user?.tag || 'Automated System'}`, inline: true },
        { name: 'Instructions', value: `Your access to the rest of the server has been restricted. Please navigate to <#${quarantineChannel.id}> to resolve this matter.` }
      ]
    );
    await targetMember.send({ embeds: [dmEmbed] }).catch(() => null);

    // 7. Ping target in quarantine channel and post welcome alert
    const welcomeEmbed = cv2.danger(
      'You Have Been Quarantined',
      `Hello ${targetMember}. You have been isolated in this channel due to security policies or staff intervention.`,
      [
        { name: 'Target User', value: `${targetMember.user.tag}`, inline: true },
        { name: 'Reason', value: reason },
        { name: 'Next Steps', value: 'Please wait patiently for a Administrator or Moderator to review your case. Any further spamming or rule violations will result in a permanent ban.' }
      ]
    );
    await quarantineChannel.send({ content: `${targetMember}`, embeds: [welcomeEmbed] }).catch(() => null);

    // 8. Log the event to logs channel
    logToSecurityChannel(guild, cv2.log(
      'Quarantine Applied',
      `Member has been isolated.`,
      [
        { name: 'Target', value: `${targetMember.user.tag} (${targetMember.id})`, inline: true },
        { name: 'Enforcer', value: `${moderator.user?.tag || 'System'}`, inline: true },
        { name: 'Reason', value: reason }
      ],
      'danger'
    ));



    const responseEmbed = cv2.danger(
      'User Quarantined',
      `Successfully quarantined **${targetMember.user.tag}**.`,
      [
        { name: 'Member',      value: `${targetMember}`,           inline: true },
        { name: 'Enforced by', value: `${moderator}`,              inline: true },
        { name: 'Duration',    value: durationLabel,               inline: true },
        { name: 'Channel',     value: `<#${quarantineChannel.id}>`, inline: true },
        { name: 'Reason',      value: reason }
      ]
    );

    return { success: true, embed: responseEmbed };
  } catch (error) {
    console.error('Error applying quarantine:', error);
    return { success: false, message: 'An error occurred during isolation. Check role hierarchies.' };
  }
}

export async function executeUnquarantine(guild, targetMember, moderator, context = null) {
  const record = db.getQuarantine(guild.id, targetMember.id);
  if (!record) {
    return { success: false, message: `**${targetMember.user.tag}** has no active quarantine records on disk.` };
  }

  try {
    const quarantineRole = await getOrCreateQuarantineRole(guild);
    
    // Determine restore role IDs
    const savedRoleIds = record.roles || [];
    const managedRoleIds = targetMember.roles.cache.filter(r => r.managed).map(r => r.id);
    
    // Add saved + managed, remove quarantine
    const restoreRoles = [...new Set([...savedRoleIds, ...managedRoleIds])].filter(id => id !== quarantineRole?.id);

    // Remove DB entry BEFORE restoring roles so the guildMemberUpdate interceptor doesn't falsely strip them!
    db.removeQuarantine(guild.id, targetMember.id);

    await targetMember.roles.set(restoreRoles, `Unquarantined by ${moderator.user?.tag || 'System'}`);

    // If target was in voice before quarantine, and is currently connected to voice, restore their channel position
    if (record.previousVoiceChannelId && targetMember.voice.channelId) {
      const prevVc = await guild.channels.fetch(record.previousVoiceChannelId).catch(() => null);
      if (prevVc) {
        await targetMember.voice.setChannel(prevVc, 'Quarantine Release Voice Restoration').catch(() => null);
      }
    }

    // DM target user
    let dmEmbed;
    if (context === 'raidmode') {
      dmEmbed = cv2.success(
        'Raid Mode Ended',
        `<:emoji_16:1533860111704002665> The server Lockdown/Raid Mode in **${guild.name}** has been lifted!\nYour original access privileges have been fully restored.`,
        []
      );
    } else {
      dmEmbed = cv2.success(
        'Isolation Terminated',
        `<a:alert1:1533860044154732704> Your quarantine status has been lifted in **${guild.name}**! Your original access privileges have been fully restored.`,
        []
      );
    }
    await targetMember.send({ embeds: [dmEmbed] }).catch(() => null);

    // Log the event
    if (context === 'auto') {
      logToSecurityChannel(guild, cv2.info(
        'Auto-Unquarantine',
        `<@${targetMember.id}>'s quarantine duration expired — automatically released.`
      ));
    } else {
      logToSecurityChannel(guild, cv2.log(
        'Quarantine Lifted',
        `Member has been restored.`,
        [
          { name: 'Target', value: `${targetMember.user.tag} (${targetMember.id})`, inline: true },
          { name: 'Moderator', value: `${moderator.user?.tag || 'System'}`, inline: true }
        ],
        'success'
      ));
    }

    const responseEmbed = cv2.success(
      'Quarantine Lifted',
      `Successfully restored **${targetMember.user.tag}** and recovered their original role structure.`,
      [
        { name: 'User', value: `${targetMember}`, inline: true },
        { name: 'Moderator', value: `${moderator}`, inline: true }
      ]
    );

    return { success: true, embed: responseEmbed };
  } catch (error) {
    console.error('Error lifting quarantine:', error);
    return { success: false, message: 'Failed to restore roles. Ensure my role position is higher than the roles being restored.' };
  }
}

// ==========================================
// EMERGENCY, LOCKDOWN & RAIDMODE HANDLERS
// ==========================================

export async function handleEmergency(guild, moderator, action, updateProgress) {
  // Ensure we have a high privilege to use this
  if (!isBotOwnerSync(moderator.id) && moderator.id !== guild.ownerId) {
    return cv2.danger('Access Denied', 'Only the Server Owner and Bot Owners can trigger Emergency Mode. Extra Owners are not authorized to use this command.');
  }

  const botMember = await guild.members.fetch(guild.client.user.id);
  const botHighestRolePosition = botMember.roles.highest.position;

  if (action === 'mode') {
    const currentState = db.getEmergencyState(guild.id);
    if (currentState) {
      return cv2.warn('Emergency Active', 'Emergency Mode is already active.');
    }

    if (updateProgress) await updateProgress(cv2.warn('Emergency Protocol Initiated', 'Calculating role and channel overwrites...'));

    const stateToSave = { roles: [], channels: [] };

    // 1. Process Channels FIRST (Immediate visual lockdown)
    const channelsToModify = [];
    await guild.channels.fetch().catch(() => null); // Ensure cache is full
    guild.channels.cache.forEach(channel => {
      if (!channel.permissionOverwrites) return;
      
      const overwrites = channel.permissionOverwrites.cache.map(ow => ({
        id: ow.id,
        type: ow.type,
        allow: ow.allow.bitfield.toString(),
        deny: ow.deny.bitfield.toString()
      }));

      stateToSave.channels.push({ id: channel.id, overwrites });
      channelsToModify.push(channel);
    });

    let cCount = 0;
    let cErrors = 0;
    const channelPromises = channelsToModify.map(channel => async () => {
      try {
        const isProtectedCommunityChannel = (channel.id === guild.rulesChannelId || channel.id === guild.publicUpdatesChannelId);
        await channel.permissionOverwrites.set([
          {
            id: guild.id,
            deny: isProtectedCommunityChannel ? [PermissionFlagsBits.SendMessages] : [PermissionFlagsBits.ViewChannel],
            type: 0
          },
          {
            id: botMember.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            type: 1
          }
        ], `Emergency Mode triggered by ${moderator.user.tag}`);
        
        cCount++;
        if (cCount % 15 === 0 && updateProgress) updateProgress(cv2.warn('Emergency Protocol Initiated', `Hiding channels: **${cCount} / ${channelsToModify.length}** processed...`)).catch(()=>null);
      } catch (e) {
        cErrors++;
        console.error(`Failed to modify channel ${channel.id} during emergency`, e.message);
      }
    });

    // Run channel modifications in batches of 5 for speed
    for (let i = 0; i < channelPromises.length; i += 5) {
      await Promise.allSettled(channelPromises.slice(i, i + 5).map(fn => fn()));
    }

    // 2. Process Roles SECOND
    const rolesToModify = [];
    guild.roles.cache.forEach(role => {
      if (role.position >= botHighestRolePosition || role.managed) return;
      if (botMember.roles.cache.has(role.id)) return;
      
      stateToSave.roles.push({ id: role.id, perms: role.permissions.bitfield.toString() });
      rolesToModify.push(role);
    });

    let rCount = 0;
    let rErrors = 0;
    const rolePromises = rolesToModify.map(role => async () => {
      try {
        await role.setPermissions(0n, `Emergency Mode triggered by ${moderator.user.tag}`);
        rCount++;
        if (rCount % 10 === 0 && updateProgress) updateProgress(cv2.warn('Emergency Protocol Initiated', `Stripping permissions: **${rCount} / ${rolesToModify.length}** processed...`)).catch(()=>null);
      } catch (e) {
        rErrors++;
        console.error(`Failed to modify role ${role.id} during emergency`, e.message);
      }
    });

    // Run role modifications in batches of 5 for speed
    for (let i = 0; i < rolePromises.length; i += 5) {
      await Promise.allSettled(rolePromises.slice(i, i + 5).map(fn => fn()));
    }

    db.saveEmergencyState(guild.id, stateToSave);

    logToSecurityChannel(guild, cv2.log('Emergency Mode Activated', `**${moderator.user.tag}** has triggered Emergency Mode! All roles below the bot have been stripped of permissions and channels are hidden.`, [], 'danger'));

    try {
      const owner = await guild.members.fetch(guild.ownerId);
      if (owner) {
        owner.send(cv2.danger('SERVER EMERGENCY ACTIVATED', `**${moderator.user.tag}** has triggered Emergency Mode in **${guild.name}**.\n\nAll permissions have been stripped and channels hidden to contain the threat. To restore normal operations, use \`!end emergency\`.`)).catch(() => null);
      }
    } catch(e) {}

    let errorWarning = '';
    if (rErrors > 0 || cErrors > 0) {
      errorWarning = `\n\n<a:alert1:1533860044154732704> **WARNING:** Failed to modify ${rErrors} roles and ${cErrors} channels. (Note: Discord prevents bots from hiding Community Default/Onboarding channels). Ensure the bot's role is placed at the top and has Administrator privileges.`;
    }

    return cv2.danger('EMERGENCY MODE ACTIVATED', `All channels have been hidden and all permissions have been stripped from roles. Use \`!end emergency\` or \`/endemergency\` to restore the server.${errorWarning}`);

  } else if (action === 'end') {
    const savedState = db.getEmergencyState(guild.id);
    if (!savedState) {
      return cv2.info('No Emergency', 'Emergency Mode is not currently active on this server.');
    }

    if (updateProgress) await updateProgress(cv2.info('Restoring Server', 'Calculating original role and channel states...'));

    let rolesRestored = 0;
    let rErrors = 0;
    for (const roleData of savedState.roles) {
      const role = guild.roles.cache.get(roleData.id);
      if (role) {
        try {
          await role.setPermissions(BigInt(roleData.perms), `Emergency Mode ended by ${moderator.user.tag}`);
          rolesRestored++;
          if (rolesRestored % 10 === 0 && updateProgress) await updateProgress(cv2.info('Restoring Server', `Restoring permissions: **${rolesRestored} / ${savedState.roles.length}** processed...`)).catch(()=>null);
        } catch(e) {
          rErrors++;
          console.error(`Failed to restore role ${role.id}`, e);
        }
      }
    }

    let channelsRestored = 0;
    let cErrors = 0;
    for (const cData of savedState.channels) {
      const channel = guild.channels.cache.get(cData.id);
      if (channel) {
        try {
          // Reconstruct the Overwrite objects
          const overwrites = cData.overwrites.map(ow => ({
            id: ow.id,
            type: ow.type,
            allow: BigInt(ow.allow),
            deny: BigInt(ow.deny)
          }));
          await channel.permissionOverwrites.set(overwrites, `Emergency Mode ended by ${moderator.user.tag}`);
          channelsRestored++;
          if (channelsRestored % 10 === 0 && updateProgress) await updateProgress(cv2.info('Restoring Server', `Restoring channels: **${channelsRestored} / ${savedState.channels.length}** processed...`)).catch(()=>null);
        } catch(e) {
          cErrors++;
          console.error(`Failed to restore channel ${channel.id}`, e);
        }
      }
    }

    db.clearEmergencyState(guild.id);

    logToSecurityChannel(guild, cv2.log('Emergency Mode Ended', `**${moderator.user.tag}** has ended Emergency Mode. Restored ${rolesRestored} roles and ${channelsRestored} channels.`, [], 'success'));

    try {
      const owner = await guild.members.fetch(guild.ownerId);
      if (owner) {
        owner.send(cv2.success('EMERGENCY RESOLVED', `**${moderator.user.tag}** has ended Emergency Mode in **${guild.name}**.\n\nAll permissions and channel visibilities have been fully restored.`)).catch(() => null);
      }
    } catch(e) {}

    let errorWarning = '';
    if (rErrors > 0 || cErrors > 0) {
      errorWarning = `\n\n<a:alert1:1533860044154732704> **WARNING:** Failed to restore ${rErrors} roles and ${cErrors} channels. You may need to fix them manually.`;
    }

    return cv2.success('Emergency Mode Ended', `All permissions and channel visibilities have been restored.${errorWarning}`);
  }
}

// ==========================================

async function handleLockdown(guild, channel, moderator, mode) {
  try {
    if (mode === 'on') {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false
      });
      const lockEmbed = cv2.danger(
        'Lockdown Activated', 
        `<:emoji_16:1533860111704002665> This channel has been placed under administrative lockdown by **${moderator.user.tag}**. Writing has been disabled.`
      );
      logToSecurityChannel(guild, cv2.log('Channel Locked', `Moderator **${moderator.user.tag}** locked down channel **#${channel.name}**.`, [], 'warning'));
      return lockEmbed;
    } else {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null
      });
      const unlockEmbed = cv2.success(
        'Lockdown Deactivated', 
        `<:emoji_16:1533860111704002665> Channel lockdown has been lifted by **${moderator.user.tag}**. Permission to write has been restored.`
      );
      logToSecurityChannel(guild, cv2.log('Channel Unlocked', `Moderator **${moderator.user.tag}** unlocked channel **#${channel.name}**.`, [], 'success'));
      return unlockEmbed;
    }
  } catch (error) {
    console.error(error);
    return cv2.danger('Lockdown Toggle Failed', 'Could not modify permissions for this channel.');
  }
}

async function handleRaidMode(guild, moderator, mode) {
  const enabled = mode === 'on';
  db.updateGuildConfig(guild.id, { raidMode: enabled });

  if (enabled) {
    const resEmbed = cv2.raid(
      'Raid Mode Engaged',
      `<a:alert1:1533860044154732704> **Server Raid Protection is now ACTIVE.**\nAll joining accounts will be automatically quarantined immediately to protect the server until deactivated.`,
      [{ name: 'Enforced by', value: `${moderator}` }]
    );
    logToSecurityChannel(guild, cv2.log('Raid Mode Active', `Administrator **${moderator.user.tag}** turned ON Guild Raid Mode.`, [], 'raid'));
    return resEmbed;
  } else {
    // Automatically mass unquarantine everyone caught in the raid
    const unquarantineResult = await handleMassUnquarantine(guild, moderator, guild.client, 'raidmode');
    
    let releaseNote = '';
    if (unquarantineResult.embed.data.title !== 'Nothing to Release') {
       releaseNote = `\n\n**Auto-Release Triggered:**\n${unquarantineResult.embed.data.description}`;
    } else {
       releaseNote = `\n\n*(No quarantined accounts to release)*`;
    }

    const resEmbed = cv2.success(
      'Raid Mode Disengaged',
      ` **Server Raid Protection is now OFF.**\nNew accounts can join normally.${releaseNote}`,
      [{ name: 'Lifted by', value: `${moderator}` }]
    );
    logToSecurityChannel(guild, cv2.log(
      'Raid Mode Off', 
      `Administrator **${moderator.user.tag}** turned OFF Guild Raid Mode.`, 
      [], 
      'success'
    ));
    return resEmbed;
  }
}

export async function getWhitelistPanel(guild, targetId, type, view = 'info') {
  const wData = db.getWhitelist(guild.id, targetId, type) || { modules: [], triggerLimit: 0, currentUsage: 0 };
  
  // Try to resolve name
  let targetName = 'Unknown Target';
  if (type === 'users') {
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (member) targetName = member.user.tag;
    else targetName = `<@${targetId}>`;
  } else {
    const role = guild.roles.cache.get(targetId);
    if (role) targetName = role.name;
    else targetName = `<@&${targetId}>`;
  }

  const modLabels = {
    antiRoleCreate: 'Anti Role Create',
    antiRoleDelete: 'Anti Role Delete',
    antiRoleUpdate: 'Anti Role Update',
    antiRolePermUpdate: 'Anti Role Perm Update',
    antiMemberRoleUpdate: 'Anti Member Role Update',
    antiRoleReorder: 'Anti Role Reorder',
    antiChannelCreate: 'Anti Channel Create',
    antiChannelDelete: 'Anti Channel Delete',
    antiChannelUpdate: 'Anti Channel Update',
    antiChannelPermUpdate: 'Anti Channel Perm Update',
    antiChannelReorder: 'Anti Channel Reorder',
    antiChannelNameMod: 'Anti Channel Name Mod',
    antiEmojiCreate: 'Anti Emoji Create',
    antiEmojiDelete: 'Anti Emoji Delete',
    antiEmojiUpdate: 'Anti Emoji Update',
    antiWebhooks: 'Anti Webhooks',
    antiBotAdd: 'Anti Bot Add',
    antiServerUpdate: 'Anti Server Update',
    antiBan: 'Anti Ban / Kick',
    antiKick: 'Anti Ban / Kick',
    antiUnban: 'Anti Unban Members',
    antiInvite: 'Anti Invite (Danger)'
  };

  const emojiOn = '<:on:1514996865030946847>'; 
  const emojiOff = '<:off:1514996861474177109>'; 
  
  const modulesKeys = Object.keys(modLabels);
  
  let moduleListText = '';
  
  for (const k of modulesKeys) {
    const isEnabled = wData.modules.includes('all') || wData.modules.includes(k);
    moduleListText += `> ${isEnabled ? emojiOn : emojiOff} ${modLabels[k]}\n`;
  }

  const limitText = wData.triggerLimit === 0 ? '0' : wData.triggerLimit;
  
  const description = 
    `# WHITELIST ACCESS\n` +
    `-# **${targetName}** (${targetId})\n\n` +
    `-# **Custom Action Limits:** ${limitText}\n` +
    `-# **Authorized for ${modulesKeys.length} security event categories.**\n\n` +
    moduleListText;

  const mainDisplay = new TextDisplayBuilder().setContent(description);
  const panelContainer = new ContainerBuilder().addTextDisplayComponents(mainDisplay);

  if (view === 'info') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wl_manage_${type}_${targetId}`).setLabel('Manage').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`wl_close`).setLabel('Close').setStyle(ButtonStyle.Secondary)
    );
    panelContainer.addActionRowComponents(row);
  } else {
    const options = modulesKeys.map(k => {
      const isEnabled = wData.modules.includes('all') || wData.modules.includes(k);
      return {
        label: modLabels[k],
        value: k,
        emoji: isEnabled ? { id: '1514996865030946847' } : { id: '1514996861474177109' }
      };
    }).slice(0, 25);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wl_all_${type}_${targetId}`).setLabel('Whitelist All').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`wl_reset_${type}_${targetId}`).setLabel('Reset All').setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wl_limit_5_${type}_${targetId}`).setLabel('5 Actions').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`wl_limit_10_${type}_${targetId}`).setLabel('10 Actions').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`wl_limit_15_${type}_${targetId}`).setLabel('15 Actions').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`wl_limit_custom_${type}_${targetId}`).setLabel('Custom').setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`wl_select_${type}_${targetId}`)
        .setPlaceholder('Select a permissions category...')
        .setMinValues(1)
        .setMaxValues(options.length)
        .addOptions(options)
    );
    
    const row4 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wl_save_${type}_${targetId}`).setLabel('Save Changes').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`wlo_back`).setLabel('Close').setStyle(ButtonStyle.Secondary)
    );

    panelContainer.addActionRowComponents(row1, row2, row3, row4);
  }

  return { components: [panelContainer], flags: MessageFlags.IsComponentsV2 };
}

export async function getWhitelistOverviewPanel(guild) {
  const wlData = db.getAllWhitelists(guild.id);
  
  const userIds = Object.keys(wlData.users || {});
  const roleIds = Object.keys(wlData.roles || {});
  
  let usersText = userIds.length > 0 
    ? userIds.map(id => `| <@${id}>`).slice(0, 10).join('\n') + (userIds.length > 10 ? '\n| ...and more' : '')
    : '| None';
    
  let rolesText = roleIds.length > 0
    ? roleIds.map(id => `| <@&${id}>`).slice(0, 10).join('\n') + (roleIds.length > 10 ? '\n| ...and more' : '')
    : '| None';

  const description = 
    `# WL OVERVIEW\n` +
    `-# **${guild.name} !**\n\n` +
    `**Users Whitelisted**\n\n` +
    `${usersText}\n\n` +
    `**Roles Whitelisted**\n\n` +
    `${rolesText}`;

  const mainDisplay = new TextDisplayBuilder().setContent(description);
  const panelContainer = new ContainerBuilder().addTextDisplayComponents(mainDisplay);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('wlo_manage_users').setLabel('Manage Users').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('wlo_remove_users').setLabel('Remove User').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('wlo_add_users').setLabel('Add User').setStyle(ButtonStyle.Secondary)
  );
  
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('wlo_manage_roles').setLabel('Manage Roles').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('wlo_remove_roles').setLabel('Remove Role').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('wlo_add_roles').setLabel('Add Role').setStyle(ButtonStyle.Secondary)
  );
  
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('wl_close').setLabel('Close').setStyle(ButtonStyle.Secondary)
  );

  panelContainer.addActionRowComponents(row1, row2, row3);

  return { components: [panelContainer], flags: MessageFlags.IsComponentsV2 };
}

export async function getWhitelistSelectPanel(guild, type, action) {
  const isUser = type === 'users';
  let placeholder = '';
  let menu = null;
  
  const wlData = db.getAllWhitelists(guild.id);
  const ids = Object.keys(wlData[type] || {});

  if (action === 'add') {
    placeholder = `Select a ${isUser ? 'user' : 'role'} to add to whitelist`;
    if (isUser) {
      menu = new UserSelectMenuBuilder().setCustomId(`wlo_selectadd_${type}`).setPlaceholder(placeholder);
    } else {
      menu = new RoleSelectMenuBuilder().setCustomId(`wlo_selectadd_${type}`).setPlaceholder(placeholder);
    }
  } else {
    placeholder = action === 'manage' 
      ? `Select a ${isUser ? 'user' : 'role'} to manage permissions`
      : `Select a ${isUser ? 'user' : 'role'} to remove from whitelist`;
      
    if (ids.length === 0) {
      menu = new StringSelectMenuBuilder()
        .setCustomId('disabled_menu')
        .setPlaceholder(`No whitelisted ${type} found.`)
        .setDisabled(true)
        .addOptions([{ label: 'None', value: 'none' }]);
    } else {
      const options = [];
      for (const id of ids.slice(0, 25)) {
        if (isUser) {
          const u = await guild.client.users.fetch(id).catch(()=>null);
          options.push({ label: u ? u.tag : id, value: id });
        } else {
          const r = guild.roles.cache.get(id);
          options.push({ label: r ? r.name : id, value: id });
        }
      }
      menu = new StringSelectMenuBuilder()
        .setCustomId(`wlo_select${action}_${type}`)
        .setPlaceholder(placeholder)
        .addOptions(options);
    }
  }

  const description = `| Select a ${isUser ? 'user' : 'role'} to ${action === 'manage' ? 'manage their whitelist permissions' : (action === 'add' ? 'add to whitelist' : 'remove from whitelist')}`;
    
  const mainDisplay = new TextDisplayBuilder().setContent(description);
  const panelContainer = new ContainerBuilder().addTextDisplayComponents(mainDisplay);
  
  const row1 = new ActionRowBuilder().addComponents(menu);
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('wlo_back').setLabel('Back').setStyle(ButtonStyle.Secondary)
  );

  panelContainer.addActionRowComponents(row1, row2);
  return { components: [panelContainer], flags: MessageFlags.IsComponentsV2 };
}

async function handleBlacklist(guild, moderator, action, phrase) {
  if (action === 'add') {
    const success = db.addBlacklistWord(guild.id, phrase);
    if (success) {
      logToSecurityChannel(guild, cv2.log('Word Filter Added', `Moderator **${moderator.user.tag}** blacklisted phrase: "${phrase}".`, [], 'warning'));
      return cv2.success('Word Blacklisted', `Successfully blacklisted term **"${phrase.toLowerCase()}"**. Messages matching this phrase will be deleted.`);
    } else {
      return cv2.info('Already Blacklisted', `Term **"${phrase.toLowerCase()}"** is already blacklisted.`);
    }
  } else if (action === 'remove') {
    const success = db.removeBlacklistWord(guild.id, phrase);
    if (success) {
      logToSecurityChannel(guild, cv2.log('Word Filter Removed', `Moderator **${moderator.user.tag}** un-blacklisted phrase: "${phrase}".`, [], 'success'));
      return cv2.success('Word Un-blacklisted', `Successfully removed **"${phrase.toLowerCase()}"** from word blacklist.`);
    } else {
      return cv2.warn('Not Blacklisted', `Term **"${phrase.toLowerCase()}"** is not currently blacklisted.`);
    }
  } else {
    const config = db.getGuildConfig(guild.id);
    const list = config.blacklistWords || [];
    if (list.length === 0) {
      return cv2.success('Blacklist Empty', 'There are no active blacklisted words in this server.');
    }
    const formattedWords = list.map(w => `• \`${w}\``).join('\n');
    return cv2.info('Filtered Word Blacklist', `If a non-moderator sends a message matching any of these terms, it will be deleted immediately:\n\n${formattedWords}`);
  }
}
export async function buildAutonickDashboard(guildId) {
  let cfg = db.getGuildConfig(guildId);
  if (!cfg.autonick) {
    cfg.autonick = { enabled: false, prefix: '', suffix: '', layout: '{name}' };
    db.updateGuildConfig(guildId, { autonick: cfg.autonick });
  }

  const state = cfg.autonick.enabled ? 'ENABLED' : 'DISABLED';
  const color = cfg.autonick.enabled ? 'success' : 'danger';
  const layout = cfg.autonick.layout || '{name}';
  const exampleName = layout.replace('{name}', 'Username');
  
  const dashboardEmbed = embed[color]('Autonick Manager', `**Status:** \`${state}\`\n**Current Layout:** \`${layout}\`\n**Example Preview:** \`${exampleName}\`\n\nUse the buttons below to cleanly manage the Auto-nickname settings.`);

  const toggleBtn = new ButtonBuilder()
    .setCustomId('autonick_toggle')
    .setLabel(cfg.autonick.enabled ? 'Disable' : 'Enable')
    .setStyle(cfg.autonick.enabled ? ButtonStyle.Danger : ButtonStyle.Success);
    
  const editBtn = new ButtonBuilder()
    .setCustomId('autonick_edit')
    .setLabel('Edit Layout')
    .setStyle(ButtonStyle.Primary);
    
  const syncBtn = new ButtonBuilder()
    .setCustomId('autonick_sync')
    .setLabel('Sync Members')
    .setStyle(ButtonStyle.Secondary);

  const restoreBtn = new ButtonBuilder()
    .setCustomId('autonick_restore')
    .setLabel('Restore Names')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(toggleBtn, editBtn, syncBtn);
  const row2 = new ActionRowBuilder().addComponents(restoreBtn);
  return { embeds: [dashboardEmbed], components: [row, row2] };
}
async function handleConfig(guild, moderator, setting, value) {
  const updates = {};
  
  if (setting === 'maxwarnings') {
    const num = parseInt(value);
    if (isNaN(num) || num < 1 || num > 10) {
      return cv2.warn('Invalid Setting', 'Maximum warnings must be a number between 1 and 10.');
    }
    updates.maxWarnings = num;
    db.updateGuildConfig(guild.id, updates);

    logToSecurityChannel(guild, cv2.log('Config Updated', `Administrator **${moderator.user.tag}** set maxWarnings to **${num}**.`, [], 'success'));
    return cv2.success('Warnings Limit Updated', 
      `Exceeding **${num} Warnings** will now result in an automated server quarantine.\n\n` +
      `**Factors that apply Warnings:**\n` +
      `- Usage of Blacklisted Words\n` +
      `- Chat Spam or Mass Mentions (Anti-Spam)\n` +
      `- Sending External Links (Anti-Link)\n` +
      `- Sending Discord Invites (Anti-Invite)\n` +
      `- Manual warnings via the \`/warn\` command\n\n` +
      `> **Zero-Tolerance Actions:** Critical server damage like deleting/creating channels, roles, emojis, or adding unauthorized bots will completely bypass this warning system and result in an **instant ban**.`
    );
  }

  if (value !== 'on' && value !== 'off') {
    return cv2.warn('Invalid Value', 'Value for toggles must be either `on` or `off` (e.g. `!config antispam off`).');
  }

  const enabled = value === 'on';

  if (setting === 'antinuke') {
    updates.antiNukeEnabled = enabled;
    db.updateGuildConfig(guild.id, updates);
    const modeDesc = enabled ? `${TOGGLE_ON} ACTIVE (Rapid deletions or bans trigger instant quarantine)` : `${TOGGLE_OFF} DEACTIVATED`;
    logToSecurityChannel(guild, cv2.log('Config Anti-Nuke Toggle', `Administrator **${moderator.user.tag}** toggled Anti-Nuke to **${value.toUpperCase()}**.`, [], enabled ? 'success' : 'warning'));
    
    if (enabled) {
      setupDashboardChannel(guild, guild.client);
    }
    
    return cv2.success('Anti-Nuke Configured', `Anti-Nuke server protections are now **${modeDesc}**.`);
  } else if (setting === 'antispam') {
    updates.antiSpamEnabled = enabled;
    db.updateGuildConfig(guild.id, updates);
    const modeDesc = enabled ? `${TOGGLE_ON} ACTIVE` : `${TOGGLE_OFF} DEACTIVATED`;
    logToSecurityChannel(guild, cv2.log('Config Anti-Spam Toggle', `Administrator **${moderator.user.tag}** toggled Anti-Spam to **${value.toUpperCase()}**.`, [], enabled ? 'success' : 'warning'));
    return cv2.success('Anti-Spam Configured', `Automated rate-limit filters are now **${modeDesc}**.`);
  } else if (setting === 'antiinvite') {
    updates.antiInviteEnabled = enabled;
    db.updateGuildConfig(guild.id, updates);
    const modeDesc = enabled ? `${TOGGLE_ON} ACTIVE` : `${TOGGLE_OFF} DEACTIVATED`;
    logToSecurityChannel(guild, cv2.log('Config Anti-Invite Toggle', `Administrator **${moderator.user.tag}** toggled Anti-Invite to **${value.toUpperCase()}**.`, [], enabled ? 'success' : 'warning'));
    return cv2.success('Anti-Invite Configured', `Discord invite link auto-mod is now **${modeDesc}**.`);
  }

  return cv2.warn('Config Error', 'Unknown configuration option.');
}

export async function getAntinukeConfigPanel(guild) {
  const config = db.getGuildConfig(guild.id);

  const blacklistState = config.blacklistWords && config.blacklistWords.length > 0;
  const spamState = config.antiSpamEnabled;
  const inviteState = config.antiInviteEnabled !== false;
  const nukeState = config.antiNukeEnabled;

  const emojiOn = '<:on:1514996865030946847>'; 
  const emojiOff = '<:off:1514996861474177109>'; 

  const description = 
    `# MODULE CONFIGURATION\n` +
    `-# **Athena Prime — God-Tier Firewall**\n\n` +
    `> ${nukeState ? emojiOn : emojiOff} Anti-Nuke Firewall\n` +
    `> ${spamState ? emojiOn : emojiOff} Anti-Spam Filter\n` +
    `> ${inviteState ? emojiOn : emojiOff} Anti-Invite Blocker\n` +
    `> ${blacklistState ? emojiOn : emojiOff} Word Filter (${config.blacklistWords ? config.blacklistWords.length : 0} Words)\n` +
    `> Punishment: \`${config.antiNukePunishment.toUpperCase()}\`\n` +
    `> Warn Limit: \`${config.maxWarnings}\`\n\n` +
    `-# Raw API strike engine active — nuke bots eliminated in ~1-3ms`;

  const mainDisplay = new TextDisplayBuilder().setContent(description);
  const panelContainer = new ContainerBuilder().addTextDisplayComponents(mainDisplay);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_antinuke')
      .setLabel(`Anti-Nuke ${nukeState ? 'ON' : 'OFF'}`)
      .setEmoji(nukeState ? { id: '1514996865030946847' } : { id: '1514996861474177109' })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('toggle_spam')
      .setLabel(`Anti-Spam ${spamState ? 'ON' : 'OFF'}`)
      .setEmoji(spamState ? { id: '1514996865030946847' } : { id: '1514996861474177109' })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('toggle_invite')
      .setLabel(`Anti-Invite ${inviteState ? 'ON' : 'OFF'}`)
      .setEmoji(inviteState ? { id: '1514996865030946847' } : { id: '1514996861474177109' })
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_blacklist_filter')
      .setLabel(`Word Filter ${blacklistState ? 'ON' : 'OFF'}`)
      .setEmoji(blacklistState ? { id: '1514996865030946847' } : { id: '1514996861474177109' })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('cycle_punishment')
      .setLabel(`Punishment: ${config.antiNukePunishment.toUpperCase()}`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('sec_status_back')
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('save_panel')
      .setLabel('Save & Close')
      .setStyle(ButtonStyle.Secondary)
  );

  panelContainer.addActionRowComponents(row1, row2);

  return { components: [panelContainer], flags: MessageFlags.IsComponentsV2 };
}

export async function handleAntinukeToggleAll(guild, moderator, enable) {
  // NOTE: autonick is intentionally NOT touched — it must be enabled manually by server owner
  const updates = {
    antiNukeEnabled:   enable,
    antiSpamEnabled:   enable,
    antiInviteEnabled: enable,
    antiLinkEnabled:   enable,
    antinukeModules:   {}
  };

  const allKeys = ['antiRoleCreate', 'antiRoleDelete', 'antiRoleUpdate', 'antiRolePermUpdate', 'antiMemberRoleUpdate', 'antiRoleReorder', 'antiChannelCreate', 'antiChannelDelete', 'antiChannelUpdate', 'antiChannelPermUpdate', 'antiChannelReorder', 'antiChannelNameMod', 'antiEmojiCreate', 'antiEmojiDelete', 'antiEmojiUpdate', 'antiWebhooks', 'antiBotAdd', 'antiServerUpdate', 'antiBan', 'antiKick', 'antiUnban', 'antiInvite', 'antiScheduledEvents', 'antiMemberPurge', 'antiMassBan', 'antiAutomodUpdate', 'antiAppCommands'];
  for (const key of allKeys) {
    updates.antinukeModules[key] = enable;
  }

  db.updateGuildConfig(guild.id, updates);

  if (enable) {
    const config = db.getGuildConfig(guild.id);
    if (!config.blacklistWords || config.blacklistWords.length === 0) {
      db.addBlacklistWord(guild.id, 'hack');
      db.addBlacklistWord(guild.id, 'nuke');
      db.addBlacklistWord(guild.id, 'spam');
    }
  } else {
    db.updateGuildConfig(guild.id, { blacklistWords: [] });
  }

  const resEmbed = enable
    ? cv2.success(
        '<:on:1514996865030946847> God-Tier Firewall — Fully Operational',
        `<:on:1514996865030946847> **Firewall Layer:** Raw API Strike Engine Active
<:on:1514996865030946847> **Predictive Layer:** Behavioral Pattern Detection Online
<:on:1514996865030946847> **Restoration Layer:** Zero-Latency Channel & Role Recovery
<:on:1514996865030946847> **Condemned Cache:** Instant nuker skip-to-restoration active

*Athena Prime's firewall now operates at raw HTTP speed. Nuke bots are eliminated in ~1-3 milliseconds via a direct Discord API strike. Predictive quarantine intercepts suspicious admins before they can cause structural damage. Unauthorized channels are instantly deleted, deleted channels are instantly restored.*

*(Use 'antinuke config' or individual commands to fine-tune modules)*`,
        [
          { name: 'Anti-Nuke',  value: `${TOGGLE_ON} ACTIVE`, inline: true },
          { name: 'Anti-Spam',  value: `${TOGGLE_ON} ACTIVE`, inline: true },
          { name: '<:emoji_16:1533860111704002665> Anti-Invite', value: `${TOGGLE_ON} ACTIVE`, inline: true },
          { name: '<:emoji_16:1533860111704002665> Anti-Link',  value: `${TOGGLE_ON} ACTIVE`, inline: true },
          { name: '<:emoji_16:1533860111704002665> Word Filter', value: `${TOGGLE_ON} ACTIVE`, inline: true },
          { name: 'Enforced by', value: `${moderator}`, inline: true }
        ]
      )
    : cv2.warn(
        'All Shields Disengaged',
        `Athena Prime firewall layers have been **DEACTIVATED** server-wide. The server is now unprotected.`,
        [{ name: 'Lifted by', value: `${moderator}` }]
      );

  logToSecurityChannel(guild, cv2.log(
    'Toggle All Security',
    `Administrator **${moderator.user.tag}** toggled all shields **${enable ? 'ON' : 'OFF'}**.`,
    [],
    enable ? 'success' : 'warning'
  ));

  return resEmbed;
}

// ==========================================
// NEW COMMAND HANDLERS
// ==========================================

async function handleExtraOwner(guild, moderator, action, targetUser) {
  if (action === 'add') {
    if (!targetUser) return cv2.warn('Missing User', 'Please specify a user to add as extra owner.');
    
    const success = db.addExtraOwner(guild.id, targetUser.id);
    if (success) {
      logToSecurityChannel(guild, cv2.log('Extra Owner Added', `**${moderator.user.tag}** added **${targetUser.tag}** as an Extra Owner.`, [], 'success'));
      return cv2.owner('Extra Owner Added', `Successfully added **${targetUser.tag}** as an **Extra Owner**.\n\nThey are now:\n• __**Immune**__ to all moderation actions\n• __**Authorized**__ to use all bot commands\n• __**Whitelisted**__ from all auto-mod filters`);
    } else {
      return cv2.info('Already Extra Owner', `**${targetUser.tag}** is already registered as an Extra Owner.`);
    }
  } else if (action === 'remove') {
    if (!targetUser) return cv2.warn('Missing User', 'Please specify a user to remove from extra owners.');
    
    const success = db.removeExtraOwner(guild.id, targetUser.id);
    if (success) {
      logToSecurityChannel(guild, cv2.log('Extra Owner Removed', `**${moderator.user.tag}** removed **${targetUser.tag}** from Extra Owners.`, [], 'warning'));
      return cv2.success('Extra Owner Removed', `Successfully removed **${targetUser.tag}** from Extra Owners. They no longer have owner-level privileges.`);
    } else {
      return cv2.warn('Not Extra Owner', `**${targetUser.tag}** is not currently an Extra Owner.`);
    }
  } else {
    // List
    const owners = db.getExtraOwners(guild.id);
    if (owners.length === 0) {
      return cv2.info('No Extra Owners', `There are no extra owners configured for this server.\n\n**Bot Owner:** <@${process.env.OWNER_ID || 'Unknown'}>\n**Server Owner:** <@${guild.ownerId}>`);
    }

    const formattedList = owners.map(id => `• <@${id}> (ID: \`${id}\`)`).join('\n');
    return cv2.owner('Extra Owners List', `**Bot Owner:** <@${process.env.OWNER_ID || 'Unknown'}>\n**Server Owner:** <@${guild.ownerId}>\n\n**Extra Owners:**\n${formattedList}`);
  }
}

async function handleBotWhitelist(guild, action, botId) {
  const cleanId = botId ? botId.replace(/[<@&!>]/g, '') : null;
  
  if (action === 'add') {
    if (!cleanId || !/^\d{17,20}$/.test(cleanId)) return cv2.warn('Invalid ID', 'Please provide a valid bot User ID or a Role mention/ID.');
    db.addBotToWhitelist(guild.id, cleanId);
    
    const isRole = guild.roles.cache.has(cleanId);
    let desc = '';
    if (isRole) {
      desc = `Role <@&${cleanId}> has been added to the **Bot Whitelist**.\n\n` +
             `• Any bot that has this role is instantly granted **100% full immunity** to all Anti-Nuke protections.\n` +
             `• They can create/delete channels, manage roles, kick, and ban without triggering the firewall.\n` +
             `• To revoke a specific bot's immunity, simply remove the <@&${cleanId}> role from them, or use \`!botwhitelist remove <@&${cleanId}>\` to unwhitelist the role entirely.`;
    } else {
      desc = `Bot ID <@${cleanId}> (\`${cleanId}\`) has been added to the **Bot Whitelist**.\n\n` +
             `• This bot is instantly granted **100% full immunity** to all Anti-Nuke protections.\n` +
             `• It can create/delete channels, manage roles, kick, and ban without triggering the firewall.\n` +
             `• To revoke this immunity, use \`!botwhitelist remove ${cleanId}\`.`;
    }
    
    return cv2.success('Whitelisted', desc);
  } else if (action === 'remove') {
    if (!cleanId) return cv2.warn('Missing ID', 'Please provide the Bot/Role ID to remove.');
    db.removeBotFromWhitelist(guild.id, cleanId);
    return cv2.success('Removed', `ID \`${cleanId}\` has been removed from the Bot Whitelist. It no longer has Anti-Nuke immunity.`);
  } else {
    const list = db.getBotWhitelist(guild.id);
    if (list.length === 0) return cv2.info('No Whitelisted Bots/Roles', 'No bots or roles are currently whitelisted.\n\nUse `!botwhitelist add <botId/roleId>` to whitelist a trusted bot or role.');
    
    const formatted = await Promise.all(list.map(async id => {
      const role = guild.roles.cache.get(id);
      if (role) return `• **Role:** ${role} (\`${id}\`)`;
      
      const user = await guild.client.users.fetch(id).catch(() => null);
      if (user) return `• **Bot:** ${user} (\`${id}\`)`;
      
      return `• **Unknown:** \`${id}\``;
    }));
    
    return cv2.info('Whitelisted Bots & Roles', `The following entities have full Anti-Nuke immunity:\n\n${formatted.join('\n')}`);
  }
}

async function handleBotBlacklist(action, targetId) {
  if (action === 'add') {
    if (!targetId || !/^\d{17,20}$/.test(targetId)) return cv2.warn('Invalid ID', 'Please provide a valid user ID (17-20 digit number).');
    const success = db.addUserToBotBlacklist(targetId);
    if (success) {
      return cv2.success('User Flagged', `User ID \`${targetId}\` has been **flagged**.\nThey are now blacklisted and cannot use any Athena Prime commands globally.`);
    } else {
      return cv2.info('Already Flagged', `User ID \`${targetId}\` is already on the bot blacklist.`);
    }
  } else if (action === 'remove') {
    if (!targetId || !/^\d{17,20}$/.test(targetId)) return cv2.warn('Invalid ID', 'Please provide a valid user ID to unflag.');
    const success = db.removeUserFromBotBlacklist(targetId);
    if (success) {
      return cv2.success('User Unflagged', `User ID \`${targetId}\` has been **unflagged** and removed from the global bot blacklist.`);
    } else {
      return cv2.warn('Not Flagged', `User ID \`${targetId}\` is not currently flagged.`);
    }
  } else {
    // List
    const flagged = db.getBotBlacklist();
    if (flagged.length === 0) {
      return cv2.info('No Flagged Users', 'There are no users currently flagged on the global bot blacklist.');
    }
    const formattedList = flagged.map(id => `• <@${id}> (ID: \`${id}\`)`).join('\n');
    return cv2.danger('Flagged Users', `These users are globally banned from using the bot:\n\n${formattedList}`);
  }
}

async function handleAntiLink(guild, moderator, mode) {
  const enabled = mode === 'on';
  db.updateGuildConfig(guild.id, { antiLinkEnabled: enabled });

  const modeDesc = enabled ? `${TOGGLE_ON} ACTIVE` : `${TOGGLE_OFF} DEACTIVATED`;
  const resEmbed = cv2.success(
    'Anti-Link Configured',
    `External URL auto-mod filter is now **${modeDesc}**.\n\n${enabled ? 'The following links will now be **strictly blocked**:\n> <:emoji_16:1521464002046328944> Discord Invites\n> <:emoji_16:1521464002046328944> NSFW Links\n> <:emoji_16:1521464002046328944> Scam/Phishing Links\n> <:emoji_16:1521464002046328944> Standard URLs (unless whitelisted)\n\nUse `/linksallow add` to whitelist specific domains like YouTube or Tenor.' : 'Users can freely share external links.'}`,
    [{ name: 'Changed by', value: `${moderator}` }]
  );

  logToSecurityChannel(guild, cv2.log(
    'Anti-Link Toggle',
    `Administrator **${moderator.user.tag}** toggled Anti-Link to **${mode.toUpperCase()}**.`,
    [],
    enabled ? 'success' : 'warning'
  ));

  return resEmbed;
}

async function getServerInfoEmbed(guild) {
  const config = db.getGuildConfig(guild.id);
  
  // Fetch owner
  const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
  const ownerTag = owner ? owner.user.tag : 'Unknown';

  const totalMembers = guild.memberCount;
  const roleCount = guild.roles.cache.size;
  const channelCount = guild.channels.cache.size;
  const boostLevel = guild.premiumTier;
  const boostCount = guild.premiumSubscriptionCount || 0;
  const createdAt = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;

  const antiNukeStatus   = config.antiNukeEnabled               ? `${TOGGLE_ON} ON`  : `${TOGGLE_OFF} OFF`;
  const antiSpamStatus   = config.antiSpamEnabled               ? `${TOGGLE_ON} ON`  : `${TOGGLE_OFF} OFF`;
  const antiInviteStatus = (config.antiInviteEnabled !== false) ? `${TOGGLE_ON} ON`  : `${TOGGLE_OFF} OFF`;
  const antiLinkStatus   = config.antiLinkEnabled               ? `${TOGGLE_ON} ON`  : `${TOGGLE_OFF} OFF`;
  const raidModeStatus   = config.raidMode                      ? '<:emoji_16:1533860111704002665> ENGAGED' : `${TOGGLE_ON} STANDBY`;

  const fields = [
    { name: ' Owner', value: `${ownerTag}`, inline: true },
    { name: '<:emoji_16:1533860111704002665> Members', value: `**${totalMembers}**`, inline: true },
    { name: '<:emoji_16:1533860111704002665> Roles', value: `**${roleCount}**`, inline: true },
    { name: '<:emoji_16:1533860111704002665> Channels', value: `**${channelCount}**`, inline: true },
    { name: '<:emoji_16:1533860111704002665> Boost Level', value: `**Tier ${boostLevel}** (${boostCount} boosts)`, inline: true },
    { name: '<:emoji_16:1533860111704002665> Created', value: createdAt, inline: true },
    { name: '\u200b', value: '**── Security Status ──**' },
    { name: ' Anti-Nuke', value: antiNukeStatus, inline: true },
    { name: ' Anti-Spam', value: antiSpamStatus, inline: true },
    { name: '<:emoji_16:1533860111704002665> Anti-Invite', value: antiInviteStatus, inline: true },
    { name: '<:emoji_16:1533860111704002665> Anti-Link', value: antiLinkStatus, inline: true },
    { name: '<:emoji_16:1533860111704002665> Raid Mode', value: raidModeStatus, inline: true },
    { name: ' Max Warns', value: `\`${config.maxWarnings}\``, inline: true }
  ];

  const serverPayload = cv2.security(
    `${guild.name} — Server Info`,
    `Comprehensive server statistics and Athena Prime security overview.`,
    fields
  );

  // Inject server icon thumbnail into the container if available
  if (guild.iconURL()) {
    const iconUrl = guild.iconURL({ dynamic: true, size: 256 });
    serverPayload.components[0].components.splice(1, 0, { type: 12, items: [{ media: { url: iconUrl } }] });
  }

  return serverPayload;
}

async function getUserInfoEmbed(guild, member) {
  const isExtraOwner = db.isExtraOwner(guild.id, member.id);
  const wlMap = db.getGuildConfig(guild.id).whitelist || {};
  const isWhitelisted = !!wlMap[member.id];
  const wlEvents = isWhitelisted ? wlMap[member.id].join(', ') : '';
  const warnings = db.getWarnings(guild.id, member.id);
  const isExtra = db.isExtraOwner(guild.id, member.id);
  const isBotOwn = isBotOwnerSync(member.id);
  const isServerOwner = member.id === guild.ownerId;

  const roles = member.roles.cache
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map(r => `${r}`)
    .slice(0, 20)
    .join(', ') || 'None';

  let privileges = [];
  if (isBotOwn) privileges.push(' **Bot Owner**');
  if (isServerOwner) privileges.push(' **Server Owner**');
  if (isExtraOwner) privileges.push(' **Extra Owner**');
  if (isWhitelisted) privileges.push(` **Whitelisted** (${wlEvents})`);
  if (privileges.length === 0) privileges.push('Standard Member');

  const fields = [
    { name: '<:emoji_16:1533860111704002665> Username', value: `${member.user.tag}`, inline: true },
    { name: '<:emoji_16:1533860111704002665> User ID', value: `\`${member.id}\``, inline: true },
    { name: '<:emoji_16:1533860111704002665> Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
    { name: '<:emoji_16:1533860111704002665> Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
    { name: ' Active Warnings', value: `\`${warnings.length}\``, inline: true },
    { name: ' Privileges', value: privileges.join(' | '), inline: true },
    { name: `<:emoji_16:1533860111704002665> Roles [${member.roles.cache.size - 1}]`, value: roles }
  ];

  const userPayload = cv2.info(
    `User Info — ${member.user.tag}`,
    `Detailed profile and privilege information.`,
    fields
  );

  return userPayload;
}

// ==========================================
// SECURITY TOGGLE ALL — Bot Owner / Server Owner only
// Enables/disables ALL security features except autonick
// ==========================================
async function handleSecurityToggleAll(guild, moderator, enable) {
  // We only handle enable=false here now, because enable=true is handled by runSecurityEnableSequence
  if (!enable) {
    db.updateGuildConfig(guild.id, {
      securityEnabled:   false,
      antiNukeEnabled:   false,
      antiSpamEnabled:   false,
      antiInviteEnabled: false,
      antiLinkEnabled:   false,
      blacklistWords: []
    });
    
    // Delete roles
    const rolesToDelete = ['Athena Firewall', 'Athena Unbypassable'];
    for (const roleName of rolesToDelete) {
      const r = guild.roles.cache.find(role => role.name === roleName);
      if (r) await r.delete('Security Disabled').catch(() => null);
    }
    
    // Delete dashboard
    const dashboard = guild.channels.cache.find(c => c.name === 'athenas-dashboard');
    if (dashboard) await dashboard.delete('Security Disabled').catch(() => null);

    const textContent = 
      `# ALL SECURITY SHIELDS DISENGAGED\n\n` +
      `All Athena Prime protective filters and security roles have been **DEACTIVATED** server-wide.\n\n` +
      `-# Disabled by ${moderator}`;

    const mainDisplay = new TextDisplayBuilder().setContent(textContent);
    const panelContainer = new ContainerBuilder().addTextDisplayComponents(mainDisplay);

    logToSecurityChannel(guild, cv2.log(
      'Security Toggle All',
      `**${moderator.user.tag}** toggled all security shields **OFF**.`,
      [],
      'warning'
    ));

    return { components: [panelContainer], flags: MessageFlags.IsComponentsV2 };
  }
}

export async function getSecurityStatusPanel(guild) {
  const config = db.getGuildConfig(guild.id);
  // securityEnabled is the master switch set by security enable/disable all
  const isSecured = !!(config.securityEnabled);
  
  const modLabels = {
    antiRoleCreate: 'Anti Role Create',
    antiRoleDelete: 'Anti Role Delete',
    antiRoleUpdate: 'Anti Role Update',
    antiRolePermUpdate: 'Anti Role Perm Update',
    antiMemberRoleUpdate: 'Anti Member Role Update',
    antiRoleReorder: 'Anti Role Reorder',
    antiChannelCreate: 'Anti Channel Create',
    antiChannelDelete: 'Anti Channel Delete',
    antiChannelUpdate: 'Anti Channel Update',
    antiChannelPermUpdate: 'Anti Channel Perm Update',
    antiChannelReorder: 'Anti Channel Reorder',
    antiChannelNameMod: 'Anti Channel Name Mod',
    antiEmojiCreate: 'Anti Emoji Create',
    antiEmojiDelete: 'Anti Emoji Delete',
    antiEmojiUpdate: 'Anti Emoji Update',
    antiWebhooks: 'Anti Webhooks',
    antiBotAdd: 'Anti Bot Add',
    antiServerUpdate: 'Anti Server Update',
    antiBan: 'Anti Ban',
    antiKick: 'Anti Kick',
    antiUnban: 'Anti Unban',
    antiInvite: 'Anti Invite',
    antiScheduledEvents: 'Anti Scheduled Events',
    antiMemberPurge: 'Anti Member Purge',
    antiMassBan: 'Anti Mass Ban',
    antiAutomodUpdate: 'Anti Automod Update',
    antiAppCommands: 'Anti App Commands'
  };

  const emojiOn = '<:on:1514996865030946847>'; 
  const emojiOff = '<:off:1514996861474177109>'; 
  
  const allModuleKeys = Object.keys(modLabels);
  
  let listText = '';
  for (const k of allModuleKeys) {
    const label = modLabels[k] || k;
    // If individual module flags exist, respect them; otherwise follow master switch
    const moduleFlag = config.antinukeModules?.[k];
    const isEnabled = isSecured && (moduleFlag === undefined ? true : !!moduleFlag);
    listText += `> ${isEnabled ? emojiOn : emojiOff} ${label}\n`;
  }

  const description = 
    `# SECURITY FIREWALL STATUS\n` +
    `-# **Global Status:** ${isSecured ? 'God-Tier Firewall ACTIVE' : 'Offline — Unprotected'}\n` +
    `-# **Strike Engine:** ${isSecured ? 'Raw API — ~1-3ms elimination' : 'Disabled'}\n` +
    `-# **Predictive Layer:** ${isSecured ? 'Online — Behavioral scanning active' : 'Disabled'}\n\n` +
    listText;

  const mainDisplay = new TextDisplayBuilder().setContent(description);
  const panelContainer = new ContainerBuilder().addTextDisplayComponents(mainDisplay);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_module_manage').setLabel('Manage Modules').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sec_close').setLabel('Close').setStyle(ButtonStyle.Secondary)
  );
  
  panelContainer.addActionRowComponents(row);

  return { components: [panelContainer], flags: MessageFlags.IsComponentsV2 };
}

// ==========================================
// QRMANAGER — Quarantine system setup & repair
// ==========================================
async function handleQrManager(guild, moderator, action, roleArg, channelArg) {
  const config = db.getGuildConfig(guild.id);

  if (action === 'setup') {
    // Create/resolve quarantine role + channel
    const qRole = await getOrCreateQuarantineRole(guild);
    if (!qRole) return cv2.danger('Setup Failed', 'Could not create or find the Quarantine role. Check bot permissions.');

    const qChannel = await getOrCreateQuarantineChannel(guild, qRole);

    // Sync deny overwrites on ALL channels (except quarantine-zone)
    const synced = await syncQuarantinePermissions(guild, qRole, qChannel?.id || null);

    const fields = [
      { name: '<:emoji_16:1533860111704002665> Quarantine Role',    value: qRole    ? `<@&${qRole.id}>`     : ' Not Created', inline: true },
      { name: '<:emoji_16:1533860111704002665> Quarantine Channel', value: qChannel ? `<#${qChannel.id}>`   : ' Not Created', inline: true },
      { name: '<:emoji_16:1533860111704002665> Channels Synced',    value: `\`${synced}\` channels updated`, inline: true }
    ];

    const vc = config.quarantineVcId ? await guild.channels.fetch(config.quarantineVcId).catch(() => null) : null;
    if (vc) fields.push({ name: '<:emoji_16:1533860111704002665> Quarantine VC', value: `<#${vc.id}>`, inline: true });

    return cv2.success(
        'Quarantine System Fixed ',
        `The quarantine role and channel have been set up.\nDeny overwrites applied to **${synced}** channels — quarantined users will only see the quarantine zone.`,
        fields
      );
  }

  if (action === 'setrole') {
    if (!roleArg) return cv2.warn('Missing Role', 'Please specify a role using the `role` option.');
    db.updateGuildConfig(guild.id, { quarantineRoleId: roleArg.id });
    const qChannelId = db.getGuildConfig(guild.id).quarantineChannelId;
    await syncQuarantinePermissions(guild, roleArg, qChannelId);
    return cv2.success('Quarantine Role Set', `Set <@&${roleArg.id}> as the quarantine role and synced deny overwrites across all channels.`);
  }

  if (action === 'setchannel') {
    if (!channelArg) return cv2.warn('Missing Channel', 'Please specify a text channel using the `channel` option.');
    db.updateGuildConfig(guild.id, { quarantineChannelId: channelArg.id });
    const qRole = await getOrCreateQuarantineRole(guild);
    await syncQuarantinePermissions(guild, qRole, channelArg.id);
    return cv2.success('Quarantine Channel Set', `Set <#${channelArg.id}> as the quarantine text zone and synced deny overwrites across all channels.\nQuarantined users will be able to view and chat here.`);
  }

  if (action === 'setvc') {
    if (!channelArg) return cv2.warn('Missing VC', 'Please specify a voice channel using the `channel` option.');
    db.updateGuildConfig(guild.id, { quarantineVcId: channelArg.id });
    return cv2.success('Quarantine VC Set', `Set <#${channelArg.id}> as the quarantine voice channel.\nWhen a member is quarantined they will be moved here (if they are in a VC). On unquarantine they are returned to their previous VC.`);
  }

  if (action === 'status') {
    const updatedConfig = db.getGuildConfig(guild.id);
    const role    = updatedConfig.quarantineRoleId    ? await guild.roles.fetch(updatedConfig.quarantineRoleId).catch(() => null)       : null;
    const channel = updatedConfig.quarantineChannelId ? await guild.channels.fetch(updatedConfig.quarantineChannelId).catch(() => null) : null;
    const vc      = updatedConfig.quarantineVcId      ? await guild.channels.fetch(updatedConfig.quarantineVcId).catch(() => null)      : null;

    return cv2.info('Quarantine System Status', 'Current quarantine configuration for this server:', [
        { name: 'Quarantine Role',    value: role    ? `<@&${role.id}>`   : ' Not Set — run `/qrmanager setup`', inline: true },
        { name: 'Quarantine Channel', value: channel ? `<#${channel.id}>` : ' Not Set — run `/qrmanager setup`', inline: true },
        { name: 'Quarantine VC',      value: vc      ? `<#${vc.id}>`      : ' Not Set — use `/qrmanager setvc`', inline: true }
      ]);
  }

  return cv2.warn('Unknown Action', 'Valid actions: `setup`, `setrole`, `setchannel`, `setvc`, `status`');
}

// ==========================================
// ==========================================
// LINKSALLOW — Per-guild domain whitelist for anti-link filter
// ==========================================
async function handleLinksAllow(guild, action, domain) {
  if (action === 'allowall') {
    db.updateGuildConfig(guild.id, { allowAllLinks: true });
    return cv2.success(
        '<:emoji_16:1533860111704002665> All Links Allowed',
        'The anti-link filter has been **completely disabled** for this server.\n\nAll users can now post any link freely.\n\nUse `/linksallow disallowall` to re-enable the filter.',
        [{ name: ' Note', value: 'This overrides all domain whitelists and disables the anti-link filter entirely.' }]
      );
  }

  if (action === 'disallowall') {
    db.updateGuildConfig(guild.id, { allowAllLinks: false, allowedLinks: [] });
    return cv2.warn(
        '<a:AnyaYay:1537513785718476850> Anti-Link Filter Restored',
        'The anti-link filter is **active** again and all allowed domains have been **reset**.\n\nThe following links will now be **strictly blocked**:\n> <:emoji_16:1521464002046328944> Discord Invites\n> <:emoji_16:1521464002046328944> NSFW Links\n> <:emoji_16:1521464002046328944> Scam/Phishing Links\n> <:emoji_16:1521464002046328944> Standard URLs (unless whitelisted)\n\nUse `/linksallow add <domain>` to whitelist specific domains.'
      );
  }

  if (action === 'add') {
    // Normalize: strip protocol and path, keep domain only
    const cleanDomain = (domain || '')
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .trim()
      .toLowerCase();

    if (!cleanDomain) return cv2.warn('Invalid Domain', 'Please provide a valid domain (e.g. `youtube.com`).');

    const added = db.addAllowedLink(guild.id, cleanDomain);
    if (added) {
      return cv2.success('Domain Allowed', `Added **\`${cleanDomain}\`** to the allowed links list.\nLinks containing this domain will bypass the anti-link filter.`);
    }
    return cv2.info('Already Allowed', `**\`${cleanDomain}\`** is already in the allowed list.`);
  }

  if (action === 'remove') {
    const cleanDomain = (domain || '')
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .trim()
      .toLowerCase();

    const removed = db.removeAllowedLink(guild.id, cleanDomain);
    if (removed) {
      return cv2.success('Domain Removed', `Removed **\`${cleanDomain}\`** from the allowed list.`);
    }
    return cv2.warn('Not Found', `**\`${cleanDomain}\`** is not in the allowed list.`);
  }

  // list
  const config   = db.getGuildConfig(guild.id);
  const allOpen  = config.allowAllLinks === true;
  const list     = db.getAllowedLinks(guild.id);

  if (allOpen) {
    return cv2.info(
        '<:emoji_16:1533860111704002665> All Links Allowed',
        'The anti-link filter is currently **fully disabled** — all links are permitted.\n\nUse `/linksallow disallowall` to re-enable the filter.'
      );
  }

  if (list.length === 0) {
    return cv2.info(
        'No Allowed Domains',
        'No domains are whitelisted yet.\n\nAdd one with `/linksallow add <domain>` (e.g. `youtube.com`, `tenor.com`, `giphy.com`).\nThese domains will not be blocked by the anti-link filter.'
      );
  }

  const formatted = list.map((d, i) => `${i + 1}. \`${d}\``).join('\n');
  return cv2.info(
      'Allowed Link Domains',
      `These domains bypass the anti-link filter:\n\n${formatted}\n\n*Use \`/linksallow remove <domain>\` to remove any.*`
    );
}

// ==========================================
// MASS QUARANTINE — Quarantine all members with a specific role
// Skips: bot owner, server owner, extra owners, whitelisted, already quarantined
// ==========================================
async function handleMassQuarantine(guild, moderator, targetRole, reason) {
  // Safety guard — prevent quarantining @everyone
  if (targetRole.id === guild.id) {
    return cv2.danger('Blocked', 'You cannot mass quarantine the `@everyone` role.');
  }

  // Fetch all members (ensure cache is populated)
  await guild.members.fetch().catch(() => null);

  // Collect eligible targets
  const targets = targetRole.members.filter(member => {
    if (member.id === guild.client.user.id)                     return false; // Skip bot itself
    if (isBotOwnerSync(member.id))                              return false; // Skip bot owner
    if (member.id === guild.ownerId)                            return false; // Skip server owner
    if (db.isExtraOwner(guild.id, member.id))                   return false; // Skip extra owners
    if (db.isWhitelisted(guild, member.id, 'quarantine'))       return false; // Skip whitelisted
    if (db.getQuarantine(guild.id, member.id))                  return false; // Skip already quarantined
    return true;
  });

  if (targets.size === 0) {
    return cv2.warn(
        'No Eligible Targets',
        `No members with <@&${targetRole.id}> can be quarantined.\n\nAll members are either already quarantined, protected (owner/extra owner/whitelisted), or the role is empty.`
      );
  }

  let success = 0;
  let failed  = 0;
  let skipped = 0;

  for (const [, member] of targets) {
    const result = await executeQuarantine(guild, member, moderator, reason);
    if (result.success)            success++;
    else if (result.message?.includes('already quarantined')) skipped++;
    else                           failed++;

    // 600ms delay between each to avoid Discord rate limits

  }

  const total = targets.size;

  logToSecurityChannel(guild, cv2.log(
    'Mass Quarantine Executed',
    `**${moderator.user.tag}** mass-quarantined all members with role <@&${targetRole.id}>.`,
    [
      { name: '<:emoji_16:1533860111704002665> Role',       value: `<@&${targetRole.id}>`, inline: true },
      { name: ' Quarantined', value: `\`${success}\``,       inline: true },
      { name: ' Failed',      value: `\`${failed}\``,        inline: true },
      { name: ' Skipped',    value: `\`${skipped}\``,       inline: true },
      { name: '<:emoji_16:1533860111704002665> Reason',     value: reason }
    ],
    'danger'
  ));

  return cv2.danger(
      '<:emoji_16:1533860111704002665> Mass Quarantine Complete',
      `All targeted members with <@&${targetRole.id}> have been processed.`,
      [
        { name: '<:emoji_16:1533860111704002665> Target Role',  value: `<@&${targetRole.id}> (${total} members targeted)`, inline: false },
        { name: ' Quarantined',  value: `\`${success}\``,  inline: true },
        { name: ' Failed',       value: `\`${failed}\``,   inline: true },
        { name: ' Skipped',     value: `\`${skipped}\``,  inline: true },
        { name: '<:emoji_16:1533860111704002665> Reason',       value: reason,             inline: false },
        { name: '<:emoji_16:1533860111704002665> Executed By',  value: `${moderator}`,    inline: true }
      ]
    );
}

// ==========================================
// MASS UNQUARANTINE — Release all quarantined members in a guild
// ==========================================
async function handleMassUnquarantine(guild, moderator, client, context = null) {
  const quarantined = db.getQuarantinedInGuild(guild.id);

  if (!quarantined || quarantined.length === 0) {
    return cv2.info('Nothing to Release', 'There are no quarantined members in this server.');
  }

  let success = 0;
  let failed  = 0;

  for (const { userId } of quarantined) {
    try {
      // Cancel any pending auto-unquarantine timer
      const key = `${guild.id}-${userId}`;
      if (autoUnquarantineTimers.has(key)) {
        clearTimeout(autoUnquarantineTimers.get(key));
        autoUnquarantineTimers.delete(key);
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        db.removeQuarantine(guild.id, userId);
        success++;
        continue;
      }

      const result = await executeUnquarantine(guild, member, moderator, context);
      if (result.success) success++;
      else failed++;
    } catch { failed++; }

  }

  logToSecurityChannel(guild, cv2.log(
    'Mass Unquarantine Executed',
    `**${moderator.user.tag}** released all quarantined members.`,
    [
      { name: ' Released', value: `\`${success}\``, inline: true },
      { name: ' Failed',   value: `\`${failed}\``,  inline: true }
    ],
    'success'
  ));

  return cv2.success(
      '<:emoji_16:1533860111704002665> Mass Unquarantine Complete',
      `All quarantined members have been processed.`,
      [
        { name: ' Released',     value: `\`${success}\``, inline: true },
        { name: ' Failed',        value: `\`${failed}\``,  inline: true },
        { name: '<:emoji_16:1533860111704002665> Executed By', value: `${moderator}`,    inline: true }
      ]
    );
}

async function runSecurityEnableSequence(guild, updateMessageFn) {
  const onEmoji = '<:on:1514996865030946847>';
  const alertEmoji = '<a:alert1:1533860044154732704>';
  
  const steps = [
    `${alertEmoji} __**INITIALIZING SECURITY PROTOCOLS...**__`,
    `${onEmoji} Anti-Nuke: **Enabled**`,
    `${onEmoji} Anti-Spam: **Enabled**`,
    `${onEmoji} Anti-Link: **Enabled**`,
    `${onEmoji} Anti-Invite: **Enabled**`,
    `${onEmoji} Word Filter: **Enabled**`,
    `\n${alertEmoji} __**DEPLOYING TRIPLE-LAYER DEFENSE...**__`
  ];

  const sendPayload = async (text, isError = false) => {
    const heading = isError ? '# Initialization Failed' : '# SECURITY SHIELD SEQUENCE';
    const fullText = heading + '\n\n' + text;
    const display = new TextDisplayBuilder().setContent(fullText);
    const container = new ContainerBuilder().addTextDisplayComponents(display);
    await updateMessageFn({ components: [container], flags: MessageFlags.IsComponentsV2 });
  };

  let currentText = '';
  for (let i = 0; i < steps.length; i++) {
    currentText += (i > 0 ? '\n' : '') + steps[i];
    await sendPayload(currentText);
    await new Promise(r => setTimeout(r, 800));
  }

  // Ensure real security roles are ready
  const botRole = guild.members.me.roles.highest;
  
  currentText += `\n${onEmoji} **Preparing Primary Role (1/3):** Verifying ${botRole.name}...`;
  await sendPayload(currentText);
  
  if (!botRole || botRole.name === '@everyone') {
    return sendPayload('Athena Prime must have a dedicated high-hierarchy role to function.', true);
  }
  
  // Re-write last line to Success
  currentText = currentText.replace(`**Preparing Primary Role (1/3):** Verifying ${botRole.name}...`, `**Preparing Primary Role (1/3):** ${botRole.name} Verified`);
  await sendPayload(currentText);
  await new Promise(r => setTimeout(r, 500));

  currentText += `\n${onEmoji} **Preparing Secondary Role (2/3):** Creating Athena Firewall...`;
  await sendPayload(currentText);

  let firewallRole = guild.roles.cache.find(r => r.name === 'Athena Firewall');
  try {
    if (!firewallRole) {
      firewallRole = await guild.roles.create({
        name: 'Athena Firewall',
        color: 0x2B2D31,
        permissions: [],
        position: botRole.position - 1,
        reason: 'Security Shield Deployment'
      });
    }
  } catch (err) {
    return sendPayload(`Failed to create Secondary Role. Missing permissions or hierarchy is too low.\n\`\`\`\n${err.message}\n\`\`\``, true);
  }

  currentText = currentText.replace(`**Preparing Secondary Role (2/3):** Creating Athena Firewall...`, `**Preparing Secondary Role (2/3):** Athena Firewall Created`);
  await sendPayload(currentText);
  await new Promise(r => setTimeout(r, 500));

  currentText += `\n${onEmoji} **Preparing Hidden Role (3/3):** Creating Athena Unbypassable...`;
  await sendPayload(currentText);

  let hiddenRole = guild.roles.cache.find(r => r.name === 'Athena Unbypassable');
  try {
    if (!hiddenRole) {
      hiddenRole = await guild.roles.create({
        name: 'Athena Unbypassable',
        color: 0x000000,
        permissions: [PermissionFlagsBits.Administrator],
        position: botRole.position - 2,
        reason: 'Security Shield Deployment'
      });
      // Assign to bot
      await guild.members.me.roles.add(hiddenRole).catch(() => null);
    }
  } catch (err) {
    return sendPayload(`Failed to create Hidden Role. Missing permissions.\n\`\`\`\n${err.message}\n\`\`\``, true);
  }

  currentText = currentText.replace(`**Preparing Hidden Role (3/3):** Creating Athena Unbypassable...`, `**Preparing Hidden Role (3/3):** Athena Unbypassable Created`);
  await sendPayload(currentText);
  await new Promise(r => setTimeout(r, 500));

  // DB Update - MUST be before Dashboard creation so Dashboard sees Firewall as Active
  db.updateGuildConfig(guild.id, {
    securityEnabled: true,
    antiNukeEnabled: true,
    antiSpamEnabled: true,
    antiInviteEnabled: true,
    antiLinkEnabled: true
  });

  const config = db.getGuildConfig(guild.id);
  if (!config.blacklistWords || config.blacklistWords.length === 0) {
    db.addBlacklistWord(guild.id, 'hack');
    db.addBlacklistWord(guild.id, 'nuke');
    db.addBlacklistWord(guild.id, 'spam');
  }

  // Dashboard creation
  const existingDashboard = guild.channels.cache.find(c => c.name === 'athenas-dashboard');
  if (!existingDashboard) {
    try {
      await setupDashboardChannel(guild, guild.client);
    } catch (err) {
      return sendPayload(`Failed to deploy dashboard channel.\n\`\`\`\n${err.message}\n\`\`\``, true);
    }
  }
  
  currentText += `\n${onEmoji} **Deploying Dashboard:** Athena's Dashboard Channel Active`;
  await sendPayload(currentText);

  currentText += `\n\n${alertEmoji} **ALL SYSTEMS LOCKED AND OPERATIONAL**\n\n**Athena Prime has deployed a triple-layer security architecture. Any attempt to disturb, delete, or strip permissions from my Primary, Secondary, or Hidden roles will trigger an instant Hostile Neutralization. Athena will automatically restore its own permissions, rendering the bot truly unbypassable.**\n\n**#athenas-dashboard** has been successfully initialized. Use this dedicated channel to monitor live security modules, recent logs, and interact with firewall controls.`;
  
  await sendPayload(currentText);
}



export async function handleScanServer(guild, page = 0) {
  const config = db.getGuildConfig(guild.id);
  const whitelistedIds = config.botWhitelist || [];
  
  await guild.members.fetch(); // Ensure cache is populated
  const allMembers = guild.members.cache;
  const allBots = allMembers.filter(m => m.user.bot);
  const allHumans = allMembers.filter(m => !m.user.bot);
  
  const unauthorizedBots = [];
  const whitelistedBots = [];
  
  const dangerousPerms = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers
  ];

  allBots.forEach(bot => {
     if (whitelistedIds.includes(bot.id) || bot.id === guild.client.user.id) {
       whitelistedBots.push(bot);
     } else {
       unauthorizedBots.push(bot);
     }
  });

  const getDangerousRoles = (member) => {
    return member.roles.cache.filter(role => dangerousPerms.some(perm => role.permissions.has(perm)) && role.id !== guild.id);
  };
  
  const highRiskHumans = [];
  const trustedHumans = [];
  
  allHumans.forEach(h => {
     if (h.id === guild.ownerId || isExtraOwner(guild.id, h.id)) {
       trustedHumans.push(h);
       return;
     }
     const badRoles = getDangerousRoles(h);
     if (badRoles.size > 0) {
       highRiskHumans.push({ member: h, roles: badRoles });
     }
  });

  const highRiskBots = [];
  allBots.forEach(b => {
     if (b.id === guild.client.user.id) return;
     const badRoles = getDangerousRoles(b);
     if (badRoles.size > 0) {
       highRiskBots.push({ member: b, roles: badRoles });
     }
  });

  const ITEMS_PER_PAGE = 15;
  const totalPages = Math.max(
    1,
    Math.ceil(highRiskHumans.length / ITEMS_PER_PAGE),
    Math.ceil(unauthorizedBots.length / ITEMS_PER_PAGE),
    Math.ceil(whitelistedBots.length / ITEMS_PER_PAGE),
    Math.ceil(trustedHumans.length / ITEMS_PER_PAGE)
  );
  
  if (page < 0) page = 0;
  if (page >= totalPages) page = totalPages - 1;

  const startIdx = page * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;

  const DANGER = '<a:Dark4luvontop:1524405543987445861>';
  const WARNING = '<a:Dark4luvontop:1524405545690202253>';
  const DOT = '•';

  let desc = `### ${DANGER} SECURITY DIAGNOSTICS\n\n`;
  desc += `> **Total Humans:** \`${allHumans.size}\`\n`;
  desc += `> **Total Bots:** \`${allBots.size}\` (Whitelisted: \`${whitelistedBots.length}\` | Unauthorized: \`${unauthorizedBots.length}\`)\n\n`;

  const humansToShow = trustedHumans.slice(startIdx, endIdx);
  if (humansToShow.length > 0) {
    desc += `### <:emoji_16:1533860111704002665> TRUSTED PERSONNEL\n`;
    humansToShow.forEach(h => {
      desc += `${DOT} **@${h.user.username}** [\`${h.id}\`]\n`;
    });
    if (trustedHumans.length > endIdx) desc += `*...and ${trustedHumans.length - endIdx} more.*\n`;
    desc += `\n`;
  }

  const whitelistedBotsToShow = whitelistedBots.slice(startIdx, endIdx);
  if (whitelistedBotsToShow.length > 0) {
    desc += `### <:emoji_16:1533860111704002665> WHITELISTED BOTS\n`;
    whitelistedBotsToShow.forEach(b => {
      desc += `${DOT} **@${b.user.username}** [\`${b.id}\`]\n`;
    });
    if (whitelistedBots.length > endIdx) desc += `*...and ${whitelistedBots.length - endIdx} more.*\n`;
    desc += `\n`;
  }

  const highRiskHumansToShow = highRiskHumans.slice(startIdx, endIdx);
  if (highRiskHumansToShow.length > 0) {
    desc += `### ${WARNING} HIGH-RISK PERSONNEL\n`;
    highRiskHumansToShow.forEach(h => {
      desc += `${DOT} **@${h.member.user.username}** [\`${h.member.id}\`] — ${h.roles.map(r => `<@&${r.id}>`).join(', ')}\n`;
    });
    if (highRiskHumans.length > endIdx) desc += `*...and ${highRiskHumans.length - endIdx} more.*\n`;
    desc += `\n`;
  }

  const unauthorizedBotsToShow = unauthorizedBots.slice(startIdx, endIdx);
  if (unauthorizedBotsToShow.length > 0) {
    desc += `### ${DANGER} UNAUTHORIZED BOTS\n`;
    unauthorizedBotsToShow.forEach(b => {
      const badRoles = getDangerousRoles(b);
      desc += `${DOT} **@${b.user.username}** [\`${b.id}\`] ${badRoles.size > 0 ? `(${badRoles.map(r => `<@&${r.id}>`).join(', ')})` : ''}\n`;
    });
    if (unauthorizedBots.length > endIdx) desc += `*...and ${unauthorizedBots.length - endIdx} more.*\n`;
    desc += `\n`;
  }

  if (unauthorizedBots.length === 0 && highRiskHumans.length === 0) {
     desc += `*Server security is optimal. No unauthorized bots or untrusted high-risk users detected.*\n`;
  }

  if (desc.length > 4096) {
    desc = desc.substring(0, 4090) + '...';
  }

  const embedMsg = new EmbedBuilder()
    .setTitle('SERVER SECURITY SCANNER')
    .setDescription(desc)
    .setColor('#ff0000')
    .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
    .setTimestamp();

  const components = [];

  // Pagination buttons
  if (totalPages > 1) {
    const prevBtn = new ButtonBuilder()
      .setCustomId(`scanserver_prev_${page}`)
      .setEmoji('<:previous:1523766004839088301>')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0);
      
    const nextBtn = new ButtonBuilder()
      .setCustomId(`scanserver_next_${page}`)
      .setEmoji('<:next:1523766065576935475>')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === totalPages - 1);
      
    components.push(new ActionRowBuilder().addComponents(prevBtn, nextBtn));
  }

  if (unauthorizedBots.length > 0) {
    const options = unauthorizedBots.map(b => ({
      label: b.user.username.substring(0, 100),
      description: b.id,
      value: b.id
    })).slice(0, 25);
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`scanserver_ban_${page}`)
      .setPlaceholder('Select an unauthorized bot to ban')
      .addOptions(options);
      
    const banAllBtn = new ButtonBuilder()
      .setCustomId(`scanserver_banall_${page}`)
      .setLabel('Ban All Unauthorized')
      .setStyle(ButtonStyle.Danger);
      
    components.push(new ActionRowBuilder().addComponents(selectMenu));
    components.push(new ActionRowBuilder().addComponents(banAllBtn));
  }
  
  return { embeds: [embedMsg], components: components };
}
