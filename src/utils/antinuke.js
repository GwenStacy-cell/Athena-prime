import { EmbedBuilder, AuditLogEvent, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { logToSecurityChannel, isBotOwnerSync } from './helpers.js';
import { executeQuarantine } from '../commands/security.js';

// ==========================================
// ⚡ RAW HTTP BAN — 1ms STRIKE ENGINE
// Direct REST DELETE to Discord ban endpoint.
// Completely bypasses discord.js cache and all internal processing.
// ==========================================
export async function rawBan(guildId, userId, token, reason = '[ATHENA] Anti-Nuke: Instant elimination') {
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'X-Audit-Log-Reason': encodeURIComponent(reason.slice(0, 512))
      },
      body: JSON.stringify({ delete_message_seconds: 0 })
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

// ==========================================
// ⚡ RAW HTTP ROLE STRIP — fires instantly parallel to ban
// ==========================================
async function rawRoleStrip(guildId, userId, token) {
  try {
    await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'X-Audit-Log-Reason': encodeURIComponent('[ATHENA] Emergency role strip')
      },
      body: JSON.stringify({ roles: [] })
    });
  } catch { /* best-effort */ }
}

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
    // Categories first so children have a parent
    restorationQueue.sort((a, b) => {
      if (a.isCategory && !b.isCategory) return -1;
      if (!a.isCategory && b.isCategory) return 1;
      return 0;
    });
    const task = restorationQueue.shift();
    try { await task.execute(); } catch (e) { console.error('[AntiNuke] Restore task failed:', e.message); }
    await new Promise(r => setTimeout(r, 200));
  }
  isRestoring = false;
}

// ==========================================
// CONDEMNED NUKERS — Instant skip system
// Once a nuker is detected, condemned synchronously (0ms).
// Every subsequent event skips ALL processing → straight to restoration.
// ==========================================
const condemnedNukers = new Map();

function isCondemned(guildId, userId) {
  return condemnedNukers.get(guildId)?.has(userId) ?? false;
}

function condemn(guildId, userId) {
  if (!condemnedNukers.has(guildId)) condemnedNukers.set(guildId, new Set());
  condemnedNukers.get(guildId).add(userId);
  setTimeout(() => condemnedNukers.get(guildId)?.delete(userId), 120_000);
}

// ==========================================
// PUNISHMENT LOCK — prevents duplicate punishment for same nuker
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
// RECENT BANS TRACKER — For unban guard
// ==========================================
const recentBans = new Map();

// ==========================================
// IS BOT AUTHORIZED
// ==========================================
export function isBotAuthorized(guild, botId) {
  if (botId === guild.members.me?.id) return true;
  if (isBotOwnerSync(botId)) return true;
  if (botId === guild.ownerId) return true;
  if (db.isExtraOwner(guild.id, botId)) return true;
  if (db.isBotWhitelisted && db.isBotWhitelisted(guild.id, botId)) return true;
  const botWhitelist = db.getBotWhitelist ? db.getBotWhitelist(guild.id) : [];
  if (botWhitelist.includes(botId)) return true;
  const member = guild.members.cache.get(botId);
  if (member && botWhitelist.some(id => member.roles.cache.has(id))) return true;
  if (db.isWhitelisted(guild, botId, 'antinuke')) return true;
  return false;
}

// ==========================================
// IS AUTHORIZED — Single source of truth
// ==========================================
function isAuthorized(guild, executor, eventType = 'antinuke') {
  if (!executor) return false;
  if (executor.id === guild.client.user.id) return true;
  if (isBotOwnerSync(executor.id)) return true;
  if (executor.id === guild.ownerId) return true;
  if (eventType === 'antibot') return false;
  if (executor.bot) return isBotAuthorized(guild, executor.id);
  if (db.isExtraOwner(guild.id, executor.id)) return true;
  const member = guild.members.cache.get(executor.id) || executor;
  if (db.isWhitelisted(guild, member, eventType)) return true;
  return false;
}

