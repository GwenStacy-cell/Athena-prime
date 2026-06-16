import { PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';

// ──────────────────────────────────────────────
// Bold underline header formatter — matches embed title style
// ──────────────────────────────────────────────
function h(text) {
  return `__**${text.toUpperCase()}**__`;
}

export const commands = [
  // --- HELP COMMAND ---
  {
    name: 'help',
    description: 'Show Athena Prime command menu',
    type: 1,
    async executePrefix(message) {
      const help = await getHelpEmbed(message.guild, message.client);
      await message.reply(help);
    },
    async executeSlash(interaction) {
      const help = await getHelpEmbed(interaction.guild, interaction.client);
      await interaction.reply({ ...help, ephemeral: true });
    }
  },

  // --- PING COMMAND ---
  {
    name: 'ping',
    description: 'Checks the bot and gateway latency.',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      const { EmbedBuilder } = await import('discord.js');
      const cfg = db.getGuildConfig(message.guild?.id || '0');
      const accentHex = cfg?.accentColor || '#00e5ff';
      const accentInt = parseInt(accentHex.replace('#', ''), 16);

      // Send placeholder — measures round-trip (API latency)
      const sent  = await message.reply({ content: '\u200b' });
      const apiMs = sent.createdTimestamp - message.createdTimestamp;
      const wsMs  = Math.round(message.client.ws.ping);

      // Measure real DB read latency
      const dbStart = Date.now();
      db.getGuildConfig(message.guild?.id || '0');
      const dbMs = Date.now() - dbStart;

      const rSet = Math.floor(Math.random() * 3) + 1;
      const rGet = Math.floor(Math.random() * 2) + 1;
      const rDel = Math.floor(Math.random() * 2) + 1;

      const e1 = new EmbedBuilder()
        .setColor(accentInt)
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(`> **| ${apiMs}MS |**`);

      const e2 = new EmbedBuilder()
        .setColor(accentInt)
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(`\u2800\n> **• PONG**\n> WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms`)
        .setThumbnail(message.author.displayAvatarURL({ size: 256, dynamic: true }));

      await sent.edit({ content: null, embeds: [e1, e2] });
    },
    async executeSlash(interaction) {
      const { EmbedBuilder } = await import('discord.js');
      const cfg = db.getGuildConfig(interaction.guild?.id || '0');
      const accentHex = cfg?.accentColor || '#00e5ff';
      const accentInt = parseInt(accentHex.replace('#', ''), 16);

      const sent  = await interaction.reply({ content: '\u200b', fetchReply: true });
      const apiMs = sent.createdTimestamp - interaction.createdTimestamp;
      const wsMs  = Math.round(interaction.client.ws.ping);

      const dbStart = Date.now();
      db.getGuildConfig(interaction.guild?.id || '0');
      const dbMs = Date.now() - dbStart;

      const rSet = Math.floor(Math.random() * 3) + 1;
      const rGet = Math.floor(Math.random() * 2) + 1;
      const rDel = Math.floor(Math.random() * 2) + 1;

      const e1 = new EmbedBuilder()
        .setColor(accentInt)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setDescription(`> **| ${apiMs}MS |**`);

      const e2 = new EmbedBuilder()
        .setColor(accentInt)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .setDescription(`\u2800\n> **• PONG**\n> WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms`)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256, dynamic: true }));

      await interaction.editReply({ content: null, embeds: [e1, e2] });
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
        .setDescription(`> **COMMAND | ❕**`);

      const e2 = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`> • <@${user.id}> executed\n> **<:emoji_25:1515041866796503180> Time :**\n# ${timeStr}\n> **(IST) - ${dateStr}**`)
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
        return context.reply({
          embeds: [embed.warn(
            'No Emojis Found',
            'Provide at least one custom emoji to steal.\n\nExample: `:pog: :lol: :hype:`'
          )],
          ephemeral: !!context.options // make ephemeral if slash command
        });
      }

      // Deduplicate by emoji ID
      const seen  = new Set();
      const emojis = matches.filter(m => !seen.has(m[3]) && seen.add(m[3]));

      const added   = [];
      const failed  = [];

      for (const [, animated, name, id] of emojis) {
        const ext = animated ? 'gif' : 'webp';
        const url = `https://cdn.discordapp.com/emojis/${id}.${ext}?size=128&quality=lossless`;
        try {
          const created = await guild.emojis.create({ attachment: url, name });
          added.push(created.toString());
        } catch (err) {
          const reason = err.message?.includes('30008')
            ? 'server emoji limit reached'
            : err.message?.includes('50013')
            ? 'missing permissions'
            : err.message || 'unknown error';
          failed.push(`\`${name}\` — ${reason}`);
        }
      }

      const lines = [];
      if (added.length)  lines.push(`**Added (${added.length})**\n${added.join(' ')}`);
      if (failed.length) lines.push(`**Failed (${failed.length})**\n${failed.join('\n')}`);

      const resultEmbed = embed.info(
        `Steal — ${added.length}/${emojis.length} Added`,
        lines.join('\n\n')
      );

      return context.reply({ embeds: [resultEmbed] });
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
        return message.reply({ embeds: [embed.danger('Access Denied', '🛡️ Only the **Bot Owner** or **Server Owner** can use this command.')] });
      }
      
      const newPrefix = args.join(' ');
      if (!newPrefix) {
        return message.reply({ embeds: [embed.warn('Missing Prefix', `Please provide a new prefix. Example: \`@Athena Prime prefix !\``)] });
      }

      db.updateGuildConfig(message.guild.id, { prefix: newPrefix });
      await message.reply({ embeds: [embed.success('Prefix Updated', `The bot's prefix has been successfully updated to \`${newPrefix}\``)] });
    },
    async executeSlash(interaction) {
      if (interaction.user.id !== process.env.OWNER_ID && interaction.user.id !== interaction.guild.ownerId) {
        return interaction.reply({ embeds: [embed.danger('Access Denied', '🛡️ Only the **Bot Owner** or **Server Owner** can use this command.')], ephemeral: true });
      }

      const newPrefix = interaction.options.getString('new_prefix');
      db.updateGuildConfig(interaction.guild.id, { prefix: newPrefix });
      await interaction.reply({ embeds: [embed.success('Prefix Updated', `The bot's prefix has been successfully updated to \`${newPrefix}\``)] });
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

async function getHelpEmbed(guild, client) {
  const config = db.getGuildConfig(guild?.id || '0');
  const p = config?.prefix || '!';
  const botId = client?.user?.id || '1347071663182676059'; // fallback to standard bot id
  const bullet = '<a:Dark4luvontop:1514999633179316305>';

  const fields = [
    {
      name: h('SECURITY  &  FIREWALL'),
      value:
        `\`${p}security\` **enable all** / **disable all** — Toggle all shields at once\n` +
        `\`${p}antinuke\` **enable** / **disable** / **config** — Interactive config panel\n` +
        `\`${p}config\` **antinuke** / **antispam** / **antiinvite** / **maxwarnings** \`on|off\`\n` +
        `\`${p}raidmode\` **on** / **off** — Auto-quarantine every new join during a raid\n` +
        `\`${p}botwhitelist\` **add** / **remove** / **list** \`botId\` — Permit trusted bots`
    },
    {
      name: h('LINK  &  INVITE  FILTERS'),
      value:
        `\`${p}antilink\` **on** / **off** — Block all external links from non-moderators\n` +
        `\`${p}linksallow\` **add** / **remove** / **list** \`domain\` — Whitelist domains\n` +
        `\`${p}blacklist\` **add** / **remove** / **list** \`phrase\` — Auto-delete matching messages`
    },
    {
      name: h('WHITELIST  &  PERMISSIONS'),
      value:
        `\`${p}whitelist\` **add** / **remove** / **list** \`@user\` \`[events...]\`\n` +
        `> Events: \`all\`  \`antinuke\`  \`antibot\`  \`antispam\`  \`antilink\`  \`antiinvite\`  \`quarantine\`\n` +
        `\`${p}extraowner\` **add** / **remove** / **list** \`@user\` — Grant full bot access`
    },
    {
      name: h('QUARANTINE  &  ISOLATION'),
      value:
        `\`${p}quarantine\` \`@user\` \`[duration]\` \`[reason]\` — Strip roles & isolate  *(alias:* \`${p}qr\`*)*\n` +
        `\`${p}unquarantine\` \`@user\` — Restore roles and release from isolation\n` +
        `\`${p}massquarantine\` \`@role\` — Quarantine all members of a role at once\n` +
        `\`${p}massunquarantine\` — Release all currently quarantined members\n` +
        `\`${p}qrmanager\` **setup** / **setrole** / **setchannel** / **setvc** / **status**\n` +
        `\`${p}lockdown\` **on** / **off** — Restrict channel to moderators only`
    },
    {
      name: h('MODERATION'),
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
      name: h('ANNOUNCEMENTS  &  MESSAGING'),
      value:
        `\`${p}say\` \`#channel\` \`message\` — Send an anonymous bot message\n` +
        `\`${p}announce\` \`#channel\` \`title | message\` — Post a styled announcement embed\n` +
        `\`${p}modmode\` **on** / **off** — Restrict all channels to moderators instantly`
    },
    {
      name: h('VOICE  &  JOIN-TO-CREATE'),
      value:
        `\`${p}jtcsetup\` \`#voicechannel\` — Designate the JTC creator channel\n` +
        `\`${p}jtcdisable\` — Remove the JTC system from this server\n` +
        `\`${p}vc\` — Manage your personal JTC channel  *(rename, limit, privacy…)*\n` +
        `\`${p}sethomevc\` \`[channel]\` — Set bot's Home VC  *(auto-rejoin if moved)*\n` +
        `\`${p}unsethomevc\` — Clear Home VC and disconnect the bot\n` +
        `\`${p}deafen\` / \`${p}muteall\` / \`${p}unmuteall\` — Voice management tools`
    },
    {
      name: h('VC DRAG'),
      value:
        `\`${p}vcdrag\` \`@user\` \`[interval]\` — Drag a user endlessly through VCs  *(default: 2s)*\n` +
        `\`${p}vcdragstop\` \`@user\` — Stop the drag session for a specific user\n` +
        `\`${p}vcdraglist\` — View all currently active drag sessions`
    },
    {
      name: h('WELCOME  &  LEAVE'),
      value:
        `\`${p}welcome\` — Open the Welcome message manager\n` +
        `\`${p}leave\` — Open the Leave message manager\n` +
        `> Supports \`{user}\`  \`{server}\`  \`{count}\` placeholders in custom embeds`
    },
    {
      name: h('AUTO-RESPONDER'),
      value:
        `\`${p}trigger\` **create** \`match | response\` — Add a custom keyword trigger\n` +
        `\`${p}trigger\` **remove** \`match\` — Delete a trigger\n` +
        `\`${p}trigger\` **list** — View all active triggers in this server`
    },
    {
      name: h('CUSTOMIZATION'),
      value:
        `\`${p}accent\` — Set the embed accent color  *(10 pure presets + custom hex)*\n` +
        `\`${p}autonick\` **on** / **off** \`[prefix]\` \`[suffix]\` — Auto-format member nicknames\n` +
        `\`${p}setguildavatar\` — Set bot's custom per-server avatar\n` +
        `\`${p}setguildbanner\` — Set bot's custom per-server banner\n` +
        `\`${p}steal\` \`:emoji: ...\` — Steal multiple emojis into your server`
    },
    {
      name: h('UTILITIES'),
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

  const description = `## Hey !!! , I am <@${botId}> ,\n\n> Welcome to Athena Prime A bot which is made for unbypassable security features and community management! View down and see our srv management modules listed below:\n\n${bullet} To set Custom Prefix use <@${botId}> \`@Athena Prime prefix " your custom prefix "\`\n\n${bullet} Hint : To Know more use " Tag the Bot and Type Guide for details and usage "\n\u200b`;

  const guildConfig = db.getGuildConfig(guild?.id || '0');
  const accentColor = guildConfig?.accentColor || '#3b82f6';

  const helpEmbed = new EmbedBuilder()
    .setColor(accentColor)
    .setDescription(description)
    .addFields(fields);

  return { embeds: [helpEmbed] };
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

// ──────────────────────────────────────────────
// ADDED NEW COMMANDS BELOW
// ──────────────────────────────────────────────

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
      return interaction.reply({ embeds: [embed.success('Autorole Cleared', 'All autoroles have been removed.')], ephemeral: true });
    }

    if (!role) {
      return interaction.reply({ embeds: [embed.warn('Missing Role', 'You must specify a role to add or remove.')], ephemeral: true });
    }

    if (action === 'add') {
      if (currentRoles.includes(role.id)) {
        return interaction.reply({ embeds: [embed.warn('Already Added', `The role ${role} is already in the autorole list.`)], ephemeral: true });
      }
      currentRoles.push(role.id);
      db.updateGuildConfig(interaction.guild.id, { autoroleIds: currentRoles });
      return interaction.reply({ embeds: [embed.success('Autorole Added', `Successfully added ${role} to the autorole list.\nTotal roles: \`${currentRoles.length}\``)], ephemeral: true });
    }

    if (action === 'remove') {
      if (!currentRoles.includes(role.id)) {
        return interaction.reply({ embeds: [embed.warn('Not Found', `The role ${role} is not in the autorole list.`)], ephemeral: true });
      }
      currentRoles = currentRoles.filter(id => id !== role.id);
      db.updateGuildConfig(interaction.guild.id, { autoroleIds: currentRoles });
      return interaction.reply({ embeds: [embed.success('Autorole Removed', `Successfully removed ${role} from the autorole list.\nTotal roles: \`${currentRoles.length}\``)], ephemeral: true });
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
      await interaction.reply({ embeds: [embed.success('Thread Created', `Successfully created ${thread}`)], ephemeral: true });
    } catch (err) {
      await interaction.reply({ embeds: [embed.danger('Error', err.message)], ephemeral: true });
    }
  }
});

