import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldStr = `          if (warns.length >= maxWarnings) {
            const qRes = await executeQuarantine(message.guild, message.member, message.guild.members.me, \`Automated: \${headingStr} limit reached\`);
            db.clearWarnings(guildId, userId);
            await message.channel.send(cv2.danger('Security Lock Triggered', \`**\${message.author.tag}** has been automatically quarantined.\\n\\n\${qRes.message || ''}\`)).catch(() => null);
          } else {`;

const newStr = `          if (warns.length >= maxWarnings) {
            const qRes = await executeQuarantine(message.guild, message.member, message.guild.members.me, \`Automated: \${headingStr} limit reached\`);
            db.clearWarnings(guildId, userId);
            
            const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } = await import('discord.js');
            const c = new ContainerBuilder();
            const section = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(\`**Security Quarantine | <:ticks:1533860039213842565>**\`))
                .setAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ extension: 'png', size: 128 })));
            c.addSectionComponents(section);
            const textContent = \`Reason: . \${message.author} , **Maximum Warnings Exceeded**\\n        ╰› has been automatically quarantined. \${qRes.message || ''}\`;
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent));
            await message.channel.send({ components: [c], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
          } else {`;

text = text.replace(oldStr, newStr);

fs.writeFileSync("src/events/messageCreate.js", text);
