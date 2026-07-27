import { ChannelType, PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { isBotOwnerSync, getOrCreateQuarantineRole, isAuthorized } from '../utils/helpers.js';
import { handleEmergency } from './security.js';
import fs from 'fs';
import path from 'path';

// Log helper — writes to restore-log.txt for easy VPS debugging
const RESTORE_LOG = path.resolve('restore-log.txt');
function rlog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(RESTORE_LOG, line + '\n');
}

// ==========================================
// EZAL — Owner-Only Command Suite
// All commands are prefix-only. Not in slash. Not in public help.
// Usage: ezal <command> [args]  OR  just type the command after entering ezal mode
// ==========================================

/** Generate a random 8-char alphanumeric backup ID */
function generateBackupId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/** Serialize a guild into a backup data object */
async function serializeGuild(guild) {
  // Fetch all members and channels to ensure cache is full
  await guild.members.fetch().catch(() => null);
  await guild.channels.fetch().catch(() => null);
  await guild.roles.fetch().catch(() => null);

  // Serialize roles (skip @everyone and managed/bot roles)
  const roles = guild.roles.cache
    .filter(r => r.id !== guild.id && !r.managed)
    .sort((a, b) => a.position - b.position)
    .map(r => ({
      id:            r.id,
      name:          r.name,
      color:         r.color,
      permissions:   r.permissions.bitfield.toString(),
      hoist:         r.hoist,
      mentionable:   r.mentionable,
      position:      r.position
    }));

  // Serialize categories first
  const categories = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      name:     c.name,
      position: c.position,
      permissionOverwrites: c.permissionOverwrites.cache.map(ow => ({
        id:    ow.id,
        type:  ow.type,
        allow: ow.allow.bitfield.toString(),
        deny:  ow.deny.bitfield.toString()
      }))
    }));

  // Serialize all channels
  const channelTypes = [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum
  ];

  const channels = guild.channels.cache
    .filter(c => channelTypes.includes(c.type))
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      name:       c.name,
      type:       c.type,
      position:   c.position,
      topic:      c.topic || null,
      nsfw:       c.nsfw || false,
      bitrate:    c.bitrate || null,
      userLimit:  c.userLimit || null,
      slowmode:   c.rateLimitPerUser || 0,
      parentName: c.parent?.name || null,
      permissionOverwrites: c.permissionOverwrites.cache.map(ow => ({
        id:    ow.id,
        type:  ow.type,
        allow: ow.allow.bitfield.toString(),
        deny:  ow.deny.bitfield.toString()
      }))
    }));

  return {
    guildId:      guild.id,
    guildName:    guild.name,
    guildIcon:    guild.iconURL() || null,
    memberCount:  guild.memberCount,
    roleCount:    guild.roles.cache.size,
    channelCount: guild.channels.cache.size,
    createdAt:    Date.now(),
    roles,
    categories,
    channels
  };
}

