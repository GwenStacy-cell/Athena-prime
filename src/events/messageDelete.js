import db from '../database.js';
import embed from '../embed.js';
import { logServerEvent } from '../utils/serverLogger.js';
import { AuditLogEvent } from 'discord.js';

export default {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild) return;

    // Check if the deleted message was a reaction role menu, and if so, clean it up from the database
    const rrConfig = db.getReactionRoleMenu(message.id);
    if (rrConfig) {
      db.deleteReactionRoleMenu(message.id);
      console.log(`[Reaction Roles] Automatically cleaned up deleted menu: ${message.id}`);
    }

    if (message.author?.bot) return; // Don't log bot message deletions to prevent spam

    const content = message.content ? (message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content) : 'No text content';
    
    let deletedBy = 'Unknown';

    try {
      if (message.guild.members.me.permissions.has('ViewAuditLog')) {
        const auditLogs = await message.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.MessageDelete,
        });
        const deleteLog = auditLogs.entries.first();
        if (deleteLog) {
          const { executor, target, createdTimestamp, extra } = deleteLog;
          // Check if the log is recent (within last 5 seconds) and matches the target (author) and channel
          if (target && target.id === message.author.id && extra.channel.id === message.channel.id && createdTimestamp > (Date.now() - 5000)) {
            deletedBy = `${executor.tag} (<@${executor.id}>)`;
          } else {
            deletedBy = `${message.author.tag} (<@${message.author.id}>) (Self-Delete / Unknown)`;
          }
        } else {
          deletedBy = `${message.author.tag} (<@${message.author.id}>) (Self-Delete / Unknown)`;
        }
      } else {
        deletedBy = `${message.author.tag} (<@${message.author.id}>) (Self-Delete / Missing Perms)`;
      }
    } catch (e) {
      deletedBy = `${message.author.tag} (<@${message.author.id}>) (Error)`;
    }

    const delEmbed = embed.build({
      description: `__**Message Deleted |**__ <:emoji_16:1521464002046328944>\n> **Author:** ${message.author?.tag || 'Unknown'} (<@${message.author?.id || 'Unknown'}>)\n> **Deleted By:** ${deletedBy}\n>  **Channel:** ${message.channel}\n>  **Content:**\n>  ${content}`,
      color: '#2b2d31'
    });

    logServerEvent(message.guild, 'msgDeletes', delEmbed);
  }
};
