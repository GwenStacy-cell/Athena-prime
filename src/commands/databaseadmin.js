import fs from 'fs';
import path from 'path';
import { AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import fetch from 'node-fetch';
import db from '../database.js';
import cv2 from '../cv2.js';
import statsDB from '../statsDB.js';
import { isBotOwnerSync } from '../utils/helpers.js';
import { 
  createCloudBackup, 
  manualRestore, 
  restoreFromCloud, 
  getBackupChannel, 
  getDatabaseMetrics 
} from '../utils/cloudSync.js';

const DATA_DIR = path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.db');

export const commands = [
  {
    name: 'db',
    aliases: ['botdb', 'dbbackup', 'dbrestore', 'dbexport', 'database'],
    description: 'Manage bot database cloud backups, exports, and instant recovery.',
    category: 'utility',
    options: [
      {
        name: 'action',
        description: 'The database action to perform',
        type: 3,
        required: true,
        choices: [
          { name: 'backup (Force cloud backup now)', value: 'backup' },
          { name: 'export (Download db.json & stats.db)', value: 'export' },
          { name: 'restore (Restore from cloud or uploaded file)', value: 'restore' },
          { name: 'status (View database health & cloud sync)', value: 'status' },
          { name: 'setchannel (Set backup channel)', value: 'setchannel' }
        ]
      },
      {
        name: 'file',
        description: 'Database file to restore (optional, defaults to cloud backup)',
        type: 11,
        required: false
      },
      {
        name: 'channel',
        description: 'Channel to send automated cloud backups (for setchannel action)',
        type: 7,
        required: false
      }
    ],

    async executePrefix(message, args) {
      if (!isBotOwnerSync(message.author.id)) {
        return message.reply(cv2.danger('Access Denied', 'Only the Bot Owner can manage database persistence.'));
      }

      const invoked = message.content.trim().split(/ +/)[0].toLowerCase().replace(/^!/, '');
      let action = args[0]?.toLowerCase();

      // Handle direct alias invocations like !dbbackup or !dbrestore
      if (invoked === 'dbbackup') action = 'backup';
      else if (invoked === 'dbrestore') action = 'restore';
      else if (invoked === 'dbexport') action = 'export';
      else if (!action) action = 'status';

      return this._handleAction(message, action, args.slice(1), message.author);
    },

    async executeSlash(interaction) {
      if (!isBotOwnerSync(interaction.user.id)) {
        return interaction.reply(cv2.danger('Access Denied', 'Only the Bot Owner can manage database persistence.'));
      }

      await interaction.deferReply().catch(() => null);
      const action = interaction.options.getString('action');
      const file = interaction.options.getAttachment('file');
      const targetChannel = interaction.options.getChannel('channel');

      return this._handleAction(interaction, action, [], interaction.user, file, targetChannel);
    },

    async _handleAction(context, action, args = [], user, directFile = null, directChannel = null) {
      const sendReply = (payload) => {
        if (context.isCommand?.() && (context.deferred || context.replied)) {
          return context.editReply(payload).catch(() => null);
        }
        return context.reply(payload).catch(() => null);
      };

      // 1. BACKUP ACTION
      if (action === 'backup' || action === 'save' || action === 'sync') {
        const statusMsg = await sendReply(cv2.info('Cloud Backup Initiated', 'Flushing memory & SQLite WAL buffers and uploading persistent snapshot...'));
        
        const result = await createCloudBackup(context.client, `Manual Backup by ${user.tag || user.username}`);
        if (!result.success) {
          const failPayload = cv2.danger('Backup Failed', `Could not upload cloud backup: \`${result.reason || result.error}\``);
          if (context.isCommand?.()) return context.editReply(failPayload);
          return statusMsg?.edit ? statusMsg.edit(failPayload) : sendReply(failPayload);
        }

        const stats = fs.statSync(DB_FILE);
        const sizeKb = (stats.size / 1024).toFixed(1);
        const m = getDatabaseMetrics();

        const successPayload = cv2.success(
          `Database Backed Up | <a:atheNATICK:1557841381630681106>`,
          `**Cloud snapshot successfully stored!**\n\n` +
          `> -# **Backup Channel:** <#${result.channelId}>\n` +
          `> -# **Tracked Servers:** \`${m.guilds}\`\n` +
          `> -# **XP & Leveling Systems:** \`${m.xpSystems} servers (${m.xpUsers} users)\`\n` +
          `> -# **Server Stats Setups:** \`${m.serverStats} servers\`\n` +
          `> -# **Extra Owners & Whitelists:** \`${m.extraOwners} servers (${m.extraOwnersTotal} users, ${m.botWhitelist} bot whitelists)\`\n` +
          `> -# **Custom Triggers & Auto-Replies:** \`${m.triggers}\`\n` +
          `> -# **Quarantines Preserved:** \`${m.quarantines}\`\n` +
          `> -# **Tickets & Giveaways:** \`${m.tickets} tickets, ${m.giveaways} giveaways\`\n` +
          `> -# **Reaction Roles:** \`${m.reactionRoles} menus\`\n` +
          `> -# **Snapshot Size:** \`${sizeKb} KB\`\n` +
          `> -# **Timestamp:** <t:${Math.floor(result.timestamp / 1000)}:R>\n\n` +
          `Your entire database is securely archived in Discord. If you ever switch hosting companies, the bot will automatically restore everything on boot.`
        );
        successPayload.files = [new AttachmentBuilder(DB_FILE, { name: `athena_db_backup_${Date.now()}.json` })];

        if (context.isCommand?.()) return context.editReply(successPayload);
        return statusMsg?.edit ? statusMsg.edit(successPayload) : sendReply(successPayload);
      }

      // 2. EXPORT ACTION
      if (action === 'export' || action === 'download') {
        if (!fs.existsSync(DB_FILE)) {
          return sendReply(cv2.warn('Database Not Found', 'No local `data/db.json` file found on this host.'));
        }

        // Flush memory
        if (db.needsSave || db.saveTimeout) {
          clearTimeout(db.saveTimeout);
          db.saveTimeout = null;
          fs.writeFileSync(DB_FILE, JSON.stringify(db.cache, null, 2), 'utf8');
        }

        // Checkpoint WAL
        statsDB.checkpoint();

        const stats = fs.statSync(DB_FILE);
        const sizeKb = (stats.size / 1024).toFixed(1);
        const m = getDatabaseMetrics();

        const files = [new AttachmentBuilder(DB_FILE, { name: 'db.json' })];
        if (fs.existsSync(STATS_FILE)) {
          files.push(new AttachmentBuilder(STATS_FILE, { name: 'stats.db' }));
        }

        const exportPayload = cv2.info(
          `Database Export | <a:atheNATICK:1557841381630681106>`,
          `Here are your raw database files.\n\n` +
          `> -# **Tracked Servers:** \`${m.guilds}\`\n` +
          `> -# **XP Systems:** \`${m.xpSystems} servers (${m.xpUsers} users)\`\n` +
          `> -# **Server Stats Setups:** \`${m.serverStats} servers\`\n` +
          `> -# **Extra Owners:** \`${m.extraOwners} servers (${m.extraOwnersTotal} users)\`\n` +
          `> -# **Size:** \`${sizeKb} KB\`\n` +
          `> -# **Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
        );
        exportPayload.files = files;

        return sendReply(exportPayload);
      }

      // 3. RESTORE ACTION
      if (action === 'restore' || action === 'import' || action === 'upload' || action === 'pull') {
        let attachment = directFile;

        // Message attachments
        if (!attachment && context.attachments && context.attachments.size > 0) {
          attachment = context.attachments.find(a => a.name?.endsWith('.json'));
        }

        // Replied-to message attachments
        if (!attachment && context.reference?.messageId && context.channel?.messages) {
          const refMsg = await context.channel.messages.fetch(context.reference.messageId).catch(() => null);
          if (refMsg && refMsg.attachments && refMsg.attachments.size > 0) {
            attachment = refMsg.attachments.find(a => a.name?.endsWith('.json'));
          }
        }

        // If no file is attached, check if user requested cloud restore or default to cloud restore
        const subArg = args[0]?.toLowerCase();
        if (!attachment && (subArg === 'cloud' || subArg === 'latest' || action === 'pull' || (!subArg && context.isCommand?.()))) {
          const statusMsg = await sendReply(cv2.info('Cloud Restore Initiated', 'Fetching latest backup snapshot from Discord cloud storage...'));
          const cloudRes = await restoreFromCloud(context.client);

          if (!cloudRes.success) {
            const failPayload = cv2.danger('Cloud Restore Failed', `Could not restore from cloud: \`${cloudRes.reason}\``);
            if (context.isCommand?.()) return context.editReply(failPayload);
            return statusMsg?.edit ? statusMsg.edit(failPayload) : sendReply(failPayload);
          }

          const m = cloudRes.metrics;
          const successPayload = cv2.success(
            `Database Restored | <a:atheNATICK:1557841381630681106>`,
            `**Database successfully restored from cloud backup!**\n\n` +
            `> -# **Tracked Servers:** \`${m.guilds}\`\n` +
            `> -# **XP & Leveling Systems:** \`${m.xpSystems} servers (${m.xpUsers} users)\`\n` +
            `> -# **Server Stats Setups:** \`${m.serverStats} servers\`\n` +
            `> -# **Extra Owners & Whitelists:** \`${m.extraOwners} servers (${m.extraOwnersTotal} users, ${m.botWhitelist} bot whitelists)\`\n` +
            `> -# **Custom Triggers & Auto-Replies:** \`${m.triggers}\`\n` +
            `> -# **Quarantines Preserved:** \`${m.quarantines}\`\n` +
            `> -# **Tickets & Giveaways:** \`${m.tickets} tickets, ${m.giveaways} giveaways\`\n` +
            `> -# **Reaction Roles:** \`${m.reactionRoles} menus\`\n` +
            `> -# **Sticky Messages:** \`${m.stickyMessages} channels\`\n` +
            `> -# **Restored From:** \`${cloudRes.fileName}\`\n\n` +
            `All bot systems and guild configurations are now fully active without needing a bot restart.`
          );

          if (context.isCommand?.()) return context.editReply(successPayload);
          return statusMsg?.edit ? statusMsg.edit(successPayload) : sendReply(successPayload);
        }

        if (!attachment) {
          return sendReply(cv2.warn(
            'Restore Options',
            'You can restore from your Discord cloud backup or upload a file directly:\n\n' +
            '**Commands:**\n' +
            '-# • `!db restore latest` — Instantly pull & restore latest cloud backup from Discord\n' +
            '-# • `!db restore` with your `db.json` attached\n' +
            '-# • Reply to any previous backup in Discord with `!db restore`\n' +
            '-# • Or use `/db action:restore`'
          ));
        }

        try {
          const res = await fetch(attachment.url);
          if (!res.ok) throw new Error(`Download failed (HTTP ${res.status})`);
          const fileText = await res.text();

          const restoreResult = await manualRestore(fileText);
          if (!restoreResult.success) {
            return sendReply(cv2.danger('Restore Failed', `Failed to restore database: \`${restoreResult.error}\``));
          }

          const m = restoreResult.metrics;
          return sendReply(cv2.success(
            `Database Restored | <a:atheNATICK:1557841381630681106>`,
            `**Database successfully restored and hot-reloaded!**\n\n` +
            `> -# **Tracked Servers:** \`${m.guilds}\`\n` +
            `> -# **XP & Leveling Systems:** \`${m.xpSystems} servers (${m.xpUsers} users)\`\n` +
            `> -# **Server Stats Setups:** \`${m.serverStats} servers\`\n` +
            `> -# **Extra Owners & Whitelists:** \`${m.extraOwners} servers (${m.extraOwnersTotal} users, ${m.botWhitelist} bot whitelists)\`\n` +
            `> -# **Custom Triggers & Auto-Replies:** \`${m.triggers}\`\n` +
            `> -# **Quarantines Preserved:** \`${m.quarantines}\`\n` +
            `> -# **Tickets & Giveaways:** \`${m.tickets} tickets, ${m.giveaways} giveaways\`\n` +
            `> -# **Reaction Roles:** \`${m.reactionRoles} menus\`\n` +
            `> -# **Source File:** \`${attachment.name}\`\n\n` +
            `All bot systems and guild configurations are now fully active without needing a bot restart.`
          ));
        } catch (err) {
          return sendReply(cv2.danger('Restore Error', `Failed to process uploaded file: \`${err.message}\``));
        }
      }

      // 4. SETCHANNEL ACTION
      if (action === 'setchannel' || action === 'channel') {
        const guild = context.guild;
        let targetChannel = directChannel;

        if (!targetChannel) {
          const mention = context.mentions?.channels?.first();
          if (mention) targetChannel = mention;
          else if (args[0]) {
            const rawId = args[0].replace(/[<#>]/g, '');
            targetChannel = guild?.channels.cache.get(rawId) || await context.client.channels.fetch(rawId).catch(() => null);
          }
        }

        if (!targetChannel || !targetChannel.isTextBased()) {
          return sendReply(cv2.warn('Missing Channel', 'Please specify or mention a valid text channel to store automated cloud backups.\n\nExample: `!db setchannel #bot-backups`'));
        }

        db.cache.dbBackupChannelId = targetChannel.id;
        db.save();

        // Update topic signature if bot has permission
        try {
          if (targetChannel.manageable) {
            await targetChannel.setTopic('Encrypted automated database cloud snapshots - Athena Prime [athena-db-backups]');
          }
        } catch {}

        // Perform immediate backup test
        const testRes = await createCloudBackup(context.client, `Backup Channel Bound to #${targetChannel.name}`);

        return sendReply(cv2.success(
          `Backup Channel Set | <a:atheNATICK:1557841381630681106>`,
          `Set <#${targetChannel.id}> as the official Discord Cloud Backup channel!\n\n` +
          `> -# **Auto-Backup Interval:** Every 20 minutes\n` +
          `> -# **Initial Snapshot:** ${testRes.success ? 'Saved successfully' : 'Queued'}\n` +
          `> -# **New Host Auto-Restore:** Enabled\n\n` +
          `Whenever you change hosting providers, the bot will automatically retrieve the latest backup from this channel upon booting.`
        ));
      }

      // 5. STATUS ACTION (DEFAULT)
      const currentChannel = await getBackupChannel(context.client);
      const m = getDatabaseMetrics();
      const sizeKb = fs.existsSync(DB_FILE) ? (fs.statSync(DB_FILE).size / 1024).toFixed(1) : '0';
      const lastBackupStr = db.cache.lastCloudBackup ? `<t:${Math.floor(db.cache.lastCloudBackup / 1000)}:R>` : '`Never`';

      return sendReply(cv2.info(
        `Database Cloud Status | <a:atheNATICK:1557841381630681106>`,
        `**Persistence & Cloud Migration System**\n\n` +
        `> -# **Backup Channel:** ${currentChannel ? `<#${currentChannel.id}> (\`${currentChannel.id}\`)` : '`Not Set (Auto-detecting)`'}\n` +
        `> -# **Auto-Sync Scheduler:** \`Active (Every 20m)\`\n` +
        `> -# **Last Cloud Backup:** ${lastBackupStr}\n` +
        `> -# **Local Database Size:** \`${sizeKb} KB\`\n\n` +
        `**Stored & Protected Data Breakdown:**\n` +
        `> -# **Tracked Servers:** \`${m.guilds}\`\n` +
        `> -# **XP & Leveling Systems:** \`${m.xpSystems} servers (${m.xpUsers} users)\`\n` +
        `> -# **Server Stats Setups:** \`${m.serverStats} servers\`\n` +
        `> -# **Extra Owners & Whitelists:** \`${m.extraOwners} servers (${m.extraOwnersTotal} users, ${m.botWhitelist} bot whitelists)\`\n` +
        `> -# **Custom Triggers & Auto-Replies:** \`${m.triggers}\`\n` +
        `> -# **Active Quarantines:** \`${m.quarantines}\`\n` +
        `> -# **Tickets & Verification:** \`${m.tickets} tickets, ${m.verification} verification setups\`\n` +
        `> -# **Giveaways & Reaction Roles:** \`${m.giveaways} giveaways, ${m.reactionRoles} menus\`\n` +
        `> -# **Sticky Messages:** \`${m.stickyMessages} channels\`\n\n` +
        `**Management Commands:**\n` +
        `-# • \`!db backup\` — Force immediate cloud backup\n` +
        `-# • \`!db restore latest\` — Pull & restore latest cloud backup from Discord\n` +
        `-# • \`!db export\` — Download raw \`db.json\` & \`stats.db\`\n` +
        `-# • \`!db restore\` — Restore from uploaded file\n` +
        `-# • \`!db setchannel #channel\` — Change cloud backup channel`
      ));
    }
  }
];