/** Restore a guild from backup data */
async function restoreGuild(guild, backupData, statusCallback, excludeChannelId) {
  let created = 0;
  let failed  = 0;
  let lastError = null;
  let consecutiveFailures = 0;

  // Wraps any promise with a timeout — prevents Discord rate limit hangs
  const withTimeout = (promise, ms = 15000, label = '') => {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out after ${ms}ms (${label})`)), ms)
      )
    ]);
  };

  // Clear previous restore log
  fs.writeFileSync(RESTORE_LOG, `=== EZAL RESTORE STARTED ${new Date().toISOString()} ===\n`);
  rlog(`Target guild: ${guild.name} (${guild.id})`);
  rlog(`Backup from: ${backupData.guildName} — Roles: ${backupData.roles.length}, Cats: ${backupData.categories.length}, Channels: ${backupData.channels.length}`);

  await statusCallback('**Wiping** existing channels and roles...');

  // Fetch everything to ensure cache isn't empty
  const channels = await guild.channels.fetch().catch(() => new Map());
  const roles = await guild.roles.fetch().catch(() => new Map());

  // --- Wipe Existing Channels ---
  const channelDeletions = [];
  for (const channel of channels.values()) {
    if (!channel || channel.id === excludeChannelId) continue;
    channelDeletions.push(channel.delete('Athena Prime — Backup Restore Wipe').catch(() => null));
  }
  await Promise.allSettled(channelDeletions);

  // --- Wipe Existing Roles ---
  const { UNBYPASSABLE_ROLE_NAME, FIREWALL_ROLE_NAME } = await import('../utils/antiStrip.js');
  const botMember = await guild.members.fetch(guild.client.user.id).catch(() => null);
  const botRoles = botMember ? botMember.roles.cache : new Map();

  const roleDeletions = [];
  for (const role of roles.values()) {
    if (!role || role.id === guild.id || role.managed || !role.editable || botRoles.has(role.id) || role.name === UNBYPASSABLE_ROLE_NAME || role.name === FIREWALL_ROLE_NAME) continue;
    roleDeletions.push(role.delete('Athena Prime — Backup Restore Wipe').catch(() => null));
  }
  await Promise.allSettled(roleDeletions);

  await statusCallback('Restoring **roles**...');

  // --- Restore Roles ---
  const roleMap = new Map(); // oldName -> newId (fallback) or oldId -> newId
  for (let i = 0; i < backupData.roles.length; i++) {
    const roleData = backupData.roles[i];
    try {
      const newRole = await withTimeout(
        guild.roles.create({ name: roleData.name,
          colors: { primaryColor: roleData.color },
          permissions: BigInt(roleData.permissions),
          hoist:       roleData.hoist,
          mentionable: roleData.mentionable,
          reason:      'Athena Prime — Backup Restore' }),
        12000,
        `role:${roleData.name}`
      );
      if (roleData.id) roleMap.set(roleData.id, newRole.id);
      roleMap.set(roleData.name, newRole.id); // Name fallback
      created++;
      consecutiveFailures = 0;
      rlog(`   Role OK: '${roleData.name}'`);
    } catch (err) { 
      failed++; 
      consecutiveFailures++;
      rlog(`   Role FAILED: '${roleData.name}' → ${err.message} (code ${err.code}, status ${err.status})`);
      if (!lastError) lastError = `Role '${roleData.name}': ${err.message} (code ${err.code})`;
      // Only abort if we have MANY consecutive failures (don't break on just a few timeouts)
      if (consecutiveFailures >= 10) {
        rlog(`  � 10 consecutive failures — aborting role loop`);
        break;
      }
    }
    
    // Periodically update status
    if ((i + 1) % 5 === 0) {
      await statusCallback(`Restoring **roles**...  ${created} created |  ${failed} failed (${i + 1}/${backupData.roles.length})`);
    }
    rlog(`  Role ${i + 1}/${backupData.roles.length}: '${roleData.name}'`);
    await new Promise(r => setTimeout(r, 700)); // 700ms — tested safe, avoids rate limits
  }

  // Helper to map overwrites
  const mapOverwrites = (overwrites) => {
    if (!overwrites) return undefined;
    return overwrites.map(ow => {
      let targetId = ow.id;
      if (ow.type === 0) {
        if (ow.id === backupData.guildId) targetId = guild.id; // Map @everyone role
        else targetId = roleMap.get(ow.id) || ow.id;
      }
      return {
        id: targetId,
        type: ow.type,
        allow: BigInt(ow.allow),
        deny: BigInt(ow.deny)
      };
    }).filter(ow => guild.roles.cache.has(ow.id) || ow.id === guild.id || ow.type === 1);
  };

  await statusCallback(`Roles restored: \`${created}\` | Failed: \`${failed}\`\nRestoring **categories**...`);
  created = 0; failed = 0;

  // --- Restore Categories ---
  const categoryMap = new Map(); // name -> created channel
  for (let i = 0; i < backupData.categories.length; i++) {
    const catData = backupData.categories[i];
    try {
      const cat = await withTimeout(
        guild.channels.create({
          name:   catData.name,
          type:   ChannelType.GuildCategory,
          permissionOverwrites: mapOverwrites(catData.permissionOverwrites),
          reason: 'Athena Prime — Backup Restore'
        }),
        12000,
        `category:${catData.name}`
      );
      categoryMap.set(catData.name, cat);
      created++;
      consecutiveFailures = 0;
      rlog(`   Category OK: '${catData.name}'`);
    } catch (err) { 
      failed++;
      consecutiveFailures++;
      rlog(`   Category FAILED: '${catData.name}' → ${err.message} (code ${err.code})`);
      if (!lastError) lastError = `Category '${catData.name}': ${err.message} (code ${err.code})`;
      if (consecutiveFailures >= 5) {
        rlog(`  � 5 consecutive failures — aborting category loop`);
        break;
      }
    }
    
    if ((i + 1) % 5 === 0) {
      await statusCallback(`Restoring **categories**... (${i + 1}/${backupData.categories.length})`);
    }
    rlog(`  Cat ${i + 1}/${backupData.categories.length}: '${catData.name}'`);
    await new Promise(r => setTimeout(r, 900));
  }

  await statusCallback(`Categories restored: \`${created}\` | Failed: \`${failed}\`\nRestoring **channels**...`);
  created = 0; failed = 0;

  // --- Restore Channels ---
  for (let i = 0; i < backupData.channels.length; i++) {
    const chData = backupData.channels[i];
    try {
      const parent = chData.parentName ? categoryMap.get(chData.parentName) : null;
      await withTimeout(
        guild.channels.create({
          name:             chData.name,
          type:             chData.type,
          topic:            chData.topic || undefined,
          nsfw:             chData.nsfw,
          bitrate:          chData.bitrate || undefined,
          userLimit:        chData.userLimit || undefined,
          rateLimitPerUser: chData.slowmode || undefined,
          parent:           parent?.id || undefined,
          permissionOverwrites: mapOverwrites(chData.permissionOverwrites),
          reason:           'Athena Prime — Backup Restore'
        }),
        12000,
        `channel:${chData.name}`
      );
      created++;
      consecutiveFailures = 0;
      rlog(`   Channel OK: '${chData.name}'`);
    } catch (err) { 
      failed++;
      consecutiveFailures++;
      rlog(`   Channel FAILED: '${chData.name}' → ${err.message} (code ${err.code})`);
      if (!lastError) lastError = `Channel '${chData.name}': ${err.message} (code ${err.code})`;
      if (consecutiveFailures >= 5) {
        rlog(`  � 5 consecutive failures — aborting channel loop`);
        break;
      }
    }
    
    if ((i + 1) % 5 === 0) {
      await statusCallback(`Restoring **channels**... (${i + 1}/${backupData.channels.length})`);
    }
    rlog(`  Ch ${i + 1}/${backupData.channels.length}: '${chData.name}'`);
    await new Promise(r => setTimeout(r, 900));
  }

  return { rolesCreated: backupData.roles.length - failed, channelsCreated: created, failed, lastError };
}

