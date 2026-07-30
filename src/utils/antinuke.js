import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { logToSecurityChannel, isBotOwnerSync } from './helpers.js';
import { executeQuarantine } from '../commands/security.js';

// ==========================================
// ZERO-LATENCY RESTORATION CACHE
// ==========================================
export const deletedCache = new Map();
export const restoredCategories = new Map();
export const queuedRestorations = new Set(); // Prevent duplicate queueing

export function cacheDeletedItem(id, item) {
  deletedCache.set(id, item);
  setTimeout(() => deletedCache.delete(id), 60000); // 60s ttl
}

function mapRestoredCategory(oldId, newId) {
  restoredCategories.set(oldId, newId);
  setTimeout(() => restoredCategories.delete(oldId), 300000); // 5m ttl
}

// ==========================================
// SMART RESTORATION QUEUE
// ==========================================
const restorationQueue = [];
let isRestoring = false;

async function processRestorationQueue() {
  if (isRestoring || restorationQueue.length === 0) return;
  isRestoring = true;

  while (restorationQueue.length > 0) {
    // Sort dynamically inside the loop so new categories get prioritized
    restorationQueue.sort((a, b) => {
      if (a.isCategory && !b.isCategory) return -1;
      if (!a.isCategory && b.isCategory) return 1;
      return 0;
    });

    const task = restorationQueue.shift();
    try {
      await task.execute();
    } catch (e) {
      console.error('[AntiNuke] Task failed:', e);
    }
    await new Promise(r => setTimeout(r, 800)); // Prevent Discord rate limits
  }

  isRestoring = false;
}

// ==========================================
// RATE TRACKER — In-memory action counter
// Tracks: guildId:userId:eventType -> [timestamps]
// Prevents punishing legitimate admins doing bulk ops
// ==========================================
const actionTracker = new Map();
const TRACKER_WINDOW_MS = 10_000; // 10-second window

function trackAction(guildId, userId, eventType) {
  const key = `${guildId}:${userId}:${eventType}`;
  const now = Date.now();
  const times = (actionTracker.get(key) || []).filter(t => now - t < TRACKER_WINDOW_MS);
  times.push(now);
  actionTracker.set(key, times);
  return times.length; // return count in window
}

function clearTracker(guildId, userId) {
  for (const key of actionTracker.keys()) {
    if (key.startsWith(`${guildId}:${userId}:`)) actionTracker.delete(key);
  }
}

// Clean up old tracker entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of actionTracker.entries()) {
    const fresh = times.filter(t => now - t < TRACKER_WINDOW_MS);
    if (fresh.length === 0) actionTracker.delete(key);
    else actionTracker.set(key, fresh);
  }
}, 60_000);

// ==========================================
// DANGEROUS PERMISSIONS — any of these triggers protection
// ==========================================
const DANGEROUS_PERMS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.MentionEveryone,
];

function hasDangerousPerms(permissions) {
  return DANGEROUS_PERMS.some(p => permissions.has(p));
}

// ==========================================
// CORE PUNISHMENT ENGINE
// ==========================================
const activePunishments = new Set(); // Prevent concurrent bans of the same user

async function punish(guild, executor, eventType, config, forceQuarantine = false) {
  const punishment = forceQuarantine ? 'quarantine' : (config.antiNukePunishment || 'ban');
  const reason = `[ATHENA ANTI-NUKE] Unauthorized action: ${eventType}`;
  let result = 'None applied';

  if (activePunishments.has(executor.id)) return result;

  const executorMember = await guild.members.fetch(executor.id).catch(() => null);
  if (!executorMember) return result;

  // Lock the user to prevent duplicate API calls
  activePunishments.add(executor.id);
  setTimeout(() => activePunishments.delete(executor.id), 10_000);

  try {
    if (punishment === 'ban') {
      // Fire ban API instantly (no await on DM) to minimize latency
      const banPromise = executorMember.ban({ reason });
      executorMember.send({ embeds: [embed.danger(' Banned — Athena Prime Protection',
        `You have been permanently banned from **${guild.name}** for triggering Anti-Nuke protection.\n\n**Violation:** ${eventType}`
      )] }).catch(() => null);
      await banPromise;
      result = ' Permanently Banned';
    } else if (punishment === 'kick') {
      const kickPromise = executorMember.kick(reason);
      executorMember.send({ embeds: [embed.danger(' Kicked — Athena Prime Protection',
        `You have been kicked from **${guild.name}** for triggering Anti-Nuke protection.\n\n**Violation:** ${eventType}`
      )] }).catch(() => null);
      await kickPromise;
      result = ' Kicked';
    } else {
      const qRes = await executeQuarantine(guild, executorMember, guild.members.me, reason);
      result = qRes.success ? ' Quarantined (all roles stripped)' : ' Quarantine failed';
      
      if (forceQuarantine && config.antiNukePunishment === 'ban') {
        await executorMember.ban({ reason }).catch(() => null);
        result += ' +  Banned';
      }
    }
    // Clear their action tracker after punishment
    clearTracker(guild.id, executor.id);
  } catch (err) {
    console.error('[AntiNuke] Punishment failed:', err.message);
    result = ` Hierarchy blocked (${err.message})`;
  }

  return result;
}

