import fs from "fs";

let text = fs.readFileSync("src/events/messageDelete.js", "utf8");

const replacement = `
    let deletedBy = 'Unknown';
    let deletionReason = '';

    const formatUser = (id) => {
      const mem = message.guild.members.cache.get(id);
      const u = message.client.users.cache.get(id);
      const name = mem?.displayName || u?.globalName || u?.username || 'Unknown';
      return \`[\${name}](https://discord.com/users/\${id})\`;
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
                deletedBy = \`\${formatUser(executor.id)} (Auto-Moderation / Blacklist)\`;
              } else if (executor.bot) {
                deletedBy = \`\${formatUser(executor.id)} (Bot)\`;
              } else {
                deletedBy = \`\${formatUser(executor.id)}\`;
              }
              if (reason) deletionReason = \`\\n-# **Reason:** \${reason}\`;
            } else {
              deletedBy = \`\${formatUser(message.author.id)} (Self-Deleted)\`;
            }
          } else {
            deletedBy = \`\${formatUser(message.author.id)} (Self-Deleted)\`;
          }
        } else {
          deletedBy = \`\${formatUser(message.author.id)} (Self-Deleted / Missing Audit Perms)\`;
        }
      } catch (e) {
        deletedBy = \`\${formatUser(message.author.id)} (Self-Deleted / Unknown)\`;
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
    innerComps.push({ type: 10, content: \`-# \${title}\` });
    innerComps.push({ type: 14, divider: true });
    
    // Info
    innerComps.push({ type: 10, content: \`-# **Author:** \${authorMention}\` });
    innerComps.push({ type: 10, content: \`-# **Deleted By:** \${deletedBy}\${deletionReason}\` });
    innerComps.push({ type: 10, content: \`-# **Channel:** [\\\#\${message.channel.name}](https://discord.com/channels/\${message.guild.id}/\${message.channel.id})\` });
    
    innerComps.push({ type: 14, divider: true });
    
    // Content
    innerComps.push({ type: 10, content: \`-# **Message Content:**\` });
    const contentLines = content.split('\\n');
    for (const line of contentLines) {
      innerComps.push({ type: 10, content: \`-# \${line}\` });
    }

    if (isGhostPing) {
      let pinged = [];
      if (hasUserMentions) pinged.push(...message.mentions.users.filter(u => u.id !== authorId && !u.bot).map(u => formatUser(u.id)));
      if (hasRoleMentions) pinged.push(...message.mentions.roles.map(r => \`@\${r.name}\`));
      if (hasEveryone) pinged.push('@everyone / @here');
      
      innerComps.push({ type: 14, divider: true });
      innerComps.push({ type: 10, content: \`-# **Ghost Pinged:**\` });
      innerComps.push({ type: 10, content: \`-# \${pinged.join(', ').substring(0, 1024)}\` });
    }

    // Footer
    innerComps.push({ type: 14, divider: true });
    innerComps.push({ type: 10, content: \`-# **Athena Diagnostic Logs**\` });
`;

text = text.replace(/let deletedBy = 'Unknown';[\s\S]*?innerComps\.push\(\{ type: 10, content: `-# \*\*Athena Bulletproof Security !!!\*\*` \}\);/, replacement.trim());
fs.writeFileSync("src/events/messageDelete.js", text);