// ==========================================
// COMMAND HANDLERS
// ==========================================

async function handleBackup(message, args) {
  // Resolve target guild
  let targetGuild = message.guild;
  if (args[0] && /^\d{17,20}$/.test(args[0])) {
    const resolved = message.client.guilds.cache.get(args[0]);
    if (!resolved) return message.reply({ embeds: [embed.danger('Not Found', `No server with ID \`${args[0]}\` found in bot's guild list.`)] });
    targetGuild = resolved;
  }
  if (!targetGuild) return message.reply({ embeds: [embed.warn('No Guild', 'Run this inside a server or provide a server ID.')] });

  const statusMsg = await message.reply({ embeds: [embed.info('Backup Started', `Serializing **${targetGuild.name}**... please wait.`)] });

  try {
    const data      = await serializeGuild(targetGuild);
    const backupId  = generateBackupId();
    db.saveBackup(backupId, data);

    await statusMsg.edit({ embeds: [embed.success(
      'Backup Complete',
      `Server **${targetGuild.name}** has been backed up successfully.`,
      [
        { name: 'Backup ID',   value: `\`${backupId}\``,          inline: true },
        { name: 'Server',      value: targetGuild.name,            inline: true },
        { name: 'Members',     value: `\`${data.memberCount}\``,   inline: true },
        { name: 'Roles',       value: `\`${data.roles.length}\``,  inline: true },
        { name: 'Channels',    value: `\`${data.channels.length}\``, inline: true },
        { name: 'Categories',  value: `\`${data.categories.length}\``, inline: true },
        { name: 'Saved At',    value: new Date().toUTCString() }
      ]
    )] });
  } catch (err) {
    console.error('[Backup]', err);
    await statusMsg.edit({ embeds: [embed.danger('Backup Failed', `An error occurred: \`${err.message}\``)] });
  }
}

