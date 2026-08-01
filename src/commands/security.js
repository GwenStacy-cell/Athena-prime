import { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } from 'discord.js';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import db from '../database.js';
import embed from '../embed.js';
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
import { StringSelectMenuBuilder } from 'discord.js';

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
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} **Usage:** \`!quarantine <@user> [duration] [reason]\`\n\nExamples: \`!qr @user 10m spam\` / \`!qr @user 1h\``)] });
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
      if (result.success) await message.reply({ embeds: [result.embed] });
      else await message.reply({ embeds: [embed.danger('Quarantine Failed', result.message)] });
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const durationStr = interaction.options.getString('duration') || '5m';
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const durationMs = parseDuration(durationStr);

      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Member not found.`)] });

      const result = await executeQuarantine(interaction.guild, target, interaction.member, reason, durationMs, interaction.client);
      if (result.success) await interaction.reply({ embeds: [result.embed] });
      else await interaction.reply({ embeds: [embed.danger('Quarantine Failed', result.message)] });
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
      if (!target) return message.reply({ embeds: [embed.warn('Usage', `${message.author} **Usage:** \`!qr <@user> [duration] [reason]\``)] });
      let remaining = args.slice(1);
      let durationMs = 5 * 60 * 1000;
      if (remaining[0] && /^[\d]+[smhd]?$/i.test(remaining[0])) {
        durationMs = parseDuration(remaining[0]);
        remaining = remaining.slice(1);
      }
      const reason = remaining.join(' ').trim() || 'No reason provided';
      const result = await executeQuarantine(message.guild, target, message.member, reason, durationMs, message.client);
      if (result.success) await message.reply({ embeds: [result.embed] });
      else await message.reply({ embeds: [embed.danger('Quarantine Failed', result.message)] });
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const durationStr = interaction.options.getString('duration') || '5m';
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const durationMs = parseDuration(durationStr);
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) return interaction.reply({ embeds: [embed.warn('Error', 'Member not found.')] });
      const result = await executeQuarantine(interaction.guild, target, interaction.member, reason, durationMs, interaction.client);
      if (result.success) await interaction.reply({ embeds: [result.embed] });
      else await interaction.reply({ embeds: [embed.danger('Quarantine Failed', result.message)] });
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
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Please mention a valid member to unquarantine.\n\n**Usage:** \`!unquarantine <@user>\``)] });
      }

      const result = await executeUnquarantine(message.guild, target, message.member);
      if (result.success) {
        await message.reply({ embeds: [result.embed] });
      } else {
        await message.reply({ embeds: [embed.danger('Unquarantine Failed', result.message)] });
      }
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!target) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Member not found.`)] });
      }

      const result = await executeUnquarantine(interaction.guild, target, interaction.member);
      if (result.success) {
        await interaction.reply({ embeds: [result.embed] });
      } else {
        await interaction.reply({ embeds: [embed.danger('Unquarantine Failed', result.message)] });
      }
    }
  },

  // --- EMERGENCY COMMANDS ---
  {
    name: 'emergency',
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
      if (statusMsg) await statusMsg.edit({ embeds: [result.embed] }).catch(()=>null);
      else await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const action = interaction.options.getString('action');
      await interaction.deferReply({ ephemeral: false }).catch(() => null);
      
      const updateProgress = async (embedData) => {
        await interaction.editReply({ embeds: [embedData] }).catch(() => null);
      };
      
      const result = await handleEmergency(interaction.guild, interaction.member, action, updateProgress);
      await interaction.editReply({ embeds: [result.embed] }).catch(() => null);
    }
  },
  {
    name: 'endemergency',
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
      if (statusMsg) await statusMsg.edit({ embeds: [result.embed] }).catch(()=>null);
      else await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      await interaction.deferReply({ ephemeral: false }).catch(() => null);
      
      const updateProgress = async (embedData) => {
        await interaction.editReply({ embeds: [embedData] }).catch(() => null);
      };
      
      const result = await handleEmergency(interaction.guild, interaction.member, 'end', updateProgress);
      await interaction.editReply({ embeds: [result.embed] }).catch(() => null);
    }
  },

  // --- LOCKDOWN COMMAND ---
  {
    name: 'lockdown',
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
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const mode = interaction.options.getString('mode');
      const result = await handleLockdown(interaction.guild, interaction.channel, interaction.member, mode);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- RAIDMODE COMMAND ---
  {
    name: 'raidmode',
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
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const mode = interaction.options.getString('status');
      const result = await handleRaidMode(interaction.guild, interaction.member, mode);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- WHITELIST COMMAND ---
  {
    name: 'whitelist',
    description: 'Manages whitelisted members who are immune to specific bot filters.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'action',
        description: 'Choose whitelist action',
        type: 3,
        required: true,
        choices: [
          { name: 'Add Member', value: 'add' },
          { name: 'Remove Member', value: 'remove' },
          { name: 'List Members', value: 'list' }
        ]
      },
      {
        name: 'user',
        description: 'Target member for add/remove actions',
        type: 6,
        required: false
      },
      {
        name: 'events',
        description: 'System to whitelist them for',
        type: 3,
        required: false,
        choices: [
          { name: 'All Systems', value: 'all' },
          { name: 'Anti-Nuke (Bans, Kicks, Channels, Roles)', value: 'antinuke' },
          { name: 'Anti-Bot (Unauthorized Bots)', value: 'antibot' },
          { name: 'Anti-Spam (Mass Messages, Bad Words)', value: 'antispam' },
          { name: 'Anti-Link (Malicious/External Links)', value: 'antilink' },
          { name: 'Anti-Invite (Discord Promos)', value: 'antiinvite' },
          { name: 'Quarantine Immunity', value: 'quarantine' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const action = args[0]?.toLowerCase();
      const target = message.mentions.members.first();
      
      if (!action || (action !== 'list' && !target)) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!whitelist add <@user> [events...]\`, \`!whitelist remove <@user> [events...]\`, or \`!whitelist list\``)] });
      }

      // Extract events from arguments (skip action and ping)
      let events = args.slice(2).map(e => e.toLowerCase().trim()).filter(e => e);
      if (events.length === 0) events = ['all'];

      const result = await handleWhitelist(message.guild, message.member, action, target?.user, events);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const action = interaction.options.getString('action');
      const targetUser = interaction.options.getUser('user');
      const eventsStr = interaction.options.getString('events');

      if (action !== 'list' && !targetUser) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Please specify a target user parameter for this action.`)] });
      }

      let events = ['all'];
      if (eventsStr) {
        events = eventsStr.split(' ').map(e => e.toLowerCase().trim()).filter(e => e);
      }

      const result = await handleWhitelist(interaction.guild, interaction.member, action, targetUser, events);
      await interaction.reply({ embeds: [result.embed] });
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
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!blacklist add <phrase>\`, \`!blacklist remove <phrase>\`, or \`!blacklist list\``)] });
      }

      const result = await handleBlacklist(message.guild, message.member, action, phrase);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const action = interaction.options.getString('action');
      const phrase = interaction.options.getString('phrase');

      if (action !== 'list' && !phrase) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Please specify a phrase parameter for this action.`)] });
      }

      const result = await handleBlacklist(interaction.guild, interaction.member, action, phrase);
      await interaction.reply({ embeds: [result.embed] });
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
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!config <antinuke|antispam|antiinvite|maxwarnings> <on|off|number>\``)] });
      }

      const result = await handleConfig(message.guild, message.member, setting, value);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const setting = interaction.options.getString('setting');
      const value = interaction.options.getString('value');

      const result = await handleConfig(interaction.guild, interaction.member, setting, value);
      await interaction.reply({ embeds: [result.embed] });
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
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!maxwarnings <number>\``)] });
      }
      const result = await handleConfig(message.guild, message.member, 'maxwarnings', value.toString());
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const value = interaction.options.getInteger('limit');
      const result = await handleConfig(interaction.guild, interaction.member, 'maxwarnings', value.toString());
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- ANTINUKE COMMAND ---
  {
    name: 'antinuke',
    description: 'Configures the Anti-Nuke protections panel with buttons.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
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
      const sub = args.join(' ').toLowerCase();

      if (sub === 'config') {
        const panel = await getAntinukeConfigPanel(message.guild);
        await message.reply({ embeds: [panel.embed], components: panel.components });
      } else {
        await message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!antinuke config\``)] });
      }
    },
    async executeSlash(interaction) {
      const sub = interaction.options.getString('subcommand');

      if (sub === 'config') {
        const panel = await getAntinukeConfigPanel(interaction.guild);
        await interaction.reply({ embeds: [panel.embed], components: panel.components });
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
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} This command is restricted to the Bot Owner and the Server Owner.`)] });
      }

      let channelId = args[0]?.replace(/[<#&>]/g, '');
      let channel = null;
      if (channelId) {
        channel = await message.guild.channels.fetch(channelId).catch(() => null);
      }
      if (!channel) {
        channel = message.mentions.channels.filter(c => c.type === ChannelType.GuildVoice).first();
      }
      if (!channel && args[0]) {
        channel = message.guild.channels.cache.find(c => c.name.toLowerCase() === args.join(' ').toLowerCase() && c.type === ChannelType.GuildVoice);
      }
      if (!channel) {
        channel = message.member?.voice?.channel;
      }

      if (!channel || channel.type !== ChannelType.GuildVoice) {
        return message.reply({ embeds: [embed.warn('Setup Error', `${message.author} Please mention a Voice Channel, specify its ID, or join a Voice Channel first.`)] });
      }

      db.updateGuildConfig(message.guild.id, { homeVcId: channel.id });
      connectToHomeVc(message.guild, channel.id);

      await message.reply({ embeds: [embed.success('Home VC Configured', `Athena Prime has set **${channel.name}** (ID: \`${channel.id}\`) as its Home Voice Channel. The bot will now join and stay there.`)] });
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} This command is restricted to the Bot Owner and the Server Owner.`)] });
      }

      const voiceChannel = interaction.options.getChannel('channel');
      let channel = voiceChannel || interaction.member?.voice?.channel;

      if (!channel || channel.type !== ChannelType.GuildVoice) {
        return interaction.reply({ embeds: [embed.warn('Setup Error', `${interaction.user} Please specify a Voice Channel or join one first.`)] });
      }

      db.updateGuildConfig(interaction.guild.id, { homeVcId: channel.id });
      connectToHomeVc(interaction.guild, channel.id);

      await interaction.reply({ embeds: [embed.success('Home VC Configured', `Athena Prime has set **${channel.name}** (ID: \`${channel.id}\`) as its Home Voice Channel. The bot will now join and stay there.`)] });
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
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} This command is restricted to the Bot Owner and the Server Owner.`)] });
      }

      db.updateGuildConfig(message.guild.id, { homeVcId: null });
      
      const { getVoiceConnection } = await import('@discordjs/voice');
      const connection = getVoiceConnection(message.guild.id);
      if (connection) connection.destroy();
      
      // Forcefully disconnect using Discord.js API to guarantee immediate leave
      await message.guild.members.me.voice.setChannel(null).catch(() => null);

      await message.reply({ embeds: [embed.success('Home VC Removed', `Athena Prime's Home Voice Channel has been unset. The bot has disconnected from voice.`)] });
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} This command is restricted to the Bot Owner and the Server Owner.`)] });
      }

      db.updateGuildConfig(interaction.guild.id, { homeVcId: null });
      
      const { getVoiceConnection } = await import('@discordjs/voice');
      const connection = getVoiceConnection(interaction.guild.id);
      if (connection) connection.destroy();
      
      // Forcefully disconnect using Discord.js API to guarantee immediate leave
      await interaction.guild.members.me.voice.setChannel(null).catch(() => null);

      await interaction.reply({ embeds: [embed.success('Home VC Removed', `Athena Prime's Home Voice Channel has been unset. The bot has disconnected from voice.`)] });
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
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author}  This command is restricted to the **Bot Owner** and **Server Owner** only. Extra Owners do not have access.`)] });
      }

      const url = args[0] || message.attachments.first()?.url;
      if (!url) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Please provide a direct image URL or attach an image.`)] });
      }

      const responseMsg = await message.reply({ embeds: [embed.info('Updating Avatar', 'Attempting to configure guild-specific member avatar...')] });

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
        await message.client.rest.patch(`/guilds/${message.guild.id}/members/@me`, {
          body: { avatar: dataUri }
        });
        await responseMsg.edit({ embeds: [embed.success('Avatar Configured', "Successfully updated the bot's server-specific avatar.")] });
      } catch (err) {
        console.error(err);
        await responseMsg.edit({ embeds: [embed.danger('Update Failed', `Could not update avatar: ${err.message}`)] });
      }
    },
    async executeSlash(interaction) {
      const allowed = isBotOwnerOrServerOwnerStrict(interaction.user.id, interaction.guild);
      if (!allowed) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user}  This command is restricted to the **Bot Owner** and **Server Owner** only. Extra Owners do not have access.`)] });
      }

      const url = interaction.options.getString('url') || interaction.options.getAttachment('image')?.url;
      if (!url) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Please provide a direct image URL or attach an image.`)] });
      }

      await interaction.deferReply();

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
        await interaction.client.rest.patch(`/guilds/${interaction.guild.id}/members/@me`, {
          body: { avatar: dataUri }
        });
        await interaction.editReply({ embeds: [embed.success('Avatar Configured', "Successfully updated the bot's server-specific avatar.")] });
      } catch (err) {
        console.error(err);
        await interaction.editReply({ embeds: [embed.danger('Update Failed', `Could not update avatar: ${err.message}`)] });
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
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author}  This command is restricted to the **Bot Owner** and **Server Owner** only. Extra Owners do not have access.`)] });
      }

      const url = args[0] || message.attachments.first()?.url;
      if (!url) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Please provide a direct image URL or attach an image.`)] });
      }

      const responseMsg = await message.reply({ embeds: [embed.info('Updating Banner', 'Attempting to configure guild-specific member banner...')] });

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
        await message.client.rest.patch(`/guilds/${message.guild.id}/members/@me`, {
          body: { banner: dataUri }
        });
        await responseMsg.edit({ embeds: [embed.success('Banner Configured', "Successfully updated the bot's server-specific banner.")] });
      } catch (err) {
        console.error(err);
        await responseMsg.edit({ embeds: [embed.danger('Update Failed', `Could not update banner: ${err.message}`)] });
      }
    },
    async executeSlash(interaction) {
      const allowed = isBotOwnerOrServerOwnerStrict(interaction.user.id, interaction.guild);
      if (!allowed) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user}  This command is restricted to the **Bot Owner** and **Server Owner** only. Extra Owners do not have access.`)] });
      }

      const url = interaction.options.getString('url') || interaction.options.getAttachment('image')?.url;
      if (!url) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Please provide a direct image URL or attach an image.`)] });
      }

      await interaction.deferReply();

      try {
        const { buffer, contentType } = await getImageBuffer(url);
        const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
        await interaction.client.rest.patch(`/guilds/${interaction.guild.id}/members/@me`, {
          body: { banner: dataUri }
        });
        await interaction.editReply({ embeds: [embed.success('Banner Configured', "Successfully updated the bot's server-specific banner.")] });
      } catch (err) {
        console.error(err);
        await interaction.editReply({ embeds: [embed.danger('Update Failed', `Could not update banner: ${err.message}`)] });
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
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} Only the **Bot Owner** and **Server Owner** can manage extra owners.`)] });
      }

      const action = args[0]?.toLowerCase();
      let targetUser = message.mentions.users.first();
      
      if (!targetUser && args[1]) {
        targetUser = await message.client.users.fetch(args[1]).catch(() => null);
      }

      if (!action || (action !== 'list' && !targetUser)) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!extraowner add <@user|ID>\`, \`!extraowner remove <@user|ID>\`, or \`!extraowner list\``)] });
      }

      const result = await handleExtraOwner(message.guild, message.member, action, targetUser);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} Only the **Bot Owner** and **Server Owner** can manage extra owners.`)] });
      }

      const action = interaction.options.getString('action');
      const targetUser = interaction.options.getUser('user');

      if (action !== 'list' && !targetUser) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Please specify a target user for this action.`)] });
      }

      const result = await handleExtraOwner(interaction.guild, interaction.member, action, targetUser);
      await interaction.reply({ embeds: [result.embed] });
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
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} Only the **Bot Owner** can manage the global bot blacklist.`)] });
      }

      const action = args[0]?.toLowerCase();
      let targetId = args[1]?.replace(/[<@!>]/g, '');

      if (!action || (action !== 'list' && !targetId)) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!userblacklist add <ID>\`, \`!userblacklist remove <ID>\`, or \`!userblacklist list\``)] });
      }

      const result = await handleBotBlacklist(action, targetId);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} Only the **Bot Owner** can manage the global bot blacklist.`)] });
      }

      const action = interaction.options.getString('action');
      let targetId = interaction.options.getString('user_id')?.replace(/[<@!>]/g, '');

      if (action !== 'list' && !targetId) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Please specify a target user ID.`)] });
      }

      const result = await handleBotBlacklist(action, targetId);
      await interaction.reply({ embeds: [result.embed] });
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
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} Only the **Bot Owner** and **Server Owner** can manage the bot whitelist.`)] });
      }
      const action = args[0]?.toLowerCase();
      const botId = args[1];
      if (!action || (action !== 'list' && !botId)) {
        return message.reply({ embeds: [embed.warn('Usage', `${message.author} \`!botwhitelist add <botId>\`, \`!botwhitelist remove <botId>\`, or \`!botwhitelist list\``)] });
      }
      const result = await handleBotWhitelist(message.guild, action, botId);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} Only the **Bot Owner** and **Server Owner** can manage the bot whitelist.`)] });
      }
      const action = interaction.options.getString('action');
      const botId = interaction.options.getString('bot_id');
      if (action !== 'list' && !botId) {
        return interaction.reply({ embeds: [embed.warn('Error', `${interaction.user} Please provide the bot's User ID.`)] });
      }
      const result = await handleBotWhitelist(interaction.guild, action, botId);
      await interaction.reply({ embeds: [result.embed] });
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
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!antilink <on|off>\``)] });
      }
      const result = await handleAntiLink(message.guild, message.member, mode);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const mode = interaction.options.getString('status');
      const result = await handleAntiLink(interaction.guild, interaction.member, mode);
      await interaction.reply({ embeds: [result.embed] });
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
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const result = await getServerInfoEmbed(interaction.guild);
      await interaction.reply({ embeds: [result.embed] });
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
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!target) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Member not found.`)] });
      }

      const result = await getUserInfoEmbed(interaction.guild, target);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- SECURITY COMMAND --- Enable/Disable ALL shields at once
  {
    name: 'security',
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
          { name: 'Disable All Security', value: 'disable_all' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const allowed = isBotOwnerSync(message.author.id) || message.author.id === message.guild.ownerId;
      if (!allowed) {
        return message.reply({ embeds: [embed.danger('Access Denied', ' Only the **Bot Owner** or **Server Owner** can use this command.')] });
      }
      const sub = args.join(' ').toLowerCase().trim();
      const enable = (sub === 'enable all' || sub === 'enable_all');
      const disable = (sub === 'disable all' || sub === 'disable_all');
      if (!enable && !disable) {
        return message.reply({ embeds: [embed.warn('Usage', `${message.author} Usage: \`!security enable all\` or \`!security disable all\``)] });
      }

      if (enable) {
        const msg = await message.reply({ embeds: [embed.info('Security Initialization', '<:on:1514996865030946847> **Initializing Security Protocols...**')] });
        await runSecurityEnableSequence(message.guild, async (e) => {
          await msg.edit({ embeds: [e] }).catch(() => null);
        });
      } else {
        const result = await handleSecurityToggleAll(message.guild, message.member, false);
        await message.reply({ embeds: [result.embed] });
      }
    },
    async executeSlash(interaction) {
      const allowed = isBotOwnerSync(interaction.user.id) || interaction.user.id === interaction.guild.ownerId;
      if (!allowed) {
        return interaction.reply({ embeds: [embed.danger('Access Denied', ' Only the **Bot Owner** or **Server Owner** can use this command.')] });
      }
      const action = interaction.options.getString('action');
      const enable = action === 'enable_all';

      if (enable) {
        await interaction.reply({ embeds: [embed.info('Security Initialization', '<:on:1514996865030946847> **Initializing Security Protocols...**')] });
        await runSecurityEnableSequence(interaction.guild, async (e) => {
          await interaction.editReply({ embeds: [e] }).catch(() => null);
        });
      } else {
        const result = await handleSecurityToggleAll(interaction.guild, interaction.member, false);
        await interaction.reply({ embeds: [result.embed] });
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
      if (!action) return message.reply({ embeds: [embed.warn('Usage', 'Usage: `!qrmanager setup|setrole|setchannel|setvc|status`')] });
      
      let role = message.mentions.roles.first() || null;
      let channel = message.mentions.channels.first() || null;
      
      if (!role && args[1] && action === 'setrole') {
        role = await message.guild.roles.fetch(args[1]).catch(() => null);
      }
      if (!channel && args[1] && (action === 'setchannel' || action === 'setvc')) {
        channel = await message.guild.channels.fetch(args[1]).catch(() => null);
      }
      
      const result = await handleQrManager(message.guild, message.member, action, role, channel);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      await interaction.deferReply();
      const action = interaction.options.getString('action');
      const role = interaction.options.getRole('role');
      const channel = interaction.options.getChannel('channel');
      const result = await handleQrManager(interaction.guild, interaction.member, action, role, channel);
      await interaction.editReply({ embeds: [result.embed] });
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
        return message.reply({ embeds: [embed.warn('Usage',
          `${message.author} \`!linksallow add <domain>\` / \`!linksallow remove <domain>\` / \`!linksallow list\` / \`!linksallow allowall\` / \`!linksallow disallowall\``
        )] });
      }
      const result = await handleLinksAllow(message.guild, action, domain);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const action = interaction.options.getString('action');
      const domain = interaction.options.getString('domain');
      const nodomainActions = ['list', 'allowall', 'disallowall'];
      if (!nodomainActions.includes(action) && !domain) {
        return interaction.reply({ embeds: [embed.warn('Missing Domain', 'Please provide a domain name.')] });
      }
      const result = await handleLinksAllow(interaction.guild, action, domain);
      await interaction.reply({ embeds: [result.embed] });
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
        return message.reply({ embeds: [embed.warn('Usage', `${message.author} Usage: \`!massquarantine <@role> [reason]\``)] });
      }
      const reason = args.slice(1).join(' ').trim() || 'Mass quarantine by administrator';
      const statusMsg = await message.reply({ embeds: [embed.info('Mass Quarantine Started', ` Quarantining all members with role <@&${role.id}>...`)] });
      const result = await handleMassQuarantine(message.guild, message.member, role, reason);
      await statusMsg.edit({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      await interaction.deferReply();
      const role = interaction.options.getRole('role');
      const reason = interaction.options.getString('reason') || 'Mass quarantine by administrator';
      const result = await handleMassQuarantine(interaction.guild, interaction.member, role, reason);
      await interaction.editReply({ embeds: [result.embed] });
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
      const statusMsg = await message.reply({ embeds: [embed.info('Mass Unquarantine Started', ' Releasing all quarantined members...')] });
      const result = await handleMassUnquarantine(message.guild, message.member, message.client);
      await statusMsg.edit({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      await interaction.deferReply();
      const result = await handleMassUnquarantine(interaction.guild, interaction.member, interaction.client);
      await interaction.editReply({ embeds: [result.embed] });
    }
  },

  // --- SCAN SERVER COMMAND ---
  {
    name: 'scanserver',
    description: 'Scan the server for unauthorized bots and manage them.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    async executePrefix(message) {
      if (!isBotOwnerOrServerOwnerStrict(message.author.id, message.guild) && !isExtraOwner(message.guild.id, message.author.id)) {
        return message.reply({ embeds: [embed.danger('Permission Denied', 'Only Server Owners and Extra Owners can scan the server.')] });
      }
      const result = await handleScanServer(message.guild);
      await message.reply(result);
    }
  },
  // --- LOCK APPS COMMAND ---
  {
    name: 'lockapps',
    description: 'Lock or unlock application commands for @everyone server-wide.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    async executePrefix(message, args) {
      if (!isBotOwnerOrServerOwnerStrict(message.author.id, message.guild) && !isExtraOwner(message.guild.id, message.author.id)) {
        return message.reply({ embeds: [embed.danger('Permission Denied', 'Only Server Owners and Extra Owners can lock apps.')] });
      }
      const mode = args[0]?.toLowerCase();
      if (mode !== 'on' && mode !== 'off') {
        return message.reply({ embeds: [embed.warn('Invalid Usage', 'Usage: `!lockapps on` or `!lockapps off`')] });
      }
      const statusMsg = await message.reply({ embeds: [embed.info('Updating Channels', 'Processing permissions for all channels. This may take a moment...')] });
      
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
        await statusMsg.edit({ embeds: [embed.success('Apps Unlocked', `Successfully unlocked application commands in ${successCount} channels for @everyone.`)] });
      } else {
        await statusMsg.edit({ embeds: [embed.success('Apps Locked', `Successfully locked application commands in ${successCount} channels for @everyone.`)] });
      }
    }
  },
  // --- UNLOCK APPS COMMAND ---
  {
    name: 'unlockapps',
    description: 'Unlock application commands for @everyone server-wide.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    async executePrefix(message, args) {
      if (!isBotOwnerOrServerOwnerStrict(message.author.id, message.guild) && !isExtraOwner(message.guild.id, message.author.id)) {
        return message.reply({ embeds: [embed.danger('Permission Denied', 'Only Server Owners and Extra Owners can unlock apps.')] });
      }
      const statusMsg = await message.reply({ embeds: [embed.info('Updating Channels', 'Processing permissions for all channels. This may take a moment...')] });
      
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
      
      await statusMsg.edit({ embeds: [embed.success('Apps Unlocked', `Successfully unlocked application commands in ${successCount} channels for @everyone.`)] });
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
  // Owner immunity check
  if (isBotOwnerSync(targetMember.id) || isExtraOwner(guild.id, targetMember.id)) {
    return { success: false, message: ' This user is protected by **Athena Prime** and cannot be quarantined.' };
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
    const dmEmbed = embed.danger(
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
    const welcomeEmbed = embed.danger(
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
    logToSecurityChannel(guild, embed.log(
      'Quarantine Applied',
      `Member has been isolated.`,
      [
        { name: 'Target', value: `${targetMember.user.tag} (${targetMember.id})`, inline: true },
        { name: 'Enforcer', value: `${moderator.user?.tag || 'System'}`, inline: true },
        { name: 'Reason', value: reason }
      ],
      'danger'
    ));



    const responseEmbed = embed.danger(
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
      dmEmbed = embed.success(
        'Raid Mode Ended',
        `<:emoji_16:1521464002046328944> The server Lockdown/Raid Mode in **${guild.name}** has been lifted!\nYour original access privileges have been fully restored.`,
        []
      );
    } else {
      dmEmbed = embed.success(
        'Isolation Terminated',
        `<a:alert1:1521456941858029720> Your quarantine status has been lifted in **${guild.name}**! Your original access privileges have been fully restored.`,
        []
      );
    }
    await targetMember.send({ embeds: [dmEmbed] }).catch(() => null);

    // Log the event
    if (context === 'auto') {
      logToSecurityChannel(guild, embed.info(
        'Auto-Unquarantine',
        `<@${targetMember.id}>'s quarantine duration expired — automatically released.`
      ));
    } else {
      logToSecurityChannel(guild, embed.log(
        'Quarantine Lifted',
        `Member has been restored.`,
        [
          { name: 'Target', value: `${targetMember.user.tag} (${targetMember.id})`, inline: true },
          { name: 'Moderator', value: `${moderator.user?.tag || 'System'}`, inline: true }
        ],
        'success'
      ));
    }

    const responseEmbed = embed.success(
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
    return { embed: embed.danger('Access Denied', 'Only the Server Owner and Bot Owners can trigger Emergency Mode. Extra Owners are not authorized to use this command.') };
  }

  const botMember = await guild.members.fetch(guild.client.user.id);
  const botHighestRolePosition = botMember.roles.highest.position;

  if (action === 'mode') {
    const currentState = db.getEmergencyState(guild.id);
    if (currentState) {
      return { embed: embed.warn('Emergency Active', 'Emergency Mode is already active.') };
    }

    if (updateProgress) await updateProgress(embed.warn('Emergency Protocol Initiated', 'Calculating role and channel overwrites...'));

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
        if (cCount % 15 === 0 && updateProgress) updateProgress(embed.warn('Emergency Protocol Initiated', `Hiding channels: **${cCount} / ${channelsToModify.length}** processed...`)).catch(()=>null);
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
        if (rCount % 10 === 0 && updateProgress) updateProgress(embed.warn('Emergency Protocol Initiated', `Stripping permissions: **${rCount} / ${rolesToModify.length}** processed...`)).catch(()=>null);
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

    logToSecurityChannel(guild, embed.log('Emergency Mode Activated', `**${moderator.user.tag}** has triggered Emergency Mode! All roles below the bot have been stripped of permissions and channels are hidden.`, [], 'danger'));

    try {
      const owner = await guild.members.fetch(guild.ownerId);
      if (owner) {
        owner.send({ embeds: [embed.danger('SERVER EMERGENCY ACTIVATED', `**${moderator.user.tag}** has triggered Emergency Mode in **${guild.name}**.\n\nAll permissions have been stripped and channels hidden to contain the threat. To restore normal operations, use \`!end emergency\`.`)] }).catch(() => null);
      }
    } catch(e) {}

    let errorWarning = '';
    if (rErrors > 0 || cErrors > 0) {
      errorWarning = `\n\n<a:alert1:1521456941858029720> **WARNING:** Failed to modify ${rErrors} roles and ${cErrors} channels. (Note: Discord prevents bots from hiding Community Default/Onboarding channels). Ensure the bot's role is placed at the top and has Administrator privileges.`;
    }

    return { embed: embed.danger('EMERGENCY MODE ACTIVATED', `All channels have been hidden and all permissions have been stripped from roles. Use \`!end emergency\` or \`/endemergency\` to restore the server.${errorWarning}`) };

  } else if (action === 'end') {
    const savedState = db.getEmergencyState(guild.id);
    if (!savedState) {
      return { embed: embed.info('No Emergency', 'Emergency Mode is not currently active on this server.') };
    }

    if (updateProgress) await updateProgress(embed.info('Restoring Server', 'Calculating original role and channel states...'));

    let rolesRestored = 0;
    let rErrors = 0;
    for (const roleData of savedState.roles) {
      const role = guild.roles.cache.get(roleData.id);
      if (role) {
        try {
          await role.setPermissions(BigInt(roleData.perms), `Emergency Mode ended by ${moderator.user.tag}`);
          rolesRestored++;
          if (rolesRestored % 10 === 0 && updateProgress) await updateProgress(embed.info('Restoring Server', `Restoring permissions: **${rolesRestored} / ${savedState.roles.length}** processed...`)).catch(()=>null);
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
          if (channelsRestored % 10 === 0 && updateProgress) await updateProgress(embed.info('Restoring Server', `Restoring channels: **${channelsRestored} / ${savedState.channels.length}** processed...`)).catch(()=>null);
        } catch(e) {
          cErrors++;
          console.error(`Failed to restore channel ${channel.id}`, e);
        }
      }
    }

    db.clearEmergencyState(guild.id);

    logToSecurityChannel(guild, embed.log('Emergency Mode Ended', `**${moderator.user.tag}** has ended Emergency Mode. Restored ${rolesRestored} roles and ${channelsRestored} channels.`, [], 'success'));

    try {
      const owner = await guild.members.fetch(guild.ownerId);
      if (owner) {
        owner.send({ embeds: [embed.success('EMERGENCY RESOLVED', `**${moderator.user.tag}** has ended Emergency Mode in **${guild.name}**.\n\nAll permissions and channel visibilities have been fully restored.`)] }).catch(() => null);
      }
    } catch(e) {}

    let errorWarning = '';
    if (rErrors > 0 || cErrors > 0) {
      errorWarning = `\n\n<a:alert1:1521456941858029720> **WARNING:** Failed to restore ${rErrors} roles and ${cErrors} channels. You may need to fix them manually.`;
    }

    return { embed: embed.success('Emergency Mode Ended', `All permissions and channel visibilities have been restored.${errorWarning}`) };
  }
}

// ==========================================

async function handleLockdown(guild, channel, moderator, mode) {
  try {
    if (mode === 'on') {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false
      });
      const lockEmbed = embed.danger(
        'Lockdown Activated', 
        `� This channel has been placed under administrative lockdown by **${moderator.user.tag}**. Writing has been disabled.`
      );
      logToSecurityChannel(guild, embed.log('Channel Locked', `Moderator **${moderator.user.tag}** locked down channel **#${channel.name}**.`, [], 'warning'));
      return { embed: lockEmbed };
    } else {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null
      });
      const unlockEmbed = embed.success(
        'Lockdown Deactivated', 
        `� Channel lockdown has been lifted by **${moderator.user.tag}**. Permission to write has been restored.`
      );
      logToSecurityChannel(guild, embed.log('Channel Unlocked', `Moderator **${moderator.user.tag}** unlocked channel **#${channel.name}**.`, [], 'success'));
      return { embed: unlockEmbed };
    }
  } catch (error) {
    console.error(error);
    return { embed: embed.danger('Lockdown Toggle Failed', 'Could not modify permissions for this channel.') };
  }
}

