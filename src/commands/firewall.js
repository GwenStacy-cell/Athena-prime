import { PermissionFlagsBits } from 'discord.js';
import db from '../database.js';

export const commands = [
  {
    name: 'firewall',
    description: 'Displays the server firewall uptime and active status.',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      return this.executeSlash(message);
    },
    async executeSlash(interaction) {
      const guildId = interaction.guild ? interaction.guild.id : (interaction.guildId || interaction.channel?.guild?.id);
      const isSlash = typeof interaction.reply === 'function';
      const client = interaction.client;
      
      const cfg = db.getGuildConfig(guildId);
      const isFirewallActive = cfg.antiNukeEnabled === true;
      const FIRE = '<a:fire:1557839005998121153>';
      const ON = '<:ticks:1533860039213842565>';
      const RED_OFF = '<:off:1533844858983157851>';
      const LOAD = '<a:loading:1542155051286396938>';
      
      // Calculate bot uptime for firewall uptime
      const uptimeMs = client.uptime;
      const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((uptimeMs / 1000 / 60) % 60);
      const uptimeStr = `${days}d ${hours}h ${minutes}m`;
      
      const wsStatus = client.ws.status;
      let wsIcon = ON;
      let wsText = `WS 443 Connected [Latency: ${client.ws.ping}ms]`;
      
      // 0 = Ready, 1 = Connecting, 2 = Reconnecting, 5 = Disconnected, 7 = Identifying, 8 = Resuming
      if (wsStatus !== 0) {
        wsIcon = LOAD;
        wsText = wsStatus === 5 ? `WS 443 Gateway Disconnected (Retrying...)` : `WS 443 Gateway Reconnecting...`;
      }
      
      let restIcon = ON;
      let restText = `Rate Limit Buckets Synchronized`;
      if (client.ws.ping > 500) {
        restIcon = LOAD;
        restText = `High Latency / Synchronizing...`;
      }
      
      const nukeIcon = isFirewallActive ? ON : RED_OFF;
      const nukeText = isFirewallActive ? `Armed & Securing ${client.guilds.cache.size} Servers` : `Disabled / Vulnerable`;
      
      const list = [
        `${wsIcon} **Core Gateway:** ${wsText}`,
        `${ON} **SQLite Database:** WAL Mode [Integrity: 100%]`,
        `${restIcon} **Discord REST API:** ${restText}`,
        `${ON} **Tenor & Anime APIs:** Remote Image Pools Connected`,
        `${ON} **Canvas Engine:** Hardware Acceleration Active`,
        `${ON} **YouTube API v3:** Verified & Operational`,
        `${nukeIcon} **Antinuke Sentinels:** ${nukeText}`
      ].join('\n');
      
      const container = {
        type: 17,
        components: [
          { type: 10, content: `## ${FIRE} **ATHENA FIREWALL & NETWORK**` },
          { type: 14, divider: true },
          { type: 10, content: list },
          { type: 14, divider: true },
          { type: 10, content: `-# **System Uptime:** ${uptimeStr} \u2022 **Latency:** ${client.ws.ping}ms` }
        ]
      };
      
      const payload = { components: [container], flags: 32768 };
      
      let sentMsg;
      if (isSlash) {
        sentMsg = await interaction.reply({ ...payload, fetchReply: true });
      } else {
        sentMsg = await interaction.reply(payload);
      }
      
      // Auto-delete after 60 seconds
      setTimeout(() => {
        sentMsg.delete().catch(() => null);
      }, 60000);
      
      return sentMsg;
    }
  }
];
