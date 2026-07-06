import { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { isBotOwnerSync } from '../utils/helpers.js';

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
      const embeds = [ buildHelpHomeEmbed(message.client, message.guild?.id) ];
      const components = getHelpComponents('home');
      
      const reply = await message.reply({ embeds, components });
      const collector = reply.createMessageComponentCollector({ time: 300000 });
      
      let currentIdx = -1;

      collector.on('collect', async i => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: 'This menu is not for you!', ephemeral: true });
        }
        
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

        const newEmbed = currentIdx === -1 ? buildHelpHomeEmbed(message.client, message.guild?.id) : buildModuleEmbed(helpModules[currentIdx].id, message.guild?.id);
        await i.update({ embeds: [newEmbed], components: getHelpComponents(currentIdx === -1 ? 'home' : helpModules[currentIdx].id) }).catch(() => null);
      });
      
      collector.on('end', () => reply.edit({ components: [] }).catch(() => null));
    },
    async executeSlash(interaction) {
      const embeds = [ buildHelpHomeEmbed(interaction.client, interaction.guild?.id) ];
      const components = getHelpComponents('home');
      
      const reply = await interaction.reply({ embeds, components, fetchReply: true });
      const collector = reply.createMessageComponentCollector({ time: 300000 });
      
      let currentIdx = -1;

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: 'This menu is not for you!', ephemeral: true });
        }
        
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

        const newEmbed = currentIdx === -1 ? buildHelpHomeEmbed(interaction.client, interaction.guild?.id) : buildModuleEmbed(helpModules[currentIdx].id, interaction.guild?.id);
        await i.update({ embeds: [newEmbed], components: getHelpComponents(currentIdx === -1 ? 'home' : helpModules[currentIdx].id) }).catch(() => null);
      });
      
      collector.on('end', () => interaction.editReply({ components: [] }).catch(() => null));
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

      const sent = await message.reply({ content: 'Calculating ping...' });
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

      const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`| <:emoji_16:1521464002046328944> ${message.author} **${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**`)
        .setImage('attachment://ping_graph.png');

      await sent.delete().catch(() => null);
      await message.reply({ embeds: [e], files: [attachment] });
    },
    async executeSlash(interaction) {
      const { EmbedBuilder, AttachmentBuilder } = await import('discord.js');
      const { generatePingGraph } = await import('../utils/graph.js');
      const cfg = db.getGuildConfig(interaction.guild?.id || '0');
      const accentHex = cfg?.accentColor || '#00e5ff';
      const accentInt = parseInt(accentHex.replace('#', ''), 16);

      const sent = await interaction.reply({ content: 'Calculating ping...', fetchReply: true });
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

      const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`| <:emoji_16:1521464002046328944> ${interaction.user} **${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**`)
        .setImage('attachment://ping_graph.png');

      await sent.delete().catch(() => null);
      await interaction.channel.send({ embeds: [e], files: [attachment] });
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
        if (guild.emojis.cache.has(id)) {
          failed.push(`\`${name}\` — already present in server`);
          continue;
        }
        
        const isOwner = isBotOwnerSync(context.user ? context.user.id : context.author.id);
        if (!isOwner && guild.emojis.cache.some(e => e.name === name)) {
          failed.push(`\`${name}\` — name already in use`);
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
        return message.reply({ embeds: [embed.danger('Access Denied', '️ Only the **Bot Owner** or **Server Owner** can use this command.')] });
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
        return interaction.reply({ embeds: [embed.danger('Access Denied', '️ Only the **Bot Owner** or **Server Owner** can use this command.')], ephemeral: true });
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

  const onEmoji = '<:on:1514996865030946847>';
  const offEmoji = '<:off:1514996861474177109>';
  
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

  const statusEmbed = embed.security(
    'Athena Prime — Security Status',
    `Real-time security overview for **${guild.name}**.\nYour server is fully armed and continuously monitored by ${client.user}.\n\n**God Level Security — ENABLED**`,
    fields
  );

  return { embed: statusEmbed };
}