// ==========================================
// CORE LOG + DM ENGINE
// ==========================================
const dmThrottle = new Set();

async function notifyAndLog(guild, executor, eventType, punishResult, rollbackResult) {
  const logEmbed = embed.log(
    ' Anti-Nuke Firewall Triggered',
    `A dangerous server mutation was detected, blocked, and rolled back.`,
    [
      { name: ' Violator',   value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
      { name: ' Action',     value: `\`${eventType}\``,                     inline: true },
      { name: ' Punishment', value: `**${punishResult}**`,                  inline: true },
      { name: ' Rollback',   value: rollbackResult }
    ],
    'raid'
  );
  await logToSecurityChannel(guild, logEmbed);

  // DM server owner (debounced to prevent spam during mass restores)
  try {
    if (!dmThrottle.has(guild.ownerId)) {
      dmThrottle.add(guild.ownerId);
      setTimeout(() => dmThrottle.delete(guild.ownerId), 10_000); // 10s cooldown
      
      const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
      if (owner) {
        await owner.send({ embeds: [embed.danger(
          ' CRITICAL: Anti-Nuke Triggered',
          `A dangerous action was detected and contained on **${guild.name}**.`,
          [
            { name: ' Violator',    value: `**${executor.tag}** (\`${executor.id}\`)` },
            { name: ' Violation',   value: `\`${eventType}\`` },
            { name: ' Punishment',  value: `**${punishResult}**` },
            { name: ' Rollback',    value: rollbackResult + ' (Check security logs for more)' }
          ]
        )] }).catch(() => null);
      }
    }
  } catch { /* ignore */ }
}

// ==========================================
// IS AUTHORIZED — Single source of truth
// ==========================================
function isAuthorized(guild, executor, eventType = 'antinuke') {
  if (executor.id === guild.members.me?.id) return true;    // bot itself
  if (isBotOwnerSync(executor.id)) return true;             // bot owner
  if (executor.id === guild.ownerId) return true;           // server owner
  
  if (eventType === 'antibot') return false; // ONLY Server/Bot Owner can add bots.
  
  // If the executor is a bot and is in the botWhitelist, grant full Anti-Nuke immunity
  if (executor.bot) {
    const botWhitelist = db.getBotWhitelist ? db.getBotWhitelist(guild.id) : [];
    if (botWhitelist.includes(executor.id)) return true;
    
    const member = guild.members.cache.get(executor.id);
    if (member && botWhitelist.some(id => member.roles.cache.has(id))) return true;
  }
  
  if (db.isExtraOwner(guild.id, executor.id)) return true;  // extra owner
  if (db.isWhitelisted(guild, executor.id, eventType)) return true; // granular whitelist
  return false;
}

// ==========================================
// ZERO-LATENCY ANTINUKE HANDLER
// ==========================================
export async function handleAuditLogEntry(guild, entry) {
  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;

  const { executor, target, action, executorId, targetId, createdAt } = entry;
  if (!executor || !executorId) return;
  if (executorId === guild.members.me?.id) return;
  if (Date.now() - createdAt.getTime() > 20_000) return; // Ignore old
  if (isAuthorized(guild, executor)) return;

  let eventType = null;
  let forceBan = false;

  switch (action) {
    case AuditLogEvent.ChannelDelete: eventType = 'Channel Deletion'; forceBan = true; break;
    case AuditLogEvent.ChannelCreate: eventType = 'Channel Creation'; forceBan = true; break;
    case AuditLogEvent.RoleDelete: eventType = 'Role Deletion'; forceBan = true; break;
    case AuditLogEvent.RoleCreate: eventType = 'Role Creation'; forceBan = true; break;
    case AuditLogEvent.EmojiDelete: eventType = 'Emoji Deletion'; forceBan = true; break;
    case AuditLogEvent.EmojiCreate: eventType = 'Emoji Creation'; forceBan = true; break;
    case AuditLogEvent.WebhookDelete: eventType = 'Webhook Deletion'; forceBan = true; break;
    case AuditLogEvent.WebhookCreate: eventType = 'Webhook Creation'; forceBan = true; break;
    default: return; // Only handling structural nukes here
  }

  // Punish INSTANTLY (skip tracker for strict events)
  const originalPunishConfig = config.antiNukePunishment;
  if (forceBan) config.antiNukePunishment = 'ban';
  
  const punishResult = await punish(guild, executor, eventType, config);
  
  if (forceBan) config.antiNukePunishment = originalPunishConfig;

  let rollbackResult = 'Pending...';

  if (action === AuditLogEvent.ChannelDelete) {
    const cachedChannel = deletedCache.get(targetId);
    if (cachedChannel) {
      const isCategory = cachedChannel.type === 4; // GuildCategory

      const queueChannelRestoration = (ch, categoryFlag) => {
        if (queuedRestorations.has(ch.id)) return;
        queuedRestorations.add(ch.id);

        restorationQueue.push({
          isCategory: categoryFlag,
          execute: async () => {
            try {
              // Clever restoration: map to newly restored category if applicable
              const parentId = restoredCategories.get(ch.parentId) || ch.parentId;
              const overwrites = ch.permissionOverwrites.cache.map(o => ({
                id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield
              }));
              const newCh = await guild.channels.create({
                name: ch.name,
                type: ch.type,
                topic: ch.topic || null,
                parent: parentId || null,
                position: ch.position || 0,
                permissionOverwrites: overwrites,
                reason: 'Athena Anti-Nuke: Restored deleted channel'
              });
              if (categoryFlag) mapRestoredCategory(ch.id, newCh.id);
              await notifyAndLog(guild, executor, eventType, punishResult, ` **#${ch.name}** restored (<#${newCh.id}>)`);
            } catch (e) {
              // Fallback for parent invalid
              if (e.message.includes('CHANNEL_PARENT_INVALID') || e.message.includes('parent_id')) {
                try {
                  const newCh = await guild.channels.create({
                    name: ch.name, type: ch.type,
                    reason: 'Athena Anti-Nuke: Restored without parent (Parent Invalid)'
                  });
                  if (categoryFlag) mapRestoredCategory(ch.id, newCh.id);
                  await notifyAndLog(guild, executor, eventType, punishResult, ` **#${ch.name}** restored (outside category)`);
                } catch(e2) {
                  await notifyAndLog(guild, executor, eventType, punishResult, ` Channel restore failed: ${e2.message}`);
                }
              } else {
                await notifyAndLog(guild, executor, eventType, punishResult, ` Channel restore failed: ${e.message}`);
              }
            }
          }
        });
      };

      // Queue the targeted channel
      queueChannelRestoration(cachedChannel, isCategory);

      // IMPLICIT RESTORATION: 
      // If a category was deleted, Discord automatically deletes its children.
      // We must scan the cache and queue its children since they don't get separate audit log events!
      if (isCategory) {
        for (const [id, ch] of deletedCache.entries()) {
          if (ch.parentId === cachedChannel.id) {
            queueChannelRestoration(ch, false);
          }
        }
      }

      processRestorationQueue();
      return;
    } else {
      rollbackResult = ` Channel cannot be auto-restored (not in cache)`;
    }
  }
  else if (action === AuditLogEvent.RoleDelete) {
    const r = deletedCache.get(targetId);
    if (r) {
      restorationQueue.push({
        isCategory: false,
        execute: async () => {
          try {
            await guild.roles.create({ name: r.name, colors: { primaryColor: r.color }, hoist: r.hoist,
              permissions: r.permissions.bitfield, mentionable: r.mentionable,
              reason: 'Athena Anti-Nuke: Restored deleted role' });
            rollbackResult = ` Role **${r.name}** restored`;
          } catch (e) { rollbackResult = ` Role restore failed: ${e.message}`; }
          await notifyAndLog(guild, executor, eventType, punishResult, rollbackResult);
        }
      });
      processRestorationQueue();
      return;
    } else {
      rollbackResult = ` Role cannot be auto-restored (not in cache)`;
    }
  }
  else if (action === AuditLogEvent.EmojiDelete) {
    const eData = deletedCache.get(targetId);
    if (eData) {
      restorationQueue.push({
        isCategory: false,
        execute: async () => {
          try {
            if (eData.url) {
              await guild.emojis.create({ attachment: eData.url, name: eData.name, reason: 'Athena Anti-Nuke: Restored' });
              rollbackResult = ` Emoji **${eData.name}** restored`;
            } else {
              rollbackResult = ` Emoji **${eData.name}** cannot be auto-restored`;
            }
          } catch (e) { rollbackResult = ` Emoji restore failed: ${e.message}`; }
          await notifyAndLog(guild, executor, eventType, punishResult, rollbackResult);
        }
      });
      processRestorationQueue();
      return;
    } else {
      rollbackResult = ` Emoji cannot be auto-restored (not in cache)`;
    }
  }
  else if (action === AuditLogEvent.ChannelCreate) {
    restorationQueue.push({
      isCategory: false,
      execute: async () => {
        try {
          const ch = await guild.channels.fetch(targetId).catch(() => null);
          if (ch) await ch.delete('Athena Anti-Nuke: Removed unauthorized channel');
          rollbackResult = ` Unauthorized channel deleted`;
        } catch (e) { rollbackResult = ` Delete failed: ${e.message}`; }
        await notifyAndLog(guild, executor, eventType, punishResult, rollbackResult);
      }
    });
    processRestorationQueue();
    return;
  }
  else if (action === AuditLogEvent.RoleCreate) {
    restorationQueue.push({
      isCategory: false,
      execute: async () => {
        try {
          const r = await guild.roles.fetch(targetId).catch(() => null);
          if (r) await r.delete('Athena Anti-Nuke: Removed unauthorized role');
          rollbackResult = ` Unauthorized role deleted`;
        } catch (e) { rollbackResult = ` Delete failed: ${e.message}`; }
        await notifyAndLog(guild, executor, eventType, punishResult, rollbackResult);
      }
    });
    processRestorationQueue();
    return;
  }
  else if (action === AuditLogEvent.EmojiCreate) {
    restorationQueue.push({
      isCategory: false,
      execute: async () => {
        try {
          const eObj = await guild.emojis.fetch(targetId).catch(() => null);
          if (eObj) await eObj.delete('Athena Anti-Nuke: Removed unauthorized emoji');
          rollbackResult = ` Unauthorized emoji deleted`;
        } catch (e) { rollbackResult = ` Delete failed: ${e.message}`; }
        await notifyAndLog(guild, executor, eventType, punishResult, rollbackResult);
      }
    });
    processRestorationQueue();
    return;
  }

  // Fallback log
  await notifyAndLog(guild, executor, eventType, punishResult, rollbackResult);
}

// ==========================================
// MAIN ANTINUKE CHECK
// ==========================================
export async function checkAntiNuke(guild, eventType, auditLogEvent, targetId = null, extraData = null) {
  if (!guild) return;
  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;

  try {
    await new Promise(r => setTimeout(r, 300)); // brief wait for audit log propagation
    const auditLogs = await guild.fetchAuditLogs({ limit: 3, type: auditLogEvent }).catch(() => null);
    if (!auditLogs) return;

    const entry = auditLogs.entries.first();
    if (!entry) return;

    const { executor, target, createdAt } = entry;

    // Only skip Athena Prime itself — NOT all bots
    if (executor.id === guild.members.me?.id) return;

    // Freshness check: event must be within 10 seconds
    if (Date.now() - createdAt.getTime() > 10_000) return;

    // Target validation
    if (targetId && target?.id && target.id !== targetId) return;

    // Authorization check
    if (isAuthorized(guild, executor)) return;

    // Rate-based threshold check (Zero Tolerance for Channels/Roles/Emojis/Webhooks)
    const strictEvents = [
      'Channel Creation', 'Channel Deletion', 
      'Role Creation', 'Role Deletion',
      'Emoji Creation', 'Emoji Deletion', 
      'Webhook Creation', 'Webhook Deletion'
    ];
    let forceBan = false;
    
    if (strictEvents.includes(eventType)) {
      forceBan = true; // Always trigger instantly for these
    } else {
      const threshold = config.antiNukeThreshold || 1;
      const count = trackAction(guild.id, executor.id, eventType);
      if (count < threshold) return; // not yet at threshold
    }

    // === PUNISH ===
    // If it's a strict event, we force the punishment to be a BAN
    const originalPunishConfig = config.antiNukePunishment;
    if (forceBan) config.antiNukePunishment = 'ban';
    
    const punishResult = await punish(guild, executor, eventType, config);
    
    if (forceBan) config.antiNukePunishment = originalPunishConfig; // Restore config

    // === ROLLBACK ===
    let rollbackResult = 'No rollback needed';

    if (eventType === 'Channel Deletion' && extraData) {
      try {
        const ch = extraData;
        const overwrites = ch.permissionOverwrites.cache.map(o => ({
          id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield
        }));
        const newCh = await guild.channels.create({
          name: ch.name, type: ch.type,
          topic: ch.topic || null,
          parent: ch.parentId || null,
          position: ch.position || 0,
          permissionOverwrites: overwrites,
          reason: 'Athena Anti-Nuke: Restored deleted channel'
        });
        rollbackResult = ` **#${ch.name}** restored (<#${newCh.id}>)`;
      } catch (e) { rollbackResult = ` Channel restore failed: ${e.message}`; }
    }

    else if (eventType === 'Role Deletion' && extraData) {
      try {
        const r = extraData;
        await guild.roles.create({ name: r.name, colors: { primaryColor: r.color }, hoist: r.hoist,
          permissions: r.permissions.bitfield,
          mentionable: r.mentionable,
          reason: 'Athena Anti-Nuke: Restored deleted role' });
        rollbackResult = ` Role **${r.name}** restored`;
      } catch (e) { rollbackResult = ` Role restore failed: ${e.message}`; }
    }

    else if (eventType === 'Channel Creation' && targetId) {
      try {
        const ch = await guild.channels.fetch(targetId).catch(() => null);
        if (ch) { await ch.delete('Athena Anti-Nuke: Removed unauthorized channel'); }
        rollbackResult = ` Unauthorized channel deleted`;
      } catch (e) { rollbackResult = ` Delete failed: ${e.message}`; }
    }

    else if (eventType === 'Role Creation' && targetId) {
      try {
        const r = await guild.roles.fetch(targetId).catch(() => null);
        if (r) { await r.delete('Athena Anti-Nuke: Removed unauthorized role'); }
        rollbackResult = ` Unauthorized role deleted`;
      } catch (e) { rollbackResult = ` Delete failed: ${e.message}`; }
    }

    else if (eventType === 'Emoji Creation' && targetId) {
      try {
        const e = await guild.emojis.fetch(targetId).catch(() => null);
        if (e) { await e.delete('Athena Anti-Nuke: Removed unauthorized emoji'); }
        rollbackResult = ` Unauthorized emoji deleted`;
      } catch (e) { rollbackResult = ` Delete failed: ${e.message}`; }
    }

    else if (eventType === 'Emoji Deletion' && extraData) {
      try {
        if (extraData.url) {
          await guild.emojis.create({ attachment: extraData.url, name: extraData.name, reason: 'Athena Anti-Nuke: Restored deleted emoji' });
          rollbackResult = ` Emoji **${extraData.name}** restored`;
        } else {
          rollbackResult = ` Emoji **${extraData.name}** cannot be auto-restored (missing URL cache)`;
        }
      } catch (e) { rollbackResult = ` Emoji restore failed: ${e.message}`; }
    }

    else if (eventType === 'Vanity URL Change' && extraData) {
      try {
        await guild.setVanityCode(extraData, 'Athena Anti-Nuke: Vanity restored');
        rollbackResult = ` Vanity restored to **discord.gg/${extraData}**`;
      } catch (e) { rollbackResult = ` Vanity restore failed: ${e.message}`; }
    }

    else if (eventType === 'Webhook Creation' && extraData) {
      try {
        await extraData.delete('Athena Anti-Nuke: Unauthorized webhook removed');
        rollbackResult = ` Webhook **${extraData.name}** deleted`;
      } catch (e) { rollbackResult = ` Webhook delete failed: ${e.message}`; }
    }

    else if (eventType === 'Webhook Deletion' && extraData) {
      try {
        const chId = extraData.channelId;
        const ch = chId ? await guild.channels.fetch(chId).catch(() => null) : null;
        if (ch) {
          await ch.createWebhook({ name: extraData.name, avatar: extraData.avatarURL() || null, reason: 'Athena Anti-Nuke: Restored deleted webhook' });
          rollbackResult = ` Webhook **${extraData.name}** restored`;
        } else {
          rollbackResult = ` Webhook restore failed: Channel not found`;
        }
      } catch (e) { rollbackResult = ` Webhook restore failed: ${e.message}`; }
    }

    else if (eventType === 'Member Ban' && extraData) {
      // extraData = { userId, username }
      rollbackResult = ` Banned member: **${extraData.username}** — unban manually if needed`;
    }

    await notifyAndLog(guild, executor, eventType, punishResult, rollbackResult);

  } catch (err) {
    console.error('[AntiNuke] checkAntiNuke error:', err);
  }
}

// ==========================================
// ROLE UPDATE GUARD
// Detects when a role's permissions are escalated to include dangerous perms
// ==========================================
export async function checkRoleUpdate(oldRole, newRole) {
  const guild = newRole.guild;
  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;

  try {
    // Check if new permissions gained any dangerous perm that wasn't there before
    const gainedDangerous = DANGEROUS_PERMS.some(p =>
      !oldRole.permissions.has(p) && newRole.permissions.has(p)
    );
    if (!gainedDangerous) return;

    await new Promise(r => setTimeout(r, 300));
    const auditLogs = await guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.RoleUpdate }).catch(() => null);
    const entry = auditLogs?.entries?.find(e => e.target?.id === newRole.id);
    if (!entry) return;

    const { executor, createdAt } = entry;
    if (Date.now() - createdAt.getTime() > 10_000) return;
    if (executor.id === guild.members.me?.id) return;
    if (isAuthorized(guild, executor)) return;

    // Rollback: revert the role's permissions
    let rollbackResult = 'No rollback';
    try {
      await newRole.setPermissions(oldRole.permissions, 'Athena Anti-Nuke: Reverted dangerous permission escalation');
      rollbackResult = ` Role **${newRole.name}** permissions reverted`;
    } catch (e) { rollbackResult = ` Revert failed: ${e.message}`; }

    const punishResult = await punish(guild, executor, 'Role Permission Escalation', config);
    await notifyAndLog(guild, executor, 'Role Permission Escalation', punishResult, rollbackResult);

  } catch (err) {
    console.error('[AntiNuke] checkRoleUpdate error:', err);
  }
}

