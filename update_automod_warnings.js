import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldApplyWarningStr = `      const applyWarning = async (reason, publicAlert, alertTitle) => {
          const warns = db.addWarning(guildId, userId, message.client.user.id, reason);
          logToSecurityChannel(message.guild, cv2.log(
            alertTitle,
            reason,
            [
              { name: 'Member', value: \`\${message.author.tag} (\${userId})\`, inline: true },
              { name: 'Channel', value: \`\${message.channel}\`, inline: true },
              { name: 'Warn Increment', value: \`\\\`\${warns.length}\\\` / \${maxWarnings}\` }
            ],
            'warning'
          ));
          if (warns.length >= maxWarnings) {
            const qRes = await executeQuarantine(message.guild, message.member, message.guild.members.me, \`Automated: \${alertTitle} limit reached\`);
            db.clearWarnings(guildId, userId);
            await message.channel.send(cv2.danger('Security Lock Triggered', \`**\${message.author.tag}** has been automatically quarantined.\\n\\n\${qRes.message || ''}\`)).catch(() => null);
          } else if (publicAlert) {
            await message.channel.send(cv2.warn('<:gun:1533859911631376496> ' + alertTitle, \`\${message.author}, \${publicAlert}\\n\\n**Warning Count:** \\\`\${warns.length}\\\` / \${maxWarnings}\`)).catch(() => null);
          }
      };`;

const newApplyWarningStr = `      const applyWarning = async (logReason, actionStr, headingStr) => {
          const warns = db.addWarning(guildId, userId, message.client.user.id, logReason);
          logToSecurityChannel(message.guild, cv2.log(
            headingStr,
            logReason,
            [
              { name: 'Member', value: \`\${message.author.tag} (\${userId})\`, inline: true },
              { name: 'Channel', value: \`\${message.channel}\`, inline: true },
              { name: 'Warn Increment', value: \`\\\`\${warns.length}\\\` / \${maxWarnings}\` }
            ],
            'warning'
          ));
          if (warns.length >= maxWarnings) {
            const qRes = await executeQuarantine(message.guild, message.member, message.guild.members.me, \`Automated: \${headingStr} limit reached\`);
            db.clearWarnings(guildId, userId);
            await message.channel.send(cv2.danger('Security Lock Triggered', \`**\${message.author.tag}** has been automatically quarantined.\\n\\n\${qRes.message || ''}\`)).catch(() => null);
          } else {
            const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = require('discord.js');
            const c = new ContainerBuilder();
            const section = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(\`**\${headingStr} | <:ticks:1533860039213842565>**\`))
                .setAccessory(new ThumbnailBuilder().setMedia(message.author.displayAvatarURL({ extension: 'png', size: 128 })));
            c.addSectionComponents(section);
            const textContent = \`Reason: . \${message.author} , \${actionStr}\\n        ╰› has been warned " Your Limit is \${warns.length}/\${maxWarnings} " Exceeding the limits will leads to punishments ,\`;
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent));
            await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
          }
      };`;

text = text.replace(oldApplyWarningStr, newApplyWarningStr);

// Now update all the calls
text = text.replace(
  "await applyWarning(`User spam pinged ${user.tag} multiple times.`, `Mass Mention Filter triggered. You have been timed out for 5 minutes.`, 'Mass Mention Filter');",
  "await applyWarning(`User spam pinged ${user.tag} multiple times.`, `Mass Mentions`, 'Warned Mass Mentions');"
);

text = text.replace(
  "await applyWarning(`Deleted invite promotion from member.`, `posting invites is strictly forbidden.`, 'Invite Link Filtered');",
  "await applyWarning(`Deleted invite promotion from member.`, `Posted Discord Invite`, 'Warned Sending Invites');"
);

text = text.replace(
  "await applyWarning(`Deleted message containing a URL.`, `posting links is not allowed.`, 'URL Filtered');",
  "await applyWarning(`Deleted message containing a URL.`, `Posted Links`, 'Warned URL Filter');"
);

text = text.replace(
  "await applyWarning(`Deceptive/Hidden hyperlink markdown detected.`, `deceptive links are strictly forbidden!`, 'Hidden URL Filter');",
  "await applyWarning(`Deceptive/Hidden hyperlink markdown detected.`, `Posted Hidden URL`, 'Warned Hidden URL');"
);

text = text.replace(
  "await applyWarning(`Uploaded a forbidden file extension: ${attachment.name}`, `uploading executable or compressed files is blocked for security.`, 'File Check Filter');",
  "await applyWarning(`Uploaded a forbidden file extension: ${attachment.name}`, `Uploaded Blocked File`, 'Warned File Uploading');"
);

text = text.replace(
  "await applyWarning(`Matched blacklisted phrase(s): ${matchedWords.join(', ')}`, `please refrain from using blacklisted words.`, 'Word Filter');",
  "await applyWarning(`Matched blacklisted phrase(s): ${matchedWords.join(', ')}`, `Used Swear Words`, 'Warned Using Swear Words');"
);

text = text.replace(
  "await applyWarning(`Excessive uppercase usage (Big Fonts)`, `please turn off caps lock!`, 'Big Fonts Filter');",
  "await applyWarning(`Excessive uppercase usage (Big Fonts)`, `Used Big Fonts`, 'Warned Big Fonts');"
);

text = text.replace(
  "await applyWarning(`User triggered rate-limits by exceeding message counts.`, `please slow down. Sending messages too fast is against server security rules.`, 'Spam / Flood Detected');",
  "await applyWarning(`User triggered rate-limits by exceeding message counts.`, `Spammed Messages`, 'Warned Spamming');"
);

fs.writeFileSync("src/events/messageCreate.js", text);
