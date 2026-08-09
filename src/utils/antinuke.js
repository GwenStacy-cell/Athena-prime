import { AuditLogEvent, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { logToSecurityChannel, isBotOwnerSync } from './helpers.js';
import { executeQuarantine } from '../commands/security.js';

// ==========================================
// ZERO-LATENCY RESTORATION CACHE
// ==========================================
export const deletedCache = new Map();
export const restoredCategories = new Map();
export const queuedRestorations = new Set();

export function cacheDeletedItem(id, item) {
  deletedCache.set(id, item);
  setTimeout(() => deletedCache.delete(id), 60000);
}

function mapRestoredCategory(oldId, newId) {
  restoredCategories.set(oldId, newId);
  setTimeout(() => restoredCategories.delete(oldId), 300000);
}

// ==========================================
// SMART RESTORATION QUEUE (200ms gap — rate-limit safe)
// ==========================================
const restorationQueue = [];
let isRestoring = false;

async function processRestorationQueue() {
  if (isRestoring || restorationQueue.length === 0) return;
  isRestoring = true;
  while (restorationQueue.length > 0) {
    // Prioritize categories so children have a parent to land in
    restorationQueue.sort((a, b) => {
      if (a.isCategory && !b.isCategory) return -1;
      if (!a.isCategory && b.isCategory) return 1;
      return 0;
    });
    const task = restorationQueue.shift();
    try { await task.execute(); } catch (e) { console.error('[AntiNuke] Restore task failed:', e.message); }
    await new Promise(r => setTimeout(r, 200)); // 200ms = 5 creates/sec, safe for Discord
  }
  isRestoring = false;
}

// ==========================================
// RATE TRACKER — Per guild/user/event window
// ==========================================
const actionTracker = new Map();
const TRACKER_WINDOW_MS = 10_000;

function trackAction(guildId, userId, eventType) {
  const key = `${guildId}:${userId}:${eventType}`;
  const now = Date.now();
  const times = (actionTracker.get(key) || []).filter(t => now - t < TRACKER_WINDOW_MS);
  times.push(now);
  actionTracker.set(key, times);
  return times.length;
}

function clearTracker(guildId, userId) {
  for (const key of actionTracker.keys()) {
    if (key.startsWith(`${guildId}:${userId}:`)) actionTracker.delete(key);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, times] of actionTracker.entries()) {
    const fresh = times.filter(t => now - t < TRACKER_WINDOW_MS);
    if (fresh.length === 0) actionTracker.delete(key);
    else actionTracker.set(key, fresh);
  }
}, 60_000);

// ==========================================
// DANGEROUS PERMISSIONS
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
// Per-guild locking handles multiple simultaneous nuking bots
// Map<guildId, Set<userId>> so Bot A and Bot B are tracked independently
// ==========================================
const activePunishments = new Map();

function isPunishmentActive(guildId, userId) {
  return activePunishments.get(guildId)?.has(userId) ?? false;
}

function lockPunishment(guildId, userId) {
  if (!activePunishments.has(guildId)) activePunishments.set(guildId, new Set());
  activePunishments.get(guildId).add(userId);
  setTimeout(() => activePunishments.get(guildId)?.delete(userId), 15_000);
}

