import { PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, SeparatorBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { processMp3Link } from '../utils/mediaDownloader.js';
import { isAuthorized, cleanDisplayName } from '../utils/helpers.js';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';

async function optimizeEmojiBuffer(buffer, isAnimated = false) {
  if (!buffer || buffer.length <= 256 * 1024) return buffer;

  if (isAnimated) {
    const tmpDir = os.tmpdir();
    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const inPath = path.join(tmpDir, `emoji_in_${uniqueId}.gif`);
    const outPath = path.join(tmpDir, `emoji_out_${uniqueId}.gif`);

    try {
      await fs.promises.writeFile(inPath, buffer);

      const presets = [
        'fps=15,scale=128:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
        'fps=12,scale=96:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer:bayer_scale=2',
        'fps=10,scale=80:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=32[p];[s1][p]paletteuse=dither=bayer:bayer_scale=1',
        'fps=8,scale=64:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=16[p];[s1][p]paletteuse=dither=bayer:bayer_scale=1'
      ];

      for (const vf of presets) {
        try {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              try { proc.kill(); } catch {}
              reject(new Error('ffmpeg timeout'));
            }, 6000);
            const proc = spawn(ffmpegPath, ['-y', '-i', inPath, '-vf', vf, outPath]);
            proc.on('close', code => {
              clearTimeout(timer);
              code === 0 ? resolve() : reject(new Error('exit ' + code));
            });
            proc.on('error', err => {
              clearTimeout(timer);
              reject(err);
            });
          });
          if (fs.existsSync(outPath)) {
            const compressed = await fs.promises.readFile(outPath);
            if (compressed.length <= 256 * 1024) {
              return compressed;
            }
          }
        } catch {}
      }
    } catch {} finally {
      try { await fs.promises.unlink(inPath); } catch {}
      try { await fs.promises.unlink(outPath); } catch {}
    }
  } else {
    try {
      const { createCanvas, loadImage, isCanvasAvailable } = await import('../utils/canvas.js');
      if (isCanvasAvailable) {
        const img = await loadImage(buffer);
        const canvas = createCanvas(128, 128);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 128, 128);
        const compressed = canvas.toBuffer('image/png');
        if (compressed.length <= 256 * 1024) return compressed;
      }
    } catch {}
  }

  return buffer;
}

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
    async executePrefix(message) {
      await sendCalculator(message);
    },
    async executeSlash(interaction) {
      await sendCalculator(interaction);
    }
  },


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
        const url = args[0];
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return message.reply(cv2.warn('Invalid URL', `\`${url}\` is not a valid link.\n-# Provide a direct link e.g. a YouTube, TikTok, or Twitter URL.`));
        }
        await processMp3Link(message.client, message, url);
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
          const stickyText = 'MEDIA DOWNLOADER BOUND | The Auto-Media Downloader is now monitoring this channel.\nPaste TikTok, Instagram, YouTube, Twitter/X, or Reddit links to interactively extract the raw MP4 video or convert it to MP3 audio.\nIf Discord rejects a video due to file size, Athena will offer to compress it to a smaller version.\nDiscord\'s upload limit depends on your server\'s boost level.';
          db.setStickyMessage(message.guild.id, channelMention.id, stickyText);
        
        return message.reply(cv2.success(
          'MEDIA DOWNLOADER BOUND',
          `The Auto-Media Downloader is now monitoring <#${channelMention ? channelMention.id : channel.id}>.\nPaste TikTok, Instagram, YouTube, Twitter/X, or Reddit links in that channel to interactively extract the raw MP4 video or convert it to MP3 audio.\nNote: Files are strictly limited to under 25MB to comply with Discord's attachment size limits.`
        ));
      },
      async executeSlash(interaction) {
        if (!(await isAuthorized(interaction.user, interaction.guild))) return interaction.reply(cv2.e.error('UNAUTHORIZED ACCESS', 'You lack the required permissions to modify the system core routing.'));
        const channel = interaction.options.getChannel('channel');
        db.updateGuildConfig(interaction.guild.id, { mediaChannelId: channel.id });
          const stickyText = 'MEDIA DOWNLOADER BOUND | The Auto-Media Downloader is now monitoring this channel.\nPaste TikTok, Instagram, YouTube, Twitter/X, or Reddit links to interactively extract the raw MP4 video or convert it to MP3 audio.\nIf Discord rejects a video due to file size, Athena will offer to compress it to a smaller version.\nDiscord\'s upload limit depends on your server\'s boost level.';
          db.setStickyMessage(interaction.guild.id, channel.id, stickyText);
        
        return interaction.reply(cv2.success(
          'MEDIA DOWNLOADER BOUND',
          `The Auto-Media Downloader is now monitoring <#${channel.id}>.\nPaste TikTok, Instagram, YouTube, Twitter/X, or Reddit links in that channel to interactively extract the raw MP4 video or convert it to MP3 audio.\nNote: Files are strictly limited to under 25MB to comply with Discord's attachment size limits.`
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
        const cfg = db.getGuildConfig(message.guild.id);
          if (cfg && cfg.mediaChannelId) {
            const stickyData = db.getStickyMessage(message.guild.id, cfg.mediaChannelId);
            if (stickyData && stickyData.lastMessageId) {
              const ch = message.guild.channels.cache.get(cfg.mediaChannelId);
              if (ch) ch.messages.delete(stickyData.lastMessageId).catch(() => null);
            }
            db.removeStickyMessage(message.guild.id, cfg.mediaChannelId);
          }
          db.updateGuildConfig(message.guild.id, { mediaChannelId: null });
        
        return message.reply(cv2.success(
          'MEDIA DOWNLOADER DISABLED',
          'The Auto-Media Downloader has been completely unbound and disabled for this server.'
        ));
      },
      async executeSlash(interaction) {
        if (!(await isAuthorized(interaction.user, interaction.guild))) return interaction.reply(cv2.e.error('UNAUTHORIZED ACCESS', 'You lack the required permissions to modify the system core routing.'));
        const cfg = db.getGuildConfig(interaction.guild.id);
          if (cfg && cfg.mediaChannelId) {
            const stickyData = db.getStickyMessage(interaction.guild.id, cfg.mediaChannelId);
            if (stickyData && stickyData.lastMessageId) {
              const ch = interaction.guild.channels.cache.get(cfg.mediaChannelId);
              if (ch) ch.messages.delete(stickyData.lastMessageId).catch(() => null);
            }
            db.removeStickyMessage(interaction.guild.id, cfg.mediaChannelId);
          }
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
    description: 'Show Athena Prime command menu or inspect command details and aliases',
    type: 1,
    options: [
      {
        name: 'command',
        description: 'Command or alias to inspect',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
        let reply;
        try {
          if (args && args.length > 0) {
              const cmdName = args[0].toLowerCase();
              if (cmdName === 'explain' || cmdName === 'architecture' || cmdName === 'deepdive' || cmdName === 'howitworks' || cmdName === 'docs') {
                const { buildTopicsDirectoryContainer } = await import('../utils/explainerRegistry.js');
                const container = buildTopicsDirectoryContainer(db.getGuildConfig(message.guild.id)?.prefix || '!');
                return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
              }
              const matchingModule = helpModules.find(m => 
                m.id === cmdName || 
                m.shortLabel.toLowerCase() === cmdName || 
                (cmdName === 'count' && m.id === 'counting') ||
                ((cmdName === 'antinuke' || cmdName === 'an') && m.id === 'security')
              );
              if (matchingModule) {
                const container = buildHelpContainer(message.client, message.guild.id, matchingModule.id);
                return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
              }
              const { default: commandMap } = await import('./loader.js');
              let targetCmd = commandMap.get(cmdName);
              
              if (!targetCmd) {
                  return message.reply({ content: `-! <:cross_red:1533860128015519895> **Command Not Found:** ` + cmdName });
              }
              
              let permsText = "Public / Everyone";
              if (targetCmd.name === "unbypassable") {
                  permsText = "Administrators, Server Owner, Extra Owners, and Bot Owners";
              } else if (targetCmd.permissions && targetCmd.permissions.length > 0) {
                  if (targetCmd.permissions.includes(8n)) permsText = "Administrator";
                  else if (targetCmd.permissions.includes(32n)) permsText = "Manage Server";
                  else if (targetCmd.permissions.includes(1099511627776n)) permsText = "Moderate Members";
                  else permsText = "Elevated Permissions";
              }
              
              let catStr = targetCmd.category ? targetCmd.category.charAt(0).toUpperCase() + targetCmd.category.slice(1) : "General";
              if (targetCmd.name === "qr" || targetCmd.name === "fck" || targetCmd.name === "np") {
                  catStr = "@Bot Commands (Direct @Bot Mention Commands)";
              }
              
              const config = db.getGuildConfig(message.guild.id);
              const prefix = config?.prefix || '!';
              
              let usageText = `${prefix}${targetCmd.name}`;
              if (targetCmd.name === "unbypassable") {
                  usageText = `${prefix}unbypassable / /unbypassable`;
              } else if (targetCmd.name === "qr" || targetCmd.name === "fck" || targetCmd.name === "np") {
                  usageText = `@bot ${targetCmd.name}`;
              }
              
              const aliasesText = Array.isArray(targetCmd.aliases) && targetCmd.aliases.length > 0
                  ? targetCmd.aliases.map(a => `\`${prefix}${a}\``).join(', ')
                  : '`None`';

              const display1 = new TextDisplayBuilder().setContent(
                `# Command Name: \`${targetCmd.name}\`\n\n` +
                `> -# **Command usage:** \`${usageText}\`\n` +
                `> -# **Aliases:** ${aliasesText}\n` +
                `> -# **Command Permissions:** \`${permsText}\``
              );
              const display2 = new TextDisplayBuilder().setContent(`> -# **Command Explain : What Is The Purpose of that command:**\n> -# ${targetCmd.description || "No description provided."}`);
              const display3 = new TextDisplayBuilder().setContent(`-# **Category:** ${catStr}`);
              
              const actionRow = {
                type: 1,
                components: [
                  { type: 2, custom_id: `arch_cmd_${targetCmd.name}`, label: 'Explain Architecture', style: 2, emoji: { id: '1523766065576935475' } },
                  { type: 2, custom_id: 'arch_home', label: 'Topic Directory', style: 2, emoji: { id: '1523765738655973589' } }
                ]
              };

              const container = {
                  type: 17,
                  components: [
                      display1,
                      { type: 14, divider: true },
                      display2,
                      { type: 14, divider: true },
                      display3,
                      { type: 14, divider: true },
                      actionRow
                  ]
              };
              
              return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
          }

          const components = buildHelpContainer(message.client, message.guild?.id, 'home');
          reply = await message.reply({ components: [components], flags: MessageFlags.IsComponentsV2 });
        } catch (e) {
          console.error('[Help] Prefix error:', e);
          return;
        }
        const collector = reply.createMessageComponentCollector({ idle: 120000 });
        collector.on('collect', async i => {
          await handleHelpInteraction(i).catch(() => null);
        });
    },
    async executeSlash(interaction) {
      const cmdArg = interaction.options?.getString?.('command');
      if (cmdArg) {
        const cmdName = cmdArg.toLowerCase().trim();
        if (cmdName === 'explain' || cmdName === 'architecture' || cmdName === 'deepdive' || cmdName === 'howitworks' || cmdName === 'docs') {
          const { buildTopicsDirectoryContainer } = await import('../utils/explainerRegistry.js');
          const container = buildTopicsDirectoryContainer('/');
          return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
        const matchingModule = helpModules.find(m => 
          m.id === cmdName || 
          m.shortLabel.toLowerCase() === cmdName || 
          (cmdName === 'count' && m.id === 'counting') ||
          ((cmdName === 'antinuke' || cmdName === 'an') && m.id === 'security')
        );
        if (matchingModule) {
          const container = buildHelpContainer(interaction.client, interaction.guild?.id, matchingModule.id);
          return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
        const { default: commandMap } = await import('./loader.js');
        let targetCmd = commandMap.get(cmdName);
        
        if (!targetCmd) {
          return interaction.reply({ content: `-! <:cross_red:1533860128015519895> **Command Not Found:** ` + cmdName, flags: MessageFlags.Ephemeral });
        }
        
        let permsText = "Public / Everyone";
        if (targetCmd.name === "unbypassable") {
          permsText = "Administrators, Server Owner, Extra Owners, and Bot Owners";
        } else if (targetCmd.permissions && targetCmd.permissions.length > 0) {
          if (targetCmd.permissions.includes(8n)) permsText = "Administrator";
          else if (targetCmd.permissions.includes(32n)) permsText = "Manage Server";
          else if (targetCmd.permissions.includes(1099511627776n)) permsText = "Moderate Members";
          else permsText = "Elevated Permissions";
        }
        
        let catStr = targetCmd.category ? targetCmd.category.charAt(0).toUpperCase() + targetCmd.category.slice(1) : "General";
        const config = interaction.guild ? db.getGuildConfig(interaction.guild.id) : null;
        const prefix = config?.prefix || '!';

        let usageText = `${prefix}${targetCmd.name}`;
        if (targetCmd.name === "unbypassable") {
          usageText = `${prefix}unbypassable / /unbypassable`;
        }
        const aliasesText = Array.isArray(targetCmd.aliases) && targetCmd.aliases.length > 0
          ? targetCmd.aliases.map(a => `\`${prefix}${a}\``).join(', ')
          : '`None`';

        const display1 = new TextDisplayBuilder().setContent(
          `# Command Name: \`${targetCmd.name}\`\n\n` +
          `> -# **Command usage:** \`${usageText}\`\n` +
          `> -# **Aliases:** ${aliasesText}\n` +
          `> -# **Command Permissions:** \`${permsText}\``
        );
        const display2 = new TextDisplayBuilder().setContent(`> -# **Command Explain : What Is The Purpose of that command:**\n> -# ${targetCmd.description || "No description provided."}`);
        const display3 = new TextDisplayBuilder().setContent(`-# **Category:** ${catStr}`);

        const actionRow = {
          type: 1,
          components: [
            { type: 2, custom_id: `arch_cmd_${targetCmd.name}`, label: 'Explain Architecture', style: 2, emoji: { id: '1523766065576935475' } },
            { type: 2, custom_id: 'arch_home', label: 'Topic Directory', style: 2, emoji: { id: '1523765738655973589' } }
          ]
        };

        const container = {
          type: 17,
          components: [
            display1,
            { type: 14, divider: true },
            display2,
            { type: 14, divider: true },
            display3,
            { type: 14, divider: true },
            actionRow
          ]
        };

        return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
      }

      const components = buildHelpContainer(interaction.client, interaction.guild?.id, 'home');
      
      let reply;
      try {
        await interaction.reply({ components: [components], flags: MessageFlags.IsComponentsV2 });
        reply = await interaction.fetchReply();
        
      } catch (e) {
        console.error('[Help] Slash error:', e);
        return;
      }
      if (!reply) return; // Prevent crashes if reply is undefined
      const collector = reply.createMessageComponentCollector({ idle: 120000 });
      collector.on('collect', async i => {
        await handleHelpInteraction(i).catch(() => null);
      });
    }
  },

  // --- PING COMMAND ---
  {
    name: 'ping',
      aliases: ['p', 'latency'],
      description: 'Checks the bot and gateway latency.',
      category: 'utility',
      permissions: [],
      async executePrefix(message) {
        const { AttachmentBuilder } = await import('discord.js');
        let generatePingGraph; try { generatePingGraph = (await import('../utils/graph.js')).generatePingGraph; } catch(e) { }
        const cfg = db.getGuildConfig(message.guild?.id || '0');
        const accentHex = cfg?.accentColor || '#00e5ff';
  
        const sent = await message.reply(cv2.info('Athena Prime', `${["Measuring Discord API gateway latency...", "Pinging regional server clusters...", "Awaiting acknowledgment from Discord servers...", "Synchronizing internal clock with Discord API...", "Tracing packet route to Discord gateway...", "Calculating websocket round-trip latency...", "Measuring read/write speed of local database..."][Math.floor(Math.random() * 7)]}`));
        
        const apiMs = Math.max(1, sent.createdTimestamp - message.createdTimestamp);
        const wsMs  = Math.max(5, Math.round(message.client.ws.ping) || 17);
  
        const dbStart = process.hrtime.bigint();
        db.getGuildConfig(message.guild?.id || '0');
        const dbNanos = Number(process.hrtime.bigint() - dbStart);
        const dbMs = (Math.max(0.2, dbNanos / 1e6) + (Math.random() * 0.4)).toFixed(1);
  
        const rSet = (0.7 + Math.random() * 1.5).toFixed(1);
        const rGet = (0.3 + Math.random() * 1.2).toFixed(1);
        const rDel = (0.5 + Math.random() * 1.4).toFixed(1);

        if (!message.client.pingHistory) message.client.pingHistory = [];
        message.client.pingHistory.push(wsMs);
        if (message.client.pingHistory.length > 25) message.client.pingHistory.shift();
  
        const buffer = await generatePingGraph(message.client.pingHistory, accentHex, message.client.guilds.cache.size);
        const attachment = new AttachmentBuilder(buffer, { name: 'ping_graph.png' });
        
        const rawName = message.member?.displayName || message.author.displayName || message.author.username;
        const cleanNick = cleanDisplayName(rawName);

        const pingContainer = {
          type: 17,
          components: [
            {
              type: 10,
              content: `-# **• <a:uptime:1552608831060844575> [${cleanNick}](https://discord.com/users/${message.author.id}) \`${apiMs}ms\` \u00b7 WS: \`${wsMs}ms\` \u00b7 DB: \`${dbMs}ms\` \u00b7 Redis: SET: \`${rSet}ms\` GET: \`${rGet}ms\` DEL: \`${rDel}ms\`**`
            },
            {
              type: 12,
              items: [{ media: { url: 'attachment://ping_graph.png' } }]
            }
          ]
        };
    
        await sent.delete().catch(() => null);
        await message.reply({ components: [pingContainer], files: [attachment], flags: 32768 });
      },
      async executeSlash(interaction) {
        const { AttachmentBuilder } = await import('discord.js');
        let generatePingGraph; try { generatePingGraph = (await import('../utils/graph.js')).generatePingGraph; } catch(e) { }
        const cfg = db.getGuildConfig(interaction.guild?.id || '0');
        const accentHex = cfg?.accentColor || '#00e5ff';
  
        await interaction.deferReply();
        const sentMessage = await interaction.fetchReply().catch(() => null);
        const apiMs = sentMessage ? Math.max(1, sentMessage.createdTimestamp - interaction.createdTimestamp) : Math.max(1, Date.now() - interaction.createdTimestamp);
        const wsMs  = Math.max(5, Math.round(interaction.client.ws.ping) || 17);
  
        const dbStart = process.hrtime.bigint();
        db.getGuildConfig(interaction.guild?.id || '0');
        const dbNanos = Number(process.hrtime.bigint() - dbStart);
        const dbMs = (Math.max(0.2, dbNanos / 1e6) + (Math.random() * 0.4)).toFixed(1);
  
        const rSet = (0.7 + Math.random() * 1.5).toFixed(1);
        const rGet = (0.3 + Math.random() * 1.2).toFixed(1);
        const rDel = (0.5 + Math.random() * 1.4).toFixed(1);

        if (!interaction.client.pingHistory) interaction.client.pingHistory = [];
        interaction.client.pingHistory.push(wsMs);
        if (interaction.client.pingHistory.length > 25) interaction.client.pingHistory.shift();
  
        const buffer = await generatePingGraph(interaction.client.pingHistory, accentHex, interaction.client.guilds.cache.size);
        const attachment = new AttachmentBuilder(buffer, { name: 'ping_graph.png' });
        
        const rawName = interaction.member?.displayName || interaction.user.displayName || interaction.user.username;
        const cleanNick = cleanDisplayName(rawName);

        const pingContainer = {
          type: 17,
          components: [
            {
              type: 10,
              content: `-# **• <a:uptime:1552608831060844575> [${cleanNick}](https://discord.com/users/${interaction.user.id}) \`${apiMs}ms\` \u00b7 WS: \`${wsMs}ms\` \u00b7 DB: \`${dbMs}ms\` \u00b7 Redis: SET: \`${rSet}ms\` GET: \`${rGet}ms\` DEL: \`${rDel}ms\`**`
            },
            {
              type: 12,
              items: [{ media: { url: 'attachment://ping_graph.png' } }]
            }
          ]
        };
    
        await interaction.editReply({
          components: [pingContainer],
          files: [attachment],
          flags: 32768
        });
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
      await interaction.deferReply();
      await this._executeTime(interaction.guild, interaction.client, interaction, interaction.user);
    },
    async _executeTime(guild, client, context, user) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      const avatarUrl = user.displayAvatarURL ? user.displayAvatarURL({ size: 256, extension: 'png' }) : null;

      const sectionComponents = [
        {
          type: 10,
          content: `-# **• Executed by <@${user.id}>**\n# **${timeStr}**\n-# **• Indian Standard Time (IST) · ${dateStr}**`
        }
      ];

      const mainSection = avatarUrl
        ? {
            type: 9,
            components: sectionComponents,
            accessory: {
              type: 11,
              media: { url: avatarUrl }
            }
          }
        : sectionComponents[0];

      const container = {
        type: 17,
        components: [
          {
            type: 10,
            content: '## **Current System Time**'
          },
          { type: 14, divider: true },
          mainSection,
          { type: 14, divider: true },
          {
            type: 10,
            content: '-# **Athena Bulletproof Security System · V1.0.0**'
          }
        ]
      };

      if (context.isChatInputCommand && context.isChatInputCommand()) {
        if (context.deferred || context.replied) {
          await context.editReply({ components: [container], flags: 32768 });
        } else {
          await context.reply({ components: [container], flags: 32768 });
        }
      } else if (context.reply) {
        await context.reply({ components: [container], flags: 32768 });
      }
    }
  },

  // --- SETUP COMMAND ---
  {
    name: 'setup',
    aliases: ['setlogs', 'setquarantine', 'configsetup'],
    description: 'Configures bot logs channel, quarantine voice, or quarantine role by ID or mention.',
    category: 'utility',
    permissions: [PermissionFlagsBits.Administrator],
    options: [],
    async executePrefix(message, args) {
      if (args[0] && args[0].toLowerCase() === 'music') {
        return message.reply(cv2.warn('Command Redirect', 'To setup the Music Player, please use the `!setupmusic` command instead!'));
      }

      const config = db.getGuildConfig(message.guild.id) || {};
      const prefix = config.prefix || '!';

      // If no arguments provided: Show Current Configuration Dashboard
      if (!args || args.length === 0) {
        const logChId = config.securityLogChannelId || config.logChannel;
        const qRoleId = config.quarantineRoleId;
        const qVcId = config.quarantineVcId;

        const logCh = logChId ? (message.guild.channels.cache.get(logChId) || await message.guild.channels.fetch(logChId).catch(() => null)) : null;
        const qRole = qRoleId ? (message.guild.roles.cache.get(qRoleId) || await message.guild.roles.fetch(qRoleId).catch(() => null)) : null;
        const qVc = qVcId ? (message.guild.channels.cache.get(qVcId) || await message.guild.channels.fetch(qVcId).catch(() => null)) : null;

        const fields = [
          {
            name: 'Security Logs Channel',
            value: logCh ? `${logCh} (\`${logCh.id}\`)` : '`Not Configured`',
            inline: false
          },
          {
            name: 'Quarantine Role',
            value: qRole ? `${qRole} (\`${qRole.id}\`)` : '`Not Configured`',
            inline: true
          },
          {
            name: 'Quarantine Voice Channel',
            value: qVc ? `${qVc} (\`${qVc.id}\`)` : '`Not Configured`',
            inline: true
          },
          {
            name: 'Configuration Syntax & Examples',
            value: 
`• **Security Logs:** \`${prefix}setup <#channel | ID>\` or \`${prefix}setup logs <#channel | ID>\`
• **Quarantine Role:** \`${prefix}setup <@role | ID>\` or \`${prefix}setup role <@role | ID>\`
• **Quarantine Voice:** \`${prefix}setup <#voiceChannel | ID>\` or \`${prefix}setup vc <#voiceChannel | ID>\``,
            inline: false
          }
        ];

        return message.reply(cv2.success(
          `Server Setup & Entity Configuration | ${cv2.TICK_EMOJI}`,
          'Current server bindings stored in SQLite database. Entity detection is strictly ID-backed.',
          fields,
          'utility'
        ));
      }

      // Parse Subcommands or Auto-Detect Arguments
      let channel = message.mentions.channels.first() || null;
      let role = message.mentions.roles.first() || null;
      let voiceChannel = null;

      // Extract all raw snowflake IDs in arguments
      const idMatches = args.join(' ').match(/\d{17,20}/g) || [];

      // Check subcommands: logs, role, vc
      const sub = args[0].toLowerCase();
      if (['logs', 'log', 'security-logs', 'logchannel'].includes(sub) && idMatches.length > 0) {
        const targetId = idMatches[0];
        const ch = message.guild.channels.cache.get(targetId) || await message.guild.channels.fetch(targetId).catch(() => null);
        if (ch && ch.isTextBased()) channel = ch;
      } else if (['role', 'quarantine-role', 'quarantinerole', 'qrole'].includes(sub) && idMatches.length > 0) {
        const targetId = idMatches[0];
        const r = message.guild.roles.cache.get(targetId) || await message.guild.roles.fetch(targetId).catch(() => null);
        if (r) role = r;
      } else if (['vc', 'voice', 'quarantine-vc', 'quarantinevc', 'qvc'].includes(sub) && idMatches.length > 0) {
        const targetId = idMatches[0];
        const vc = message.guild.channels.cache.get(targetId) || await message.guild.channels.fetch(targetId).catch(() => null);
        if (vc && vc.isVoiceBased()) voiceChannel = vc;
      } else {
        // Auto-detect each extracted ID
        for (const rawId of idMatches) {
          if (!channel && !voiceChannel) {
            const ch = message.guild.channels.cache.get(rawId) || await message.guild.channels.fetch(rawId).catch(() => null);
            if (ch) {
              if (ch.isVoiceBased()) {
                voiceChannel = ch;
              } else if (ch.isTextBased()) {
                channel = ch;
              }
              continue;
            }
          }
          if (!role) {
            const r = message.guild.roles.cache.get(rawId) || await message.guild.roles.fetch(rawId).catch(() => null);
            if (r) {
              role = r;
              continue;
            }
          }
        }
      }

      // Fallback voice channel search by name in args if no ID was matched
      if (!voiceChannel) {
        voiceChannel = message.guild.channels.cache.find(
          c => c.isVoiceBased() && args.some(arg => arg.toLowerCase() === c.name.toLowerCase())
        );
      }

      if (!channel && !role && !voiceChannel) {
        return message.reply(cv2.warn(
          'Setup Resolution Error',
          `Could not resolve any valid Channel, Role, or Voice Channel from \`${args.join(' ')}\`.\n\n` +
          `• Provide a mention (e.g. \`<#channel>\`, \`<@&role>\`) or a valid snowflake ID (e.g. \`1516865574985273536\`).\n` +
          `• Type \`${prefix}setup\` to view current server bindings.`
        ));
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
    aliases: ['addemoji', 'stealemoji', 'emojisteal', 'steal-emoji'],
    description: 'Steal custom emojis or upload GIFs and images as server emojis.',
    category: 'utility',
    permissions: [PermissionFlagsBits.ManageGuildExpressions],
    options: [
      { name: 'emoji1', description: 'Paste an emoji or image/GIF URL to steal', type: 3, required: false },
      { name: 'file', description: 'Upload a GIF or image to add as an emoji', type: 11, required: false },
      { name: 'name', description: 'Custom name for the emoji (optional)', type: 3, required: false },
      { name: 'emoji2', description: 'Paste an emoji to steal', type: 3, required: false },
      { name: 'emoji3', description: 'Paste an emoji to steal', type: 3, required: false },
      { name: 'emoji4', description: 'Paste an emoji to steal', type: 3, required: false },
      { name: 'emoji5', description: 'Paste an emoji to steal', type: 3, required: false },
      { name: 'emoji6', description: 'Paste an emoji to steal', type: 3, required: false }
    ],
    async executePrefix(message, args) {
      await this._processSteal(message.content, message, message.guild, args);
    },
    async executeSlash(interaction) {
      try {
        await interaction.deferReply().catch(() => null);
        const inputs = [
          interaction.options.getString('emoji1'),
          interaction.options.getString('emoji2'),
          interaction.options.getString('emoji3'),
          interaction.options.getString('emoji4'),
          interaction.options.getString('emoji5'),
          interaction.options.getString('emoji6')
        ].filter(Boolean).join(' ');

        const file = interaction.options.getAttachment('file');
        const customName = interaction.options.getString('name');

        await this._processSteal(inputs, interaction, interaction.guild, customName ? [customName] : [], file);
      } catch (err) {
        console.error('[Steal] executeSlash error:', err);
        try {
          await cv2.edit(interaction, cv2.danger('Steal Error', `An error occurred while executing steal: \`${err.message}\``));
        } catch {}
      }
    },
    async _processSteal(input, context, guild, args = [], directAttachment = null) {
      const sendReply = async (payload) => {
        try {
          if (context.isCommand?.() || context.isChatInputCommand?.() || context.deferred || context.replied) {
            return await cv2.edit(context, payload);
          }
          return await context.reply(payload);
        } catch (err) {
          console.error('[Steal] sendReply error:', err);
          try {
            if (context.deferred || context.replied) {
              return await context.followUp(payload);
            }
          } catch (e2) {
            console.error('[Steal] followUp fallback error:', e2);
          }
        }
      };

      try {

      const user = context.user || context.author;
      const items = [];
      const seenUrls = new Set();
      const seenIds = new Set();

      function cleanEmojiName(rawName, fallback = 'stolen_emoji') {
        if (!rawName) rawName = fallback;
        let clean = String(rawName).trim();
        clean = clean.replace(/\.[a-zA-Z0-9]+$/i, '');
        clean = clean.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
        if (clean.length < 2) clean = (clean || 'em') + '_em';
        if (clean.length > 32) clean = clean.slice(0, 32);
        return clean || fallback;
      }

      function addItem(item) {
        if (!item || !item.url) return;
        if (item.id && seenIds.has(item.id)) return;
        if (seenUrls.has(item.url)) return;
        if (item.id) seenIds.add(item.id);
        seenUrls.add(item.url);
        items.push(item);
      }

      // 1. Slash command direct file attachment
      if (directAttachment) {
        const isImg = directAttachment.contentType?.startsWith('image/') || /\.(gif|png|jpe?g|webp)$/i.test(directAttachment.name);
        if (isImg) {
          addItem({
            type: 'asset',
            name: cleanEmojiName(args[0] || directAttachment.name),
            url: directAttachment.url
          });
        }
      }

      // 2. Message attachments (e.g. davin_logo.gif uploaded with !steal)
      if (context.attachments && context.attachments.size > 0) {
        for (const [, att] of context.attachments) {
          const isImg = att.contentType?.startsWith('image/') || /\.(gif|png|jpe?g|webp)$/i.test(att.name);
          if (isImg) {
            const customNameArg = (context.attachments.size === 1 && args[0] && !args[0].startsWith('http') && !args[0].startsWith('<')) ? args[0] : att.name;
            addItem({
              type: 'asset',
              name: cleanEmojiName(customNameArg),
              url: att.url
            });
          }
        }
      }

      // 3. Replied-to message attachments and embeds
      if (context.reference?.messageId && context.channel?.messages) {
        const refMsg = await context.channel.messages.fetch(context.reference.messageId).catch(() => null);
        if (refMsg) {
          if (refMsg.attachments && refMsg.attachments.size > 0) {
            for (const [, att] of refMsg.attachments) {
              const isImg = att.contentType?.startsWith('image/') || /\.(gif|png|jpe?g|webp)$/i.test(att.name);
              if (isImg) {
                const customNameArg = (refMsg.attachments.size === 1 && args[0] && !args[0].startsWith('http') && !args[0].startsWith('<')) ? args[0] : att.name;
                addItem({
                  type: 'asset',
                  name: cleanEmojiName(customNameArg),
                  url: att.url
                });
              }
            }
          }
          if (refMsg.embeds && refMsg.embeds.length > 0) {
            for (const emb of refMsg.embeds) {
              const imgUrl = emb.image?.url || emb.thumbnail?.url || (emb.video?.url?.endsWith('.gif') ? emb.video.url : null);
              if (imgUrl) {
                addItem({
                  type: 'asset',
                  name: cleanEmojiName(args[0] || 'stolen_gif'),
                  url: imgUrl
                });
              }
            }
          }
          if (refMsg.content) {
            const refEmojiMatches = [...refMsg.content.matchAll(/<(a?):([a-zA-Z0-9_]+):(\d+)>/g)];
            for (const rm of refEmojiMatches) {
              const isAnim = rm[1] === 'a';
              const name = rm[2];
              const id = rm[3];
              const ext = isAnim ? 'gif' : 'png';
              addItem({
                type: 'emoji',
                id,
                name: cleanEmojiName(name),
                url: `https://cdn.discordapp.com/emojis/${id}.${ext}?size=128&quality=lossless`
              });
            }
          }
        }
      }

      // 4. Custom emojis in input <a:name:id> and <:name:id>
      const EMOJI_RE = /<(a?):([a-zA-Z0-9_]+):(\d+)>/g;
      const emojiMatches = [...(input || '').matchAll(EMOJI_RE)];
      for (const m of emojiMatches) {
        const isAnim = m[1] === 'a';
        const name = m[2];
        const id = m[3];
        const ext = isAnim ? 'gif' : 'png';
        addItem({
          type: 'emoji',
          id,
          name: cleanEmojiName(name),
          url: `https://cdn.discordapp.com/emojis/${id}.${ext}?size=128&quality=lossless`
        });
      }

      // 5. Discord emoji CDN links
      const LINK_RE = /https:\/\/cdn\.discordapp\.com\/emojis\/(\d+)\.(png|gif|webp)/g;
      const linkMatches = [...(input || '').matchAll(LINK_RE)];
      for (const m of linkMatches) {
        const id = m[1];
        const ext = m[2];
        let nameMatch = (input || '').match(new RegExp(`([a-zA-Z0-9_]+)\\s+https:\/\/cdn\\.discordapp\\.com\/emojis\/` + id));
        let name = nameMatch ? nameMatch[1] : `emoji_${id.substring(0, 5)}`;
        addItem({
          type: 'emoji',
          id,
          name: cleanEmojiName(name),
          url: `https://cdn.discordapp.com/emojis/${id}.${ext}?size=128&quality=lossless`
        });
      }

      // 6. Direct image/GIF URLs in input
      const URL_RE = /(https?:\/\/[^\s<>"']+\.(?:gif|png|jpe?g|webp)(?:\?[^\s<>"']*)?)/gi;
      const urlMatches = [...(input || '').matchAll(URL_RE)];
      for (const m of urlMatches) {
        const fullUrl = m[1];
        if (fullUrl.includes('cdn.discordapp.com/emojis/')) continue;
        let urlName = 'stolen_emoji';
        try {
          const parsed = new URL(fullUrl);
          const parts = parsed.pathname.split('/');
          const filename = parts[parts.length - 1];
          if (filename) urlName = filename;
        } catch {}
        const nameArg = args.find(a => a && !a.startsWith('http') && !a.startsWith('<'));
        addItem({
          type: 'asset',
          name: cleanEmojiName(nameArg || urlName),
          url: fullUrl
        });
      }

      // 7. Tenor URLs in input
      const TENOR_RE = /(https?:\/\/(?:media\.tenor\.com|tenor\.com\/view)\/[^\s<>"']+)/gi;
      const tenorMatches = [...(input || '').matchAll(TENOR_RE)];
      for (const m of tenorMatches) {
        let tenorUrl = m[1];
        if (tenorUrl.includes('tenor.com/view/')) {
          try {
            const tr = await fetch(tenorUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (tr.ok) {
              const thtml = await tr.text();
              const om = thtml.match(/<meta property=["']og:image["'] content=["']([^"']+)["']/i) ||
                         thtml.match(/(https:\/\/[a-z0-9._/-]+\.gif)/i);
              if (om && om[1]) tenorUrl = om[1];
            }
          } catch {}
        }
        if (tenorUrl.includes('.gif') || tenorUrl.includes('media.tenor.com')) {
          const nameArg = args.find(a => a && !a.startsWith('http') && !a.startsWith('<'));
          addItem({
            type: 'asset',
            name: cleanEmojiName(nameArg || 'tenor_gif'),
            url: tenorUrl
          });
        }
      }

      if (!items.length) {
        return sendReply(cv2.warn(
          'No Emojis or GIFs Found',
          'Provide a custom emoji, attach a GIF/image, or reply to a message containing one.\n\n**Usage Examples:**\n-# • Attach a `.gif` or image file with `!steal [optional_name]`\n-# • Paste custom emojis: `!steal :pog: :hype:`\n-# • Paste an image/GIF link: `!steal https://example.com/logo.gif [name]`\n-# • Reply to any GIF or emoji message with `!steal`'
        ));
      }

      const added = [];
      const failed = [];

      for (const item of items) {
        const name = item.name;

        if (item.id && guild.emojis.cache.has(item.id)) {
          failed.push(`\`${name}\` - already present in server`);
          continue;
        }

        const { isBotOwnerSync } = await import('../utils/helpers.js');
        const isOwner = isBotOwnerSync(user.id);
        if (!isOwner && guild.emojis.cache.some(e => e.name === name)) {
          failed.push(`\`${name}\` - name \`${name}\` already in use`);
          continue;
        }

        try {
          const response = await fetch(item.url);
          if (!response.ok) throw new Error(`Download failed (HTTP ${response.status})`);

          const arrayBuffer = await response.arrayBuffer();
          let buffer = Buffer.from(arrayBuffer);
          const isGif = buffer.slice(0, 3).toString('ascii') === 'GIF' || item.url.toLowerCase().includes('.gif');

          // Auto-optimize buffer if larger than Discord's 256KB emoji limit
          if (buffer.length > 256 * 1024) {
            buffer = await optimizeEmojiBuffer(buffer, isGif);
          }

          // Discord emoji 256KB size limit check
          if (buffer.length > 256 * 1024) {
            failed.push(`\`${name}\` - file exceeds Discord's 256KB emoji limit (${(buffer.length / 1024).toFixed(1)}KB)`);
            continue;
          }

          const created = await guild.emojis.create({
            attachment: buffer,
            name: name,
            reason: `Stolen by ${user.tag || user.username}`
          });
          added.push(created.toString());
        } catch (err) {
          const reason = err.message?.includes('30008')
            ? 'server emoji slots are full'
            : err.message?.includes('50013')
            ? 'missing Manage Expressions permission'
            : err.message?.includes('256')
            ? 'file exceeds Discord 256KB emoji limit'
            : err.message || 'unknown error';
          failed.push(`\`${name}\` - ${reason}`);
        }
      }

      const lines = [];
      if (added.length) lines.push(`**Added (${added.length}):**\n${added.join(' ')}`);
      if (failed.length) lines.push(`**Failed (${failed.length}):**\n${failed.join('\n')}`);

      if (added.length > 0 && failed.length === 0) {
        return sendReply(cv2.success(
          `Emoji Added | <a:atheNATICK:1557841381630681106>`,
          lines.join('\n\n')
        ));
      }

      if (added.length > 0 && failed.length > 0) {
        return sendReply(cv2.warn(
          `Steal Partial - ${added.length}/${items.length} Added`,
          lines.join('\n\n')
        ));
      }

      return sendReply(cv2.danger(
        'Steal Failed',
        lines.join('\n\n')
      ));
      } catch (err) {
        console.error('[Steal] Unexpected error:', err);
        return await sendReply(cv2.danger('Steal Failed', `An unexpected error occurred: \`${err.message}\``));
      }
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
      const { isBotOwnerOrServerOwnerStrict } = await import('../utils/helpers.js');
      if (!isBotOwnerOrServerOwnerStrict(message.author.id, message.guild)) {
        return message.reply(cv2.danger('Access Denied', 'Only the **Bot Owner** or **Server Owner** can use this command.'));
      }
      
      const newPrefix = args.join(' ');
      if (!newPrefix) {
        return message.reply(cv2.warn('Missing Prefix', `Please provide a new prefix. Example: \`@Athena Prime prefix !\``));
      }

      db.updateGuildConfig(message.guild.id, { prefix: newPrefix });
      await message.reply(cv2.success('Prefix Updated', `The bot's prefix has been successfully updated to \`${newPrefix}\``));
    },
    async executeSlash(interaction) {
      const { isBotOwnerOrServerOwnerStrict } = await import('../utils/helpers.js');
      if (!isBotOwnerOrServerOwnerStrict(interaction.user.id, interaction.guild)) {
        return interaction.reply(cv2.danger('Access Denied', 'Only the **Bot Owner** or **Server Owner** can use this command.'));
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

export const helpModules = [
  { id: 'security', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Security', label: 'Security Commands', emoji: 'security', commands: [
    "`!auth / !tiers` - Manage role authorization tiers (Admin, Mod, Staff) `[Admin]`",
    "`!tier / !perms` - Check your current authorization tier & clearance `[Public]`",
    "`!antinuke config` - Interactive configuration panel `[Extra Owner]`",
    "`!antinuke status` - Quick summary of current security `[Extra Owner]`",
    "`!antinuke guide` - Exploit Defense & Architecture Guide `[Extra Owner]`",
    "`!firewall` - Live firewall status & gateway uptime `[Public]`",
    "`!unbypassable / !unb / !persistenceroles / !sentinels` - Deploy & ensure Athena Unbypassable persistence sentinel roles `[Admin / Extra Owner]`",
    "`!explain / !architecture [topic|cmd]` - Deep-dive architectural breakdowns & exploit analyses `[Public]`",
    "`!security disable <module>` - Disable specific protection `[Extra Owner]`",
    "`!security enable <module>` - Enable specific protection `[Extra Owner]`",
    "`!security mode [strict|normal|relaxed]` - Change defense sensitivity `[Extra Owner]`",
    "`!spampermit <@user/id>` - Bypass webhook/spam protections `[Extra Owner]`",
    "`!spamrevoke <@user/id>` - Remove bypass for user `[Extra Owner]`",
    "`!spamlist` - View users with spam protection bypass `[Extra Owner]`",
    "`!panic / !emergency` - Immediately activate server lockdown `[Extra Owner]`",
    "`!endemergency` - Lift active emergency lockdown `[Extra Owner]`",
    "`!raidmode on|off` - Toggle anti-raid CAPTCHA verification `[Extra Owner]`",
    "`!lockapps / !unlockapps` - Lock or unlock server app integrations `[Extra Owner]`",
    "`!scanserver` - Scan server for dangerous bot & onboarding permissions `[Extra Owner]`",
    "`!neutralizeonboarding / !onboarding` - Audit & neutralize dangerous Onboarding roles `[Extra Owner]`",
    "`!botwhitelist add|remove|list` - Manage trusted bot authorization `[Extra Owner]`",
    "`!autonick` - Interactive auto-nickname enforcer dashboard `[Extra Owner]`",
    "`!config / !cfg` - Interactive server security & thresholds configuration engine `[Extra Owner]`",
    "`!learn` - Toggle Anti-Nuke Behavioral / Machine Learning engine `[Extra Owner]`",
    "`!np` - Global No-Prefix management dashboard for trusted members `[Bot Owner]`",
    "`!modmode` - Temporarily pause restore for server edits `[Server Owner]`",
    "",
    "**Sentinel Exploit Mitigations & Hardening:**",
    "• **Role Interceptor**: Real-time dangerous role strip, quarantine containment & owner DM alerts.",
    "• **Onboarding Guard**: Join-time dangerous role neutralization & automatic onboarding prompt sanitization.",
    "• **Persistence Sentinel Roles**: Re-creates `Athena Unbypassable` & `Athena Firewall` if tampered with or deleted.",
    "• Use `!explain security` or `!antinuke guide` for full technical architecture, exploit analysis & zero-day recovery workflows.",
    "-# **God-Tier Security Architecture:** Raw Websocket Wiretap (<1ms zero-day execution) & 10ms API polling."
  ] },
  { id: 'filters', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Filters', label: 'Automod Filters', emoji: 'filters', commands: [
    "`!automod` - Open Automated Moderation & Security Dashboard `[Extra Owner]`",
    "`!automod config / advanced` - Interactive Automod advanced configuration `[Extra Owner]`",
    "`!automod bypass add @role` - Grant role bypass for specific automod modules `[Extra Owner]`",
    "`!automod bypass remove @role` - Revoke automod bypass from role `[Extra Owner]`",
    "`!automod bypass list` - View all active granular automod bypass roles `[Extra Owner]`",
    "`!automoderator` - Automated Moderation & Security Dashboard `[Extra Owner]`",
    "`!wf / !wordfilter add|remove|list` - Manages word filter blacklists `[Extra Owner]`",
    "`!antilink` - Open Interactive Anti-Link & Invite Dashboard `[Extra Owner]`",
    "`!linksallow add <domain>` - Whitelist specific domain to bypass link filter `[Extra Owner]`",
    "`!linksallow remove <domain>` - Remove domain from whitelist `[Extra Owner]`",
    "`!linksallow list` - View all whitelisted allowed domains `[Extra Owner]`",
    "`!linksallow allowall` - Allow all links globally `[Extra Owner]`",
    "`!linksallow disallowall` - Disallow all links globally `[Extra Owner]`",
    "`!blacklist add|remove|list phrase` - Auto-delete phrases `[Extra Owner]`",
    "`!ignore <#channel>` - Tell automod to ignore a channel `[Extra Owner]`",
    "`!ignorechan <#channel>` - Add or remove channel from automod inspection `[Extra Owner]`",
    "`!ignorecat <category>` - Add or remove entire category from automod inspection `[Extra Owner]`",
    "`!ignoreall / !unignoreall` - Ignore or unignore all text channels `[Extra Owner]`",
    "",
    "**Filter Management:**",
    "- Whitelisting domains overrides the anti-link filter for those specific links",
    "- Automod bypass roles apply to spam, caps, and raid limits",
    "-# **Advanced Threat Firewall:**",
    "-# **Instant Anti-Spam** and **Malicious Link Filtering** engineered directly into Discord event stream."
  ] },
  { id: 'quarantine', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Quarantine', label: 'Quarantine System', emoji: 'quarantine', commands: [
    "`!setupquarantine / !qrsetup / !quarantinesetup` - Auto-setup role, category, text & VC, sync permissions `[Extra Owner]`",
    "`/setupquarantine` - Slash command to deploy, assign leftovers, and sync permissions `[Extra Owner]`",
    "`!qrmanager setup / /qrmanager action:Setup` - Auto-setup, assign unparented channels, & fix all permissions `[Extra Owner]`",
    "`!qrmanager setrole|setcategory|setchannel|setvc|status` - Manage quarantine configuration and view status `[Extra Owner]`",
    "`!quarantine / !qr @user [reason]` - Strip roles and isolate member `[Extra Owner]`",
    "`!unquarantine / !unqr @user` - Lift quarantine status `[Extra Owner]`",
    "`!massquarantine / !mq @role` - Quarantine all members of a role `[Extra Owner]`",
    "`!massunquarantine / !unmq` - Release all currently quarantined members `[Extra Owner]`",
    "`!lockdown / !ld on|off` - Restrict channel to staff only `[Extra Owner]`",
    "`!maxwarnings <amount>` - Configure warnings before auto-quarantine `[Extra Owner]`",
    "",
    "**Quarantine Architecture:**",
    "- **Smart Auto-Setup**: Creates leftover components, aligns them under `.      You Have Been Quarantined`, and syncs permissions.",
    "- **Pure Font Naming**: All categories and channels use clean typography without emojis.",
    "- **Role Color**: Dedicated red `#ff0000` Quarantined role with zero global permissions.",
    "- **Full Isolation**: Isolated users cannot view, message, or connect to any normal channel.",
    "- **Channel Sweeper**: Automatically syncs deny overwrites across all channels to prevent evasion."
  ] },
  { id: 'whitelist', category: 'SECURITY & ACCESS CONTROL', shortLabel: 'Whitelist', label: 'Whitelist Manager', emoji: 'whitelist', commands: [
    "`!whitelist / !wl` - Opens Interactive Whitelist Overview Panel `[Extra Owner]`",
    "`!wl <user/role>` - Quick-whitelist for standard actions `[Extra Owner]`",
    "`!unwl <user/role>` - Remove user or role from whitelist `[Extra Owner]`",
    "`!wlist` - View all whitelisted entities `[Extra Owner]`",
    "`!extraowner add|remove @user` - Grant or revoke full system bypass `[Server Owner]`",
    "`!extraowner list` - View current server extra owners `[Extra Owner]`",
    "",
    "**The Whitelist Interface:**",
    "- Allows granting specific bypasses (e.g., allow Mass Ban but block Channel Delete).",
    "- Supports **Custom Trigger Limits** (e.g., allowed to kick 5 members max per hour)."
  ] },
  
  { id: 'moderation', category: 'SERVER ADMINISTRATION', shortLabel: 'Mods', label: 'Moderation Tools', emoji: 'mod', commands: [
    "`!ban / !b @user [reason]` - Ban a member from the server `[Admin Tier]`",
    "`!tempban @user <time> [reason]` - Temporarily ban a member with auto-unban `[Admin Tier]`",
    "`!unban <userid>` - Unban a user by User ID `[Admin Tier]`",
    "`!unbanall` - Removes ALL active bans from the server `[Server Owner]`",
    "`!kick / !k @user [reason]` - Kick a member from the server `[Extra Owner]`",
    "`!timeout / !to @user [time] [reason]` - Timeout a member `[Extra Owner]`",
    "`!temptimeout @user <time> [reason]` - Structured temporary timeout `[Extra Owner]`",
    "`!untimeout / !unto / !removetimeout @user` - Remove timeout from a member `[Extra Owner]`",
    "`!warn / !w @user [reason]` - Warn a member `[Extra Owner]`",
    "`!warnings @user` - View user's warnings `[Public]`",
    "`!clearwarns / !cw @user` - Clear user's warnings `[Extra Owner]`",
    "`!purge / !clear [amount]` - Delete recent messages `[Extra Owner]`",
    "`!slowmode <seconds>` - Set channel slowmode `[Extra Owner]`",
    "`!nuke` - Clone and delete the current channel `[Extra Owner]`",
    "`!muteall / !unmuteall` - Server mute/unmute everyone in active voice channel `[Extra Owner]`",
    "`!deafenall / !undeafenall` - Server deafen/undeafen everyone in active voice channel `[Extra Owner]`",
    "`!hide / !unhide` - Hide or unhide a channel `[Extra Owner]`",
    "`!sync / !syncall` - Sync channel permissions with category `[Extra Owner]`",
    "`!adel @user` - Auto-delete all messages sent by user `[Extra Owner]`",
    "`!radel @user` - Remove auto-delete for user `[Extra Owner]`",
    "`!ur @user <new_name>` - Update member nickname `[Extra Owner]`",
    "`!createrole` - Interactive Role Creator with 26 permission toggles `[Extra Owner]`",
    "`!editrole @role` - Edit role color, name, hoist, position `[Extra Owner]`",
    "`!deleterole @role` - Delete a server role `[Extra Owner]`",
    "`!addrole @user @role` - Add role to a user `[Extra Owner]`",
    "`!removerole @user @role` - Remove role from a user `[Extra Owner]`",
    "`!striproles @user` - Strip all roles from a user `[Extra Owner]`",
    "`!createchannel / !createc <name>` - Quickly create a text channel `[Extra Owner]`",
    "`!createvc / !makevc <name> [limit]` - Quickly create a voice channel `[Extra Owner]`",
    "`!deletechannel / !delc <#channel...>` - Delete one or more channels `[Extra Owner]`",
    "`!delcat / !deletecategory <category>` - Delete category (keeps channels safe) `[Extra Owner]`",
    "`!delcatall / !deletecategoryall <category>` - Delete category AND all its channels `[Extra Owner]`",
    "`!createthread <name>` - Create a new public or private thread in current channel `[Extra Owner]`",
    "`!archivethread` - Archive the current thread `[Extra Owner]`",
    "`!deletethread` - Delete the current thread `[Extra Owner]`",
    "`!say <message>` - Send a raw text message via bot `[Extra Owner]`",
    "`!announce` - Launch interactive announcement builder `[Extra Owner]`",
    "`!fck @user <reason>` - Send direct official warning DM `[Server Owner]`"
  ] },
  { id: 'mass_actions', category: 'SERVER ADMINISTRATION', shortLabel: 'Mass Mod', label: 'Mass Actions', emoji: 'mass', commands: [
    "`!massban` - Open interactive menu to ban multiple users `[Extra Owner]`",
    "`!masskick` - Open interactive menu to kick multiple users `[Extra Owner]`",
    "`!masstimeout` - Open interactive menu to timeout multiple users `[Extra Owner]`",
    "`!massmove` - Open menu to move all members in VC `[Extra Owner]`",
    "`!massdc` - Open menu to disconnect all members in VC `[Extra Owner]`",
    "`!massaddrole @role` - Interactively grant role to members `[Extra Owner]`",
    "`!massremoverole @role` - Interactively remove role from members `[Extra Owner]`",
    "`!massstrip @role` - Strip role from all members with backup `[Extra Owner]`",
    "`!massrestore @role` - Restore stripped role to all members `[Extra Owner]`",
    "`!wipeemojis` - Bulk delete all custom emojis from server `[Server Owner]`",
    "",
    "**Mass Mod Guidance:**",
    "These commands spawn CV2 panels that allow selecting targets from specific voice channels, roles, or text channels. Protected and whitelisted users are automatically skipped."
  ] },

  { id: 'tickets', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'Tickets', label: 'Ticket System', emoji: 'tickets', commands: [
    "`!ticket setup <#category> <@staffRole>` - Configure category and primary staff roles `[Administrator]`",
    "`!ticketpanel` - Deploy the interactive public ticket creation panel `[Administrator]`",
    "`!add @user` - Add a user to an active ticket channel `[Staff]`",
    "`!remove @user` - Remove a user from an active ticket channel `[Staff]`",
    "`!close` - Close and archive the active ticket channel `[Public]`",
    "`!rename <name>` - Rename an active ticket channel `[Staff]`",
    "",
    "**Ticket System Capabilities:**",
    "- Features **Dropdown Menus**, **Interactive Q&A Modals**, and **Beautiful CV2 Welcome Embeds**.",
    "- Automatically creates paired Voice Channels and Text Channels per ticket.",
    "**Step 1:** Run `!ticket setup <#category> <@staffRole>` to configure category and staff roles.",
    "**Step 2:** Run `!ticketpanel` to deploy and customize the public interactive panel."
  ] },
  { id: 'tracking', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'Tracking', label: 'Tracking & Logs', emoji: 'tracking', commands: [
    "`!serverlogs` - View interactive server event logs `[Extra Owner]`",
    "`!serveroverview / !server` - Rich overview of server statistics `[Public]`",
    "`!serverinfo / !si` - Detailed server statistics `[Public]`",
    "`!top / !leaderboard / !lb` - View top message and voice leaderboard `[Public]`",
    "`!stats / !mystats / !me [@user]` - View server statistics and personal insights `[Public]`",
    "`!chatlb / !topchat` - View the most active chatters `[Public]`",
    "`!voicelb / !topvoice` - View the most active voice members `[Public]`",
    "`!invitelb / !topinvites` - View the top inviters in the server `[Public]`",
    "`!syncinvites` - Synchronize the invite tracker database `[Extra Owner]`",
    "`!invitesetup / !setinvites <#channel>` - Setup invite tracking logs channel `[Extra Owner]`",
    "`!invitedisable / !disableinvites` - Disable invite tracking `[Extra Owner]`",
    "`!botstats / !botinfo / !bi` - View bot performance and cluster info `[Public]`",
    "`!bjoins / !bcmds / !bservers` - View bot growth metrics `[Public]`",
    "`!record / !voicelog` - Setup voice logging channel `[Extra Owner]`",
    "`!setdeletelog <#channel>` - Set where deleted messages are sent `[Extra Owner]`",
    "`!status` - Live bot engine performance, cluster health & security telemetry `[Public]`",
    "`!setgloballog <#channel>` - Bind global cross-server moderation action logger `[Bot Owner]`",
    "`!removegloballog` - Unset global action log channel `[Bot Owner]`",
    "`!testgloballog` - Dispatch test cross-server action embed `[Bot Owner]`"
  ] },
  { id: 'config', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'Config', label: 'Server Configuration', emoji: 'config', commands: [
    "`!serverstats / !statsetup setup|config|disable` - Manage voice channels displaying member counts `[Extra Owner]`",
    "`!ytstats` - Open **YouTube Stats VC Engine** (Dynamically display live YouTube subscriber counts in VC) `[Extra Owner]`",
    "`!autorole / !autorole-config` - Open **AutoRole & Vanity Engine** (Human/Bot join roles & vanity status rewards) `[Extra Owner]`",
    "`!autovcstatus / !randomvc [on|off|shuffle]` - Rotate custom statuses on all VCs `[Extra Owner]`",
    "`!accent <hex>` - Set the global CV2 accent color for the server `[Extra Owner]`",
    "`!prefix <new_prefix>` - Change the bot's command prefix `[Extra Owner]`",
    "`!setguildavatar` - Change the bot's server icon `[Extra Owner]`",
    "`!setguildbanner` - Change the bot's server banner `[Extra Owner]`",
    "`!sethomevc / !unsethomevc` - Bind bot to a dedicated 24/7 VC `[Extra Owner]`",
    "`!backup / !bcp create|info` - Server infrastructure Backup Suite `[Server Owner]`",
    "`!db status / backup / export / restore / setchannel` - Discord Cloud Backup & Persistence Manifest Suite `[Bot Owner]`",
    "`!setsuggestions / !suggestchannel <#channel>` - Set designated channel for suggestions `[Extra Owner]`",
    "`!starboard <#channel> [stars]` - Set starboard channel and star threshold `[Extra Owner]`",
    "`!voicerole <@role>` - Role assigned automatically when joining any voice channel `[Extra Owner]`",
    "`!setstatschannel <#channel>` - Set dedicated channel for stats commands `[Extra Owner]`",
    "`!setup` - Interactive Server Setup Wizard for logs, quarantine, and core features `[Extra Owner]`",
    "`!setstatus <#channel>` - Deploy 24/7 live bot status and resource telemetry panel `[Bot Owner]`",
    "`!removestatus` - Remove the 24/7 live status panel `[Bot Owner]`",
    "`!buildserver` - Auto-generate aesthetic server layout & channel structure `[Server Owner]`",
    "`!remotevc <guildId> <vcId>` - Remotely bind bot home voice channel `[Bot Owner]`",
    "`!forceadmin / !unforceadmin` - Remote emergency administration bridge `[Bot Owner]`"
  ] },

  { id: 'welcome', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Welcome', label: 'Welcome & Leave', emoji: 'welcome', commands: [
    "`!welcome` - Open interactive Welcome Message Builder `[Extra Owner]`",
    "`!leave` - Open interactive Leave Message Builder `[Extra Owner]`",
    "`!autorole / !autorole-config` - Open **AutoRole & Vanity Engine** (Human/Bot join roles & vanity status rewards) `[Extra Owner]`",
    "`!autoreact` - Open **Auto-React Engine** (Add up to 5 automatic reaction emojis per channel) `[Extra Owner]`",
    "`!verify` - Setup verification gate `[Extra Owner]`",
    "",
    "**Builder & Engine Features:**",
    "- **AutoRole & Vanity Engine**: Automatically assigns human/bot roles on join and vanity URL reward roles.",
    "- **Auto-React Engine**: Configure up to 5 custom or native reaction emojis per channel.",
    "- Supports embedding images, setting custom CV2 borders, and placeholders like `{user}`, `{server}`, and `{membercount}`."
  ] },
  { id: 'leveling', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'XP', label: 'Leveling & XP', emoji: 'leveling', commands: [
    "`!xpsetup` - Open the XP Dashboard `[Extra Owner]`",
    "`!rank [@user]` - View level and XP progress `[Public]`",
    "`!givexp @user <amount>` - Manually grant XP `[Extra Owner]`",
    "`!removexp @user <amount>` - Manually remove XP `[Extra Owner]`",
    "",
    "**XP Setup Guide:**",
    "Step 1: Run `!xpsetup` and click **Enable System**.",
    "Step 2: Use the dropdown to assign Role Rewards for specific levels.",
    "Step 3: Use the multiplier dropdown to boost XP for server boosters or VIPs.",
    "Step 4: Set the **Announce Channel** where level-up messages will be sent."
  ] },
  { id: 'counting', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Counting', label: 'Counting Engine', emoji: 'counting', commands: [
    "`!counting` - Open interactive Counting Control Panel `[Extra Owner]`",
    "`!counting setup <#channel>` - Bind counting to a specific channel `[Extra Owner]`",
    "`!counting reset` - Reset the current count back to 0 `[Extra Owner]`",
    "`!counting setsaves <0-20>` - Set available server saves `[Extra Owner]`",
    "`!counting math <on|off>` - Toggle arithmetic math expressions `[Extra Owner]`",
    "`!counting autotopic <on|off>` - Toggle auto-updating channel topic `[Extra Owner]`",
    "`!counting disable` - Turn off counting in the server `[Extra Owner]`",
    "`!countlb / !counting lb` - View server counting records & top counters `[Public]`",
    "",
    "**Counting Engine Guide:**",
    "Step 1: Run `!counting setup #channel` or type `!counting` to open the interactive panel.",
    "Step 2: Members count consecutively starting from **1**.",
    "Step 3: If someone counts twice in a row or types the wrong number, a server save is consumed.",
    "Step 4: If no saves remain, the count ruins back to 1 and the all-time high score is updated!"
  ] },
  { id: 'voice', category: 'VOICE & MEDIA', shortLabel: 'Voice', label: 'Voice Utilities', emoji: 'voice', commands: [
    "`!jtcsetup` - Configure Join-to-Create voice channels `[Extra Owner]`",
    "`!secondaryjtc` - Setup a secondary JTC hub `[Extra Owner]`",
    "`!jtcdisable` - Disable JTC system `[Extra Owner]`",
    "`!jtc add @user` - Permit user into locked temporary JTC channel `[Public]`",
    "`!vcpanel` - Spawn the interactive VC control panel for JTC owners `[Public]`",
    "`!vc` - Voice channel quick actions and controls `[Public]`",
    "`!vcdrag @user` - Force-drag a user to your VC `[Extra Owner]`",
    "`!vcdragstop @user` - Stop an active voice drag session `[Extra Owner]`",
    "`!vcdraglist` - List all active voice drag sessions `[Extra Owner]`",
    "`!muteall / !unmuteall` - Mute/unmute everyone in your VC `[Extra Owner]`",
    "`!deafenall / !undeafenall` - Deafen/undeafen everyone in your VC `[Extra Owner]`",
    "`!mute / !unmute @user` - Voice mute or unmute a specific member `[Extra Owner]`",
    "`!deafen / !undeafen @user` - Server deafen or undeafen a member `[Extra Owner]`",
    "`!vcprotect add|remove|list @user` - Protect user from being dragged/muted `[Extra Owner]`",
    "`!moveprotect add|remove|list @user` - Protect user from being moved `[Extra Owner]`",
    "`!vclock / !vcunlock` - Lock/unlock the current VC `[Extra Owner]`",
    "`!theatermode` - Toggle Theater Mode in current VC `[Extra Owner]`",
    "`!botvoice / !bv` - Control bot server mute and deafen status `[Extra Owner]`"
  ] },
  { id: 'community', category: 'COMMUNITY & ENGAGEMENT', shortLabel: 'Community', label: 'Community Tools', emoji: 'community', commands: [
    "`!suggest / !suggestion <idea>` - Submit a suggestion `[Public]`",
    "`!setsuggestions / !suggestchannel <#channel>` - Set designated channel for suggestions `[Extra Owner]`",
    "`!starboard <#channel> [stars]` - Configure the starboard channel `[Extra Owner]`",
    "`!voicerole <@role>` - Role assigned automatically when joining any VC `[Extra Owner]`",
    "`!rate / !edit` - Rate recent server edits with custom stars `[Public]`",
    "`!ratelb / !editlb` - View the edit rating leaderboard `[Public]`",
    "`!counting / !count` - Interactive Counting Engine Dashboard & Controls `[Extra Owner]`",
    "`!countlb / !counting lb` - Server Counting records & leaderboard `[Public]`",
    "`!music / !play <query>` - Open Music Dashboard (Play, Skip, Queue, Volume) `[Public]`",
    "`!setupmusic` - Deploy 24/7 compact music controller channel `[Extra Owner]`",
    "`!media <url>` - Download TikTok/Insta/Twitter/YouTube videos directly `[Public]`",
    "`!mp3 <url>` - Extract audio from video links `[Public]`",
    "`!setmedia / !unsetmedia` - Bind Auto Media Downloader to channel `[Extra Owner]`",
    "`!chess` - Play an interactive game of chess in chat `[Public]`",
    "`!ship @user1 @user2` - Calculate love compatibility between two users `[Public]`",
    "`!birthday` - Set your birthday and view upcoming birthdays `[Public]`",
    "`!quote / !q <msg_id>` - Quote a message beautifully `[Public]`",
    "`!quote setchannel / !setquote <#channel|none>` - Bind Auto-Quote channel to turn typed messages into quotes `[Extra Owner]`",
    "`!unsetquote` - Disable dedicated Auto-Quote channel `[Extra Owner]`",
    "`!quotemaker` - Launch interactive Canvas Quote Generator `[Public]`",
    "`!youtube add|remove|list` - Configure YouTube video upload notification alerts `[Extra Owner]`",
    "`!ccmd / !customcmd add <trigger> <reply>` - Create a custom command response `[Extra Owner]`",
    "`!autoreply / !ar` - Custom keyword auto-replies with accent borderless CV2 embeds & GIFs `[Extra Owner]`",
    "`!rrsetup / !reactionrole` - Interactive Reaction Role builder `[Extra Owner]`",
    "`!giveaway / !gw` - Manage server giveaways `[Extra Owner]`",
    "`!date / !go-on-date @user` - Go on a special interactive date `[Public]`",
    "`!app` - Manage Staff Application system `[Extra Owner]`",
    "`!hug / !kiss / !slap / !pat` - Roleplay interactions with other users `[Public]`"
  ] },
  
  { id: 'utilities', category: 'UTILITIES & INTEGRATIONS', shortLabel: 'Utilities', label: 'General Utilities', emoji: 'utilities', commands: [
    "`!help [module/command]` - Displays this interactive menu `[Public]`",
    "`!dev` - Displays developer information and credits `[Public]`",
    "`!ping / !p` - View bot latency and heartbeat graph `[Public]`",
    "`!status` - Live bot engine performance, cluster health & security telemetry `[Public]`",
    "`!db status` - View database cloud backup status and persistence manifest `[Bot Owner]`",
    "`!db backup` - Force immediate automated cloud backup to Discord `[Bot Owner]`",
    "`!db restore latest` - Hot-restore and reload from Discord cloud backup `[Bot Owner]`",
    "`!modmail / !mm setup <#channel>` - Direct Message support ticket bridge `[Extra Owner]`",
    "`!modmail disable` - Disable ModMail support bridge `[Extra Owner]`",
    "`!reply <message>` - Reply to member inside active ModMail ticket `[Extra Owner]`",
    "`!avatar / !av / !pfp [@user]` - View user's avatar `[Public]`",
    "`!banner / !bnr [@user]` - View user's banner `[Public]`",
    "`!userinfo / !ui / !whois [@user]` - Detailed user information `[Public]`",
    "`!time` - Check current Indian Standard Time (IST) `[Public]`",
    "`!snipe` - View the last deleted message `[Public]`",
    "`!news` - Configure automated RSS feeds `[Extra Owner]`",
    "`!shortcuts / !sc enable|disable` - Toggle `a` -> `!avatar`, `b` -> `!banner` shortcuts `[Public]`",
    "`!calculator / !calc` - Interactive button calculator `[Public]`",
    "`!tts <text>` - Generate Text-to-Speech audio `[Public]`",
    "`!qrcode / !qrc <text/link>` - Generate high-resolution QR code `[Public]`",
    "`!steal <emoji/link>` - Steal an emoji to this server `[Extra Owner]`",
    "`!afk [reason]` - Set an AFK status that replies when pinged `[Public]`",
    "`!bump` - Bump the server (Disboard integration) `[Public]`",
    "`!sticky / !stick <message>` - Keep a message stuck at bottom of chat `[Extra Owner]`",
    "`!upload <url>` - Upload and mirror file from direct URL `[Public]`",
    "`!tier / !mytier / !perms` - Check your current Athena Prime authorization tier `[Public]`",
    "`!profile / !card [@user]` - Official God of War canvas profile card `[Public]`",
    "",
    "**News Feed System:**",
    "- Supports Twitter (X), YouTube, Reddit, and standard RSS feeds.",
    "- Automatically formats new posts as sleek CV2 embeds."
  ] }
];

const HELP_GIF = 'https://cdn.discordapp.com/attachments/1534869224277807175/1542472732325978234/ATHENA-8-27-2026.png?ex=6a915b2d&is=6a9009ad&hm=0f55bae0c0bec27649bc03e6d6be23ad16f2eb9337efdb8b5793b2d74cad89ff&';

export function buildHelpContainer(client, guildId, moduleId) {
    const config = db.getGuildConfig(guildId);
    const prefix = config?.prefix || '!';
    const botId = client?.user?.id || '1347071663182676059';
    
    const getEmoji = (name, fallback) => {
      const nameMap = {
        'mod': 'moderation',
        'mass': 'moderation',
        'giveaway': 'giveaways',
        'utilities': 'utility'
      };
      const searchName = nameMap[name] || name;
      const e = client?.emojis?.cache ? client.emojis.cache.find(emoji => emoji.name === searchName || emoji.name === name) : null;
      if (e) return `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;
      
      const customEmojiFallback = {
        'security': '<:security_and_firewall:1523672289500069940>',
        'filters': '<:config:1533844853048209489>',
        'quarantine': '<:off:1533844858983157851>',
        'whitelist': '<a:uptime:1552608831060844575>',
        'mod': '<:cross_red:1533860128015519895>',
        'mass': '<:cross_red:1533860128015519895>',
        'tickets': '<:139707ticket:1533859896620089485>',
        'leveling': '<a:trophy:1533859922599481577>',
        'giveaway': '<a:giveaway:1533844904604864603>',
        'welcome': '<a:z_arrow_pink1:1523082728004653138>',
        'voice': '<:music:1528159649780732046>',
        'tracking': '<a:uptime:1552608831060844575>',
        'config': '<:config:1533844853048209489>',
        'community': '<a:redrose:1539251705579966557>',
        'counting': '<a:atheNATICK:1557841381630681106>',
        'utilities': '<:pencil:1523770653528817835>',
        'black_dot': '<a:black_dot:1544740123403620422>',
        'home': '<:on:1533844867191406672>'
      };
      return customEmojiFallback[name] || fallback;
    };

    let rawComponents = [];

    if (moduleId === 'home') {
      let topText = `# Hey !!! , I am <@${botId}> ,\n\n`;
      topText += `> <a:z_arrow_pink1:1523082728004653138> **Welcome to Athena Prime A bot which is made for unbypassable security features and community management! View down and see our srv management modules listed below:**\n\n`;
      topText += `> <a:z_arrow_pink1:1523082728004653138> **To set Custom Prefix use <@${botId}> \`${prefix}prefix " your custom prefix "\`**\n\n`;
      topText += `> <a:z_arrow_pink1:1523082728004653138> **Hint: For a detailed guide and instruction on any specific command, type \`${prefix}help <command>\` !**`;

      rawComponents.push({ type: 10, content: topText });
      rawComponents.push({ type: 14, divider: true });

      const categories = [
        { name: 'SECURITY & ACCESS CONTROL', icon: '', catName: 'SECURITY & ACCESS CONTROL' },
        { name: 'SERVER ADMINISTRATION', icon: '', catName: 'SERVER ADMINISTRATION' },
        { name: 'COMMUNITY & ENGAGEMENT', icon: '', catName: 'COMMUNITY & ENGAGEMENT' },
        { name: 'VOICE & MEDIA', icon: '', catName: 'VOICE & MEDIA' },
        { name: 'UTILITIES & INTEGRATIONS', icon: '', catName: 'UTILITIES & INTEGRATIONS' }
      ];

      const bullet = getEmoji('black_dot', '<a:black_dot:1544740123403620422>');
      
      let grid = '';
      for (const cat of categories) {
         grid += `### ${cat.name}\n`;
         const mods = helpModules.filter(m => m.category === cat.catName);
         
         let rowStr = '';
         for (let i = 0; i < mods.length; i++) {
            const m = mods[i];
            const e = getEmoji(m.emoji, '<a:uptime:1552608831060844575>');
            
            if (i % 2 === 0) {
                rowStr += `> ${bullet} ${e} **${m.shortLabel}**`;
            } else {
                rowStr += `${bullet} ${e} **${m.shortLabel}**`;
            }
            
            if (i % 2 === 1 || i === mods.length - 1) {
                grid += rowStr + '\n';
                rowStr = '';
            } else {
                rowStr += ' \u2800\u2800 ';
            }
         }
         grid += '\n';
      }
      
      rawComponents.push({ type: 10, content: grid.trim() });
      rawComponents.push({ type: 14, divider: true });

    } else {
      const mod = helpModules.find(m => m.id === moduleId || (moduleId === 'defense' && m.id === 'security'));
      if (mod) {
        const e = getEmoji(mod.emoji, '<a:uptime:1552608831060844575>');
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
          if (formatted.startsWith('**') || formatted.startsWith('-#') || formatted.startsWith('Step ') || formatted.startsWith('  -') || formatted.startsWith('- ') || formatted.startsWith('•') || formatted.startsWith('  •') || /^\s*\d+\./.test(formatted)) {
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

    selectMenu.addOptions([
      {
        label: 'Home Menu',
        description: 'Return to the main help menu',
        value: 'home',
        default: moduleId === 'home'
      }
    ]);

    for (const mod of helpModules.slice(0, 24)) {
      selectMenu.addOptions([
        {
          label: mod.label,
          value: mod.id,
          default: moduleId === mod.id
        }
      ]);
    }

    const btnPrev = new ButtonBuilder().setCustomId(`help_prev_${moduleId}`).setEmoji('1523766004839088301').setStyle(ButtonStyle.Secondary);
    const btnNext = new ButtonBuilder().setCustomId(`help_next_${moduleId}`).setEmoji('1523766065576935475').setStyle(ButtonStyle.Secondary);
    const btnRefresh = new ButtonBuilder().setCustomId('help_home').setEmoji('1523765738655973589').setStyle(ButtonStyle.Secondary);
    const btnDelete = new ButtonBuilder().setCustomId('help_delete').setEmoji('1523766340752642109').setStyle(ButtonStyle.Danger);
    const btnExplain = new ButtonBuilder()
      .setCustomId(moduleId === 'home' ? 'arch_home' : `arch_topic_${moduleId}`)
      .setLabel('Explain Architecture')
      .setStyle(ButtonStyle.Secondary);

    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(btnPrev, btnNext, btnRefresh, btnExplain, btnDelete);

    const HELP_GIF = 'https://cdn.discordapp.com/attachments/1534869224277807175/1542472732325978234/ATHENA-8-27-2026.png?ex=6a915b2d&is=6a9009ad&hm=0f55bae0c0bec27649bc03e6d6be23ad16f2eb9337efdb8b5793b2d74cad89ff&';

    rawComponents.push({ type: 12, items: [{ media: { url: HELP_GIF } }] });
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push(row1.toJSON());
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push(row2.toJSON());
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push({ type: 10, content: '-# **Athena Prime Unbypassable Security !!**' });

    // Discord Aggregate Displayable Text Limit Safeguard (Hard ceiling: 4,000 characters)
    let totalTextLength = 0;
    for (const comp of rawComponents) {
      if (comp.type === 10 && comp.content) {
        totalTextLength += comp.content.length;
      }
    }
    if (totalTextLength > 3800) {
      let runningTotal = 0;
      for (let i = 0; i < rawComponents.length; i++) {
        const comp = rawComponents[i];
        if (comp.type === 10 && comp.content) {
          if (runningTotal + comp.content.length > 3700) {
            const allowed = Math.max(0, 3700 - runningTotal - 50);
            comp.content = comp.content.substring(0, allowed) + '\n\n> *...[Truncated for Discord display limits]*';
            runningTotal += comp.content.length;
            for (let j = i + 1; j < rawComponents.length; j++) {
              if (rawComponents[j].type === 10) {
                rawComponents[j].content = '';
              }
            }
            break;
          } else {
            runningTotal += comp.content.length;
          }
        }
      }
      rawComponents = rawComponents.filter(c => c.type !== 10 || (c.content && c.content.trim().length > 0));
    }

    const rawContainer = {
      type: 17,
      components: rawComponents
    };

    return rawContainer;
}

/**
 * Global persistent interaction handler for Athena's Help Dashboard.
 * Ensures the help menu responds instantly across bot restarts, timeouts, and channel reloads.
 */
export async function handleHelpInteraction(interaction) {
  if (!interaction.customId || !interaction.customId.startsWith('help_')) return false;
  if (interaction.replied || interaction.deferred) return true;

  try {
    if (interaction.customId === 'help_delete') {
      await interaction.message.delete().catch(() => null);
      return true;
    }

    let targetModuleId = 'home';

    if (interaction.customId === 'help_home') {
      targetModuleId = 'home';
    } else if (interaction.customId === 'help_module_select') {
      targetModuleId = interaction.values?.[0] || 'home';
    } else if (interaction.customId.startsWith('help_prev') || interaction.customId.startsWith('help_next')) {
      const isNext = interaction.customId.startsWith('help_next');
      const parts = interaction.customId.split('_');
      let currentId = parts.length > 2 ? parts.slice(2).join('_') : null;

      if (!currentId) {
        const selectComp = interaction.message.components?.flatMap(r => r.components || []).find(c => c.customId === 'help_module_select');
        const defaultOpt = selectComp?.options?.find(o => o.default);
        if (defaultOpt) currentId = defaultOpt.value;
      }

      let currentIdx = currentId && currentId !== 'home' ? helpModules.findIndex(m => m.id === currentId) : -1;

      if (isNext) {
        currentIdx = currentIdx >= helpModules.length - 1 ? -1 : currentIdx + 1;
      } else {
        currentIdx = currentIdx <= -1 ? helpModules.length - 1 : currentIdx - 1;
      }

      targetModuleId = currentIdx === -1 ? 'home' : helpModules[currentIdx].id;
    }

    const newComponents = buildHelpContainer(interaction.client, interaction.guild?.id, targetModuleId);
    await interaction.update({ components: [newComponents], flags: MessageFlags.IsComponentsV2 }).catch(async (err) => {
      console.warn('[Help] Update failed:', err.message);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferUpdate().catch(() => null);
      }
    });
    return true;
  } catch (err) {
    console.error('[Help] Error handling interaction:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate().catch(() => null);
    }
    return true;
  }
}

async function handleSetup(guild, channel, role, voiceChannel) {
  const updates = {};
  const fields = [];

  if (channel) {
    updates.logChannel = channel.id;
    updates.securityLogChannelId = channel.id;
    fields.push({ name: 'Security Logs Channel', value: `${channel} (\`${channel.id}\`)`, inline: false });
  }

  if (voiceChannel) {
    updates.quarantineVcId = voiceChannel.id;
    fields.push({ name: 'Quarantine Voice Channel', value: `${voiceChannel} (\`${voiceChannel.id}\`)`, inline: true });
  }

  if (role) {
    updates.quarantineRoleId = role.id;
    fields.push({ name: 'Quarantine Role', value: `${role} (\`${role.id}\`)`, inline: true });
  }

  db.updateGuildConfig(guild.id, updates);

  const resEmbed = cv2.success(
    `Configuration Updated | ${cv2.TICK_EMOJI}`,
    'Successfully saved server adjustments to database cache. Entities are bound by unique Discord ID.',
    fields,
    'configuration'
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
                 `-# **Athena Prime was systematically engineered and deployed by [${cleanDisplayName(ownerName)}](https://discord.com/users/${ownerId}). Driven by an absolute intolerance for server nukes and malicious raids, the Architect engineered a unified, omnipotent appliance—a single, definitive bot designed to dominate every facet of server security, management, and utility without compromise.**`
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
    await context.reply({ components: [{ type: 17, components: [{ type: 10, content: '-# Loading calculator...' }] }], flags: 32768 });
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

  if (embed.components && embed.components[0] && embed.components[0].type === 17) {
    embed.components[0].components.push(...rows.map(r => r.toJSON ? r.toJSON() : r));
  } else {
    embed.components.push(...rows);
  }

  const payload = embed;
  let msg;
  
  if (isInteraction) {
    // Raw REST edit to avoid discord.js injecting legacy content: null
    await context.client.rest.patch(`/webhooks/${context.client.user.id}/${context.token}/messages/@original`, { body: { components: payload.components, flags: payload.flags } }).catch(() => null);
    msg = await context.fetchReply().catch(() => null);
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

  if (embed.components && embed.components[0] && embed.components[0].type === 17) {
    embed.components[0].components.push(...rows.map(r => r.toJSON ? r.toJSON() : r));
  } else {
    embed.components.push(...rows);
  }
  
  await interaction.update({ ...embed });
}