async function handleRaidMode(guild, moderator, mode) {
  const enabled = mode === 'on';
  db.updateGuildConfig(guild.id, { raidMode: enabled });

  if (enabled) {
    const resEmbed = embed.raid(
      'Raid Mode Engaged',
      `<a:alert1:1521456941858029720> **Server Raid Protection is now ACTIVE.**\nAll joining accounts will be automatically quarantined immediately to protect the server until deactivated.`,
      [{ name: 'Enforced by', value: `${moderator}` }]
    );
    logToSecurityChannel(guild, embed.log('Raid Mode Active', `Administrator **${moderator.user.tag}** turned ON Guild Raid Mode.`, [], 'raid'));
    return { embed: resEmbed };
  } else {
    // Automatically mass unquarantine everyone caught in the raid
    const unquarantineResult = await handleMassUnquarantine(guild, moderator, guild.client, 'raidmode');
    
    let releaseNote = '';
    if (unquarantineResult.embed.data.title !== 'Nothing to Release') {
       releaseNote = `\n\n**Auto-Release Triggered:**\n${unquarantineResult.embed.data.description}`;
    } else {
       releaseNote = `\n\n*(No quarantined accounts to release)*`;
    }

    const resEmbed = embed.success(
      'Raid Mode Disengaged',
      ` **Server Raid Protection is now OFF.**\nNew accounts can join normally.${releaseNote}`,
      [{ name: 'Lifted by', value: `${moderator}` }]
    );
    logToSecurityChannel(guild, embed.log(
      'Raid Mode Off', 
      `Administrator **${moderator.user.tag}** turned OFF Guild Raid Mode.`, 
      [], 
      'success'
    ));
    return { embed: resEmbed };
  }
}