// ==========================================
// MEMBER UPDATE GUARD
// Detects unauthorized dangerous role grants
// ==========================================
export async function checkAntiNukeMemberUpdate(oldMember, newMember) {
  const guild = newMember.guild;
  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;

  try {
    const rolesAdded = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    if (rolesAdded.size === 0) return;

    // Check if any of the new roles have dangerous permissions
    const dangerousRolesAdded = rolesAdded.filter(r => hasDangerousPerms(r.permissions));
    if (dangerousRolesAdded.size === 0) return;

    // Only trigger if target gained dangerous perms they didn't have before
    const hadDangerous = hasDangerousPerms(oldMember.permissions);
    const hasDangerousNow = hasDangerousPerms(newMember.permissions);
    if (hadDangerous && hasDangerousNow) return; // already had it — not escalation

    await new Promise(r => setTimeout(r, 300));
    const auditLogs = await guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.MemberRoleUpdate }).catch(() => null);
    const entry = auditLogs?.entries?.find(e => e.target?.id === newMember.id);
    if (!entry) return;

    const { executor, createdAt } = entry;
    if (executor.id === guild.members.me?.id) return;
    if (Date.now() - createdAt.getTime() > 10_000) return;
    if (isAuthorized(guild, executor)) return;

    // Rollback: remove the dangerous roles granted
    let rollbackResult = 'No rollback';
    try {
      await newMember.roles.remove(dangerousRolesAdded, 'Athena Anti-Nuke: Unauthorized dangerous role grant reversed');
      rollbackResult = ` Removed roles: **${dangerousRolesAdded.map(r => r.name).join(', ')}** from ${newMember.user.tag}`;
    } catch (e) { rollbackResult = ` Role removal failed: ${e.message}`; }

    // Strip executor's roles too
    const executorMember = await guild.members.fetch(executor.id).catch(() => null);
    let punishResult = 'None';
    if (executorMember) {
      try {
        const managed = executorMember.roles.cache.filter(r => r.managed).map(r => r.id);
        await executorMember.roles.set(managed, 'Athena Anti-Nuke: Stripped unauthorized role grantor');
        punishResult = '� All roles stripped from executor';
      } catch {}
      punishResult = await punish(guild, executor, 'Unauthorized Dangerous Role Grant', config);
    }

    await notifyAndLog(guild, executor, 'Unauthorized Dangerous Role Grant', punishResult, rollbackResult);

  } catch (err) {
    console.error('[AntiNuke] checkAntiNukeMemberUpdate error:', err);
  }
}