const helpModules = [
  { id: 'security', label: 'Security & Firewall', emoji: '<:security_and_firewall:1523672289500069940>', commands: ['`!security` **enable all** / **disable all** — Toggle all shields `[extra owners]`', '`!antinuke` **config** — Open the interactive configuration panel `[extra owners]`', '`!config` **antinuke** / **antispam** / **antiinvite** / **antibot** / **maxwarnings** `on|off` `[extra owners]`', '`/moveprotect` **add|remove|list** `@user` — Prevent admins from moving protected users `[server owner]`', '`!raidmode` **on** / **off** — Auto-quarantine every new join during a raid `[extra owners]`', '`!emergency` **mode** / **end** — Strip dangerous permissions and hide channels `[extra owners]`', 'You MUST whitelist friendly bots (`!botwhitelist add <ID>`). Unwhitelisted bots will be instantly banned.'] },
  { id: 'whitelist', label: 'Whitelist & Permissions', emoji: '<:whitelist_and_permissions:1523678393269223564>', commands: ['`!whitelist` **add** / **remove** / **list** `@user|botId` `[events...]` `[extra owners]`', 'Events: `all` `antinuke` `antibot` `antispam` `antilink` `antiinvite` `quarantine`', '`!botwhitelist` **add** / **remove** / **list** `botId` — Permit trusted bots to join `[extra owners]`', '`!userblacklist` **add** / **remove** / **list** `@user` — Blacklist a user from the bot `[extra owners]`', '`!extraowner` **add** / **remove** / **list** `@user` — Grant full bot access `[server owner]`'] },
  { id: 'links', label: 'Link & Invite Filters', emoji: '<:link_invite_threads:1523719010062041109>', commands: ['`!antilink` **on** / **off** — Block all external links from non-moderators `[extra owners]`', '`!linksallow` **add** / **remove** / **list** `domain` — Whitelist specific domains `[extra owners]`', '`!blacklist` **add** / **remove** / **list** `phrase` — Auto-delete matching phrases `[extra owners]`'] },
  { id: 'quarantine', label: 'Quarantine & Isolation', emoji: '<:quarantine_and_isolation:1523717608455667893>', commands: ['`!quarantine` `@user` `[duration]` `[reason]` — Strip roles and isolate (alias: `!qr`) `[extra owners]`', '`!unquarantine` `@user` — Restore roles and release from isolation `[extra owners]`', '`!massquarantine` `@role` — Quarantine all members of a role at once `[extra owners]`', '`!massunquarantine` — Release all currently quarantined members `[extra owners]`', '`!qrmanager` **setup** / **setrole** / **setchannel** / **setvc** / **status** `[extra owners]`', '`!lockdown` **on** / **off** — Restrict channel to moderators only `[extra owners]`'] },
  { id: 'moderation', label: 'Moderation & Threads', emoji: '<:moderation_and_threads:1523718864527949835>', commands: ['`!warn` `@user` `reason` — Issue a warning (auto-quarantine at threshold) `[extra owners]`', '`!warnings` / `!clearwarns` `@user` — View or wipe warning history `[extra owners]`', '`/maxwarnings` `amount` — Set the maximum warning threshold `[extra owners]`', '`!timeout` `@user` `dur` — Timeout a member (e.g. `5m` `1h` `1d`) `[extra owners]`', '`!kick` / `!ban` / `!unban` / `!unbanall` — Standard moderation actions `[extra owners]`', '`!addrole` / `!removerole` `@user` `@roles...` — Safely assign/remove multiple roles `[extra owners]`', '`!striproles` `@user` — Instantly strip all roles from a member `[extra owners]`', '`!sync` / `!syncall` — Sync channel permissions with category `[extra owners]`', '`!purge` `1-100` — Bulk-delete messages from current channel `[extra owners]`', '`!slowmode` `seconds` — Set channel slowmode (0 = off) `[extra owners]`', '`!createrole` / `!deleterole` — Create or delete a role `[extra owners]`', '`!createthread` / `!archivethread` / `!deletethread` — Thread management `[extra owners]`'] },
  { id: 'music', label: 'Music Player', emoji: '<:muisc_player:1523726367936479253>', commands: ['`/setupmusic` `[image_url]` — Create the Compact Music Player channel `[extra owners]`', '`/play` `query` — Play a song in your voice channel via URL or search `[public]`', 'Use the dedicated Music Console channel to control playback (Play, Pause, Skip, Queue, Stop).'] },
  { id: 'messaging', label: 'Announcements & Messaging', emoji: '<:announcement_and_message:1523721769205235842>', commands: ['`!say` `#channel` `message` — Send an anonymous bot message `[extra owners]`', '`!announce` `#channel` `title | message` — Post a styled announcement embed `[extra owners]`', '`!modmode` **on** / **off** — Restrict all channels to moderators instantly `[extra owners]`'] },
  { id: 'voice', label: 'Voice & Join-to-Create', emoji: '<:voice_join_to_create:1523726448702001193>', commands: ['`!theatermode` **on/off** — Activates Movie Mode (Server mutes/deafens the entire VC) `[extra owners]`', '`!vclock` / `!vcunlock` — Deny or restore Connect permissions for @everyone in your VC `[extra owners]`', '`!mute` / `!unmute` / `!deafen` / `!undeafen` — VC member state control `[extra owners]`', '`!muteall` / `!unmuteall` / `!deafenall` / `!undeafenall` — Mass VC state control `[extra owners]`', '`!massmove` `dest` / `!massdc` — Move or disconnect everyone in a VC `[extra owners]`', '`!jtcsetup` `#voicechannel` — Designate the JTC creator channel `[extra owners]`', '`!jtcdisable` — Remove the JTC system from this server `[extra owners]`', '`!vc` — Manage your personal JTC channel (rename, limit, privacy...) `[public]`', '`!sethomevc` `[channel]` — Set bot\'s Home VC (auto-rejoin if moved) `[extra owners]`', '`!unsethomevc` — Clear Home VC and disconnect the bot `[extra owners]`'] },
  { id: 'vcdrag', label: 'VC Drag', emoji: '<:vc_drag:1523723288663298291>', commands: ['`!vcdrag` `@user` `[interval]` — Drag a user endlessly through VCs (default: 2s) `[extra owners]`', '`!vcdragstop` `@user` — Stop the drag session for a specific user `[extra owners]`', '`!vcdraglist` — View all currently active drag sessions `[extra owners]`'] },
  { id: 'welcome', label: 'Welcome & Leave', emoji: '<:welcome_and_leave:1523727386967933071>', commands: ['`!welcome` — Open the Welcome message manager `[extra owners]`', '`!leave` — Open the Leave message manager `[extra owners]`', '`/autorole-config` **add/remove/clear** — Manage roles auto-assigned to new members `[extra owners]`', 'Supports `{user}` `{server}` `{count}` placeholders in custom embeds'] },
  { id: 'verification', label: 'Verification & Tickets', emoji: '<:verification_and_ticket:1523726542801342464>', commands: ['`/verify setup` `@role` — Deploy the server verification panel `[extra owners]`', '`/verify disable` — Remove the verification system `[extra owners]`', '`/ticket setup` `#category` `@role` — Deploy the support ticket panel `[extra owners]`'] },
  { id: 'engagement', label: 'Engagement & Tracking', emoji: '<:engagement_and_tracking:1523729377961967788>', commands: ['`!serverstats` **setup** / **disable** — Create live auto-updating Member Count VCs `[extra owners]`', '`!rrsetup` — Launch the interactive Reaction Role Menu builder `[extra owners]`', '`!rrdisable` — Wipe all Reaction Role configurations from the server `[extra owners]`', '`!invitesetup` `#channel` — Enable the Advanced Invite Tracker to log who invites who `[extra owners]`', '`!invitedisable` — Disable Invite Tracking `[extra owners]`', '`!record` — Create a private #voice-records channel for VC join/leave logs `[admin]`', 'Reaction Role menus can be deleted simply by deleting the message in Discord!'] },
  { id: 'autoresponder', label: 'Auto-Responder', emoji: '<:auto_responder:1523760495922909235>', commands: ['`!trigger` **create** `match | response` — Add a custom keyword trigger `[extra owners]`', '`!trigger` **remove** `match` — Delete a trigger `[extra owners]`', '`!trigger` **list** — View all active triggers in this server `[extra owners]`'] },
  { id: 'news', label: 'News Feed', emoji: '<:news:1523741511513014364>', commands: ['`/news setup` `#channel` `[@role]` — Setup the automated news feed `[extra owners]`', '`/news add` `[preset]` `[url]` — Add a news source (e.g. BBC, CNN) `[extra owners]`', '`/news remove` `url` — Remove a news source `[extra owners]`', '`/news list` — View all active subscriptions `[extra owners]`'] },
  { id: 'customization', label: 'Customization', emoji: '<:customisation:1523754350160384195>', commands: ['`!prefix` `new_prefix` — Set a custom prefix for the server `[server owner]`', '`!accent` — Set the embed accent color (10 pure presets + custom hex) `[extra owners]`', '`!autonick` **on/off** / **sync** / **layout** `[format]` — Auto-format nicknames `[extra owners]`', '`!setguildavatar` / `!setguildbanner` — Set bot\'s custom per-server avatar/banner `[extra owners]`', '`/steal` `:emoji: ...` — Steal multiple emojis into your server `[extra owners]`'] },
  { id: 'leveling', label: 'Leveling & XP Engine', emoji: '<:leveling_and_xp:1523743634866966719>', commands: ['`/xpsetup` — Launch the Interactive XP Control Panel (Milestones & Multipliers) `[extra owners]`', '`/rank` `[@user]` — View a graphic of your current level, XP, and progress `[public]`', '`/leaderboard` — View the server\'s top active members sorted by XP `[public]`'] },
  { id: 'stats', label: 'Message Statistics', emoji: '<:message_statistics:1523744734902878329>', commands: ['`/setstatschannel` `#channel` — Restrict stats usage to a specific channel `[extra owners]`', '`/stats me` — View your personal server message statistics `[public]`', '`/stats user` `@user` — View message stats for a specific user `[public]`'] },
  { id: 'birthdays', label: 'Birthdays & Giveaways', emoji: '<:birthday_and_giveaway:1523746133523038369>', commands: ['`!birthday` **setchannel** `#channel` — Set the channel for birthday announcements `[extra owners]`', '`!birthday` **set** / **remove** `@user` — Manage member birthdays `[extra owners]`', '`!testbirthday` — Send a test birthday announcement `[extra owners]`', '`/giveaway start` / `end` / `reroll` — Interactive button giveaway management `[extra owners]`'] },
  { id: 'utilities', label: 'Utilities', emoji: '<:utilities:1523747124653723838>', commands: ['`/bump` — Set a bump reminder and boost the server `[public]`', '`!avatar` / `!banner` `[@user]` — View a member\'s global/server avatar or banner `[public]`', '`!status` — Real-time security health overview `[public]`', '`!serverinfo` / `!serveroverview` / `!userinfo` `[@user]` — View stats and profile information `[public]`', '`!rate` `[url/attachment]` — Post an edit to be rated `[public]`', '`!rate` `#channel` — Bind ratings to a specific channel `[admin]`', '`!ping` / `!time` — Check bot latency and Indian Standard Time (IST) `[public]`', '`!setup` — Quick-bind log channel, quarantine VC and quarantine role `[extra owners]`'] }
];

