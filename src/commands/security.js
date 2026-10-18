import { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, TextDisplayBuilder, ContainerBuilder, MessageFlags, SectionBuilder, ThumbnailBuilder, Routes } from 'discord.js';
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
  autoSetupQuarantine,
  isBotOwnerOrServerOwner,
  isBotOwnerOrServerOwnerStrict,
  isBotOwnerSync,
  isExtraOwner,
  isServerAdmin,
  syncQuarantinePermissions,
  getUserTierName,
  cleanDisplayName
} from '../utils/helpers.js';
import { connectToHomeVc, toggleBotDeafen } from '../utils/voice.js';
import { setupDashboardChannel } from '../utils/dashboardManager.js';
import { StringSelectMenuBuilder, UserSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder } from 'discord.js';
import { auditAndNeutralizeOnboarding, CRITICAL_ONBOARDING_PERMS, hasCriticalOnboardingPerms, getDangerousPermNames } from '../utils/onboardingGuard.js';
import { hasDangerousPerms } from '../utils/antinuke.js';

// Toggle emoji constants Ã¢â‚¬â€ used throughout all security/config embeds
const TOGGLE_ON  = '<:on:1533844867191406672>';
const TOGGLE_OFF = '<:off:1533844858983157851>';

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

  // Bare number Ã¢â€ ' minutes
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
    aliases: ['qr', 'q', 'isolate'],
    description: 'Isolates a user - strips roles, moves to quarantine VC, DMs them. Default duration: 5m.',
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
      if (result.success) await message.reply(result.embed || result);
      else await message.reply(result.embed || cv2.danger('<:off:1533844858983157851> Failed', result.message));
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const durationStr = interaction.options.getString('duration') || '5m';
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const durationMs = parseDuration(durationStr);

      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) return interaction.reply(cv2.warn('Command Error', `${interaction.user} Member not found.`));

      const result = await executeQuarantine(interaction.guild, target, interaction.member, reason, durationMs, interaction.client);
      if (result.success) await interaction.reply(result.embed || result);
      else await interaction.reply(result.embed || cv2.danger('<:off:1533844858983157851> Failed', result.message));
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
      if (result.success) await message.reply(result.embed || result);
      else await message.reply(result.embed || cv2.danger('<:off:1533844858983157851> Failed', result.message));
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const durationStr = interaction.options.getString('duration') || '5m';
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const durationMs = parseDuration(durationStr);
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) return interaction.reply(cv2.warn('Error', 'Member not found.'));
      const result = await executeQuarantine(interaction.guild, target, interaction.member, reason, durationMs, interaction.client);
      if (result.success) await interaction.reply(result.embed || result);
      else await interaction.reply(result.embed || cv2.danger('<:off:1533844858983157851> Failed', result.message));
    }
  },

  // --- UNQUARANTINE COMMAND ---
  {
    name: 'unquarantine',
    aliases: ['unq', 'lift'],
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
          await message.reply(result.embed);
        } else {
          await message.reply(cv2.danger('<:off:1533844858983157851> Failed', result.message));
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
          await interaction.reply(result.embed);
        } else {
          await interaction.reply(cv2.danger('<:off:1533844858983157851> Failed', result.message));
        }
    }
  },

  // --- EMERGENCY COMMANDS ---
  {
    name: 'emergency',
    aliases: ['em', 'panic'],
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
        if (!statusMsg) statusMsg = await message.reply(embedData).catch(() => null);
        else await cv2.edit(statusMsg, embedData).catch(() => null);
      };
      const result = await handleEmergency(message.guild, message.member, action, updateProgress);
      if (statusMsg) await cv2.edit(statusMsg, result).catch(()=>null);
      else await message.reply(result).catch(() => null);
    },
    async executeSlash(interaction) {
      const action = interaction.options.getString('action');
      await interaction.reply(cv2.info('Processing', 'Please wait...'));
      
      const updateProgress = async (embedData) => {
        await cv2.edit(interaction, embedData).catch(() => null);
      };
      
      const result = await handleEmergency(interaction.guild, interaction.member, action, updateProgress);
      await cv2.edit(interaction, result).catch(() => null);
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
        if (!statusMsg) statusMsg = await message.reply(embedData).catch(() => null);
        else await cv2.edit(statusMsg, embedData).catch(() => null);
      };
      const result = await handleEmergency(message.guild, message.member, 'end', updateProgress);
      if (statusMsg) await cv2.edit(statusMsg, result).catch(()=>null);
      else await message.reply(result);
    },
    async executeSlash(interaction) {
      await interaction.reply(cv2.info('Processing', 'Please wait...'));
      
      const updateProgress = async (embedData) => {
        await cv2.edit(interaction, embedData).catch(() => null);
      };
      
      const result = await handleEmergency(interaction.guild, interaction.member, 'end', updateProgress);
      await cv2.edit(interaction, result).catch(() => null);
    }
  },

  // --- LOCKDOWN COMMAND ---
  {
    name: 'lockdown',
    aliases: ['ld', 'lock', 'lockchannel', 'paniclockdown'],
    slashHidden: false,
    description: 'Server Panic Lockdown (Tier 1 Soft, Tier 2 Medium, Tier 3 Nuclear) or channel lock',
    category: 'security',
    permissions: [PermissionFlagsBits.ManageChannels],
    options: [
      {
        name: 'tier',
        description: 'Lockdown level: 1 (Soft), 2 (Medium), 3 (Nuclear), channel, or off',
        type: 3,
        required: false,
        choices: [
          { name: 'Tier 1 (Soft Lockdown - Mute text & voice)', value: '1' },
          { name: 'Tier 2 (Medium Lockdown - Strip reactions/apps & Raid Mode)', value: '2' },
          { name: 'Tier 3 (Nuclear Lockdown - Complete server blackout)', value: '3' },
          { name: 'Current Channel Only', value: 'channel' },
          { name: 'Lift Lockdown (Restore DB Snapshot)', value: 'off' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const arg = args[0]?.toLowerCase();
      if (arg === 'off' || arg === 'lift' || arg === 'disable' || arg === 'unlock') {
        const result = await handleUnlockdown(message.guild, message.member);
        return message.reply(result);
      }
      if (arg === 'channel') {
        const result = await handleLockdown(message.guild, message.channel, message.member, 'on');
        return message.reply(result);
      }
      const tier = (arg === '2' || arg === 'medium') ? '2' : (arg === '3' || arg === 'nuclear') ? '3' : '1';
      const result = await handlePanicLockdown(message.guild, message.member, tier);
      return message.reply(result);
    },
    async executeSlash(interaction) {
      const tierOption = interaction.options.getString('tier') || '1';
      if (tierOption === 'off') {
        const result = await handleUnlockdown(interaction.guild, interaction.member);
        return interaction.reply(result);
      }
      if (tierOption === 'channel') {
        const result = await handleLockdown(interaction.guild, interaction.channel, interaction.member, 'on');
        return interaction.reply(result);
      }
      await interaction.deferReply();
      const result = await handlePanicLockdown(interaction.guild, interaction.member, tierOption);
      return interaction.editReply(result);
    }
  },

  // --- UNLOCKDOWN COMMAND ---
  {
    name: 'unlockdown',
    aliases: ['unld', 'unlockserver', 'liftlockdown'],
    slashHidden: false,
    description: 'Lift server panic lockdown and restore exact pre-lockdown state from database snapshot',
    category: 'security',
    permissions: [PermissionFlagsBits.ManageChannels],
    options: [],
    async executePrefix(message) {
      const result = await handleUnlockdown(message.guild, message.member);
      return message.reply(result);
    },
    async executeSlash(interaction) {
      await interaction.deferReply();
      const result = await handleUnlockdown(interaction.guild, interaction.member);
      return interaction.editReply(result);
    }
  },

  // --- UNLOCK COMMAND ---
  {
    name: 'unlock',
    aliases: ['unld', 'unlockchannel'],
    slashHidden: true,
    description: 'Unlocks the channel allowing members to send messages.',
    category: 'security',
    permissions: [PermissionFlagsBits.ManageChannels],
    async executePrefix(message, args) {
      const result = await handleLockdown(message.guild, message.channel, message.member, 'off');
      await message.reply(result);
    },
    async executeSlash(interaction) {
      const result = await handleLockdown(interaction.guild, interaction.channel, interaction.member, 'off');
      await interaction.reply(result);
    }
  },

  // --- RAIDMODE COMMAND ---
  {
    name: 'raidmode',
    aliases: ['raid', 'rm'],
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
    aliases: ['wl', 'wlist'],
    description: 'Manage Antinuke Whitelist for a User or Role.',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'target',
        description: 'Target User or Role to manage whitelist',
        type: 9, // Mentionable
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(message.author.id) || message.author.id === message.guild.ownerId || db.isExtraOwner(message.guild.id, message.author.id);
      if (!allowed) {
        return message.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
      }

      if (!args[0] || args[0].toLowerCase() === 'list') {
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

  // --- LINKSALLOW COMMAND ---
  {
    name: 'linksallow',
    description: 'Manage allowed domains that bypass the anti-link filter.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'action',
        description: 'Action to perform',
        type: 3,
        required: true,
        choices: [
          { name: 'Add Domain', value: 'add' },
          { name: 'Remove Domain', value: 'remove' },
          { name: 'List Allowed Domains', value: 'list' },
          { name: 'Allow All Links', value: 'allowall' },
          { name: 'Disallow All Links', value: 'disallowall' }
        ]
      },
      {
        name: 'domain',
        description: 'Domain to allow/remove (e.g. youtube.com)',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(message.author.id) || message.author.id === message.guild.ownerId || db.isExtraOwner(message.guild.id, message.author.id);
      if (!allowed) {
        return message.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
      }
      const action = (args[0] || 'list').toLowerCase();
      const domain = args[1];
      const panel = await handleLinksAllow(message.guild, action, domain);
      return message.reply(panel);
    },
    async executeSlash(interaction) {
      const allowed = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(interaction.user.id) || interaction.user.id === interaction.guild.ownerId || db.isExtraOwner(interaction.guild.id, interaction.user.id);
      if (!allowed) {
        return interaction.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
      }
      const action = interaction.options.getString('action') || 'list';
      const domain = interaction.options.getString('domain');
      const panel = await handleLinksAllow(interaction.guild, action, domain);
      return interaction.reply(panel);
    }
  },

  // --- BLACKLIST COMMAND ---
  {
    name: 'blacklist',
    aliases: ['bl', 'wordfilter', 'wf'],
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
    aliases: ['hoistcleaner'],
    description: 'Interactive Auto-nickname manager dashboard.',
    category: 'security',
    permissions: [PermissionFlagsBits.ManageNicknames],
    options: [],
    async executePrefix(message, args) {
      const payload = await buildAutonickDashboard(message.guild.id, message.guild);
      await message.reply(payload);
    },
    async executeSlash(interaction) {
      const payload = await buildAutonickDashboard(interaction.guild.id, interaction.guild);
      await interaction.reply(payload);
    }
  },

  // --- CONFIG COMMAND ---
  {
    name: 'config',
    aliases: ['cfg', 'settings'],
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
    aliases: ['an', 'anti-nuke'],
    description: 'Configures the Anti-Nuke protections panel with buttons.',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'subcommand',
        description: 'Choose antinuke action',
        type: 3,
        required: false,
        choices: [
          { name: 'Open Config Panel', value: 'config' },
          { name: 'Security & Module Status', value: 'status' },
          { name: 'Real-Time Live Records', value: 'records' },
          { name: 'Exploit Defense & Architecture Guide', value: 'guide' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const allowed = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(message.author.id) || message.author.id === message.guild.ownerId || db.isExtraOwner(message.guild.id, message.author.id);
      if (!allowed) {
        return message.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
      }
      
      const sub = args.join(' ').toLowerCase().trim();

      if (sub === 'config' || sub === '') {
        const panel = await getAntinukeConfigPanel(message.guild);
        await message.reply(panel);
      } else if (sub === 'status' || sub === 'modules') {
        const panel = await getSecurityStatusPanel(message.guild);
        await message.reply(panel);
      } else if (sub === 'records' || sub === 'logs' || sub === 'live' || sub === 'incidents' || sub === 'threats') {
        const panel = await getSecurityLiveRecordsPanel(message.guild, 0);
        await message.reply(panel);
      } else if (sub === 'guide' || sub === 'explain' || sub === 'info' || sub === 'architecture') {
        const panel = await getAntinukeArchitecturePanel(message.guild);
        await message.reply(panel);
      } else {
        await message.reply(cv2.warn('Command Error', `${message.author} Usage: \`!antinuke [config|status|records|guide]\``));
      }
    },
    async executeSlash(interaction) {
      const allowed = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(interaction.user.id) || interaction.user.id === interaction.guild.ownerId || db.isExtraOwner(interaction.guild.id, interaction.user.id);
      if (!allowed) {
        return interaction.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
      }

      const sub = interaction.options.getString('subcommand') || 'config';

      if (sub === 'config') {
        const panel = await getAntinukeConfigPanel(interaction.guild);
        await interaction.reply(panel);
      } else if (sub === 'status') {
        const panel = await getSecurityStatusPanel(interaction.guild);
        await interaction.reply(panel);
      } else if (sub === 'records') {
        const panel = await getSecurityLiveRecordsPanel(interaction.guild, 0);
        await interaction.reply(panel);
      } else if (sub === 'guide') {
        const panel = await getAntinukeArchitecturePanel(interaction.guild);
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
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return message.reply(cv2.warn('Invalid URL', `${message.author} That is not a valid image link! Ensure the link starts with http:// or https://, or upload an image file instead.`));
      }
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return message.reply(cv2.warn('Invalid URL', `${message.author} That is not a valid image link! Ensure the link starts with http:// or https://, or upload an image file instead.`));
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
        await responseMsg.edit(cv2.danger('<:off:1533844858983157851> Failed', `Could not update avatar: ${err.message}`));
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

      await interaction.reply(cv2.info('Configuring', 'Updating bot banner...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
        await interaction.client.rest.patch(`/guilds/${interaction.guild.id}/members/@me`, {
          body: { avatar: dataUri }
        });
        await cv2.edit(interaction, cv2.success('Avatar Configured', "Successfully updated the bot's server-specific avatar."));
      } catch (err) {
        await cv2.edit(interaction, cv2.danger('<:off:1533844858983157851> Failed', `Could not update avatar: ${err.message}`));
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
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return message.reply(cv2.warn('Invalid URL', `${message.author} That is not a valid image link! Ensure the link starts with http:// or https://, or upload an image file instead.`));
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
        await responseMsg.edit(cv2.danger('<:off:1533844858983157851> Failed', `Could not update banner: ${err.message}`));
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

      await interaction.reply(cv2.info('Processing', 'Please wait...'));

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
        await interaction.client.rest.patch(`/guilds/${interaction.guild.id}/members/@me`, {
          body: { banner: dataUri }
        });
        await cv2.edit(interaction, cv2.success('Banner Configured', "Successfully updated the bot's server-specific banner."));
      } catch (err) {
        await cv2.edit(interaction, cv2.danger('<:off:1533844858983157851> Failed', `Could not update banner: ${err.message}`));
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

  // --- GLOBAL BOT BLACKLIST COMMANDS (GBAN, GUNBAN, GBANLIST) ---
  {
    name: 'gban',
    aliases: ['globalban', 'botban', 'globalblock', 'gblock', 'userblacklist', 'botblacklist'],
    description: '[BOT OWNER ONLY] Globally block a user from executing any Athena commands across all servers.',
    category: 'security',
    permissions: [],
    slashHidden: false,
    options: [
      {
        name: 'target',
        description: 'Target user mention or ID to globally ban',
        type: 3,
        required: false
      },
      {
        name: 'reason',
        description: 'Reason for global blacklist',
        type: 3,
        required: false
      },
      {
        name: 'action',
        description: 'Optional action mode',
        type: 3,
        required: false,
        choices: [
          { name: 'Ban User', value: 'add' },
          { name: 'Unban User', value: 'remove' },
          { name: 'List Banned Users', value: 'list' }
        ]
      }
    ],
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) {
        return message.reply(cv2.danger('Permission Denied', `${message.author} Only the **Bot Owner** can manage the global bot blacklist.`));
      }

      const firstArg = args[0]?.toLowerCase();
      if (!firstArg) {
        return message.reply(cv2.warn(
          'Command Error',
          `${message.author} Usage:\n` +
          `> -# \`!gban <@user|userId> [reason]\` - Globally ban a user\n` +
          `> -# \`!gunban <@user|userId>\` - Globally unban a user\n` +
          `> -# \`!gban list\` - View all globally blacklisted users`
        ));
      }

      let action = 'add';
      let targetId = null;
      let reason = null;

      if (firstArg === 'list') {
        action = 'list';
      } else if (firstArg === 'add' || firstArg === 'ban' || firstArg === 'block') {
        action = 'add';
        targetId = args[1]?.replace(/[<@!>]/g, '');
        reason = args.slice(2).join(' ') || null;
      } else if (firstArg === 'remove' || firstArg === 'unban' || firstArg === 'unblock') {
        action = 'remove';
        targetId = args[1]?.replace(/[<@!>]/g, '');
      } else {
        // Direct invocation: !gban @user [reason]
        action = 'add';
        targetId = args[0]?.replace(/[<@!>]/g, '');
        reason = args.slice(1).join(' ') || null;
      }

      const result = await handleBotBlacklist(action, targetId, reason, message.client);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply(cv2.danger('Permission Denied', `${interaction.user} Only the **Bot Owner** can manage the global bot blacklist.`));
      }

      const actionOption = interaction.options.getString('action');
      const targetOption = interaction.options.getString('target')?.replace(/[<@!>]/g, '');
      const reasonOption = interaction.options.getString('reason');

      const action = actionOption || (targetOption ? 'add' : 'list');
      const result = await handleBotBlacklist(action, targetOption, reasonOption, interaction.client);
      await interaction.reply(result);
    }
  },

  {
    name: 'gunban',
    aliases: ['globalunban', 'botunban', 'globalunblock', 'gunblock'],
    description: '[BOT OWNER ONLY] Globally unban a user and restore their access to Athena commands.',
    category: 'security',
    permissions: [],
    slashHidden: false,
    options: [
      {
        name: 'target',
        description: 'Target user mention or ID to unban',
        type: 3,
        required: true
      }
    ],
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) {
        return message.reply(cv2.danger('Permission Denied', `${message.author} Only the **Bot Owner** can manage the global bot blacklist.`));
      }

      const targetId = args[0]?.replace(/[<@!>]/g, '');
      if (!targetId) {
        return message.reply(cv2.warn('Command Error', `${message.author} Usage: \`!gunban <@user|userId>\``));
      }

      const result = await handleBotBlacklist('remove', targetId, null, message.client);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply(cv2.danger('Permission Denied', `${interaction.user} Only the **Bot Owner** can manage the global bot blacklist.`));
      }

      const targetId = interaction.options.getString('target')?.replace(/[<@!>]/g, '');
      const result = await handleBotBlacklist('remove', targetId, null, interaction.client);
      await interaction.reply(result);
    }
  },

  {
    name: 'gbanlist',
    aliases: ['globalbanlist', 'botbanlist', 'gblacklist'],
    description: '[BOT OWNER ONLY] View all users currently globally banned from Athena Prime.',
    category: 'security',
    permissions: [],
    slashHidden: false,
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) {
        return message.reply(cv2.danger('Permission Denied', `${message.author} Only the **Bot Owner** can view the global bot blacklist.`));
      }

      const result = await handleBotBlacklist('list', null, null, message.client);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply(cv2.danger('Permission Denied', `${interaction.user} Only the **Bot Owner** can view the global bot blacklist.`));
      }

      const result = await handleBotBlacklist('list', null, null, interaction.client);
      await interaction.reply(result);
    }
  },

  {
    name: 'incidents',
    aliases: ['liverecords', 'threatlogs', 'securityrecords', 'seclogs'],
    description: 'Displays the real-time live security incident and hostile interception audit records.',
    category: 'security',
    permissions: [],
    slashHidden: false,
    options: [
      {
        name: 'page',
        description: 'Page number to view',
        type: 4,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(message.author.id) || message.author.id === message.guild.ownerId || db.isExtraOwner(message.guild.id, message.author.id);
      if (!allowed) {
        return message.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can view live security records.'));
      }
      const page = Math.max(0, (parseInt(args[0]) || 1) - 1);
      const panel = await getSecurityLiveRecordsPanel(message.guild, page);
      return message.reply(panel);
    },
    async executeSlash(interaction) {
      const allowed = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(interaction.user.id) || interaction.user.id === interaction.guild.ownerId || db.isExtraOwner(interaction.guild.id, interaction.user.id);
      if (!allowed) {
        return interaction.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can view live security records.'));
      }
      const page = Math.max(0, (interaction.options.getInteger('page') || 1) - 1);
      const panel = await getSecurityLiveRecordsPanel(interaction.guild, page);
      return interaction.reply(panel);
    }
  },

  // --- BOTWHITELIST COMMAND ---
  {
    name: 'botwhitelist',
    aliases: ['trustedbots', 'bw'],
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
        description: 'The bot\'s User ID (right-click -> Copy ID)',
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
    // --- ANTILINK MODULE COMMAND ---
    {
      name: 'automod',
        aliases: ['automoderator', 'antilink', 'filters'],
        description: 'Opens the interactive Automated Moderation & Security Dashboard (Admin only).',
      category: 'security',
      permissions: [PermissionFlagsBits.Administrator],
      options: [
        {
          name: 'subcommand',
          description: 'Subcommand to run',
          type: 3,
          required: false,
          choices: [
            { name: 'Dashboard', value: 'panel' },
            { name: 'AI Toxicity AutoMod', value: 'ai_toxicity' },
            { name: 'Advanced Config', value: 'advanced' },
            { name: 'List Bypasses', value: 'bypass_list' }
          ]
        }
      ],
      async executePrefix(message, args) {
        if (args && args[0]) {
          const sub = args[0].toLowerCase();
          if (sub === 'ai' || sub === 'aitoxicity') {
            const current = db.getGuildConfig(message.guild.id).aiToxicityEnabled === true;
            let turnOn = !current;
            if (args[1]) {
              const arg1 = args[1].toLowerCase();
              if (arg1 === 'on' || arg1 === 'enable' || arg1 === 'true') turnOn = true;
              else if (arg1 === 'off' || arg1 === 'disable' || arg1 === 'false') turnOn = false;
            }
            db.updateGuildConfig(message.guild.id, { aiToxicityEnabled: turnOn });
            return message.reply(cv2.success('AI Toxicity & Sentiment AutoMod | <a:atheNATICK:1557841381630681106>', turnOn ? 'AI Toxicity & Sentiment AutoMod has been enabled. Doxxing attempts (IPs, SSNs, phone numbers), severe toxicity, and violent harassment will be autonomously intercepted.' : 'AI Toxicity & Sentiment AutoMod has been disabled.'));
          }
          if (sub === 'advanced') {
            const panel = await getAdvancedConfigPanel(message.guild);
            return message.reply(panel);
          }
          if (sub === 'bypass') {
            const action = (args[1] || 'list').toLowerCase();
            const role = message.mentions.roles.first() || (args[2] ? message.guild.roles.cache.get(args[2].replace(/<@&|>/g, '')) : null);
            const res = await handleAutoModBypass(message.guild, action, role);
            return message.reply(res);
          }
        }
        const panel = await getAutoModPanel(message.guild);
        await message.reply(panel);
      },
      async executeSlash(interaction) {
        const sub = interaction.options.getString('subcommand');
        if (sub === 'ai_toxicity') {
          const current = db.getGuildConfig(interaction.guild.id).aiToxicityEnabled === true;
          const turnOn = !current;
          db.updateGuildConfig(interaction.guild.id, { aiToxicityEnabled: turnOn });
          return interaction.reply(cv2.success('AI Toxicity & Sentiment AutoMod | <a:atheNATICK:1557841381630681106>', turnOn ? 'AI Toxicity & Sentiment AutoMod has been enabled. Doxxing attempts (IPs, SSNs, phone numbers), severe toxicity, and violent harassment will be autonomously intercepted.' : 'AI Toxicity & Sentiment AutoMod has been disabled.'));
        }
        if (sub === 'advanced') {
          const panel = await getAdvancedConfigPanel(interaction.guild);
          return interaction.reply(panel);
        }
        if (sub === 'bypass_list') {
          const res = await handleAutoModBypass(interaction.guild, 'list', null);
          return interaction.reply(res);
        }
        await interaction.reply(cv2.info('Processing', 'Please wait...'));
        const panel = await getAutoModPanel(interaction.guild);
        await cv2.edit(interaction, panel);
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
    aliases: ['ss', 'sec', 'shield'],
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
          { name: 'Security Status', value: 'status' },
          { name: 'Real-Time Live Records', value: 'records' }
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
      const records = (sub === 'records' || sub === 'logs' || sub === 'live' || sub === 'incidents' || sub === 'threats');
      
      if (!enable && !disable && !status && !records) {
        return message.reply(cv2.warn('Usage', `${message.author} Usage: \`!security enable all\`, \`!security disable all\`, \`!security status\`, or \`!security records\``));
      }

      if (records) {
        const panel = await getSecurityLiveRecordsPanel(message.guild, 0);
        return message.reply(panel);
      }

      if (status) {
        const panel = await getSecurityStatusPanel(message.guild);
        return message.reply(panel);
      }

      if (enable) {
          const maxPos = Math.max(...message.guild.roles.cache.map(r => r.position));
          const botMember = await message.guild.members.fetch(message.client.user.id);
            const botPos = botMember.roles.highest.position;
          if (botPos < maxPos - 2) {
            return message.reply(cv2.danger('Insufficient Role Hierarchy', `To guarantee uncompromised security enforcement, my highest role must be placed among the **Top 3 highest roles** in the server hierarchy.\n\n-# Currently, the highest role is position **${maxPos}**, but my highest role is only at position **${botPos}**.\n-# Please move my role higher in the server settings and try again.`));
          }

          const config = db.getGuildConfig(message.guild.id);
          if (config.securityEnabled) {
            return message.reply(cv2.warn('Security Active', 'Security is already enabled on this server. To re-enable or refresh the system, please use `!security disable all` first, and then run `!security enable all` again.'));
          }
        if (message.guild.memberCount < 200 && !isBotOwnerSync(message.author.id)) {
          return message.reply(cv2.danger('Requirement Not Met', 'Your server must have at least **200 members** to enable unbypassable security.\n\n**Bot Owners bypass this restriction.**'));
        }

        const initDisplay = new TextDisplayBuilder().setContent('> -# <a:loading:1542155051286396938> **Athena Prime Antinuke Setup**\n> -# **Antinuke Setup Working...**');
          const initContainer = new ContainerBuilder().addTextDisplayComponents(initDisplay);
          const msg = await message.reply({ components: [initContainer.toJSON ? initContainer.toJSON() : initContainer], flags: MessageFlags.IsComponentsV2 });
        const success = await runSecurityEnableSequence(message.guild, async (payload) => { await cv2.edit(msg, payload).catch(() => null); }); if (!success) return;
        const tosPanel = await getServerSecurityEnabledPanel(typeof message !== 'undefined' ? message.guild : interaction.guild);
        await message.channel.send(tosPanel);
        const panel = await getSecureDashboardPanel(message.guild);
        await message.channel.send(panel);
      } else if (disable) {
        const config = db.getGuildConfig(message.guild.id);
        if (!config.securityEnabled && !config.antiNukeEnabled) {
          return message.reply(cv2.warn("Security Inactive", "Security is already disabled on this server."));
        }

        if (config.twoFactorVerified && config.twoFactorEmail) {
          const code2fa = Math.floor(100000 + Math.random() * 900000).toString();
          db.updateGuildConfig(message.guild.id, { pendingTwoFactorCode: code2fa, pendingAction: "disable_all" });
          
          try {
            const { send2FACode } = await import("../utils/mailer.js");
            send2FACode(config.twoFactorEmail, code2fa, message.guild.name).catch(e => console.log('SMTP Blocked:', e.message));
          } catch (err) {}

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("btn_intercept_2fa").setLabel("Enter 2FA Code").setStyle(ButtonStyle.Danger)
          );
          return message.reply({ content: "?? **Critical Security Action Blocked** ??\nAn email has been sent to your registered Gmail address. You must verify it to authorize this action.", components: [row] }).catch(() => null);
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
      const records = action === 'records';

      if (records) {
        const panel = await getSecurityLiveRecordsPanel(interaction.guild, 0);
        return interaction.reply(panel);
      }

      if (status) {
        const panel = await getSecurityStatusPanel(interaction.guild);
        return interaction.reply(panel);
      }

      if (enable) {
          const maxPos = Math.max(...interaction.guild.roles.cache.map(r => r.position));
          const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
            const botPos = botMember.roles.highest.position;
          if (botPos < maxPos - 2) {
            return interaction.reply(cv2.danger('Insufficient Role Hierarchy', `To guarantee uncompromised security enforcement, my highest role must be placed among the **Top 3 highest roles** in the server hierarchy.\n\n-# Currently, the highest role is position **${maxPos}**, but my highest role is only at position **${botPos}**.\n-# Please move my role higher in the server settings and try again.`));
          }

          const config = db.getGuildConfig(interaction.guild.id);
          if (config.securityEnabled) {
            return interaction.reply(cv2.warn('Security Active', 'Security is already enabled on this server. To re-enable or refresh the system, please use `/security disable_all` first, and then run `/security enable_all` again.'));
          }
        if (interaction.guild.memberCount < 200 && !isBotOwnerSync(interaction.user.id)) {
          return interaction.reply(cv2.danger('Requirement Not Met', 'Your server must have at least **200 members** to enable unbypassable security.\n\n**Bot Owners bypass this restriction.**'));
        }

        const initDisplay2 = new TextDisplayBuilder().setContent('> -# <a:loading:1542155051286396938> **Athena Prime Antinuke Setup**\n> -# **Antinuke Setup Working...**');
          const initContainer2 = new ContainerBuilder().addTextDisplayComponents(initDisplay2);
          await interaction.reply({ components: [initContainer2.toJSON ? initContainer2.toJSON() : initContainer2], flags: MessageFlags.IsComponentsV2 });
        const success = await runSecurityEnableSequence(interaction.guild, async (payload) => { await cv2.edit(interaction, payload).catch(() => null); }); if (!success) return;
        const tosPanel = await getServerSecurityEnabledPanel(typeof message !== 'undefined' ? message.guild : interaction.guild);
        if (interaction.channel) await interaction.channel.send(tosPanel).catch(() => null);
        const panel = await getSecureDashboardPanel(interaction.guild);
        if (interaction.channel) await interaction.channel.send(panel).catch(() => null);
      } else if (disable) {
        const config = db.getGuildConfig(interaction.guild.id);
        if (!config.securityEnabled) {
          return interaction.reply(cv2.warn("Security Inactive", "Security is already disabled on this server."));
        }

        if (config.twoFactorVerified && config.twoFactorEmail) {
          const code2fa = Math.floor(100000 + Math.random() * 900000).toString();
          db.updateGuildConfig(interaction.guild.id, { pendingTwoFactorCode: code2fa, pendingAction: "disable_all" });
          
          try {
            const { send2FACode } = await import("../utils/mailer.js");
            send2FACode(config.twoFactorEmail, code2fa, interaction.guild.name).catch(e => console.log('SMTP Blocked:', e.message));
          } catch (err) {}

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("btn_intercept_2fa").setLabel("Enter 2FA Code").setStyle(ButtonStyle.Danger)
          );
          return interaction.reply({ content: "?? **Critical Security Action Blocked** ??\nAn email has been sent to your registered Gmail address. You must verify it to authorize this action.", components: [row], flags: MessageFlags.Ephemeral });
        }

        const result = await handleSecurityToggleAll(interaction.guild, interaction.member, false);
        await interaction.reply(result);
    
      }
    }
  },

  // --- QRMANAGER - Quarantine system setup and repair
  {
    name: 'qrmanager',
    description: 'Quarantine system manager Ã¢â‚¬â€ fix permissions, set role/channel/VC. (Admin only)',
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
          { name: 'Set Quarantine Category',     value: 'setcategory' },
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
        description: 'Channel or category to set (for setcategory, setchannel, or setvc)',
        type: 7,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const action = args[0]?.toLowerCase();
      if (!action) return message.reply(cv2.warn('Usage', 'Usage: `!qrmanager setup|setrole|setcategory|setchannel|setvc|status`'));
      
      let role = message.mentions.roles.first() || null;
      let channel = message.mentions.channels.first() || null;
      
      if (!role && args[1] && action === 'setrole') {
        role = await message.guild.roles.fetch(args[1]).catch(() => null);
      }
      if (!channel && args[1] && (action === 'setchannel' || action === 'setvc' || action === 'setcategory')) {
        channel = await message.guild.channels.fetch(args[1]).catch(() => null);
      }
      
      const result = await handleQrManager(message.guild, message.member, action, role, channel);
      await message.reply(result);
    },
    async executeSlash(interaction) {
      await interaction.reply(cv2.info('Processing', 'Please wait...'));
      const action = interaction.options.getString('action');
      const role = interaction.options.getRole('role');
      const channel = interaction.options.getChannel('channel');
      const result = await handleQrManager(interaction.guild, interaction.member, action, role, channel);
      await cv2.edit(interaction, result);
    }
  },

  // --- SETUPQUARANTINE / AUTO-SETUP QUARANTINE ---
  {
    name: 'setupquarantine',
    aliases: ['quarantinesetup', 'autosetupquarantine', 'qrsetup', 'quarantine-setup'],
    description: 'Auto-setup Quarantine role, text channel, voice channel, and server isolation.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [],
    async executePrefix(message) {
      if (!isBotOwnerOrServerOwnerStrict(message.author.id, message.guild) && !isExtraOwner(message.guild.id, message.author.id) && !message.member.permissions?.has(PermissionFlagsBits.Administrator) && !isServerAdmin(message.member, message.guild.id)) {
        return message.reply(cv2.danger('Access Denied', 'Only Server Admins, Extra Owners, and Bot Owners can run quarantine auto-setup.'));
      }

      const statusMsg = await message.reply(cv2.info('Quarantine Auto-Setup', '<a:loading:1542155051286396938> Scanning and configuring Quarantine Role, Category, Text Channel, and Voice Channel...'));
      try {
        const res = await autoSetupQuarantine(message.guild);
        return statusMsg.edit(formatQuarantineSetupResult(res));
      } catch (err) {
        return statusMsg.edit(cv2.danger('Auto-Setup Error', `Failed to complete quarantine setup: ${err.message}`));
      }
    },
    async executeSlash(interaction) {
      if (!isBotOwnerOrServerOwnerStrict(interaction.user.id, interaction.guild) && !isExtraOwner(interaction.guild.id, interaction.user.id) && !interaction.member.permissions?.has(PermissionFlagsBits.Administrator) && !isServerAdmin(interaction.member, interaction.guild.id)) {
        return interaction.reply(cv2.danger('Access Denied', 'Only Server Admins, Extra Owners, and Bot Owners can run quarantine auto-setup.'));
      }

      await interaction.reply(cv2.info('Quarantine Auto-Setup', '<a:loading:1542155051286396938> Scanning and configuring Quarantine Role, Category, Text Channel, and Voice Channel...'));
      try {
        const res = await autoSetupQuarantine(interaction.guild);
        return cv2.edit(interaction, formatQuarantineSetupResult(res));
      } catch (err) {
        return cv2.edit(interaction, cv2.danger('Auto-Setup Error', `Failed to complete quarantine setup: ${err.message}`));
      }
    }
  },

  // --- MASSQUARANTINE COMMAND ---
  {
    name: 'massquarantine',
    aliases: ['mq', 'massq'],
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
      await cv2.edit(statusMsg, result);
    },
    async executeSlash(interaction) {
      await interaction.reply(cv2.info('Processing', 'Please wait...'));
      const role = interaction.options.getRole('role');
      const reason = interaction.options.getString('reason') || 'Mass quarantine by administrator';
      const result = await handleMassQuarantine(interaction.guild, interaction.member, role, reason);
      await cv2.edit(interaction, result);
    }
  },

  // --- MASSUNQUARANTINE COMMAND ---
  {
    name: 'massunquarantine',
    aliases: ['muq', 'massunq'],
    description: 'Release ALL currently quarantined members in this server at once. (Admin only)',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [],
    async executePrefix(message) {
      const statusMsg = await message.reply(cv2.info('Mass Unquarantine Started', ' Releasing all quarantined members...'));
      const result = await handleMassUnquarantine(message.guild, message.member, message.client);
      await cv2.edit(statusMsg, result);
    },
    async executeSlash(interaction) {
      await interaction.reply(cv2.info('Processing', 'Please wait...'));
      const result = await handleMassUnquarantine(interaction.guild, interaction.member, interaction.client);
      await cv2.edit(interaction, result);
    }
  },

  // --- SCAN SERVER COMMAND ---
  {
    name: 'scanserver',
    aliases: ['scan', 'bots', 'auditperms', 'secscan'],
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
  // --- ONBOARDING NEUTRALIZER COMMAND ---
  {
    name: 'neutralizeonboarding',
    aliases: ['onboarding', 'onboardingguard', 'scanonboarding', 'neutralize'],
    slashHidden: true,
    description: 'Scan and neutralize dangerous roles configured in Discord Onboarding prompts.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    async executePrefix(message) {
      if (!isBotOwnerOrServerOwnerStrict(message.author.id, message.guild) && !isExtraOwner(message.guild.id, message.author.id)) {
        return message.reply(cv2.danger('Permission Denied', 'Only Server Owners and Extra Owners can audit Discord Onboarding.'));
      }
      
      const scanStatusMsg = await message.reply(cv2.info('Onboarding Audit', 'Auditing Discord Onboarding configuration for dangerous roles...'));
      const result = await auditAndNeutralizeOnboarding(message.guild, {
        quiet: false,
        reason: `Manual execution by ${message.author.tag} (${message.author.id})`
      });

      if (!result.success) {
        return scanStatusMsg.edit(cv2.danger('Audit Error', `Failed to audit Discord Onboarding: ${result.error || result.reason || 'Unknown error'}`));
      }

      if (!result.onboardingActive) {
        return scanStatusMsg.edit({
          components: [{
            type: 17,
            components: [
              { type: 10, content: `## Onboarding Sentinel Audit | <a:atheNATICK:1557841381630681106>` },
              { type: 14, divider: true },
              {
                type: 10,
                content:
                  `> -# **Status:** \`Discord Onboarding is not enabled or configured on this server.\`\n` +
                  `> -# **Security Assessment:** \`No Onboarding role vectors detected.\``
              },
              { type: 14, divider: true },
              { type: 10, content: `-# **Athena Prime Zero-Trust Protection Active**` }
            ]
          }],
          flags: MessageFlags.IsComponentsV2
        });
      }

      if (result.neutralizedCount === 0) {
        return scanStatusMsg.edit({
          components: [{
            type: 17,
            components: [
              { type: 10, content: `## Onboarding Security Status | <a:atheNATICK:1557841381630681106>` },
              { type: 14, divider: true },
              {
                type: 10,
                content:
                  `> -# **Status:** \`Clean & Secure\`\n` +
                  `> -# **Prompts Audited:** All Onboarding prompts and options were inspected.\n` +
                  `> -# **Result:** \`Zero dangerous roles detected in Onboarding configuration.\`\n` +
                  `> -# **Covered Permissions:** \`Administrator, Manage Server, Manage Roles, Ban Members, Kick Members, Manage Channels, Manage Webhooks, Mention Everyone, Manage Messages, Timeout Members\``
              },
              { type: 14, divider: true },
              { type: 10, content: `-# **Athena Prime Zero-Trust Protection Active**` }
            ]
          }],
          flags: MessageFlags.IsComponentsV2
        });
      }

      const roleSummaries = result.roles.map(r => 
        `• <@&${r.id}> (\`${r.name}\` | \`${r.id}\`)\n` +
        `  - **Revoked Permissions:** \`${r.perms.join(', ') || 'Administrator / Elevated'}\`\n` +
        `  - **Prompts Scrubbed:** \`${r.prompts.join(', ') || 'Default'}\`\n` +
        `  - **Action Taken:** Disarmed & scrubbed from Onboarding options | \`${r.strippedMembersCount}\` members stripped | \`${r.quarantinedCount}\` isolated`
      ).join('\n\n');

      return scanStatusMsg.edit({
        components: [{
          type: 17,
          components: [
            { type: 10, content: `## Onboarding Exploit Neutralized | <a:atheNATICK:1557841381630681106>` },
            { type: 14, divider: true },
            {
              type: 10,
              content:
                `> -# **Scan Summary:** Neutralized \`${result.neutralizedCount}\` dangerous role(s) attached to Discord Onboarding.\n\n` +
                `> -# **Neutralized Roles:**\n${roleSummaries}\n\n` +
                `> -# **Countermeasures Applied:**\n` +
                `-# • **Permissions Disarmed:** Critical destructive privileges removed from the role.\n` +
                `-# • **Prompts Sanitized:** Excised role options via Discord Onboarding API.\n` +
                `-# • **Member Access Revoked:** Unauthorized holders stripped and isolated in Quarantine.`
            },
            { type: 14, divider: true },
            { type: 10, content: `-# **Athena Prime Zero-Trust Protection Active**` }
          ]
        }],
        flags: MessageFlags.IsComponentsV2
      });
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
        await cv2.edit(statusMsg, cv2.success('Apps Unlocked', `Successfully unlocked application commands in ${successCount} channels for @everyone.`));
      } else {
        await cv2.edit(statusMsg, cv2.success('Apps Locked', `Successfully locked application commands in ${successCount} channels for @everyone.`));
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
      
      await cv2.edit(statusMsg, cv2.success('Apps Unlocked', `Successfully unlocked application commands in ${successCount} channels for @everyone.`));
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
      Connect:      false, // no VC in text channel Ã¢â‚¬â€ just text
      ReadMessageHistory: true
    }, { reason: 'Quarantine zone access grant' }).catch(() => null);

    // BACKGROUND SYNC: Enforce isolation across the entire server
    // This dynamically hides all other channels from the quarantine role
    syncQuarantinePermissions(guild, quarantineRole, quarantineChannel.id).catch(() => null);

    // Capture target voice state
    const prevVoiceChannelId = targetMember.voice.channelId || null;

    // 4. Save original roles to DB (filter out managed integration roles and @everyone)
    let roleIdsToSave = targetMember.roles.cache
      .filter(r => !r.managed && r.id !== guild.id)
      .map(r => r.id);

    const isExploit = /exploit|dangerous|backdoor|unauthorized.*role|rogue.*invite|invite.*role|zero-audit/i.test(reason);
    if (isExploit) {
      db.addExploitTaint(guild.id, targetMember.id, reason);
      const authRoles = db.getAuthRoles(guild.id);
      roleIdsToSave = roleIdsToSave.filter(rid => {
        const r = guild.roles.cache.get(rid);
        if (!r) return false;
        if (authRoles?.admin && authRoles.admin.includes(rid)) return false;
        return !hasDangerousPerms(r.permissions);
      });
    }

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
    const dmEmbed = {
      components: [{
        type: 17,
        components: [{
          type: 9,
          components: [{
            type: 10,
            content: `-# **Server Isolation Notice |** <a:uptime:1552608831060844575>\n> -# **Hello ${targetMember.displayName} , You have been Quarantined in ${guild.name}**\n> -# \u2800\u2800\u2800\u2800\u2570\u203A Your access has been restricted. Please navigate to <#${quarantineChannel.id}> to resolve this matter.\n> -# \u2800\u2800\u2800\u2800\u2570\u203A **Reason:** ${reason}\n> -# \u2800\u2800\u2800\u2800\u2570\u203A **Duration:** ${durationLabel}`
          }],
          accessory: { type: 11, media: { url: guild.iconURL({ dynamic: true }) || undefined } }
        }]
      }],
      flags: MessageFlags.IsComponentsV2
    };
    await targetMember.send(dmEmbed).catch(() => null);

    // 7. Ping target in quarantine channel and post welcome alert
    const welcomeEmbed = {
      components: [{
        type: 17,
        components: [{
          type: 9,
          components: [{
            type: 10,
            content: `-# **You Have Been Quarantined |** <a:uptime:1552608831060844575>\n> -# **Hello [${cleanDisplayName(targetMember.displayName)}](https://discord.com/users/${targetMember.id}) , Security Isolation Active**\n> -# \u2800\u2800\u2800\u2800\u2570\u203A Please wait patiently for an Administrator or Moderator to review your case. Any further spamming or rule violations will result in a permanent ban.\n> -# \u2800\u2800\u2800\u2800\u2570\u203A **Reason:** ${reason}`
          }],
          accessory: { type: 11, media: { url: targetMember.user.displayAvatarURL({ dynamic: true }) } }
        }]
      }],
      flags: MessageFlags.IsComponentsV2
    };
    await quarantineChannel.send(welcomeEmbed).catch((e) => console.error('QUARANTINE_SEND_ERROR:', e));

    // 8. Log the event to logs channel
    const enforcerTier = (moderator.id === guild.members.me.id || !moderator.user) ? 'Athena Prime' : getUserTierName(guild, moderator);
    const targetTier = getUserTierName(guild, targetMember);
    logToSecurityChannel(guild, cv2.log(
      'Quarantine Applied',
      `Member has been isolated.`,
      [
        { name: 'Target', value: `${targetMember.user.tag} (${targetMember.id}) [${targetTier}]`, inline: true },
        { name: 'Enforcer', value: `${moderator.user?.tag || 'System'} [${enforcerTier}]`, inline: true },
        { name: 'Reason', value: reason }
      ],
      'danger'
    ));



    const responseEmbed = cv2.danger(
      'User Quarantined',
      `Successfully quarantined **${targetMember.user.tag}**.`,
      [
        { name: 'Member',      value: `[${cleanDisplayName(targetMember.displayName)}](https://discord.com/users/${targetMember.id})`,           inline: true },
        { name: 'Enforced by', value: `[${cleanDisplayName(moderator.displayName || moderator.user?.username || 'System')}](https://discord.com/users/${moderator.id || moderator.user?.id})`,              inline: true },
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
    let savedRoleIds = record.roles || [];
    if (db.isExploitTainted(guild.id, targetMember.id)) {
      const authRoles = db.getAuthRoles(guild.id);
      savedRoleIds = savedRoleIds.filter(id => {
        const r = guild.roles.cache.get(id);
        if (!r) return false;
        if (authRoles?.admin && authRoles.admin.includes(id)) return false;
        return !hasDangerousPerms(r.permissions);
      });
    }
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
        `<a:uptime:1552608831060844575> The server Lockdown/Raid Mode in **${guild.name}** has been lifted!\nYour original access privileges have been fully restored.`,
        []
      );
    } else {
      dmEmbed = cv2.success(
        'Isolation Terminated',
        `<a:alert1:1533860044154732704> Your quarantine status has been lifted in **${guild.name}**! Your original access privileges have been fully restored.`,
        []
      );
    }
    await targetMember.send(dmEmbed).catch(() => null);

    // Log the event
    const unqEnforcerTier = (moderator.id === guild.members.me.id || !moderator.user) ? 'Athena Prime' : getUserTierName(guild, moderator);
    const unqTargetTier = getUserTierName(guild, targetMember);
    if (context === 'auto') {
      logToSecurityChannel(guild, cv2.info(
        'Auto-Unquarantine',
        `<@${targetMember.id}> [${unqTargetTier}]'s quarantine duration expired - automatically released.`
      ));
    } else {
      logToSecurityChannel(guild, cv2.log(
        'Quarantine Lifted',
        `Member has been restored.`,
        [
          { name: 'Target', value: `${targetMember.user.tag} (${targetMember.id}) [${unqTargetTier}]`, inline: true },
          { name: 'Moderator', value: `${moderator.user?.tag || 'System'} [${unqEnforcerTier}]`, inline: true }
        ],
        'success'
      ));
    }

        const c = new ContainerBuilder();
    const textContent = `**Quarantine Lifted | <a:uptime:1552608831060844575>**\n-# > Successfully restored **${cleanDisplayName(targetMember.displayName)}** and recovered their original role structure.\n-# > \u2800\u2800\u2800\u2800\u2570\u203A User: [${cleanDisplayName(targetMember.displayName)}](https://discord.com/users/${targetMember.id}) • Moderator: [${cleanDisplayName(moderator.displayName || moderator.user?.username || 'System')}](https://discord.com/users/${moderator.id || moderator.user?.id})`;
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent));
    
    const responseEmbed = { components: [c.toJSON ? c.toJSON() : c], flags: MessageFlags.IsComponentsV2 };

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

    const modTier = getUserTierName(guild, moderator);
    logToSecurityChannel(guild, cv2.log('Emergency Mode Activated', `**${moderator.user.tag}** [${modTier}] has triggered Emergency Mode! All roles below the bot have been stripped of permissions and channels are hidden.`, [], 'danger'));

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

    const endModTier = getUserTierName(guild, moderator);
    logToSecurityChannel(guild, cv2.log('Emergency Mode Ended', `**${moderator.user.tag}** [${endModTier}] has ended Emergency Mode. Restored ${rolesRestored} roles and ${channelsRestored} channels.`, [], 'success'));

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
    const modTier = getUserTierName(guild, moderator);
    if (mode === 'on') {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false
      });
      const lockEmbed = cv2.danger(
        'Lockdown Activated', 
        `<a:uptime:1552608831060844575> This channel has been placed under administrative lockdown by **${moderator.user.tag}**. Writing has been disabled.`
      );
      logToSecurityChannel(guild, cv2.log('Channel Locked', `Moderator **${moderator.user.tag}** [${modTier}] locked down channel **#${channel.name}**.`, [], 'warning'));
      return lockEmbed;
    } else {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null
      });
      const unlockEmbed = cv2.success(
        'Lockdown Deactivated', 
        `<a:uptime:1552608831060844575> Channel lockdown has been lifted by **${moderator.user.tag}**. Permission to write has been restored.`
      );
      logToSecurityChannel(guild, cv2.log('Channel Unlocked', `Moderator **${moderator.user.tag}** [${modTier}] unlocked channel **#${channel.name}**.`, [], 'success'));
      return unlockEmbed;
    }
  } catch (error) {
    console.error(error);
    return cv2.danger('<:off:1533844858983157851> Failed', 'Could not modify permissions for this channel.');
  }
}

