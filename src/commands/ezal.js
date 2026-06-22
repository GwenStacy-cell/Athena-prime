import { ChannelType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { isBotOwnerSync } from '../utils/helpers.js';
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
  const botMember = await guild.members.fetch(guild.client.user.id).catch(() => null);
  const botRoles = botMember ? botMember.roles.cache : new Map();

  const roleDeletions = [];
  for (const role of roles.values()) {
    if (!role || role.id === guild.id || role.managed || !role.editable || botRoles.has(role.id)) continue;
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
        guild.roles.create({
          name:        roleData.name,
          color:       roleData.color,
          permissions: BigInt(roleData.permissions),
          hoist:       roleData.hoist,
          mentionable: roleData.mentionable,
          reason:      'Athena Prime — Backup Restore'
        }),
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

function handleEhelp(message) {
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
        '`ezal emergency <serverId> [mode|end]` — Trigger emergency mode remotely'
    },
    {
      name: 'Access',
      value:
        '> All `ezal` commands are **prefix-only** and restricted to **Bot Owner** and **Server Owner**.\n' +
        '> `ezal restore` and `ezal backupall` are **Bot Owner only**.\n' +
        '> None of these appear in `/help` or slash commands.'
    }
  ];

  return message.reply({ embeds: [embed.info('Ezal — Owner Suite Help', 'Private command suite for server management. Not visible to anyone else.', fields)] });
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
    case 'ehelp':
    case 'help':
    default:        return handleEhelp(message);
  }
}

// Export handleBackup so messageCreate can call it for server owners
export { handleBackup };

// Export empty commands array — ezal is NOT in the slash/prefix command engine
export const commands = [];
