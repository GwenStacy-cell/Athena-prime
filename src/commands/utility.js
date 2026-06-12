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
    {
      name: 'SECURITY  &  FIREWALL',
      value:
        `\`${p}security\` **enable all** / **disable all** — Toggle all shields at once\n` +
        `\`${p}antinuke\` **enable** / **disable** / **config** — Interactive config panel\n` +
        `\`${p}config\` **antinuke** / **antispam** / **antiinvite** / **maxwarnings** \`on|off\`\n` +
        `\`${p}raidmode\` **on** / **off** — Auto-quarantine every new join during a raid\n` +
        `\`${p}botwhitelist\` **add** / **remove** / **list** \`botId\` — Permit trusted bots`
    },
    {
      name: 'LINK  &  INVITE  FILTERS',
      value:
        `\`${p}antilink\` **on** / **off** — Block all external links from non-moderators\n` +
        `\`${p}linksallow\` **add** / **remove** / **list** \`domain\` — Whitelist domains\n` +
        `\`${p}blacklist\` **add** / **remove** / **list** \`phrase\` — Auto-delete matching messages`
    },
    {
      name: 'WHITELIST  &  PERMISSIONS',
      value:
        `\`${p}whitelist\` **add** / **remove** / **list** \`@user\` \`[events...]\`\n` +
        `> Events: \`all\`  \`antinuke\`  \`antibot\`  \`antispam\`  \`antilink\`  \`antiinvite\`  \`quarantine\`\n` +
        `\`${p}extraowner\` **add** / **remove** / **list** \`@user\` — Grant full bot access`
    },
    {
      name: 'QUARANTINE  &  ISOLATION',
      value:
        `\`${p}quarantine\` \`@user\` \`[duration]\` \`[reason]\` — Strip roles & isolate  *(alias:* \`${p}qr\`*)*\n` +
        `\`${p}unquarantine\` \`@user\` — Restore roles and release from isolation\n` +
        `\`${p}massquarantine\` \`@role\` — Quarantine all members of a role at once\n` +
        `\`${p}massunquarantine\` — Release all currently quarantined members\n` +
        `\`${p}qrmanager\` **setup** / **setrole** / **setchannel** / **setvc** / **status**\n` +
        `\`${p}lockdown\` **on** / **off** — Restrict channel to moderators only`
    },
    {
      name: 'MODERATION',
      value:
        `\`${p}warn\` \`@user\` \`reason\` — Issue a warning  *(auto-quarantine at threshold)*\n` +
        `\`${p}warnings\` / \`${p}clearwarns\` \`@user\` — View or wipe warning history\n` +
        `\`${p}timeout\` \`@user\` \`dur\` — Timeout a member  \`5m\` \`1h\` \`1d\`\n` +
        `\`${p}kick\` / \`${p}ban\` / \`${p}unban\` / \`${p}unbanall\` — Standard moderation actions\n` +
        `\`${p}muteall\` / \`${p}unmuteall\` — Server-mute/unmute your current VC\n` +
        `\`${p}purge\` \`1–100\` — Bulk-delete messages from current channel\n` +
        `\`${p}slowmode\` \`seconds\` — Set channel slowmode  *(0 = off)*\n` +
        `\`${p}createrole\` / \`${p}deleterole\` — Create or delete a role`
    },
    {
      name: 'ANNOUNCEMENTS  &  MESSAGING',
      value:
        `\`${p}say\` \`#channel\` \`message\` — Send an anonymous bot message\n` +
        `\`${p}announce\` \`#channel\` \`title | message\` — Post a styled announcement embed\n` +
        `\`${p}modmode\` **on** / **off** — Restrict all channels to moderators instantly`
    },
    {
      name: 'VOICE  &  JOIN-TO-CREATE',
      value:
        `\`${p}jtcsetup\` \`#voicechannel\` — Designate the JTC creator channel\n` +
        `\`${p}jtcdisable\` — Remove the JTC system from this server\n` +
        `\`${p}vc\` — Manage your personal JTC channel  *(rename, limit, privacy…)*\n` +
        `\`${p}sethomevc\` \`[channel]\` — Set bot's Home VC  *(auto-rejoin if moved)*\n` +
        `\`${p}unsethomevc\` — Clear Home VC and disconnect the bot\n` +
        `\`${p}deafen\` / \`${p}muteall\` / \`${p}unmuteall\` — Voice management tools`
    },
    {
      name: 'VC DRAG',
      value:
        `\`${p}vcdrag\` \`@user\` \`[interval]\` — Drag a user endlessly through VCs  *(default: 2s)*\n` +
        `\`${p}vcdragstop\` \`@user\` — Stop the drag session for a specific user\n` +
        `\`${p}vcdraglist\` — View all currently active drag sessions`
    },
    {
      name: 'WELCOME  &  LEAVE',
      value:
        `\`${p}welcome\` — Open the Welcome message manager\n` +
        `\`${p}leave\` — Open the Leave message manager\n` +
        `> Supports \`{user}\`  \`{server}\`  \`{count}\` placeholders in custom embeds`
    },
    {
      name: 'AUTO-RESPONDER',
      value:
        `\`${p}trigger\` **create** \`match | response\` — Add a custom keyword trigger\n` +
        `\`${p}trigger\` **remove** \`match\` — Delete a trigger\n` +
        `\`${p}trigger\` **list** — View all active triggers in this server`
    },
    {
      name: 'CUSTOMIZATION',
      value:
        `\`${p}accent\` — Set the embed accent color  *(10 pure presets + custom hex)*\n` +
        `\`${p}autonick\` **on** / **off** \`[prefix]\` \`[suffix]\` — Auto-format member nicknames\n` +
        `\`${p}setguildavatar\` — Set bot's custom per-server avatar\n` +
        `\`${p}setguildbanner\` — Set bot's custom per-server banner`
    },
    {
      name: 'UTILITIES',
      value:
        `\`${p}status\` — Real-time security health overview\n` +
        `\`${p}serverinfo\` — Full server statistics and security state\n` +
        `\`${p}userinfo\` \`[@user]\` — Profile, roles, warnings and privilege level\n` +
        `\`${p}ping\` — WebSocket and API latency\n` +
        `\`${p}setup\` — Quick-bind log channel, quarantine VC and quarantine role\n` +
        `\`${p}help\` — This command console\n\n` +
        `> Every command works as \`${p}prefix\` and \`/slash\`.\n` +
        `> Bot Owner, Server Owner, and Extra Owners bypass all permission checks.`
    }
  ];

  const helpEmbed = embed.info(
    'Athena Prime',
    `**Command Console** — ${guild?.name || 'your server'}\n\u200b`,
    fields,
    guild?.id
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