async function handleBackupAll(message) {
  const guilds = Array.from(message.client.guilds.cache.values());
  if (!guilds.length) return message.reply({ embeds: [embed.warn('No Servers', 'The bot is not in any servers.')] });

  let successCount = 0;
  let failCount = 0;

  const statusMsg = await message.reply({ embeds: [embed.info('Mass Backup Initiated', `Backing up **${guilds.length}** servers. This will be as quick as possible.\n\n**Progress:** 0 / ${guilds.length} Servers`)] }).catch(() => null);

  for (let i = 0; i < guilds.length; i++) {
    const targetGuild = guilds[i];
    try {
      const backupData = await serializeGuild(targetGuild);
      const backupId = generateBackupId();
      db.saveBackup(backupId, backupData);
      successCount++;
    } catch (err) {
      console.error(`Failed to backup guild ${targetGuild.id}:`, err);
      failCount++;
    }

    // Update status every 5 servers to prevent rate limiting on edits
    if (statusMsg && (i + 1) % 5 === 0) {
      await statusMsg.edit({ embeds: [embed.info('Mass Backup In Progress', `Backing up **${guilds.length}** servers...\n\n**Progress:** ${i + 1} / ${guilds.length} Servers\n**Success:** ${successCount} | **Failed:** ${failCount}`)] }).catch(() => null);
    }
  }

  if (statusMsg) {
    await statusMsg.edit({ embeds: [embed.success('Mass Backup Complete', `Successfully backed up all servers.\n\n**Total Servers:** ${guilds.length}\n**Success:** ${successCount}\n**Failed:** ${failCount}`)] }).catch(() => null);
  }
}

async function handleBcklist(message) {
  const backups = db.getAllBackups();
  if (!backups.length) return message.reply({ embeds: [embed.warn('No Backups', 'No server backups have been saved yet.')] });

  const list = backups.map((b, i) =>
    `\`${i + 1}.\` **${b.guildName}** | ID: \`${b.id}\` |  ${b.memberCount} |  ${b.roleCount} |  ${b.channelCount} | <t:${Math.floor(b.createdAt / 1000)}:R>`
  ).join('\n');

  await message.reply({ embeds: [embed.info(
    `Backup List — ${backups.length} backup(s)`,
    list
  )] });
}

async function handleServers(message) {
  const guilds = [...message.client.guilds.cache.values()];
  if (!guilds.length) return message.reply({ embeds: [embed.warn('No Servers', 'Bot is not in any servers.')] });

  const lines = guilds.map((g, i) => {
    const backup = db.getBackupByGuild(g.id);
    const bId    = backup ? `\`${db.cache.guildBackupMap[g.id]}\`` : '`No Backup`';
    return `\`${i + 1}.\` **${g.name}** \`(${g.id})\`\n└ � ${g.memberCount} members |  ${g.roles.cache.size} roles | � ${g.channels.cache.size} channels | Backup: ${bId}`;
  }).join('\n\n');

  // Split into chunks if too long
  const chunks = [];
  let chunk = '';
  for (const line of lines.split('\n\n')) {
    if ((chunk + '\n\n' + line).length > 3800) {
      chunks.push(chunk);
      chunk = line;
    } else {
      chunk = chunk ? chunk + '\n\n' + line : line;
    }
  }
  if (chunk) chunks.push(chunk);

  for (let i = 0; i < chunks.length; i++) {
    const e = embed.info(`Server List (${guilds.length} servers) ${chunks.length > 1 ? `[${i + 1}/${chunks.length}]` : ''}`, chunks[i]);
    if (i === 0) await message.reply({ embeds: [e] });
    else await message.channel.send({ embeds: [e] });
  }
}