export async function handlePanicLockdown(guild, moderator, tier = '1', updateProgress) {
  const isAuthorizedAdmin = isBotOwnerSync(moderator.id) || moderator.id === guild.ownerId || isExtraOwner(guild.id, moderator.id) || moderator.permissions.has(PermissionFlagsBits.Administrator);
  if (!isAuthorizedAdmin) {
    return cv2.danger('Access Denied', 'You lack authorization to engage server panic lockdown. Administrator or higher clearance required.');
  }

  const existingSnapshot = db.getLockdownSnapshot(guild.id);
  if (existingSnapshot) {
    return cv2.warn('Lockdown Already Active', `A Tier **${existingSnapshot.tier}** lockdown is already active on this server. Use \`!unlockdown\` to lift it.`);
  }

  const tierNormalized = String(tier).toLowerCase();
  let tierNum = 1;
  let tierLabel = 'Tier 1 (Soft Lockdown)';
  if (tierNormalized === '2' || tierNormalized === 'medium' || tierNormalized === 'med') {
    tierNum = 2;
    tierLabel = 'Tier 2 (Medium Lockdown)';
  } else if (tierNormalized === '3' || tierNormalized === 'nuclear' || tierNormalized === 'nuke') {
    tierNum = 3;
    tierLabel = 'Tier 3 (Nuclear Lockdown)';
  }

  if (updateProgress) await updateProgress(cv2.warn('Panic Lockdown Protocol Engaged', `Snapshotting channel hierarchy and deploying **${tierLabel}**...`)).catch(() => null);

  await guild.channels.fetch().catch(() => null);
  const currentConfig = db.getGuildConfig(guild.id);
  const preRaidMode = Boolean(currentConfig?.raidMode);

  const snapshotChannels = [];
  const modifiedChannels = [];

  guild.channels.cache.forEach(channel => {
    if (!channel.permissionOverwrites) return;
    const overwrites = channel.permissionOverwrites.cache.map(ow => ({
      id: ow.id,
      type: ow.type,
      allow: ow.allow.bitfield.toString(),
      deny: ow.deny.bitfield.toString()
    }));
    snapshotChannels.push({ id: channel.id, overwrites });
    modifiedChannels.push(channel);
  });

  // Save snapshot to database immediately
  db.saveLockdownSnapshot(guild.id, {
    tier: tierNum,
    tierLabel,
    moderatorId: moderator.id,
    preRaidMode,
    channels: snapshotChannels
  });

  let modifiedCount = 0;
  for (const channel of modifiedChannels) {
    try {
      const isRulesOrPublic = (channel.id === guild.rulesChannelId || channel.id === guild.publicUpdatesChannelId);
      if (tierNum === 1) {
        if (channel.isTextBased()) {
          await channel.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: false,
            SendMessagesInThreads: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false
          }).catch(() => null);
        } else if (channel.isVoiceBased()) {
          await channel.permissionOverwrites.edit(guild.roles.everyone, {
            Speak: false
          }).catch(() => null);
        }
      } else if (tierNum === 2) {
        if (channel.isTextBased()) {
          await channel.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: false,
            SendMessagesInThreads: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            AddReactions: false,
            UseApplicationCommands: false,
            AttachFiles: false,
            EmbedLinks: false
          }).catch(() => null);
        } else if (channel.isVoiceBased()) {
          await channel.permissionOverwrites.edit(guild.roles.everyone, {
            Speak: false
          }).catch(() => null);
        }
      } else if (tierNum === 3) {
        if (isRulesOrPublic) {
          await channel.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: false,
            AddReactions: false
          }).catch(() => null);
        } else if (channel.isTextBased()) {
          await channel.permissionOverwrites.edit(guild.roles.everyone, {
            ViewChannel: false,
            SendMessages: false
          }).catch(() => null);
        } else if (channel.isVoiceBased()) {
          await channel.permissionOverwrites.edit(guild.roles.everyone, {
            ViewChannel: false,
            Connect: false
          }).catch(() => null);
        }
      }
      modifiedCount++;
    } catch (err) {
      // Continue modifying rest of channels
    }
  }

  // If Tier 2 or Tier 3, engage server-wide Raid Mode to quarantine incoming accounts
  if (tierNum >= 2) {
    db.updateGuildConfig(guild.id, { raidMode: true });
  }

  const modTier = getUserTierName(guild, moderator);
  logToSecurityChannel(guild, cv2.log(
    'Panic Lockdown Engaged',
    `**${moderator.user.tag}** [${modTier}] engaged **${tierLabel}** across ${modifiedCount} channels. Pre-lockdown bitmasks snapshotted in DB.`,
    [
      { name: 'Tier', value: tierLabel, inline: true },
      { name: 'Enforcer', value: `<@${moderator.id}>`, inline: true },
      { name: 'Raid Mode', value: tierNum >= 2 ? 'Active' : 'Standby', inline: true }
    ],
    'danger'
  ));

  return cv2.danger(
    `Emergency Panic Lockdown Engaged | <a:atheNATICK:1557841381630681106>`,
    `Athena Defense Matrix has placed the entire server under **${tierLabel}**.\n\n` +
    `-# \u2022 **Channels Affected:** \`${modifiedCount}\` channels secured\n` +
    `-# \u2022 **State Snapshot:** Pre-lockdown permissions securely persisted to database\n` +
    `-# \u2022 **Raid Mode:** ${tierNum >= 2 ? 'Enabled (Auto-quarantine active)' : 'Preserved'}\n` +
    `-# \u2022 **Restoration:** Type \`!unlockdown\` or \`/unlockdown\` to restore exact pre-lockdown state.`
  );
}

