import fs from "fs";

// Fix messageCreate.js
let textMsg = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Re-wrap all type: 9 components in type: 17 containers
textMsg = textMsg.replace(/type: 9,\s*components: \[\{/g, "type: 17,\n                components: [{\n                  type: 9,\n                  components: [{");
textMsg = textMsg.replace(/accessory: \{ type: 11, media: \{ url: message\.author\.displayAvatarURL\(\{ dynamic: true \}\) \} \}\s*\}\],\s*flags: MessageFlags\.IsComponentsV2/g, `accessory: { type: 11, media: { url: message.author.displayAvatarURL({ dynamic: true }) } }
                  }]
                }],
                flags: MessageFlags.IsComponentsV2`);

fs.writeFileSync("src/events/messageCreate.js", textMsg);

// Fix security.js
let textSec = fs.readFileSync("src/commands/security.js", "utf8");

// Re-wrap dmEmbed in type: 17
const dmEmbedOld = `const dmEmbed = {
      components: [{
        type: 9,
        components: [{
          type: 10,
          content: \`-# **Server Isolation Notice |** <:ticks:1533860039213842565>\\n> -# **Hello \${targetMember.user.username} , You have been Quarantined in \${guild.name}**\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Your access has been restricted. Please navigate to <#\${quarantineChannel.id}> to resolve this matter.\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Reason:** \${reason}\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Duration:** \${durationLabel}\`
        }],
        accessory: { type: 11, media: { url: guild.iconURL({ dynamic: true }) || undefined } }
      }],
      flags: MessageFlags.IsComponentsV2
    };`;

const dmEmbedNew = `const dmEmbed = {
      components: [{
        type: 17,
        components: [{
          type: 9,
          components: [{
            type: 10,
            content: \`-# **Server Isolation Notice |** <:ticks:1533860039213842565>\\n> -# **Hello \${targetMember.user.username} , You have been Quarantined in \${guild.name}**\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Your access has been restricted. Please navigate to <#\${quarantineChannel.id}> to resolve this matter.\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Reason:** \${reason}\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Duration:** \${durationLabel}\`
          }],
          accessory: { type: 11, media: { url: guild.iconURL({ dynamic: true }) || undefined } }
        }]
      }],
      flags: MessageFlags.IsComponentsV2
    };`;

textSec = textSec.replace(dmEmbedOld, dmEmbedNew);

// Re-wrap welcomeEmbed in type: 17
const welcomeEmbedOld = `const welcomeEmbed = {
      components: [{
        type: 9,
        components: [{
          type: 10,
          content: \`-# **You Have Been Quarantined |** <:ticks:1533860039213842565>\\n> -# **Hello \${targetMember} , Security Isolation Active**\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Please wait patiently for an Administrator or Moderator to review your case. Any further spamming or rule violations will result in a permanent ban.\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Reason:** \${reason}\`
        }],
        accessory: { type: 11, media: { url: targetMember.user.displayAvatarURL({ dynamic: true }) } }
      }],
      flags: MessageFlags.IsComponentsV2
    };`;

const welcomeEmbedNew = `const welcomeEmbed = {
      components: [{
        type: 17,
        components: [{
          type: 9,
          components: [{
            type: 10,
            content: \`-# **You Have Been Quarantined |** <:ticks:1533860039213842565>\\n> -# **Hello \${targetMember} , Security Isolation Active**\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Please wait patiently for an Administrator or Moderator to review your case. Any further spamming or rule violations will result in a permanent ban.\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Reason:** \${reason}\`
          }],
          accessory: { type: 11, media: { url: targetMember.user.displayAvatarURL({ dynamic: true }) } }
        }]
      }],
      flags: MessageFlags.IsComponentsV2
    };`;

textSec = textSec.replace(welcomeEmbedOld, welcomeEmbedNew);

fs.writeFileSync("src/commands/security.js", textSec);