async function handleRestore(message, args) {
  if (!isBotOwnerSync(message.author.id)) return; // Double-gate: bot owner only

  // Clean the backup ID: remove any backticks or weird formatting the user might have copy-pasted
  const backupId = args[0]?.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!backupId) return message.reply({ embeds: [embed.warn('Usage', '`ezal restore <backupId> [targetServerId]`')] });

  const backupData = db.getBackup(backupId);
  if (!backupData) {
    // Help the user if they're having issues finding the ID
    const backups = db.getAllBackups();
    const available = backups.length ? backups.map(b => `\`${b.id}\` (${b.guildName})`).join(', ') : 'None saved in database.';
    return message.reply({ embeds: [embed.danger('Not Found', `No backup found with ID \`${backupId}\`.\n\n**Available Backups in DB:**\n${available}`)] });
  }

  // Resolve target guild — default to the backup's original guild
  let targetGuild = message.client.guilds.cache.get(args[1] || backupData.guildId);
  if (!targetGuild) return message.reply({ embeds: [embed.danger('Guild Not Found', 'Could not find the target server. Provide a valid server ID as the second argument.')] });

  const confirmMsg = await message.reply({ embeds: [embed.warn(
    'Confirm Destructive Restore',
    `You are about to restore backup \`${backupId}\` (**${backupData.guildName}**) into **${targetGuild.name}**.\n\n**WARNING: This will WIPE AND DELETE ALL EXISTING CHANNELS AND ROLES** in the target server before restoring the backup.\n\nType \`CONFIRM\` within 15 seconds to proceed.`
  )] });

  // IMPORTANT: filter must include channel.id so stale collectors from other commands
  // don't fire this restore with wrong data
  const filter = m => m.author.id === message.author.id && m.content.trim().toUpperCase() === 'CONFIRM' && m.channel.id === message.channel.id;
  const collected = await message.channel.awaitMessages({ filter, max: 1, time: 15000 }).catch(() => null);

  if (!collected?.size) {
    return confirmMsg.edit({ embeds: [embed.info('Cancelled', 'Restore aborted — no confirmation received.')] });
  }

  collected.first()?.delete().catch(() => null);

  // --- Pre-flight: Check bot has permissions in the target guild ---
  const botMemberPF = await targetGuild.members.fetch(message.client.user.id).catch(() => null);
  const hasPerms = botMemberPF?.permissions.has(8n) ||   // Administrator
                   botMemberPF?.permissions.has(16n);    // Manage Channels
  if (!hasPerms) {
    return message.channel.send({ embeds: [embed.danger(
      'Missing Permissions',
      `Athena Prime does **not** have **Administrator** (or Manage Channels) in **${targetGuild.name}**.\n\nGive the bot Administrator in that server, then retry the restore.`
    )] });
  }

  const statusMsg = await message.channel.send({ embeds: [embed.info('Restoring...', `Restoring backup \`${backupId}\` into **${targetGuild.name}**...`)] });

  const updateStatus = async text => {
    await statusMsg.edit({ embeds: [embed.info('Restoring...', text)] }).catch(() => null);
  };

  try {
    const results = await restoreGuild(targetGuild, backupData, updateStatus, message.channel.id);
    await statusMsg.edit({ embeds: [embed.success(
      'Restore Complete',
      `Backup \`${backupId}\` has been restored into **${targetGuild.name}**.\n\n${results.lastError ? `**First Error Encountered:**\n\`${results.lastError}\`` : ''}`,
      [
        { name: 'Roles Created',    value: `\`${results.rolesCreated}\``,    inline: true },
        { name: 'Channels Created', value: `\`${results.channelsCreated}\``, inline: true },
        { name: 'Failed',           value: `\`${results.failed}\``,           inline: true }
      ]
    )] });
  } catch (err) {
    console.error('[Restore]', err);
    await statusMsg.edit({ embeds: [embed.danger('Restore Failed', `\`${err.message}\``)] });
  }
}

async function handleRemoteEmergency(message, args) {
  if (!isBotOwnerSync(message.author.id)) return;

  const guildId = args[0];
  const action = args[1]?.toLowerCase() === 'end' ? 'end' : 'mode';

  if (!guildId) return message.reply({ embeds: [embed.warn('Usage', '`ezal emergency <serverId> [mode|end]`')] });

  const targetGuild = message.client.guilds.cache.get(guildId);
  if (!targetGuild) return message.reply({ embeds: [embed.danger('Guild Not Found', `Could not find the server ID \`${guildId}\` in the bot's cache.`)] });

  let statusMsg = null;
  const updateProgress = async (embedData) => {
    if (!statusMsg) statusMsg = await message.reply({ embeds: [embedData] }).catch(() => null);
    else await statusMsg.edit({ embeds: [embedData] }).catch(() => null);
  };

  const mockModerator = {
    id: message.author.id,
    user: message.author
  };

  const result = await handleEmergency(targetGuild, mockModerator, action, updateProgress);
  if (statusMsg) await statusMsg.edit({ embeds: [result.embed] }).catch(() => null);
  else await message.reply({ embeds: [result.embed] });
}

