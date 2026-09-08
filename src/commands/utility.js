import { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { processMp3Link } from '../utils/mediaDownloader.js';
import { isAuthorized } from '../utils/helpers.js';

// ——————————————————————————————————————————————————
// Bold underline header formatter — matches embed title style
// ——————————————————————————————————————————————————
function h(text) {
  return `__**${text.toUpperCase()}**__`;
}

export const commands = [

  // --- CALCULATOR COMMAND ---
  {
    name: 'calculator',
    description: 'Launch an interactive Discord button calculator.',
    aliases: ['calc', 'math'],
    category: 'utility',
    permissions: [],
    async executePrefix(message, args) {
        let reply;
        try {
          if (args && args.length > 0) {
              const cmdName = args[0].toLowerCase();
              const { default: commandMap } = await import('./loader.js');
              let targetCmd = commandMap.get(cmdName);
              
              if (!targetCmd) {
                  return message.reply({ content: `-! ⚠️ **Command Not Found:** ` + cmdName });
              }
              
              const { TextDisplayBuilder, MessageFlags } = await import('discord.js');
              
              let permsText = "Public / Everyone";
              if (targetCmd.permissions && targetCmd.permissions.length > 0) {
                  if (targetCmd.permissions.includes(8n)) permsText = "Administrator";
                  else if (targetCmd.permissions.includes(32n)) permsText = "Manage Server";
                  else if (targetCmd.permissions.includes(1099511627776n)) permsText = "Moderate Members";
                  else permsText = "Elevated Permissions";
              }
              
              let catStr = targetCmd.category ? targetCmd.category.charAt(0).toUpperCase() + targetCmd.category.slice(1) : "General";
              if (targetCmd.name === "qr" || targetCmd.name === "fck" || targetCmd.name === "np") {
                  catStr = "@Bot Commands (Direct @Bot Mention Commands)";
              }
              
              const db = (await import('../database.js')).default;
              const config = db.getGuildConfig(message.guild.id);
              const prefix = config?.prefix || '!';
              
              let usageText = `${prefix}${targetCmd.name}`;
              if (targetCmd.name === "qr" || targetCmd.name === "fck" || targetCmd.name === "np") {
                  usageText = `@bot ${targetCmd.name}`;
              }
              
              const display1 = new TextDisplayBuilder().setContent(`# Command Name: \`${targetCmd.name}\`\n\n> -# **Command usage:** \`${usageText}\`\n> -# **Command Permissions:** \`${permsText}\``);
              const display2 = new TextDisplayBuilder().setContent(`> -# **Command Explain : What Is The Purpose of that command:**\n> -# ${targetCmd.description || "No description provided."}`);
              const display3 = new TextDisplayBuilder().setContent(`-# **Category:** ${catStr}`);
              
              const container = {
                  type: 17,
                  components: [
                      display1,
                      { type: 14, divider: true },
                      display2,
                      { type: 14, divider: true },
                      display3
                  ]
              };
              
              return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
          }

          const components = buildHelpContainer(message.client, message.guild?.id, 'home');
          reply = await message.reply({ components: [components], flags: MessageFlags.IsComponentsV2 });
        } catch (e) {
          return message.channel.send({ content: `**DEBUG ERROR:** \`${e.message}\`` }).catch(() => null);
        }
        const collector = reply.createMessageComponentCollector({ idle: 60000 });
      
      let currentIdx = -1;

      collector.on('collect', async i => {
        // Allow anyone to interact with the menu
        
        if (i.customId === 'help_delete') {
          return reply.delete().catch(() => null);
        }
        
        if (i.customId === 'help_home') currentIdx = -1;
        else if (i.customId === 'help_prev') currentIdx = currentIdx <= 0 ? helpModules.length - 1 : currentIdx - 1;
        else if (i.customId === 'help_next') currentIdx = currentIdx >= helpModules.length - 1 ? 0 : currentIdx + 1;
        else if (i.customId === 'help_module_select') {
          const val = i.values[0];
          if (val === 'home') currentIdx = -1;
          else currentIdx = helpModules.findIndex(m => m.id === val);
        }

        const newComponents = buildHelpContainer(message.client, message.guild?.id, currentIdx === -1 ? 'home' : helpModules[currentIdx].id);
        await i.update({ components: [newComponents], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
      });
      
      collector.on('end', () => reply.delete().catch(() => null));
    },
    async executeSlash(interaction) {
      const components = buildHelpContainer(interaction.client, interaction.guild?.id, 'home');
      
      let reply;
      try {
        await interaction.reply({ components: [components], flags: MessageFlags.IsComponentsV2 });
        reply = await interaction.fetchReply();
      } catch (e) {
        return interaction.reply({ content: `**DEBUG ERROR:** \`${e.message}\`` }).catch(() => null);
      }
      if (!reply) return; // Prevent crashes if reply is undefined
      const collector = reply.createMessageComponentCollector({ idle: 60000 });
      
      let currentIdx = -1;

      collector.on('collect', async i => {
        // Allow anyone to interact with the menu
        
        if (i.customId === 'help_delete') {
          return interaction.deleteReply().catch(() => null);
        }
        
        if (i.customId === 'help_home') currentIdx = -1;
        else if (i.customId === 'help_prev') currentIdx = currentIdx <= 0 ? helpModules.length - 1 : currentIdx - 1;
        else if (i.customId === 'help_next') currentIdx = currentIdx >= helpModules.length - 1 ? 0 : currentIdx + 1;
        else if (i.customId === 'help_module_select') {
          const val = i.values[0];
          if (val === 'home') currentIdx = -1;
          else currentIdx = helpModules.findIndex(m => m.id === val);
        }

        const newComponents = buildHelpContainer(interaction.client, interaction.guild?.id, currentIdx === -1 ? 'home' : helpModules[currentIdx].id);
        await i.update({ components: [newComponents], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
      });
      
      collector.on('end', () => interaction.deleteReply().catch(() => null));
    }
  },

  // --- PING COMMAND ---
  {
    name: 'ping',
    description: 'Checks the bot and gateway latency.',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      const { EmbedBuilder, AttachmentBuilder } = await import('discord.js');
      const { generatePingGraph } = await import('../utils/graph.js');
      const cfg = db.getGuildConfig(message.guild?.id || '0');
      const accentHex = cfg?.accentColor || '#00e5ff';
      const accentInt = parseInt(accentHex.replace('#', ''), 16);

      const { MessageFlags } = await import('discord.js');
      const sent = await message.reply({ 
        components: [{ type: 17, components: [{ type: 10, content: `-# <a:loading:1542155051286396938> **Athena Prime:** ${["Measuring Discord API gateway latency...", "Pinging regional server clusters...", "Awaiting acknowledgment from Discord servers...", "Synchronizing internal clock with Discord API...", "Tracing packet route to Discord gateway...", "Calculating websocket round-trip latency...", "Measuring read/write speed of local database..."][Math.floor(Math.random() * 7)]}` }] }],
        flags: MessageFlags.IsComponentsV2 
      });
      const apiMs = sent.createdTimestamp - message.createdTimestamp;
      const wsMs  = Math.round(message.client.ws.ping);

      const dbStart = Date.now();
      db.getGuildConfig(message.guild?.id || '0');
      const dbMs = Date.now() - dbStart;

      const rSet = Math.floor(Math.random() * 3) + 1;
      const rGet = Math.floor(Math.random() * 2) + 1;
      const rDel = Math.floor(Math.random() * 2) + 1;

      const buffer = await generatePingGraph(wsMs, accentHex, message.client.guilds.cache.size);
      const attachment = new AttachmentBuilder(buffer, { name: 'ping_graph.png' });

      const comps = [
        { type: 10, content: `-# **| <:ticks:1533860039213842565> [${message.member?.displayName || message.author.displayName}](https://discord.com/users/${message.author.id}) ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` },
        { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }
      ];

      await sent.delete().catch(() => null);
        await message.reply({ components: [{ type: 17, components: comps }], files: [attachment], flags: MessageFlags.IsComponentsV2 });
    },
    async executeSlash(interaction) {
      const { EmbedBuilder, AttachmentBuilder } = await import('discord.js');
      const { generatePingGraph } = await import('../utils/graph.js');
      const cfg = db.getGuildConfig(interaction.guild?.id || '0');
      const accentHex = cfg?.accentColor || '#00e5ff';
      const accentInt = parseInt(accentHex.replace('#', ''), 16);

      const { MessageFlags } = await import('discord.js');
      await interaction.reply({ 
        components: [{ type: 17, components: [{ type: 10, content: `-# <a:loading:1542155051286396938> **Athena Prime:** ${["Measuring Discord API gateway latency...", "Pinging regional server clusters...", "Awaiting acknowledgment from Discord servers...", "Synchronizing internal clock with Discord API...", "Tracing packet route to Discord gateway...", "Calculating websocket round-trip latency...", "Measuring read/write speed of local database..."][Math.floor(Math.random() * 7)]}` }] }],
        flags: MessageFlags.IsComponentsV2 
      });
      const sent = await interaction.fetchReply();
      const apiMs = sent.createdTimestamp - interaction.createdTimestamp;
      const wsMs  = Math.round(interaction.client.ws.ping);

      const dbStart = Date.now();
      db.getGuildConfig(interaction.guild?.id || '0');
      const dbMs = Date.now() - dbStart;

      const rSet = Math.floor(Math.random() * 3) + 1;
      const rGet = Math.floor(Math.random() * 2) + 1;
      const rDel = Math.floor(Math.random() * 2) + 1;

      const buffer = await generatePingGraph(wsMs, accentHex, interaction.client.guilds.cache.size);
      const attachment = new AttachmentBuilder(buffer, { name: 'ping_graph.png' });

      const comps = [
        { type: 10, content: `-# **| <:ticks:1533860039213842565> [${interaction.member?.displayName || interaction.user.displayName}](https://discord.com/users/${interaction.user.id}) ${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**` },
        { type: 12, items: [{ media: { url: 'attachment://ping_graph.png' } }] }
      ];

      await interaction.deleteReply().catch(() => null);
        await interaction.followUp({ components: [{ type: 17, components: comps }], files: [attachment], flags: MessageFlags.IsComponentsV2 });
    }
  },

  // --- TIME COMMAND ---
  {
    name: 'time',
    description: 'Check the current Indian Standard Time (IST)',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      await this._executeTime(message.guild, message.client, message, message.author);
    },
    async executeSlash(interaction) {
      await this._executeTime(interaction.guild, interaction.client, interaction, interaction.user);
    },
    async _executeTime(guild, client, context, user) {
      const { EmbedBuilder } = await import('discord.js');
      const cfg = db.getGuildConfig(guild?.id || '0');
      const accentHex = cfg?.accentColor || '#00e5ff';
      const accentInt = parseInt(accentHex.replace('#', ''), 16);

      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      const e1 = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`> **COMMAND | ├ó┬¥ΓÇó**`);

      const e2 = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`> ├óΓé¼┬ó <@${user.id}> executed\n> **<:emoji_25:1515041866796503180> Time :**\n# ${timeStr}\n> **(IST) - ${dateStr}**`)
        .setThumbnail(user.displayAvatarURL({ size: 256, dynamic: true }));

      if (context.reply) {
        await context.reply({ embeds: [e1, e2] });
      }
    }
  },

  // --- SETUP COMMAND ---
  {
    name: 'setup',
    description: 'Configures bot logs channel, quarantine voice, or settings.',
    category: 'utility',
    permissions: [PermissionFlagsBits.Administrator],
    options: [],
    async executePrefix(message, args) {
      if (args[0] && args[0].toLowerCase() === 'music') {
        return message.reply(cv2.warn('Command Redirect', 'To setup the Music Player, please use the `!setupmusic` command instead!'));
      }
      const channel = message.mentions.channels.first();
      const role = message.mentions.roles.first();
      
      // Resolve first mentioned or matched voice channel in args
      const voiceChannel = message.guild.channels.cache.find(
        c => c.type === ChannelType.GuildVoice && 
        args.some(arg => arg.includes(c.id) || arg.toLowerCase() === c.name.toLowerCase())
      );

      if (!channel && !role && !voiceChannel) {
        return message.reply(cv2.warn('Setup Info', `${message.author} Usage: \`!setup <#logChannel>\` or \`!setup <quarantineVoiceChannelName>\` or \`!setup <@quarantineRole>\``));
      }

      const result = await handleSetup(message.guild, channel, role, voiceChannel);
      await message.reply(result);
    }
  },

  // --- STATUS COMMAND ---
  {
    name: 'status',
    description: 'Displays the Athena Prime security status overview and bot health.',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      const { getSecurityStatusPanel } = await import('./security.js');
      const panel = await getSecurityStatusPanel(message.guild);
      await message.reply(panel);
    },
    async executeSlash(interaction) {
      const { getSecurityStatusPanel } = await import('./security.js');
      const panel = await getSecurityStatusPanel(interaction.guild);
      await interaction.reply(panel);
    }
  },

  {
    name: 'steal',
    description: 'Steal one or more custom emojis into this server.',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuildExpressions],
    options: [
      { name: 'emoji1', description: 'Paste an emoji to steal', type: 3, required: true },
      { name: 'emoji2', description: 'Paste an emoji to steal', type: 3, required: false },
      { name: 'emoji3', description: 'Paste an emoji to steal', type: 3, required: false },
      { name: 'emoji4', description: 'Paste an emoji to steal', type: 3, required: false },
      { name: 'emoji5', description: 'Paste an emoji to steal', type: 3, required: false },
      { name: 'emoji6', description: 'Paste an emoji to steal', type: 3, required: false }
    ],
    async executePrefix(message, args) {
      await this._processSteal(message.content, message, message.guild);
    },
    async executeSlash(interaction) {
      // Gather all emoji inputs
      const inputs = [
        interaction.options.getString('emoji1'),
        interaction.options.getString('emoji2'),
        interaction.options.getString('emoji3'),
        interaction.options.getString('emoji4'),
        interaction.options.getString('emoji5'),
        interaction.options.getString('emoji6')
      ].filter(Boolean).join(' ');

      await this._processSteal(inputs, interaction, interaction.guild);
    },
    async _processSteal(input, context, guild) {
      const EMOJI_RE = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;
      const matches  = [...input.matchAll(EMOJI_RE)];

      if (!matches.length) {
        return context.reply(cv2.warn(
            'No Emojis Found',
            'Provide at least one custom emoji to steal.\n\nExample: `:pog: :lol: :hype:`'
          ));
      }

      // Deduplicate by emoji ID
      const seen  = new Set();
      const emojis = matches.filter(m => !seen.has(m[3]) && seen.add(m[3]));

      const added   = [];
      const failed  = [];

      for (const [, animated, name, id] of emojis) {
        if (guild.emojis.cache.has(id)) {
          failed.push(`\`${name}\` - already present in server`);
          continue;
        }
        
        const { isBotOwnerSync } = await import('../utils/helpers.js');
        const isOwner = isBotOwnerSync(context.user ? context.user.id : context.author.id);
        if (!isOwner && guild.emojis.cache.some(e => e.name === name)) {
          failed.push(`\`${name}\` - name already in use`);
          continue;
        }

        const ext = animated ? 'gif' : 'png';
        const url = `https://cdn.discordapp.com/emojis/${id}.${ext}?size=128&quality=lossless`;
        
        try {
          const response = await fetch(url);
          
          if (!response.ok) throw new Error('Invalid Asset');

          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const created = await guild.emojis.create({ attachment: buffer, name });
          added.push(created.toString());
        } catch (err) {
          const reason = err.message?.includes('30008')
            ? 'server emoji limit reached'
            : err.message?.includes('50013')
            ? 'missing permissions'
            : err.message || 'unknown error';
          failed.push(`\`${name}\` - ${reason}`);
        }
      }

      const lines = [];
      if (added.length)  lines.push(`**Added (${added.length})**\n${added.join(' ')}`);
      if (failed.length) lines.push(`**Failed (${failed.length})**\n${failed.join('\n')}`);

      const resultEmbed = cv2.info(
        `Steal - ${added.length}/${emojis.length} Added`,
        lines.join('\n\n')
      );

      return context.reply(resultEmbed);
    }
  },
  {
    name: 'prefix',
    description: 'Set a custom prefix for the server',
    type: 1,
    options: [
      {
        name: 'new_prefix',
        description: 'The new custom prefix to use',
        type: 3, // STRING
        required: true
      }
    ],
    async executePrefix(message, args) {
      if (message.author.id !== process.env.OWNER_ID && message.author.id !== message.guild.ownerId) {
        return message.reply(cv2.danger('Access Denied', 'ï¸ Only the **Bot Owner** or **Server Owner** can use this command.'));
      }
      
      const newPrefix = args.join(' ');
      if (!newPrefix) {
        return message.reply(cv2.warn('Missing Prefix', `Please provide a new prefix. Example: \`@Athena Prime prefix !\``));
      }

      db.updateGuildConfig(message.guild.id, { prefix: newPrefix });
      await message.reply(cv2.success('Prefix Updated', `The bot's prefix has been successfully updated to \`${newPrefix}\``));
    },
    async executeSlash(interaction) {
      if (interaction.user.id !== process.env.OWNER_ID && interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply(cv2.danger('Access Denied', 'ï¸ Only the **Bot Owner** or **Server Owner** can use this command.'));
      }

      const newPrefix = interaction.options.getString('new_prefix');
      db.updateGuildConfig(interaction.guild.id, { prefix: newPrefix });
      await interaction.reply(cv2.success('Prefix Updated', `The bot's prefix has been successfully updated to \`${newPrefix}\``));
    }
  }
];

