import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

const inviteQ = `const criticalEmbed = {
              components: [{
                type: 9,
                components: [{
                  type: 10,
                  content: \`-# **Invite Quarantine Protocol |** <:ticks:1533860039213842565>\\n> -# Reason: . \${message.author} , **Exceeded Invite Warnings**\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A has been automatically **quarantined** for exceeding maximum thresholds (\${warns.length}/\${maxWarnings}).\`
                }],
                accessory: { type: 11, media: { url: message.author.displayAvatarURL({ dynamic: true }) } }
              }],
              flags: MessageFlags.IsComponentsV2
            };`;

const profanityQ = `const criticalEmbed = {
              components: [{
                type: 9,
                components: [{
                  type: 10,
                  content: \`-# **Profanity Quarantine Protocol |** <:ticks:1533860039213842565>\\n> -# Reason: . \${message.author} , **Exceeded Word Filter Warnings**\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A has been automatically **quarantined** for exceeding maximum thresholds (\${warns.length}/\${maxWarnings}).\`
                }],
                accessory: { type: 11, media: { url: message.author.displayAvatarURL({ dynamic: true }) } }
              }],
              flags: MessageFlags.IsComponentsV2
            };`;

text = text.replace(/const criticalEmbed = cv2\.danger\(\s*'Invite Quarantine Protocol'[\s\S]*?\);\s*await message\.channel\.send\(criticalEmbed\)\.catch\(\(\) => null\);/g, `${inviteQ}\n            await message.channel.send(criticalEmbed).catch(() => null);`);
text = text.replace(/const criticalEmbed = cv2\.danger\(\s*'Profanity Quarantine Protocol'[\s\S]*?\);\s*await message\.channel\.send\(criticalEmbed\)\.catch\(\(\) => null\);/g, `${profanityQ}\n            await message.channel.send(criticalEmbed).catch(() => null);`);

fs.writeFileSync("src/events/messageCreate.js", text);