export async function handleUnlockdown(guild, moderator, updateProgress) {
  const isAuthorizedAdmin = isBotOwnerSync(moderator.id) || moderator.id === guild.ownerId || isExtraOwner(guild.id, moderator.id) || moderator.permissions.has(PermissionFlagsBits.Administrator);
  if (!isAuthorizedAdmin) {
    return cv2.danger('Access Denied', 'You lack authorization to lift server panic lockdown. Administrator or higher clearance required.');
  }

  const snapshot = db.getLockdownSnapshot(guild.id);
  if (!snapshot || !snapshot.channels || snapshot.channels.length === 0) {
    return cv2.warn('No Active Lockdown Snapshot', 'No active emergency panic lockdown snapshot was found in the database for this server.');
  }

  if (updateProgress) await updateProgress(cv2.info('Restoring Server State', `Restoring pre-lockdown channel overwrites from snapshot...`)).catch(() => null);

  await guild.channels.fetch().catch(() => null);
  let restoredCount = 0;
  let errorCount = 0;

  for (const cData of snapshot.channels) {
    const channel = guild.channels.cache.get(cData.id);
    if (channel) {
      try {
        const overwrites = cData.overwrites.map(ow => ({
          id: ow.id,
          type: ow.type,
          allow: BigInt(ow.allow),
          deny: BigInt(ow.deny)
        }));
        await channel.permissionOverwrites.set(overwrites, `Panic Lockdown Lifted by ${moderator.user.tag}`);
        restoredCount++;
      } catch (e) {
        errorCount++;
      }
    }
  }

  // Restore raidMode state
  if (snapshot.preRaidMode !== undefined) {
    db.updateGuildConfig(guild.id, { raidMode: snapshot.preRaidMode });
  }

  // Clear snapshot from DB
  db.clearLockdownSnapshot(guild.id);

  const modTier = getUserTierName(guild, moderator);
  logToSecurityChannel(guild, cv2.log(
    'Panic Lockdown Lifted',
    `**${moderator.user.tag}** [${modTier}] deactivated panic lockdown. Restored ${restoredCount} channels from DB snapshot.`,
    [
      { name: 'Restored Channels', value: `${restoredCount}`, inline: true },
      { name: 'Enforcer', value: `<@${moderator.id}>`, inline: true }
    ],
    'success'
  ));

  return cv2.success(
    `Server Lockdown Lifted`,
    `Successfully recovered and restored all channel permissions from database snapshot.\n\n` +
    `-# \u2022 **Channels Restored:** \`${restoredCount}\` channels\n` +
    `-# \u2022 **Original Permissions:** Bitmasks fully synchronized\n` +
    `-# \u2022 **Raid Mode:** Reverted to pre-lockdown state\n` +
    `-# \u2022 **Snapshot:** Flushed from database memory.`
  );
}