// ==========================================
// LOG + OWNER DM ENGINE (parallel)
// ==========================================
const dmThrottle = new Set();

async function notifyAndLog(guild, executor, eventType, punishResult, rollbackResult) {
  const logEmbed = cv2.log(
    'ATHENA FIREWALL — HOSTILE NEUTRALIZED',
    'A destructive action was intercepted, the threat was eliminated, and damage was reversed.',
    [
      { name: 'Eliminated',  value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
      { name: 'Attack Type', value: `\`${eventType}\``,                     inline: true },
      { name: 'Verdict',     value: `**${punishResult}**`,                  inline: true },
      { name: 'Rollback',    value: String(rollbackResult) }
    ],
    'raid'
  );

  const logPromise = logToSecurityChannel(guild, logEmbed);

  const dmPromise = (async () => {
    try {
      if (!dmThrottle.has(guild.ownerId)) {
        dmThrottle.add(guild.ownerId);
        setTimeout(() => dmThrottle.delete(guild.ownerId), 10_000);
        const owner = guild.members.cache.get(guild.ownerId)
          ?? await guild.members.fetch(guild.ownerId).catch(() => null);
        if (owner) {
          await owner.send(cv2.danger(
            'CRITICAL: Athena Firewall Engaged',
            `A hostile action was detected, neutralized, and reversed on **${guild.name}** in milliseconds.`,
            [
              { name: 'Eliminated',  value: `**${executor.tag}** (\`${executor.id}\`)` },
              { name: 'Attack Type', value: `\`${eventType}\`` },
              { name: 'Verdict',     value: `**${punishResult}**` },
              { name: 'Rollback',    value: `${rollbackResult}` }
            ]
          )).catch(() => null);
        }
      }
    } catch { /* ignore */ }
  })();

  await Promise.all([logPromise, dmPromise]);
}

// ==========================================
// CORE PUNISHMENT ENGINE
// ==========================================
async function punish(guild, executor, eventType, config, forceBan = true) {
  const punishment = forceBan ? 'ban' : (config.antiNukePunishment || 'ban');
  const reason = `[ATHENA ANTI-NUKE] Unauthorized action: ${eventType}`;
  let result = 'None applied';

  if (isPunishmentActive(guild.id, executor.id)) return result;
  lockPunishment(guild.id, executor.id);

  const token = guild.client.token;

  try {
    if (punishment === 'ban') {
      // ⚡ STEP 1: Role strip + raw ban — simultaneous parallel strike
      const [, banOk] = await Promise.all([
        rawRoleStrip(guild.id, executor.id, token),
        rawBan(guild.id, executor.id, token, reason)
      ]);

      if (banOk) {
        result = 'Eliminated (Raw API — 1ms Strike)';
      } else {
        // Fallback chain
        try {
          await guild.members.ban(executor.id, { reason });
          result = 'Permanently Banned (djs fallback)';
        } catch {
          try {
            const m = await guild.members.fetch(executor.id).catch(() => null);
            if (m) {
              await m.roles.set([], '[ATHENA] Force role strip').catch(() => null);
              await guild.members.ban(executor.id, { reason: reason + ' [Role-stripped retry]' });
              result = 'Permanently Banned (role-stripped retry)';
            }
          } catch {
            try {
              const m = guild.members.cache.get(executor.id) ?? await guild.members.fetch(executor.id).catch(() => null);
              if (m?.kickable) {
                await m.kick(reason + ' [Ban failed — kicked]');
                result = 'Kicked (hierarchy blocked ban)';
              }
            } catch (kickErr) {
              result = `Total failure: ${kickErr.message}`;
            }
          }
        }
      }

      // DM fire-and-forget
      guild.members.fetch(executor.id).then(m => {
        m?.send(cv2.danger('Eliminated — Athena Prime Firewall',
          `You have been permanently banned from **${guild.name}**.\n\n**Violation:** ${eventType}\n\n*Athena Prime detected and neutralized your attack in milliseconds.*`
        )).catch(() => null);
      }).catch(() => null);

    } else if (punishment === 'kick') {
      const executorMember = await guild.members.fetch(executor.id).catch(() => null);
      if (!executorMember) return 'Failed (User not in server)';
      executorMember.send(cv2.danger('Kicked — Athena Prime Firewall',
        `You have been kicked from **${guild.name}** for triggering Anti-Nuke protection.\n\n**Violation:** ${eventType}`
      )).catch(() => null);
      await executorMember.kick(reason);
      result = 'Kicked';

    } else {
      const executorMember = await guild.members.fetch(executor.id).catch(() => null);
      if (!executorMember) return 'Failed (User not in server)';
      const qRes = await executeQuarantine(guild, executorMember, guild.members.me, reason);
      result = qRes.success ? 'Quarantined (all roles stripped)' : 'Quarantine failed';
    }
  } catch (err) {
    console.error('[AntiNuke] Punishment failed:', err.message);
    result = `Hierarchy blocked (${err.message})`;
  }
  return result;
}

// ==========================================
// ⚡⚡⚡ DIRECT STRIKE — THE REAL 1ms ENGINE
// Called directly from native gateway events (channelDelete, roleDelete, etc.)
// These events fire INSTANTLY on the WebSocket — no audit log dispatch delay.
// We fetch the audit log ourselves immediately to identify the executor.
// This eliminates the 200-500ms Discord audit log dispatch delay ENTIRELY.
// ==========================================
export async function directStrike(guild, auditType, eventType, targetId, rollbackFn) {
  const config = db.getGuildConfig(guild.id);
  if (!config.securityEnabled && !config.antiNukeEnabled) return;
  const mods = config.antinukeModules || {};

  // Module check
  const moduleMap = {
    [AuditLogEvent.ChannelDelete]:     mods.antiChannelDelete,
    [AuditLogEvent.ChannelCreate]:     mods.antiChannelCreate,
    [AuditLogEvent.RoleDelete]:        mods.antiRoleDelete,
    [AuditLogEvent.RoleCreate]:        mods.antiRoleCreate,
    [AuditLogEvent.EmojiDelete]:       mods.antiEmojiDelete,
    [AuditLogEvent.EmojiCreate]:       mods.antiEmojiCreate,
    [AuditLogEvent.WebhookCreate]:     mods.antiWebhooks,
    [AuditLogEvent.WebhookDelete]:     mods.antiWebhooks,
    [AuditLogEvent.MemberBanAdd]:      mods.antiBan,
    [AuditLogEvent.MemberKick]:        mods.antiKick,
    [AuditLogEvent.BotAdd]:            mods.antiBotAdd,
  };
  if (moduleMap[auditType] === false) return;

  // ⚡ Immediately fetch the audit log ourselves — no waiting for Discord to dispatch it
  // This typically takes ~30-80ms, FAR faster than waiting for Discord's dispatch (~200-500ms)
  let executor = null;
  let entry = null;
  let attempts = 0;

  while (!executor && attempts < 3) {
    const logs = await guild.fetchAuditLogs({ limit: 5, type: auditType }).catch(() => null);
    const found = logs?.entries?.find(e =>
      (!targetId || e.targetId === targetId) &&
      Date.now() - e.createdAt.getTime() < 10_000
    );
    if (found) {
      executor = found.executor;
      entry = found;
    } else {
      await new Promise(r => setTimeout(r, 30));
    }
    attempts++;
  }

  if (!executor) return; // Cannot identify — do nothing

  // Skip if it's the bot itself or authorized
  if (executor.id === guild.client.user.id) return;
  if (isAuthorized(guild, executor, eventType)) return;

  // ⚡ CONDEMN — synchronous 0ms, any further events skip straight to restoration
  const alreadyCondemned = isCondemned(guild.id, executor.id);
  condemn(guild.id, executor.id);

  if (alreadyCondemned) {
    // Already being punished — just run restoration
    if (rollbackFn) {
      restorationQueue.push({ isCategory: false, execute: rollbackFn });
      processRestorationQueue();
    }
    return;
  }

  // Track for unban guard
  recentBans.set(`${guild.id}:${executor.id}`, Date.now());
  setTimeout(() => recentBans.delete(`${guild.id}:${executor.id}`), 30_000);

  // ⚡ PARALLEL: punishment + rollback fire simultaneously
  const punishPromise = punish(guild, executor, eventType, config, true);

  const rollbackPromise = (async () => {
    if (!rollbackFn) return 'No rollback needed';
    try {
      if (rollbackFn) {
        restorationQueue.push({ isCategory: eventType.includes('Category'), execute: rollbackFn });
        processRestorationQueue();
      }
      return 'Restoration queued';
    } catch (e) {
      return `Rollback failed: ${e.message}`;
    }
  })();

  const [punishResult, rollbackResult] = await Promise.all([punishPromise, rollbackPromise]);
  notifyAndLog(guild, executor, eventType, punishResult, rollbackResult).catch(() => null);
}

// ==========================================
// ⚡ AUDIT LOG HANDLER — still used for events that have no native gateway event
// (RoleUpdate, MemberRoleUpdate, GuildUpdate, BotAdd, MemberUnban)
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

const velocityTracker = new Map();
const VELOCITY_WINDOW_MS = 30_000;
const VELOCITY_THRESHOLD = 1;

const DESTRUCTIVE_ACTIONS = new Set([
  AuditLogEvent.ChannelDelete, AuditLogEvent.RoleDelete,
  AuditLogEvent.EmojiDelete,   AuditLogEvent.WebhookCreate,
  AuditLogEvent.WebhookDelete, AuditLogEvent.MemberKick,
  AuditLogEvent.MemberBanAdd,  AuditLogEvent.ChannelCreate,
  AuditLogEvent.RoleCreate,    AuditLogEvent.EmojiCreate,
]);

function trackVelocity(guildId, userId, action) {
  if (!DESTRUCTIVE_ACTIONS.has(action)) return 0;
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const times = (velocityTracker.get(key) || []).filter(t => now - t < VELOCITY_WINDOW_MS);
  times.push(now);
  velocityTracker.set(key, times);
  return times.length;
}

export async function handleAuditLogEntry(guild, entry) {
  const config = db.getGuildConfig(guild.id);
  if (!config.securityEnabled && !config.antiNukeEnabled) return;
  const mods = config.antinukeModules || {};

  const { executor, action, executorId, targetId, createdAt } = entry;
  if (!executor || !executorId) return;
  if (executorId === guild.members.me?.id) return;
  if (Date.now() - createdAt.getTime() > 20_000) return;

  // ⚡ CONDEMNED FAST PATH — already being handled by directStrike
  if (isCondemned(guild.id, executorId)) {
    // Just handle restoration for condemned nukers
    if (action === AuditLogEvent.ChannelDelete) {
      const ch = deletedCache.get(targetId);
      if (ch && !queuedRestorations.has(targetId)) {
        queuedRestorations.add(targetId);
        const isCategory = ch.type === 4;
        restorationQueue.push({
          isCategory,
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
                reason: 'Athena Anti-Nuke: Restored (condemned fast path)'
              });
              if (isCategory) mapRestoredCategory(ch.id, newCh.id);
            } catch (e) {
              try {
                await guild.channels.create({ name: ch.name, type: ch.type, reason: 'Athena Anti-Nuke: Restored without parent' });
              } catch {}
            }
          }
        });
        processRestorationQueue();
      }
    } else if (action === AuditLogEvent.RoleDelete) {
      const r = deletedCache.get(targetId);
      if (r && !queuedRestorations.has(targetId)) {
        queuedRestorations.add(targetId);
        restorationQueue.push({
          isCategory: false,
          execute: async () => {
            try {
              await guild.roles.create({
                name: r.name, colors: { primaryColor: r.color }, hoist: r.hoist,
                permissions: r.permissions.bitfield, mentionable: r.mentionable,
                reason: 'Athena Anti-Nuke: Restored deleted role (condemned fast path)'
              });
            } catch {}
          }
        });
        processRestorationQueue();
      }
    }
    return;
  }

  // ── EVENTS NOT COVERED BY NATIVE GATEWAY ─────────────────────────────
  // directStrike() handles: ChannelDelete, ChannelCreate, RoleDelete, RoleCreate,
  // EmojiDelete, EmojiCreate, WebhookCreate/Delete, MemberBanAdd, MemberKick.
  // This handler catches the remaining events that have no dedicated native event.

  if (isAuthorized(guild, executor)) return;

  let eventType = null;
  let forceBan = false;

  switch (action) {
    case AuditLogEvent.BotAdd:
      if (!mods.antiBotAdd) return;
      if (!isAuthorized(guild, executor, 'antibot')) {
        if (targetId !== guild.client.user.id) {
          guild.members.ban(targetId, { reason: 'Athena Anti-Nuke: Unauthorized bot addition' }).catch(() => null);
        }
        eventType = 'Unauthorized Bot Addition';
        forceBan = true;
      } else return;
      break;

    case AuditLogEvent.MemberUnban:
      if (!mods.antiUnban) return;
      const recentBan = recentBans.get(`${guild.id}:${targetId}`);
      if (recentBan) {
        guild.members.ban(targetId, { reason: 'Athena Anti-Nuke: Re-applying removed ban' }).catch(() => null);
        eventType = 'Unauthorized Ban Removal';
        forceBan = true;
      } else return;
      break;

    case AuditLogEvent.RoleUpdate:
      const pChange = entry.changes?.find(c => c.key === 'permissions');
      const nChange = entry.changes?.find(c => c.key === 'name');
      const posChange = entry.changes?.find(c => c.key === 'position');
      
      if (pChange && (mods.antiRolePermUpdate || mods.antiRoleUpdate)) {
        const oldPerms = new PermissionsBitField(BigInt(pChange.old || 0));
        const newPerms = new PermissionsBitField(BigInt(pChange.new || 0));
        if (DANGEROUS_PERMS.some(p => !oldPerms.has(p) && newPerms.has(p))) {
          eventType = 'Role Permission Escalation';
          forceBan = true;
        }
      } else if (nChange && mods.antiRoleUpdate) {
        eventType = 'Role Name Modification';
      } else if (posChange && mods.antiRoleReorder) {
        eventType = 'Role Reorder / Hierarchy Tampering';
      }
      break;

    case AuditLogEvent.MemberRoleUpdate:
      if (!mods.antiMemberRoleUpdate) return;
      const rolesChange = entry.changes?.find(c => c.key === '$add');
      if (rolesChange?.new?.length) {
        const dangerous = rolesChange.new.some(rObj => {
          const r = guild.roles.cache.get(rObj.id);
          return r && hasDangerousPerms(r.permissions);
        });
        if (dangerous) {
          eventType = 'Unauthorized Dangerous Role Grant';
          forceBan = true;
        }
      }
      break;

    case AuditLogEvent.GuildUpdate:
      if (!mods.antiServerUpdate) return;
      eventType = 'Server Settings Tampering';
      forceBan = true;
      break;

    case AuditLogEvent.ChannelUpdate:
      const cpChange = entry.changes?.find(c => c.key === 'permission_overwrites');
      const cnChange = entry.changes?.find(c => c.key === 'name');
      const cposChange = entry.changes?.find(c => c.key === 'position');
      
      if (cpChange && (mods.antiChannelPermUpdate || mods.antiChannelUpdate)) {
        eventType = 'Channel Permission Tampering';
      } else if (cnChange && (mods.antiChannelNameMod || mods.antiChannelUpdate)) {
        eventType = 'Channel Name Modification';
      } else if (cposChange && (mods.antiChannelReorder || mods.antiChannelUpdate)) {
        eventType = 'Channel Reorder / Tampering';
      } else if (mods.antiChannelUpdate) {
        eventType = 'Channel Settings Tampering';
      }
      break;

    case AuditLogEvent.EmojiUpdate:
      if (!mods.antiEmojiUpdate) return;
      eventType = 'Emoji Modification';
      break;

    case AuditLogEvent.InviteCreate:
      case AuditLogEvent.InviteDelete:
        if (config.antiInviteEnabled !== true) return;
        eventType = 'Unauthorized Invite Tampering';
      break;

    case AuditLogEvent.GuildScheduledEventCreate:
    case AuditLogEvent.GuildScheduledEventUpdate:
    case AuditLogEvent.GuildScheduledEventDelete:
      if (!mods.antiScheduledEvents) return;
      eventType = 'Scheduled Event Tampering';
      break;

    case AuditLogEvent.AutoModerationRuleCreate:
    case AuditLogEvent.AutoModerationRuleUpdate:
    case AuditLogEvent.AutoModerationRuleDelete:
      if (!mods.antiAutomodUpdate) return;
      eventType = 'AutoMod Rule Tampering';
      forceBan = true;
      break;

    case AuditLogEvent.IntegrationCreate:
    case AuditLogEvent.IntegrationUpdate:
    case AuditLogEvent.IntegrationDelete:
      if (!mods.antiAppCommands) return;
      eventType = 'Integration / App Command Tampering';
      forceBan = true;
      break;

    // Purge / Mass Ban are typically high velocity triggers. We'll add them here just to catch explicit single events if enabled, though directStrike handles velocity.
    case AuditLogEvent.MemberKick:
      if (!mods.antiMemberPurge && !mods.antiKick) return;
      eventType = 'Unauthorized Kick (Purge Module)';
      break;

    case AuditLogEvent.MemberBanAdd:
      if (!mods.antiMassBan && !mods.antiBan) return;
      eventType = 'Unauthorized Ban (Mass Ban Module)';
      break;

    default: return;
  }

  if (!eventType) return;

  recentBans.set(`${guild.id}:${executor.id}`, Date.now());
  setTimeout(() => recentBans.delete(`${guild.id}:${executor.id}`), 30_000);

  condemn(guild.id, executor.id);

  const punishPromise = punish(guild, executor, eventType, config, forceBan);

  const rollbackPromise = (async () => {
    let rollbackResult = 'No rollback needed';

    if (action === AuditLogEvent.MemberRoleUpdate) {
      const rolesChange = entry.changes?.find(c => c.key === '$add');
      if (rolesChange?.new) {
        const addedRoleIds = rolesChange.new.map(r => r.id);
        const targetMember = await guild.members.fetch(targetId).catch(() => null);
        if (targetMember) {
          await targetMember.roles.remove(addedRoleIds, 'Athena Anti-Nuke: Reversed unauthorized role grant').catch(() => null);
          rollbackResult = ` Removed dangerous roles from <@${targetId}>`;
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
        } catch {}
      }
      rollbackResult = rollbacks.length ? rollbacks.join('\n') : 'No rollback available';
    }

    if (action === AuditLogEvent.BotAdd)       rollbackResult = ` Unauthorized bot <@${targetId}> banned instantly`;
    if (action === AuditLogEvent.MemberUnban)  rollbackResult = ` Re-banned <@${targetId}> (ban was removed by unauthorized user)`;

    return rollbackResult;
  })();

  const [punishResult, rollbackResult] = await Promise.all([punishPromise, rollbackPromise]);
  await notifyAndLog(guild, executor, eventType, punishResult, rollbackResult);
}

// Periodic memory cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of actionTracker.entries()) {
    if (times.filter(t => now - t < TRACKER_WINDOW_MS).length === 0) actionTracker.delete(key);
  }
  for (const [key, times] of velocityTracker.entries()) {
    if (times.filter(t => now - t < VELOCITY_WINDOW_MS).length === 0) velocityTracker.delete(key);
  }
}, 60_000);