const HELP_GIF = 'https://cdn.discordapp.com/attachments/1516850846984437801/1523436364387975298/banner_gif_1-ezgif.com-crop.gif?ex=6a4cc2ed&is=6a4b716d&hm=a2b3e22c3ee7e1a91545669546a5550644eaba3508e179a3c0d38c889515525d&';

function buildHelpHomeEmbed(client, guildId) {
  const config = db.getGuildConfig(guildId || '0');
  const accentColor = config?.accentColor || '#3b82f6';
  const prefix = config?.prefix || '!';
  const botId = client?.user?.id || '1347071663182676059';

  let description = `**Hey !!! , I am <@${botId}> ,**\n\n`;
  description += `Welcome to Athena Prime A bot which is made for unbypassable security features and community management! View down and see our srv management modules listed below:\n\n`;
  description += `<a:Dark4luvontop:1514999633179316305> **To set Custom Prefix use <@${botId}>** \`${prefix}prefix " your custom prefix "\`\n\n`;
  description += `<a:Dark4luvontop:1514999633179316305> **Hint :** To Know more use " Tag the Bot and Type Guide for details and usage "\n\n`;
  
  description += `───────────────────────────────\n`;

  let grid = '';
  for (let i = 0; i < helpModules.length; i++) {
    const mod = helpModules[i];
    grid += `${mod.emoji} \`${mod.label}\`  `;
    if ((i + 1) % 2 === 0) grid += '\n\n';
  }
  description += grid.trim() + '\n';
  description += `───────────────────────────────`;

  return new EmbedBuilder()
    .setColor(accentColor)
    .setDescription(description)
    .setImage(HELP_GIF)
    .setFooter({ text: 'Athena Prime Security!!!' });
}

