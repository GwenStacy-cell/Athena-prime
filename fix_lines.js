import fs from "fs";
let lines = fs.readFileSync("src/events/messageCreate.js", "utf8").split("\n");

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("name: 'Tagger'") && lines[i].includes("<@${userId}>")) {
        lines[i] = lines[i].replace("`${message.author.tag} (<@${userId}>)`", "`[${message.author.tag}](https://discord.com/users/${userId})`");
    }
    if (lines[i].includes("name: 'Channel'") && lines[i].includes("<#${message.channel.id}>")) {
        lines[i] = lines[i].replace("`<#${message.channel.id}>`", "`[${message.channel.name}](https://discord.com/channels/${guildId}/${message.channel.id})`");
    }
}

fs.writeFileSync("src/events/messageCreate.js", lines.join("\n"));
