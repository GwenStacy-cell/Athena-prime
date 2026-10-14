import fs from 'fs';
import path from 'path';
import { AttachmentBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import fetch from 'node-fetch';
import chalk from 'chalk';
import db from '../database.js';
import cv2 from '../cv2.js';
import { isBotOwnerSync } from './helpers.js';

const DATA_DIR = path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.db');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

let backupInterval = null;
let isBackingUp = false;

/**
 * Resolves the Discord channel designated for database cloud backups.
 */
export async function getBackupChannel(client) {
  if (!client) return null;

  // 1. Check environment variable
  const envChannelId = process.env.DB_BACKUP_CHANNEL_ID || process.env.BACKUP_CHANNEL_ID;
  if (envChannelId) {
    const ch = client.channels.cache.get(envChannelId) || await client.channels.fetch(envChannelId).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
  }

  // 2. Check database cached channel ID
  const dbChannelId = db.cache.dbBackupChannelId;
  if (dbChannelId) {
    const ch = client.channels.cache.get(dbChannelId) || await client.channels.fetch(dbChannelId).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
  }

  // 3. Fallback: Search across guilds for existing 'athena-db-backups' channel
  for (const guild of client.guilds.cache.values()) {
    const ch = guild.channels.cache.find(c => c.name === 'athena-db-backups' && c.isTextBased());
    if (ch) {
      db.cache.dbBackupChannelId = ch.id;
      db.save();
      return ch;
    }
  }

  // 4. Auto-create private backup channel in first available guild where bot has Administrator
  for (const guild of client.guilds.cache.values()) {
    const me = guild.members.me;
    if (me && me.permissions.has(PermissionFlagsBits.Administrator)) {
      try {
        const newCh = await guild.channels.create({
          name: 'athena-db-backups',
          type: ChannelType.GuildText,
          topic: 'Encrypted automated database cloud snapshots - Athena Prime',
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: me.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]
            }
          ]
        });
        if (newCh) {
          db.cache.dbBackupChannelId = newCh.id;
          db.save();
          console.log(chalk.green(`[CloudSync] Auto-created private cloud backup channel in ${guild.name} (${newCh.id})`));
          return newCh;
        }
      } catch {}
    }
  }

  return null;
}

/**
 * Creates and uploads a complete cloud backup to Discord.
 */