async function handleWhitelist(guild, moderator, action, targetUser, events = ['all']) {
  const allowedEvents = ['all', 'antinuke', 'antibot', 'antispam', 'antilink', 'antiinvite', 'quarantine'];
  const invalidEvents = events.filter(e => !allowedEvents.includes(e));

  if (invalidEvents.length > 0 && action !== 'list') {
    return { embed: embed.warn('Invalid Events', `The following events are not recognized: \`${invalidEvents.join(', ')}\`\n\n**Allowed Events:** \`${allowedEvents.join(', ')}\``) };
  }

  if (action === 'add') {
    const success = db.addWhitelist(guild.id, targetUser.id, events);
    if (success) {
      logToSecurityChannel(guild, embed.log('Whitelist Added', `Administrator **${moderator.user.tag}** granted **${targetUser.tag}** immunity to: \`${events.join(', ')}\``, [], 'success'));
      return { embed: embed.success('Whitelist Added', `Successfully whitelisted **${targetUser.tag}** for: \`${events.join(', ')}\`\nThey are now immune to those filters.`) };
    } else {
      return { embed: embed.info('Already Whitelisted', `**${targetUser.tag}** already has those exact whitelisted events.`) };
    }
  } else if (action === 'remove') {
    const success = db.removeWhitelist(guild.id, targetUser.id, events);
    if (success) {
      logToSecurityChannel(guild, embed.log('Whitelist Removed', `Administrator **${moderator.user.tag}** removed whitelist from **${targetUser.tag}** for: \`${events.join(', ')}\``, [], 'warning'));
      return { embed: embed.success('Whitelist Removed', `Successfully removed **${targetUser.tag}** from the whitelist for: \`${events.join(', ')}\``) };
    } else {
      return { embed: embed.warn('Not Whitelisted', `**${targetUser.tag}** is not whitelisted for those events.`) };
    }
  } else {
    const config = db.getGuildConfig(guild.id);
    const wlMap = config.whitelist || {};
    const userIds = Object.keys(wlMap);

    if (userIds.length === 0) {
      return { embed: embed.info('Whitelist Empty', `There are no custom whitelisted members in this guild. The owner <@${guild.ownerId}> is always immune.`) };
    }
    
    let formattedList = userIds.map(id => {
      const evs = wlMap[id].join(', ');
      return `• <@${id}> (ID: \`${id}\`) — **Events:** \`${evs}\``;
    }).join('\n');
    
    return { embed: embed.info(' Security Whitelist', `Whitelisted users immune to specific Auto-Mod and Firewall filters:\n\n**Server Owner (Always Immune):** <@${guild.ownerId}>\n\n**Custom Whitelist:**\n${formattedList}`) };
  }
}