async function handleEhelp(message) {
  const fields = [
    {
      name: 'Backup System',
      value:
        '`ezal backup [serverId]` — Create a backup of the current or specified server\n' +
        '`ezal backupall` — Mass backup all servers *(Bot Owner only)*\n' +
        '`ezal bcklist` — List all saved backup IDs with server info\n' +
        '`ezal restore <backupId> [targetServerId]` — Restore a server from backup *(Bot Owner only)*'
    },
    {
      name: 'Server Management',
      value:
        '`ezal servers` — List all servers the bot is in with their backup IDs and stats\n' +
        '`ezal emergency <serverId> [mode|end]` — Trigger emergency mode remotely\n' +
        '`ezal banserver <serverId>` — Ban a server and force leave instantly\n' +
        '`ezal unbanserver <serverId>` — Unban a server to allow invites\n' +
        '`ezal restoresetup <serverId>` — Dynamically restore JTC, Welcome, Leave, Accent, and Quarantine setups'
    },
    {
      name: 'Access',
      value:
        '> All `ezal` commands are **prefix-only** and restricted to **Bot Owner** and **Server Owner**.\n' +
        '> `ezal restore` and `ezal backupall` are **Bot Owner only**.\n' +
        '> None of these appear in `/help` or slash commands.'
    }
  ];

  const sent = await message.reply({ embeds: [embed.info('Ezal — Owner Suite Help', 'Private command suite for server management. Not visible to anyone else.', fields)] });
  setTimeout(() => {
    sent.delete().catch(() => null);
    message.delete().catch(() => null);
  }, 60000);
  return sent;
}

// ==========================================
// MAIN EZAL ROUTER — called from messageCreate.js
// Bot Owner ONLY — server owners use standalone `backup` command
// ==========================================
export async function handleEzal(message) {
  if (!isBotOwnerSync(message.author.id)) return; // Silent — bot owner only

  const parts = message.content.trim().split(/ +/);
  const sub   = (parts[1] || 'help').toLowerCase();
  const args  = parts.slice(2);

  switch (sub) {
    case 'backup':  return handleBackup(message, args);
    case 'backupall': return handleBackupAll(message);
    case 'bcklist': return handleBcklist(message);
    case 'servers': return handleServers(message);
    case 'restore': return handleRestore(message, args);
    case 'emergency': return handleRemoteEmergency(message, args);
    case 'banserver': return handleBanServer(message, args);
    case 'unbanserver': return handleUnbanServer(message, args);
    case 'restoresetup': return handleRestoreSetup(message, args);
    case 'fixjtc':  return handleFixJtc(message);
    case 'givemerole': return handleGiveMeRole(message, args);
    case 'takemyrole': return handleTakeMyRole(message, args);
    case 'ehelp':
    case 'help':
    default:        return handleEhelp(message);
  }
}

// Export handleBackup so messageCreate can call it for server owners
export { handleBackup };

// ==========================================
// ROLE MANAGEMENT
// ==========================================
async function handleGiveMeRole(message, args) {
  const roleId = args[0];
  if (!roleId) return message.reply({ embeds: [embed.warn('Missing Argument', 'Please provide the Role ID.')] });
  
  const user = message.author || message.user;

  let targetGuild = null;
  let targetRole = null;

  for (const guild of message.client.guilds.cache.values()) {
    const role = guild.roles.cache.get(roleId);
    if (role) {
      targetGuild = guild;
      targetRole = role;
      break;
    }
  }

  if (!targetRole) return message.reply({ embeds: [embed.danger('Not Found', 'Could not find a role with that ID in any of my servers.')] });

  try {
    const targetMember = await targetGuild.members.fetch(user.id).catch(() => null);
    if (!targetMember) {
      return message.reply({ embeds: [embed.danger('Error', `Found the role in **${targetGuild.name}**, but you are not in that server!`)] });
    }

    await targetMember.roles.add(targetRole);
    await message.reply({ embeds: [embed.success('Role Granted', `Successfully granted you the **${targetRole.name}** role in **${targetGuild.name}**.`)] });
  } catch (err) {
    await message.reply({ embeds: [embed.danger('Error', `Failed to grant role in **${targetGuild.name}**: ${err.message}`)] });
  }
}