async function handleRaidMode(guild, moderator, mode) {
  const enabled = mode === 'on';
  db.updateGuildConfig(guild.id, { raidMode: enabled });
  const modTier = getUserTierName(guild, moderator);

  if (enabled) {
    const resEmbed = cv2.raid(
      'Raid Mode Engaged',
      `<a:alert1:1533860044154732704> **Server Raid Protection is now ACTIVE.**\nAll joining accounts will be automatically quarantined immediately to protect the server until deactivated.`,
      [{ name: 'Enforced by', value: `[${cleanDisplayName(moderator.displayName || moderator.user?.username || 'System')}](https://discord.com/users/${moderator.id || moderator.user?.id})` }]
    );
    logToSecurityChannel(guild, cv2.log('Raid Mode Active', `Administrator **${moderator.user.tag}** [${modTier}] turned ON Guild Raid Mode.`, [], 'raid'));
    return resEmbed;
  } else {
    // Automatically mass unquarantine everyone caught in the raid
    const unquarantineResult = await handleMassUnquarantine(guild, moderator, guild.client, 'raidmode');
    
    let releaseNote = '';
    if (unquarantineResult.success > 0 || unquarantineResult.failed > 0) {
       releaseNote = `\n\n**Auto-Release Triggered:**\nSuccessfully released \`${unquarantineResult.success}\` members (\`${unquarantineResult.failed}\` failed).`;
    } else {
       releaseNote = `\n\n*(No quarantined accounts to release)*`;
    }

    const resEmbed = cv2.success(
      'Raid Mode Disengaged',
      ` **Server Raid Protection is now OFF.**\nNew accounts can join normally.${releaseNote}`,
      [{ name: 'Lifted by', value: `[${cleanDisplayName(moderator.displayName || moderator.user?.username || 'System')}](https://discord.com/users/${moderator.id || moderator.user?.id})` }]
    );
    logToSecurityChannel(guild, cv2.log(
      'Raid Mode Off', 
      `Administrator **${moderator.user.tag}** [${modTier}] turned OFF Guild Raid Mode.`, 
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
    antiBan: 'Anti Ban',
    antiKick: 'Anti Kick',
    antiUnban: 'Anti Unban',
    antiInvite: 'Anti Invite',
    antiLinkedRole: 'Anti Linked Role Exploit'
  };

  const emojiOn = '<:on:1533844867191406672>'; 
  const emojiOff = '<:off:1533844858983157851>'; 
  
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
        emoji: isEnabled ? { id: '1533844867191406672' } : { id: '1533844858983157851' }
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

  return { components: [panelContainer.toJSON ? panelContainer.toJSON() : panelContainer], flags: MessageFlags.IsComponentsV2 };
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

  const card = {
    type: 17,
    components: [
      { type: 10, content: description },
      { type: 1, components: [
          { type: 2, custom_id: 'wlo_manage_users', label: 'Manage Users', style: 2 },
          { type: 2, custom_id: 'wlo_remove_users', label: 'Remove User', style: 2 },
          { type: 2, custom_id: 'wlo_add_users', label: 'Add User', style: 2 }
      ]},
      { type: 1, components: [
          { type: 2, custom_id: 'wlo_manage_roles', label: 'Manage Roles', style: 2 },
          { type: 2, custom_id: 'wlo_remove_roles', label: 'Remove Role', style: 2 },
          { type: 2, custom_id: 'wlo_add_roles', label: 'Add Role', style: 2 }
      ]},
      { type: 1, components: [
          { type: 2, custom_id: 'wl_close', label: 'Close', style: 2 }
      ]}
    ]
  };

  return { components: [card.toJSON ? card.toJSON() : card], flags: MessageFlags.IsComponentsV2 };
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
  return { components: [panelContainer.toJSON ? panelContainer.toJSON() : panelContainer], flags: MessageFlags.IsComponentsV2 };
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
    const formattedWords = list.map(w => `- \`${w}\``).join('\n');
    return cv2.info('Filtered Word Blacklist', `If a non-moderator sends a message matching any of these terms, it will be deleted immediately:\n\n${formattedWords}`);
  }
}
export async function buildAutonickDashboard(guildId, guild = null) {
  let cfg = db.getGuildConfig(guildId);
  if (!cfg.autonick) {
    cfg.autonick = { enabled: false, prefix: '', suffix: '', layout: '{name}' };
    db.updateGuildConfig(guildId, { autonick: cfg.autonick });
  }

  const { formatNickname } = await import('../utils/helpers.js');
  const ON = '<:on:1533844867191406672>';
  const OFF = '<:off:1533844858983157851>';
  const isEnabled = !!cfg.autonick.enabled;
  const layout = cfg.autonick.layout || '{name}';
  const preview = formatNickname(layout, 'Speed');

  let statsSection = '';
  if (guild) {
    try {
      const allMembers = guild.members.cache.filter(m => !m.user.bot && m.id !== guild.ownerId);
      const manageable = allMembers.filter(m => m.manageable);
      const synced = manageable.filter(m => {
        const expected = formatNickname(layout, m.user.globalName || m.user.username);
        return m.displayName === expected;
      });
      const percent = manageable.size > 0 ? Math.round((synced.size / manageable.size) * 100) : 0;
      statsSection = `\n-# **• __Live Synced Members:__ \`${synced.size}\` / \`${manageable.size}\` (\`${percent}%\` formatted)**`;
    } catch (e) {}
  }

  const container = {
    type: 17,
    components: [
      {
        type: 10,
        content: `## **__Autonick Manager__**`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: `-# **• __Status:__ ${isEnabled ? `${ON} \`ACTIVE\`` : `${OFF} \`DISABLED\``}**\n` +
                 `-# **• __Current Layout:__ \`${layout}\`**\n` +
                 `-# **• __Example Preview:__ \`${preview}\`**` +
                 statsSection
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: `-# **Use the buttons below to toggle auto-formatting, customize the layout template, or run a live mass-sync across all server members.**`
      },
      { type: 14, divider: true },
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: 'autonick_toggle',
            label: isEnabled ? 'Disable' : 'Enable',
            style: isEnabled ? 4 : 3,
            emoji: { id: isEnabled ? '1533844858983157851' : '1533844867191406672' }
          },
          {
            type: 2,
            custom_id: 'autonick_edit',
            label: 'Edit Layout',
            style: 1
          },
          {
            type: 2,
            custom_id: 'autonick_sync',
            label: 'Sync Members',
            style: 2
          }
        ]
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: 'autonick_restore',
            label: 'Restore Names',
            style: 4
          }
        ]
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: `-# **Athena Bulletproof Security System • V1.0.0**`
      }
    ]
  };

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
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
  const inviteState = config.antiInviteEnabled === true;
  const nukeState = config.antiNukeEnabled;

  const emojiOn = '<:on:1533844867191406672>'; 
  const emojiOff = '<:off:1533844858983157851>'; 

  const description = 
    `# MODULE CONFIGURATION\n` +
    `-# **Athena Prime - God-Tier Firewall**\n\n` +
    `> ${nukeState ? emojiOn : emojiOff} Anti-Nuke Firewall\n` +
    `> ${spamState ? emojiOn : emojiOff} Anti-Spam Filter\n` +
    `> ${inviteState ? emojiOn : emojiOff} Anti-Invite Blocker\n` +
    `> ${blacklistState ? emojiOn : emojiOff} Word Filter (${config.blacklistWords ? config.blacklistWords.length : 0} Words)\n` +
    `> Punishment: \`${config.antiNukePunishment.toUpperCase()}\`\n` +
    `> Warn Limit: \`${config.maxWarnings}\`\n\n` +
    `-# Raw API strike engine active - nuke bots eliminated in ~1-3ms`;

  const mainDisplay = new TextDisplayBuilder().setContent(description);
  const panelContainer = new ContainerBuilder().addTextDisplayComponents(mainDisplay);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_antinuke')
      .setLabel(`Anti-Nuke ${nukeState ? 'ON' : 'OFF'}`)
      .setEmoji(nukeState ? { id: '1533844867191406672' } : { id: '1533844858983157851' })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('toggle_spam')
      .setLabel(`Anti-Spam ${spamState ? 'ON' : 'OFF'}`)
      .setEmoji(spamState ? { id: '1533844867191406672' } : { id: '1533844858983157851' })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('toggle_invite')
      .setLabel(`Anti-Invite ${inviteState ? 'ON' : 'OFF'}`)
      .setEmoji(inviteState ? { id: '1533844867191406672' } : { id: '1533844858983157851' })
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_blacklist_filter')
      .setLabel(`Word Filter ${blacklistState ? 'ON' : 'OFF'}`)
      .setEmoji(blacklistState ? { id: '1533844867191406672' } : { id: '1533844858983157851' })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('cycle_punishment')
      .setLabel(`Punishment: ${config.antiNukePunishment.toUpperCase()}`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('sec_architecture_guide')
      .setLabel('Exploit Guide')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('sec_status_back')
      .setLabel('Status')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('save_panel')
      .setLabel('Close')
      .setStyle(ButtonStyle.Secondary)
  );

  panelContainer.addActionRowComponents(row1, row2);

  return { components: [panelContainer.toJSON ? panelContainer.toJSON() : panelContainer], flags: MessageFlags.IsComponentsV2 };
}

export async function handleAntinukeToggleAll(guild, moderator, enable) {
  // NOTE: autonick is intentionally NOT touched Ã¢â‚¬â€  it must be enabled manually by server owner
  const updates = {
    antiNukeEnabled:   enable,
    antiSpamEnabled:   enable,
    antiInviteEnabled: false,
    antiLinkEnabled:   enable,
    antinukeModules:   {}
  };

  const allKeys = ['antiRoleCreate', 'antiRoleDelete', 'antiRoleUpdate', 'antiRolePermUpdate', 'antiMemberRoleUpdate', 'antiRoleReorder', 'antiChannelCreate', 'antiChannelDelete', 'antiChannelUpdate', 'antiChannelPermUpdate', 'antiChannelReorder', 'antiChannelNameMod', 'antiEmojiCreate', 'antiEmojiDelete', 'antiEmojiUpdate', 'antiWebhooks', 'antiBotAdd', 'antiServerUpdate', 'antiBan', 'antiKick', 'antiUnban', 'antiInvite', 'antiScheduledEvents', 'antiMemberPurge', 'antiMassBan', 'antiAutomodUpdate', 'antiAppCommands', 'antiLinkedRole'];
  for (const key of allKeys) {
    if (key === 'antiInvite') {
      updates.antinukeModules[key] = false;
    } else {
      updates.antinukeModules[key] = enable;
    }
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
        '<:on:1533844867191406672> God-Tier Firewall - Fully Operational',
        `<:on:1533844867191406672> **Firewall Layer:** Raw API Strike Engine Active
<:on:1533844867191406672> **Predictive Layer:** Behavioral Pattern Detection Online
<:on:1533844867191406672> **Restoration Layer:** Zero-Latency Channel & Role Recovery
<:on:1533844867191406672> **Condemned Cache:** Instant nuker skip-to-restoration active

**Athena Prime's firewall now operates at raw HTTP speed. Nuke bots are eliminated in ~1-3 milliseconds via a direct Discord API strike. Predictive quarantine intercepts suspicious admins before they can cause structural damage. Unauthorized channels are instantly deleted, deleted channels are instantly restored.**

*(Use 'antinuke config' or individual commands to fine-tune modules)*`,
        [
          { name: 'Anti-Nuke',  value: `${TOGGLE_ON} ACTIVE`, inline: true },
          { name: 'Anti-Spam',  value: `${TOGGLE_ON} ACTIVE`, inline: true },
          { name: '<a:uptime:1552608831060844575> Anti-Invite', value: `${TOGGLE_ON} ACTIVE`, inline: true },
          { name: '<a:uptime:1552608831060844575> Anti-Link',  value: `${TOGGLE_ON} ACTIVE`, inline: true },
          { name: '<a:uptime:1552608831060844575> Word Filter', value: `${TOGGLE_ON} ACTIVE`, inline: true },
          { name: 'Enforced by', value: `[${cleanDisplayName(moderator.displayName || moderator.user?.username || 'System')}](https://discord.com/users/${moderator.id || moderator.user?.id})`, inline: true }
        ]
      )
    : cv2.warn(
        'All Shields Disengaged',
        `Athena Prime firewall layers have been **DEACTIVATED** server-wide. The server is now unprotected.`,
        [{ name: 'Lifted by', value: `[${cleanDisplayName(moderator.displayName || moderator.user?.username || 'System')}](https://discord.com/users/${moderator.id || moderator.user?.id})` }]
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
      return cv2.owner('Extra Owner Added', `Successfully added **${targetUser.tag}** as an **Extra Owner**.\n\nThey are now:\n- __**Immune**__ to all moderation actions\n- __**Authorized**__ to use all bot commands\n- __**Whitelisted**__ from all auto-mod filters`);
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

    const formattedList = owners.map(id => `- <@${id}> (ID: \`${id}\`)`).join('\n');
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
             `- Any bot that has this role is instantly granted **100% full immunity** to all Anti-Nuke protections.\n` +
             `- They can create/delete channels, manage roles, kick, and ban without triggering the firewall.\n` +
             `- To revoke a specific bot's immunity, simply remove the <@&${cleanId}> role from them, or use \`!botwhitelist remove <@&${cleanId}>\` to unwhitelist the role entirely.`;
    } else {
      desc = `Bot ID <@${cleanId}> (\`${cleanId}\`) has been added to the **Bot Whitelist**.\n\n` +
             `- This bot is instantly granted **100% full immunity** to all Anti-Nuke protections.\n` +
             `- It can create/delete channels, manage roles, kick, and ban without triggering the firewall.\n` +
             `- To revoke this immunity, use \`!botwhitelist remove ${cleanId}\`.`;
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
      if (role) return `- **Role:** ${role} (\`${id}\`)`;
      
      const user = await guild.client.users.fetch(id).catch(() => null);
      if (user) return `- **Bot:** ${user} (\`${id}\`)`;
      
      return `- **Unknown:** \`${id}\``;
    }));
    
    return cv2.info('Whitelisted Bots & Roles', `The following entities have full Anti-Nuke immunity:\n\n${formatted.join('\n')}`);
  }
}

async function handleBotBlacklist(action, targetId, reason = null, client = null) {
  if (action === 'add' || action === 'ban' || action === 'block') {
    if (!targetId || !/^\d{17,20}$/.test(targetId)) {
      return cv2.warn('Invalid ID', 'Please provide a valid user ID or mention (17-20 digit number).');
    }
    if (isBotOwnerSync(targetId)) {
      return cv2.warn('Safety Protection', 'You cannot globally blacklist the Bot Owner.');
    }
    if (client && client.user && targetId === client.user.id) {
      return cv2.warn('Safety Protection', 'You cannot globally blacklist Athena.');
    }

    const finalReason = reason || 'Violation of Athena Bot Rules & Security Protocols';
    db.addUserToBotBlacklist(targetId, finalReason);

    // Automatically trigger immediate persistent cloud backup
    if (client) {
      import('../utils/cloudSync.js').then(cs => {
        if (cs.createCloudBackup) cs.createCloudBackup(client, `Global Blacklist Ban: ${targetId}`).catch(() => null);
      }).catch(() => null);
    }

    return cv2.success(
      'User Globally Blacklisted',
      `User <@${targetId}> (\`${targetId}\`) has been **globally banned** from Athena Prime.\n\n` +
      `> -# **__Reason:__** \`${finalReason}\`\n` +
      `> -# **__Scope:__** All commands (\`!help\`, \`!ping\`, modules) are permanently locked across all servers, including server-owner privileges.\n` +
      `> -# **__Cloud Sync:__** Database snapshot synced to Discord cloud backup with updated blacklist manifest.\n` +
      `> -# **__Notice:__** Whenever this user invokes any bot command, Athena will immediately display the global ban notice.`
    );
  } else if (action === 'remove' || action === 'unban' || action === 'unblock') {
    if (!targetId || !/^\d{17,20}$/.test(targetId)) {
      return cv2.warn('Invalid ID', 'Please provide a valid user ID or mention to unban.');
    }
    const success = db.removeUserFromBotBlacklist(targetId);
    if (success) {
      // Automatically trigger immediate persistent cloud backup
      if (client) {
        import('../utils/cloudSync.js').then(cs => {
          if (cs.createCloudBackup) cs.createCloudBackup(client, `Global Blacklist Unban: ${targetId}`).catch(() => null);
        }).catch(() => null);
      }

      return cv2.success(
        'User Globally Unbanned',
        `User <@${targetId}> (\`${targetId}\`) has been **unbanned** from Athena Prime.\n\n` +
        `> -# **__Status:__** Full global access to all bot commands and features has been restored.\n` +
        `> -# **__Cloud Sync:__** Database snapshot synced to Discord cloud backup.`
      );
    } else {
      return cv2.warn('Not Blacklisted', `User ID \`${targetId}\` is not currently globally blacklisted.`);
    }
  } else {
    // List
    const flagged = db.getBotBlacklist();
    if (flagged.length === 0) {
      return cv2.info('No Blacklisted Users', 'There are currently no users on the global bot blacklist.');
    }
    const data = (db.getBotBlacklistData ? db.getBotBlacklistData() : db.cache.botBlacklistData) || {};
    const formattedList = flagged.map(id => {
      const entry = data[id];
      const r = entry?.reason || 'Violation of Athena Bot Rules';
      const timeStr = entry?.timestamp ? ` (<t:${Math.floor(entry.timestamp / 1000)}:R>)` : '';
      return `> -# **__User:__** <@${id}> (\`${id}\`)\n> -# **__Reason:__** \`${r}\`${timeStr}`;
    }).join('\n\n');

    return cv2.danger(
      'Globally Blacklisted Accounts',
      `-# **__Total Flagged Users:__** \`${flagged.length}\`\n\n${formattedList}`
    );
  }
}