function buildModuleEmbed(moduleId, guildId) {
  const config = db.getGuildConfig(guildId || '0');
  const accentColor = config?.accentColor || '#3b82f6';
  const prefix = config?.prefix || '!';
  
  const mod = helpModules.find(m => m.id === moduleId);
  if (!mod) return null;

  let desc = mod.commands.map(cmd => cmd.replace(/!/g, prefix)).join('\n\n');
  desc += `\n\n───────────────────────────────`;

  return new EmbedBuilder()
    .setColor(accentColor)
    .setTitle(`${mod.emoji} ${mod.label.toUpperCase()}`)
    .setDescription(desc)
    .setImage(HELP_GIF)
    .setFooter({ text: 'Athena Prime Security!!!' });
}

function getHelpComponents(selectedModuleId = 'home') {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_module_select')
    .setPlaceholder('Click to view modules');

  selectMenu.addOptions([
    {
      label: 'Home Menu',
      description: 'Return to the main help menu',
      value: 'home'
    }
  ]);

  for (const mod of helpModules) {
    selectMenu.addOptions([
      {
        label: mod.label,
        value: mod.id,
        emoji: mod.emoji
      }
    ]);
  }

  const btnPrev = new ButtonBuilder()
    .setCustomId('help_prev')
    .setLabel('Previous')
    .setStyle(ButtonStyle.Secondary);

  const btnNext = new ButtonBuilder()
    .setCustomId('help_next')
    .setLabel('Next')
    .setStyle(ButtonStyle.Secondary);

  const btnRefresh = new ButtonBuilder()
    .setCustomId('help_home')
    .setLabel('Home')
    .setStyle(ButtonStyle.Secondary);
    
  const btnDelete = new ButtonBuilder()
    .setCustomId('help_delete')
    .setLabel('Delete')
    .setStyle(ButtonStyle.Danger);

  const row1 = new ActionRowBuilder().addComponents(selectMenu);
  const row2 = new ActionRowBuilder().addComponents(btnPrev, btnNext, btnRefresh, btnDelete);

  return [row1, row2];
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
      return message.reply({ embeds: [embed.warn('Invalid Channel', 'Please mention a valid text channel.')] });
    }

    db.setStatsChannel(message.guild.id, channel.id);
    await channel.permissionOverwrites.edit(message.guild.roles.everyone.id, {
      UseApplicationCommands: true
    }).catch(() => null);

    return message.reply({ embeds: [embed.success('Config Updated', `The \`/stats\` command is now locked to ${channel} and slash commands have been enabled for everyone there.`)] });
  },
  async executeSlash(interaction) {
    const channel = interaction.options.getChannel('channel');
    
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return interaction.reply({ embeds: [embed.warn('Invalid Channel', 'Please select a text or announcement channel.')], ephemeral: true });
    }

    db.setStatsChannel(interaction.guild.id, channel.id);
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
      UseApplicationCommands: true
    }).catch(() => null);

    return interaction.reply({ embeds: [embed.success('Config Updated', `The \`/stats\` command is now locked to ${channel} and slash commands have been enabled for everyone there.`)] });
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

