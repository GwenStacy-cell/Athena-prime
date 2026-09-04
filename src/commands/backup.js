import cv2 from '../cv2.js';
import db from '../database.js';
import { generateBackupId, serializeGuild, restoreGuild } from './ezal.js';
import { isBotOwnerSync } from '../utils/helpers.js';

export const commands = [
  {
    name: 'backup',
    aliases: ['bcp', 'save'],
    description: 'Server infrastructure Backup and Recovery Suite.',
    category: 'utilities',
    options: [],
    async executePrefix(message, args) {
      const subcommand = args[0]?.toLowerCase();
      
      const isBotOwner = isBotOwnerSync(message.author.id);
      const isServerOwner = message.guild && message.author.id === message.guild.ownerId;
      
      if (!isBotOwner && !isServerOwner) {
        return message.reply(cv2.danger('Access Denied', 'Only the **Server Owner** can manage backups.'));
      }

      if (!subcommand) {
        return message.reply(cv2.warn('Backup Suite', 'Usage:\n`!backup create` - Save a server snapshot\n`!backup info` - View your saved snapshot\n`!backup restore <id>` - Restore a snapshot (Bot Owner Only)'));
      }

      if (subcommand === 'create') {
        const loadingMsg = await message.reply({ content: '-# <a:loading:1542155051286396938> **Scanning and serializing server infrastructure... please wait.**' });
        
        try {
          const backupData = await serializeGuild(message.guild);
          const backupId = generateBackupId();
          db.saveBackup(backupId, backupData);
          
          await loadingMsg.edit({ 
            content: null,
            components: [
              cv2.buildContainer(
                'Backup Complete', 
                'Successfully saved a snapshot of **' + message.guild.name + '**.!', 
                [
                  { name: 'Backup ID', value: '`' + backupId + '`', inline: true },
                  { name: 'Timestamp', value: '<t:' + Math.floor(Date.now() / 1000) + ':f>', inline: true }
                ]
              )
            ],
            flags: 16384
          });
        } catch (err) {
          console.error('[Backup Create Error]', err);
          await loadingMsg.edit({ content: '-# **Failed to create backup.** An internal error occurred.' });
        }
      } 
      
      else if (subcommand === 'info') {
        const backupData = db.getBackupByGuild(message.guild.id);
        const backupId = db.cache.guildBackupMap[message.guild.id];
        
        if (!backupData || !backupId) {
          return message.reply(cv2.warn('No Backup Found', 'This server does not have any saved backups in the database.'));
        }
        
        return message.reply(cv2.info('Backup Information', '**Server:** ' + backupData.guildName + '\n**Backup ID:** `' + backupId + '`\n**Saved At:** <t:' + Math.floor(backupData.timestamp / 1000) + ':R>\n\n**Channels:** ' + backupData.channels.length + '\n**Categories:** ' + backupData.categories.length + '\n**Roles:** ' + backupData.roles.length));
      } 
      
      else if (subcommand === 'restore') {
        if (!isBotOwner) {
          return message.reply(cv2.danger('Access Denied', 'Due to extreme destructive risk, only the **Global Bot Owner** can restore backups.'));
        }
        
        const backupId = args[1]?.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (!backupId) return message.reply(cv2.warn('Usage', '`!backup restore <backupId>`'));
        
        const backupData = db.getBackup(backupId);
        if (!backupData) return message.reply(cv2.danger('Not Found', 'No backup found with ID `' + backupId + '`.'));
        
        if (backupData.guildId !== message.guild.id) {
          return message.reply(cv2.danger('Mismatch', 'Backup `' + backupId + '` belongs to **' + backupData.guildName + '**. You cannot restore it here.'));
        }

        await message.reply(cv2.warn('Destructive Action', 'You are about to WIPE and RESTORE **' + message.guild.name + '** from backup `' + backupId + '`.\n\nType `CONFIRM` within 15 seconds to proceed.'));
        
        try {
          const filter = m => m.author.id === message.author.id && m.content === 'CONFIRM';
          const collected = await message.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] });
          if (!collected.size) return;
        } catch (err) {
          return message.channel.send(cv2.info('Cancelled', 'Backup restoration timed out.'));
        }
        
        const loadingMsg = await message.channel.send({ content: '-# <a:loading:1542155051286396938> **Restoring backup infrastructure...**' });
        
        const updateStatus = async (text) => {
          await loadingMsg.edit({ content: '-# <a:loading:1542155051286396938> **' + text + '**' }).catch(() => null);
        };
        
        const results = await restoreGuild(message.guild, backupData, updateStatus, message.channel.id);
        
        await loadingMsg.edit({
          content: null,
          components: [
            cv2.buildContainer(
              'Restoration Complete',
              'Successfully restored **' + message.guild.name + '** from backup `' + backupId + '`.\n\n**Channels Restored:** ' + results.channelsCreated + '\n**Roles Restored:** ' + results.rolesCreated
            )
          ],
          flags: 16384
        });
      }
    }
  }
];
