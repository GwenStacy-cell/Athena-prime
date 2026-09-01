import fs from "fs";

let text = fs.readFileSync("src/events/messageDelete.js", "utf8");

const replacement = `
    const title = isGhostPing ? '<a:st_Ghost:1543537892717105212> **GHOST PING DETECTED**' : '**Message Sniped**';
    const authorMention = message.author ? \`<@\${message.author.id}>\` : 'System';
    
    let innerComps = [];
    
    // Header
    innerComps.push({ type: 10, content: \`-# \${title}\` });
    innerComps.push({ type: 14, divider: true });
    
    // Info
    innerComps.push({ type: 10, content: \`-# **Author:** \${authorMention}\` });
    innerComps.push({ type: 10, content: \`-# **Deleted By:** \${deletedBy}\${deletionReason}\` });
    innerComps.push({ type: 10, content: \`-# **Channel:** <#\${message.channel.id}>\` });
    
    innerComps.push({ type: 14, divider: true });
    
    // Content
    innerComps.push({ type: 10, content: \`-# **Message Content:**\` });
    // If content has newlines, split them and prefix each with -#
    const contentLines = content.split('\\n');
    for (const line of contentLines) {
      innerComps.push({ type: 10, content: \`-# \${line}\` });
    }

    if (isGhostPing) {
      let pinged = [];
      if (hasUserMentions) pinged.push(...message.mentions.users.filter(u => u.id !== authorId && !u.bot).map(u => \`<@\${u.id}>\`));
      if (hasRoleMentions) pinged.push(...message.mentions.roles.map(r => \`<@&\${r.id}>\`));
      if (hasEveryone) pinged.push('@everyone / @here');
      
      innerComps.push({ type: 14, divider: true });
      innerComps.push({ type: 10, content: \`-# **Ghost Pinged:**\` });
      innerComps.push({ type: 10, content: \`-# \${pinged.join(', ').substring(0, 1024)}\` });
    }

    // Footer
    innerComps.push({ type: 14, divider: true });
    innerComps.push({ type: 10, content: \`-# **Athena Bulletproof Security !!!**\` });

    let payload = {
      components: [
        { type: 17, components: innerComps }
      ],
      flags: 32768
    };
`;

// Replace from 'const title =' down to 'flags: 32768\n    };'
text = text.replace(/const title = isGhostPing \?.*?flags: 32768\s*};/s, replacement.trim());

fs.writeFileSync("src/events/messageDelete.js", text);