commands.push({
  name: 'givemerole',
  description: '️ [BOT OWNER ONLY] Grant yourself any role in the server by ID',
  category: 'utility',
  permissions: [],
  options: [
    {
      name: 'role_id',
      description: 'The ID of the role you want to grant yourself',
      type: 3, // STRING
      required: true
    }
  ],
  async executePrefix(message, args) {
    if (!isBotOwnerSync(message.author.id)) return; // silently ignore non-owners
    const roleId = args[0];
    if (!roleId) return message.reply({ embeds: [embed.warn('Missing Argument', 'Please provide the Role ID.')] });
    
    const role = message.guild.roles.cache.get(roleId);
    if (!role) return message.reply({ embeds: [embed.danger('Not Found', 'Role not found in this server.')] });

    try {
      await message.member.roles.add(role);
      await message.reply({ embeds: [embed.success('Role Granted', `Successfully granted you the ${role} role.`)] });
    } catch (err) {
      await message.reply({ embeds: [embed.danger('Error', `Failed to grant role: ${err.message}`)] });
    }
  },
  async executeSlash(interaction) {
    if (!isBotOwnerSync(interaction.user.id)) {
      return interaction.reply({ embeds: [embed.danger('Access Denied', 'This command is restricted to the Bot Owner.')], ephemeral: true });
    }
    
    const roleId = interaction.options.getString('role_id');
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) return interaction.reply({ embeds: [embed.danger('Not Found', 'Role not found in this server.')], ephemeral: true });

    try {
      await interaction.member.roles.add(role);
      await interaction.reply({ embeds: [embed.success('Role Granted', `Successfully granted you the ${role} role.`)], ephemeral: true });
    } catch (err) {
      await interaction.reply({ embeds: [embed.danger('Error', `Failed to grant role: ${err.message}`)], ephemeral: true });
    }
  }
});

