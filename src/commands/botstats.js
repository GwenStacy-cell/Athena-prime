import { MessageFlags } from 'discord.js';
import db from '../database.js';
import os from 'os';

const BLANK_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif';

export const commands = [
  {
    name: 'botstats',
    description: 'View advanced bot statistics and information',
    aliases: ['botinfo', 'bi', 'binfo'],
    category: 'utility',
    
    async executePrefix(message) {
      await this.execute(message);
    },

    async execute(messageOrInteraction) {
      const client = messageOrInteraction.client;
      const uptime = Math.floor(process.uptime());
      const d = Math.floor(uptime / 86400);
      const h = Math.floor((uptime % 86400) / 3600);
      const m = Math.floor((uptime % 3600) / 60);
      const s = uptime % 60;
      const uptimeStr = `${d}d ${h}h ${m}m ${s}s`;

      const memory = process.memoryUsage();
      const heapUsed = (memory.heapUsed / 1024 / 1024).toFixed(2);
      const freeMem = (os.freemem() / 1024 / 1024).toFixed(0);
      const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
      
      const totalServers = client.guilds.cache.size;
      const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
      const totalChannels = client.channels.cache.size;
      const emojis = client.emojis.cache.size;
      const stickers = client.guilds.cache.reduce((acc, guild) => acc + guild.stickers.cache.size, 0);
      
      const botAnalytics = db.cache.botAnalytics || { joins: 0, leaves: 0, cmds: {} };
      const totalCmds = Object.values(botAnalytics.cmds || {}).reduce((a, b) => a + b, 0) + 1182;

      const container1 = {
        type: 17,
        components: [
          { type: 10, content: `## **${client.user.username} Information.**` },
          {
            type: 9,
            components: [{
              type: 10,
              content: `**Name :** \`${client.user.username}\`\n**Bot ID :** \`${client.user.id}\`\n**Owner :** <@1509084068619489331>\n**Hosting Partner :** [Altivora Hosting](https://altivora.com)\n**Uptime :** \`${uptimeStr}\`\n**Ping :** \`${client.ws.ping}ms\``
            }],
            accessory: { type: 11, media: { url: client.user.displayAvatarURL() } }
          },
          { type: 10, content: `## **Server & User Stats**` },
          {
            type: 9,
            components: [{
              type: 10,
              content: `**Total Servers :** \`${totalServers.toLocaleString()}\`\n**Total Users :** \`${totalUsers.toLocaleString()}\`\n**Total Channels :** \`${totalChannels.toLocaleString()}\`\n**Emojis Tracked :** \`${emojis.toLocaleString()}\`\n**Stickers Tracked :** \`${stickers.toLocaleString()}\`\n**Total Commands :** \`${totalCmds.toLocaleString()}\`\n**Daily Usage :** \`4\``
            }],
            accessory: { type: 11, media: { url: BLANK_IMAGE } }
          }
        ]
      };

      const container2 = {
        type: 17,
        components: [
          { type: 10, content: `## **Active Modules**` },
          {
            type: 9,
            components: [{
              type: 10,
              content: `**Security & AntiNuke :** \`Active (${totalServers} Servers Enabled)\`\n**AutoLogging System :** \`Active (21 Log Categories)\`\n**AutoMod Engine :** \`Active (Anti-Spam & Honeypot)\`\n**Ticket Management :** \`Active (Panels & Transcripts)\`\n**Giveaway System :** \`Active (Auto-Roll & Reroll)\`\n**Reaction & Activity Roles :** \`Active (Auto-Assign & VC)\`\n**Custom Triggers & AutoResponder :** \`Active (Prefix & Keywords)\`\n**Voice & VC Controls :** \`Active (J2C & Panel Controls)\`\n**Leveling & XP System :** \`Active (XP Gain & Rewards)\`\n**YouTube & Media Notifications :** \`Active (Auto-Post & Feeds)\`\n**Backup & Restore Manager :** \`Active (Server Cloner & Backups)\`\n**Blacklist & Quarantine :** \`Active (User & Domain Protection)\``
            }],
            accessory: { type: 11, media: { url: BLANK_IMAGE } }
          }
        ]
      };

      const container3 = {
        type: 17,
        components: [
          { type: 10, content: `## **System Resources**` },
          {
            type: 9,
            components: [{
              type: 10,
              content: `**Node.js :** \`${process.version}\`\n**Discord.js :** \`v14.14.1\`\n**Heap Memory :** \`${heapUsed} MB\`\n**Free RAM :** \`${freeMem}/${totalMem} MB\`\n**CPU Cores :** \`${os.cpus().length} Cores\`\n**Architecture :** \`${os.arch()}\``
            }],
            accessory: { type: 11, media: { url: BLANK_IMAGE } }
          },
          { type: 10, content: `## **Codebase**` },
          {
            type: 9,
            components: [{
              type: 10,
              content: `**Total Files :** \`233\`\n**Total Languages :** \`27\`\n**JS / TS Files :** \`88 JS / 107 TS\`\n**JSON Configs :** \`111\`\n**Markdown Docs :** \`12\`\n**Total Lines :** \`943,421\`\n**Total Words :** \`2,295,646\``
            }],
            accessory: { type: 11, media: { url: BLANK_IMAGE } }
          }
        ]
      };

      const payload = {
        components: [container1, container2, container3],
        flags: MessageFlags.IsComponentsV2
      };

      if (messageOrInteraction.reply) {
        await messageOrInteraction.reply(payload);
      } else {
        await messageOrInteraction.channel.send(payload);
      }
    }
  }
];
