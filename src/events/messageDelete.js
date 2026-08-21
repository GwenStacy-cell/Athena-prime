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

    const content = message.content ? (message.content.length > 1024 ? message.content.substring(0, 1021) + '...' : message.content) : 'No text content.';
    const imageUrl = message.attachments.first()?.proxyURL || message.attachments.first()?.url || null;
    
    // Save to Sniper Cache for !snipe command
    if (!message.client.snipeCache) {
      message.client.snipeCache = new Map();
    }
    message.client.snipeCache.set(message.channel.id, {
      content: content,
      author: message.author,
      image: imageUrl,
      timestamp: Date.now()
    });

    let deletedBy = 'Unknown';

    if (!message.author) {
      deletedBy = 'Unknown (System or Webhook)';
    } else {
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
              deletedBy = `<@${executor.id}> (Moderator)`;
            } else {
              deletedBy = `<@${message.author.id}> (Self-Deleted)`;
            }
          } else {
            deletedBy = `<@${message.author.id}> (Self-Deleted)`;
          }
        } else {
          deletedBy = `<@${message.author.id}> (Self-Deleted / Missing Audit Perms)`;
        }
      } catch (e) {
        deletedBy = `<@${message.author.id}> (Self-Deleted / Unknown)`;
      }
    }

    // Detect Ghost Pings
    const authorId = message.author ? message.author.id : 'System';
    const hasUserMentions = message.mentions.users.filter(u => u.id !== authorId && !u.bot).size > 0;
    const hasRoleMentions = message.mentions.roles.size > 0;
    const hasEveryone = message.mentions.everyone;
    const isGhostPing = hasUserMentions || hasRoleMentions || hasEveryone;

    const title = isGhostPing ? '👻 __**GHOST PING DETECTED**__ 🚨' : '🗑️ __**Message Sniped**__';
    const color = isGhostPing ? '#ff0000' : '#2b2d31'; // Red for Ghost Ping, Dark for normal

    const delEmbed = embed.build({
      description: `${title}\n\n> **Author:** ${message.author ? `<@${authorId}>` : 'System/Webhook'}\n> **Deleted By:** ${deletedBy}\n> **Channel:** ${message.channel}\n> \n> **Message Content:**\n> ${content}`,
      color: color
    });

    if (imageUrl) {
      delEmbed.setImage(imageUrl);
    }

    // Identify who was ghost pinged if applicable
    if (isGhostPing) {
      let pinged = [];
      if (hasUserMentions) pinged.push(...message.mentions.users.filter(u => u.id !== authorId && !u.bot).map(u => `<@${u.id}>`));
      if (hasRoleMentions) pinged.push(...message.mentions.roles.map(r => `<@&${r.id}>`));
      if (hasEveryone) pinged.push('@everyone / @here');
      
      delEmbed.addFields({ name: '⚠️ Ghost Pinged:', value: pinged.join(', ').substring(0, 1024) });
    }

    logServerEvent(message.guild, 'msgDeletes', delEmbed);
  }
};
