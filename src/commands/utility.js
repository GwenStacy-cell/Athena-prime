import { PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

export const commands = [
  // --- HELP COMMAND ---
  {
    name: 'help',
    description: 'Lists all available security and moderation commands.',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      const result = await getHelpEmbed(message.guild);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const result = await getHelpEmbed(interaction.guild);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- PING COMMAND ---
  {
    name: 'ping',
    description: 'Checks the bot and gateway latency.',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      const response = await message.reply('Pinging WebSocket...');
      const pingMs = response.createdTimestamp - message.createdTimestamp;
      const apiMs = Math.round(message.client.ws.ping);
      
      const pingEmbed = embed.info(
        'Pong! Latency Report',
        `📡 Gateway Connection details:`,
        [
          { name: 'Bot Latency', value: `**${pingMs}ms**`, inline: true },
          { name: 'Discord API Gateway', value: `**${apiMs}ms**`, inline: true }
        ]
      );
      await response.edit({ content: null, embeds: [pingEmbed] });
    },
    async executeSlash(interaction) {
      const sent = await interaction.reply({ content: 'Pinging WebSocket...', fetchReply: true });
      const pingMs = sent.createdTimestamp - interaction.createdTimestamp;
      const apiMs = Math.round(interaction.client.ws.ping);

      const pingEmbed = embed.info(
        'Pong! Latency Report',
        `📡 Gateway Connection details:`,
        [
          { name: 'Bot Latency', value: `**${pingMs}ms**`, inline: true },
          { name: 'Discord API Gateway', value: `**${apiMs}ms**`, inline: true }
        ]
      );
      await interaction.editReply({ content: null, embeds: [pingEmbed] });
    }
  },

  // --- SETUP COMMAND ---
  {
    name: 'setup',
    description: 'Configures bot logs channel, quarantine voice, or settings.',
    category: 'utility',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'logchannel',
        description: 'Designate the text channel for security logs',
        type: 7, // Channel
        required: false
      },
      {
        name: 'quarantinevc',
        description: 'Designate the Voice Channel for isolating quarantined users',
        type: 7, // Channel
        required: false
      },
      {
        name: 'quarantinerole',
        description: 'Designate an existing role as the Quarantine role',
        type: 8, // Role
        required: false
      }
    ],
    async executePrefix(message, args) {
      const channel = message.mentions.channels.first();
      const role = message.mentions.roles.first();
      
      // Resolve first mentioned or matched voice channel in args
      const voiceChannel = message.guild.channels.cache.find(
        c => c.type === ChannelType.GuildVoice && 
        args.some(arg => arg.includes(c.id) || arg.toLowerCase() === c.name.toLowerCase())
      );

      if (!channel && !role && !voiceChannel) {
        return message.reply({ embeds: [embed.warn('Setup Info', `${message.author} Usage: \`!setup <#logChannel>\` or \`!setup <quarantineVoiceChannelName>\` or \`!setup <@quarantineRole>\``)] });
      }

      const result = await handleSetup(message.guild, channel, role, voiceChannel);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const channel = interaction.options.getChannel('logchannel');
      const voiceChannel = interaction.options.getChannel('quarantinevc');
      const role = interaction.options.getRole('quarantinerole');

      if (channel && channel.type !== ChannelType.GuildText) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Logs channel must be a text channel.`)], ephemeral: true });
      }
      if (voiceChannel && voiceChannel.type !== ChannelType.GuildVoice) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Quarantine VC must be a voice channel.`)], ephemeral: true });
      }

      const result = await handleSetup(interaction.guild, channel, role, voiceChannel);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- STATUS COMMAND ---
  {
    name: 'status',
    description: 'Displays the Athena Prime security status overview and bot health.',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      const result = await getStatusEmbed(message.client, message.guild);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const result = await getStatusEmbed(interaction.client, interaction.guild);
      await interaction.reply({ embeds: [result.embed] });
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

  const antiNukeStatus = config.antiNukeEnabled ? '🟢 **ACTIVE**' : '🔴 **DISABLED**';
  const antiSpamStatus = config.antiSpamEnabled ? '🟢 **ACTIVE**' : '🔴 **DISABLED**';
  const antiInviteStatus = (config.antiInviteEnabled !== false) ? '🟢 **ACTIVE**' : '🔴 **DISABLED**';
  const antiLinkStatus = config.antiLinkEnabled ? '🟢 **ACTIVE**' : '🔴 **DISABLED**';
  const raidModeStatus = config.raidMode ? '🚨 **ENGAGED**' : '🟢 **STANDBY**';

  const fields = [
    { name: '⏱️ Bot Uptime', value: formatUptime(uptimeMs), inline: true },
    { name: '📡 Gateway Latency', value: `**${apiMs}ms**`, inline: true },
    { name: '🌐 Servers Protected', value: `**${client.guilds.cache.size}**`, inline: true },
    { name: '🛡️ Anti-Nuke Shield', value: antiNukeStatus, inline: true },
    { name: '⚡ Anti-Spam Filter', value: antiSpamStatus, inline: true },
    { name: '🔗 Anti-Invite Blocker', value: antiInviteStatus, inline: true },
    { name: '🌐 Anti-Link Filter', value: antiLinkStatus, inline: true },
    { name: '🚨 Raid Mode', value: raidModeStatus, inline: true },
    { name: '⚠️ Warning Ceiling', value: `\`${config.maxWarnings} Warnings\``, inline: true }
  ];

  const statusEmbed = embed.security(
    'Athena Prime — Security Status',
    `Real-time security overview for **${guild.name}**.\nAll systems are operational and monitoring server activity.\n\n**🛡️ God Level Security — ENABLED**`,
    fields
  );

  return { embed: statusEmbed };
}