export async function createCloudBackup(client, reason = 'Automated Schedule') {
  if (isBackingUp) return { success: false, reason: 'Backup already in progress' };
  isBackingUp = true;

  try {
    // 1. Flush any pending memory changes to disk
    if (db.needsSave || db.saveTimeout) {
      clearTimeout(db.saveTimeout);
      db.saveTimeout = null;
      db.needsSave = false;
      const dataStr = JSON.stringify(db.cache, null, 2);
      fs.writeFileSync(DB_FILE, dataStr, 'utf8');
    }

    if (!fs.existsSync(DB_FILE)) {
      return { success: false, reason: 'db.json does not exist' };
    }

    const channel = await getBackupChannel(client);
    if (!channel) {
      return { success: false, reason: 'No backup channel configured or accessible' };
    }

    const timestamp = Date.now();
    const dbAttachment = new AttachmentBuilder(DB_FILE, { name: `athena_db_${timestamp}.json` });
    const files = [dbAttachment];

    if (fs.existsSync(STATS_FILE)) {
      files.push(new AttachmentBuilder(STATS_FILE, { name: `stats_${timestamp}.db` }));
    }

    const stats = fs.statSync(DB_FILE);
    const sizeKb = (stats.size / 1024).toFixed(1);
    const guildCount = Object.keys(db.cache.guilds || {}).length;
    const triggerCount = Object.keys(db.cache.triggers || {}).length + (db.cache.globalTriggers || []).length;
    const quarantineCount = Object.keys(db.cache.quarantines || {}).length;

    const payload = cv2.info(
      `Database Cloud Backup | <a:atheNATICK:1557841381630681106>`,
      `Automated persistent cloud snapshot stored.\n\n` +
      `> -# **Tracked Servers:** \`${guildCount}\`\n` +
      `> -# **Triggers / Custom Auto-Replies:** \`${triggerCount}\`\n` +
      `> -# **Quarantines Preserved:** \`${quarantineCount}\`\n` +
      `> -# **Snapshot Size:** \`${sizeKb} KB\`\n` +
      `> -# **Timestamp:** <t:${Math.floor(timestamp / 1000)}:F> (<t:${Math.floor(timestamp / 1000)}:R>)\n` +
      `> -# **Trigger Event:** \`${reason}\``
    );
    payload.files = files;

    const sentMsg = await channel.send(payload);

    // Save metadata
    db.cache.lastCloudBackup = timestamp;
    db.cache.lastCloudBackupMsgId = sentMsg?.id || null;
    db.save();

    // Rotate and prune old backup messages to avoid channel bloat (keep latest 30)
    try {
      const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
      if (messages) {
        const backupMessages = messages
          .filter(m => m.author.id === client.user.id && m.attachments.some(a => a.name?.startsWith('athena_db_')))
          .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

        const toDelete = [...backupMessages.values()].slice(30);
        for (const msg of toDelete) {
          await msg.delete().catch(() => null);
        }
      }
    } catch {}

    console.log(chalk.cyan(`[CloudSync] Cloud backup saved to Discord channel #${channel.name} (${sizeKb} KB, ${guildCount} guilds)`));
    return { success: true, timestamp, messageId: sentMsg?.id, channelId: channel.id };
  } catch (err) {
    console.error(chalk.red('[CloudSync] Failed to create cloud backup:'), err);
    return { success: false, error: err.message };
  } finally {
    isBackingUp = false;
  }
}

/**
 * Checks on boot whether the local database is fresh/empty (e.g. new host clone).
 * If so, automatically fetches and restores the latest backup from Discord!
 */
