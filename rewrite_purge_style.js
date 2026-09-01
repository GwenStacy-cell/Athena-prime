import fs from "fs";

let text = fs.readFileSync("src/commands/moderation.js", "utf8");

let lines = text.split("\n");
let start = -1;
let end = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("let logComps = [];")) {
    start = i;
  }
  if (start !== -1 && lines[i].includes("let payload = {")) {
    end = i - 1; // Stop right before payload
    break;
  }
}

if (start !== -1 && end !== -1) {
  const newLogComps = `    let logComps = [];
    logComps.push({ type: 10, content: \`-# **Message Sniped via Purge Command**\` });
    logComps.push({ type: 14, divider: true });
    logComps.push({ type: 10, content: \`-# **Action:** Bulk Delete (Purge)\` });
    logComps.push({ type: 10, content: \`-# **Executed By:** [\${moderator.displayName || moderator.user?.username || 'Moderator'}](https://discord.com/users/\${moderator.id || moderator})\` });
    logComps.push({ type: 10, content: \`-# **Channel:** [\${channel.name}](https://discord.com/channels/\${guild.id}/\${channel.id})\` });
    logComps.push({ type: 10, content: \`-# **Messages Purged:** \${actualAmount}\` });
    
    if (triggerMessage) {
      logComps.push({ type: 10, content: \`-# **Trigger Command:** \\\`\${triggerMessage.content}\\\`\` });
    }
    
    logComps.push({ type: 14, divider: true });
    
    let userCounts = {};
    let userNames = {};
    deleted.forEach(m => {
      if (m.id === triggerMessage?.id) return;
      const id = m.author ? m.author.id : 'Unknown';
      userCounts[id] = (userCounts[id] || 0) + 1;
      if (m.author && id !== 'Unknown') {
        const mem = guild.members.cache.get(id);
        userNames[id] = mem?.displayName || m.author.globalName || m.author.username;
      }
    });
    
    let summaryStr = Object.entries(userCounts).map(([id, count]) => {
      if (id === 'Unknown') return \`- Unknown: \${count} messages\`;
      return \`- [\${userNames[id]}](https://discord.com/users/\${id}): \${count} messages\`;
    }).join('\\n-# ');

    if (summaryStr) {
      logComps.push({ type: 10, content: \`-# **Affected Users:**\\n-# \${summaryStr}\` });
    }

    logComps.push({ type: 14, divider: true });
    logComps.push({ type: 10, content: \`-# **Athena Advanced Server Diagnostics**\` });
`;
  lines.splice(start, end - start, newLogComps);
  fs.writeFileSync("src/commands/moderation.js", lines.join("\n"));
  console.log("Success");
} else {
  console.log("Failed to find boundaries");
}