async function punish(guild, executor, eventType, config, forceBan = false) {
  const punishment = forceBan ? 'ban' : (config.antiNukePunishment || 'ban');
  const reason = `[ATHENA ANTI-NUKE] Unauthorized action: ${eventType}`;
  let result = 'None applied';

  if (isPunishmentActive(guild.id, executor.id)) return result;
  lockPunishment(guild.id, executor.id);

  try {
    if (punishment === 'ban') {
      // Direct-ID ban — zero latency, no fetch
      const banPromise = guild.members.ban(executor.id, { reason }).catch(e => {
        if (e.code === 50013) throw new Error('Missing Permissions');
        throw e;
      });

      // DM in background — does NOT delay the ban
      guild.members.fetch(executor.id).then(m => {
        m?.send({ embeds: [embed.danger('Banned — Athena Prime Protection',
          `You have been permanently banned from **${guild.name}** for triggering Anti-Nuke protection.\n\n**Violation:** ${eventType}`
        )] }).catch(() => null);
      }).catch(() => null);

      await banPromise;
      result = 'Permanently Banned';

    } else if (punishment === 'kick') {
      const executorMember = await guild.members.fetch(executor.id).catch(() => null);
      if (!executorMember) return 'Failed (User not in server)';
      const kickPromise = executorMember.kick(reason);
      executorMember.send({ embeds: [embed.danger('Kicked — Athena Prime Protection',
        `You have been kicked from **${guild.name}** for triggering Anti-Nuke protection.\n\n**Violation:** ${eventType}`
      )] }).catch(() => null);
      await kickPromise;
      result = 'Kicked';

    } else {
      const executorMember = await guild.members.fetch(executor.id).catch(() => null);
      if (!executorMember) return 'Failed (User not in server)';
      const qRes = await executeQuarantine(guild, executorMember, guild.members.me, reason);
      result = qRes.success ? 'Quarantined (all roles stripped)' : 'Quarantine failed';
      if (forceBan && config.antiNukePunishment === 'ban') {
        await guild.members.ban(executor.id, { reason }).catch(() => null);
        result += ' + Banned';
      }
    }
    clearTracker(guild.id, executor.id);
  } catch (err) {
    console.error('[AntiNuke] Punishment failed:', err.message);
    result = `Hierarchy blocked (${err.message})`;
  }
  return result;
}

// ==========================================
// LOG + OWNER DM ENGINE (parallel execution)
// ==========================================
const dmThrottle = new Set();