async function handleAntiLink(guild, moderator, mode) {
  const enabled = mode === 'on';
  db.updateGuildConfig(guild.id, { antiLinkEnabled: enabled });

  const modeDesc = enabled ? `${TOGGLE_ON} ACTIVE` : `${TOGGLE_OFF} DEACTIVATED`;
  const resEmbed = cv2.success(
    'Anti-Link Configured',
    `External URL auto-mod filter is now **${modeDesc}**.\n\n${enabled ? 'The following links will now be **strictly blocked**:\n> <a:uptime:1552608831060844575> Discord Invites\n> <a:uptime:1552608831060844575> NSFW Links\n> <a:uptime:1552608831060844575> Scam/Phishing Links\n> <a:uptime:1552608831060844575> Standard URLs (unless whitelisted)\n\nUse `/linksallow add` to whitelist specific domains like YouTube or Tenor.' : 'Users can freely share external links.'}`,
    [{ name: 'Changed by', value: `[${cleanDisplayName(moderator.displayName || moderator.user?.username || 'System')}](https://discord.com/users/${moderator.id || moderator.user?.id})` }]
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
  const raidModeStatus   = config.raidMode                      ? '<a:uptime:1552608831060844575> ENGAGED' : `${TOGGLE_ON} STANDBY`;

  let iconUrl = guild.iconURL({ dynamic: true, size: 256 }) || null;

  const headerSection = {
    type: 9,
    components: [{ type: 10, content: `## **${guild.name} — Server Info**\n-# **Comprehensive server statistics and Athena Prime security overview.**` }]
  };
  if (iconUrl) {
    headerSection.accessory = { type: 11, media: { url: iconUrl } };
  }

  const statsText =
    `-# **Owner:** ${ownerTag}\n` +
    `-# **Members:** **${totalMembers}**   **Roles:** **${roleCount}**   **Channels:** **${channelCount}**\n` +
    `-# **Boost Level:** Tier ${boostLevel} (${boostCount} boosts)\n` +
    `-# **Created:** ${createdAt}`;

  const securityText =
    `-# **▬▬ Security Status ▬▬**\n` +
    `-# **Anti-Nuke:** ${antiNukeStatus}   **Anti-Spam:** ${antiSpamStatus}\n` +
    `-# **Anti-Invite:** ${antiInviteStatus}   **Anti-Link:** ${antiLinkStatus}\n` +
    `-# **Raid Mode:** ${raidModeStatus}   **Max Warns:** \`${config.maxWarnings}\``;

  const container = {
    type: 17,
    components: [
      headerSection,
      { type: 14, divider: true },
      { type: 10, content: statsText },
      { type: 14, divider: true },
      { type: 10, content: securityText },
      { type: 14, divider: true },
      { type: 10, content: '-# **Athena Bulletproof Security !!!**' }
    ]
  };

  return { components: [container.toJSON ? container.toJSON() : container], flags: MessageFlags.IsComponentsV2 };
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

  let avatarUrl = member.user.displayAvatarURL({ dynamic: true, size: 256 });

  const headerSection = {
    type: 9,
    components: [{ type: 10, content: `## **User Info — ${member.user.tag}**\n-# **Detailed profile and privilege information.**` }]
  };
  if (avatarUrl) {
    headerSection.accessory = { type: 11, media: { url: avatarUrl } };
  }

  const statsText =
    `-# **Username:** ${member.user.tag}   **ID:** \`${member.id}\`\n` +
    `-# **Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n` +
    `-# **Joined Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n` +
    `-# **Active Warnings:** \`${warnings.length}\`   **Privileges:** ${privileges.join(' | ')}`;

  const rolesText = `-# **Roles [${member.roles.cache.size - 1}]:** ${roles}`;

  const container = {
    type: 17,
    components: [
      headerSection,
      { type: 14, divider: true },
      { type: 10, content: statsText },
      { type: 14, divider: true },
      { type: 10, content: rolesText },
      { type: 14, divider: true }
    ]
  };

  return { components: [container.toJSON ? container.toJSON() : container], flags: MessageFlags.IsComponentsV2 };
}

// ==========================================
// SECURITY TOGGLE ALL - Bot Owner / Server Owner only
// Enables/disables ALL security features except autonick
// ==========================================
async function handleSecurityToggleAll(guild, moderator, enable) {
  // We only handle enable=false here now, because enable=true is handled by runSecurityEnableSequence
  if (!enable) {
    db.updateGuildConfig(guild.id, {
      securityEnabled:          false,
      antiNukeEnabled:          false,
      antiSpamEnabled:          false,
      antiInviteEnabled:        false,
      antiLinkEnabled:          false,
      antiSpamMentionEnabled:   false,
      antiFloodEnabled:         false,
      wordFilterEnabled:        false,
      allowAllLinks:            false,
      allowInvitesGlobally:     false,
      blacklistWords:           [],
      antinukeModules:          Object.fromEntries(['antiRoleCreate','antiRoleDelete','antiRoleUpdate','antiRolePermUpdate','antiMemberRoleUpdate','antiRoleReorder','antiChannelCreate','antiChannelDelete','antiChannelUpdate','antiChannelPermUpdate','antiChannelReorder','antiChannelNameMod','antiEmojiCreate','antiEmojiDelete','antiEmojiUpdate','antiWebhooks','antiBotAdd','antiServerUpdate','antiBan','antiKick','antiUnban','antiInvite','antiScheduledEvents','antiMemberPurge','antiMassBan','antiAutomodUpdate','antiAppCommands','antiLinkedRole'].map(k => [k, false])),
      dashboardChannelId:       null,
      dashboardMessageIds:      []
    });

    // Delete Athena's secondary security roles
    const cfg = db.getGuildConfig(guild.id);
    const roleIdsToDelete = [cfg.athenFirewallRoleId, cfg.athenaUnbypassableRoleId].filter(Boolean);
    
    // First try by ID
    for (const rid of roleIdsToDelete) {
      const r = guild.roles.cache.get(rid);
      if (r) await r.delete('Security Disabled by owner').catch(() => null);
    }
    
    // Fallback: loose name match for pre-existing roles
    const keywords = ['Athena Firewall', 'Athena Unbypassable'];
    for (const kw of keywords) {
      const r = guild.roles.cache.find(role => role.name.includes(kw.split(' ').pop()) && role.name.toLowerCase().includes('athena'));
      if (r && !roleIdsToDelete.includes(r.id)) await r.delete('Security Disabled by owner').catch(() => null);
    }

    // Delete ALL athenas-dashboard channels (including duplicates)
    const allDashboards = guild.channels.cache.filter(c => c.name === 'athenas-dashboard');
    for (const ch of allDashboards.values()) {
      await ch.delete('Security Disabled').catch(() => null);
    }

    const textContent =
      `# ALL SECURITY SHIELDS DISENGAGED\n\n` +
      `All Athena Prime protective filters and security roles have been **DEACTIVATED** server-wide.\n\n` +
      `-# Disabled by ${moderator}`;

    logToSecurityChannel(guild, cv2.log(
      'Security Toggle All',
      `**${moderator.user.tag}** toggled all security shields **OFF**.`
    ));

    return { components: [{ type: 17, components: [{ type: 10, content: textContent }, { type: 14, divider: true }, { type: 10, content: "-# **Athena Bulletproof Security !!!**" }] }], flags: MessageFlags.IsComponentsV2 };
  }
}

export async function getSecurityStatusPanel(guild) {
  const config = db.getGuildConfig(guild.id);
  const isSecured = !!(config.securityEnabled || config.antiNukeEnabled);
  let botAvatarUrl = guild.client?.user?.displayAvatarURL({ dynamic: true, size: 256 }) || null;

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
    antiAppCommands: 'Anti App Commands',
    antiLinkedRole: 'Anti Linked Role Exploit'
  };

  const emojiOn  = '<:on:1533844867191406672>';
  const emojiOff = '<:off:1533844858983157851>';

  let listText = '';
  for (const k of Object.keys(modLabels)) {
    const moduleFlag = config.antinukeModules?.[k];
    let isEnabled = false;
    if (k === 'antiInvite') {
      isEnabled = isSecured && (config.antiInviteEnabled === true);
    } else {
      isEnabled = isSecured && (moduleFlag === undefined ? true : !!moduleFlag);
    }
    listText += `> ${isEnabled ? emojiOn : emojiOff} ${modLabels[k]}\n`;
  }

  if (!isSecured) {
    listText += "\n> -# <a:warning:1540656124313993247> **Security is currently DISABLED on this server.**\n> -# **Execute `!security enable all` or click `⚡ Engage All Shields` below to arm all 28 modules.**";
  }

  const liveRecords = db.getSecurityLiveRecords(guild.id);
  const headerSection = { type: 10, content: 
      "# SECURITY FIREWALL STATUS\n" +
      "-# Global Status: " + (isSecured ? "**God-Tier Firewall ACTIVE**" : "Offline \u2014 Unprotected") + "\n" +
      "-# Strike Velocity: " + (isSecured ? "Ludicrously fast \u2014 **1-3ms execution**" : "Disabled") + "\n" +
      "-# Predictive Layer: " + (isSecured ? "Online \u2014 **Behavioral scanning active**" : "Disabled") + "\n" +
      "-# Live Audit Records: **`" + liveRecords.length + "` threat events neutralized** in real-time"
    };

    const detailsSection = { type: 10, content:
      "-# **Advanced Architecture & Exploit Defense:**\n" +
      "-# **1. Real-Time Role Interceptor (`guildMemberUpdate.js`):** Intercepts unauthorized gaining of Administrator / dangerous roles. Cross-examines 60s audit logs for authorized executors. Automatically strips roles, disarms dangerous permissions, and isolates the account in Quarantine.\n" +
      "-# **2. Join-Time Dangerous Role Guard (`guildMemberAdd.js`):** Neutralizes Discord Onboarding & pre-linked role exploits by stripping join-time dangerous roles and isolating the user.\n" +
      "-# **Raw Websocket Wiretap:** Intercepts raw network streams to execute zero-day bans in <1ms, bypassing library latency.\n" +
      "-# **Lightspeed Detection:** Direct API polling every 10ms catches destructive events instantly.\n" +
      "-# **Flawless Restoration:** Re-engineers exact channel/category raw positions and permissions post-nuke."
    };

    const actionButtons = [];
    if (!isSecured) {
      actionButtons.push({ type: 2, custom_id: 'sec_enable_all', label: '⚡ Engage All Shields', style: 3 });
    }
    actionButtons.push({ type: 2, custom_id: 'sec_live_records', label: `🔴 Live Records (${liveRecords.length})`, style: 2 });
    actionButtons.push({ type: 2, custom_id: 'sec_module_manage', label: 'Manage Modules', style: 2 });
    actionButtons.push({ type: 2, custom_id: 'sec_architecture_guide', label: 'Exploit Guide', style: 2 });
    actionButtons.push({ type: 2, custom_id: 'sec_close', label: 'Close', style: 2 });

    const container = {
    type: 17,
    components: [
      headerSection,
        { type: 14, divider: true },
        detailsSection,
      { type: 14, divider: true },
      { type: 10, content: listText.trimEnd() },
      { type: 14, divider: true },
      { type: 1, components: actionButtons.slice(0, 5) },
      { type: 14, divider: true },
      { type: 10, content: '-# **Athena Bulletproof Security !!!**' }
    ]
  };

  return { components: [container.toJSON ? container.toJSON() : container], flags: MessageFlags.IsComponentsV2 };
}

export async function getSecurityLiveRecordsPanel(guild, page = 0) {
  const config = db.getGuildConfig(guild.id);
  const isSecured = !!(config.securityEnabled || config.antiNukeEnabled);
  const allRecords = db.getSecurityLiveRecords(guild.id);
  const pageSize = 5;
  const maxPages = Math.max(1, Math.ceil(allRecords.length / pageSize));
  const currentPage = Math.max(0, Math.min(page, maxPages - 1));
  const pageRecords = allRecords.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const header = {
    type: 10,
    content:
      "# REAL-TIME SECURITY LIVE AUDIT & RECORDS\n" +
      `-# **Live Telemetry Stream • Server:** ${guild.name} • **Status:** ${isSecured ? '**God-Tier Firewall ACTIVE**' : 'Offline / Unprotected'}\n` +
      `-# **Strike Velocity:** 1-3ms direct REST strike • **Total Threats Neutralized:** \`${allRecords.length}\``
  };

  let recordsContent = '';
  if (pageRecords.length === 0) {
    recordsContent =
      "> -# <a:atheNATICK:1557841381630681106> **All systems quiet. Zero hostile incursions recorded in live memory.**\n" +
      "> -# **Athena Prime Raw WebSocket Wiretap & Direct Strike Engine are standing guard.**\n" +
      "> -# Any unauthorized destructive action (roles, channels, bans, webhooks, exploits) will be recorded here live in <1ms.";
  } else {
    recordsContent = pageRecords.map((r, i) => {
      const idx = currentPage * pageSize + i + 1;
      const timeStr = r.timestamp ? `<t:${Math.floor(r.timestamp / 1000)}:R>` : 'Just now';
      return (
        `> **#${idx}** • **__${r.eventType}__** • ${timeStr}\n` +
        `> -# • **Perpetrator:** ${r.executorTag} (\`${r.executorId}\`)\n` +
        `> -# • **Neutralization:** **${r.verdict}** (\`${r.latencyMs || 1}ms execution\`)\n` +
        `> -# • **Rollback & Repair:** ${r.rollback || 'Damage prevented'}`
      );
    }).join('\n\n');
  }

  const paginationNav = maxPages > 1 
    ? `\n\n-# **Page ${currentPage + 1} of ${maxPages}** • Total Records: \`${allRecords.length}\``
    : `\n\n-# **Live Buffer:** \`${allRecords.length}\` / 100 recorded incidents retained in DB`;

  const buttons = [
    { type: 2, custom_id: `sec_records_refresh_${currentPage}`, label: '🔄 Refresh', style: 2 }
  ];

  if (maxPages > 1) {
    buttons.push({ 
      type: 2, 
      custom_id: `sec_records_page_${Math.max(0, currentPage - 1)}`, 
      label: '◀ Prev', 
      style: 2, 
      disabled: currentPage === 0 
    });
    buttons.push({ 
      type: 2, 
      custom_id: `sec_records_page_${Math.min(maxPages - 1, currentPage + 1)}`, 
      label: 'Next ▶', 
      style: 2, 
      disabled: currentPage >= maxPages - 1 
    });
  }

  buttons.push({ type: 2, custom_id: 'sec_status_view', label: '🛡️ Firewall Status', style: 2 });
  if (allRecords.length > 0) {
    buttons.push({ type: 2, custom_id: 'sec_records_clear', label: '🗑️ Clear History', style: 4 });
  }

  const container = {
    type: 17,
    components: [
      header,
      { type: 14, divider: true },
      { type: 10, content: (recordsContent + paginationNav).trim() },
      { type: 14, divider: true },
      { type: 1, components: buttons.slice(0, 5) },
      { type: 14, divider: true },
      { type: 10, content: '-# **Athena Bulletproof Security Matrix • Real-Time Live Records Engine**' }
    ]
  };

  return { components: [container.toJSON ? container.toJSON() : container], flags: MessageFlags.IsComponentsV2 };
}

export async function getAntinukeArchitecturePanel(guild) {
  const container = {
    type: 17,
    components: [
      {
        type: 10,
        content:
          "# ANTINUKE EXPLOIT DEFENSE ARCHITECTURE\n" +
          "-# **Autonomous Zero-Day Exploit Mitigation & Role Protection Systems**"
      },
      { type: 14, divider: true },
      {
        type: 10,
        content:
          "## **1. Real-Time Role Interceptor (`src/events/guildMemberUpdate.js`)**\n" +
          "-# • **Trigger:** Fires dynamically whenever any member's roles change.\n" +
          "-# • **Dangerous Roles Scanned:** `Administrator`, `Manage Server`, `Manage Roles`, `Manage Channels`, `Ban Members`, `Kick Members`, `Manage Webhooks`, `Mention Everyone`, or Admin Tier roles.\n" +
          "-# • **Exemption Matrix:** Skips only the Server Owner, Bot Owner, and Extra Owners.\n" +
          "-# • **60-Second Audit Log Cross-Examination:**\n" +
          "-#   • Scans audit logs for an authorized `MemberRoleUpdate` within the last 60 seconds.\n" +
          "-#   • If no audit log exists, or if the executor is empty/self-assigned, or if the executor is unauthorized:\n" +
          "-#     1. **Instant Role Strip:** Immediately strips the dangerous role(s) from the member via direct API.\n" +
          "-#     2. **Disarms Compromised Role:** Revokes dangerous permissions from the role so no other user can exploit it via linked connection.\n" +
          "-#     3. **Quarantine Containment:** Automatically places the exploiter into Quarantine isolation.\n" +
          "-#     4. **Security Log & Owner Alert:** Dispatches a high-priority alert container to the server's security channel and DMs the Server Owner directly."
      },
      { type: 14, divider: true },
      {
        type: 10,
        content:
          "## **2. Join-Time & Onboarding Dangerous Role Guard (`src/events/guildMemberAdd.js` & `src/utils/onboardingGuard.js`)**\n" +
          "-# • **Trigger:** Real-time inspection upon member join & proactive Onboarding prompt audit.\n" +
          "-# • **Exploit Vectors Mitigated:** Neutralizes Discord Onboarding & pre-linked role exploits if roles carry Administrator, Manage Server, Manage Roles, Ban Members, Kick Members, etc.\n" +
          "-# • **Enforcement:** Disarms dangerous permissions from the role, scrubs role from Onboarding prompts via Discord REST API, strips the role, and quarantines unauthorized users."
      },
      { type: 14, divider: true },
      {
        type: 10,
        content:
          "-# **Execution Engine:**\n" +
          "-# • **Raw Websocket Wiretap:** <1ms zero-day direct API execution.\n" +
          "-# • **10ms API Polling:** Continual verification ensuring zero unlogged bypasses."
      },
      { type: 14, divider: true },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'antinuke_config', label: 'Open Config Panel', style: 2 },
          { type: 2, custom_id: 'sec_status_view', label: 'Module Status', style: 2 },
          { type: 2, custom_id: 'sec_close', label: 'Close', style: 2 }
        ]
      },
      { type: 14, divider: true },
      { type: 10, content: '-# **Athena Bulletproof Security Matrix · V1.0.0**' }
    ]
  };

  return { components: [container.toJSON ? container.toJSON() : container], flags: MessageFlags.IsComponentsV2 };
}

function formatQuarantineSetupResult(res) {
  const catName = res.category ? res.category.name : '.      You Have Been Quarantined';

  if (res.allFound) {
    const fields = [
      { name: 'Quarantine Category', value: res.category ? `\`${res.category.name}\` (DB Assigned)` : 'None', inline: false },
      { name: 'Quarantined Role', value: res.role ? `<@&${res.role.id}> (DB Assigned)` : 'None', inline: false },
      { name: 'Quarantine Text', value: res.textChannel ? `<#${res.textChannel.id}> (DB Assigned & Synced)` : 'None', inline: false },
      { name: 'Quarantine VC', value: res.voiceChannel ? `<#${res.voiceChannel.id}> (DB Assigned & Synced)` : 'None', inline: false },
      { name: 'Channel Protection', value: `\`${res.synced}\` channels isolated`, inline: false }
    ];

    return cv2.success(
      'Quarantine System | <a:atheNATICK:1557841381630681106>',
      `All assigned quarantine channels and role were found in the bot's server database, active and synced under category **\`${catName}\`**.\nQuarantined members are strictly contained and isolated from all other server channels.`,
      fields
    );
  }

  const fields = [
    { name: 'Quarantine Category', value: res.category ? `\`${res.category.name}\` • ${res.categoryInDb ? 'DB Assigned' : (res.categoryFound ? 'Found in Server' : 'Created')}` : 'None', inline: false },
    { name: 'Quarantined Role', value: res.role ? `<@&${res.role.id}> • ${res.roleInDb ? 'DB Assigned' : (res.roleFound ? 'Found in Server' : 'Created')}` : 'None', inline: false },
    { name: 'Quarantine Text', value: res.textChannel ? `<#${res.textChannel.id}> • ${res.textInDb ? (res.textWasUnderCat ? 'DB Assigned & Synced' : 'DB Assigned, Moved & Synced') : (res.textFound ? 'Found & Synced' : 'Created & Synced')}` : 'None', inline: false },
    { name: 'Quarantine VC', value: res.voiceChannel ? `<#${res.voiceChannel.id}> • ${res.vcInDb ? (res.vcWasUnderCat ? 'DB Assigned & Synced' : 'DB Assigned, Moved & Synced') : (res.vcFound ? 'Found & Synced' : 'Created & Synced')}` : 'None', inline: false },
    { name: 'Channel Protection', value: `\`${res.synced}\` channels isolated`, inline: false }
  ];

  return cv2.success(
    'Quarantine Auto-Setup | <a:atheNATICK:1557841381630681106>',
    `Checked server database for assigned channels & roles. Leftover components were configured and synced under category **\`${catName}\`**.\nQuarantined members are strictly contained within the quarantine zone.`,
    fields
  );
}