async function handleBlacklist(guild, moderator, action, phrase) {
  if (action === 'add') {
    const success = db.addBlacklistWord(guild.id, phrase);
    if (success) {
      logToSecurityChannel(guild, embed.log('Word Filter Added', `Moderator **${moderator.user.tag}** blacklisted phrase: "${phrase}".`, [], 'warning'));
      return { embed: embed.success('Word Blacklisted', `Successfully blacklisted term **"${phrase.toLowerCase()}"**. Messages matching this phrase will be deleted.`) };
    } else {
      return { embed: embed.info('Already Blacklisted', `Term **"${phrase.toLowerCase()}"** is already blacklisted.`) };
    }
  } else if (action === 'remove') {
    const success = db.removeBlacklistWord(guild.id, phrase);
    if (success) {
      logToSecurityChannel(guild, embed.log('Word Filter Removed', `Moderator **${moderator.user.tag}** un-blacklisted phrase: "${phrase}".`, [], 'success'));
      return { embed: embed.success('Word Un-blacklisted', `Successfully removed **"${phrase.toLowerCase()}"** from word blacklist.`) };
    } else {
      return { embed: embed.warn('Not Blacklisted', `Term **"${phrase.toLowerCase()}"** is not currently blacklisted.`) };
    }
  } else {
    const config = db.getGuildConfig(guild.id);
    const list = config.blacklistWords || [];
    if (list.length === 0) {
      return { embed: embed.success('Blacklist Empty', 'There are no active blacklisted words in this server.') };
    }
    const formattedWords = list.map(w => `• \`${w}\``).join('\n');
    return { embed: embed.info('Filtered Word Blacklist', `If a non-moderator sends a message matching any of these terms, it will be deleted immediately:\n\n${formattedWords}`) };
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
      return { embed: embed.warn('Invalid Setting', 'Maximum warnings must be a number between 1 and 10.') };
    }
    updates.maxWarnings = num;
    db.updateGuildConfig(guild.id, updates);

    logToSecurityChannel(guild, embed.log('Config Updated', `Administrator **${moderator.user.tag}** set maxWarnings to **${num}**.`, [], 'success'));
    return { embed: embed.success('Warnings Limit Updated', 
      `Exceeding **${num} Warnings** will now result in an automated server quarantine.\n\n` +
      `**Factors that apply Warnings:**\n` +
      `- Usage of Blacklisted Words\n` +
      `- Chat Spam or Mass Mentions (Anti-Spam)\n` +
      `- Sending External Links (Anti-Link)\n` +
      `- Sending Discord Invites (Anti-Invite)\n` +
      `- Manual warnings via the \`/warn\` command\n\n` +
      `> **Zero-Tolerance Actions:** Critical server damage like deleting/creating channels, roles, emojis, or adding unauthorized bots will completely bypass this warning system and result in an **instant ban**.`
    ) };
  }

  if (value !== 'on' && value !== 'off') {
    return { embed: embed.warn('Invalid Value', 'Value for toggles must be either `on` or `off` (e.g. `!config antispam off`).') };
  }

  const enabled = value === 'on';

  if (setting === 'antinuke') {
    updates.antiNukeEnabled = enabled;
    db.updateGuildConfig(guild.id, updates);
    const modeDesc = enabled ? `${TOGGLE_ON} ACTIVE (Rapid deletions or bans trigger instant quarantine)` : `${TOGGLE_OFF} DEACTIVATED`;
    logToSecurityChannel(guild, embed.log('Config Anti-Nuke Toggle', `Administrator **${moderator.user.tag}** toggled Anti-Nuke to **${value.toUpperCase()}**.`, [], enabled ? 'success' : 'warning'));
    
    if (enabled) {
      setupDashboardChannel(guild, guild.client);
    }
    
    return { embed: embed.success('Anti-Nuke Configured', `Anti-Nuke server protections are now **${modeDesc}**.`) };
  } else if (setting === 'antispam') {
    updates.antiSpamEnabled = enabled;
    db.updateGuildConfig(guild.id, updates);
    const modeDesc = enabled ? `${TOGGLE_ON} ACTIVE` : `${TOGGLE_OFF} DEACTIVATED`;
    logToSecurityChannel(guild, embed.log('Config Anti-Spam Toggle', `Administrator **${moderator.user.tag}** toggled Anti-Spam to **${value.toUpperCase()}**.`, [], enabled ? 'success' : 'warning'));
    return { embed: embed.success('Anti-Spam Configured', `Automated rate-limit filters are now **${modeDesc}**.`) };
  } else if (setting === 'antiinvite') {
    updates.antiInviteEnabled = enabled;
    db.updateGuildConfig(guild.id, updates);
    const modeDesc = enabled ? `${TOGGLE_ON} ACTIVE` : `${TOGGLE_OFF} DEACTIVATED`;
    logToSecurityChannel(guild, embed.log('Config Anti-Invite Toggle', `Administrator **${moderator.user.tag}** toggled Anti-Invite to **${value.toUpperCase()}**.`, [], enabled ? 'success' : 'warning'));
    return { embed: embed.success('Anti-Invite Configured', `Discord invite link auto-mod is now **${modeDesc}**.`) };
  }

  return { embed: embed.warn('Config Error', 'Unknown configuration option.') };
}