async function notifyAndLog(guild, executor, eventType, punishResult, rollbackResult) {
  const logEmbed = embed.log(
    'Anti-Nuke Firewall Triggered',
    'A dangerous server mutation was detected, blocked, and rolled back.',
    [
      { name: 'Violator',   value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
      { name: 'Action',     value: `\`${eventType}\``,                     inline: true },
      { name: 'Punishment', value: `**${punishResult}**`,                  inline: true },
      { name: 'Rollback',   value: String(rollbackResult) }
    ],
    'raid'
  );

  // Log and DM run concurrently
  const logPromise = logToSecurityChannel(guild, logEmbed);

  const dmPromise = (async () => {
    try {
      if (!dmThrottle.has(guild.ownerId)) {
        dmThrottle.add(guild.ownerId);
        setTimeout(() => dmThrottle.delete(guild.ownerId), 10_000);
        // Use cache first to avoid unnecessary fetch
        const owner = guild.members.cache.get(guild.ownerId)
          ?? await guild.members.fetch(guild.ownerId).catch(() => null);
        if (owner) {
          await owner.send({ embeds: [embed.danger(
            'CRITICAL: Anti-Nuke Triggered',
            `A dangerous action was detected and contained on **${guild.name}**.`,
            [
              { name: 'Violator',   value: `**${executor.tag}** (\`${executor.id}\`)` },
              { name: 'Violation',  value: `\`${eventType}\`` },
              { name: 'Punishment', value: `**${punishResult}**` },
              { name: 'Rollback',   value: `${rollbackResult} (Check security logs for more)` }
            ]
          )] }).catch(() => null);
        }
      }
    } catch { /* ignore */ }
  })();

  await Promise.all([logPromise, dmPromise]);
}

// ==========================================
// IS AUTHORIZED — Single source of truth
// ==========================================
function isAuthorized(guild, executor, eventType = 'antinuke') {
  if (!executor) return false;
  if (executor.id === guild.members.me?.id) return true;    // bot itself
  if (isBotOwnerSync(executor.id)) return true;             // hardcoded bot owner
  if (executor.id === guild.ownerId) return true;           // server owner
  if (eventType === 'antibot') return false;                // Only owner can add bots
  if (executor.bot) {
    const botWhitelist = db.getBotWhitelist ? db.getBotWhitelist(guild.id) : [];
    if (botWhitelist.includes(executor.id)) return true;
    const member = guild.members.cache.get(executor.id);
    if (member && botWhitelist.some(id => member.roles.cache.has(id))) return true;
    return false; // Unknown uncached bots are NOT authorized
  }
  if (db.isExtraOwner(guild.id, executor.id)) return true;
  if (db.isWhitelisted(guild, executor.id, eventType)) return true;
  return false;
}

// ==========================================
// RECENT BANS TRACKER — For unban guard
// ==========================================
const recentBans = new Map();

// ==========================================
// ⚡⚡ MAXIMUM POWER — ZERO-LATENCY ANTINUKE HANDLER
// WebSocket-native: fires the instant the audit log entry hits Discord's gateway
// ==========================================
export async function handleAuditLogEntry(guild, entry) {
  const config = db.getGuildConfig(guild.id);
  if (!config.antiNukeEnabled) return;

  const { executor, action, executorId, targetId, createdAt } = entry;
  if (!executor || !executorId) return;
  if (executorId === guild.members.me?.id) return;
  if (Date.now() - createdAt.getTime() > 20_000) return; // Ignore stale events

  // ⚡⚡ HYPER-SPEED BOT PRE-EMPTIVE BAN ──────────────────────────────
  // If a non-whitelisted BOT fires ANY dangerous structural action,
  // ban it IMMEDIATELY — before switch, before threshold, before ANYTHING.
  // This is the absolute fastest possible response (~0ms processing overhead).
  const NUKE_BOT_ACTIONS = new Set([
    AuditLogEvent.ChannelDelete, AuditLogEvent.ChannelCreate,
    AuditLogEvent.RoleDelete,    AuditLogEvent.RoleCreate,
    AuditLogEvent.EmojiDelete,   AuditLogEvent.EmojiCreate,
    AuditLogEvent.WebhookCreate, AuditLogEvent.WebhookDelete,
    AuditLogEvent.MemberBanAdd,  AuditLogEvent.MemberKick,
    AuditLogEvent.BotAdd,
  ]);

  if (executor.bot && NUKE_BOT_ACTIONS.has(action)) {
    const botWhitelist = db.getBotWhitelist ? db.getBotWhitelist(guild.id) : [];
    if (!botWhitelist.includes(executorId) && !isBotOwnerSync(executorId)) {
      // 🔥 FIRE THE BAN — right now, no delay, no fetch, no processing
      guild.members.ban(executorId, { reason: '[ATHENA] Nuke bot detected — instant ban' }).catch(() => null);
      // Track it so unban guard and punish() dedup correctly
      lockPunishment(guild.id, executorId);
      recentBans.set(`${guild.id}:${executorId}`, Date.now());
      setTimeout(() => recentBans.delete(`${guild.id}:${executorId}`), 30_000);
    }
  }
  // ─────────────────────────────────────────────────────────────────────

  if (isAuthorized(guild, executor)) return;

  let eventType = null;
  let forceBan = false;

  switch (action) {
    // ── STRUCTURAL NUKES (Instant ban, no threshold required) ─────────
    case AuditLogEvent.ChannelDelete:  eventType = 'Channel Deletion'; forceBan = true; break;
    case AuditLogEvent.ChannelCreate:  eventType = 'Channel Creation'; forceBan = true; break;
    case AuditLogEvent.RoleDelete:     eventType = 'Role Deletion';    forceBan = true; break;
    case AuditLogEvent.RoleCreate:     eventType = 'Role Creation';    forceBan = true; break;
    case AuditLogEvent.EmojiDelete:    eventType = 'Emoji Deletion';   forceBan = true; break;
    case AuditLogEvent.EmojiCreate:    eventType = 'Emoji Creation';   forceBan = true; break;
    case AuditLogEvent.WebhookDelete:  eventType = 'Webhook Deletion'; forceBan = true; break;
    case AuditLogEvent.WebhookCreate:  eventType = 'Webhook Creation'; forceBan = true; break;

    // ── BOT ADD — Double ban: the bot AND the person who added it ─────
    case AuditLogEvent.BotAdd: {
      if (!isAuthorized(guild, executor, 'antibot')) {
        // Ban the unauthorized bot immediately (fire-and-forget)
        guild.members.ban(targetId, { reason: 'Athena Anti-Nuke: Unauthorized bot addition' }).catch(() => null);
        eventType = 'Unauthorized Bot Addition';
        forceBan = true; // Also ban the executor who added it
      } else {
        return; // Authorized bot — ignore
      }
      break;
    }

    // ── MASS KICKS ────────────────────────────────────────────────────
    case AuditLogEvent.MemberKick:
      eventType = 'Member Kick';
      forceBan = false;
      break;

    // ── MASS BANS ────────────────────────────────────────────────────
    case AuditLogEvent.MemberBanAdd:
      eventType = 'Member Ban';
      forceBan = false;
      break;

    // ── UNBAN GUARD — Instantly re-ban if nuker's ban is removed ─────
    case AuditLogEvent.MemberUnban: {
      const recentBan = recentBans.get(`${guild.id}:${targetId}`);
      if (recentBan) {
        guild.members.ban(targetId, { reason: 'Athena Anti-Nuke: Re-applying removed ban' }).catch(() => null);
        eventType = 'Unauthorized Ban Removal';
        forceBan = true;
      } else {
        return; // Normal unban — ignore
      }
      break;
    }

    // ── ROLE PERMISSION ESCALATION ────────────────────────────────────
    case AuditLogEvent.RoleUpdate: {
      const permsChange = entry.changes?.find(c => c.key === 'permissions');
      if (!permsChange) return;
      const oldPerms = new PermissionsBitField(BigInt(permsChange.old || 0));
      const newPerms = new PermissionsBitField(BigInt(permsChange.new || 0));
      if (!DANGEROUS_PERMS.some(p => !oldPerms.has(p) && newPerms.has(p))) return;
      eventType = 'Role Permission Escalation';
      forceBan = false;
      break;
    }

    // ── UNAUTHORIZED DANGEROUS ROLE GRANT ─────────────────────────────
    case AuditLogEvent.MemberRoleUpdate: {
      const rolesChange = entry.changes?.find(c => c.key === '$add');
      if (!rolesChange?.new?.length) return;
      const dangerous = rolesChange.new.some(rObj => {
        const r = guild.roles.cache.get(rObj.id);
        return r && hasDangerousPerms(r.permissions);
      });
      if (!dangerous) return;
      eventType = 'Unauthorized Dangerous Role Grant';
      forceBan = false;
      break;
    }

    // ── SERVER SETTINGS TAMPERING ─────────────────────────────────────
    case AuditLogEvent.GuildUpdate:
      eventType = 'Server Settings Tampering';
      forceBan = false;
      break;

    default: return;
  }

  // ── THRESHOLD CHECK ────────────────────────────────────────────────
  // Bots ALWAYS trigger instantly (forceBan) — no threshold counting needed
  // Humans get threshold checked to avoid false positives on legit bulk ops
  if (!forceBan) {
    if (executor.bot) {
      forceBan = true; // Any non-whitelisted bot hitting a tracked event = instant ban
    } else {
      const threshold = config.antiNukeThreshold || 1;
      const count = trackAction(guild.id, executor.id, eventType);
      if (count < threshold) return;
    }
  }

  // Track ban for unban guard
  if (forceBan) {
    recentBans.set(`${guild.id}:${executor.id}`, Date.now());
    setTimeout(() => recentBans.delete(`${guild.id}:${executor.id}`), 30_000);
  }

  // ── PARALLEL: Punishment + Rollback fire simultaneously ───────────
  const punishPromise = punish(guild, executor, eventType, config, forceBan);

  const rollbackPromise = (async () => {
    let rollbackResult = 'No rollback needed';

    if (action === AuditLogEvent.ChannelDelete) {
      const cachedChannel = deletedCache.get(targetId);
      if (cachedChannel) {
        const isCategory = cachedChannel.type === 4;
        const queueRestore = (ch, iscat) => {
          if (queuedRestorations.has(ch.id)) return;
          queuedRestorations.add(ch.id);
          restorationQueue.push({
            isCategory: iscat,
            execute: async () => {
              try {
                const parentId = restoredCategories.get(ch.parentId) || ch.parentId;
                const overwrites = ch.permissionOverwrites.cache.map(o => ({
                  id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield
                }));
                const newCh = await guild.channels.create({
                  name: ch.name, type: ch.type, topic: ch.topic || null,
                  parent: parentId || null, position: ch.position || 0,
                  permissionOverwrites: overwrites,
                  reason: 'Athena Anti-Nuke: Restored deleted channel'
                });
                if (iscat) mapRestoredCategory(ch.id, newCh.id);
                await notifyAndLog(guild, executor, eventType, await punishPromise, ` **#${ch.name}** restored (<#${newCh.id}>)`);
              } catch (e) {
                if (e.message?.includes('parent_id') || e.message?.includes('CHANNEL_PARENT_INVALID')) {
                  try {
                    const newCh = await guild.channels.create({
                      name: ch.name, type: ch.type,
                      reason: 'Athena Anti-Nuke: Restored without parent'
                    });
                    if (iscat) mapRestoredCategory(ch.id, newCh.id);
                    await notifyAndLog(guild, executor, eventType, await punishPromise, ` **#${ch.name}** restored (outside category)`);
                  } catch (e2) {
                    await notifyAndLog(guild, executor, eventType, await punishPromise, ` Channel restore failed: ${e2.message}`);
                  }
                } else {
                  await notifyAndLog(guild, executor, eventType, await punishPromise, ` Channel restore failed: ${e.message}`);
                }
              }
            }
          });
        };
        queueRestore(cachedChannel, isCategory);
        if (isCategory) {
          for (const [, ch] of deletedCache.entries()) {
            if (ch.parentId === cachedChannel.id) queueRestore(ch, false);
          }
        }
        processRestorationQueue();
        return 'Channel restoration queued';
      }
      return 'Channel not in cache — could not auto-restore';
    }

    if (action === AuditLogEvent.RoleDelete) {
      const r = deletedCache.get(targetId);
      if (r) {
        restorationQueue.push({ isCategory: false, execute: async () => {
          try {
            await guild.roles.create({
              name: r.name, colors: { primaryColor: r.color }, hoist: r.hoist,
              permissions: r.permissions.bitfield, mentionable: r.mentionable,
              reason: 'Athena Anti-Nuke: Restored deleted role'
            });
            await notifyAndLog(guild, executor, eventType, await punishPromise, ` Role **${r.name}** restored`);
          } catch (e) {
            await notifyAndLog(guild, executor, eventType, await punishPromise, ` Role restore failed: ${e.message}`);
          }
        }});
        processRestorationQueue();
        return 'Role restoration queued';
      }
      return 'Role not in cache';
    }

    if (action === AuditLogEvent.EmojiDelete) {
      const eData = deletedCache.get(targetId);
      if (eData) {
        restorationQueue.push({ isCategory: false, execute: async () => {
          try {
            if (eData.url) {
              await guild.emojis.create({ attachment: eData.url, name: eData.name, reason: 'Athena Anti-Nuke: Restored emoji' });
              await notifyAndLog(guild, executor, eventType, await punishPromise, ` Emoji **${eData.name}** restored`);
            } else {
              await notifyAndLog(guild, executor, eventType, await punishPromise, ` Emoji **${eData.name}** cannot be auto-restored`);
            }
          } catch (e) {
            await notifyAndLog(guild, executor, eventType, await punishPromise, ` Emoji restore failed: ${e.message}`);
          }
        }});
        processRestorationQueue();
        return 'Emoji restoration queued';
      }
      return 'Emoji not in cache';
    }

    if (action === AuditLogEvent.ChannelCreate) {
      restorationQueue.push({ isCategory: false, execute: async () => {
        try {
          const ch = await guild.channels.fetch(targetId).catch(() => null);
          if (ch) await ch.delete('Athena Anti-Nuke: Removed unauthorized channel');
          await notifyAndLog(guild, executor, eventType, await punishPromise, ' Unauthorized channel deleted');
        } catch (e) {
          await notifyAndLog(guild, executor, eventType, await punishPromise, ` Delete failed: ${e.message}`);
        }
      }});
      processRestorationQueue();
      return 'Unauthorized channel removal queued';
    }

    if (action === AuditLogEvent.RoleCreate) {
      restorationQueue.push({ isCategory: false, execute: async () => {
        try {
          const r = await guild.roles.fetch(targetId).catch(() => null);
          if (r) await r.delete('Athena Anti-Nuke: Removed unauthorized role');
          await notifyAndLog(guild, executor, eventType, await punishPromise, ' Unauthorized role deleted');
        } catch (e) {
          await notifyAndLog(guild, executor, eventType, await punishPromise, ` Delete failed: ${e.message}`);
        }
      }});
      processRestorationQueue();
      return 'Unauthorized role removal queued';
    }

    if (action === AuditLogEvent.EmojiCreate) {
      restorationQueue.push({ isCategory: false, execute: async () => {
        try {
          const eObj = await guild.emojis.fetch(targetId).catch(() => null);
          if (eObj) await eObj.delete('Athena Anti-Nuke: Removed unauthorized emoji');
          await notifyAndLog(guild, executor, eventType, await punishPromise, ' Unauthorized emoji deleted');
        } catch (e) {
          await notifyAndLog(guild, executor, eventType, await punishPromise, ` Delete failed: ${e.message}`);
        }
      }});
      processRestorationQueue();
      return 'Unauthorized emoji removal queued';
    }

    if (action === AuditLogEvent.WebhookCreate) {
      restorationQueue.push({ isCategory: false, execute: async () => {
        try {
          const webhooks = await guild.fetchWebhooks().catch(() => null);
          const wh = webhooks?.find(w => w.id === targetId);
          if (wh) await wh.delete('Athena Anti-Nuke: Removed unauthorized webhook');
          await notifyAndLog(guild, executor, eventType, await punishPromise, ' Unauthorized webhook deleted');
        } catch (e) {
          await notifyAndLog(guild, executor, eventType, await punishPromise, ` Webhook delete failed: ${e.message}`);
        }
      }});
      processRestorationQueue();
      return 'Unauthorized webhook removal queued';
    }

    if (action === AuditLogEvent.MemberRoleUpdate) {
      const rolesChange = entry.changes?.find(c => c.key === '$add');
      if (rolesChange?.new) {
        const addedRoleIds = rolesChange.new.map(r => r.id);
        const targetMember = await guild.members.fetch(targetId).catch(() => null);
        if (targetMember) {
          await targetMember.roles.remove(addedRoleIds, 'Athena Anti-Nuke: Reversed unauthorized role grant').catch(() => null);
          rollbackResult = ` Removed dangerous roles from <@${targetId}>`;
        } else {
          rollbackResult = ' Target left server, no roles to remove';
        }
      }
    }

    if (action === AuditLogEvent.RoleUpdate) {
      const permsChange = entry.changes?.find(c => c.key === 'permissions');
      if (permsChange) {
        const r = guild.roles.cache.get(targetId);
        if (r) {
          await r.setPermissions(BigInt(permsChange.old || 0), 'Athena Anti-Nuke: Reverted permission escalation').catch(() => null);
          rollbackResult = ` Role **${r.name}** permissions reverted`;
        }
      }
    }

    if (action === AuditLogEvent.GuildUpdate) {
      const rollbacks = [];
      for (const change of (entry.changes || [])) {
        try {
          if (change.key === 'name' && change.old) {
            await guild.setName(change.old, 'Athena Anti-Nuke: Reverted name').catch(() => null);
            rollbacks.push(`Server name restored to **${change.old}**`);
          }
          if (change.key === 'vanity_url_code' && change.old) {
            await guild.setVanityCode(change.old, 'Athena Anti-Nuke: Vanity restored').catch(() => null);
            rollbacks.push(`Vanity restored to **discord.gg/${change.old}**`);
          }
          if (change.key === 'verification_level' && change.old != null) {
            await guild.setVerificationLevel(change.old, 'Athena Anti-Nuke: Reverted verification').catch(() => null);
            rollbacks.push('Verification level restored');
          }
          if (change.key === 'explicit_content_filter' && change.old != null) {
            await guild.setExplicitContentFilter(change.old, 'Athena Anti-Nuke: Reverted content filter').catch(() => null);
            rollbacks.push('Content filter restored');
          }
          if (change.key === 'mfa_level') rollbacks.push('MFA change detected (cannot auto-revert via API)');
        } catch {}
      }
      rollbackResult = rollbacks.length ? rollbacks.join('\n') : 'No rollback available';
    }

    if (action === AuditLogEvent.BotAdd)       rollbackResult = ` Unauthorized bot <@${targetId}> banned instantly`;
    if (action === AuditLogEvent.MemberBanAdd) rollbackResult = ' Mass ban detected — executor banned';
    if (action === AuditLogEvent.MemberKick)   rollbackResult = ' Mass kick detected — executor banned';
    if (action === AuditLogEvent.MemberUnban)  rollbackResult = ` Re-banned <@${targetId}> (ban was removed by unauthorized user)`;

    return rollbackResult;
  })();

  // Await both concurrently — maximum speed
  const [punishResult, rollbackResult] = await Promise.all([punishPromise, rollbackPromise]);

  // Queued actions log themselves inline after restoration — skip duplicate log
  const selfLoggingActions = [
    AuditLogEvent.ChannelDelete, AuditLogEvent.RoleDelete, AuditLogEvent.EmojiDelete,
    AuditLogEvent.ChannelCreate, AuditLogEvent.RoleCreate, AuditLogEvent.EmojiCreate,
    AuditLogEvent.WebhookCreate
  ];
  if (!selfLoggingActions.includes(action)) {
    await notifyAndLog(guild, executor, eventType, punishResult, rollbackResult);
  }
}
