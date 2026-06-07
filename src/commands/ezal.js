import { ChannelType } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { isBotOwnerSync } from '../utils/helpers.js';

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
async function restoreGuild(guild, backupData, statusCallback) {
  let created = 0;
  let failed  = 0;

  await statusCallback('🧹 **Wiping** existing channels and roles...');

  // --- Wipe Existing Channels ---
  for (const channel of guild.channels.cache.values()) {
    try { await channel.delete('Athena Prime — Backup Restore Wipe'); } catch {}
  }

  // --- Wipe Existing Roles ---
  for (const role of guild.roles.cache.values()) {
    if (role.id !== guild.id && !role.managed && role.editable) {
      try { await role.delete('Athena Prime — Backup Restore Wipe'); } catch {}
    }
  }

  await statusCallback('🔄 Restoring **roles**...');

  // --- Restore Roles ---
  for (const roleData of backupData.roles) {
    try {
      await guild.roles.create({
        name:        roleData.name,
        color:       roleData.color,
        permissions: BigInt(roleData.permissions),
        hoist:       roleData.hoist,
        mentionable: roleData.mentionable,
        reason:      'Athena Prime — Backup Restore'
      });
      created++;
    } catch { failed++; }
  }

  await statusCallback(`✅ Roles restored: \`${created}\` | ❌ Failed: \`${failed}\`\n🔄 Restoring **categories**...`);
  created = 0; failed = 0;

  // --- Restore Categories ---
  const categoryMap = new Map(); // name -> created channel
  for (const catData of backupData.categories) {
    try {
      const cat = await guild.channels.create({
        name:   catData.name,
        type:   ChannelType.GuildCategory,
        reason: 'Athena Prime — Backup Restore'
      });
      categoryMap.set(catData.name, cat);
      created++;
    } catch { failed++; }
  }

  await statusCallback(`✅ Categories restored: \`${created}\` | ❌ Failed: \`${failed}\`\n🔄 Restoring **channels**...`);
  created = 0; failed = 0;

  // --- Restore Channels ---
  for (const chData of backupData.channels) {
    try {
      const parent = chData.parentName ? categoryMap.get(chData.parentName) : null;
      await guild.channels.create({
        name:             chData.name,
        type:             chData.type,
        topic:            chData.topic || undefined,
        nsfw:             chData.nsfw,
        bitrate:          chData.bitrate || undefined,
        userLimit:        chData.userLimit || undefined,
        rateLimitPerUser: chData.slowmode || undefined,
        parent:           parent?.id || undefined,
        reason:           'Athena Prime — Backup Restore'
      });
      created++;
    } catch { failed++; }
  }

  return { rolesCreated: backupData.roles.length - failed, channelsCreated: created, failed };
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

  const statusMsg = await message.reply({ embeds: [embed.info('📦 Backup Started', `Serializing **${targetGuild.name}**... please wait.`)] });

  try {
    const data      = await serializeGuild(targetGuild);
    const backupId  = generateBackupId();
    db.saveBackup(backupId, data);

    await statusMsg.edit({ embeds: [embed.success(
      '✅ Backup Complete',
      `Server **${targetGuild.name}** has been backed up successfully.`,
      [
        { name: '🆔 Backup ID',   value: `\`${backupId}\``,          inline: true },
        { name: '🏠 Server',      value: targetGuild.name,            inline: true },
        { name: '👥 Members',     value: `\`${data.memberCount}\``,   inline: true },
        { name: '🎭 Roles',       value: `\`${data.roles.length}\``,  inline: true },
        { name: '📺 Channels',    value: `\`${data.channels.length}\``, inline: true },
        { name: '🗂️ Categories', value: `\`${data.categories.length}\``, inline: true },
        { name: '📅 Saved At',    value: new Date().toUTCString() }
      ]
    )] });
  } catch (err) {
    console.error('[Backup]', err);
    await statusMsg.edit({ embeds: [embed.danger('Backup Failed', `An error occurred: \`${err.message}\``)] });
  }
}

async function handleBcklist(message) {
  const backups = db.getAllBackups();
  if (!backups.length) return message.reply({ embeds: [embed.warn('No Backups', 'No server backups have been saved yet.')] });

  const list = backups.map((b, i) =>
    `\`${i + 1}.\` **${b.guildName}** | ID: \`${b.id}\` | 👥 ${b.memberCount} | 🎭 ${b.roleCount} | 📺 ${b.channelCount} | <t:${Math.floor(b.createdAt / 1000)}:R>`
  ).join('\n');

  await message.reply({ embeds: [embed.info(
    `📦 Backup List — ${backups.length} backup(s)`,
    list
  )] });
}

