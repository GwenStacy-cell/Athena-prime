import fs from "fs";
let mc = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Line 463 area
mc = mc.replace(
    /\.addFields\(\[\{ name: 'Channel', value: \`\[\$\{message\.channel\.name\}\]\(https:\/\/discord\.com\/channels\/\$\{guildId\}\/\$\{message\.channel\.id\}\)\` \}\]\)/,
    ".addFields([{ name: 'Channel', value: `[${message.channel.name.replace(/[^\\p{L}\\p{N}\\s\\-_|]/gu, '').replace(/^[\\s\\-_|]+/, '').trim() || 'channel'}](https://discord.com/channels/${guildId}/${message.channel.id})` }])"
);

// Line 940 area
mc = mc.replace(
    /\{ name: 'Channel', value: \`\[\$\{message\.channel\.name\}\]\(https:\/\/discord\.com\/channels\/\$\{guildId\}\/\$\{message\.channel\.id\}\)\`, inline: true \},/,
    "{ name: 'Channel', value: `[${message.channel.name.replace(/[^\\p{L}\\p{N}\\s\\-_|]/gu, '').replace(/^[\\s\\-_|]+/, '').trim() || 'channel'}](https://discord.com/channels/${guildId}/${message.channel.id})`, inline: true },"
);

fs.writeFileSync("src/events/messageCreate.js", mc);