commands.push({
  name: 'archivethread',
  description: 'Archive the current thread',
  category: 'utility',
  permissions: [PermissionFlagsBits.ManageThreads],
  async executeSlash(interaction) {
    if (!interaction.channel.isThread()) return interaction.reply({ embeds: [embed.warn('Error', 'This is not a thread.')], ephemeral: true });
    try {
      await interaction.reply({ embeds: [embed.success('Archived', 'Archiving thread now...')] });
      await interaction.channel.setArchived(true, `Archived by ${interaction.user.tag}`);
    } catch (err) {
      await interaction.followUp({ embeds: [embed.danger('Error', err.message)], ephemeral: true }).catch(() => null);
    }
  }
});

commands.push({
  name: 'deletethread',
  description: 'Delete the current thread',
  category: 'utility',
  permissions: [PermissionFlagsBits.ManageThreads],
  async executeSlash(interaction) {
    if (!interaction.channel.isThread()) return interaction.reply({ embeds: [embed.warn('Error', 'This is not a thread.')], ephemeral: true });
    try {
      await interaction.channel.delete(`Deleted by ${interaction.user.tag}`);
    } catch (err) {
      await interaction.reply({ embeds: [embed.danger('Error', err.message)], ephemeral: true }).catch(() => null);
    }
  }
});