// ==========================================
// BOT ADD GUARD
// Detects unauthorized bot additions via OAuth
// ==========================================
export async function checkBotAdd(member) {
  const guild = member.guild;
  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;
  if (!member.user.bot) return;

  // Skip Athena Prime itself
  if (member.id === guild.members.me?.id) return;

  // Check bot whitelist in DB
  const botWhitelist = db.getBotWhitelist ? db.getBotWhitelist(guild.id) : [];
  if (botWhitelist.includes(member.id)) return;
  if (botWhitelist.some(id => member.roles.cache.has(id))) return;

    try {
    await new Promise(r => setTimeout(r, 500));
    const auditLogs = await guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.BotAdd }).catch(() => null);
    const entry = auditLogs?.entries?.find(e => e.target?.id === member.id);
    if (!entry) {
      // Still ban the unknown bot
      await member.ban({ reason: 'Athena Anti-Nuke: Unauthorized bot addition (no audit log entry)' }).catch(() => null);
      await logToSecurityChannel(guild, embed.danger('Unauthorized Bot Banned',
        `Bot **${member.user.tag}** was banned (not in whitelist, no audit log found).`, [], guild.id
      ));
      return;
    }

    const { executor, createdAt } = entry;
    if (Date.now() - createdAt.getTime() > 15_000) return;
    if (isAuthorized(guild, executor, 'antibot')) {
      // Server Owner or Global Bot Owner added a bot — just log it
      await logToSecurityChannel(guild, embed.info('Bot Added (Authorized)',
        `Bot **${member.user.tag}** was added by **${executor.tag}** (authorized).\nAdd it to the bot whitelist with \`!botwhitelist add ${member.id}\` if it should stay.`, [], guild.id
      ));
      return;
    }

    // Ban the unauthorized bot first
    await member.ban({ reason: 'Athena Anti-Nuke: Unauthorized bot addition' }).catch(() => null);

    // Strip roles by enforcing quarantine regardless of configured punishment, 
    // or rely on standard punish (which already strips roles if quarantine is used).
    // Let's enforce quarantine/role stripping for this specific severe violation.
    const punishResult = await punish(guild, executor, 'Unauthorized Bot Addition', config, true);
    await notifyAndLog(guild, executor, `Unauthorized Bot Addition (${member.user.tag})`, punishResult,
      ` Bot **${member.user.tag}** has been banned from the server`);

  } catch (err) {
    console.error('[AntiNuke] checkBotAdd error:', err);
  }
}

