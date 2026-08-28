import fs from "fs";
let code = fs.readFileSync("src/events/interactionCreate.js", "utf8");

const stopBtnOld = `          try {
            const { stopRecording } = await import('../utils/audioRecorder.js');
            const mp3Path = await stopRecording(interaction.guild.id);
            if (!mp3Path) {
               const emptyContainer = { type: 17, components: [{ type: 10, content: '-# No active recording found for this server.' }] };
               return interaction.message.edit({ components: [emptyContainer] });
            }
            const successContainer = { type: 17, components: [{ type: 10, content: '-# **Audio Export Successful!**' }] };
            await interaction.message.edit({ components: [successContainer] });
            await interaction.followUp({ files: [mp3Path] });
            const fs = await import('fs');
            fs.unlink(mp3Path, () => {});
          } catch (err) {`;

const stopBtnNew = `          try {
            const { stopRecording } = await import('../utils/audioRecorder.js');
            const result = await stopRecording(interaction.guild.id);
            if (!result) {
               const emptyContainer = { type: 17, components: [{ type: 10, content: '-# No active recording found for this server.' }] };
               return interaction.message.edit({ components: [emptyContainer] });
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
                     components: [{ type: 10, content: \`-# **Server :** **\${interaction.guild.name}**\\n-# **Channel :** **\${vcName}**\\n-# **Started At :** **\${startDate}**\\n-# **Duration :** **\${durationStr}**\` }],
                     accessory: { type: 11, media: { url: interaction.guild.iconURL({ dynamic: true }) || 'https://i.imgur.com/8Qj85vP.png' } }
                  },
                  { type: 14, divider: true },
                  { type: 10, content: \`-# **Audio file is attached below.**\` }
               ]
            };
            
            await interaction.user.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2, files: [mp3Path] }).catch(() => null);
            
            const successContainer = { type: 17, components: [{ type: 10, content: \`-# **Audio Export Successful:** Delivered securely to your DMs.\` }] };
            await interaction.message.edit({ components: [successContainer] });
            
            const fs = await import('fs');
            fs.unlink(mp3Path, () => {});
          } catch (err) {`;

code = code.replace(stopBtnOld, stopBtnNew);

fs.writeFileSync("src/events/interactionCreate.js", code);
console.log("Updated interactionCreate.js!");
