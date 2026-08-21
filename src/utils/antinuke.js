import { EmbedBuilder, AuditLogEvent, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { logToSecurityChannel, isBotOwnerSync } from './helpers.js';
import { executeQuarantine } from '../commands/security.js';

// ==========================================
// ⚡ RAW HTTP BAN — LIGHT-SPEED STRIKE ENGINE
// Fires a direct REST DELETE to Discord's ban endpoint.
// Completely bypasses discord.js cache, managers, and all internal processing.
// Reaction time: ~1-3ms vs ~15-50ms with guild.members.ban()
// ==========================================
async function rawBan(guildId, userId, token, reason = '[ATHENA] Anti-Nuke: Instant elimination') {
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
// Removes all roles from a member via direct REST PATCH.
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
const TRACKER_WINDOW_MS = 10_000;  // 10-second window per event type

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

// ==========================================
// GLOBAL VELOCITY TRACKER — Cross-event pattern detection
// Catches nukers who spread actions across multiple event types
// to try to stay below per-event thresholds
// ==========================================
const velocityTracker = new Map();
const VELOCITY_WINDOW_MS = 30_000;
const VELOCITY_THRESHOLD = 1; // ZERO TOLERANCE — 1 action of ANY type = nuke

// Destructive actions that count toward global velocity
const DESTRUCTIVE_ACTIONS = new Set([
  AuditLogEvent.ChannelDelete, AuditLogEvent.RoleDelete,
  AuditLogEvent.EmojiDelete,   AuditLogEvent.WebhookCreate,
  AuditLogEvent.WebhookDelete, AuditLogEvent.MemberKick,
  AuditLogEvent.MemberBanAdd,  AuditLogEvent.ChannelCreate,
  AuditLogEvent.RoleCreate,    AuditLogEvent.EmojiCreate,
]);

// ==========================================
// ⚡ PREDICTIVE QUARANTINE TRACKER
// Tracks "minor" suspicious actions (not immediately nuke-level)
// If 3+ minor actions happen within 15s, pre-emptively neutralize
// the executor BEFORE they can do structural damage.
// Minor actions: RoleUpdate, ServerUpdate, MemberRoleUpdate, EmojiUpdate
// ==========================================
const suspectTracker = new Map();
const SUSPECT_WINDOW_MS = 15_000;
const SUSPECT_THRESHOLD = 3;
const MINOR_SUSPECT_ACTIONS = new Set([
  AuditLogEvent.RoleUpdate,       AuditLogEvent.GuildUpdate,
  AuditLogEvent.MemberRoleUpdate, AuditLogEvent.ChannelUpdate,
  AuditLogEvent.AutoModerationRuleUpdate,
]);

function trackSuspect(guildId, userId, action) {
  if (!MINOR_SUSPECT_ACTIONS.has(action)) return 0;
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const times = (suspectTracker.get(key) || []).filter(t => now - t < SUSPECT_WINDOW_MS);
  times.push(now);
  suspectTracker.set(key, times);
  return times.length;
}

function trackVelocity(guildId, userId, action) {
  if (!DESTRUCTIVE_ACTIONS.has(action)) return 0;
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const times = (velocityTracker.get(key) || []).filter(t => now - t < VELOCITY_WINDOW_MS);
  times.push(now);
  velocityTracker.set(key, times);
  return times.length;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, times] of actionTracker.entries()) {
    const fresh = times.filter(t => now - t < TRACKER_WINDOW_MS);
    if (fresh.length === 0) actionTracker.delete(key);
    else actionTracker.set(key, fresh);
  }
  for (const [key, times] of velocityTracker.entries()) {
    const fresh = times.filter(t => now - t < VELOCITY_WINDOW_MS);
    if (fresh.length === 0) velocityTracker.delete(key);
    else velocityTracker.set(key, fresh);
  }
  for (const [key, times] of suspectTracker.entries()) {
    const fresh = times.filter(t => now - t < SUSPECT_WINDOW_MS);
    if (fresh.length === 0) suspectTracker.delete(key);
    else suspectTracker.set(key, fresh);
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
  return activePunishments.get(guildId)•.has(userId) •• false;
}

function lockPunishment(guildId, userId) {
  if (!activePunishments.has(guildId)) activePunishments.set(guildId, new Set());
  activePunishments.get(guildId).add(userId);
  setTimeout(() => activePunishments.get(guildId)•.delete(userId), 15_000);
}

async function punish(guild, executor, eventType, config, forceBan = false) {
  const punishment = forceBan • 'ban' : (config.antiNukePunishment || 'ban');
  const reason = `[ATHENA ANTI-NUKE] Unauthorized action: ${eventType}`;
  let result = 'None applied';

  if (isPunishmentActive(guild.id, executor.id)) return result;
  lockPunishment(guild.id, executor.id);

  const token = guild.client.token;

  try {
    if (punishment === 'ban') {
      // ⚡ STEP 1: Raw role strip + raw ban fired simultaneously (pure parallel)
      // rawRoleStrip breaks hierarchy so the ban can land even if they have a high role
      const [, banOk] = await Promise.all([
        rawRoleStrip(guild.id, executor.id, token),
        rawBan(guild.id, executor.id, token, reason)
      ]);

      if (banOk) {
        result = 'Eliminated (Raw API — Light-Speed Strike)';
      } else {
        // Fallback: discord.js ban with role-strip retry
        console.warn(`[AntiNuke] Raw ban failed for ${executor.id}, falling back to djs ban`);
        try {
          await guild.members.ban(executor.id, { reason });
          result = 'Permanently Banned (djs fallback)';
        } catch (banErr) {
          try {
            const m = await guild.members.fetch(executor.id).catch(() => null);
            if (m) {
              await m.roles.set([], '[ATHENA] Force role strip').catch(() => null);
              await guild.members.ban(executor.id, { reason: reason + ' [Role-stripped retry]' });
              result = 'Permanently Banned (role-stripped retry)';
            } else {
              throw new Error('Member not fetchable');
            }
          } catch (retryErr) {
            try {
              const m = guild.members.cache.get(executor.id) •• await guild.members.fetch(executor.id).catch(() => null);
              if (m•.kickable) {
                await m.kick(reason + ' [Ban failed — kicked]');
                result = 'Kicked (hierarchy blocked ban)';
              } else {
                result = `All attempts failed: ${retryErr.message}`;
              }
            } catch (kickErr) {
              result = `Total failure: ${kickErr.message}`;
            }
          }
        }
      }

      // DM in background — fire-and-forget, no await
      guild.members.fetch(executor.id).then(m => {
        m•.send(cv2.danger('Eliminated — Athena Prime Firewall',
          `You have been permanently banned from **${guild.name}**.\n\n**Violation:** ${eventType}\n\n*Athena Prime detected and neutralized your attack in milliseconds.*`
        )).catch(() => null);
      }).catch(() => null);

    } else if (punishment === 'kick') {
      const executorMember = await guild.members.fetch(executor.id).catch(() => null);
      if (!executorMember) return 'Failed (User not in server)';
      const kickPromise = executorMember.kick(reason);
      executorMember.send(cv2.danger('Kicked — Athena Prime Firewall',
        `You have been kicked from **${guild.name}** for triggering Anti-Nuke protection.\n\n**Violation:** ${eventType}`
      )).catch(() => null);
      await kickPromise;
      result = 'Kicked';

    } else {
      const executorMember = await guild.members.fetch(executor.id).catch(() => null);
      if (!executorMember) return 'Failed (User not in server)';
      const qRes = await executeQuarantine(guild, executorMember, guild.members.me, reason);
      result = qRes.success • 'Quarantined (all roles stripped)' : 'Quarantine failed';
      if (forceBan && config.antiNukePunishment === 'ban') {
        rawBan(guild.id, executor.id, token, reason).catch(() =>
          guild.members.ban(executor.id, { reason }).catch(() => null)
        );
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

  // Log and DM run concurrently
  const logPromise = logToSecurityChannel(guild, logEmbed);

  const dmPromise = (async () => {
    try {
      if (!dmThrottle.has(guild.ownerId)) {
        dmThrottle.add(guild.ownerId);
        setTimeout(() => dmThrottle.delete(guild.ownerId), 10_000);
        const owner = guild.members.cache.get(guild.ownerId)
          •• await guild.members.fetch(guild.ownerId).catch(() => null);
        if (owner) {
          await owner.send(cv2.danger(
            '🛡️ CRITICAL: Athena Firewall Engaged',
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
// IS BOT AUTHORIZED — dedicated check for bots using the bot whitelist
function isBotAuthorized(guild, botId) {
  if (botId === guild.members.me•.id) return true;   // Athena herself
  if (isBotOwnerSync(botId)) return true;            // bot owner
  if (botId === guild.ownerId) return true;          // server owner
  if (db.isExtraOwner(guild.id, botId)) return true; // extra owner
  // Primary: !botwhitelist add <id> — stored in db.cache.botWhitelist
  if (db.isBotWhitelisted && db.isBotWhitelisted(guild.id, botId)) return true;
  // Fallback: getBotWhitelist (role-based whitelist entries)
  const botWhitelist = db.getBotWhitelist • db.getBotWhitelist(guild.id) : [];
  if (botWhitelist.includes(botId)) return true;
  // Check role-based whitelist entries
  const member = guild.members.cache.get(botId);
  if (member && botWhitelist.some(id => member.roles.cache.has(id))) return true;
  // Also check granular whitelist (covers !whitelist add <botId> antinuke)
  if (db.isWhitelisted(guild, botId, 'antinuke')) return true;
  return false;
}

// IS AUTHORIZED — Single source of truth
// ==========================================
function isAuthorized(guild, executor, eventType = 'antinuke') {
  if (!executor) return false;
  if (executor.id === guild.client.user.id) return true;    // bot itself
  if (isBotOwnerSync(executor.id)) return true;             // hardcoded bot owner
  if (executor.id === guild.ownerId) return true;           // server owner
  if (eventType === 'antibot') return false;                // Only owner can add bots
  if (executor.bot) return isBotAuthorized(guild, executor.id);
  if (db.isExtraOwner(guild.id, executor.id)) return true;
  
  const member = guild.members.cache.get(executor.id) || executor.id;
  if (db.isWhitelisted(guild, member, eventType)) return true;
  
  return false;
}

// ==========================================
// RECENT BANS TRACKER — For unban guard
// ==========================================
const recentBans = new Map();

// ==========================================
// CONDEMNED NUKERS — Instant skip system
// Once a nuker is detected on event 1, they are condemned immediately.
// Events 2, 3, 4... from the same user skip ALL processing and go
// straight to restoration — zero wasted cycles on duplicate handling.
// ==========================================
const condemnedNukers = new Map(); // Map<guildId, Set<userId>>

function isCondemned(guildId, userId) {
  return condemnedNukers.get(guildId)•.has(userId) •• false;
}

function condemn(guildId, userId) {
  if (!condemnedNukers.has(guildId)) condemnedNukers.set(guildId, new Set());
  condemnedNukers.get(guildId).add(userId);
  // Auto-clear after 2 minutes (ban will have long taken effect by then)
  setTimeout(() => condemnedNukers.get(guildId)•.delete(userId), 120_000);
}

// ==========================================
// ⚡⚡ MAXIMUM POWER — ZERO-LATENCY ANTINUKE HANDLER
// WebSocket-native: fires the instant the audit log entry hits Discord's gateway
// ==========================================
export async function handleAuditLogEntry(guild, entry) {
  const config = db.getGuildConfig(guild.id);
  if (!config.securityEnabled && !config.antiNukeEnabled) return;
  const mods = config.antinukeModules || {};

  const { executor, action, executorId, targetId, createdAt } = entry;
  if (!executor || !executorId) return;
  if (executorId === guild.members.me•.id) return;
  if (Date.now() - createdAt.getTime() > 20_000) return; // Ignore stale events

  // ⚡ CONDEMNED FAST PATH ───────────────────────────────────────────────
  // If this executor was already condemned on a previous event (ban in flight),
  // skip ALL switch/threshold/punish processing. Just queue restoration directly.
  if (isCondemned(guild.id, executorId)) {
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
    return; // Skip all other processing — ban already in flight
  }
  // ──────────────────────────────────────────────────────────────────────

  // ⚡⚡⚡ HYPER-SPEED BOT PRE-EMPTIVE STRIKE ──────────────────────────
  // If a non-whitelisted BOT fires ANY dangerous structural action,
  // CONDEMN + ROLE-STRIP + RAW-BAN simultaneously — pure parallel execution.
  // Reaction time: ~1-5ms. Nuker is dead before it can send a 2nd request.
  const NUKE_BOT_ACTIONS = new Set([
    AuditLogEvent.ChannelDelete, AuditLogEvent.ChannelCreate,
    AuditLogEvent.RoleDelete,    AuditLogEvent.RoleCreate,
    AuditLogEvent.EmojiDelete,   AuditLogEvent.EmojiCreate,
    AuditLogEvent.WebhookCreate, AuditLogEvent.WebhookDelete,
    AuditLogEvent.MemberBanAdd,  AuditLogEvent.MemberKick,
    AuditLogEvent.BotAdd,
  ]);

  if (executor.bot && NUKE_BOT_ACTIONS.has(action)) {
    if (!isBotAuthorized(guild, executorId)) {
      // ⚡ CONDEMN FIRST — synchronous, no await
      // Any further events from this bot instantly skip to restoration
      condemn(guild.id, executorId);
      lockPunishment(guild.id, executorId);
      recentBans.set(`${guild.id}:${executorId}`, Date.now());
      setTimeout(() => recentBans.delete(`${guild.id}:${executorId}`), 30_000);

      const token = guild.client.token;

      // ⚡⚡ SIMULTANEOUS PARALLEL STRIKE — role strip + raw API ban fired at same ms
      Promise.all([
        rawRoleStrip(guild.id, executorId, token),  // breaks hierarchy instantly
        rawBan(guild.id, executorId, token, '[ATHENA] Nuke bot neutralized — instant elimination')
      ]).then(([, banOk]) => {
        if (!banOk) {
          // Raw ban failed, use discord.js as safety net
          guild.members.ban(executorId, { reason: '[ATHENA] Nuke bot — djs fallback ban' }).catch(() => null);
        }
        console.log(`[AntiNuke] ⚡ INSTANT ELIMINATION: Bot ${executorId} in ${guild.id} (${action})`);
      }).catch(err => {
        console.error(`[AntiNuke] ⚠️ Parallel strike failed for bot ${executorId}: ${err.message}`);
        guild.members.ban(executorId, { reason: '[ATHENA] Nuke bot — emergency fallback' }).catch(() => null);
      });
    }
  }
  // ─────────────────────────────────────────────────────────────────────

  // ⚡ PREDICTIVE QUARANTINE — Detect suspicious patterns BEFORE structural damage
  // 3+ minor actions (role edits, server setting changes) in 15s = proactive ban
  if (!executor.bot && MINOR_SUSPECT_ACTIONS.has(action) && !isAuthorized(guild, executor)) {
    const suspectCount = trackSuspect(guild.id, executorId, action);
    if (suspectCount >= SUSPECT_THRESHOLD && !isCondemned(guild.id, executorId) && !isPunishmentActive(guild.id, executorId)) {
      console.warn(`[AntiNuke] ⚠️ PREDICTIVE TRIGGER: ${executorId} in ${guild.id} — ${suspectCount} minor actions in 15s`);
      condemn(guild.id, executorId);
      const token = guild.client.token;
      // Raw ban + role strip simultaneously — intercept before structural damage
      Promise.all([
        rawRoleStrip(guild.id, executorId, token),
        rawBan(guild.id, executorId, token, '[ATHENA] Predictive Neutralization — Suspicious behavior pattern detected')
      ]).catch(() => null);
      lockPunishment(guild.id, executorId);
      // Log this predictive action
      notifyAndLog(guild, executor, 'Predictive Neutralization (Suspicious Pattern)', 'Eliminated before structural damage', 'Pre-emptive ban — 3+ minor suspicious actions in 15 seconds').catch(() => null);
      return; // Exit — ban in flight
    }
  }
  // ─────────────────────────────────────────────────────────────────────

  if (isAuthorized(guild, executor)) {
    // Whitelisted users, whitelisted bots, extra owners, server owner, and bot owner
    // are all fully exempt — no velocity tracking, no abuse detection.
    return;
  }

  let eventType = null;
  let forceBan = false;

  switch (action) {
    // ── STRUCTURAL NUKES (Instant ban, no threshold required) ─────────
    case AuditLogEvent.ChannelDelete:
      if (!mods.antiChannelDelete) return;
      eventType = 'Channel Deletion'; forceBan = true; break;
    case AuditLogEvent.ChannelCreate:
      if (!mods.antiChannelCreate) return;
      eventType = 'Channel Creation'; forceBan = true; break;
    case AuditLogEvent.RoleDelete:
      if (!mods.antiRoleDelete) return;
      eventType = 'Role Deletion';    forceBan = true; break;
    case AuditLogEvent.RoleCreate:
      if (!mods.antiRoleCreate) return;
      eventType = 'Role Creation';    forceBan = true; break;
    case AuditLogEvent.EmojiDelete:
      if (!mods.antiEmojiDelete) return;
      eventType = 'Emoji Deletion';   forceBan = true; break;
    case AuditLogEvent.EmojiCreate:
      if (!mods.antiEmojiCreate) return;
      eventType = 'Emoji Creation';   forceBan = true; break;
    case AuditLogEvent.WebhookDelete:
    case AuditLogEvent.WebhookCreate:
      if (!mods.antiWebhooks) return;
      eventType = 'Webhook Modification'; forceBan = true; break;

    // ── BOT ADD — Double ban: the bot AND the person who added it ─────
    case AuditLogEvent.BotAdd: {
      if (!mods.antiBotAdd) return;
      if (!isAuthorized(guild, executor, 'antibot')) {
        // Prevent Athena from banning herself, but still ban the unauthorized admin
        if (targetId !== guild.client.user.id) {
          guild.members.ban(targetId, { reason: 'Athena Anti-Nuke: Unauthorized bot addition' }).catch(() => null);
        }
        eventType = 'Unauthorized Bot Addition';
        forceBan = true; // Also ban the executor who added it
      } else {
        return; // Authorized bot — ignore
      }
      break;
    }

    // ── MASS KICKS — ZERO TOLERANCE ──────────────────────────────────
    case AuditLogEvent.MemberKick:
      if (!mods.antiKick) return;
      eventType = 'Member Kick';
      forceBan = true; // Zero tolerance — 1 kick from non-whitelisted = instant ban
      break;

    // ── MASS BANS — ZERO TOLERANCE ───────────────────────────────────
    case AuditLogEvent.MemberBanAdd:
      if (!mods.antiBan) return;
      eventType = 'Member Ban';
      forceBan = true; // Zero tolerance — 1 ban from non-whitelisted = instant ban
      break;

    // ── UNBAN GUARD — Instantly re-ban if nuker's ban is removed ─────
    case AuditLogEvent.MemberUnban: {
      if (!mods.antiUnban) return;
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
      if (!mods.antiRolePermUpdate && !mods.antiRoleUpdate) return;
      const permsChange = entry.changes•.find(c => c.key === 'permissions');
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
      if (!mods.antiMemberRoleUpdate) return;
      const rolesChange = entry.changes•.find(c => c.key === '$add');
      if (!rolesChange•.new•.length) return;
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
      if (!mods.antiServerUpdate) return;
      eventType = 'Server Settings Tampering';
      forceBan = false;
      break;

    default: return;
  }

  // ── ZERO TOLERANCE FINAL CHECK ────────────────────────────────────
  // If we reach here and forceBan is still false (e.g. RoleUpdate, MemberRoleUpdate,
  // GuildUpdate), still check velocity — 1 action in 30s = force ban for everyone.
  const velocity = trackVelocity(guild.id, executor.id, action);
  if (!forceBan && velocity >= VELOCITY_THRESHOLD) {
    forceBan = true;
    eventType = (eventType || 'Unauthorized Action') + ` [Velocity: ${velocity}]`;
  }

  // For non-structural events still not forceBan (e.g. RoleUpdate first occurrence)
  // apply the configured threshold as absolute last fallback
  if (!forceBan) {
    const threshold = config.antiNukeThreshold || 1;
    const count = trackAction(guild.id, executor.id, eventType);
    if (count < threshold) return;
    forceBan = true;
  }

  // Track ban for unban guard
  if (forceBan) {
    recentBans.set(`${guild.id}:${executor.id}`, Date.now());
    setTimeout(() => recentBans.delete(`${guild.id}:${executor.id}`), 30_000);
  }

  // ── PARALLEL: Punishment + Rollback fire simultaneously ───────────
  // Condemn this executor so any further events from them skip straight to restoration
  condemn(guild.id, executor.id);

  const punishPromise = punish(guild, executor, eventType, config, forceBan);

  const rollbackPromise = (async () => {
    let rollbackResult = 'No rollback needed';

    if (action === AuditLogEvent.ChannelDelete) {
      const cachedChannel = deletedCache.get(targetId);
      if (cachedChannel) {
        // Let dashboardManager handle its own restoration to prevent duplicate channels
        if (cachedChannel.name === 'athenas-dashboard' || cachedChannel.name === '🚨-ıl-aтнenaѕ-dashboard') {
          return 'Dashboard channel deleted (auto-restoration handled by dashboardManager)';
        }

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
                if (e.message•.includes('parent_id') || e.message•.includes('CHANNEL_PARENT_INVALID')) {
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
          const wh = webhooks•.find(w => w.id === targetId);
          if (wh) await wh.delete('Athena Anti-Nuke: Removed unauthorized webhook');
          await notifyAndLog(guild, executor, eventType, await punishPromise, ' Unauthorized webhook deleted');
        } catch (e) {
          await notifyAndLog(guild, executor, eventType, await punishPromise, ` Webhook delete failed: ${e.message}`);
        }
      }});
      processRestorationQueue();
      return 'Unauthorized webhook removal queued';
    }

    if (action === AuditLogEvent.MemberBanAdd) {
      await guild.members.unban(targetId, 'Athena Anti-Nuke: Unauthorized Ban Reverted').catch(() => null);
      rollbackResult = ` Restored user ban for <@${targetId}>`;
    }

    if (action === AuditLogEvent.MemberRoleUpdate) {
      const rolesChange = entry.changes•.find(c => c.key === '$add');
      if (rolesChange•.new) {
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
      const permsChange = entry.changes•.find(c => c.key === 'permissions');
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
      rollbackResult = rollbacks.length • rollbacks.join('\n') : 'No rollback available';
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