export async function getAntinukeConfigPanel(guild) {
  const config = db.getGuildConfig(guild.id);

  const blacklistState = config.blacklistWords && config.blacklistWords.length > 0;
  const spamState = config.antiSpamEnabled;
  const inviteState = config.antiInviteEnabled !== false;
  const nukeState = config.antiNukeEnabled;

  const fields = [
    { name: 'Anti-Nuke Shield',      value: nukeState     ? `${TOGGLE_ON} **ENABLED**`                          : `${TOGGLE_OFF} **DISABLED**`,                 inline: true },
    { name: 'Anti-Spam Filter',      value: spamState     ? `${TOGGLE_ON} **ENABLED**`                          : `${TOGGLE_OFF} **DISABLED**`,                 inline: true },
    { name: 'Anti-Invite Blocker', value: inviteState   ? `${TOGGLE_ON} **ENABLED**`                          : `${TOGGLE_OFF} **DISABLED**`,                 inline: true },
    { name: 'Word Filter (Swears)',  value: blacklistState ? `${TOGGLE_ON} **ENABLED** (${config.blacklistWords.length} Words)` : `${TOGGLE_OFF} **DISABLED**`, inline: true },
    { name: 'Nuke Punishment',     value: `\`${config.antiNukePunishment.toUpperCase()}\``,                                                              inline: true },
    { name: 'Warning Ceiling',      value: `\`${config.maxWarnings} Warnings\``,                                                                              inline: true }
  ];

  const panelEmbed = embed.info(
    'Athena Prime Defense Panel',
    'Administrators can click the button switches below to toggle active protections dynamically.',
    fields
  );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_antinuke')
      .setLabel(`Anti-Nuke ${nukeState ? 'ON' : 'OFF'}`)
      .setEmoji(nukeState ? { id: '1514996865030946847', name: 'on' } : { id: '1514996861474177109', name: 'off' })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('toggle_spam')
      .setLabel(`Anti-Spam ${spamState ? 'ON' : 'OFF'}`)
      .setEmoji(spamState ? { id: '1514996865030946847', name: 'on' } : { id: '1514996861474177109', name: 'off' })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('toggle_invite')
      .setLabel(`Anti-Invite ${inviteState ? 'ON' : 'OFF'}`)
      .setEmoji(inviteState ? { id: '1514996865030946847', name: 'on' } : { id: '1514996861474177109', name: 'off' })
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_blacklist_filter')
      .setLabel(`Word Filter ${blacklistState ? 'ON' : 'OFF'}`)
      .setEmoji(blacklistState ? { id: '1514996865030946847', name: 'on' } : { id: '1514996861474177109', name: 'off' })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('cycle_punishment')
      .setLabel(`Punishment: ${config.antiNukePunishment.toUpperCase()}`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('save_panel')
      .setLabel('Save & Enforce')
      .setStyle(ButtonStyle.Success)
  );

  return { embed: panelEmbed, components: [row1, row2] };
}