// ==========================================
// BAN REMOVE GUARD
// Detects unauthorized unbans
// ==========================================
export async function checkBanRemove(guild, user) {
  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;

  try {
    await new Promise(r => setTimeout(r, 300));
    const auditLogs = await guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.MemberUnban }).catch(() => null);
    const entry = auditLogs?.entries?.find(e => e.target?.id === user.id);
    if (!entry) return;

    const { executor, createdAt } = entry;
    if (executor.id === guild.members.me?.id) return;
    if (Date.now() - createdAt.getTime() > 10_000) return;
    if (isAuthorized(guild, executor)) return;

    // Re-ban the user
    let rollbackResult = 'No rollback';
    try {
      await guild.bans.create(user.id, { reason: 'Athena Anti-Nuke: Re-applied ban reversed by unauthorized user' });
      rollbackResult = ` **${user.tag}** re-banned`;
    } catch (e) { rollbackResult = ` Re-ban failed: ${e.message}`; }

    const punishResult = await punish(guild, executor, 'Unauthorized Ban Removal', config);
    await notifyAndLog(guild, executor, `Unauthorized Ban Removal (${user.tag})`, punishResult, rollbackResult);

  } catch (err) {
    console.error('[AntiNuke] checkBanRemove error:', err);
  }
}