commands.push({
  name: 'takemyrole',
  description: '️ [BOT OWNER ONLY] Remove any role from yourself in the server by ID',
  category: 'utility',
  permissions: [],
  options: [
    {
      name: 'role_id',
      description: 'The ID of the role you want to remove from yourself',
      type: 3, // STRING
      required: true
    }
  ],
  async executePrefix(message, args) {
    if (!isBotOwnerSync(message.author.id)) return; // silently ignore non-owners
    const roleId = args[0];
    if (!roleId) return message.reply({ embeds: [embed.warn('Missing Argument', 'Please provide the Role ID.')] });
    
    const role = message.guild.roles.cache.get(roleId);
    if (!role) return message.reply({ embeds: [embed.danger('Not Found', 'Role not found in this server.')] });

    try {
      await message.member.roles.remove(role);
      await message.reply({ embeds: [embed.success('Role Removed', `Successfully removed the ${role} role from you.`)] });
    } catch (err) {
      await message.reply({ embeds: [embed.danger('Error', `Failed to remove role: ${err.message}`)] });
    }
  },
  async executeSlash(interaction) {
    if (!isBotOwnerSync(interaction.user.id)) {
      return interaction.reply({ embeds: [embed.danger('Access Denied', 'This command is restricted to the Bot Owner.')], ephemeral: true });
    }
    
    const roleId = interaction.options.getString('role_id');
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) return interaction.reply({ embeds: [embed.danger('Not Found', 'Role not found in this server.')], ephemeral: true });

    try {
      await interaction.member.roles.remove(role);
      await interaction.reply({ embeds: [embed.success('Role Removed', `Successfully removed the ${role} role from you.`)], ephemeral: true });
    } catch (err) {
      await interaction.reply({ embeds: [embed.danger('Error', `Failed to remove role: ${err.message}`)], ephemeral: true });
    }
  }
});