async function handleTakeMyRole(message, args) {
  const roleId = args[0];
  if (!roleId) return message.reply({ embeds: [embed.warn('Missing Argument', 'Please provide the Role ID.')] });
  
  const user = message.author || message.user;

  let targetGuild = null;
  let targetRole = null;

  for (const guild of message.client.guilds.cache.values()) {
    const role = guild.roles.cache.get(roleId);
    if (role) {
      targetGuild = guild;
      targetRole = role;
      break;
    }
  }

  if (!targetRole) return message.reply({ embeds: [embed.danger('Not Found', 'Could not find a role with that ID in any of my servers.')] });

  try {
    const targetMember = await targetGuild.members.fetch(user.id).catch(() => null);
    if (!targetMember) {
      return message.reply({ embeds: [embed.danger('Error', `Found the role in **${targetGuild.name}**, but you are not in that server!`)] });
    }

    await targetMember.roles.remove(targetRole);
    await message.reply({ embeds: [embed.success('Role Removed', `Successfully removed the **${targetRole.name}** role from you in **${targetGuild.name}**.`)] });
  } catch (err) {
    await message.reply({ embeds: [embed.danger('Error', `Failed to remove role in **${targetGuild.name}**: ${err.message}`)] });
  }
}

// ==========================================
// FIXJTC — Updates JTC panels globally to apply current accent color
// ==========================================
async function handleFixJtc(message) {
  const sent = await message.reply('Starting global JTC panel sync. This might take a moment...');
  let successCount = 0;
  let failCount = 0;

  try {
    const { syncPanel, buildSharedPanel } = await import('./jtc.js');
    const { default: db } = await import('../database.js');
    
    for (const guild of message.client.guilds.cache.values()) {
      try {
        let success = await syncPanel(guild);
        
        // If standard sync failed (missing DB entry), do a deep search
        if (!success) {
          const channels = guild.channels.cache.filter(c => c.type === 0); // GuildText
          for (const channel of channels.values()) {
            if (!channel.viewable) continue;
            const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
            if (!messages) continue;

            const panels = Array.from(messages.filter(m => m.author.id === message.client.user.id && (
              m.embeds[0]?.title?.includes('Voice Channel Control Panel') ||
              m.components?.[0]?.components?.[0]?.content?.includes('Voice Channel Control Panel') ||
              m.components?.[0]?.components?.[0]?.components?.[0]?.content?.includes('Voice Channel Control Panel')
            )).values());

            if (panels.length > 0) {
              panels.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
              const truePanel = panels[0];
              
              const newPanel = buildSharedPanel(guild);
              newPanel.embeds = [];
              newPanel.content = '';
              await truePanel.edit(newPanel).catch(() => null);

              // Save to database for future fast-syncs
              const cfg = db.getJtcConfig(guild.id);
              db.setJtcConfig(guild.id, cfg?.lobbyChannelId, cfg?.categoryId, channel.id);
              db.setPanelMessageId(guild.id, truePanel.id);
              
              success = true;
              break;
            }
          }
        }
        
        if (success) successCount++;
        else failCount++;
      } catch (e) {
        failCount++;
      }
    }
    
    await sent.edit(`<:emoji_16:1521464002046328944> **Global JTC Sync Complete!**\nUpdated \`${successCount}\` panels.\nFailed/Skipped (No JTC Setup): \`${failCount}\` servers.`);
  } catch (e) {
    await sent.edit(`Error during sync: \`${e.message}\``);
  }
}

// ==========================================
// SERVER BANNING & SETUP RESTORATION
// ==========================================
async function handleBanServer(message, args) {
  const guildId = args[0];
  if (!guildId) return message.reply('Provide a server ID to ban.');
  if (db.isServerBanned(guildId)) return message.reply('Server is already banned.');
  
  db.addBannedServer(guildId);
  const targetGuild = message.client.guilds.cache.get(guildId);
  if (targetGuild) {
    try { await targetGuild.leave(); } catch(e) {}
  }
  return message.reply(`<:emoji_16:1521464002046328944> **Server Banned:** \`${guildId}\`. The bot has left and cannot be added back.`);
}

async function handleUnbanServer(message, args) {
  const guildId = args[0];
  if (!guildId) return message.reply('Provide a server ID to unban.');
  if (!db.isServerBanned(guildId)) return message.reply('Server is not banned.');
  
  db.removeBannedServer(guildId);
  return message.reply(`<:emoji_16:1521464002046328944> **Server Unbanned:** \`${guildId}\`. The bot can now be invited again.`);
}

