import fs from "fs";
let code = fs.readFileSync("src/commands/record.js", "utf8");

const oldStopResolve = `const targetGuildId = message.guild ? message.guild.id : (args[1] ? args[1] : null);
          if (!targetGuildId) return message.reply("You must specify the Server ID when stopping remotely from DMs: \`!record stop <ServerID>\`");`;

const newStopResolve = `let targetGuildId = message.guild ? message.guild.id : (args[1] ? args[1] : null);
          if (targetGuildId) {
             // If they passed a channel ID or user ID, find the guild
             const channel = message.client.channels.cache.get(targetGuildId);
             if (channel && channel.guild) targetGuildId = channel.guild.id;
             else {
                 let globalVc = null;
                 message.client.guilds.cache.forEach(g => {
                     const mem = g.members.cache.get(targetGuildId);
                     if (mem && mem.voice.channel) globalVc = mem.voice.channel;
                 });
                 if (globalVc) targetGuildId = globalVc.guild.id;
             }
          }
          if (!targetGuildId) return message.reply("You must specify a valid target (Server ID, Channel ID, or User ID) when stopping remotely from DMs: \`!record stop <ID>\`");`;

code = code.replace(oldStopResolve, newStopResolve);
fs.writeFileSync("src/commands/record.js", code);
console.log("Updated record.js target resolution for stop!");