// ==========================================
// HELPERS
// ==========================================

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`**${days}**d`);
  if (hours > 0) parts.push(`**${hours}**h`);
  if (minutes > 0) parts.push(`**${minutes}**m`);
  if (secs > 0 || parts.length === 0) parts.push(`**${secs}**s`);
  return parts.join(' ');
}

async function getStatusEmbed(client, guild) {
  const config = db.getGuildConfig(guild.id);
  const uptimeMs = Date.now() - (client.bootTimestamp || Date.now());
  const apiMs = Math.round(client.ws.ping);

  const onEmoji = '<:on:1533844867191406672>';
  const offEmoji = '<:off:1533844858983157851>';
  
  const getStatusText = (isEnabled) => isEnabled ? `${onEmoji} **ENABLED**` : `${offEmoji} **DISABLED**`;

  const antiNukeStatus = getStatusText(config.antiNukeEnabled);
  const firewallStatus = getStatusText(config.antiNukeEnabled); // Athena Firewall is tied to core security
  const antiSpamStatus = getStatusText(config.antiSpamEnabled);
  const antiInviteStatus = getStatusText(config.antiInviteEnabled !== false);
  const antiLinkStatus = getStatusText(config.antiLinkEnabled);
  const raidModeStatus = config.raidMode ? `${onEmoji} **ENGAGED**` : `${offEmoji} **STANDBY**`;

  const fields = [
    { name: 'Bot Uptime', value: formatUptime(uptimeMs), inline: true },
    { name: 'Gateway Latency', value: `**${apiMs}ms**`, inline: true },
    { name: 'Servers Protected', value: `**${client.guilds.cache.size}**`, inline: true },
    { name: 'Anti-Nuke Shield', value: antiNukeStatus, inline: true },
    { name: 'Athena Firewall', value: firewallStatus, inline: true },
    { name: 'Anti-Spam Filter', value: antiSpamStatus, inline: true },
    { name: 'Anti-Invite Blocker', value: antiInviteStatus, inline: true },
    { name: 'Anti-Link Filter', value: antiLinkStatus, inline: true },
    { name: 'Raid Mode', value: raidModeStatus, inline: true },
    { name: 'Warning Ceiling', value: `\`${config.maxWarnings} Warnings\``, inline: true }
  ];

  const statusEmbed = cv2.security(
    'Athena Prime - Security Status',
    `Real-time security overview for **${guild.name}**.\nYour server is fully armed and continuously monitored by ${client.user}.\n\n**God Level Security - ENABLED**`,
    fields
  );

  return statusEmbed;
}

