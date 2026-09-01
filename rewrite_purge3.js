import fs from "fs";

let text = fs.readFileSync("src/commands/moderation.js", "utf8");
let lines = text.split("\n");

let start = -1;
let end = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("async function handlePurge(")) {
    start = i;
  }
  if (start !== -1 && lines[i].includes("async function handleSlowmode(")) {
    end = i - 1; // Before handleSlowmode
    break;
  }
}

if (start !== -1 && end !== -1) {
  const newPurge = `async function handlePurge(guild, channel, moderator, amount, triggerMessage = null) {
  try {
    if (!guild.client.ignoredDeletes) guild.client.ignoredDeletes = new Set();

    let fetchAmount = amount;
    if (triggerMessage) fetchAmount += 1;

    const messages = await channel.messages.fetch({ limit: fetchAmount });
    messages.forEach(m => guild.client.ignoredDeletes.add(m.id));

    const deleted = await channel.bulkDelete(messages, true);
    
    setTimeout(() => {
      messages.forEach(m => guild.client.ignoredDeletes.delete(m.id));
    }, 15000);

    const actualAmount = triggerMessage && deleted.has(triggerMessage.id) ? deleted.size - 1 : deleted.size;

    const resEmbed = cv2.success('Messages Purged', \`Successfully deleted **\${actualAmount}** messages from this channel.\`, [
      { name: 'Requested', value: \`\\\`\${amount}\\\`\`, inline: true },
      { name: 'Deleted', value: \`\\\`\${actualAmount}\\\`\`, inline: true },
      { name: 'Moderator', value: \`\${moderator}\`, inline: true }
    ]);

    logToSecurityChannel(guild, cv2.log(
      'Messages Purged',
      \`Moderator bulk-deleted messages.\`,
      [
        { name: 'Channel', value: \`<#\${channel.id}>\`, inline: true },
        { name: 'Count', value: \`\${actualAmount}\`, inline: true },
        { name: 'Moderator', value: \`\${moderator.user ? moderator.user.tag : moderator}\`, inline: true }
      ]
    ));

    let logComps = [];
    logComps.push({ type: 10, content: \`-# 🧹 **ADVANCED PURGE LOG**\` });
    logComps.push({ type: 14, divider: true });
    logComps.push({ type: 10, content: \`-# **Action:** Bulk Delete (Purge)\` });
    logComps.push({ type: 10, content: \`-# **Executed By:** <@\${moderator.id || moderator}>\` });
    logComps.push({ type: 10, content: \`-# **Channel:** <#\${channel.id}>\` });
    logComps.push({ type: 10, content: \`-# **Messages Purged:** \${actualAmount}\` });
    
    if (triggerMessage) {
      logComps.push({ type: 10, content: \`-# **Trigger Command:** \\\`\${triggerMessage.content}\\\`\` });
    }
    
    logComps.push({ type: 14, divider: true });
    
    let userCounts = {};
    deleted.forEach(m => {
      if (m.id === triggerMessage?.id) return;
      const id = m.author ? m.author.id : 'Unknown';
      userCounts[id] = (userCounts[id] || 0) + 1;
    });
    
    let summaryStr = Object.entries(userCounts).map(([id, count]) => \`- <@\${id}>: \${count} messages\`).join('\\n-# ');
    if (summaryStr) {
      logComps.push({ type: 10, content: \`-# **Affected Users:**\\n-# \${summaryStr}\` });
    }

    logComps.push({ type: 14, divider: true });
    logComps.push({ type: 10, content: \`-# **Athena Advanced Log Diagnostics ⏱️**\` });

    let payload = {
      components: [{ type: 17, components: logComps }],
      flags: 32768
    };

    logServerEvent(guild, 'msgDeletes', payload);

    return resEmbed;
  } catch (error) {
    console.error(error);
    return cv2.danger('Purge Failed', 'Failed to delete messages. Messages older than 14 days cannot be bulk deleted.');
  }
}
`;
  lines.splice(start, end - start, newPurge);
  fs.writeFileSync("src/commands/moderation.js", lines.join("\n"));
} else {
  console.log("Could not find bounds");
}

