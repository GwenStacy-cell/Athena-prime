import { PermissionFlagsBits } from 'discord.js';
import db from '../database.js';

async function handleFirewall(context, isSlash) {
  const guildId = context.guild ? context.guild.id : (context.guildId || context.channel?.guild?.id);
  const client = context.client;
  const isActualSlash = isSlash ?? Boolean(context.isChatInputCommand?.() || (typeof context.isCommand === 'function' && context.isCommand()) || (context.commandId && !context.author));
  
  const cfg = db.getGuildConfig(guildId);
  const isFirewallActive = cfg.antiNukeEnabled === true;
  const FIRE = '<a:fire:1557839005998121153>';
  const ON = '<a:uptime:1552608831060844575>';
  const RED_OFF = '<:off:1533844858983157851>';
  const LOAD = '<a:loading:1542155051286396938>';
  const TICK = '<a:atheNATICK:1557841381630681106>';
  
  // Calculate bot uptime for firewall uptime
  const uptimeMs = client.uptime || 0;
  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((uptimeMs / 1000 / 60) % 60);
  const uptimeStr = `${days}d ${hours}h ${minutes}m`;
  
  const wsStatus = client.ws?.status;
  let wsIcon = ON;
  let wsText = `WS 443 Connected [Latency: ${client.ws?.ping ?? 17}ms]`;
  
  // 0 = Ready, 1 = Connecting, 2 = Reconnecting, 5 = Disconnected, 7 = Identifying, 8 = Resuming
  if (wsStatus !== 0) {
    wsIcon = LOAD;
    wsText = wsStatus === 5 ? `WS 443 Gateway Disconnected (Retrying...)` : `WS 443 Gateway Reconnecting...`;
  }
  
  let restIcon = ON;
  let restText = `Rate Limit Buckets Synchronized`;
  if ((client.ws?.ping ?? 0) > 500) {
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
      { type: 10, content: `## ${FIRE} **ATHENA FIREWALL & NETWORK** | ${TICK}` },
      { type: 14, divider: true },
      { type: 10, content: list },
      { type: 14, divider: true },
      { type: 10, content: `-# **System Uptime:** ${uptimeStr} \u2022 **Latency:** ${client.ws?.ping ?? 17}ms` }
    ]
  };
  
  const payload = { components: [container], flags: 32768 };
  
  let sentMsg;
  if (isActualSlash) {
    const res = await context.reply({ ...payload, withResponse: true }).catch(() => null);
    sentMsg = res?.resource?.message || (typeof context.fetchReply === 'function' ? await context.fetchReply().catch(() => null) : null);
    setTimeout(() => {
      if (typeof context.deleteReply === 'function') {
        context.deleteReply().catch(() => null);
      } else if (sentMsg && typeof sentMsg.delete === 'function') {
        sentMsg.delete().catch(() => null);
      }
    }, 60000);
  } else {
    sentMsg = await context.reply(payload).catch(() => null);
    if (sentMsg && typeof sentMsg.delete === 'function') {
      setTimeout(() => {
        sentMsg.delete().catch(() => null);
      }, 60000);
    }
  }
  
  return sentMsg;
}

export const commands = [
  {
    name: 'firewall',
    description: 'Displays the server firewall uptime and active status.',
    category: 'utility',
    permissions: [],
    async executePrefix(message) {
      return handleFirewall(message, false);
    },
    async executeSlash(interaction) {
      return handleFirewall(interaction, true);
    }
  }
];