const helpModules = [
  { id: 'security', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Security', label: 'Security & Firewall', emoji: 'security', commands: ['**Anti-Nuke Systems**', '`!security enable all` - Activate the God-Tier Firewall.', '`!security disable all` - Disable all security shields.', '`!ss` or `!security status` - View the live Security Firewall Status panel.', '`!antinuke config` - Interactive panel to toggle specific modules.'] },
  { id: 'filters', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Filters', label: 'Automod Filters', emoji: 'filters', commands: ['**Auto-Moderation**', '`!automod config` - Open the interactive Automod configuration dashboard.', '`!automod advanced` - Global link & invite toggles.', '`!automod bypass add @role` - Grant granular bypasses for specific modules.', '`!automod bypass list` - View all bypassed roles.', '`!wordfilter` - Manage the banned word list.'] },
  { id: 'quarantine', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Quarantine', label: 'Quarantine System', emoji: 'quarantine', commands: ['**Threat Containment**', '`!qrmanager setup` - Configure Quarantine role, VC, and channel.', '`!quarantine @user [reason]` - Isolate a user instantly.', '`!unquarantine @user` - Lift quarantine status.'] },
  { id: 'whitelist', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Whitelist', label: 'Whitelist & Access', emoji: 'whitelist', commands: ['**Access Control**', '`!whitelist @user` - Grant immunity from Anti-Nuke.', '`!whitelist @role` - Whitelist a role from being punished.', '`!botwhitelist add <id>` - Allow specific bots to join the server.', '`!extraowner add @user` - Grant co-owner privileges.'] },
  { id: 'verification', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Verify', label: 'Verification Gate', emoji: 'verification', commands: ['**Server Verification**', '`!verify setup` - Initialize the Captcha Verification system.', '`!verify config` - Change verification difficulty and role.'] },
  
  { id: 'moderation', category: 'SERVER ADMINISTRATION', shortLabel: 'Moderation', label: 'Moderation Tools', emoji: 'moderation', commands: ['**Server Moderation**', '`!ban / !kick / !mute / !warn` - Standard moderation tools.', '`!purge <amount>` - Clear messages in bulk.', '`!lock / !unlock` - Lockdown a channel.', '`!nuke` - Recreate a channel from scratch.'] },
  { id: 'tracking', category: 'SERVER ADMINISTRATION', shortLabel: 'Tracking', label: 'Engagement & Tracking', emoji: 'tracking', commands: ['**Logs & Tracking**', '`!serverlogs autosetup` - Setup the Advanced Logging system.', '`!invitesetup #channel` - Advanced Invite Tracker.', '`!record start` - Live VC audio recording.'] },
  { id: 'config', category: 'SERVER ADMINISTRATION', shortLabel: 'Config', label: 'Customization & Roles', emoji: 'config', commands: ['**Server Config**', '`!prefix <new>` - Change bot prefix.', '`!accent` - Modify embed colors.', '`!autonick on` - Standardize member nicknames.'] },
  { id: 'welcome', category: 'SERVER ADMINISTRATION', shortLabel: 'Welcome', label: 'Welcome System', emoji: 'welcome', commands: ['**Welcome & Leave**', '`!welcome setup` - Build interactive welcome messages.', '`!autorole add @role` - Automatically assign roles on join.'] },
  { id: 'noprefix', category: 'SERVER ADMINISTRATION', shortLabel: 'No-Prefix', label: 'No-Prefix Management', emoji: 'noprefix', commands: ['**Global Access**', '`!noprefix add @user` - Allow user to execute commands without a prefix.', '`!noprefix list` - View all no-prefix users.'] },
  
  { id: 'leveling', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Leveling', label: 'Leveling Engine', emoji: 'leveling', commands: ['**XP System**', '`!xpsetup` - Launch the interactive XP control panel.', '`!rank [@user]` - View level and progress graphic.', '`!leaderboard` - View top active members.'] },
  { id: 'stats', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Stats', label: 'Statistics', emoji: 'stats', commands: ['**Server Stats**', '`!me` - View your personal message stats.', '`!top` - Combined server leaderboard.', '`!server` - Graphical server statistics overview.'] },
  { id: 'giveaways', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Giveaways', label: 'Birthdays & Giveaways', emoji: 'giveaways', commands: ['**Giveaways**', '`!giveaway start` - Launch an interactive giveaway.', '`!birthday set @user` - Register a birthday.'] },
  { id: 'triggers', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Triggers', label: 'Auto-Responder', emoji: 'triggers', commands: ['**Custom Triggers**', '`!trigger create <match> | <resp>` - Create an auto-response.', '`!trigger list` - View active triggers.'] },
  { id: 'autoreact', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Auto-React', label: 'Auto-Reactions', emoji: 'autoreact', commands: ['**Reactions**', '`!autoreact add <word> <emoji>` - Automatically react to keywords.', '`!autoreact list` - View active reactions.'] },
  { id: 'actions', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Roleplay', label: 'Roleplay Actions', emoji: 'actions', commands: ['**Social Actions**', '`!hug / !kiss / !slap / !pat` - Interact with other users.', '`!date @user` - Go on a romantic date.'] },
  
  { id: 'voice', category: 'VOICE & MEDIA', shortLabel: 'Voice', label: 'Voice Management', emoji: 'voice', commands: ['**VC Tools**', '`!vcsetup` - Setup Join-to-Create (JTC) voice channels.', '`!vclist` - View all active JTC channels.'] },
  { id: 'music', category: 'VOICE & MEDIA', shortLabel: 'Music', label: 'Music Player', emoji: 'music', commands: ['**Audio Playback**', '`!play <song>` - Play music in your voice channel.', '`!skip / !stop / !queue` - Manage the music queue.'] },
  { id: 'tts', category: 'VOICE & MEDIA', shortLabel: 'TTS', label: 'Text-to-Speech', emoji: 'tts', commands: ['**TTS Engine**', '`!tts <message>` - Speak text in the voice channel.', '`!tts config` - Change TTS voice and speed.'] },
  { id: 'messaging', category: 'VOICE & MEDIA', shortLabel: 'Messaging', label: 'Announcements', emoji: 'messaging', commands: ['**Global Messaging**', '`!announce #channel <msg>` - Send official announcements.', '`!sticky add <msg>` - Create sticky messages.'] },
  
  { id: 'utilities', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'Utility', label: 'General Utilities', emoji: 'utility', commands: ['**Tools**', '`!afk [reason]` - Set AFK status.', '`!ping / !time` - Check bot latency.', '`!calculator` - Interactive math calculator.'] },
  { id: 'customcmds', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'Custom Cmds', label: 'Custom Commands', emoji: 'customcmds', commands: ['**Server Commands**', '`!ccmd add <name> <response>` - Create a custom server command.', '`!ccmd list` - View all custom commands.'] },
  { id: 'tickets', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'Tickets', label: 'Support Tickets', emoji: 'tickets', commands: ['**Ticket System**', '`!ticket` - Launch the Ticket Panel Builder.', '`!close` - Close an active ticket thread.'] },
  { id: 'newsfeed', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'News', label: 'News Feed', emoji: 'newsfeed', commands: ['**RSS & News**', '`!news setup #channel` - Setup automated news feeds.', '`!news add <source>` - Subscribe to BBC, CNN, etc.'] }
];

const HELP_GIF = 'https://cdn.discordapp.com/attachments/1534869224277807175/1542472732325978234/ATHENA-8-27-2026.png?ex=6a915b2d&is=6a9009ad&hm=0f55bae0c0bec27649bc03e6d6be23ad16f2eb9337efdb8b5793b2d74cad89ff&';

function buildHelpContainer(client, guildId, moduleId) {
    const config = db.getGuildConfig(guildId);
    const prefix = config?.prefix || '!';
    const botId = client?.user?.id || '1347071663182676059';
    
    const getEmoji = (name, fallback) => {
      const e = client.emojis.cache.find(emoji => emoji.name === name);
      return e ? `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>` : fallback;
    };
  
    let rawComponents = [];
  
    if (moduleId === 'home') {
      let topText = `# Hey !!! , I am <@${botId}> ,\n\n`;
      topText += `> <a:z_arrow_pink1:1523082728004653138> **Welcome to Athena Prime A bot which is made for unbypassable security features and community management! View down and see our srv management modules listed below:**\n\n`;
      topText += `> <a:z_arrow_pink1:1523082728004653138> **To set Custom Prefix use <@${botId}> \`${prefix}prefix " your custom prefix "\`**\n\n`;
      topText += `> <a:z_arrow_pink1:1523082728004653138> **Hint : To Know more use " Tag the Bot and Type Guide for details and usage "**`;
  
      rawComponents.push({ type: 10, content: topText });
      rawComponents.push({ type: 14, divider: true });
  
      const categories = [
        { name: 'SECURITY & ACCESS CONTROL', icon: '', catName: 'SECURITY & ACCESS CONTROL' },
        { name: 'SERVER ADMINISTRATION', icon: '', catName: 'SERVER ADMINISTRATION' },
        { name: 'COMMUNITY & ENGAGEMENT', icon: '', catName: 'COMMUNITY & ENGAGEMENT' },
        { name: 'VOICE & MEDIA', icon: '', catName: 'VOICE & MEDIA' },
        { name: 'UTILITIES & INTEGRATIONS', icon: '', catName: 'UTILITIES & INTEGRATIONS' }
      ];

      const bullet = getEmoji('black_dot', '•');
      
      let grid = '';
      for (const cat of categories) {
         grid += `### ${cat.name}\n`;
         const mods = helpModules.filter(m => m.category === cat.catName);
         
         // To make it look compact, we can do 2 or 3 per row, or just a clean list
         let rowStr = '';
         for (let i = 0; i < mods.length; i++) {
            const m = mods[i];
            const e = getEmoji(m.emoji, '▶️');
            
            if (i % 2 === 0) {
                // First column starts the blockquote line
                rowStr += `> ${bullet} ${e} **${m.shortLabel}**`;
            } else {
                // Second column just appends to the same line
                rowStr += `${bullet} ${e} **${m.shortLabel}**`;
            }
            
            if (i % 2 === 1 || i === mods.length - 1) {
                grid += rowStr + '\n';
                rowStr = '';
            } else {
                // Adjust padding for alignment (using braille spaces)
                rowStr += ' \u2800\u2800 ';
            }
         }
         grid += '\n';
      }
      
      rawComponents.push({ type: 10, content: grid.trim() });
      rawComponents.push({ type: 14, divider: true });
  
    } else {
      const mod = helpModules.find(m => m.id === moduleId);
      if (mod) {
        const e = getEmoji(mod.emoji, '▶️');
        let currentChunk = `# ${e} ${mod.label.toUpperCase()}`;
        
        for (const cmd of mod.commands) {
          if (cmd === '') {
            if (currentChunk.trim().length > 0) {
              rawComponents.push({ type: 10, content: currentChunk.trim() });
            }
            rawComponents.push({ type: 14, divider: true });
            currentChunk = '';
            continue;
          }
          
          let formatted = cmd.replace(/!/g, prefix);
          let line = '';
          if ((formatted.startsWith('**') && formatted.endsWith('**')) || formatted.startsWith('-A ') || formatted.startsWith('  - ') || formatted.startsWith('`bans`,')) {
            line = formatted;
          } else {
            line = `> **${formatted}**`;
          }
  
          if (currentChunk.length + line.length + 4 > 1900) {
            if (currentChunk.trim().length > 0) {
              rawComponents.push({ type: 10, content: currentChunk.trim() });
            }
            currentChunk = line;
          } else {
            currentChunk += (currentChunk ? '\n\n' : '') + line;
          }
        }
  
        if (currentChunk.trim().length > 0) {
          rawComponents.push({ type: 10, content: currentChunk.trim() });
        }
  
        rawComponents.push({ type: 14, divider: true });
      }
    }
  
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_module_select')
      .setPlaceholder('Click to view modules');
  
    const homeEmoji = getEmoji('home', '🏠');
    selectMenu.addOptions([
      {
        label: 'Home Menu',
        description: 'Return to the main help menu',
        value: 'home'
        // cannot easily set dynamic emoji obj here if it's a string, so we skip emoji on home if it's custom string, or parse it
      }
    ]);
  
    // We can only fit 25 options. 1 Home + 24 Modules = 25 exactly!
    for (const mod of helpModules) {
      selectMenu.addOptions([
        {
          label: mod.label,
          value: mod.id
        }
      ]);
    }
  
    const btnPrev = new ButtonBuilder().setCustomId('help_prev').setEmoji('1523766004839088301').setStyle(ButtonStyle.Secondary);
    const btnNext = new ButtonBuilder().setCustomId('help_next').setEmoji('1523766065576935475').setStyle(ButtonStyle.Secondary);
    const btnRefresh = new ButtonBuilder().setCustomId('help_home').setEmoji('1523765738655973589').setStyle(ButtonStyle.Secondary);
    const btnDelete = new ButtonBuilder().setCustomId('help_delete').setEmoji('1523766340752642109').setStyle(ButtonStyle.Danger);
  
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(btnPrev, btnNext, btnRefresh, btnDelete);
  
    const HELP_GIF = 'https://cdn.discordapp.com/attachments/1534869224277807175/1542472732325978234/ATHENA-8-27-2026.png?ex=6a915b2d&is=6a9009ad&hm=0f55bae0c0bec27649bc03e6d6be23ad16f2eb9337efdb8b5793b2d74cad89ff&';
  
    rawComponents.push({ type: 12, items: [{ media: { url: HELP_GIF } }] });
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push(row1.toJSON());
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push(row2.toJSON());
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push({ type: 10, content: '-# **Athena Prime Unbypassable Security !!**' });
  
    const rawContainer = {
      type: 17,
      components: rawComponents
    };
  
    return rawContainer;
}

async function handleSetup(guild, channel, role, voiceChannel) {
  const updates = {};
  const fields = [];

  if (channel) {
    updates.logChannel = channel.id;
    fields.push({ name: 'Security Logs Channel', value: `${channel} (ID: ${channel.id})` });
  }

  if (voiceChannel) {
    updates.quarantineVcId = voiceChannel.id;
    fields.push({ name: 'Quarantine Voice Channel', value: `${voiceChannel} (ID: ${voiceChannel.id})` });
  }

  if (role) {
    updates.quarantineRoleId = role.id;
    fields.push({ name: 'Quarantine Role', value: `${role} (ID: ${role.id})` });
  }

  db.updateGuildConfig(guild.id, updates);

  const resEmbed = cv2.success(
    'Configuration Updated',
    'Successfully saved server adjustments to database cache.',
    fields
  );

  return resEmbed;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ADDED NEW COMMANDS BELOW
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

commands.push({
  name: 'autorole-config',
  description: 'Add or remove an autorole for new members',
  category: 'utility',
  permissions: [PermissionFlagsBits.ManageRoles],
  options: [
    {
      name: 'action',
      description: 'Add or Remove',
      type: 3,
      required: true,
      choices: [
        { name: 'Add Role', value: 'add' },
        { name: 'Remove Role', value: 'remove' },
        { name: 'Clear All', value: 'clear' }
      ]
    },
    {
      name: 'role',
      description: 'The role to configure',
      type: 8,
      required: false
    }
  ],
  async executeSlash(interaction) {
    const action = interaction.options.getString('action');
    const role = interaction.options.getRole('role');
    const cfg = db.getGuildConfig(interaction.guild.id);
    let currentRoles = cfg.autoroleIds || [];

    if (action === 'clear') {
      db.updateGuildConfig(interaction.guild.id, { autoroleIds: [] });
      return interaction.reply(cv2.success('Autorole Cleared', 'All autoroles have been removed.'));
    }

    if (!role) {
      return interaction.reply(cv2.warn('Missing Role', 'You must specify a role to add or remove.'));
    }

    if (action === 'add') {
      if (currentRoles.includes(role.id)) {
        return interaction.reply(cv2.warn('Already Added', `The role ${role} is already in the autorole list.`));
      }
      currentRoles.push(role.id);
      db.updateGuildConfig(interaction.guild.id, { autoroleIds: currentRoles });
      return interaction.reply(cv2.success('Autorole Added', `Successfully added ${role} to the autorole list.\nTotal roles: \`${currentRoles.length}\``));
    }

    if (action === 'remove') {
      if (!currentRoles.includes(role.id)) {
        return interaction.reply(cv2.warn('Not Found', `The role ${role} is not in the autorole list.`));
      }
      currentRoles = currentRoles.filter(id => id !== role.id);
      db.updateGuildConfig(interaction.guild.id, { autoroleIds: currentRoles });
      return interaction.reply(cv2.success('Autorole Removed', `Successfully removed ${role} from the autorole list.\nTotal roles: \`${currentRoles.length}\``));
    }
  }
});

commands.push({
  name: 'createthread',
  description: 'Create a new thread in this channel',
  category: 'utility',
  permissions: [PermissionFlagsBits.ManageThreads],
  options: [
    { name: 'name', description: 'Thread name', type: 3, required: true },
    { name: 'message', description: 'Initial message', type: 3, required: false }
  ],
  async executeSlash(interaction) {
    const name = interaction.options.getString('name');
    const msg = interaction.options.getString('message');
    try {
      const thread = await interaction.channel.threads.create({
        name,
        autoArchiveDuration: 1440,
        reason: `Created by ${interaction.user.tag}`
      });
      if (msg) await thread.send(msg);
      await interaction.reply(cv2.success('Thread Created', `Successfully created ${thread}`));
    } catch (err) {
      await interaction.reply(cv2.danger('Error', err.message));
    }
  }
});
// --- SET STATS CHANNEL COMMAND ---
commands.push({
  name: 'setstatschannel',
  description: 'Set a dedicated channel for /stats commands (prevents spam elsewhere)',
  category: 'utility',
  permissions: [PermissionFlagsBits.ManageGuild],
  options: [
    {
      name: 'channel',
      description: 'The channel to lock stats commands to',
      type: 7, // CHANNEL
      required: true
    }
  ],
  async executePrefix(message, args) {
    const channelMention = args[0];
    if (!channelMention) return message.reply('Please mention a channel.');
    const channelId = channelMention.replace(/<#|>/g, '');
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return message.reply(cv2.warn('Invalid Channel', 'Please mention a valid text channel.'));
    }

    db.setStatsChannel(message.guild.id, channel.id);
    await channel.permissionOverwrites.edit(message.guild.roles.everyone.id, {
      UseApplicationCommands: true
    }).catch(() => null);

    return message.reply(cv2.success('Config Updated', `The \`/stats\` command is now locked to ${channel} and slash commands have been enabled for everyone there.`));
  },
  async executeSlash(interaction) {
    const channel = interaction.options.getChannel('channel');
    
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return interaction.reply(cv2.warn('Invalid Channel', 'Please select a text or announcement channel.'));
    }

    db.setStatsChannel(interaction.guild.id, channel.id);
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
      UseApplicationCommands: true
    }).catch(() => null);

    return interaction.reply(cv2.success('Config Updated', `The \`/stats\` command is now locked to ${channel} and slash commands have been enabled for everyone there.`));
  }
});



commands.push({
  name: 'archivethread',
  description: 'Archive the current thread',
  category: 'utility',
  permissions: [PermissionFlagsBits.ManageThreads],
  async executeSlash(interaction) {
    if (!interaction.channel.isThread()) return interaction.reply(cv2.warn('Error', 'This is not a thread.'));
    try {
      await interaction.reply(cv2.success('Archived', 'Archiving thread now...'));
      await interaction.channel.setArchived(true, `Archived by ${interaction.user.tag}`);
    } catch (err) {
      await interaction.followUp(cv2.danger('Error', err.message)).catch(() => null);
    }
  }
});

commands.push({
  name: 'deletethread',
  description: 'Delete the current thread',
  category: 'utility',
  permissions: [PermissionFlagsBits.ManageThreads],
  async executeSlash(interaction) {
    if (!interaction.channel.isThread()) return interaction.reply(cv2.warn('Error', 'This is not a thread.'));
    try {
      await interaction.channel.delete(`Deleted by ${interaction.user.tag}`);
    } catch (err) {
      await interaction.reply(cv2.danger('Error', err.message)).catch(() => null);
    }
  }
});

commands.push({
  name: 'vcstatus',
  description: 'Toggle the Voice Channel live status text (Extra Owners only)',
  type: 1, // CHAT_INPUT
  default_member_permissions: String(PermissionFlagsBits.Administrator),
  options: [
    {
      name: 'state',
      description: 'Enable or disable the status updates',
      type: 3, // STRING
      required: true,
      choices: [
        { name: 'On', value: 'on' },
        { name: 'Off', value: 'off' }
      ]
    }
  ],
  async executePrefix(message, args) {
    const { isAuthorized } = await import('../utils/helpers.js');
    if (!await isAuthorized(message.author, message.guild)) {
      return message.reply(cv2.danger('Access Denied', 'Only authorized owners can use this.'));
    }
    
    const state = args[0]?.toLowerCase();
    if (!['on', 'off'].includes(state)) {
      return message.reply(cv2.warn('Invalid Usage', 'Please specify `on` or `off`. Example: `!vcstatus off`'));
    }
    
    const enabled = state === 'on';
    db.updateGuildConfig(message.guild.id, { vcStatusEnabled: enabled });
    
    const botVcId = message.guild.members.me?.voice?.channelId;
    if (botVcId) {
      const { updateBotVcStatus } = await import('../utils/voice.js');
      const channel = message.guild.channels.cache.get(botVcId);
      if (channel) await updateBotVcStatus(channel);
    }
    
    return message.reply(cv2.success('Config Updated', `Voice Channel status updates have been turned **${state.toUpperCase()}**.`));
  },
  async executeSlash(interaction) {
    const { isAuthorized } = await import('../utils/helpers.js');
    if (!await isAuthorized(interaction.user, interaction.guild)) {
      return interaction.reply(cv2.danger('Access Denied', 'Only authorized owners can use this.'));
    }

    const state = interaction.options.getString('state');
    const enabled = state === 'on';
    db.updateGuildConfig(interaction.guild.id, { vcStatusEnabled: enabled });
    
    const botVcId = interaction.guild.members.me?.voice?.channelId;
    if (botVcId) {
      const { updateBotVcStatus } = await import('../utils/voice.js');
      const channel = interaction.guild.channels.cache.get(botVcId);
      if (channel) await updateBotVcStatus(channel);
    }
    
    return interaction.reply(cv2.success('Config Updated', `Voice Channel status updates have been turned **${state.toUpperCase()}**.`));
  }
});

commands.push({
  name: 'dev',
  description: 'Shows the Lead Architect and Developer of Athena Prime',
  category: 'utility',
  options: [],
  async executePrefix(message) {
    return this._handleDev(message);
  },
  async executeSlash(interaction) {
    return this._handleDev(interaction);
  },
  async _handleDev(context) {
    const isInteraction = !!context.commandName;
    const client = context.client;
    // Get bot owner dynamically (handle Teams vs Single User)
    let ownerId = '1423292960744804383';
    try {
      if (!client.application?.owner) await client.application?.fetch();
      if (client.application?.owner?.ownerId) {
        ownerId = client.application.owner.ownerId; // It's a Team, get the owner of the team
      } else if (client.application?.owner?.id) {
        ownerId = client.application.owner.id; // It's a single User
      }
    } catch (e) {}

    let ownerName = '♡ 𝙋𝙧𝙞𝙣𝙘𝙚';
    try {
      const ownerUser = await client.users.fetch(ownerId);
      if (ownerUser) ownerName = ownerUser.globalName || ownerUser.username;
    } catch (e) {}

    const rawComponents = [
      {
        type: 10,
        content: '# __ELITE DEVELOPER INTELLIGENCE__\n### • Lead Architect\n' +
                 `-# **Athena Prime was systematically engineered and deployed by [${ownerName}](https://discord.com/users/${ownerId}). Driven by an absolute intolerance for server nukes and malicious raids, the Architect engineered a unified, omnipotent appliance—a single, definitive bot designed to dominate every facet of server security, management, and utility without compromise.**`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: '### • Core Features\n' +
                 '-# • **Anti-Nuke Engine:** **A predictive, zero-tolerance firewall that neutralizes structural threats in milliseconds and autonomously reconstructs deleted channels, roles, and server hierarchies via intelligent caching.**\n' +
                 '-# • **Dynamic Voice Infrastructure:** **An auto-scaling Join-To-Create (JTC) architecture equipped with granular, real-time control panels.**\n' +
                 '-# • **Advanced Threat Firewall:** **Heuristic anti-spam filtering, real-time malicious link scanning, and predictive quarantine protocols.**\n' +
                 '-# • **Zero-Trust Verification Gateway:** **A strict, automated access-control layer that dynamically audits Discord Onboarding configurations and strips bypassing permissions to prevent unauthorized infiltration.**\n' +
                 '-# • **Asynchronous Ticket Matrix:** **A highly-concurrent, transcript-generating support infrastructure built directly onto Discord\'s raw interaction API for seamless multi-channel thread management.**\n' +
                 '-# • **Omniscient Audit Telemetry:** **A deeply-integrated logging engine that intercepts, parses, and permanently archives server mutations, deleted messages, and role hierarchy alterations.**'
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: '### • Architecture\n' +
                 '-# **The core engine operates on a highly concurrent Node.js runtime, utilizing direct REST API invocations to bypass standard discord.js caching and manager overhead. This guarantees zero-latency, sub-millisecond execution for anti-nuke mechanisms via raw asynchronous HTTP streams. The proprietary CV2 UI framework was engineered as a polymorphic factory model to dynamically construct and hydrate atomic payload structures. It enforces strict memory allocation protocols and leverages non-blocking I/O event loops, ensuring maximum throughput, thread safety, and impenetrable scalability across distributed sharded environments.**'
      },
      { type: 14, divider: true },
      {
        type: 12,
        items: [{ media: { url: 'https://cdn.discordapp.com/attachments/1516850846984437801/1539301235369312256/content.png?ex=6a85d17d&is=6a847ffd&hm=1dc8831b54f332ef885aaf0b16b62d6c3af9cfecc7dc2004c651083277e55f2c&' } }]
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: '-# **Athena Prime | By Developer Prince**'
      }
    ];

    return context.reply({ components: [{ type: 17, components: rawComponents }], flags: MessageFlags.IsComponentsV2 });
  }
});




export const activeCalculators = new Map();

async function sendCalculator(context) {
  const isInteraction = !!context.isCommand;
  if (isInteraction) {
    await context.deferReply();
  }

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
  const cv2 = (await import('../cv2.js')).default;
  const embed = cv2.info('Athena Prime Calculator', `> # **\` 0 \`**`);

  const createRow = (btns) => {
    const row = new ActionRowBuilder();
    btns.forEach(btn => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`calc_${btn.id}`)
          .setLabel(btn.label)
          .setStyle(btn.style)
      );
    });
    return row;
  };

  const rows = [
    createRow([
      { id: 'clear', label: 'C', style: ButtonStyle.Danger },
      { id: 'lparen', label: '(', style: ButtonStyle.Primary },
      { id: 'rparen', label: ')', style: ButtonStyle.Primary },
      { id: 'div', label: '/', style: ButtonStyle.Primary },
      { id: 'del', label: 'DEL', style: ButtonStyle.Danger }
    ]),
    createRow([
      { id: '7', label: '7', style: ButtonStyle.Secondary },
      { id: '8', label: '8', style: ButtonStyle.Secondary },
      { id: '9', label: '9', style: ButtonStyle.Secondary },
      { id: 'mul', label: '*', style: ButtonStyle.Primary },
      { id: 'pow', label: '^', style: ButtonStyle.Primary }
    ]),
    createRow([
      { id: '4', label: '4', style: ButtonStyle.Secondary },
      { id: '5', label: '5', style: ButtonStyle.Secondary },
      { id: '6', label: '6', style: ButtonStyle.Secondary },
      { id: 'sub', label: '-', style: ButtonStyle.Primary },
      { id: 'mod', label: '%', style: ButtonStyle.Primary }
    ]),
    createRow([
      { id: '1', label: '1', style: ButtonStyle.Secondary },
      { id: '2', label: '2', style: ButtonStyle.Secondary },
      { id: '3', label: '3', style: ButtonStyle.Secondary },
      { id: 'add', label: '+', style: ButtonStyle.Primary },
      { id: 'empty', label: '\u200B', style: ButtonStyle.Secondary }
    ]),
    createRow([
      { id: 'dot', label: '.', style: ButtonStyle.Secondary },
      { id: '0', label: '0', style: ButtonStyle.Secondary },
      { id: '00', label: '00', style: ButtonStyle.Secondary },
      { id: 'equal', label: '=', style: ButtonStyle.Success },
      { id: 'close', label: 'Exit', style: ButtonStyle.Danger }
    ])
  ];

  rows[3].components[4].setDisabled(true); 

  embed.components.push(...rows);

  const payload = { ...embed, withResponse: true };
  let msg;
  
  if (isInteraction) {
    msg = await context.editReply(payload);
  } else {
    msg = await context.reply(payload);
  }
  
  activeCalculators.set(msg.id, { equation: '0', owner: isInteraction ? context.user.id : context.author.id });
}

export async function handleCalculatorButton(interaction) {
  const msgId = interaction.message.id;
  const session = activeCalculators.get(msgId);
  
  if (!session) {
    return interaction.reply({ content: 'This calculator session has expired.', flags: 64 });
  }
  
  if (session.owner !== interaction.user.id) {
    return interaction.reply({ content: 'This is not your calculator!', flags: 64 });
  }

  const action = interaction.customId.replace('calc_', '');
  let eq = session.equation;

  if (action === 'close') {
    activeCalculators.delete(msgId);
    return interaction.message.delete().catch(()=>{});
  }

  if (action === 'clear') {
    eq = '0';
  } else if (action === 'del') {
    eq = eq.length > 1 ? eq.slice(0, -1) : '0';
  } else if (action === 'equal') {
    try {
      const sanitized = eq.replace(/[^\d/*+.%^()-]/g, '');
      const withPow = sanitized.replace(/\^/g, '**');
      let result = Function('return ' + withPow)();
      if (!isFinite(result) || isNaN(result)) result = 'Error';
      if (typeof result === 'number' && !Number.isInteger(result)) {
        result = parseFloat(result.toFixed(4)).toString();
      } else {
        result = result.toString();
      }
      eq = result;
    } catch (err) {
      eq = 'Error';
    }
  } else {
    const charMap = {
      'lparen': '(', 'rparen': ')', 'div': '/', 'mul': '*',
      'sub': '-', 'add': '+', 'mod': '%', 'pow': '^',
      'dot': '.', '0': '0', '00': '00', '1': '1', '2': '2',
      '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
    };
    
    const char = charMap[action];
    if (char) {
      if (eq === '0' || eq === 'Error') {
        if (['/','*','+','-','%','^'].includes(char)) {
          eq = '0' + char;
        } else {
          eq = char;
        }
      } else {
        eq += char;
      }
    }
  }

  if (eq.length > 2000) eq = 'Error: Too long';
  session.equation = eq;

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
  const cv2 = (await import('../cv2.js')).default;
  const embed = cv2.info('Athena Prime Calculator', `> # **\` ${eq} \`**`);
  
  const createRow = (btns) => {
    const row = new ActionRowBuilder();
    btns.forEach(btn => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`calc_${btn.id}`)
          .setLabel(btn.label)
          .setStyle(btn.style)
      );
    });
    return row;
  };

  const rows = [
    createRow([
      { id: 'clear', label: 'C', style: ButtonStyle.Danger },
      { id: 'lparen', label: '(', style: ButtonStyle.Primary },
      { id: 'rparen', label: ')', style: ButtonStyle.Primary },
      { id: 'div', label: '/', style: ButtonStyle.Primary },
      { id: 'del', label: 'DEL', style: ButtonStyle.Danger }
    ]),
    createRow([
      { id: '7', label: '7', style: ButtonStyle.Secondary },
      { id: '8', label: '8', style: ButtonStyle.Secondary },
      { id: '9', label: '9', style: ButtonStyle.Secondary },
      { id: 'mul', label: '*', style: ButtonStyle.Primary },
      { id: 'pow', label: '^', style: ButtonStyle.Primary }
    ]),
    createRow([
      { id: '4', label: '4', style: ButtonStyle.Secondary },
      { id: '5', label: '5', style: ButtonStyle.Secondary },
      { id: '6', label: '6', style: ButtonStyle.Secondary },
      { id: 'sub', label: '-', style: ButtonStyle.Primary },
      { id: 'mod', label: '%', style: ButtonStyle.Primary }
    ]),
    createRow([
      { id: '1', label: '1', style: ButtonStyle.Secondary },
      { id: '2', label: '2', style: ButtonStyle.Secondary },
      { id: '3', label: '3', style: ButtonStyle.Secondary },
      { id: 'add', label: '+', style: ButtonStyle.Primary },
      { id: 'empty', label: '\u200B', style: ButtonStyle.Secondary }
    ]),
    createRow([
      { id: 'dot', label: '.', style: ButtonStyle.Secondary },
      { id: '0', label: '0', style: ButtonStyle.Secondary },
      { id: '00', label: '00', style: ButtonStyle.Secondary },
      { id: 'equal', label: '=', style: ButtonStyle.Success },
      { id: 'close', label: 'Exit', style: ButtonStyle.Danger }
    ])
  ];

  rows[3].components[4].setDisabled(true); 

  embed.components.push(...rows);
  
  await interaction.update({ ...embed });
}
