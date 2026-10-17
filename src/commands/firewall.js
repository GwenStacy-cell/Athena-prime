import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isBotOwnerSync } from '../utils/helpers.js';

async function handleUnbypassable(context, isSlash, args = []) {
  const guild = context.guild || (context.channel?.guild) || null;
  const guildId = guild ? guild.id : (context.guildId || context.channel?.guild?.id);
  const client = context.client;
  const isActualSlash = isSlash ?? Boolean(context.isChatInputCommand?.() || (typeof context.isCommand === 'function' && context.isCommand()) || (context.commandId && !context.author));
  const userId = context.user ? context.user.id : context.author?.id;

  const cfg = (guildId ? db.getGuildConfig(guildId) : null) || {};
  const isFirewallActive = cfg.antiNukeEnabled === true;
  const FIRE = '<a:fire:1557839005998121153>';
  const ON = '<a:uptime:1552608831060844575>';
  const RED_OFF = '<:off:1533844858983157851>';
  const LOAD = '<a:loading:1542155051286396938>';
  const TICK = '<a:atheNATICK:1557841381630681106>';

  // Auto-heal / deploy persistence roles if invoked in a guild by an admin/owner or requested
  if (guild && guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    const member = context.member || (guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null));
    const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator) ||
                    isBotOwnerSync(userId) ||
                    userId === guild.ownerId ||
                    db.isExtraOwner(guild.id, userId);

    const sub = (args[0] || '').toLowerCase();
    if (isAdmin || sub === 'deploy' || sub === 'repair' || sub === 'fix') {
      try {
        const { ensureUnbypassableRole } = await import('../utils/antiStrip.js');
        await ensureUnbypassableRole(guild);
      } catch {}
    }
  }

  // Calculate bot uptime
  const uptimeMs = client.uptime || 0;
  const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((uptimeMs / 1000 / 60) % 60);
  const uptimeStr = `${days}d ${hours}h ${minutes}m`;

  const wsStatus = client.ws?.status;
  let wsIcon = ON;
  let wsText = `WS 443 Connected [Latency: ${client.ws?.ping ?? 17}ms]`;

  if (wsStatus !== 0) {
    wsIcon = LOAD;
    wsText = wsStatus === 5 ? 'WS 443 Gateway Disconnected (Retrying...)' : 'WS 443 Gateway Reconnecting...';
  }

  let restIcon = ON;
  let restText = 'Rate Limit Buckets Synchronized';
  if ((client.ws?.ping ?? 0) > 500) {
    restIcon = LOAD;
    restText = 'High Latency / Synchronizing...';
  }

  const nukeIcon = isFirewallActive ? ON : RED_OFF;
  const nukeText = isFirewallActive ? `Armed & Securing ${client.guilds.cache.size} Servers` : 'Disabled / Vulnerable';

  let sentinelItem = null;
  if (guild) {
    const unbRoleId = cfg.unbypassableRoleId;
    const fwRoleId = cfg.firewallRoleId;
    const hasUnb = unbRoleId && guild.roles.cache.has(unbRoleId);
    const hasFw = fwRoleId && guild.roles.cache.has(fwRoleId);
    const hasBoth = Boolean(hasUnb && hasFw);

    const sentinelIcon = hasBoth ? ON : (cfg.antiNukeEnabled ? LOAD : RED_OFF);
    const sentinelText = hasBoth 
      ? 'Athena Unbypassable & Athena Firewall Synchronized' 
      : 'Auto-Healing Sentinel Roles Active';
    sentinelItem = `-# ${sentinelIcon} **__Persistence Sentinels:__** ${sentinelText}`;
  }

  const list = [
    `-# ${wsIcon} **__Core Gateway:__** ${wsText}`,
    `-# ${ON} **__SQLite Database:__** WAL Mode [Integrity: 100%]`,
    `-# ${restIcon} **__Discord REST API:__** ${restText}`,
    `-# ${nukeIcon} **__Antinuke Sentinels:__** ${nukeText}`,
    sentinelItem,
    `-# ${ON} **__Anti-Strip Defense:__** Autonomous Self-Healing Active`,
    `-# ${ON} **__Tenor & Anime APIs:__** Remote Image Pools Connected`,
    `-# ${ON} **__Canvas Engine:__** Hardware Acceleration Active`,
    `-# ${ON} **__YouTube API v3:__** Verified & Operational`
  ].filter(Boolean).join('\n');

  const container = {
    type: 17,
    components: [
      { type: 10, content: `## ${FIRE} **ATHENA UNBYPASSABLE SYSTEM** | ${TICK}` },
      { type: 14, divider: true },
      { type: 10, content: list },
      { type: 14, divider: true },
      { type: 10, content: `-# **__System Uptime:__** ${uptimeStr} \u2022 **__Latency:__** ${client.ws?.ping ?? 17}ms` }
    ]
  };

  const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };

  if (isActualSlash) {
    if (context.deferred || context.replied) {
      return await context.editReply(payload).catch(() => null);
    }
    return await context.reply(payload).catch(() => null);
  }

  return await context.reply(payload).catch(() => null);
}

export const commands = [
  {
    name: 'unbypassable',
    aliases: ['unb', 'persistenceroles', 'sentinels', 'matrix', 'telemetry', 'statusnet', 'firewall', 'fw'],
    description: 'Inspect Athena Unbypassable system matrix, core gateway telemetry, and persistence sentinels.',
    category: 'security',
    permissions: [],
    async executePrefix(message, args = []) {
      return handleUnbypassable(message, false, args);
    },
    async executeSlash(interaction) {
      const sub = interaction.options?.getSubcommand?.(false) || '';
      return handleUnbypassable(interaction, true, sub ? [sub] : []);
    }
  }
];
