import fs from "fs";
let code = fs.readFileSync("src/commands/record.js", "utf8");

// Remove the strict check for message.member.voice.channel
// and allow remote target resolution
const startLogicOld = `const vc = message.member.voice.channel;
        if (!vc) return message.reply(cv2.error('Voice Recording Failed', 'You must be in a Voice Channel to start a recording session.'));`;

const startLogicNew = `let vc = message.member.voice.channel;
        const target = args[1];
        if (target) {
            // Check if it's a channel
            const channel = message.guild.channels.cache.get(target.replace(/<#|>/g, ''));
            if (channel && channel.isVoiceBased()) {
                vc = channel;
            } else {
                // Check if it's a user
                const member = message.guild.members.cache.get(target.replace(/<@!|@|>/g, ''));
                if (member && member.voice.channel) {
                    vc = member.voice.channel;
                }
            }
        }
        
        if (!vc) return message.reply(cv2.error('Voice Recording Failed', 'You must be in a Voice Channel to start a recording session, or provide a valid Channel ID / User ID as a target.'));`;

code = code.replace(startLogicOld, startLogicNew);

// Update record stop logic to send to DMs with CV2
const stopLogicOld = `const msg = await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        
        try {
          const mp3Path = await stopRecording(message.guild.id);
          if (!mp3Path) {
             return msg.edit({ content: 'No active recording found for this server.' });
          }
          await msg.edit({ content: \`-# **Audio Export Successful:**\`, files: [mp3Path] });
        } catch (err) {
          await msg.edit({ content: \`-# **Failed to process audio:** \${err.message}\` });
        }`;

const stopLogicNew = `const msg = await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        
        try {
          const result = await stopRecording(message.guild.id);
          if (!result) {
             return msg.edit({ components: [{ type: 17, components: [{ type: 10, content: '-# No active recording found for this server.' }] }] });
          }
          const { mp3Path, startTime, durationMs } = result;
          
          const durSec = Math.floor(durationMs / 1000);
          const durationStr = \`\${Math.floor(durSec/60)}m \${durSec%60}s\`;
          const startDate = new Date(startTime).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
          
          const dmContainer = {
             type: 17,
             components: [
                { type: 10, content: \`## **Athena Voice Export**\` },
                {
                   type: 9,
                   components: [{ type: 10, content: \`-# **Server :** **\${message.guild.name}**\\n-# **Channel :** **\${vcName}**\\n-# **Started At :** **\${startDate}**\\n-# **Duration :** **\${durationStr}**\` }],
                   accessory: { type: 11, media: { url: message.guild.iconURL({ dynamic: true }) || 'https://i.imgur.com/8Qj85vP.png' } }
                },
                { type: 14, divider: true },
                { type: 10, content: \`-# **Audio file is attached below.**\` }
             ]
          };
          
          await message.author.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2, files: [mp3Path] }).catch(() => null);
          await msg.edit({ components: [{ type: 17, components: [{ type: 10, content: \`-# **Audio Export Successful:** Delivered securely to your DMs.\` }] }] });
          
          const fs = await import('fs');
          fs.unlink(mp3Path, () => {});
        } catch (err) {
          await msg.edit({ components: [{ type: 17, components: [{ type: 10, content: \`-# **Failed to process audio:** \${err.message}\` }] }] });
        }`;

code = code.replace(stopLogicOld, stopLogicNew);

fs.writeFileSync("src/commands/record.js", code);
console.log("Updated record.js!");
