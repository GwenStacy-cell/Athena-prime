import db from '../database.js';
import { logServerEvent } from '../utils/serverLogger.js';
import { AuditLogEvent } from 'discord.js';

export default {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild) return;

    // Check if the deleted message was a reaction role menu
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
    let deletionReason = '';

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
            const { executor, target, createdTimestamp, extra, reason } = deleteLog;
            // Check if the log is recent (within last 5 seconds) and matches the target and channel
            if (target && target.id === message.author.id && extra.channel.id === message.channel.id && createdTimestamp > (Date.now() - 5000)) {
              if (executor.id === message.client.user.id) {
                deletedBy = `<@${executor.id}> (Auto-Moderation / Blacklist)`;
              } else if (executor.bot) {
                deletedBy = `<@${executor.id}> (Bot)`;
              } else {
                deletedBy = `<@${executor.id}>`;
              }
              if (reason) deletionReason = `\n-# **Reason:** ${reason}`;
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

    const title = isGhostPing ? '<a:st_Ghost:1543537892717105212> **GHOST PING DETECTED**' : '**Message Sniped**';
    const authorMention = message.author ? `<@${message.author.id}>` : 'System';
    
    let innerComps = [];
    
    // Header
    innerComps.push({ type: 10, content: `-# ${title}` });
    innerComps.push({ type: 14, divider: true });
    
    // Info
    innerComps.push({ type: 10, content: `-# **Author:** ${authorMention}` });
    innerComps.push({ type: 10, content: `-# **Deleted By:** ${deletedBy}${deletionReason}` });
    innerComps.push({ type: 10, content: `-# **Channel:** <#${message.channel.id}>` });
    
    innerComps.push({ type: 14, divider: true });
    
    // Content
    innerComps.push({ type: 10, content: `-# **Message Content:**` });
    // If content has newlines, split them and prefix each with -#
    const contentLines = content.split('\n');
    for (const line of contentLines) {
      innerComps.push({ type: 10, content: `-# ${line}` });
    }

    if (isGhostPing) {
      let pinged = [];
      if (hasUserMentions) pinged.push(...message.mentions.users.filter(u => u.id !== authorId && !u.bot).map(u => `<@${u.id}>`));
      if (hasRoleMentions) pinged.push(...message.mentions.roles.map(r => `<@&${r.id}>`));
      if (hasEveryone) pinged.push('@everyone / @here');
      
      innerComps.push({ type: 14, divider: true });
      innerComps.push({ type: 10, content: `-# **Ghost Pinged:**` });
      innerComps.push({ type: 10, content: `-# ${pinged.join(', ').substring(0, 1024)}` });
    }

    // Footer
    innerComps.push({ type: 14, divider: true });
    innerComps.push({ type: 10, content: `-# **Athena Bulletproof Security !!!**` });

    let payload = {
      components: [
        { type: 17, components: innerComps }
      ],
      flags: 32768
    };

    if (imageUrl) {
      payload.components[0].components.push({ type: 12, items: [{ media: { url: imageUrl } }] });
    }

    logServerEvent(message.guild, 'msgDeletes', payload);
  }
};