export async function handleAntinukeToggleAll(guild, moderator, enable) {
  // NOTE: autonick is intentionally NOT touched — it must be enabled manually by server owner
  const updates = {
    antiNukeEnabled:   enable,
    antiSpamEnabled:   enable,
    antiInviteEnabled: enable,
    antiLinkEnabled:   enable
  };

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
    ? embed.success(
        '<:on:1514996865030946847> All Systems Locked and Operational',
        `<:on:1514996865030946847> **Primary Role:** Athena Integration Enabled
<:on:1514996865030946847> **Secondary Role:** Athena Firewall Activated
<:on:1514996865030946847> **Hidden Role:** Athena Unbypassable Deployed

*Athena Prime has deployed a triple-layer security architecture. If an unauthorized user attempts to disturb, delete, or strip permissions from any of my Primary, Secondary, or Hidden roles, Athena will instantly execute a Hostile Neutralization to safeguard the server and automatically restore its own permissions. This makes Athena Prime truly unbypassable.*

*(Use \'antinuke config\' or individual commands to fine-tune)*`,
        [
          { name: ' Anti-Nuke',  value: `${TOGGLE_ON} ON`, inline: true },
          { name: ' Anti-Spam',  value: `${TOGGLE_ON} ON`, inline: true },
          { name: '� Anti-Invite', value: `${TOGGLE_ON} ON`, inline: true },
          { name: '� Anti-Link',  value: `${TOGGLE_ON} ON`, inline: true },
          { name: '� Word Filter', value: `${TOGGLE_ON} ON`, inline: true },
          { name: 'Enforced by', value: `${moderator}`, inline: true }
        ]
      )
    : embed.warn(
        'All Security Shields DISENGAGED',
        ` Athena Prime protective filters have been **DEACTIVATED** server-wide.`,
        [{ name: 'Lifted by', value: `${moderator}` }]
      );

  logToSecurityChannel(guild, embed.log(
    'Toggle All Security',
    `Administrator **${moderator.user.tag}** toggled all shields **${enable ? 'ON' : 'OFF'}**.`,
    [],
    enable ? 'success' : 'warning'
  ));

  return { embed: resEmbed };
}

// ==========================================
// NEW COMMAND HANDLERS
// ==========================================

async function handleExtraOwner(guild, moderator, action, targetUser) {
  if (action === 'add') {
    if (!targetUser) return { embed: embed.warn('Missing User', 'Please specify a user to add as extra owner.') };
    
    const success = db.addExtraOwner(guild.id, targetUser.id);
    if (success) {
      logToSecurityChannel(guild, embed.log('Extra Owner Added', `**${moderator.user.tag}** added **${targetUser.tag}** as an Extra Owner.`, [], 'success'));
      return { embed: embed.owner('Extra Owner Added', `Successfully added **${targetUser.tag}** as an **Extra Owner**.\n\nThey are now:\n• __**Immune**__ to all moderation actions\n• __**Authorized**__ to use all bot commands\n• __**Whitelisted**__ from all auto-mod filters`) };
    } else {
      return { embed: embed.info('Already Extra Owner', `**${targetUser.tag}** is already registered as an Extra Owner.`) };
    }
  } else if (action === 'remove') {
    if (!targetUser) return { embed: embed.warn('Missing User', 'Please specify a user to remove from extra owners.') };
    
    const success = db.removeExtraOwner(guild.id, targetUser.id);
    if (success) {
      logToSecurityChannel(guild, embed.log('Extra Owner Removed', `**${moderator.user.tag}** removed **${targetUser.tag}** from Extra Owners.`, [], 'warning'));
      return { embed: embed.success('Extra Owner Removed', `Successfully removed **${targetUser.tag}** from Extra Owners. They no longer have owner-level privileges.`) };
    } else {
      return { embed: embed.warn('Not Extra Owner', `**${targetUser.tag}** is not currently an Extra Owner.`) };
    }
  } else {
    // List
    const owners = db.getExtraOwners(guild.id);
    if (owners.length === 0) {
      return { embed: embed.info('No Extra Owners', `There are no extra owners configured for this server.\n\n**Bot Owner:** <@${process.env.OWNER_ID || 'Unknown'}>\n**Server Owner:** <@${guild.ownerId}>`) };
    }

    const formattedList = owners.map(id => `• <@${id}> (ID: \`${id}\`)`).join('\n');
    return { embed: embed.owner('Extra Owners List', `**Bot Owner:** <@${process.env.OWNER_ID || 'Unknown'}>\n**Server Owner:** <@${guild.ownerId}>\n\n**Extra Owners:**\n${formattedList}`) };
  }
}

async function handleBotWhitelist(guild, action, botId) {
  const cleanId = botId ? botId.replace(/[<@&!>]/g, '') : null;
  
  if (action === 'add') {
    if (!cleanId || !/^\d{17,20}$/.test(cleanId)) return { embed: embed.warn('Invalid ID', 'Please provide a valid bot User ID or a Role mention/ID.') };
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
    
    return { embed: embed.success('Whitelisted', desc) };
  } else if (action === 'remove') {
    if (!cleanId) return { embed: embed.warn('Missing ID', 'Please provide the Bot/Role ID to remove.') };
    db.removeBotFromWhitelist(guild.id, cleanId);
    return { embed: embed.success('Removed', `ID \`${cleanId}\` has been removed from the Bot Whitelist. It no longer has Anti-Nuke immunity.`) };
  } else {
    const list = db.getBotWhitelist(guild.id);
    if (list.length === 0) return { embed: embed.info('No Whitelisted Bots/Roles', 'No bots or roles are currently whitelisted.\n\nUse `!botwhitelist add <botId/roleId>` to whitelist a trusted bot or role.') };
    
    const formatted = await Promise.all(list.map(async id => {
      const role = guild.roles.cache.get(id);
      if (role) return `• **Role:** ${role} (\`${id}\`)`;
      
      const user = await guild.client.users.fetch(id).catch(() => null);
      if (user) return `• **Bot:** ${user} (\`${id}\`)`;
      
      return `• **Unknown:** \`${id}\``;
    }));
    
    return { embed: embed.info('Whitelisted Bots & Roles', `The following entities have full Anti-Nuke immunity:\n\n${formatted.join('\n')}`) };
  }
}

async function handleBotBlacklist(action, targetId) {
  if (action === 'add') {
    if (!targetId || !/^\d{17,20}$/.test(targetId)) return { embed: embed.warn('Invalid ID', 'Please provide a valid user ID (17-20 digit number).') };
    const success = db.addUserToBotBlacklist(targetId);
    if (success) {
      return { embed: embed.success('User Flagged', `User ID \`${targetId}\` has been **flagged**.\nThey are now blacklisted and cannot use any Athena Prime commands globally.`) };
    } else {
      return { embed: embed.info('Already Flagged', `User ID \`${targetId}\` is already on the bot blacklist.`) };
    }
  } else if (action === 'remove') {
    if (!targetId || !/^\d{17,20}$/.test(targetId)) return { embed: embed.warn('Invalid ID', 'Please provide a valid user ID to unflag.') };
    const success = db.removeUserFromBotBlacklist(targetId);
    if (success) {
      return { embed: embed.success('User Unflagged', `User ID \`${targetId}\` has been **unflagged** and removed from the global bot blacklist.`) };
    } else {
      return { embed: embed.warn('Not Flagged', `User ID \`${targetId}\` is not currently flagged.`) };
    }
  } else {
    // List
    const flagged = db.getBotBlacklist();
    if (flagged.length === 0) {
      return { embed: embed.info('No Flagged Users', 'There are no users currently flagged on the global bot blacklist.') };
    }
    const formattedList = flagged.map(id => `• <@${id}> (ID: \`${id}\`)`).join('\n');
    return { embed: embed.danger('Flagged Users', `These users are globally banned from using the bot:\n\n${formattedList}`) };
  }
}

async function handleAntiLink(guild, moderator, mode) {
  const enabled = mode === 'on';
  db.updateGuildConfig(guild.id, { antiLinkEnabled: enabled });

  const modeDesc = enabled ? `${TOGGLE_ON} ACTIVE` : `${TOGGLE_OFF} DEACTIVATED`;
  const resEmbed = embed.success(
    'Anti-Link Configured',
    `External URL auto-mod filter is now **${modeDesc}**.

${enabled ? 'All external links from non-moderators will be deleted. Use `/linksallow add` to whitelist specific domains like YouTube or Tenor.' : 'Users can freely share external links.'}`,
    [{ name: 'Changed by', value: `${moderator}` }]
  );

  logToSecurityChannel(guild, embed.log(
    'Anti-Link Toggle',
    `Administrator **${moderator.user.tag}** toggled Anti-Link to **${mode.toUpperCase()}**.`,
    [],
    enabled ? 'success' : 'warning'
  ));

  return { embed: resEmbed };
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
  const raidModeStatus   = config.raidMode                      ? '� ENGAGED' : `${TOGGLE_ON} STANDBY`;

  const fields = [
    { name: ' Owner', value: `${ownerTag}`, inline: true },
    { name: '� Members', value: `**${totalMembers}**`, inline: true },
    { name: '� Roles', value: `**${roleCount}**`, inline: true },
    { name: '� Channels', value: `**${channelCount}**`, inline: true },
    { name: '� Boost Level', value: `**Tier ${boostLevel}** (${boostCount} boosts)`, inline: true },
    { name: '� Created', value: createdAt, inline: true },
    { name: '\u200b', value: '**── Security Status ──**' },
    { name: ' Anti-Nuke', value: antiNukeStatus, inline: true },
    { name: ' Anti-Spam', value: antiSpamStatus, inline: true },
    { name: '� Anti-Invite', value: antiInviteStatus, inline: true },
    { name: '� Anti-Link', value: antiLinkStatus, inline: true },
    { name: '� Raid Mode', value: raidModeStatus, inline: true },
    { name: ' Max Warns', value: `\`${config.maxWarnings}\``, inline: true }
  ];

  const serverEmbed = embed.security(
    `${guild.name} — Server Info`,
    `Comprehensive server statistics and Athena Prime security overview.`,
    fields
  );

  if (guild.iconURL()) {
    serverEmbed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));
  }

  return { embed: serverEmbed };
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
    { name: '� Username', value: `${member.user.tag}`, inline: true },
    { name: '� User ID', value: `\`${member.id}\``, inline: true },
    { name: '� Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
    { name: '� Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
    { name: ' Active Warnings', value: `\`${warnings.length}\``, inline: true },
    { name: ' Privileges', value: privileges.join(' | '), inline: true },
    { name: `� Roles [${member.roles.cache.size - 1}]`, value: roles }
  ];

  const userEmbed = embed.info(
    `User Info — ${member.user.tag}`,
    `Detailed profile and privilege information.`,
    fields
  );

  userEmbed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));

  return { embed: userEmbed };
}

