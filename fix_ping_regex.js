import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

text = text.replace(/\{ name: \'Tagger\', value: \`\$\\{message\.author\.tag\\} \(\<\@\$\\{userId\\}\>\)\`, inline: true \}/g, 
"{ name: 'Tagger', value: `[${message.author.tag}](https://discord.com/users/${userId})`, inline: true }");

text = text.replace(/\{ name: \'Channel\', value: \`\<\#\$\\{message\.channel\.id\\}\>\`, inline: true \}/g, 
"{ name: 'Channel', value: `[${message.channel.name}](https://discord.com/channels/${guildId}/${message.channel.id})`, inline: true }");

fs.writeFileSync("src/events/messageCreate.js", text);