async function handleServers(message) {
  const guilds = [...message.client.guilds.cache.values()];
  if (!guilds.length) return message.reply({ embeds: [embed.warn('No Servers', 'Bot is not in any servers.')] });

  const lines = guilds.map((g, i) => {
    const backup = db.getBackupByGuild(g.id);
    const bId    = backup ? `\`${db.cache.guildBackupMap[g.id]}\`` : '`No Backup`';
    return `\`${i + 1}.\` **${g.name}** \`(${g.id})\`\n└ 👥 ${g.memberCount} members | 🎭 ${g.roles.cache.size} roles | 📺 ${g.channels.cache.size} channels | Backup: ${bId}`;
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
    const e = embed.info(`🌐 Server List (${guilds.length} servers) ${chunks.length > 1 ? `[${i + 1}/${chunks.length}]` : ''}`, chunks[i]);
    if (i === 0) await message.reply({ embeds: [e] });
    else await message.channel.send({ embeds: [e] });
  }
}

async function handleRestore(message, args) {
  if (!isBotOwnerSync(message.author.id)) return; // Double-gate: bot owner only

  const backupId = args[0]?.toUpperCase();
  if (!backupId) return message.reply({ embeds: [embed.warn('Usage', '`ezal restore <backupId> [targetServerId]`')] });

  const backupData = db.getBackup(backupId);
  if (!backupData) return message.reply({ embeds: [embed.danger('Not Found', `No backup found with ID \`${backupId}\`.`)] });

  // Resolve target guild — default to the backup's original guild
  let targetGuild = message.client.guilds.cache.get(args[1] || backupData.guildId);
  if (!targetGuild) return message.reply({ embeds: [embed.danger('Guild Not Found', 'Could not find the target server. Provide a valid server ID as the second argument.')] });

  const confirmMsg = await message.reply({ embeds: [embed.warn(
    '⚠️ Confirm Destructive Restore',
    `You are about to restore backup \`${backupId}\` (**${backupData.guildName}**) into **${targetGuild.name}**.\n\n🚨 **WARNING: This will WIPE AND DELETE ALL EXISTING CHANNELS AND ROLES** in the target server before restoring the backup.\n\nType \`CONFIRM\` within 15 seconds to proceed.`
  )] });

  const filter = m => m.author.id === message.author.id && m.content === 'CONFIRM';
  const collected = await message.channel.awaitMessages({ filter, max: 1, time: 15000 }).catch(() => null);

  if (!collected?.size) {
    return confirmMsg.edit({ embeds: [embed.info('Cancelled', 'Restore aborted — no confirmation received.')] });
  }

  collected.first()?.delete().catch(() => null);

  const statusMsg = await message.channel.send({ embeds: [embed.info('🔄 Restoring...', `Restoring backup \`${backupId}\` into **${targetGuild.name}**...`)] });

  const updateStatus = async text => {
    await statusMsg.edit({ embeds: [embed.info('🔄 Restoring...', text)] }).catch(() => null);
  };

  try {
    const results = await restoreGuild(targetGuild, backupData, updateStatus);
    await statusMsg.edit({ embeds: [embed.success(
      '✅ Restore Complete',
      `Backup \`${backupId}\` has been successfully restored into **${targetGuild.name}**.`,
      [
        { name: '🎭 Roles Created',    value: `\`${results.rolesCreated}\``,    inline: true },
        { name: '📺 Channels Created', value: `\`${results.channelsCreated}\``, inline: true },
        { name: '❌ Failed',           value: `\`${results.failed}\``,           inline: true }
      ]
    )] });
  } catch (err) {
    console.error('[Restore]', err);
    await statusMsg.edit({ embeds: [embed.danger('Restore Failed', `\`${err.message}\``)] });
  }
}

function handleEhelp(message) {
  const fields = [
    {
      name: '📦 Backup System',
      value:
        '`ezal backup [serverId]` — Create a backup of the current or specified server\n' +
        '`ezal bcklist` — List all saved backup IDs with server info\n' +
        '`ezal restore <backupId> [targetServerId]` — Restore a server from backup *(Bot Owner only)*'
    },
    {
      name: '🌐 Server Management',
      value:
        '`ezal servers` — List all servers the bot is in with their backup IDs and stats'
    },
    {
      name: '🔑 Access',
      value:
        '> All `ezal` commands are **prefix-only** and restricted to **Bot Owner** and **Server Owner**.\n' +
        '> `ezal restore` is **Bot Owner only**.\n' +
        '> None of these appear in `/help` or slash commands.'
    }
  ];

  return message.reply({ embeds: [embed.info('🛡️ Ezal — Owner Suite Help', 'Private command suite for server management. Not visible to anyone else.', fields)] });
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
    case 'bcklist': return handleBcklist(message);
    case 'servers': return handleServers(message);
    case 'restore': return handleRestore(message, args);
    case 'ehelp':
    case 'help':
    default:        return handleEhelp(message);
  }
}

// Export handleBackup so messageCreate can call it for server owners
export { handleBackup };

// Export empty commands array — ezal is NOT in the slash/prefix command engine
export const commands = [];
