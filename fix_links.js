import fs from "fs";

let text = fs.readFileSync("src/events/messageDelete.js", "utf8");

// Fix the channel link to strip markdown
text = text.replace(
    "innerComps.push({ type: 10, content: \\`-# **Channel:** [\\\\#\${message.channel.name}](https://discord.com/channels/\${message.guild.id}/\${message.channel.id})\\` });",
    "const safeChannelName = message.channel.name.replace(/[\\\\[\\\\]|*~_]/g, '').trim();\n    innerComps.push({ type: 10, content: \\`-# **Channel:** [# \${safeChannelName}](https://discord.com/channels/\${message.guild.id}/\${message.channel.id})\\` });"
);

// Also fix the user format to strip markdown from nicknames
text = text.replace(
    "const name = mem?.displayName || u?.globalName || u?.username || 'Unknown';",
    "const name = (mem?.displayName || u?.globalName || u?.username || 'Unknown').replace(/[\\\\[\\\\]|*~_]/g, '').trim();"
);

fs.writeFileSync("src/events/messageDelete.js", text);

let modText = fs.readFileSync("src/commands/moderation.js", "utf8");
modText = modText.replace(
    "logComps.push({ type: 10, content: \\`-# **Channel:** [\${channel.name}](https://discord.com/channels/\${guild.id}/\${channel.id})\\` });",
    "const safeChannelName = channel.name.replace(/[\\\\[\\\\]|*~_]/g, '').trim();\n    logComps.push({ type: 10, content: \\`-# **Channel:** [# \${safeChannelName}](https://discord.com/channels/\${guild.id}/\${channel.id})\\` });"
);

fs.writeFileSync("src/commands/moderation.js", modText);
