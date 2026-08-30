import db from '../database.js';
import { logServerEvent } from '../utils/serverLogger.js';
import { AuditLogEvent } from 'discord.js';

export default {
  name: 'messageDelete',
  async execute(message) {
if (!message.guild) return;

    if (message.client.ignoredDeletes && message.client.ignoredDeletes.has(message.id)) {
      message.client.ignoredDeletes.delete(message.id);
      return; // Suppress individual log because this is being bulk-logged by Purge
    }

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

    const formatUser = (id) => {
      const mem = message.guild.members.cache.get(id);
      const u = message.client.users.cache.get(id);
      const name = (mem?.displayName || u?.globalName || u?.username || 'Unknown').replace(/[\x5B\x5D|*~_]/g, '').trim();
      return `[${name}](https://discord.com/users/${id})`;
    };

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
            if (target && target.id === message.author.id && extra.channel.id === message.channel.id && createdTimestamp > (Date.now() - 5000)) {
              if (executor.id === message.client.user.id) {
                deletedBy = `${formatUser(executor.id)} (Auto-Moderation / Blacklist)`;
              } else if (executor.bot) {
                deletedBy = `${formatUser(executor.id)} (Bot)`;
              } else {
                deletedBy = `${formatUser(executor.id)}`;
              }
              if (reason) deletionReason = `\n-# **Reason:** ${reason}`;
            } else {
              deletedBy = `${formatUser(message.author.id)} (Self-Deleted)`;
            }
          } else {
            deletedBy = `${formatUser(message.author.id)} (Self-Deleted)`;
          }
        } else {
          deletedBy = `${formatUser(message.author.id)} (Self-Deleted / Missing Audit Perms)`;
        }
      } catch (e) {
        deletedBy = `${formatUser(message.author.id)} (Self-Deleted / Unknown)`;
      }
    }

    // Detect Ghost Pings
    const authorId = message.author ? message.author.id : 'System';
    const hasUserMentions = message.mentions.users.filter(u => u.id !== authorId && !u.bot).size > 0;
    const hasRoleMentions = message.mentions.roles.size > 0;
    const hasEveryone = message.mentions.everyone;
    const isGhostPing = hasUserMentions || hasRoleMentions || hasEveryone;

    const title = isGhostPing ? '<a:st_Ghost:1543537892717105212> **GHOST PING DETECTED**' : '**Message Sniped**';
    const authorMention = message.author ? formatUser(message.author.id) : 'System';
    
    let innerComps = [];
    
    // Header
    innerComps.push({ type: 10, content: `-# ${title}` });
    innerComps.push({ type: 14, divider: true });
    
    // Info
    innerComps.push({ type: 10, content: `-# **Author:** ${authorMention}` });
    innerComps.push({ type: 10, content: `-# **Deleted By:** ${deletedBy}${deletionReason}` });
    let safeChannel = message.channel.name.replace(/[^a-zA-Z0-9\- ]/g, '').trim();
      if (!safeChannel) safeChannel = 'Channel';
    innerComps.push({ type: 10, content: `-# **Channel:** [${safeChannel}](https://discord.com/channels/${message.guild.id}/${message.channel.id})` });
    
    innerComps.push({ type: 14, divider: true });
    
    // Content
    innerComps.push({ type: 10, content: `-# **Message Content:**` });
    const contentLines = content.split('\n');
    for (const line of contentLines) {
      innerComps.push({ type: 10, content: `-# ${line}` });
    }

    if (isGhostPing) {
      let pinged = [];
      if (hasUserMentions) pinged.push(...message.mentions.users.filter(u => u.id !== authorId && !u.bot).map(u => formatUser(u.id)));
      if (hasRoleMentions) pinged.push(...message.mentions.roles.map(r => `@${r.name}`));
      if (hasEveryone) pinged.push('@everyone / @here');
      
      innerComps.push({ type: 14, divider: true });
      innerComps.push({ type: 10, content: `-# **Ghost Pinged:**` });
      innerComps.push({ type: 10, content: `-# ${pinged.join(', ').substring(0, 1024)}` });
    }

    // Footer
    innerComps.push({ type: 14, divider: true });
    innerComps.push({ type: 10, content: `-# **Athena Diagnostic Logs**` });

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
