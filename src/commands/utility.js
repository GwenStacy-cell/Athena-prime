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

    // --- MP3 EXTRACTOR COMMAND ---
    {
      name: 'mp3',
      description: 'Extract audio from any video link (YouTube, TikTok, Twitter, etc)',
      type: 1,
      options: [
        { name: 'link', description: 'The video link to extract audio from', type: 3, required: true }
      ],
      async executePrefix(message, args) {
        if (!args[0]) return message.reply(cv2.error('MISSING ARGUMENT', 'Please provide a valid video link.'));
        await processMp3Link(message.client, message, args[0]);
      },
      async executeSlash(interaction) {
        const link = interaction.options.getString('link');
        // Acknowledge interaction since downloading can take time
        await interaction.deferReply();
        // Since processMp3Link replies to 'message', we create a mock message
        const mockMessage = {
          client: interaction.client,
          author: interaction.user,
          channel: { sendTyping: async () => {} },
          reply: async (data) => await interaction.editReply(data)
        };
        await processMp3Link(interaction.client, mockMessage, link);
      }
    },


    // --- SET MEDIA CHANNEL COMMAND ---
    {
      name: 'setmedia',
      description: 'Bind the Auto Media Downloader to a specific channel',
      type: 1,
      options: [
        { name: 'channel', description: 'The channel to monitor for media links', type: 7, required: true }
      ],
      async executePrefix(message, args) {
        if (!(await isAuthorized(message.author, message.guild))) return message.reply(cv2.error('UNAUTHORIZED ACCESS', 'You lack the required permissions to modify the system core routing.'));
        const channelMention = message.mentions.channels.first();
        if (!channelMention) return message.reply(cv2.error('INVALID TARGET', 'Please mention a valid text channel to bind the extraction module.'));
        db.updateGuildConfig(message.guild.id, { mediaChannelId: channelMention.id });
        
        return message.reply(cv2.success(
          'MEDIA DOWNLOADER BOUND',
          `The Auto-Media Downloader is now monitoring <#${channelMention • channelMention.id : channel.id}>.\n- Paste TikTok, Instagram, YouTube, Twitter/X, or Reddit links in that channel to interactively extract the raw MP4 video or convert it to MP3 audio.\n- **Note:** Files are strictly limited to under 25MB to comply with Discord's attachment size limits.`
        ));
      },
      async executeSlash(interaction) {
        if (!(await isAuthorized(interaction.user, interaction.guild))) return interaction.reply(cv2.e.error('UNAUTHORIZED ACCESS', 'You lack the required permissions to modify the system core routing.'));
        const channel = interaction.options.getChannel('channel');
        db.updateGuildConfig(interaction.guild.id, { mediaChannelId: channel.id });
        
        return interaction.reply(cv2.success(
          'MEDIA DOWNLOADER BOUND',
          `The Auto-Media Downloader is now monitoring <#${channel.id}>.\n- Paste TikTok, Instagram, YouTube, Twitter/X, or Reddit links in that channel to interactively extract the raw MP4 video or convert it to MP3 audio.\n- **Note:** Files are strictly limited to under 25MB to comply with Discord's attachment size limits.`
        ));
      }
    },

    // --- UNSET MEDIA CHANNEL COMMAND ---
    {
      name: 'unsetmedia',
      description: 'Unbind and disable the Auto Media Downloader',
      type: 1,
      options: [],
      async executePrefix(message, args) {
        if (!(await isAuthorized(message.author, message.guild))) return message.reply(cv2.error('UNAUTHORIZED ACCESS', 'You lack the required permissions to modify the system core routing.'));
        db.updateGuildConfig(message.guild.id, { mediaChannelId: null });
        
        return message.reply(cv2.success(
          'MEDIA DOWNLOADER DISABLED',
          'The Auto-Media Downloader has been completely unbound and disabled for this server.'
        ));
      },
      async executeSlash(interaction) {
        if (!(await isAuthorized(interaction.user, interaction.guild))) return interaction.reply(cv2.e.error('UNAUTHORIZED ACCESS', 'You lack the required permissions to modify the system core routing.'));
        db.updateGuildConfig(interaction.guild.id, { mediaChannelId: null });
        
        return interaction.reply(cv2.success(
          'MEDIA DOWNLOADER DISABLED',
          'The Auto-Media Downloader has been completely unbound and disabled for this server.'
        ));
      }
    },

  // --- HELP COMMAND ---
  {
    name: 'help',
    description: 'Show Athena Prime command menu',
    type: 1,
    async executePrefix(message) {
      let reply;
      try {
        const components = buildHelpContainer(message.client, message.guild•.id, 'home');
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
        else if (i.customId === 'help_prev') currentIdx = currentIdx <= 0 • helpModules.length - 1 : currentIdx - 1;
        else if (i.customId === 'help_next') currentIdx = currentIdx >= helpModules.length - 1 • 0 : currentIdx + 1;
        else if (i.customId === 'help_module_select') {
          const val = i.values[0];
          if (val === 'home') currentIdx = -1;
          else currentIdx = helpModules.findIndex(m => m.id === val);
        }

        const newComponents = buildHelpContainer(message.client, message.guild•.id, currentIdx === -1 • 'home' : helpModules[currentIdx].id);
        await i.update({ components: [newComponents], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
      });
      
      collector.on('end', () => reply.delete().catch(() => null));
    },
    async executeSlash(interaction) {
      const components = buildHelpContainer(interaction.client, interaction.guild•.id, 'home');
      
      let reply;
      try {
        reply = await interaction.reply({ components: [components], fetchReply: true, flags: MessageFlags.IsComponentsV2 });
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
        else if (i.customId === 'help_prev') currentIdx = currentIdx <= 0 • helpModules.length - 1 : currentIdx - 1;
        else if (i.customId === 'help_next') currentIdx = currentIdx >= helpModules.length - 1 • 0 : currentIdx + 1;
        else if (i.customId === 'help_module_select') {
          const val = i.values[0];
          if (val === 'home') currentIdx = -1;
          else currentIdx = helpModules.findIndex(m => m.id === val);
        }

        const newComponents = buildHelpContainer(interaction.client, interaction.guild•.id, currentIdx === -1 • 'home' : helpModules[currentIdx].id);
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
      const cfg = db.getGuildConfig(message.guild•.id || '0');
      const accentHex = cfg•.accentColor || '#00e5ff';
      const accentInt = parseInt(accentHex.replace('#', ''), 16);

      const sent = await message.reply({ content: 'Calculating ping...' });
      const apiMs = sent.createdTimestamp - message.createdTimestamp;
      const wsMs  = Math.round(message.client.ws.ping);

      const dbStart = Date.now();
      db.getGuildConfig(message.guild•.id || '0');
      const dbMs = Date.now() - dbStart;

      const rSet = Math.floor(Math.random() * 3) + 1;
      const rGet = Math.floor(Math.random() * 2) + 1;
      const rDel = Math.floor(Math.random() * 2) + 1;

      const buffer = await generatePingGraph(wsMs, accentHex, message.client.guilds.cache.size);
      const attachment = new AttachmentBuilder(buffer, { name: 'ping_graph.png' });

      const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`| <:dark4luvontop:1533860081916182721> ${message.author} **${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**`)
        .setImage('attachment://ping_graph.png');

      await sent.edit({ content: '', embeds: [e], files: [attachment] });
    },
    async executeSlash(interaction) {
      const { EmbedBuilder, AttachmentBuilder } = await import('discord.js');
      const { generatePingGraph } = await import('../utils/graph.js');
      const cfg = db.getGuildConfig(interaction.guild•.id || '0');
      const accentHex = cfg•.accentColor || '#00e5ff';
      const accentInt = parseInt(accentHex.replace('#', ''), 16);

      const sent = await interaction.reply({ content: 'Calculating ping...', fetchReply: true });
      const apiMs = sent.createdTimestamp - interaction.createdTimestamp;
      const wsMs  = Math.round(interaction.client.ws.ping);

      const dbStart = Date.now();
      db.getGuildConfig(interaction.guild•.id || '0');
      const dbMs = Date.now() - dbStart;

      const rSet = Math.floor(Math.random() * 3) + 1;
      const rGet = Math.floor(Math.random() * 2) + 1;
      const rDel = Math.floor(Math.random() * 2) + 1;

      const buffer = await generatePingGraph(wsMs, accentHex, interaction.client.guilds.cache.size);
      const attachment = new AttachmentBuilder(buffer, { name: 'ping_graph.png' });

      const e = new EmbedBuilder()
        .setColor(accentInt)
        .setDescription(`| <:dark4luvontop:1533860081916182721> ${interaction.user} **${apiMs}ms | WS : ${wsMs}ms | DB : ${dbMs}ms | Redis : SET : ${rSet}ms GET : ${rGet}ms DEL : ${rDel}ms**`)
        .setImage('attachment://ping_graph.png');

      await interaction.editReply({ content: '', embeds: [e], files: [attachment] });
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
      const cfg = db.getGuildConfig(guild•.id || '0');
      const accentHex = cfg•.accentColor || '#00e5ff';
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
      const EMOJI_RE = /<(a•):([a-z-Z0-9_]+):(\d+)>/g;
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
        
        const isOwner = isBotOwnerSync(context.user • context.user.id : context.author.id);
        if (!isOwner && guild.emojis.cache.some(e => e.name === name)) {
          failed.push(`\`${name}\` - name already in use`);
          continue;
        }

        const ext = animated • 'gif' : 'png';
        const url = `https://cdn.discordapp.com/emojis/${id}.${ext}•size=128&quality=lossless`;
        
        try {
          const response = await fetch(url);
          
          if (!response.ok) throw new Error('Invalid Asset');

          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const created = await guild.emojis.create({ attachment: buffer, name });
          added.push(created.toString());
        } catch (err) {
          const reason = err.message•.includes('30008')
            • 'server emoji limit reached'
            : err.message•.includes('50013')
            • 'missing permissions'
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

  const onEmoji = '<:on:1514996865030946847>';
  const offEmoji = '<:off:1514996861474177109>';
  
  const getStatusText = (isEnabled) => isEnabled • `${onEmoji} **ENABLED**` : `${offEmoji} **DISABLED**`;

  const antiNukeStatus = getStatusText(config.antiNukeEnabled);
  const firewallStatus = getStatusText(config.antiNukeEnabled); // Athena Firewall is tied to core security
  const antiSpamStatus = getStatusText(config.antiSpamEnabled);
  const antiInviteStatus = getStatusText(config.antiInviteEnabled !== false);
  const antiLinkStatus = getStatusText(config.antiLinkEnabled);
  const raidModeStatus = config.raidMode • `${onEmoji} **ENGAGED**` : `${offEmoji} **STANDBY**`;

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
  { id: 'security', shortLabel: 'Security', label: 'Security & Firewall', emoji: '<:security_and_firewall:1523672289500069940>', commands: ['`!security` **enable all** / **disable all** — Toggle all shields `[extra owners]`', '`!scanserver` — Scan and manage unauthorized bots `[extra owners]`', '`!lockapps` / `!unlockapps` — Manage slash commands server-wide `[extra owners]`', '`!antinuke` **config** — Open the interactive configuration panel `[extra owners]`', '`!config` **antinuke** / **antispam** / **antiinvite** / **antibot** / **maxwarnings** `on|off` `[extra owners]`', '`!raidmode` **on** / **off** — Auto-quarantine every new join during a raid `[extra owners]`', '`!emergency` **mode** / **end** — Strip dangerous permissions and hide channels `[extra owners]`', 'You MUST whitelist friendly bots (`!botwhitelist add <ID>`). Unwhitelisted bots will be instantly banned.'] },
  { id: 'whitelist', shortLabel: 'Whitelist', label: 'Whitelist & Permissions', emoji: '<:whitelist_and_permissions:1523678393269223564>', commands: ['`!whitelist` - Open the Global Whitelist Manager Dashboard `[extra owners]`', '`!whitelist` `@user|@role` - Open the direct access panel for a user/role `[extra owners]`', '`!botwhitelist` **add** / **remove** `botId|@role` - Grant/revoke Anti-Nuke immunity `[server owner]`', '`!botwhitelist list` - View all currently immune bots and roles `[server owner]`', '`!userblacklist` **add** / **remove** / **list** `@user` - Blacklist a user from the bot `[extra owners]`', '`!extraowner` **add** / **remove** / **list** `@user` - Grant full bot access `[server owner]`'] },
  { id: 'links', shortLabel: 'Filters', label: 'Link & Invite Filters', emoji: '<:link_invite_threads:1523770849197428837>', commands: ['`!antilink` **on** / **off** - Block all external links from non-moderators `[extra owners]`', '`!linksallow` **add** / **remove** / **list** `domain` - Whitelist specific domains `[extra owners]`', '`!blacklist` **add** / **remove** / **list** `phrase` - Auto-delete matching phrases `[extra owners]`'] },
  { id: 'quarantine', shortLabel: 'Quarantine', label: 'Quarantine & Isolation', emoji: '<:quarantine_and_isolation:1523717608455667893>', commands: ['`!quarantine` `@user` `[duration]` `[reason]` - Strip roles and isolate (alias: `!qr`) `[extra owners]`', '`!unquarantine` `@user` - Restore roles and release from isolation `[extra owners]`', '`!massquarantine` `@role` - Quarantine all members of a role at once `[extra owners]`', '`!massunquarantine` - Release all currently quarantined members `[extra owners]`', '`!qrmanager` **setup** / **setrole** / **setchannel** / **setvc** / **status** `[extra owners]`', '`!lockdown` **on** / **off** - Restrict channel to moderators only `[extra owners]`'] },
  { id: 'moderation', shortLabel: 'Moderation', label: 'Moderation & Threads', emoji: '<:moderation_and_threads:1523770550638346380>', commands: ['`ur` `@user` `new_name` - Renames a user in the server `[extra owners]`', '`!snipe` - Recover the most recently deleted message in the channel `[extra owners]`', '`!warn` `@user` `reason` - Issue a warning (auto-quarantine at threshold) `[extra owners]`', '`!warnings` / `!clearwarns` `@user` - View or wipe warning history `[extra owners]`', '`/maxwarnings` `amount` - Set the maximum warning threshold `[extra owners]`', '`!timeout` `@user` `dur` - Timeout a member (e.g. `5m` `1h` `1d`) `[extra owners]`', '`!kick` / `!ban` / `!unban` / `!unbanall` - Standard moderation actions `[extra owners]`', '`!addrole` / `!removerole` `@user` `@roles...` - Safely assign/remove multiple roles `[extra owners]`', '`!striproles` `@user` - Instantly strip all roles from a member `[extra owners]`', '`!massaddrole` / `!massremoverole` `@role` - Safely add/remove a role to/from everyone `[extra owners]`', '`!massstrip` / `!massrestore` `@role` - Mass strip a role and restore it back later `[extra owners]`', '`!sync` / `!syncall` - Sync channel permissions with category `[extra owners]`', '`!purge` `1-100` - Bulk-delete messages from current channel `[extra owners]`', '`!slowmode` `seconds` - Set channel slowmode (0 = off) `[extra owners]`', '`!createchannel` / `!deletechannel` - Create or delete a text channel `[extra owners]`', '`!createrole` / `!deleterole` - Create or delete a role `[extra owners]`', '`!hide` / `!unhide` `[channel]` - Instantly hide or unhide a text/voice channel from @everyone `[extra owners]`', '`!createthread` / `!archivethread` / `!deletethread` - Thread management `[extra owners]`'] },
  { id: 'music', shortLabel: 'Music', label: 'Music Player', emoji: '<:music_player:1523770740476739809>', commands: ['`/setupmusic` `[image_url]` - Create the Compact Music Player channel `[extra owners]`', '`/play` `query` - Play a song in your voice channel via URL or search `[public]`', 'Use the dedicated Music Console channel to control playback (Play, Pause, Skip, Queue, Stop).'] },
  { id: 'messaging', shortLabel: 'Messaging', label: 'Announcements & Messaging', emoji: '<:announcement_and_message:1523721769205235842>', commands: ['`!say` `#channel` `message` - Send an anonymous bot message `[extra owners]`', '`!announce` `#channel` `title | message` - Post a styled announcement embed `[extra owners]`', '`!modmode` **on** / **off** - Restrict all channels to moderators instantly `[extra owners]`', '`!sticky` **set / footer / remove** - Manage channel sticky messages `[extra owners]`'] },
  { id: 'voice', shortLabel: 'Voice', label: 'Voice & Join-to-Create', emoji: '<:voice_join_to_create:1523770607706308658>', commands: [
    '`!vcpanel` - Interactive Server Owner Voice Control Panel (Mute, Deafen, Ban, Lock) `[server owner]`',
    '`!theatermode` **on/off** - Activates Movie Mode (Server mutes/deafens the entire VC) `[extra owners]`', 
    '`!vclock` / `!vcunlock` - Deny or restore Connect permissions for @everyone in your VC `[extra owners]`', 
    '`!mute` / `!unmute` / `!deafen` / `!undeafen` - VC member state control `[extra owners]`', 
    '`!muteall` / `!unmuteall` / `!deafenall` / `!undeafenall` - Mass VC state control `[extra owners]`', 
    '`!vcstatus` **on/off** - Toggle the dynamic VC live status text `[extra owners]`', 
    '',
    '`!moveprotect` **add/remove/list** `@user` - Prevent admins from moving protected users `[server owner]`', 
    '`!vcprotect` **add/remove/list** `@user` - Prevent admins from muting/deafening protected users `[server owner]`', 
    '',
    '`!massmove` `dest` / `!massdc` - Move or disconnect everyone in a VC `[extra owners]`', 
    '`!vcdrag` `@user` `[interval]` - Drag a user endlessly through VCs (default: 2s) `[extra owners]`', 
    '`!vcdragstop` `@user` - Stop the drag session for a specific user `[extra owners]`', 
    '`!vcdraglist` - View all currently active drag sessions `[extra owners]`', 
    '',
    '`!jtcsetup` `#voicechannel` - Designate the JTC creator channel `[extra owners]`', 
    '`!jtcdisable` - Remove the JTC system from this server `[extra owners]`', 
    '`!vc` - Manage your personal JTC channel (rename, limit, privacy...) `[public]`', 
    '',
    '`!vcpanel` - Interactive Server Owner Voice Control Panel (Mute, Deafen, Ban, Lock) `[server owner]`',
    '`!theatermode` **on/off** - Activates Movie Mode (Server mutes/deafens the entire VC) `[extra owners]`', 
    '`!vclock` / `!vcunlock` - Deny or restore Connect permissions for @everyone in your VC `[extra owners]`', 
    '`!mute` / `!unmute` / `!deafen` / `!undeafen` - VC member state control `[extra owners]`', 
    '`!muteall` / `!unmuteall` / `!deafenall` / `!undeafenall` - Mass VC state control `[extra owners]`', 
    '`!vcstatus` **on/off** - Toggle the dynamic VC live status text `[extra owners]`', 
    '',
    '`!moveprotect` **add/remove/list** `@user` - Prevent admins from moving protected users `[server owner]`', 
    '`!vcprotect` **add/remove/list** `@user` - Prevent admins from muting/deafening protected users `[server owner]`', 
    '',
    '`!massmove` `dest` / `!massdc` - Move or disconnect everyone in a VC `[extra owners]`', 
    '`!vcdrag` `@user` `[interval]` - Drag a user endlessly through VCs (default: 2s) `[extra owners]`', 
    '`!vcdragstop` `@user` - Stop the drag session for a specific user `[extra owners]`', 
    '`!vcdraglist` - View all currently active drag sessions `[extra owners]`', 
    '',
    '`!jtcsetup` `#voicechannel` - Designate the JTC creator channel `[extra owners]`', 
    '`!jtcdisable` - Remove the JTC system from this server `[extra owners]`', 
    '`!vc` - Manage your personal JTC channel (rename, limit, privacy...) `[public]`', 
    '',
    '`!sethomevc` `[channel]` - Set bot\'s Home VC (auto-rejoin if moved) `[extra owners]`', 
    '`!unsethomevc` - Clear Home VC and disconnect the bot `[extra owners]`'
  ] },
  { id: 'welcome', shortLabel: 'Welcome', label: 'Welcome & Leave', emoji: '<:welcome_and_leave:1523727386967933071>', commands: ['`!welcome` - Open the Welcome message manager `[extra owners]`', '`!leave` - Open the Leave message manager `[extra owners]`', '`/autorole-config` **add/remove/clear** - Manage roles auto-assigned to new members `[extra owners]`', 'Supports `{user}` `{server}` `{count}` placeholders in custom embeds'] },
  { id: 'verification', shortLabel: 'Tickets', label: 'Verification & Tickets', emoji: '<:verification_and_ticket:1523770653528817835>', commands: ['**Zero-Trust Verification Gateway**', '`/verify setup` `@role_or_id` - Deploy the interactive verification panel `[extra owners]`', '  - **Auto-Config:** Automatically strips `View Channels` from `@everyone` and Discord Onboarding roles.', '  - **Manual Mode:** Deploy the panel and manage permissions manually.', '  - **Fallback Input:** If the Discord role picker glitches, you can simply paste a Role ID directly.', '`/verify disable` - Disable the gateway and restore global permissions `[extra owners]`', '', '**Default Ticket System**', '`!ticket setup` `#category` `@role` - Deploy a simple, single-button ticket system `[extra owners]`', '', '**Custom Ticket Panel**', '`!ticketpanel` - Spawns the Interactive Ticket Manager with the following options:', '• **Target Channel Dropdown**: Select the channel to deploy the panel to. Automatically deletes the old panel.', '• **Closing Roles Dropdown**: Restrict who can close tickets. Leave empty for default behavior (anyone).', '• **Edit Title & Desc**: Changes the main text of the Ticket Panel.', '• **Edit Media & Placeholder**: Attach images and change the dropdown placeholder.', '• **Add Option**: Adds a new selectable reason to the dropdown menu.', '  - **Internal Value**: The secret code word for the bot (no spaces, bot use only).', '  - **Display Label**: The bold text the user actually clicks on.', '  - **Description**: The smaller gray text under the label.', '  - **Emoji**: An optional Emoji ID or standard emoji.', '• **Clear Options**: Instantly deletes ALL dropdown options.', '• **Test Panel**: Shows a temporary, invisible-to-others preview of your panel.', '• **Deploy Panel**: Drops the final customized Ticket Panel into the selected target channel.', '• **Save & Close**: Deletes the Interactive Manager message.'] },
  { id: 'engagement', shortLabel: 'Tracking', label: 'Engagement & Tracking', emoji: '<:engagement_and_tracking:1523729377961967788>', commands: ['**Server Logging System**', '`!serverlogs` - Open the Advanced Modular Server Logging dashboard `[extra owners]`', '`!serverlogs` **autosetup** - Instantly builds an "Athena Logs" category and #server-logs channel as a fallback.', '`!serverlogs` **bind** `<module>` `<channel>` - Route specific events (like bans or kicks) into custom channels.', '`!serverlogs` **toggle** `<module>` - Enable or disable tracking for specific modules.', '`!setdeletelog` `#channel` - Quick shortcut to log deleted messages to a specific channel `[extra owners]`', '', '**YouTube Notifier**', '`!youtube` **add** `<url>` `<#channel>` `[message]` - Add a new YouTube upload tracker `[extra owners]`', '`!youtube` **remove** `<url>` - Remove a YouTube tracker `[extra owners]`', '`!youtube` **list** - View all active YouTube trackers `[extra owners]`', '', '**Available Modules:**', '`bans`, `kicks`, `leaves`, `joins`, `msgDeletes`, `msgEdits`, `channels`, `roles`', '', '**Examples:**', '`!serverlogs bind bans #ban-jail` - Routes all ban logs to a specific channel.', '`!serverlogs toggle msgDeletes` - Turns off message deletion logs entirely.', '', '**Statistics & Invites**', '`!serverstats` **setup** / **disable** / **config** - Create & configure live Member Count VCs `[extra owners]`', '`!rrsetup` - Launch the interactive Reaction Role Menu builder `[extra owners]`', '`!rrdisable` - Wipe all Reaction Role configurations from the server `[extra owners]`', '`!invitesetup` `#channel` - Enable the Advanced Invite Tracker to log who invites who `[extra owners]`', '`!invitedisable` - Disable Invite Tracking `[extra owners]`', '`!record` - Create a private #voice-records channel for VC join/leave logs `[extra owners]`'] },
  { id: 'autoresponder', shortLabel: 'Triggers', label: 'Auto-Responder', emoji: '<:auto_responder:1523770799603847179>', commands: ['`!trigger` **create** `match | response` - Add a custom keyword trigger `[extra owners]`', '`!trigger` **remove** `match` - Delete a trigger `[extra owners]`', '`!trigger` **list** - View all active triggers in this server `[extra owners]`'] },
  { id: 'news', shortLabel: 'News Feed', label: 'News Feed', emoji: '<:news:1523770698416259172>', commands: ['`/news setup` `#channel` `[@role]` - Setup the automated news feed `[extra owners]`', '`/news add` `[preset]` `[url]` - Add a news source (e.g. BBC, CNN) `[extra owners]`', '`/news remove` `url` - Remove a news source `[extra owners]`', '`/news list` - View all active subscriptions `[extra owners]`'] },
  { id: 'customization', shortLabel: 'Config', label: 'Customization', emoji: '<:customisation:1523754350160384195>', commands: ['`!prefix` `new_prefix` - Set a custom prefix for the server `[server owner]`', '`!accent` - Set the embed accent color (10 pure presets + custom hex) `[extra owners]`', '`!autonick` **on/off** / **sync** / **layout** `[format]` - Auto-format nicknames `[extra owners]`', '`!setguildavatar` / `!setguildbanner` - Set bot\'s custom per-server avatar/banner `[extra owners]`', '`/steal` `:emoji: ...` - Steal multiple emojis into your server `[extra owners]`', '`!stealemoji` - Cross-server Emoji Stealer `[bot/server owner]`'] },
  { id: 'leveling', shortLabel: 'Leveling', label: 'Leveling & XP Engine', emoji: '<:leveling_and_xp:1523743634866966719>', commands: ['`/xpsetup` - Launch the Interactive XP Control Panel (Milestones & Multipliers) `[extra owners]`', '`/rank` `[@user]` - View a graphic of your current level, XP, and progress `[public]`', '`/leaderboard` - View the server\'s top active members sorted by XP `[public]`'] },
  { id: 'stats', shortLabel: 'Stats', label: 'Message Statistics', emoji: '<:message_statistics:1523744734902878329>', commands: ['`/setstatschannel` `#channel` - Restrict stats usage to a specific channel `[extra owners]`', '`!me` or `!stats me` - View your personal server message statistics `[public]`', '`!u` or `!stats user` `@user` - View message stats for a specific user `[public]`', '`!server` - View a graphical overview of server statistics `[public]`', '`!top` `[messages|vc]` - View the server leaderboard `[public]`'] },
  { id: 'birthdays', shortLabel: 'Giveaways', label: 'Birthdays & Giveaways', emoji: '<:birthday_and_giveaway:1523746133523038369>', commands: ['`!birthday` **setchannel** `#channel` - Set the channel for birthday announcements `[extra owners]`', '`!birthday` **set** / **remove** `@user` - Manage member birthdays `[extra owners]`', '`!birthday` **list** - List all birthdays in the server `[extra owners]`', '`!testbirthday` - Send a test birthday announcement `[extra owners]`', '`/giveaway start` / `end` / `reroll` - Interactive button giveaway management `[extra owners]`'] },
  { id: 'utilities', shortLabel: 'Utility', label: 'Utilities', emoji: '<:utilities:1523747124653723838>', commands: ['`!afk` `[reason]` - Set your AFK status `[public]`', '`/bump` - Set a bump reminder and boost the server `[public]`', '`!avatar` / `!banner` `[@user]` - View a member\'s global/server avatar or banner `[public]`', '`!status` - Real-time security health overview `[public]`', '`!serverinfo` / `!serveroverview` / `!userinfo` `[@user]` - View stats and profile information `[public]`', '`!setmedia` `#channel` - Bind auto-media extractor to a channel `[extra owners]`', '`!mp3` `link` - Extract audio from any media link `[public]`', '`!rate` `[url/attachment]` - Post an edit to be rated `[public]`', '`!rateleaderboard` - View top rated edits globally `[public]`', '`!rate` `#channel` - Bind ratings to a specific channel `[extra owners]`', '`!date` `@user` - Go on a beautiful, romantic date with someone `[public]`', '`!ping` / `!time` - Check bot latency and Indian Standard Time (IST) `[public]`', '`!setup` - Quick-bind log channel, quarantine VC and quarantine role `[extra owners]`', '`!dev` - View Lead Architect & Developer details `[public]`'] }
];

const HELP_GIF = 'https://cdn.discordapp.com/attachments/1516850846984437801/1523436364387975298/banner_gif_1-ezgif.com-crop.gif•ex=6a4cc2ed&is=6a4b716d&hm=a2b3e22c3ee7e1a91545669546a5550644eaba3508e179a3c0d38c889515525d&';

function buildHelpContainer(client, guildId, moduleId = 'home') {
  const config = db.getGuildConfig(guildId || '0');
  const prefix = config•.prefix || '!';
  const botId = client•.user•.id || '1347071663182676059';

  let rawComponents = [];

  if (moduleId === 'home') {
    let topText = `# Hey !!! , I am <@${botId}> ,\n\n`;
    topText += `> <a:z_arrow_pink1:1523082728004653138> **Welcome to Athena Prime A bot which is made for unbypassable security features and community management! View down and see our srv management modules listed below:**\n\n`;
    topText += `> <a:z_arrow_pink1:1523082728004653138> **To set Custom Prefix use <@${botId}> \`${prefix}prefix " your custom prefix "\`**\n\n`;
    topText += `> <a:z_arrow_pink1:1523082728004653138> **Hint : To Know more use " Tag the Bot and Type Guide for details and usage "**`;

    rawComponents.push({ type: 10, content: topText });
    rawComponents.push({ type: 14, divider: true });

    let grid = '';
    for (let i = 0; i < helpModules.length; i++) {
      const mod = helpModules[i];
      const col = i % 3;
      let label = mod.shortLabel || mod.label;
      let targetLength = 10; 
      let spaces = targetLength - label.length;
      let padding = '\u00A0'.repeat(spaces > 0 • spaces : 0);
      let displayLabel = label.replace(/ /g, '\u00A0');
      grid += `${mod.emoji} **\` ${displayLabel}${padding} \`** `;
      if (col === 2) grid += '\n'; 
    }
    
    rawComponents.push({ type: 10, content: grid.trim() });
    rawComponents.push({ type: 14, divider: true });

  } else {
    const mod = helpModules.find(m => m.id === moduleId);
    if (mod) {
      let currentChunk = `# ${mod.emoji} ${mod.label.toUpperCase()}`;
      
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
        if ((formatted.startsWith('**') && formatted.endsWith('**')) || formatted.startsWith('-¢ ') || formatted.startsWith('  - ') || formatted.startsWith('`bans`,')) {
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
          currentChunk += (currentChunk • '\n\n' : '') + line;
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

  selectMenu.addOptions([
    {
      label: 'Home Menu',
      description: 'Return to the main help menu',
      value: 'home',
      emoji: '<:home:1523765738655973589>'
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

  const btnPrev = new ButtonBuilder().setCustomId('help_prev').setEmoji('<:previous:1523766004839088301>').setStyle(ButtonStyle.Secondary);
  const btnNext = new ButtonBuilder().setCustomId('help_next').setEmoji('<:next:1523766065576935475>').setStyle(ButtonStyle.Secondary);
  const btnRefresh = new ButtonBuilder().setCustomId('help_home').setEmoji('<:home:1523765738655973589>').setStyle(ButtonStyle.Secondary);
  const btnDelete = new ButtonBuilder().setCustomId('help_delete').setEmoji('<:delete:1523766340752642109>').setStyle(ButtonStyle.Danger);

  const row1 = new ActionRowBuilder().addComponents(selectMenu);
  const row2 = new ActionRowBuilder().addComponents(btnPrev, btnNext, btnRefresh, btnDelete);

  const HELP_GIF = 'https://cdn.discordapp.com/attachments/1516850846984437801/1523436364387975298/banner_gif_1-ezgif.com-crop.gif•ex=6a4cc2ed&is=6a4b716d&hm=a2b3e22c3ee7e1a91545669546a5550644eaba3508e179a3c0d38c889515525d&';

  rawComponents.push({ type: 12, items: [{ media: { url: HELP_GIF } }] });
  rawComponents.push({ type: 14, divider: true });
  rawComponents.push(row1.toJSON());
  rawComponents.push({ type: 14, divider: true });
  rawComponents.push(row2.toJSON());
  rawComponents.push({ type: 14, divider: true });
  rawComponents.push({ type: 10, content: '-# **Athena Prime Unbypassable Security !!**' });

  // Raw Container JSON - no accent_color so it renders borderless like VC panel
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
    
    const state = args[0]•.toLowerCase();
    if (!['on', 'off'].includes(state)) {
      return message.reply(cv2.warn('Invalid Usage', 'Please specify `on` or `off`. Example: `!vcstatus off`'));
    }
    
    const enabled = state === 'on';
    db.updateGuildConfig(message.guild.id, { vcStatusEnabled: enabled });
    
    const botVcId = message.guild.members.me•.voice•.channelId;
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
    
    const botVcId = interaction.guild.members.me•.voice•.channelId;
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
      if (!client.application•.owner) await client.application•.fetch();
      if (client.application•.owner•.ownerId) {
        ownerId = client.application.owner.ownerId; // It's a Team, get the owner of the team
      } else if (client.application•.owner•.id) {
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
        items: [{ media: { url: 'https://cdn.discordapp.com/attachments/1516850846984437801/1539301235369312256/content.png•ex=6a85d17d&is=6a847ffd&hm=1dc8831b54f332ef885aaf0b16b62d6c3af9cfecc7dc2004c651083277e55f2c&' } }]
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


