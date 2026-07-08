import { EmbedBuilder, AttachmentBuilder, AuditLogEvent, PermissionFlagsBits, ChannelType } from 'discord.js';
import db from '../database.js';
import { generateDashboard, generateTimeoutCard, generateAutomodCard } from './dashboardCanvas.js';

function formatLogTime(date) {
  return `[${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}]`;
}

export async function fetchDashboardStats(guild) {
  // Roles
  const roles = guild.roles.cache;
  const adminRoles = roles.filter(r => r.permissions.has(PermissionFlagsBits.Administrator));
  const threatRoles = roles.filter(r => {
    return !r.permissions.has(PermissionFlagsBits.Administrator) &&
           (r.permissions.has(PermissionFlagsBits.BanMembers) ||
            r.permissions.has(PermissionFlagsBits.KickMembers) ||
            r.permissions.has(PermissionFlagsBits.ManageChannels) ||
            r.permissions.has(PermissionFlagsBits.ManageRoles));
  });

  // Users
  const members = await guild.members.fetch();
  const privileged = members.filter(m => m.permissions.has(PermissionFlagsBits.Administrator));
  const threatUsers = members.filter(m => {
    return !m.permissions.has(PermissionFlagsBits.Administrator) &&
           (m.permissions.has(PermissionFlagsBits.BanMembers) ||
            m.permissions.has(PermissionFlagsBits.KickMembers) ||
            m.permissions.has(PermissionFlagsBits.ManageChannels) ||
            m.permissions.has(PermissionFlagsBits.ManageRoles));
  });

  // Channels & Integrations
  const channels = guild.channels.cache.size;
  const integrations = (await guild.fetchIntegrations().catch(() => new Map())).size;

  // Assets (Emojis + Stickers)
  const totalAssets = guild.emojis.cache.size + guild.stickers.cache.size;
  
  // Firewall Status
  const cfg = db.getGuildConfig(guild.id);
  const firewall = cfg.antiNukeEnabled ? 'Active' : 'Offline';

  // Integrity Index Calculation (0-100%)
  // Start at 100%. Deduct for high ratios of admins to members, threat roles, offline firewall.
  let integrity = 100;
  if (!cfg.antiNukeEnabled) integrity -= 30;
  if (adminRoles.size > 10) integrity -= 10;
  if (threatRoles.size > 5) integrity -= Math.min(20, threatRoles.size * 2);
  if (threatUsers.size > 10) integrity -= Math.min(20, threatUsers.size * 2);
  if (integrity < 10) integrity = 10;

  // Recent Activity (Audit Logs)
  const logs = [];
  const timeoutLogs = [];
  try {
    const auditLogs = await guild.fetchAuditLogs({ limit: 20 });
    
    for (const entry of auditLogs.entries.values()) {
      const timeStr = formatLogTime(entry.createdAt);
      const user = entry.executor ? entry.executor.username : 'Unknown';

      // General Monitoring Core
      if ([
        AuditLogEvent.ChannelCreate, AuditLogEvent.ChannelDelete,
        AuditLogEvent.RoleCreate, AuditLogEvent.RoleDelete,
        AuditLogEvent.MemberBanAdd, AuditLogEvent.MemberKick
      ].includes(entry.action)) {
        if (logs.length < 6) {
          const actionStr = AuditLogEvent[entry.action].toUpperCase().replace(/_/g, ' ');
          const target = entry.target ? (entry.target.username || entry.target.name || 'Unknown') : 'Unknown';
          logs.push(`${timeStr} ${actionStr} > ${user} > ${target}`);
        }
      }

      // Timeout Logs
      if (entry.action === AuditLogEvent.MemberUpdate) {
        const timeoutChange = entry.changes.find(c => c.key === 'communication_disabled_until');
        if (timeoutChange) {
          if (timeoutLogs.length < 4) {
            const target = entry.target ? entry.target.username : 'Unknown';
            const actionStr = timeoutChange.new ? 'TIMEOUT ADDED' : 'TIMEOUT REMOVED';
            timeoutLogs.push(`${timeStr} ${actionStr} > ${user} > ${target}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch audit logs for dashboard:', err);
  }

  return {
    integrity,
    metrics: {
      roles: roles.size,
      adminRoles: adminRoles.size,
      threatRoles: threatRoles.size,
      permRisk: threatRoles.size + threatUsers.size,
      channels,
      privileged: privileged.size,
      threatUsers: threatUsers.size,
      integrations,
      totalAssets,
      threatAssets: 0, // Placeholder
      activity: 'Tracking', 
      firewall
    },
    logs,
    timeoutLogs,
    automodLogs: [] // Can be hooked into Automod rules if needed
  };
}

export async function updateDashboardMessage(guild, client) {
  const cfg = db.getGuildConfig(guild.id);
  if (!cfg.dashboardChannelId) return;

  const channel = guild.channels.cache.get(cfg.dashboardChannelId);
  if (!channel) return;

  try {
    const stats = await fetchDashboardStats(guild);
    const accentColor = cfg.accentColor || '#00FFFF'; // Fallback to cyan
    const accentInt = parseInt(accentColor.replace('#', ''), 16);

    const dbBuffer = await generateDashboard(stats, accentColor);
    const toBuffer = await generateTimeoutCard(stats.timeoutLogs, accentColor);
    const amBuffer = await generateAutomodCard(stats.automodLogs, accentColor);

    const fileDb = new AttachmentBuilder(dbBuffer, { name: 'dashboard.png' });
    const fileTo = new AttachmentBuilder(toBuffer, { name: 'timeout.png' });
    const fileAm = new AttachmentBuilder(amBuffer, { name: 'automod.png' });

    const embedDb = new EmbedBuilder()
      .setColor(accentInt)
      .setTitle("ATHENA'S SECURITY DASHBOARD")
      .setDescription(`**Status:** **${stats.metrics.firewall === 'Active' ? 'PROTECTED' : 'VULNERABLE'}**\n**Last Sync:** <t:${Math.floor(Date.now() / 1000)}:R>\n**Live Monitoring:** **Active**`)
      .setImage('attachment://dashboard.png');

    const embedTo = new EmbedBuilder()
      .setColor(accentInt)
      .setTitle("ADMIN INTERVENTION & TIMEOUTS")
      .setImage('attachment://timeout.png');

    const embedAm = new EmbedBuilder()
      .setColor(accentInt)
      .setTitle("AUTOMATED SECURITY EVENTS")
      .setImage('attachment://automod.png');

    let msgIds = cfg.dashboardMessageIds || [];
    
    // Check if we need to post new messages or edit existing
    if (msgIds.length === 3) {
      try {
        const m1 = await channel.messages.fetch(msgIds[0]);
        await m1.edit({ embeds: [embedDb], files: [fileDb] });

        const m2 = await channel.messages.fetch(msgIds[1]);
        await m2.edit({ embeds: [embedTo], files: [fileTo] });

        const m3 = await channel.messages.fetch(msgIds[2]);
        await m3.edit({ embeds: [embedAm], files: [fileAm] });
        
        // Cleanup duplicates if any exist
        const fetched = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (fetched) {
          const rogueMessages = fetched.filter(m => m.author.id === client.user.id && !msgIds.includes(m.id));
          for (const m of rogueMessages.values()) {
            await m.delete().catch(() => {});
          }
        }

        return; // Success
      } catch (err) {
        // Messages deleted, we'll post new ones
      }
    }

    // Post new messages if missing
    // First clear old messages in channel
    const fetched = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    if (fetched) {
      const botMessages = fetched.filter(m => m.author.id === client.user.id);
      for (const m of botMessages.values()) {
        await m.delete().catch(() => {});
      }
    }

    const m1 = await channel.send({ embeds: [embedDb], files: [fileDb] });
    const m2 = await channel.send({ embeds: [embedTo], files: [fileTo] });
    const m3 = await channel.send({ embeds: [embedAm], files: [fileAm] });

    db.setDashboardInfo(guild.id, channel.id, [m1.id, m2.id, m3.id]);

  } catch (err) {
    console.error(`Failed to update dashboard for ${guild.id}:`, err);
  }
}

export async function setupDashboardChannel(guild, client) {
  const cfg = db.getGuildConfig(guild.id);
  
  // 1. Find all dashboard channels to clean up duplicates
  const allDashChannels = guild.channels.cache.filter(c => c.name === 'athenas-dashboard');
  let targetChannel = guild.channels.cache.get(cfg.dashboardChannelId);

  if (allDashChannels.size > 1) {
    const sorted = [...allDashChannels.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    targetChannel = targetChannel || sorted[0]; // Prefer DB channel, otherwise keep oldest
    for (const c of sorted) {
      if (c.id !== targetChannel.id) {
        await c.delete().catch(() => {});
      }
    }
  } else if (allDashChannels.size === 1) {
    targetChannel = targetChannel || allDashChannels.first();
  }

  // 2. If we found a valid channel, update it and return
  if (targetChannel) {
    if (cfg.dashboardChannelId !== targetChannel.id) {
      db.setDashboardInfo(guild.id, targetChannel.id, []);
    }
    
    // Ensure existing channels have the correct permissions (visible to everyone)
    try {
      await targetChannel.permissionOverwrites.edit(guild.roles.everyone.id, {
        ViewChannel: true,
        SendMessages: false,
        AddReactions: false
      });
      await targetChannel.permissionOverwrites.edit(client.user.id, {
        ViewChannel: true,
        SendMessages: true,
        EmbedLinks: true,
        AttachFiles: true,
        ReadMessageHistory: true,
        ManageMessages: true
      });
    } catch (e) {
      console.error('Failed to update dashboard channel permissions:', e);
    }

    return updateDashboardMessage(guild, client);
  }

  // Create channel
  try {
    const channel = await guild.channels.create({
      name: "athenas-dashboard",
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
        },
        {
          id: client.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
        }
      ]
    });

    db.setDashboardInfo(guild.id, channel.id, []);
    await updateDashboardMessage(guild, client);
  } catch (err) {
    console.error('Failed to create dashboard channel:', err);
  }
}