// ==========================================
// GUILD SETTINGS GUARD
// Detects all unauthorized guild setting changes
// ==========================================
export async function checkGuildUpdate(oldGuild, newGuild) {
  const config = db.getGuildConfig(newGuild.id);
  if (!config.antiNukeEnabled) return;

  const changes = [];

  if (oldGuild.name !== newGuild.name) changes.push(`Name: **${oldGuild.name}** → **${newGuild.name}**`);
  if (oldGuild.verificationLevel !== newGuild.verificationLevel) changes.push(`Verification Level: **${oldGuild.verificationLevel}** → **${newGuild.verificationLevel}**`);
  if (oldGuild.mfaLevel !== newGuild.mfaLevel) changes.push(`2FA Requirement: **${oldGuild.mfaLevel}** → **${newGuild.mfaLevel}**`);
  if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) changes.push(`Explicit Filter: changed`);
  if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) changes.push(`Vanity URL: **${oldGuild.vanityURLCode}** → **${newGuild.vanityURLCode}**`);
  if (oldGuild.afkChannelId !== newGuild.afkChannelId) changes.push(`AFK Channel: changed`);
  if (oldGuild.systemChannelId !== newGuild.systemChannelId) changes.push(`System Channel: changed`);

  if (changes.length === 0) return;

  try {
    await new Promise(r => setTimeout(r, 300));
    const auditLogs = await newGuild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.GuildUpdate }).catch(() => null);
    const entry = auditLogs?.entries?.first();
    if (!entry) return;

    const { executor, createdAt } = entry;
    if (executor.id === newGuild.members.me?.id) return;
    if (Date.now() - createdAt.getTime() > 10_000) return;
    if (isAuthorized(newGuild, executor)) return;

    // Attempt rollbacks
    const rollbacks = [];

    if (oldGuild.name !== newGuild.name) {
      try {
        await newGuild.setName(oldGuild.name, 'Athena Anti-Nuke: Reverted server name');
        rollbacks.push(` Name restored to **${oldGuild.name}**`);
      } catch { rollbacks.push(` Name restore failed`); }
    }

    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      try {
        await newGuild.setVerificationLevel(oldGuild.verificationLevel, 'Athena Anti-Nuke: Reverted verification level');
        rollbacks.push(` Verification level restored`);
      } catch { rollbacks.push(` Verification level restore failed`); }
    }

    if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter) {
      try {
        await newGuild.setExplicitContentFilter(oldGuild.explicitContentFilter, 'Athena Anti-Nuke: Reverted explicit content filter');
        rollbacks.push(` Explicit content filter restored`);
      } catch { rollbacks.push(` Explicit filter restore failed`); }
    }

    if (oldGuild.vanityURLCode !== newGuild.vanityURLCode && oldGuild.vanityURLCode) {
      try {
        await newGuild.setVanityCode(oldGuild.vanityURLCode, 'Athena Anti-Nuke: Reverted vanity URL');
        rollbacks.push(` Vanity URL restored to **discord.gg/${oldGuild.vanityURLCode}**`);
      } catch { rollbacks.push(` Vanity restore failed`); }
    }

    const rollbackResult = rollbacks.join('\n') || 'No rollback performed';
    const punishResult = await punish(newGuild, executor, 'Unauthorized Server Settings Change', config);
    await notifyAndLog(newGuild, executor,
      `Server Settings Changed:\n${changes.join('\n')}`,
      punishResult, rollbackResult
    );

  } catch (err) {
    console.error('[AntiNuke] checkGuildUpdate error:', err);
  }
}