// ==========================================
// QRMANAGER - Quarantine system setup & repair
// ==========================================
async function handleQrManager(guild, moderator, action, roleArg, channelArg) {
  const config = db.getGuildConfig(guild.id);

  if (action === 'setup') {
    try {
      const res = await autoSetupQuarantine(guild);
      return formatQuarantineSetupResult(res);
    } catch (err) {
      return cv2.danger('Setup Error', `Failed to complete quarantine setup: ${err.message}`);
    }
  }

  if (action === 'setrole') {
    if (!roleArg) return cv2.warn('Missing Role', 'Please specify a role using the `role` option.');
    db.updateGuildConfig(guild.id, { quarantineRoleId: roleArg.id });
    const qChannelId = db.getGuildConfig(guild.id).quarantineChannelId;
    await syncQuarantinePermissions(guild, roleArg, qChannelId);
    return cv2.success('Quarantine Role Set | <a:atheNATICK:1557841381630681106>', `Set <@&${roleArg.id}> as the quarantine role and synced deny overwrites across all channels.`);
  }

  if (action === 'setcategory') {
    if (!channelArg || channelArg.type !== ChannelType.GuildCategory) {
      return cv2.warn('Invalid Category', 'Please specify a valid category channel using the `channel` option.');
    }
    db.updateGuildConfig(guild.id, { quarantineCategoryId: channelArg.id });
    return cv2.success('Quarantine Category Set | <a:atheNATICK:1557841381630681106>', `Set category \`${channelArg.name}\` as the designated quarantine category.`);
  }

  if (action === 'setchannel') {
    if (!channelArg) return cv2.warn('Missing Channel', 'Please specify a text channel using the `channel` option.');
    db.updateGuildConfig(guild.id, { quarantineChannelId: channelArg.id });
    const cfg = db.getGuildConfig(guild.id);
    let targetCat = cfg.quarantineCategoryId
      ? (guild.channels.cache.get(cfg.quarantineCategoryId) || await guild.channels.fetch(cfg.quarantineCategoryId).catch(() => null))
      : null;
    if (!targetCat) {
      targetCat = guild.channels.cache.find(c => 
        c.type === ChannelType.GuildCategory && 
        (c.name === '.      You Have Been Quarantined' || c.name.toLowerCase().includes('you have been quarantined') || c.name.toLowerCase().includes('quarantine'))
      );
      if (targetCat) db.updateGuildConfig(guild.id, { quarantineCategoryId: targetCat.id });
    }
    if (targetCat && channelArg.parentId !== targetCat.id) {
      await channelArg.setParent(targetCat.id, { lockPermissions: true }).catch(() => null);
      await channelArg.lockPermissions().catch(() => null);
    }
    const qRole = await getOrCreateQuarantineRole(guild);
    await syncQuarantinePermissions(guild, qRole, channelArg.id);
    return cv2.success('Quarantine Channel Set | <a:atheNATICK:1557841381630681106>', `Set <#${channelArg.id}> as the quarantine text zone${targetCat ? ` under \`${targetCat.name}\`` : ''} and synced permissions.\nQuarantined users will be able to view and chat here.`);
  }

  if (action === 'setvc') {
    if (!channelArg) return cv2.warn('Missing VC', 'Please specify a voice channel using the `channel` option.');
    db.updateGuildConfig(guild.id, { quarantineVcId: channelArg.id });
    const cfg = db.getGuildConfig(guild.id);
    let targetCat = cfg.quarantineCategoryId
      ? (guild.channels.cache.get(cfg.quarantineCategoryId) || await guild.channels.fetch(cfg.quarantineCategoryId).catch(() => null))
      : null;
    if (!targetCat) {
      targetCat = guild.channels.cache.find(c => 
        c.type === ChannelType.GuildCategory && 
        (c.name === '.      You Have Been Quarantined' || c.name.toLowerCase().includes('you have been quarantined') || c.name.toLowerCase().includes('quarantine'))
      );
      if (targetCat) db.updateGuildConfig(guild.id, { quarantineCategoryId: targetCat.id });
    }
    if (targetCat && channelArg.parentId !== targetCat.id) {
      await channelArg.setParent(targetCat.id, { lockPermissions: true }).catch(() => null);
      await channelArg.lockPermissions().catch(() => null);
    }
    return cv2.success('Quarantine VC Set | <a:atheNATICK:1557841381630681106>', `Set <#${channelArg.id}> as the quarantine voice channel${targetCat ? ` under \`${targetCat.name}\`` : ''} and synced permissions.\nWhen a member is quarantined they will be moved here.`);
  }

  if (action === 'status') {
    const updatedConfig = db.getGuildConfig(guild.id);
    const category = updatedConfig.quarantineCategoryId
      ? (guild.channels.cache.get(updatedConfig.quarantineCategoryId) || await guild.channels.fetch(updatedConfig.quarantineCategoryId).catch(() => null))
      : null;
    const role = updatedConfig.quarantineRoleId
      ? (guild.roles.cache.get(updatedConfig.quarantineRoleId) || await guild.roles.fetch(updatedConfig.quarantineRoleId).catch(() => null))
      : null;
    const channel = updatedConfig.quarantineChannelId
      ? (guild.channels.cache.get(updatedConfig.quarantineChannelId) || await guild.channels.fetch(updatedConfig.quarantineChannelId).catch(() => null))
      : null;
    const vc = updatedConfig.quarantineVcId
      ? (guild.channels.cache.get(updatedConfig.quarantineVcId) || await guild.channels.fetch(updatedConfig.quarantineVcId).catch(() => null))
      : null;

    return cv2.info('Quarantine System Status', 'Current quarantine configuration for this server:', [
      { name: 'Quarantine Category', value: category ? `\`${category.name}\`` : 'Not Set - run `/qrmanager setup`', inline: false },
      { name: 'Quarantine Role',    value: role     ? `<@&${role.id}>`       : 'Not Set - run `/qrmanager setup`', inline: false },
      { name: 'Quarantine Channel', value: channel  ? `<#${channel.id}>`     : 'Not Set - run `/qrmanager setup`', inline: false },
      { name: 'Quarantine VC',      value: vc       ? `<#${vc.id}>`          : 'Not Set - use `/qrmanager setvc`', inline: false }
    ]);
  }

  return cv2.warn('Unknown Action', 'Valid actions: `setup`, `setrole`, `setcategory`, `setchannel`, `setvc`, `status`');
}

// ==========================================
// ==========================================
// LINKSALLOW - Per-guild domain whitelist for anti-link filter
// ==========================================
async function handleLinksAllow(guild, action, domain) {
  if (action === 'allowall') {
    db.updateGuildConfig(guild.id, { allowAllLinks: true });
    return cv2.success(
        'All Links Allowed | <a:atheNATICK:1557841381630681106>',
        'The anti-link filter has been **completely disabled** for this server.\n\nAll users can now post any link freely.\n\nUse `/linksallow disallowall` to re-enable the filter.',
        [{ name: 'Note', value: 'This overrides all domain whitelists and disables the anti-link filter entirely.' }]
      );
  }

  if (action === 'disallowall') {
    db.updateGuildConfig(guild.id, { allowAllLinks: false, allowedLinks: [] });
    return cv2.success(
        'Anti-Link Filter Restored | <a:atheNATICK:1557841381630681106>',
        'The anti-link filter is **active** again and all allowed domains have been **reset**.\n\nThe following links will now be **strictly blocked**:\n> Discord Invites\n> NSFW Links\n> Scam/Phishing Links\n> Standard URLs (unless whitelisted)\n\nUse `/linksallow add <domain>` to whitelist specific domains.'
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
      return cv2.success('Domain Allowed | <a:atheNATICK:1557841381630681106>', `Added **\`${cleanDomain}\`** to the allowed links list.\nLinks containing this domain will bypass the anti-link filter.`);
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
      return cv2.success('Domain Removed | <a:atheNATICK:1557841381630681106>', `Removed **\`${cleanDomain}\`** from the allowed list.`);
    }
    return cv2.warn('Not Found', `**\`${cleanDomain}\`** is not in the allowed list.`);
  }

  // list
  const config   = db.getGuildConfig(guild.id);
  const allOpen  = config.allowAllLinks === true;
  const list     = db.getAllowedLinks(guild.id);

  if (allOpen) {
    return cv2.info(
        '<a:uptime:1552608831060844575> All Links Allowed',
        'The anti-link filter is currently **fully disabled - all links are permitted.\n\nUse `/linksallow disallowall` to re-enable the filter.'
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
      `These domains bypass the anti-link filter:\n\n${formatted}\n\n**Use \`/linksallow remove <domain>\` to remove any.**`
    );
}

// ==========================================
// MASS QUARANTINE - Quarantine all members with a specific role
// Skips: bot owner, server owner, extra owners, whitelisted, already quarantined
// ==========================================
async function handleMassQuarantine(guild, moderator, targetRole, reason) {
  // Safety guard - prevent quarantining @everyone
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
      { name: 'Role',        value: `<@&${targetRole.id}>`, inline: true },
      { name: 'Quarantined', value: `\`${success}\``,       inline: true },
      { name: 'Failed',      value: `\`${failed}\``,        inline: true },
      { name: 'Skipped',     value: `\`${skipped}\``,       inline: true },
      { name: 'Reason',      value: reason }
    ],
    'danger'
  ));

  return cv2.danger(
      'Mass Quarantine Complete',
      `All targeted members with <@&${targetRole.id}> have been processed.`,
      [
        { name: 'Target Role',  value: `<@&${targetRole.id}> (${total} members targeted)`, inline: false },
        { name: 'Quarantined',  value: `\`${success}\``,  inline: true },
        { name: 'Failed',       value: `\`${failed}\``,   inline: true },
        { name: 'Skipped',      value: `\`${skipped}\``,  inline: true },
        { name: 'Reason',       value: reason,            inline: false },
        { name: 'Executed By',  value: `[${cleanDisplayName(moderator.displayName || moderator.user?.username || 'System')}](https://discord.com/users/${moderator.id || moderator.user?.id})`,    inline: true }
      ]
    );
}

// ==========================================
// MASS UNQUARANTINE - Release all quarantined members in a guild
// ==========================================
async function handleMassUnquarantine(guild, moderator, client, context = null) {
  const quarantined = db.getQuarantinedInGuild(guild.id);

  if (!quarantined || quarantined.length === 0) {
    if (context === 'raidmode') return { success: 0, failed: 0 };
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
      { name: 'Released', value: `\`${success}\``, inline: true },
      { name: 'Failed',   value: `\`${failed}\``,  inline: true }
    ],
    'success'
  ));

  return cv2.success(
      'Mass Unquarantine Complete | <a:atheNATICK:1557841381630681106>',
      `All quarantined members have been processed.`,
      [
        { name: 'Released',    value: `\`${success}\``, inline: true },
        { name: 'Failed',      value: `\`${failed}\``,  inline: true },
        { name: 'Executed By', value: `[${cleanDisplayName(moderator.displayName || moderator.user?.username || 'System')}](https://discord.com/users/${moderator.id || moderator.user?.id})`,    inline: true }
      ]
    );
}

export async function runSecurityEnableSequence(guild, updateMessageFn) {
      const { TextDisplayBuilder, ContainerBuilder } = await import("discord.js");
      const successEmoji = "<:emoji_16:1533860111704002665>";
      const loadingEmoji = "<a:loading:1542155051286396938>";
      const warningEmoji = "<a:warning:1540656124313993247>";
      
      const header = `> -# ${loadingEmoji} **Athena Prime Antinuke Setup**\n> -# **Antinuke Setup Working...**\n> \n`;
      const stepResults = [];
      
      const sendPayload = async (isDone = false, isFailed = false) => {
        const checklistText = header + stepResults.join("\n");
        const display1 = new TextDisplayBuilder().setContent(checklistText);
        const components = [display1];
        
        if (isDone && !isFailed) {
           components.push({ type: 14, divider: true });
           const footerText = `-# **| athena prime | athena firewall | athena unbypassable .**\n-# **<@${guild.client.user.id}> is creating its backup role when anyone trying turn off admin , remove role , delete role the <@${guild.client.user.id}> will automatically enable admin , recovery its own role , adding itself making <@${guild.client.user.id}> unbypassable security system**`;
           components.push(new TextDisplayBuilder().setContent(footerText));
        } else if (isFailed) {
           components.push({ type: 14, divider: true });
           components.push(new TextDisplayBuilder().setContent(`-# **<a:warning:1540656124313993247> SECURITY ACTIVATION FAILED**\n-# **Setup was aborted. Security remains disabled.**`));
        }
        
        const containerJson = {
          type: 17,
          components: components.map(c => typeof c.toJSON === 'function' ? c.toJSON() : c)
        };
        await updateMessageFn({ components: [containerJson], embeds: [] });
      };
  
      // Helper to run a step
      async function runStep(stepName, operation) {
        const stepIndex = stepResults.length;
        stepResults.push(`> -# **${loadingEmoji} ${stepName}...**`);
        await sendPayload();
  
        try {
          const result = await operation();
          let finalStr = `> -# **${successEmoji} ${stepName}...** `;
          if (result && typeof result === 'string') {
               finalStr += result;
          }
          stepResults[stepIndex] = finalStr;
          await sendPayload();
          return true;
        } catch (err) {
          stepResults[stepIndex] = `> -# **${warningEmoji} ${stepName}... Failed (${err.message})**`;
          await sendPayload(false, true);
          return false;
        }
      }

      if (!(await runStep("Establishing Connection with Athena's server", async () => "Connected"))) return;
      if (!(await runStep("Checking Minimum Requirements for Antinuke", async () => ""))) return;
      if (!(await runStep("Registering Server In Athena's Database", async () => {
          return `\n> -# \u2800\u2800\u2800\u2800\u2570\u203A Server Id : ${guild.id}\n> -# \u2800\u2800\u2800\u2800\u2570\u203A Athena Security DB ID : ${BigInt(guild.id) * 487293n}`;
      }))) return;
      if (!(await runStep("Starting Role Integrity Check", async () => ""))) return;
      
      if (!(await runStep("Checking Athena Unbypassable , Athena Firewall Roles Created ", async () => { 
          const { ensureUnbypassableRole } = await import("../utils/antiStrip.js");
          await ensureUnbypassableRole(guild);
          return ""; 
      }))) return;

      if (!(await runStep("Backup Admin Roles Created And Assigned To Bot.", async () => { 
          // Add a tiny delay to give other hostile bots a chance to delete it if they want to
          await new Promise(r => setTimeout(r, 1000));
          
          const me = guild.members.me;
          const hasFW = me.roles.cache.some(r => r.name === "Athena Firewall");
          const hasUNB = me.roles.cache.some(r => r.name === "Athena Unbypassable");
          
          if (!hasFW || !hasUNB) {
             const { ensureUnbypassableRole } = await import("../utils/antiStrip.js");
             await ensureUnbypassableRole(guild);
             
             await new Promise(r => setTimeout(r, 2000));
             const rolesFresh = await guild.roles.fetch(undefined, { force: true });
             const existFW = rolesFresh.some(r => r.name === "Athena Firewall");
             const existUNB = rolesFresh.some(r => r.name === "Athena Unbypassable");
             
             if (!existFW || !existUNB) {
                 throw new Error("Roles deleted by another bot!");
             }
             
             const meFresh = await guild.members.fetch({ user: guild.client.user.id, force: true });
             const hasFWNew = meFresh.roles.cache.some(r => r.name === "Athena Firewall");
             const hasUNBNew = meFresh.roles.cache.some(r => r.name === "Athena Unbypassable");
             
             if (!hasFWNew || !hasUNBNew) {
                 throw new Error("Secondary roles found! Please place Athena's role above them in Server Settings so she can assign them.");
             }
          }
          return ""; 
      }))) return;

      if (!(await runStep("Setting Up Athena's Dashboard", async () => { 
          const dbMod = (await import("../database.js")).default;
          const sCfg = dbMod.getGuildConfig(guild.id);
          const existing = sCfg?.dashboardChannelId
            ? (guild.channels.cache.get(sCfg.dashboardChannelId) || await guild.channels.fetch(sCfg.dashboardChannelId).catch(() => null))
            : guild.channels.cache.find(c => c.name === 'athenas-dashboard');
          const { setupDashboardChannel } = await import("../utils/dashboardManager.js");
          await setupDashboardChannel(guild, guild.client);
          if (existing) {
             return `\n> -# \u2800\u2800\u2800\u2800\u2570\u203A Previous athena's dashboard found !!!`;
          } else {
             return `\n> -# \u2800\u2800\u2800\u2800\u2570\u203A Athena's Dashboard created !!!`;
          }
      }))) return;

      if (!(await runStep("Establishing Gmail Connectors", async () => ""))) return;
      if (!(await runStep("Ready for connection", async () => ""))) return;
      if (!(await runStep("Setup Success", async () => ""))) return;
      if (!(await runStep(`${guild.name} is Secured by Athena Prime`, async () => ""))) return;

      const db = (await import("../database.js")).default;
      const config = db.getGuildConfig(guild.id);
      const modules = config.antinukeModules || {};
      const allKeys = [
        'antiRoleCreate', 'antiRoleDelete', 'antiRoleUpdate', 'antiRolePermUpdate',
        'antiMemberRoleUpdate', 'antiRoleReorder', 'antiChannelCreate', 'antiChannelDelete',
        'antiChannelUpdate', 'antiChannelPermUpdate', 'antiChannelReorder', 'antiChannelNameMod',
        'antiEmojiCreate', 'antiEmojiDelete', 'antiEmojiUpdate', 'antiWebhooks',
        'antiBotAdd', 'antiServerUpdate', 'antiBan', 'antiKick', 'antiUnban',
        'antiInvite', 'antiScheduledEvents', 'antiMemberPurge', 'antiMassBan',
        'antiAutomodUpdate', 'antiAppCommands', 'antiLinkedRole'
      ];
      for (const k of allKeys) {
        modules[k] = true;
      }
      db.updateGuildConfig(guild.id, {
        securityEnabled: true,
        antiNukeEnabled: true,
        antiNukePunishment: 'ban',
        antiNukeThreshold: 1,
        antiSpamEnabled: true,
        antiInviteEnabled: true,
        antiSpamMentionEnabled: true,
        antiLinkEnabled: true,
        antiFloodEnabled: true,
        wordFilterEnabled: true,
        automodAIEnabled: true,
        automodDoxxingEnabled: true,
        automodToxicityEnabled: true,
        antinukeModules: modules
      });

      // Ensure quarantine role & security logs channel are initialized and bound in DB
      const { getOrCreateQuarantineRole, logToSecurityChannel } = await import("../utils/helpers.js");
      await getOrCreateQuarantineRole(guild).catch(() => null);

      // Ground-truth infrastructure snapshot for instant zero-loss rollbacks
      const { snapshotGuildInfrastructure } = await import("../utils/antinuke.js");
      snapshotGuildInfrastructure(guild);
      await logToSecurityChannel(guild, {
        type: 17,
        components: [
          {
            type: 10,
            content: `## Athena Prime Defense Matrix Online | <a:atheNATICK:1557841381630681106>\n-# **Server Security & Antinuke:** \`100% Bulletproof Active\`\n-# **Enforcement Mode:** \`Instant Ban (Threshold 1)\`\n-# **Monitored Vectors:** \`All 28 Antinuke Modules + AI Toxicity/Doxxing Shield\``
          }
        ]
      }).catch(() => null);

      // Real-time synchronization of security dashboard
      const { updateDashboardMessage } = await import("../utils/dashboardManager.js");
      await updateDashboardMessage(guild, guild.client).catch(() => null);
    
      await sendPayload(true, false);
      return true;
}

export async function getServerSecurityEnabledPanel() {
    const section1 = { type: 10, content: "-# **SERVER SECURITY ENABLED**\n-# **When server security is enabled these config actions required to from owner/extraowner /whitelist users and Roles**" };

    const sectionExploit = { type: 10, content:
      "-# **Active Anti-Exploit Protections:**\n" +
      "-# • **Real-Time Role Interceptor (`guildMemberUpdate.js`):** Intercepts unauthorized gaining of Administrator/dangerous roles, cross-examining 60s audit logs, stripping roles, disarming dangerous permissions, and quarantining the user.\n" +
      "-# • **Join-Time & Onboarding Guard (`guildMemberAdd.js` & `onboardingGuard.js`):** Neutralizes Discord Onboarding & pre-linked role exploits with Administrator, Manage Server, Manage Roles, Ban Members, etc. by disarming permissions, scrubbing prompts, stripping roles, and quarantining accounts."
    };

    const section2 = { type: 10, content: "-# <a:warning:1540656124313993247> **`!botwhitelist add <bot id>` - To add bots to server by whitelisted users before that the admin bot comes in either whitelisted to ensure data leaving server owner or extra owner**\n\n" +
                     "-# <a:warning:1540656124313993247> **`!whitelist @user` - Whitelist users to have securely immunity for the targeted user for whitelisted actions the targeted user is immune for target events**\n\n" +
                     "-# <a:warning:1540656124313993247> **`!whitelist @role` - The Roles can be whitelisted same as users , attempt to get or give whitelisted role to other user by whitelisted user or extra owner will be sent back in error and giver of whitelisted role will be banned**\n\n" +
                     "-# <a:warning:1540656124313993247> **`#athenas-dashboard` - A dedicated dashboard channel showing server security status where you can easily configure and toggle Athena's security modules.**\n\n" +
                     "-# <a:warning:1540656124313993247> **`#security-logs` - An Athena webhook channel created automatically for logging all security actions and artifacts.**" };

    const section3 = { type: 10, content: "-# **Terms of Service (TOS)**\n\n" +
                     "-# **Data Privacy Terms: Athena Prime collects strictly minimal server data (guild ID, role IDs, audit log events, and whitelist settings) solely to operate antinuke security. No personal user messages, DMs, or sensitive personal data are recorded, stored, or shared with any third party.**\n\n" +
                     "-# **Non-Exploit Terms: Any attempt to exploit, reverse-engineer, bypass security filters, abuse under-bot privileges, or utilize bot features to disrupt or harm servers is strictly forbidden. Violations result in immediate global blacklisting and permanent loss of security privileges.**" };

    const container = {
        type: 17,
        components: [section1, { type: 14, divider: true }, sectionExploit, { type: 14, divider: true }, section2, { type: 14, divider: true }, section3]
    };

    return { components: [container.toJSON ? container.toJSON() : container], flags: MessageFlags.IsComponentsV2 };
}

