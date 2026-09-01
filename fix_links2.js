import fs from "fs";

let text = fs.readFileSync("src/events/messageDelete.js", "utf8");

text = text.replace(
    /const name = mem\?\.displayName \|\| u\?\.globalName \|\| u\?\.username \|\| 'Unknown';/g,
    "let name = mem?.displayName || u?.globalName || u?.username || 'Unknown'; name = name.replace(/[\\[\\]\\|\\*~_]/g, '').trim();"
);

text = text.replace(
    /innerComps\.push\(\{ type: 10, content: `-# \*\*Channel:\*\* \[\#\$\{message\.channel\.name\}\]\(https:\/\/discord\.com\/channels\/\$\{message\.guild\.id\}\/\$\{message\.channel\.id\}\)` \}\);/g,
    "let safeChannel = message.channel.name.replace(/[\\[\\]\\|\\*~_]/g, '').trim();\n    innerComps.push({ type: 10, content: `-# **Channel:** [\\\# ${safeChannel}](https://discord.com/channels/${message.guild.id}/${message.channel.id})` });"
);

fs.writeFileSync("src/events/messageDelete.js", text);

let modText = fs.readFileSync("src/commands/moderation.js", "utf8");
modText = modText.replace(
    /logComps\.push\(\{ type: 10, content: `-# \*\*Channel:\*\* \[\$\{channel\.name\}\]\(https:\/\/discord\.com\/channels\/\$\{guild\.id\}\/\$\{channel\.id\}\)` \}\);/g,
    "let safeChannel = channel.name.replace(/[\\[\\]\\|\\*~_]/g, '').trim();\n    logComps.push({ type: 10, content: `-# **Channel:** [\\\# ${safeChannel}](https://discord.com/channels/${guild.id}/${channel.id})` });"
);
fs.writeFileSync("src/commands/moderation.js", modText);