// ==========================================
// WEBHOOK GUARD
// Detects unauthorized webhook creation
// ==========================================
export async function checkWebhook(guild) {
  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;

  try {
    await new Promise(r => setTimeout(r, 300));
    const auditLogs = await guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.WebhookCreate }).catch(() => null);
    const entry = auditLogs?.entries?.first();
    if (!entry) return;

    const { executor, target, createdAt } = entry;
    if (executor.id === guild.members.me?.id) return;
    if (Date.now() - createdAt.getTime() > 10_000) return;
    if (isAuthorized(guild, executor)) return;

    // Delete the webhook
    let rollbackResult = 'Could not locate webhook to delete';
    try {
      const webhooks = await guild.fetchWebhooks().catch(() => null);
      const wh = webhooks?.find(w => w.id === target?.id);
      if (wh) {
        await wh.delete('Athena Anti-Nuke: Removed unauthorized webhook');
        rollbackResult = ` Webhook **${wh.name}** deleted`;
      }
    } catch (e) { rollbackResult = ` Webhook delete failed: ${e.message}`; }

    const punishResult = await punish(guild, executor, 'Unauthorized Webhook Creation', config);
    await notifyAndLog(guild, executor, 'Unauthorized Webhook Creation', punishResult, rollbackResult);

  } catch (err) {
    console.error('[AntiNuke] checkWebhook error:', err);
  }
}

// ==========================================
// MASS BAN GUARD (for guildMemberBanAdd)
// ==========================================
export async function checkMassBan(guild, user) {
  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;

  try {
    await new Promise(r => setTimeout(r, 300));
    const auditLogs = await guild.fetchAuditLogs({ limit: 3, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
    const entry = auditLogs?.entries?.find(e => e.target?.id === user.id);
    if (!entry) return;

    const { executor, createdAt } = entry;
    if (executor.id === guild.members.me?.id) return;
    if (Date.now() - createdAt.getTime() > 10_000) return;
    if (isAuthorized(guild, executor)) return;

    const threshold = config.antiNukeThreshold || 1;
    const count = trackAction(guild.id, executor.id, 'Member Ban');
    if (count < threshold) return;

    const punishResult = await punish(guild, executor, 'Mass/Unauthorized Ban', config);
    await notifyAndLog(guild, executor, `Mass/Unauthorized Ban (${user.tag})`, punishResult,
      ` **${user.tag}** was banned — unban manually if needed`);

  } catch (err) {
    console.error('[AntiNuke] checkMassBan error:', err);
  }
}