async function getHelpEmbed(guild) {
  const config = db.getGuildConfig(guild?.id || '0');
  const p = config?.prefix || '!';

  const fields = [
    // ─────────────────────────────────────────
    {
      name: '🛡️ Anti-Nuke & Firewall',
      value:
        `\`${p}security <enable all|disable all>\` — Toggle ALL shields at once *(Bot/Server Owner only)*\n` +
        `\`${p}antinuke <enable all|disable all|config>\` — Open interactive config panel or bulk-toggle\n` +
        `\`${p}config <setting> <on|off>\` — Toggle antinuke / antispam / antiinvite / maxwarnings\n` +
        `\`${p}raidmode <on|off>\` — Auto-quarantine every new join during a raid\n` +
        `\`${p}botwhitelist <add|remove|list> <botId>\` — Permit trusted bots from bot-add guard`
    },
    // ─────────────────────────────────────────
    {
      name: '🔗 Link & Invite Filters',
      value:
        `\`${p}antilink <on|off>\` — Block all external links from non-moderators\n` +
        `\`${p}linksallow <add|remove|list> [domain]\` — Whitelist domains (youtube.com, tenor.com…)\n` +
        `\`${p}blacklist <add|remove|list> [phrase]\` — Auto-delete & warn messages matching phrases`
    },
    // ─────────────────────────────────────────
    {
      name: '✅ Whitelist & Permissions',
      value:
        `\`${p}whitelist <add|remove|list> [@user] [events...]\` — Per-event immunity\n` +
        `> Events: \`all\` \`antinuke\` \`antibot\` \`antispam\` \`antilink\` \`antiinvite\` \`quarantine\`\n` +
        `\`${p}extraowner <add|remove|list> [@user]\` — Grant full bot access to trusted users`
    },
    // ─────────────────────────────────────────
    {
      name: '🔒 Quarantine & Isolation',
      value:
        `\`${p}quarantine <@user> [duration] [reason]\` — Strip roles & isolate (alias: \`${p}qr\`)\n` +
        `\`${p}unquarantine <@user>\` — Restore roles & release from isolation\n` +
        `\`${p}massquarantine <@role> [reason]\` — Quarantine all members of a role at once\n` +
        `\`${p}massunquarantine\` — Release all currently quarantined members\n` +
        `\`${p}qrmanager <setup|setrole|setchannel|setvc|status>\` — Configure quarantine infrastructure\n` +
        `\`${p}setup [#logchannel] [quarantineVC] [@quarantineRole]\` — Quick bind all at once\n` +
        `\`${p}lockdown <on|off>\` — Prevent @everyone from sending messages in a channel`
    },
    // ─────────────────────────────────────────
    {
      name: '🔨 Moderation & Member Management',
      value:
        `\`${p}warn <@user> <reason>\` — Issue a warning (auto-quarantine at threshold)\n` +
        `\`${p}warnings <@user>\` / \`${p}clearwarns <@user>\` — View or clear warning history\n` +
        `\`${p}timeout <@user> <dur> [reason]\` — Timeout a member (e.g. \`5m\`, \`1h\`, \`1d\`)\n` +
        `\`${p}kick <@user> [reason]\` — Kick a member from the server\n` +
        `\`${p}ban <@user|id> [reason]\` — Ban by mention or raw User ID\n` +
        `\`${p}unban <userId>\` — Unban by User ID\n` +
        `\`${p}unbanall\` — Mass-unban all banned users\n` +
        `\`${p}muteall\` / \`${p}unmuteall\` — Server-mute/unmute everyone in your VC\n` +
        `\`${p}purge <1–100>\` — Bulk-delete messages from current channel\n` +
        `\`${p}slowmode <seconds>\` — Set channel slowmode (0 = off)\n` +
        `\`${p}createrole <name> [color]\` / \`${p}deleterole <@role>\` — Create or delete roles`
    },
    // ─────────────────────────────────────────
    {
      name: '📢 Announcements & Messaging',
      value:
        `\`${p}say <#channel> <message>\` — Send an anonymous bot message\n` +
        `\`${p}announce <#channel> <title> | <message>\` — Post a styled announcement embed\n` +
        `\`${p}modmode <on|off>\` — Toggle Mod Mode (restricts channels to mods-only instantly)`
    },
    // ─────────────────────────────────────────
    {
      name: '🎤 Voice & JTC (Join-to-Create)',
      value:
        `\`${p}jtcsetup <#voicechannel>\` — Designate a channel as the JTC creator hub\n` +
        `\`${p}jtcdisable\` — Remove the JTC system from the server\n` +
        `\`${p}vc\` — Manage your personal JTC voice channel (rename, limit, privacy, etc.)\n` +
        `\`${p}sethomevc [channel]\` — Set bot's permanent Home Voice Channel (rejoins if moved)\n` +
        `\`${p}unsethomevc\` — Remove Home VC setting and disconnect the bot from voice\n` +
        `\`${p}deafen <deafen|undeafen>\` — Toggle the bot's self-deafen in VC\n` +
        `\`${p}muteall\` / \`${p}unmuteall\` — Server-mute/unmute all users in your current VC`
    },
    // ─────────────────────────────────────────
    {
      name: '🌀 VC Drag',
      value:
        `\`${p}vcdrag <@user> [interval]\` — Endlessly drag a user through VCs (default: 2s)\n` +
        `\`${p}vcdragstop <@user>\` — Stop a drag session for a specific user\n` +
        `\`${p}vcdraglist\` — Show all currently active drag sessions in the server`
    },
    // ─────────────────────────────────────────
    {
      name: '👋 Welcome & Leave System',
      value:
        `\`${p}welcome\` — Open the Welcome message manager (channel, embed, roles)\n` +
        `\`${p}leave\` — Open the Leave message manager (channel & embed customization)\n` +
        `> Both support fully customizable embed messages with \`{user}\`, \`{server}\`, \`{count}\` placeholders.`
    },
    // ─────────────────────────────────────────
    {
      name: '🤖 Auto-Responder & Triggers',
      value:
        `\`${p}trigger create <match> | <response>\` — Add a custom keyword trigger response\n` +
        `\`${p}trigger remove <match>\` — Delete a trigger by its match phrase\n` +
        `\`${p}trigger list\` — Show all active auto-responders in this server`
    },
    // ─────────────────────────────────────────
    {
      name: '🎨 Customization & Appearance',
      value:
        `\`${p}accent\` — Set a custom embed accent color from 10 presets or any hex code\n` +
        `\`${p}autonick <on|off> [prefix] [suffix]\` — Auto-format new member nicknames\n` +
        `\`${p}setguildavatar <url|attach>\` — Set bot's custom per-server avatar\n` +
        `\`${p}setguildbanner <url|attach>\` — Set bot's custom per-server banner`
    },
    // ─────────────────────────────────────────
    {
      name: '⚙️ Utilities & Info',
      value:
        `\`${p}status\` — Real-time security health overview for this server\n` +
        `\`${p}serverinfo\` — Full server statistics, security state & member breakdown\n` +
        `\`${p}userinfo [@user]\` — User profile, roles, warnings & privilege level\n` +
        `\`${p}ping\` — WebSocket & API latency check\n` +
        `\`${p}setup\` — Bind log channel, quarantine VC & quarantine role quickly\n` +
        `\`${p}help\` — Show this command console\n\n` +
        `> All commands work as **\`${p}prefix\`** and **\`/slash\`** interactions.\n` +
        `> **Bot Owner**, **Server Owner**, and **Extra Owners** bypass all permission checks.`
    }
  ];

  const helpEmbed = embed.info(
    'Athena Prime — Command Console',
    `🛡️ **God-Level Security System** — Active in **${guild?.name || 'your server'}**\n\nAll **${fields.length} categories** below. Every command works as both \`${p}prefix\` and \`/slash\` interaction.`,
    fields
  );

  return { embed: helpEmbed };
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

  const resEmbed = embed.success(
    'Configuration Updated',
    'Successfully saved server adjustments to database cache.',
    fields
  );

  return { embed: resEmbed };
}