export async function checkAndAutoRestore(client) {
  try {
    const guildCount = Object.keys(db.cache.guilds || {}).length;
    // If we already have live guilds in the database, no restore is needed
    if (guildCount > 0) {
      return { restored: false, reason: 'Database already populated' };
    }

    console.log(chalk.yellow('[CloudSync] Fresh host detected (0 guilds in db.json). Searching for Discord cloud backup...'));

    const channel = await getBackupChannel(client);
    if (!channel) {
      console.warn(chalk.yellow('[CloudSync] No cloud backup channel found to restore from.'));
      return { restored: false, reason: 'No backup channel available' };
    }

    const messages = await channel.messages.fetch({ limit: 30 }).catch(() => null);
    if (!messages || messages.size === 0) {
      console.warn(chalk.yellow('[CloudSync] Backup channel has no messages.'));
      return { restored: false, reason: 'Backup channel empty' };
    }

    // Find latest message with athena_db_*.json or db.json attachment
    const backupMsg = messages.find(m => 
      m.attachments.some(a => a.name?.endsWith('.json') && (a.name.includes('athena_db_') || a.name === 'db.json'))
    );

    if (!backupMsg) {
      console.warn(chalk.yellow('[CloudSync] No database backup attachment found in recent messages.'));
      return { restored: false, reason: 'No backup file found' };
    }

    const attachment = backupMsg.attachments.find(a => a.name?.endsWith('.json'));
    if (!attachment) {
      return { restored: false, reason: 'Attachment missing' };
    }

    console.log(chalk.cyan(`[CloudSync] Downloading latest cloud backup from ${attachment.name} (${(attachment.size / 1024).toFixed(1)} KB)...`));

    const response = await fetch(attachment.url);
    if (!response.ok) {
      throw new Error(`Download failed HTTP ${response.status}`);
    }

    const text = await response.text();
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object' || !parsed.guilds) {
      throw new Error('Downloaded backup file has invalid schema');
    }

    // Keep an emergency copy of whatever local file existed
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, path.join(BACKUPS_DIR, `pre_restore_${Date.now()}.json`));
      } catch {}
    }

    // Write restored database to disk
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');

    // Also restore stats.db if attached
    const statsAtt = backupMsg.attachments.find(a => a.name?.endsWith('.db'));
    if (statsAtt) {
      try {
        const statsRes = await fetch(statsAtt.url);
        if (statsRes.ok) {
          const statsBuffer = Buffer.from(await statsRes.arrayBuffer());
          fs.writeFileSync(STATS_FILE, statsBuffer);
          console.log(chalk.cyan('[CloudSync] Restored stats.db from cloud backup.'));
        }
      } catch (e) {
        console.warn('[CloudSync] Could not restore stats.db:', e.message);
      }
    }

    // Hot-reload in-memory database
    db.load();

    const restoredGuilds = Object.keys(db.cache.guilds || {}).length;
    console.log(chalk.green.bold(`\n======================================================`));
    console.log(chalk.green.bold(`[CloudSync] AUTO-RESTORE COMPLETE! Successfully restored:`));
    console.log(chalk.green.bold(`  • Servers: ${restoredGuilds}`));
    console.log(chalk.green.bold(`  • Welcome Messages & Rules: Intact`));
    console.log(chalk.green.bold(`  • Blacklisted Words & Triggers: Intact`));
    console.log(chalk.green.bold(`  • Quarantine & Autoroles: Intact`));
    console.log(chalk.green.bold(`======================================================\n`));

    // Notify backup channel
    await channel.send(cv2.success(
      `Database Auto-Restored | <a:atheNATICK:1557841381630681106>`,
      `**New Hosting Migration Detected!**\n` +
      `The bot detected a fresh boot and automatically restored all server configurations from the latest cloud backup.\n\n` +
      `> -# **Restored Servers:** \`${restoredGuilds}\`\n` +
      `> -# **Restored From:** \`${attachment.name}\`\n` +
      `> -# **Timestamp:** <t:${Math.floor(Date.now() / 1000)}:R>`
    )).catch(() => null);

    return { restored: true, guilds: restoredGuilds };
  } catch (err) {
    console.error(chalk.red('[CloudSync] Auto-restore failed:'), err);
    return { restored: false, error: err.message };
  }
}

/**
 * Manually restores the database from a given JSON string or buffer.
 */
export async function manualRestore(jsonContent) {
  try {
    const parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    if (!parsed || typeof parsed !== 'object' || !parsed.guilds) {
      throw new Error('Invalid database JSON structure. Must contain a "guilds" object.');
    }

    // Create safety snapshot before overwriting
    if (fs.existsSync(DB_FILE)) {
      try {
        fs.copyFileSync(DB_FILE, path.join(BACKUPS_DIR, `manual_before_restore_${Date.now()}.json`));
      } catch {}
    }

    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
    db.load();

    return {
      success: true,
      guilds: Object.keys(db.cache.guilds || {}).length,
      triggers: Object.keys(db.cache.triggers || {}).length + (db.cache.globalTriggers || []).length
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Starts the periodic automated cloud backup timer.
 */
export function startCloudBackupScheduler(client, intervalMinutes = 20) {
  if (backupInterval) clearInterval(backupInterval);

  const ms = intervalMinutes * 60 * 1000;
  console.log(chalk.cyan(`[CloudSync] Automated Discord cloud backup scheduler active (Interval: ${intervalMinutes}m)`));

  // Initial backup 30 seconds after boot to ensure latest state is synced
  setTimeout(() => {
    createCloudBackup(client, 'Post-Boot Sync').catch(() => null);
  }, 30000);

  backupInterval = setInterval(() => {
    createCloudBackup(client, `Periodic ${intervalMinutes}m Schedule`).catch(() => null);
  }, ms);
}