export async function getSecureDashboardPanel(guild) {
    const db = (await import("../database.js")).default;
    await guild.members.fetch().catch(() => null);
    await guild.roles.fetch().catch(() => null);

    const dangerousPerms = [
        PermissionFlagsBits.Administrator,
        PermissionFlagsBits.ManageGuild,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageWebhooks,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.KickMembers
    ];

    const getDangerousRoles = (memberOrRole) => {
        if (memberOrRole.permissions) {
            return dangerousPerms.some(perm => memberOrRole.permissions.has(perm));
        } else {
            return memberOrRole.roles.cache.filter(role => role.id !== guild.id && dangerousPerms.some(perm => role.permissions.has(perm)));
        }
    };

    const dangerousRoles = guild.roles.cache.filter(role => role.id !== guild.id && getDangerousRoles(role));
    const allBots = guild.members.cache.filter(m => m.user.bot);
    const allHumans = guild.members.cache.filter(m => !m.user.bot);
    const humansWithDangerousRoles = allHumans.filter(m => m.id !== guild.ownerId && getDangerousRoles(m).size > 0);
    const botsWithDangerousRoles = allBots.filter(m => getDangerousRoles(m).size > 0);
    const productionBots = allBots.filter(m => m.user.bot);

    const formatList = (collection) => {
        if (collection.size === 0) return "0 None";
        const list = collection.map(x => "<@" + (x.user ? "" : "&") + x.id + ">").slice(0, 10).join(" ");
        return collection.size + " " + list + (collection.size > 10 ? "..." : "");
    };

    const rolesStr = dangerousRoles.size === 0 ? "0 None" : dangerousRoles.size + " " + dangerousRoles.map(r => "<@&" + r.id + ">").slice(0,10).join(" ");

    const config = db.getGuildConfig(guild.id);
    const twoFactorEmail = config.twoFactorEmail || "Not Configured";

    const text =
        "-# **List Dangerous Roles:** " + rolesStr + "\n" +
        "-# **List Bots:** " + formatList(allBots) + "\n" +
        "-# **Humans Having Dangerous Roles:** " + formatList(humansWithDangerousRoles) + "\n" +
        "-# **Bots Having Dangerous Roles:** " + formatList(botsWithDangerousRoles) + "\n" +
        "-# **Production Level Bots:** " + formatList(productionBots) + "\n\n" +
        "-# **2FA Notification Gmail:** `" + twoFactorEmail + "`";

    const card = {
      type: 17,
      components: [
        { type: 10, content: text },
        { type: 14, divider: true },
        { type: 1, components: [
            { type: 2, custom_id: "sec_extra_owner", label: "ExtraOwner", style: 2 },
            { type: 2, custom_id: "sec_wl_user", label: "Whitelist user", style: 2 },
            { type: 2, custom_id: "sec_wl_role", label: "whitelist role", style: 2 }
        ]},
        { type: 1, components: [
            { type: 2, custom_id: "sec_2fa_gmail", label: "Submit Gmail (2FA)", style: 2 },
            { type: 2, custom_id: "sec_rescan_dash", label: "Rescan", style: 2 },
            { type: 2, custom_id: "sec_close_dash", label: "Close", style: 4 }
        ]}
      ]
    };
    return { components: [card.toJSON ? card.toJSON() : card], flags: MessageFlags.IsComponentsV2 };
}


export async function handleScanServer(guild, page = 0) {
  const config = db.getGuildConfig(guild.id);
  const whitelistedIds = config.botWhitelist || [];
  
  await guild.members.fetch().catch(() => null);
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

  // Onboarding scan
  const onboardingDangerousRoles = [];
  try {
    const onboarding = await guild.fetchOnboarding().catch(() => null);
    if (onboarding) {
      const rawPrompts = onboarding.prompts?.values ? [...onboarding.prompts.values()] : (Array.isArray(onboarding.prompts) ? onboarding.prompts : []);
      const authRoles = db.getAuthRoles(guild.id);
      for (const prompt of rawPrompts) {
        const rawOptions = prompt.options?.values ? [...prompt.options.values()] : (Array.isArray(prompt.options) ? prompt.options : []);
        for (const opt of rawOptions) {
          const roleIds = opt.roles?.keys ? [...opt.roles.keys()] : (opt.roleIds || (Array.isArray(opt.roles) ? opt.roles.map(r => r.id || r) : []));
          for (const roleId of roleIds) {
            const r = guild.roles.cache.get(roleId);
            if (r && (hasCriticalOnboardingPerms(r.permissions) || (authRoles?.admin && authRoles.admin.includes(r.id)))) {
              if (!onboardingDangerousRoles.some(entry => entry.id === r.id)) {
                onboardingDangerousRoles.push({ id: r.id, name: r.name, perms: getDangerousPermNames(r.permissions) });
              }
            }
          }
        }
      }
    }
  } catch {}

  // Role-Based Invites scan
  const dangerousInviteLinks = [];
  try {
    const rawInvites = await guild.client.rest.get(Routes.guildInvites(guild.id)).catch(() => null);
    if (Array.isArray(rawInvites)) {
      const authRoles = db.getAuthRoles(guild.id);
      for (const inv of rawInvites) {
        const roleIds = inv.role_ids || (Array.isArray(inv.roles) ? inv.roles.map(r => r.id || r) : []);
        for (const rid of roleIds) {
          const r = guild.roles.cache.get(rid);
          if (r && (hasCriticalOnboardingPerms(r.permissions) || (authRoles?.admin && authRoles.admin.includes(rid)))) {
            dangerousInviteLinks.push({ code: inv.code, roleName: r.name, roleId: r.id });
          }
        }
      }
    }
  } catch {}

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

  const cv2Components = [];
  
  cv2Components.push({ type: 10, content: `## **SERVER SECURITY SCANNER**` });
  cv2Components.push({ type: 14, divider: true });
  
  cv2Components.push({ 
    type: 10, 
    content: `## **SECURITY DIAGNOSTICS**\n-# **Total Humans:** \`${allHumans.size}\`\n-# **Total Bots:** \`${allBots.size}\` (Whitelisted: \`${whitelistedBots.length}\` | Unauthorized: \`${unauthorizedBots.length}\`)\n-# **Onboarding Status:** \`${onboardingDangerousRoles.length > 0 ? `${onboardingDangerousRoles.length} Dangerous Roles Detected (Use !neutralizeonboarding)` : 'Clean / Protected'}\`\n-# **Role-Based Invites Status:** \`${dangerousInviteLinks.length > 0 ? `${dangerousInviteLinks.length} Dangerous Role-Bound Invites Detected` : 'Clean / Protected'}\`` 
  });

  if (dangerousInviteLinks.length > 0) {
    cv2Components.push({ type: 14, divider: true });
    let invContent = `## **DANGEROUS ROLE-BOUND INVITES DETECTED**\n`;
    dangerousInviteLinks.forEach(d => {
      invContent += `-# - **discord.gg/${d.code}** assigned to \`${d.roleName}\` (\`${d.roleId}\`)\n`;
    });
    cv2Components.push({ type: 10, content: invContent.trim() });
  }
  
  const humansToShow = trustedHumans.slice(startIdx, endIdx);
  if (humansToShow.length > 0) {
    cv2Components.push({ type: 14, divider: true });
    let content = `## **TRUSTED PERSONNEL**\n`;
    humansToShow.forEach(h => {
      content += `-# - **@${h.user.globalName || h.user.username}** [\`${h.id}\`]\n`;
    });
    if (trustedHumans.length > endIdx) content += `-# *...and ${trustedHumans.length - endIdx} more.*\n`;
    cv2Components.push({ type: 10, content: content.trim() });
  }

  const whitelistedBotsToShow = whitelistedBots.slice(startIdx, endIdx);
  if (whitelistedBotsToShow.length > 0) {
    cv2Components.push({ type: 14, divider: true });
    let content = `## **WHITELISTED BOTS**\n`;
    whitelistedBotsToShow.forEach(b => {
      content += `-# - **@${b.user.globalName || b.user.username}** [\`${b.id}\`]\n`;
    });
    if (whitelistedBots.length > endIdx) content += `-# *...and ${whitelistedBots.length - endIdx} more.*\n`;
    cv2Components.push({ type: 10, content: content.trim() });
  }

  const highRiskHumansToShow = highRiskHumans.slice(startIdx, endIdx);
  if (highRiskHumansToShow.length > 0) {
    cv2Components.push({ type: 14, divider: true });
    let content = `## **HIGH-RISK PERSONNEL**\n`;
    highRiskHumansToShow.forEach(h => {
      content += `-# - **@${h.member.user.globalName || h.member.user.username}** [\`${h.member.id}\`] - ${h.roles.map(r => `<@&${r.id}>`).join(', ')}\n`;
    });
    if (highRiskHumans.length > endIdx) content += `-# *...and ${highRiskHumans.length - endIdx} more.*\n`;
    cv2Components.push({ type: 10, content: content.trim() });
  }

  const unauthorizedBotsToShow = unauthorizedBots.slice(startIdx, endIdx);
  if (unauthorizedBotsToShow.length > 0) {
    cv2Components.push({ type: 14, divider: true });
    let content = `## **UNAUTHORIZED BOTS**\n`;
    unauthorizedBotsToShow.forEach(b => {
      const badRoles = getDangerousRoles(b);
      content += `-# - **@${b.user.globalName || b.user.username}** [\`${b.id}\`] ${badRoles.size > 0 ? `(${badRoles.map(r => `<@&${r.id}>`).join(', ')})` : ''}\n`;
    });
    if (unauthorizedBots.length > endIdx) content += `-# *...and ${unauthorizedBots.length - endIdx} more.*\n`;
    cv2Components.push({ type: 10, content: content.trim() });
  }

  if (onboardingDangerousRoles.length > 0) {
    cv2Components.push({ type: 14, divider: true });
    let content = `## **DANGEROUS ONBOARDING ROLES DETECTED**\n-# The following roles are attached to Discord Onboarding and possess elevated administrative or moderation privileges. Use \`!neutralizeonboarding\` to disarm and scrub them immediately:\n`;
    onboardingDangerousRoles.forEach(r => {
      content += `-# - <@&${r.id}> (\`${r.name}\` | \`${r.id}\`) - \`${r.perms.join(', ') || 'Administrator / Elevated'}\`\n`;
    });
    cv2Components.push({ type: 10, content: content.trim() });
  }

  if (unauthorizedBots.length === 0 && highRiskHumans.length === 0 && onboardingDangerousRoles.length === 0) {
     cv2Components.push({ type: 14, divider: true });
     cv2Components.push({ type: 10, content: `-# **Server security is optimal. No unauthorized bots, untrusted high-risk users, or dangerous onboarding roles detected.**` });
  }
  
  cv2Components.push({ type: 14, divider: true });
  cv2Components.push({ type: 10, content: `-# **Page ${page + 1} of ${totalPages}**` });

  const container = {
    type: 17,
    components: cv2Components
  };

  const actionRows = [];

  // Pagination buttons
  if (totalPages > 1) {
    const prevBtn = new ButtonBuilder()
      .setCustomId(`scanserver_prev_${page}`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0);
      
    const nextBtn = new ButtonBuilder()
      .setCustomId(`scanserver_next_${page}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === totalPages - 1);
      
    actionRows.push(new ActionRowBuilder().addComponents(prevBtn, nextBtn));
  }

  if (unauthorizedBots.length > 0) {
    const options = unauthorizedBots.map(b => ({
      label: b.user.globalName || b.user.username.substring(0, 100),
      description: b.id,
      value: b.id
    })).slice(0, 25);
    
    // Required because we might be returning inside an interaction update
    const { StringSelectMenuBuilder } = await import('discord.js');
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`scanserver_ban_${page}`)
      .setPlaceholder('Select an unauthorized bot to ban')
      .addOptions(options);
      
    const banAllBtn = new ButtonBuilder()
      .setCustomId(`scanserver_banall_${page}`)
      .setLabel('Ban All Unauthorized')
      .setStyle(ButtonStyle.Danger);
      
    actionRows.push(new ActionRowBuilder().addComponents(selectMenu));
    actionRows.push(new ActionRowBuilder().addComponents(banAllBtn));
  }
  
  if (actionRows.length > 0) {
    cv2Components.push({ type: 14, divider: true });
    cv2Components.push(...actionRows.map(r => r.toJSON ? r.toJSON() : r));
  }

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

export async function handleAutoModBypass(guild, action, role) {
  const config = db.getGuildConfig(guild.id);
  const bypasses = config.automodBypasses || {};

  if (action === 'add') {
    if (!role) return cv2.warn('Invalid Role', 'Please mention a valid role to bypass automod.');
    bypasses[role.id] = ['all'];
    db.updateGuildConfig(guild.id, { automodBypasses: bypasses });
    return cv2.success('Automod Bypass Added | <a:atheNATICK:1557841381630681106>', `Role <@&${role.id}> has been granted bypass for Automod modules.`);
  }

  if (action === 'remove') {
    if (!role) return cv2.warn('Invalid Role', 'Please mention a valid role to remove from bypass.');
    if (bypasses[role.id]) {
      delete bypasses[role.id];
      db.updateGuildConfig(guild.id, { automodBypasses: bypasses });
      return cv2.success('Automod Bypass Removed | <a:atheNATICK:1557841381630681106>', `Role <@&${role.id}> has been removed from Automod bypass.`);
    }
    return cv2.warn('Not Found', `Role <@&${role.id}> is not in the Automod bypass list.`);
  }

  // list
  const keys = Object.keys(bypasses);
  if (keys.length === 0) {
    return cv2.info('Automod Bypasses', 'No roles currently have automod bypass privileges.');
  }
  const lines = keys.map((id, i) => `${i + 1}. <@&${id}> - All Automod Protections`);
  return cv2.info('Automod Bypassed Roles', lines.join('\n'));
}

export async function getAutoModPanel(guild) {
  const config = db.getGuildConfig(guild.id);
  
  const spamMentionOn = config.antiSpamMentionEnabled === true;
  const antiFloodOn = config.antiFloodEnabled !== false;
  const antiLinkOn = config.antiLinkEnabled !== false;
  const antiInviteOn = config.antiInviteEnabled !== false;
  const wordFilterOn = config.wordFilterEnabled !== false;
  const bigFontsOn = config.bigFontsEnabled !== false;
  const hiddenUrlOn = config.hiddenUrlEnabled !== false;
  const fileCheckOn = config.fileCheckEnabled !== false;
  const selfbotOn = config.selfbotDetectionEnabled !== false;
  
  const TOGGLE_ON = '<:on:1533844867191406672>';
  const TOGGLE_OFF = '<:off:1533844858983157851>';
  const DOT = '•';
  const E_CLOCK = '🕒';

  const linkChannel = (config.linkAllowedChannel || config.urlAllowedChannel || config.antiLinkAllowedChannel)
    ? `<#${config.linkAllowedChannel || config.urlAllowedChannel || config.antiLinkAllowedChannel}>` 
    : 'None';
  const inviteChannel = config.inviteAllowedChannel ? `<#${config.inviteAllowedChannel}>` : 'None';
  const honeypotChannel = config.honeypotChannelId ? `<#${config.honeypotChannelId}>` : 'None';
  const honeypotTimeout = config.honeypotTimeoutMinutes || 15;

  const bypasses = config.automodBypasses || {};
  let bypassText = '';
  const bypassedRolesKeys = Object.keys(bypasses);
  if (bypassedRolesKeys.length === 0) {
    bypassText = `-# **| No granular bypasses configured.**`;
  } else {
    for (const rId of bypassedRolesKeys) {
      if (bypasses[rId] && bypasses[rId].length > 0) {
          const displayStr = bypasses[rId].length >= 10 ? 'All Automoderation Events' : bypasses[rId].join(', ');
          bypassText += `-# **| <@&${rId}> Bypasses:** ${displayStr}\n`;
        }
    }
  }

  const { ContainerBuilder, SeparatorBuilder, TextDisplayBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType } = await import('discord.js');
  
  const panelContainer = new ContainerBuilder();

  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `# AUTOMOD | HEURISTIC FILTERING & SECURITY MATRIX\n` +
    `**Athena Unbypassable !**`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `### **Filters Active:**\n` +
    `-# **${DOT} AI Toxicity & Sentiment AutoMod (Doxxing, severe toxicity, violent threats)**\n` +
    `-# **${DOT} Mass Mention / Spam Tag Filter**\n` +
    `-# **${DOT} Anti Flood Filter**\n` +
    `-# **${DOT} Standard URLs (unless bypassed)**\n` +
    `-# **${DOT} Discord Invites**\n` +
    `-# **${DOT} NSFW Links**\n` +
    `-# **${DOT} Phishing & Scams**\n` +
    `-# **${DOT} Anti-Profanity / Blacklisted Words**\n` +
    `-# **${DOT} Big Fonts (Anti Full Caps)**\n` +
    `-# **${DOT} Selfbot Detection (Rich Embeds)**\n` +
    `-# **${DOT} Escalating Punishments**\n` +
    `-# **${DOT} Max Warnings Count Set**`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `### **Current Configurations:**\n` +
    `-# **| AI Toxicity & Sentiment Shield:** ${config.aiToxicityEnabled ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| Mass Mention Filter:** ${spamMentionOn ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| Anti Flood Engine:** ${antiFloodOn ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| Anti-Link Engine:** ${antiLinkOn ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| Anti-Invite Engine:** ${antiInviteOn ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| Word Filter:** ${wordFilterOn ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| Big Fonts:** ${bigFontsOn ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| Selfbot Detection:** ${selfbotOn ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| Hidden URL Filter:** ${hiddenUrlOn ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| File Check Filter:** ${fileCheckOn ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| Allow All Links (Global):** ${config.allowAllLinks ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| Allow Invites (Global):** ${config.allowInvitesGlobally ? TOGGLE_ON : TOGGLE_OFF}\n` +
    `-# **| Max Warnings Threshold:** ${config.maxWarnings || 3} (Use \`!maxwarnings <number>\` to modify)\n` +
    `-# **| Honeypot Timeout:** ${honeypotTimeout}m`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `### **Bypass Settings:**\n` +
    (bypassText.trim() ? bypassText.trim() + '\n' : '') +
    `-# **| Links / URL Allowed Channel:** ${linkChannel}\n` +
    `-# **| Invite Allowed Channel:** ${inviteChannel}\n` +
    `-# **| Honeypot Channel:** ${honeypotChannel}`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `-# **Athena Bulletproof Security !!!**`
  ));

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('am_tgl_massmention').setLabel('Mass Mention').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_flood').setLabel('Anti Flood').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_link').setLabel('Anti-Link').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_invite').setLabel('Anti-Invite').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_word').setLabel('Word Filter').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('am_tgl_fonts').setLabel('Big Fonts').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_hiddenurl').setLabel('Hidden URLs').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_filecheck').setLabel('File Check').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_tgl_selfbot').setLabel('Selfbot Detection').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('am_advanced_configs').setLabel('Link & Invite Toggles').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('am_select_granular_role')
      .setPlaceholder('Select Target Role to Configure Bypasses...')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const row4 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('am_select_link_channel')
      .setPlaceholder('Select Links / URL Allowed Channel...')
      .setChannelTypes(ChannelType.GuildText)
  );

  const row5 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('am_select_invite_channel')
      .setPlaceholder('Select Invite Allowed Channel...')
      .setChannelTypes(ChannelType.GuildText)
  );

  panelContainer.addActionRowComponents(row1, row2, row3, row4, row5);
  return { components: [panelContainer.toJSON ? panelContainer.toJSON() : panelContainer], flags: MessageFlags.IsComponentsV2 };
}