// ==========================================
// SECURITY TOGGLE ALL — Bot Owner / Server Owner only
// Enables/disables ALL security features except autonick
// ==========================================
async function handleSecurityToggleAll(guild, moderator, enable) {
  db.updateGuildConfig(guild.id, {
    antiNukeEnabled:   enable,
    antiSpamEnabled:   enable,
    antiInviteEnabled: enable,
    antiLinkEnabled:   enable
    // autonick intentionally NOT touched — must be enabled manually
  });

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
    ? embed.success(
        'All Security Shields ENGAGED �',
        `All Athena Prime protective layers are now **ACTIVE**.\nAnti-Nuke, Anti-Spam, Anti-Invite, Anti-Link, and Word Filter are fully armed!\n\n*(Use individual commands like \`antinuke config\` or \`linksallow\` to fine-tune)*`,
        [
          { name: ' Anti-Nuke',  value: `${TOGGLE_ON} ON`, inline: true },
          { name: ' Anti-Spam',  value: `${TOGGLE_ON} ON`, inline: true },
          { name: '� Anti-Invite', value: `${TOGGLE_ON} ON`, inline: true },
          { name: '� Anti-Link',  value: `${TOGGLE_ON} ON`, inline: true },
          { name: '� Word Filter', value: `${TOGGLE_ON} ON`, inline: true },
          { name: 'Enabled by',    value: `${moderator}`,    inline: true }
        ]
      )
    : embed.warn(
        'All Security Shields DISENGAGED',
        ` All Athena Prime protective filters have been **DEACTIVATED** server-wide.`,
        [{ name: 'Disabled by', value: `${moderator}` }]
      );

  logToSecurityChannel(guild, embed.log(
    'Security Toggle All',
    `**${moderator.user.tag}** toggled all security shields **${enable ? 'ON' : 'OFF'}**.`,
    [],
    enable ? 'success' : 'warning'
  ));

  return { embed: resEmbed };
}

// ==========================================
// QRMANAGER — Quarantine system setup & repair
// ==========================================
async function handleQrManager(guild, moderator, action, roleArg, channelArg) {
  const config = db.getGuildConfig(guild.id);

  if (action === 'setup') {
    // Create/resolve quarantine role + channel
    const qRole = await getOrCreateQuarantineRole(guild);
    if (!qRole) return { embed: embed.danger('Setup Failed', 'Could not create or find the Quarantine role. Check bot permissions.') };

    const qChannel = await getOrCreateQuarantineChannel(guild, qRole);

    // Sync deny overwrites on ALL channels (except quarantine-zone)
    const synced = await syncQuarantinePermissions(guild, qRole, qChannel?.id || null);

    const fields = [
      { name: '� Quarantine Role',    value: qRole    ? `<@&${qRole.id}>`     : ' Not Created', inline: true },
      { name: '� Quarantine Channel', value: qChannel ? `<#${qChannel.id}>`   : ' Not Created', inline: true },
      { name: '� Channels Synced',    value: `\`${synced}\` channels updated`, inline: true }
    ];

    const vc = config.quarantineVcId ? await guild.channels.fetch(config.quarantineVcId).catch(() => null) : null;
    if (vc) fields.push({ name: '� Quarantine VC', value: `<#${vc.id}>`, inline: true });

    return {
      embed: embed.success(
        'Quarantine System Fixed ',
        `The quarantine role and channel have been set up.\nDeny overwrites applied to **${synced}** channels — quarantined users will only see the quarantine zone.`,
        fields
      )
    };
  }

  if (action === 'setrole') {
    if (!roleArg) return { embed: embed.warn('Missing Role', 'Please specify a role using the `role` option.') };
    db.updateGuildConfig(guild.id, { quarantineRoleId: roleArg.id });
    const qChannelId = db.getGuildConfig(guild.id).quarantineChannelId;
    await syncQuarantinePermissions(guild, roleArg, qChannelId);
    return { embed: embed.success('Quarantine Role Set', `Set <@&${roleArg.id}> as the quarantine role and synced deny overwrites across all channels.`) };
  }

  if (action === 'setchannel') {
    if (!channelArg) return { embed: embed.warn('Missing Channel', 'Please specify a text channel using the `channel` option.') };
    db.updateGuildConfig(guild.id, { quarantineChannelId: channelArg.id });
    const qRole = await getOrCreateQuarantineRole(guild);
    await syncQuarantinePermissions(guild, qRole, channelArg.id);
    return { embed: embed.success('Quarantine Channel Set', `Set <#${channelArg.id}> as the quarantine text zone and synced deny overwrites across all channels.\nQuarantined users will be able to view and chat here.`) };
  }

  if (action === 'setvc') {
    if (!channelArg) return { embed: embed.warn('Missing VC', 'Please specify a voice channel using the `channel` option.') };
    db.updateGuildConfig(guild.id, { quarantineVcId: channelArg.id });
    return { embed: embed.success('Quarantine VC Set', `Set <#${channelArg.id}> as the quarantine voice channel.\nWhen a member is quarantined they will be moved here (if they are in a VC). On unquarantine they are returned to their previous VC.`) };
  }

  if (action === 'status') {
    const updatedConfig = db.getGuildConfig(guild.id);
    const role    = updatedConfig.quarantineRoleId    ? await guild.roles.fetch(updatedConfig.quarantineRoleId).catch(() => null)       : null;
    const channel = updatedConfig.quarantineChannelId ? await guild.channels.fetch(updatedConfig.quarantineChannelId).catch(() => null) : null;
    const vc      = updatedConfig.quarantineVcId      ? await guild.channels.fetch(updatedConfig.quarantineVcId).catch(() => null)      : null;

    return {
      embed: embed.info('Quarantine System Status', 'Current quarantine configuration for this server:', [
        { name: 'Quarantine Role',    value: role    ? `<@&${role.id}>`   : ' Not Set — run `/qrmanager setup`', inline: true },
        { name: 'Quarantine Channel', value: channel ? `<#${channel.id}>` : ' Not Set — run `/qrmanager setup`', inline: true },
        { name: 'Quarantine VC',      value: vc      ? `<#${vc.id}>`      : ' Not Set — use `/qrmanager setvc`', inline: true }
      ])
    };
  }

  return { embed: embed.warn('Unknown Action', 'Valid actions: `setup`, `setrole`, `setchannel`, `setvc`, `status`') };
}

// ==========================================
// ==========================================
// LINKSALLOW — Per-guild domain whitelist for anti-link filter
// ==========================================
async function handleLinksAllow(guild, action, domain) {
  if (action === 'allowall') {
    db.updateGuildConfig(guild.id, { allowAllLinks: true });
    return {
      embed: embed.success(
        '� All Links Allowed',
        'The anti-link filter has been **completely disabled** for this server.\n\nAll users can now post any link freely.\n\nUse `/linksallow disallowall` to re-enable the filter.',
        [{ name: ' Note', value: 'This overrides all domain whitelists and disables the anti-link filter entirely.' }]
      )
    };
  }

  if (action === 'disallowall') {
    db.updateGuildConfig(guild.id, { allowAllLinks: false });
    return {
      embed: embed.warn(
        '� Anti-Link Filter Restored',
        'The anti-link filter is **active** again.\n\nOnly whitelisted domains are allowed. Use `/linksallow add <domain>` to whitelist specific domains.'
      )
    };
  }

  if (action === 'add') {
    // Normalize: strip protocol and path, keep domain only
    const cleanDomain = (domain || '')
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .trim()
      .toLowerCase();

    if (!cleanDomain) return { embed: embed.warn('Invalid Domain', 'Please provide a valid domain (e.g. `youtube.com`).') };

    const added = db.addAllowedLink(guild.id, cleanDomain);
    if (added) {
      return {
        embed: embed.success('Domain Allowed', `Added **\`${cleanDomain}\`** to the allowed links list.\nLinks containing this domain will bypass the anti-link filter.`)
      };
    }
    return { embed: embed.info('Already Allowed', `**\`${cleanDomain}\`** is already in the allowed list.`) };
  }

  if (action === 'remove') {
    const cleanDomain = (domain || '')
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .trim()
      .toLowerCase();

    const removed = db.removeAllowedLink(guild.id, cleanDomain);
    if (removed) {
      return { embed: embed.success('Domain Removed', `Removed **\`${cleanDomain}\`** from the allowed list.`) };
    }
    return { embed: embed.warn('Not Found', `**\`${cleanDomain}\`** is not in the allowed list.`) };
  }

  // list
  const config   = db.getGuildConfig(guild.id);
  const allOpen  = config.allowAllLinks === true;
  const list     = db.getAllowedLinks(guild.id);

  if (allOpen) {
    return {
      embed: embed.info(
        '� All Links Allowed',
        'The anti-link filter is currently **fully disabled** — all links are permitted.\n\nUse `/linksallow disallowall` to re-enable the filter.'
      )
    };
  }

  if (list.length === 0) {
    return {
      embed: embed.info(
        'No Allowed Domains',
        'No domains are whitelisted yet.\n\nAdd one with `/linksallow add <domain>` (e.g. `youtube.com`, `tenor.com`, `giphy.com`).\nThese domains will not be blocked by the anti-link filter.'
      )
    };
  }

  const formatted = list.map((d, i) => `${i + 1}. \`${d}\``).join('\n');
  return {
    embed: embed.info(
      'Allowed Link Domains',
      `These domains bypass the anti-link filter:\n\n${formatted}\n\n*Use \`/linksallow remove <domain>\` to remove any.*`
    )
  };
}

