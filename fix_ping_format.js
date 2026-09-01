import fs from "fs";

let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldFields = `            [
              { name: 'Tagger', value: \`\${message.author.tag} (<@\${userId}>)\`, inline: true },
              { name: 'Server', value: \`\${message.guild.name}\`, inline: true },
              { name: 'Channel', value: \`<#\${message.channel.id}>\`, inline: true },
              { name: 'Message Link', value: \`[Jump to Message](https://discord.com/channels/\${guildId}/\${message.channel.id}/\${message.id})\` }
            ]`;

const newFields = `            [
              { name: 'Tagger', value: \`[\${message.author.tag}](https://discord.com/users/\${userId})\`, inline: true },
              { name: 'Server', value: \`\${message.guild.name}\`, inline: true },
              { name: 'Channel', value: \`[\${message.channel.name}](https://discord.com/channels/\${guildId}/\${message.channel.id})\`, inline: true },
              { name: 'Message Link', value: \`[Jump to Message](https://discord.com/channels/\${guildId}/\${message.channel.id}/\${message.id})\` }
            ]`;

text = text.replace(oldFields, newFields);

fs.writeFileSync("src/events/messageCreate.js", text);
