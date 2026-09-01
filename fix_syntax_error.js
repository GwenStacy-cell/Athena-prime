import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

// We need to fix the two broken blocks. 
// They look like this:
/*
          // Channel Warning
          const scamEmbed = cv2.danger('LOG: MALICIOUS SCAM TEXT DELETED', `**User:** <@${message.author.id}> (${message.author.tag})\n**Action:** Posted fraudulent text/link containing known scam keywords (Mr. Beast/Kasowin/Helawin/Crypto Casino).\n\n**Channel:** <#${message.channel.id}>`);
            .setTimestamp();
          
          try {
            const { default: db } = await import('../database.js');
            const config = db.getGuildConfig(message.guild.id);
            if (config && config.accentColor) logEmbed.setColor(config.accentColor);
          } catch(e) {}
          
          logToSecurityChannel(message.guild, logEmbed);
*/

text = text.replace(/const scamEmbed = cv2\.danger\('LOG: MALICIOUS SCAM TEXT DELETED'[\s\S]*?logToSecurityChannel\(message\.guild, logEmbed\);/g, `const scamEmbed = cv2.danger('Scam Detected', \`<a:emoji_35:1533024049926639699> <@\${message.author.id}>, your message was flagged as a scam and removed.\`);
          await message.channel.send(scamEmbed).then(m => setTimeout(() => m.delete().catch(()=>null), 5000));
          
          const logEmbed = cv2.danger('LOG: MALICIOUS SCAM TEXT DELETED', \`**User:** <@\${message.author.id}> (\${message.author.tag})\\n**Action:** Posted fraudulent text/link containing known scam keywords (Mr. Beast/Kasowin/Helawin/Crypto Casino).\\n\\n**Channel:** <#\${message.channel.id}>\`);
          
          logToSecurityChannel(message.guild, logEmbed);`);

text = text.replace(/const scamImgEmbed = cv2\.danger\('LOG: MALICIOUS SCAM IMAGE DELETED'[\s\S]*?logToSecurityChannel\(message\.guild, logEmbed\);/g, `const scamImgEmbed = cv2.danger('Scam Detected', \`<a:emoji_35:1533024049926639699> <@\${message.author.id}>, your image was flagged as a scam and removed.\`);
                 await message.channel.send(scamImgEmbed).then(m => setTimeout(() => m.delete().catch(()=>null), 5000));
                 
                 const logEmbed = cv2.danger('LOG: MALICIOUS SCAM IMAGE DELETED', \`**User:** <@\${message.author.id}> (\${message.author.tag})\\n**Action:** Posted a fraudulent image containing known scam keywords (Mr. Beast/Kasowin/Helawin/Crypto Casino).\\n\\n**Channel:** <#\${message.channel.id}>\`);
                 
                 logToSecurityChannel(message.guild, logEmbed);`);

fs.writeFileSync("src/events/messageCreate.js", text);