// ==========================================
// MASS QUARANTINE — Quarantine all members with a specific role
// Skips: bot owner, server owner, extra owners, whitelisted, already quarantined
// ==========================================
async function handleMassQuarantine(guild, moderator, targetRole, reason) {
  // Safety guard — prevent quarantining @everyone
  if (targetRole.id === guild.id) {
    return { embed: embed.danger('Blocked', 'You cannot mass quarantine the `@everyone` role.') };
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
    return {
      embed: embed.warn(
        'No Eligible Targets',
        `No members with <@&${targetRole.id}> can be quarantined.\n\nAll members are either already quarantined, protected (owner/extra owner/whitelisted), or the role is empty.`
      )
    };
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

  logToSecurityChannel(guild, embed.log(
    'Mass Quarantine Executed',
    `**${moderator.user.tag}** mass-quarantined all members with role <@&${targetRole.id}>.`,
    [
      { name: '� Role',       value: `<@&${targetRole.id}>`, inline: true },
      { name: ' Quarantined', value: `\`${success}\``,       inline: true },
      { name: ' Failed',      value: `\`${failed}\``,        inline: true },
      { name: ' Skipped',    value: `\`${skipped}\``,       inline: true },
      { name: '� Reason',     value: reason }
    ],
    'danger'
  ));

  return {
    embed: embed.danger(
      '� Mass Quarantine Complete',
      `All targeted members with <@&${targetRole.id}> have been processed.`,
      [
        { name: '� Target Role',  value: `<@&${targetRole.id}> (${total} members targeted)`, inline: false },
        { name: ' Quarantined',  value: `\`${success}\``,  inline: true },
        { name: ' Failed',       value: `\`${failed}\``,   inline: true },
        { name: ' Skipped',     value: `\`${skipped}\``,  inline: true },
        { name: '� Reason',       value: reason,             inline: false },
        { name: '� Executed By',  value: `${moderator}`,    inline: true }
      ]
    )
  };
}

// ==========================================
// MASS UNQUARANTINE — Release all quarantined members in a guild
// ==========================================
async function handleMassUnquarantine(guild, moderator, client, context = null) {
  const quarantined = db.getQuarantinedInGuild(guild.id);

  if (!quarantined || quarantined.length === 0) {
    return { embed: embed.info('Nothing to Release', 'There are no quarantined members in this server.') };
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

  logToSecurityChannel(guild, embed.log(
    'Mass Unquarantine Executed',
    `**${moderator.user.tag}** released all quarantined members.`,
    [
      { name: ' Released', value: `\`${success}\``, inline: true },
      { name: ' Failed',   value: `\`${failed}\``,  inline: true }
    ],
    'success'
  ));

  return {
    embed: embed.success(
      '� Mass Unquarantine Complete',
      `All quarantined members have been processed.`,
      [
        { name: ' Released',     value: `\`${success}\``, inline: true },
        { name: ' Failed',        value: `\`${failed}\``,  inline: true },
        { name: '� Executed By', value: `${moderator}`,    inline: true }
      ]
    )
  };
}

async function runSecurityEnableSequence(guild, updateMessageFn) {
  // DB Update
  db.updateGuildConfig(guild.id, {
    antiNukeEnabled:   true,
    antiSpamEnabled:   true,
    antiInviteEnabled: true,
    antiLinkEnabled:   true
  });
  const config = db.getGuildConfig(guild.id);
  if (!config.blacklistWords || config.blacklistWords.length === 0) {
    db.addBlacklistWord(guild.id, 'hack');
    db.addBlacklistWord(guild.id, 'nuke');
    db.addBlacklistWord(guild.id, 'spam');
  }

  const onEmoji = '<:on:1514996865030946847>';
  const alertEmoji = '<a:alert1:1521456941858029720>';
  const steps = [
    `${alertEmoji} __**INITIALIZING SECURITY PROTOCOLS...**__`,
    `${onEmoji} Anti-Nuke: **Enabled**`,
    `${onEmoji} Anti-Spam: **Enabled**`,
    `${onEmoji} Anti-Link: **Enabled**`,
    `${onEmoji} Anti-Invite: **Enabled**`,
    `${onEmoji} Word Filter: **Enabled**`,
    `\n${alertEmoji} __**DEPLOYING TRIPLE-LAYER DEFENSE...**__`
  ];

  let currentText = '';
  for (let i = 0; i < steps.length; i++) {
    currentText += (i > 0 ? '\n' : '') + steps[i];
    const e = embed.build({ title: 'Security Shield Sequence', description: currentText, color: 0xFF0000 });
    await updateMessageFn(e);
    await new Promise(r => setTimeout(r, 800));
  }

  // Dashboard creation (early so we can see it)
  const existingDashboard = guild.channels.cache.find(c => c.name === 'athenas-dashboard' || c.id === config.dashboardChannelId);
  if (!existingDashboard) {
    await setupDashboardChannel(guild, guild.client).catch(() => null);
  }
  currentText += `\n${onEmoji} **Deploying Dashboard:** Athena's Dashboard Channel Active`;
  await updateMessageFn(embed.build({ title: 'Security Shield Sequence', description: currentText, color: 0xFF0000 }));
  await new Promise(r => setTimeout(r, 800));

  // Clean up any erroneous roles from previous bad generation
  const badRoles = ['Athena Integration Enabled', 'Athena Firewall Activated', 'Athena Unbypassable Deployed'];
  for (const r of guild.roles.cache.values()) {
    if (badRoles.includes(r.name)) {
      await r.delete('Cleaning up erroneous security roles').catch(() => null);
    }
  }

  // Ensure real security roles are ready
  const { ensureUnbypassableRole } = await import('../utils/antiStrip.js');
  
  // 1. Primary Role (Athena Prime)
  currentText += `\n${onEmoji} **Preparing Primary Role (1/3):** Athena Prime`;
  await updateMessageFn(embed.build({ title: 'Security Shield Sequence', description: currentText, color: 0xFF0000 }));
  await new Promise(r => setTimeout(r, 800));

  // 2. Secondary Role (Athena Firewall)
  currentText += `\n${onEmoji} **Preparing Secondary Role (2/3):** Athena Firewall`;
  await updateMessageFn(embed.build({ title: 'Security Shield Sequence', description: currentText, color: 0xFF0000 }));
  await ensureUnbypassableRole(guild).catch(() => null);
  await new Promise(r => setTimeout(r, 800));

  // 3. Hidden Role (Athena Unbypassable)
  currentText += `\n${onEmoji} **Preparing Hidden Role (3/3):** Athena Unbypassable`;
  await updateMessageFn(embed.build({ title: 'Security Shield Sequence', description: currentText, color: 0xFF0000 }));
  await new Promise(r => setTimeout(r, 800));

  currentText += `\n\n${alertEmoji} **ALL SYSTEMS LOCKED AND OPERATIONAL**\n\n**Athena Prime has deployed a triple-layer security architecture. Any attempt to disturb, delete, or strip permissions from my Primary, Secondary, or Hidden roles will trigger an instant Hostile Neutralization. Athena will automatically restore its own permissions, rendering the bot truly unbypassable.**\n\n**#athenas-dashboard** has been successfully initialized. Use this dedicated channel to monitor live security modules, recent logs, and interact with firewall controls.`;
  
  const finalEmbed = embed.build({ title: 'Security Shield Sequence', description: currentText, color: 0xFF0000 });
  await updateMessageFn(finalEmbed);
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
    desc += `### <:emoji_16:1521464002046328944> TRUSTED PERSONNEL\n`;
    humansToShow.forEach(h => {
      desc += `${DOT} **@${h.user.username}** [\`${h.id}\`]\n`;
    });
    if (trustedHumans.length > endIdx) desc += `*...and ${trustedHumans.length - endIdx} more.*\n`;
    desc += `\n`;
  }

  const whitelistedBotsToShow = whitelistedBots.slice(startIdx, endIdx);
  if (whitelistedBotsToShow.length > 0) {
    desc += `### <:emoji_16:1521464002046328944> WHITELISTED BOTS\n`;
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
