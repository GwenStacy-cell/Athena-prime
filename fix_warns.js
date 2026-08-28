import fs from "fs";
let code = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Invite Warn Replacement
const oldInviteWarnRegex = /const warnEmbed = embed\.build\(\{[\s\S]*?description: `__\*\*Warned Sending Invites \|.*?[\s\S]*?await message\.channel\.send\(\{ embeds: \[warnEmbed\] \}\)\.catch\(\(\) => null\);/m;

const newInviteWarn = `const warnPayload = {
              components: [{
                type: 17,
                components: [{
                  type: 9,
                  components: [{
                    type: 10,
                    content: \`**Warned Sending Invites |** <:dark4luvontop:1533860081916182721>\\n> Reason: . \${message.author} , **Posted Discord Invite**\\n> \\u2800\\u2800\\u2800\\u2800╰› has been warned " Your Limit is \${warns.length}/\${maxWarnings} " Exceeding the limits will leads to punishments ,\`
                  }],
                  accessory: { type: 11, media: { url: message.author.displayAvatarURL({ dynamic: true }) } }
                }]
              }],
              flags: MessageFlags.IsComponentsV2
            };
            await message.channel.send(warnPayload).catch(() => null);`;

// Word Filter Replacement
const oldWordWarnRegex = /const filterWarnEmbed = embed\.build\(\{[\s\S]*?description: `__\*\*Word Filter Triggered \|.*?[\s\S]*?await message\.channel\.send\(\{ embeds: \[filterWarnEmbed\] \}\)\.catch\(\(\) => null\);/m;

const newWordWarn = `const filterWarnPayload = {
              components: [{
                type: 17,
                components: [{
                  type: 9,
                  components: [{
                    type: 10,
                    content: \`**Word Filter Triggered |** <:dark4luvontop:1533860081916182721>\\n> Reason: . \${message.author} , **Posted Blacklisted Word**\\n> \\u2800\\u2800\\u2800\\u2800╰› has been warned " Your Limit is \${warns.length}/\${maxWarnings} " Exceeding the limits will leads to punishments ,\`
                  }],
                  accessory: { type: 11, media: { url: message.author.displayAvatarURL({ dynamic: true }) } }
                }]
              }],
              flags: MessageFlags.IsComponentsV2
            };
            await message.channel.send(filterWarnPayload).catch(() => null);`;

if (!oldInviteWarnRegex.test(code)) {
   console.log("Regex for Invite failed!");
} else if (!oldWordWarnRegex.test(code)) {
   console.log("Regex for Word failed!");
} else {
   code = code.replace(oldInviteWarnRegex, newInviteWarn);
   code = code.replace(oldWordWarnRegex, newWordWarn);
   fs.writeFileSync("src/events/messageCreate.js", code);
   console.log("Successfully replaced both warnings with CV2 borderless payloads!");
}
