import fs from "fs";

let text = fs.readFileSync("src/commands/moderation.js", "utf8");

// Add logServerEvent import if not there
if (!text.includes("logServerEvent")) {
  text = text.replace(
    "import { logToSecurityChannel } from '../utils/securityLogger.js';",
    "import { logToSecurityChannel } from '../utils/securityLogger.js';\nimport { logServerEvent } from '../utils/serverLogger.js';"
  );
}

const newPurge = `async function handlePurge(guild, channel, moderator, amount, triggerMessage = null) {
  try {
    if (!guild.client.ignoredDeletes) guild.client.ignoredDeletes = new Set();

    let fetchAmount = amount;
    if (triggerMessage) fetchAmount += 1; // Include the trigger message in the fetch

    const messages = await channel.messages.fetch({ limit: fetchAmount });
    messages.forEach(m => guild.client.ignoredDeletes.add(m.id));

    const deleted = await channel.bulkDelete(messages, true);
    
    // Clean up ignored cache after 15 seconds to prevent memory leaks
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
        { name: 'Moderator', value: \`\${moderator}\`, inline: true }
      ]
    ));

    // Send Advanced Log to msgDeletes
    let logComps = [];
    logComps.push({ type: 10, content: \`-# 🧹 **ADVANCED PURGE LOG**\` });
    logComps.push({ type: 14, divider: true });
    logComps.push({ type: 10, content: \`-# **Action:** Bulk Delete (Purge)\` });
    logComps.push({ type: 10, content: \`-# **Executed By:** <@\${moderator.id}>\` });
    logComps.push({ type: 10, content: \`-# **Channel:** <#\${channel.id}>\` });
    logComps.push({ type: 10, content: \`-# **Messages Purged:** \${actualAmount}\` });
    
    if (triggerMessage) {
      logComps.push({ type: 10, content: \`-# **Trigger Command:** \\\`\${triggerMessage.content}\\\`\` });
    }
    
    logComps.push({ type: 14, divider: true });
    
    // Quick summary of users affected
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

    return { components: [resEmbed], flags: 32768 };
  } catch (error) {
    console.error(error);
    return cv2.error('Purge Failed', 'An error occurred. Note that messages older than 14 days cannot be bulk-deleted.');
  }
}`;

text = text.replace(/async function handlePurge[\s\S]*?return cv2\.error.*?\}\s*\}/, newPurge);
fs.writeFileSync("src/commands/moderation.js", text);