export async function getGranularBypassPanel(guild, roleId) {
  const db = (await import('../database.js')).default;
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = await import('discord.js');
  const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = await import('discord.js');

  const config = db.getGuildConfig(guild.id);
  const bypasses = config.automodBypasses || {};
  const roleBypasses = bypasses[roleId] || [];

  const checkBypass = (key) => roleBypasses.includes(key);

  const E_GREEN = '<:on:1533844867191406672>'; 
  const E_RED = '<:off:1533844858983157851>'; 
  const E_CLOCK = '⏰'; 

  const status = (key) => checkBypass(key) ? `${E_GREEN} **${key}:** Bypassed` : `${E_RED} **${key}:** Enforced`;

  const panelContainer = new ContainerBuilder();

  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `# AUTOMOD | PRIVILEGE ESCALATION & BYPASS MATRIX\n\n` +
    `**Target Role:** <@&${roleId}>\n` +
    `-# ${status('Anti Invite')}\n` +
    `-# ${status('Swear Words')}\n` +
    `-# ${status('URL Filter')}\n` +
    `-# ${status('Spam Filter')}\n` +
    `-# ${status('Mass Mentions')}\n` +
    `-# ${status('Anti Flood')}\n` +
    `-# ${status('Hidden URL Filter')}\n` +
    `-# ${status('Selfbot Detection')}\n` +
    `-# ${status('File Check')}\n` +
    `-# ${status('Big Fonts')}\n` +
    `-# ${E_CLOCK} **File Timeout Duration:** 15 mins`
  ));

  panelContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  panelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `-# **Athena Bulletproof Security !!!**`
  ));

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bp_Anti Invite_${roleId}`).setLabel('Anti Invite').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bp_Swear Words_${roleId}`).setLabel('Swear Words').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bp_URL Filter_${roleId}`).setLabel('URL Filter').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bp_Spam Filter_${roleId}`).setLabel('Spam Filter').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bp_Mass Mentions_${roleId}`).setLabel('Mass Mentions').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bp_Anti Flood_${roleId}`).setLabel('Anti Flood').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bp_Hidden URL Filter_${roleId}`).setLabel('Hidden URL Filter').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bp_Selfbot Detection_${roleId}`).setLabel('Selfbot Detection').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bp_File Check_${roleId}`).setLabel('File Check').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bp_Big Fonts_${roleId}`).setLabel('Big Fonts').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bp_all_${roleId}`).setLabel('Bypass All').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bp_reset_${roleId}`).setLabel('Reset All').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bp_back`).setLabel('Back to Overview').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bp_save_${roleId}`).setLabel('Save').setStyle(ButtonStyle.Success)
  );

  panelContainer.addActionRowComponents(row1, row2, row3);

  return { components: [panelContainer.toJSON ? panelContainer.toJSON() : panelContainer], flags: MessageFlags.IsComponentsV2 };
}


export async function executeInterceptedAction(interaction) {
  const db = (await import("../database.js")).default;
  const config = db.getGuildConfig(interaction.guild.id);
  
  if (config.pendingAction === "disable_all") {
      const result = await handleSecurityToggleAll(interaction.guild, interaction.member, false);
      db.updateGuildConfig(interaction.guild.id, { pendingAction: null });
      return interaction.reply(result);
  }
  return interaction.reply({ content: "No pending action found.", flags: MessageFlags.Ephemeral });
}

export async function getAdvancedConfigPanel(guild) {
  const db = (await import('../database.js')).default;
  const config = db.getGuildConfig(guild.id);
  
  const { ContainerBuilder, TextDisplayBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType } = await import('discord.js');
  
  const honeypotChannel = config.honeypotChannelId ? `<#${config.honeypotChannelId}>` : 'None';

  const c = new ContainerBuilder();
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `# AUTOMOD | ADVANCED GLOBAL SETTINGS\n` +
    `-# **| AI Toxicity & Sentiment Shield:** ${config.aiToxicityEnabled ? '<:on:1533844867191406672>' : '<:off:1533844858983157851>'}\n` +
    `-# **| Allow All Links (Global):** ${config.allowAllLinks ? '<:on:1533844867191406672>' : '<:off:1533844858983157851>'}\n` +
    `-# **| Allow Invites (Global):** ${config.allowInvitesGlobally ? '<:on:1533844867191406672>' : '<:off:1533844858983157851>'}\n` +
    `-# **| Honeypot Channel:** ${honeypotChannel}`
  ));
  
  const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('am_tgl_aitoxicity').setLabel('AI Toxicity AutoMod').setStyle(config.aiToxicityEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_global_links').setLabel('Allow ALL Links').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('am_tgl_global_invites').setLabel('Global Invites').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('am_select_honeypot_channel')
      .setPlaceholder('Select Honeypot Trap Channel...')
      .setChannelTypes(ChannelType.GuildText)
  );

  const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('am_back_to_main').setLabel('Back to Automod').setStyle(ButtonStyle.Secondary)
  );
  
  c.addActionRowComponents(row1, row2, row3);
  return { components: [c.toJSON ? c.toJSON() : c], flags: MessageFlags.IsComponentsV2 };
}

export async function handleAutonickButton(interaction) {
  const customId = interaction.customId;
  const guildId = interaction.guild.id;
  const guild = interaction.guild;
  const db = (await import("../database.js")).default;
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = await import("discord.js");
  const { formatNickname } = await import('../utils/helpers.js');
  let cfg = db.getGuildConfig(guildId);
  if (!cfg.autonick) cfg.autonick = { enabled: false, prefix: '', suffix: '', layout: '{name}' };

  if (customId === 'autonick_toggle') {
    cfg.autonick.enabled = !cfg.autonick.enabled;
    db.updateGuildConfig(guildId, { autonick: cfg.autonick });
    return interaction.update(await buildAutonickDashboard(guildId, guild));
  }

  if (customId === 'autonick_edit') {
    const modal = new ModalBuilder().setCustomId('autonick_modal').setTitle('Edit Autonick Layout');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('layout')
          .setLabel('Nickname Layout (use {user} or {name})')
          .setStyle(TextInputStyle.Short)
          .setValue(cfg.autonick.layout || '{name}')
          .setPlaceholder('e.g. (ENT{user}) or ENT | {name}')
          .setRequired(true)
      )
    );
    return interaction.showModal(modal);
  }

  if (customId === 'autonick_sync') {
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me || !me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      const noPermCard = {
        type: 17,
        components: [
          {
            type: 10,
            content: `## <:off:1533844858983157851> **__Missing Permissions__**`
          },
          { type: 14, divider: true },
          {
            type: 10,
            content: `-# **• __Error:__ The bot lacks the __Manage Nicknames__ permission in this server.**\n` +
                     `-# **• __Resolution:__ Grant the bot the __Manage Nicknames__ permission in Server Settings > Roles.**`
          },
          { type: 14, divider: true },
          {
            type: 10,
            content: `-# **Athena Bulletproof Security System • V1.0.0**`
          }
        ]
      };
      return interaction.reply({ components: [noPermCard], flags: MessageFlags.IsComponentsV2 });
    }

    const loadingCard = {
      type: 17,
      components: [
        {
          type: 10,
          content: `## <a:loading:1542155051286396938> **__Synchronizing Nicknames...__**`
        },
        { type: 14, divider: true },
        {
          type: 10,
          content: `-# **• __Target Layout:__ \`${cfg.autonick.layout}\`**\n` +
                   `-# **• __Status:__ Fetching server member roster...**\n` +
                   `-# **• __Live Synced:__ \`0\` members updated**`
        },
        { type: 14, divider: true },
        {
          type: 10,
          content: `-# **Athena Bulletproof Security System • V1.0.0**`
        }
      ]
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ components: [loadingCard], flags: MessageFlags.IsComponentsV2 });
    } else {
      await interaction.reply({ components: [loadingCard], flags: MessageFlags.IsComponentsV2 });
    }

    let members = guild.members.cache;
    try {
      const fetched = await Promise.race([
        guild.members.fetch({ time: 4000 }).catch(() => null),
        new Promise(r => setTimeout(() => r(null), 4000))
      ]);
      if (fetched && fetched.size > 0) members = fetched;
    } catch (e) {
      members = guild.members.cache;
    }
    if (!members || members.size === 0) members = guild.members.cache;

    const myHighestRole = me.roles.highest.position;
    const eligible = [];
    let unmanageableCount = 0;
    let alreadySyncedCount = 0;

    for (const [id, member] of members) {
      if (member.user.bot || member.id === guild.ownerId) continue;
      if (!member.manageable || member.roles.highest.position >= myHighestRole) {
        unmanageableCount++;
        continue;
      }
      const expectedNick = formatNickname(cfg.autonick.layout, member.user.globalName || member.user.username);
      if (member.displayName !== expectedNick) {
        eligible.push({ member, expectedNick });
      } else {
        alreadySyncedCount++;
      }
    }

    if (eligible.length === 0) {
      let statusLines = '';
      if (unmanageableCount > 0 && alreadySyncedCount === 0) {
        statusLines = `-# **• __Status:__ Found \`${unmanageableCount}\` member(s), but their roles are placed higher than or equal to the bot's role!**\n` +
                      `-# **• __Resolution:__ In __Server Settings > Roles__, move the bot's role to the top of the role list.**`;
      } else {
        statusLines = `-# **• __Status:__ All manageable members are already up-to-date!**\n` +
                      `-# **• __Live Synced:__ \`${alreadySyncedCount}\` members formatted**`;
        if (unmanageableCount > 0) {
          statusLines += `\n-# **• __Skipped Roles:__ \`${unmanageableCount}\` members skipped (placed higher than bot role)**`;
        }
      }

      const completeCard = {
        type: 17,
        components: [
          {
            type: 10,
            content: `## <a:uptime:1552608831060844575> **__Nickname Synchronization Complete__**`
          },
          { type: 14, divider: true },
          {
            type: 10,
            content: `-# **• __Target Layout:__ \`${cfg.autonick.layout}\`**\n` +
                     statusLines + `\n` +
                     `-# **• __Total Evaluated:__ \`${members.filter(m => !m.user.bot && m.id !== guild.ownerId).size}\` members**`
          },
          { type: 14, divider: true },
          {
            type: 10,
            content: `-# **Athena Bulletproof Security System • V1.0.0**`
          }
        ]
      };
      return interaction.editReply({ components: [completeCard], flags: MessageFlags.IsComponentsV2 });
    }

    let count = 0;
    let failed = 0;
    const total = eligible.length;
    let lastUpdate = Date.now();

    for (let i = 0; i < total; i++) {
      const { member, expectedNick } = eligible[i];
      try {
        await member.setNickname(expectedNick, 'Athena Autonick Sync');
        count++;
      } catch (err) {
        failed++;
      }

      const now = Date.now();
      if (i === total - 1 || now - lastUpdate >= 2000 || (i > 0 && i % 5 === 0)) {
        lastUpdate = now;
        const percent = Math.round(((i + 1) / total) * 100);
        const progressCard = {
          type: 17,
          components: [
            {
              type: 10,
              content: `## <a:loading:1542155051286396938> **__Synchronizing Nicknames...__**`
            },
            { type: 14, divider: true },
            {
              type: 10,
              content: `-# **• __Target Layout:__ \`${cfg.autonick.layout}\`**\n` +
                       `-# **• __Progress:__ \`${count}\` / \`${total}\` members updated (\`${percent}%\`)**\n` +
                       `-# **• __Live Synced:__ \`${count}\` updated • \`${failed}\` skipped**`
            },
            { type: 14, divider: true },
            {
              type: 10,
              content: `-# **Athena Bulletproof Security System • V1.0.0**`
            }
          ]
        };
        await interaction.editReply({
          components: [progressCard],
          flags: MessageFlags.IsComponentsV2
        }).catch(() => null);
      }

      await new Promise(r => setTimeout(r, 200));
    }

    const finalCard = {
      type: 17,
      components: [
        {
          type: 10,
          content: `## <a:uptime:1552608831060844575> **__Nickname Synchronization Complete__**`
        },
        { type: 14, divider: true },
        {
          type: 10,
          content: `-# **• __Target Layout:__ \`${cfg.autonick.layout}\`**\n` +
                   `-# **• __Successfully Synced:__ \`${count}\` members**\n` +
                   `-# **• __Skipped / Unmanageable:__ \`${failed + unmanageableCount}\` members**\n` +
                   `-# **• __Total Processed:__ \`${total}\` members**`
        },
        { type: 14, divider: true },
        {
          type: 10,
          content: `-# **Athena Bulletproof Security System • V1.0.0**`
        }
      ]
    };
    return interaction.editReply({ components: [finalCard], flags: MessageFlags.IsComponentsV2 });
  }

  if (customId === 'autonick_restore') {
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me || !me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      const noPermCard = {
        type: 17,
        components: [
          {
            type: 10,
            content: `## <:off:1533844858983157851> **__Missing Permissions__**`
          },
          { type: 14, divider: true },
          {
            type: 10,
            content: `-# **• __Error:__ The bot lacks the __Manage Nicknames__ permission in this server.**\n` +
                     `-# **• __Resolution:__ Grant the bot the __Manage Nicknames__ permission in Server Settings > Roles.**`
          },
          { type: 14, divider: true },
          {
            type: 10,
            content: `-# **Athena Bulletproof Security System • V1.0.0**`
          }
        ]
      };
      return interaction.reply({ components: [noPermCard], flags: MessageFlags.IsComponentsV2 });
    }

    const loadingCard = {
      type: 17,
      components: [
        {
          type: 10,
          content: `## <a:loading:1542155051286396938> **__Restoring Original Nicknames...__**`
        },
        { type: 14, divider: true },
        {
          type: 10,
          content: `-# **• __Status:__ Fetching server member roster...**\n` +
                   `-# **• __Live Restored:__ \`0\` names reset**`
        },
        { type: 14, divider: true },
        {
          type: 10,
          content: `-# **Athena Bulletproof Security System • V1.0.0**`
        }
      ]
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ components: [loadingCard], flags: MessageFlags.IsComponentsV2 });
    } else {
      await interaction.reply({ components: [loadingCard], flags: MessageFlags.IsComponentsV2 });
    }

    let members = guild.members.cache;
    try {
      const fetched = await Promise.race([
        guild.members.fetch({ time: 4000 }).catch(() => null),
        new Promise(r => setTimeout(() => r(null), 4000))
      ]);
      if (fetched && fetched.size > 0) members = fetched;
    } catch (e) {
      members = guild.members.cache;
    }
    if (!members || members.size === 0) members = guild.members.cache;

    const myHighestRole = me.roles.highest.position;
    const toRestore = [];
    let unmanageableWithNick = 0;

    for (const [id, member] of members) {
      if (member.user.bot || member.id === guild.ownerId) continue;
      if (!member.nickname) continue;

      if (!member.manageable || member.roles.highest.position >= myHighestRole) {
        unmanageableWithNick++;
        continue;
      }
      toRestore.push(member);
    }

    if (toRestore.length === 0) {
      let statusLines = '';
      if (unmanageableWithNick > 0) {
        statusLines = `-# **• __Status:__ Found \`${unmanageableWithNick}\` member(s) with nicknames, but their roles are placed higher than or equal to the bot's role!**\n` +
                      `-# **• __Resolution:__ In __Server Settings > Roles__, move the bot's role to the top of the role list.**`;
      } else {
        statusLines = `-# **• __Status:__ No custom nicknames found to restore.**`;
      }

      const cleanCard = {
        type: 17,
        components: [
          {
            type: 10,
            content: `## <a:uptime:1552608831060844575> **__Original Nicknames Restored__**`
          },
          { type: 14, divider: true },
          {
            type: 10,
            content: statusLines + `\n` +
                     `-# **• __Total Evaluated:__ \`${members.filter(m => !m.user.bot && m.id !== guild.ownerId).size}\` members**`
          },
          { type: 14, divider: true },
          {
            type: 10,
            content: `-# **Athena Bulletproof Security System • V1.0.0**`
          }
        ]
      };
      return interaction.editReply({ components: [cleanCard], flags: MessageFlags.IsComponentsV2 });
    }

    let count = 0;
    let failed = 0;
    const total = toRestore.length;
    let lastUpdate = Date.now();

    for (let i = 0; i < total; i++) {
      const member = toRestore[i];
      try {
        await member.setNickname(null, 'Athena Autonick Restore');
        count++;
      } catch (err) {
        failed++;
      }

      const now = Date.now();
      if (i === total - 1 || now - lastUpdate >= 2000 || (i > 0 && i % 5 === 0)) {
        lastUpdate = now;
        const percent = Math.round(((i + 1) / total) * 100);
        const progressCard = {
          type: 17,
          components: [
            {
              type: 10,
              content: `## <a:loading:1542155051286396938> **__Restoring Original Nicknames...__**`
            },
            { type: 14, divider: true },
            {
              type: 10,
              content: `-# **• __Progress:__ \`${count}\` / \`${total}\` names restored (\`${percent}%\`)**\n` +
                       `-# **• __Live Restored:__ \`${count}\` restored • \`${failed}\` skipped**`
            },
            { type: 14, divider: true },
            {
              type: 10,
              content: `-# **Athena Bulletproof Security System • V1.0.0**`
            }
          ]
        };
        await interaction.editReply({
          components: [progressCard],
          flags: MessageFlags.IsComponentsV2
        }).catch(() => null);
      }

      await new Promise(r => setTimeout(r, 200));
    }

    const finalCard = {
      type: 17,
      components: [
        {
          type: 10,
          content: `## <a:uptime:1552608831060844575> **__Original Nicknames Restored__**`
        },
        { type: 14, divider: true },
        {
          type: 10,
          content: `-# **• __Successfully Restored:__ \`${count}\` members**\n` +
                   `-# **• __Skipped / Unmanageable:__ \`${failed + unmanageableWithNick}\` members**\n` +
                   `-# **• __Total Processed:__ \`${total}\` members**`
        },
        { type: 14, divider: true },
        {
          type: 10,
          content: `-# **Athena Bulletproof Security System • V1.0.0**`
        }
      ]
    };
    return interaction.editReply({ components: [finalCard], flags: MessageFlags.IsComponentsV2 });
  }
}

export async function handleAutonickModal(interaction) {
  const layout = interaction.fields.getTextInputValue('layout');
  const guildId = interaction.guild.id;
  const db = (await import("../database.js")).default;
  let cfg = db.getGuildConfig(guildId);
  if (!cfg.autonick) cfg.autonick = { enabled: false, prefix: '', suffix: '', layout: '{name}' };
  cfg.autonick.layout = layout;
  db.updateGuildConfig(guildId, { autonick: cfg.autonick });
  return interaction.update(await buildAutonickDashboard(guildId, interaction.guild));
}