async function handleRestoreSetup(message, args) {
  const guildId = args[0];
  if (!guildId) return message.reply('Provide a server ID to restore setup.');
  const guild = message.client.guilds.cache.get(guildId);
  if (!guild) return message.reply('I am not currently in that server. Unban it and invite me first!');

  const sent = await message.reply('Starting dynamic setup restoration...');
  const config = db.getGuildConfig(guildId);

  try {
    // 1. Restore Quarantine Role
    await getOrCreateQuarantineRole(guild);
  } catch(e) {}

  // 2. Restore JTC
  try {
    const jtcConfig = db.cache.jtc[guildId];
    if (jtcConfig && jtcConfig.lobbyChannelId) {
      let lobby = guild.channels.cache.get(jtcConfig.lobbyChannelId);
      if (!lobby) {
        const cat = guild.channels.cache.get(jtcConfig.categoryId) || await guild.channels.create({ name: '➕ Voice Rooms', type: ChannelType.GuildCategory });
        lobby = await guild.channels.create({ name: '➕ Join to Create', type: ChannelType.GuildVoice, parent: cat.id });
        db.cache.jtc[guildId] = { lobbyChannelId: lobby.id, categoryId: cat.id };
        db.save();
        if (jtcConfig.panelChannelId) {
          const pc = guild.channels.cache.get(jtcConfig.panelChannelId);
          if (!pc) {
            const newPc = await guild.channels.create({ name: 'jtc-panel', type: ChannelType.GuildText });
            db.cache.jtc[guildId].panelChannelId = newPc.id;
            db.save();
          }
        }
        const { syncPanel } = await import('./jtc.js');
        await syncPanel(guild);
      }
    }
  } catch(e) {}

  // 3. Restore Accent
  try {
    const aRole = config.accentManagerRoleId;
    if (aRole) {
      let realRole = guild.roles.cache.get(aRole);
      if (!realRole) {
        realRole = await guild.roles.create({ name: 'Accent Manager', colors: { primaryColor: config.accentColor || '#ff0000' } });
        db.updateGuildConfig(guildId, { accentManagerRoleId: realRole.id });
      }
    }
  } catch(e) {}

  // 4. Restore Welcome/Leave
  try {
    if (config.welcomeChannelId) {
      let wCh = guild.channels.cache.get(config.welcomeChannelId);
      if (!wCh) {
        wCh = await guild.channels.create({ name: 'welcome', type: ChannelType.GuildText });
        db.updateGuildConfig(guildId, { welcomeChannelId: wCh.id });
      }
    }
    if (config.leaveChannelId) {
      let lCh = guild.channels.cache.get(config.leaveChannelId);
      if (!lCh) {
        lCh = await guild.channels.create({ name: 'leave', type: ChannelType.GuildText });
        db.updateGuildConfig(guildId, { leaveChannelId: lCh.id });
      }
    }
  } catch(e) {}

  await sent.edit(`<:emoji_16:1521464002046328944> **Setup Restoration Complete!** Rebuilt JTC, Quarantine, Accent, and Welcome/Leave perfectly.`);
}

// Export commands so they can be used directly with the standard prefix
export const commands = [
  {
    name: 'givemerole',
    description: 'Grant yourself a role by ID (Authorized Owners only)',
    type: 1, // CHAT_INPUT
    default_member_permissions: String(PermissionFlagsBits.Administrator),
    options: [
      {
        name: 'role',
        description: 'The role to give yourself',
        type: 8, // ROLE
        required: true
      }
    ],
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) {
        return message.reply({ embeds: [embed.danger('Access Denied', 'Only the Bot Owner can use this.')] });
      }
      return handleGiveMeRole(message, args);
    },
    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ embeds: [embed.danger('Access Denied', 'Only the Bot Owner can use this.')] });
      }
      const roleId = interaction.options.getRole('role')?.id;
      return handleGiveMeRole(interaction, [roleId]);
    }
  },
  {
    name: 'takemyrole',
    description: 'Remove a role from yourself by ID (Authorized Owners only)',
    type: 1,
    default_member_permissions: String(PermissionFlagsBits.Administrator),
    options: [
      {
        name: 'role',
        description: 'The role to remove from yourself',
        type: 8,
        required: true
      }
    ],
    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) {
        return message.reply({ embeds: [embed.danger('Access Denied', 'Only the Bot Owner can use this.')] });
      }
      return handleTakeMyRole(message, args);
    },
    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply({ embeds: [embed.danger('Access Denied', 'Only the Bot Owner can use this.')] });
      }
      const roleId = interaction.options.getRole('role')?.id;
      return handleTakeMyRole(interaction, [roleId]);
    }
  }
];
