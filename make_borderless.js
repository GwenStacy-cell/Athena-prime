import fs from "fs";

// 1. Fix messageCreate.js (Remove type: 17 wrapper from all warning payloads to make them borderless)
let textMsg = fs.readFileSync("src/events/messageCreate.js", "utf8");

textMsg = textMsg.replace(/type: 17,\s*components: \[\{\s*type: 9/g, "type: 9");
textMsg = textMsg.replace(/accessory: \{ type: 11, media: \{ url: message\.author\.displayAvatarURL\(\{ dynamic: true \}\) \} \}\s*\}\]\s*\}\],\s*flags: MessageFlags\.IsComponentsV2/g, `accessory: { type: 11, media: { url: message.author.displayAvatarURL({ dynamic: true }) } }
                }],
                flags: MessageFlags.IsComponentsV2`);

fs.writeFileSync("src/events/messageCreate.js", textMsg);

// 2. Fix security.js (DM embed back to borderless SectionBuilder, Welcome embed borderless and remove root content)
let textSec = fs.readFileSync("src/commands/security.js", "utf8");

const dmEmbedOld = `const dmEmbed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle('Server Isolation Notice | <:ticks:1533860039213842565>')
      .setDescription(\`You have been placed under Quarantine in **\${guild.name}**.\`)
      .addFields(
        { name: 'Reason', value: \`\\u2570\\u203A \${reason}\` },
        { name: 'Duration', value: \`\\u2570\\u203A \${durationLabel}\`, inline: true },
        { name: 'Assigned By', value: \`\\u2570\\u203A \${moderator.user?.tag || 'Automated System'}\`, inline: true },
        { name: 'Instructions', value: \`\\u2570\\u203A Your access to the rest of the server has been restricted. Please navigate to <#\${quarantineChannel.id}> to resolve this matter.\` }
      )
      .setFooter({ text: 'Athena Bulletproof Security !!!' });`;

const dmEmbedNew = `const dmEmbed = {
      components: [{
        type: 9,
        components: [{
          type: 10,
          content: \`-# **Server Isolation Notice |** <:ticks:1533860039213842565>\\n> -# Hello \${targetMember.user.username} , **You have been Quarantined in \${guild.name}**\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Your access has been restricted. Please navigate to <#\${quarantineChannel.id}> to resolve this matter.\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Reason:** \${reason}\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Duration:** \${durationLabel}\`
        }],
        accessory: { type: 11, media: { url: guild.iconURL({ dynamic: true }) || undefined } }
      }],
      flags: MessageFlags.IsComponentsV2
    };`;

textSec = textSec.replace(dmEmbedOld, dmEmbedNew);
textSec = textSec.replace(/await targetMember\.send\(\{ embeds: \[dmEmbed\] \}\)\.catch\(\(\) => null\);/g, "await targetMember.send(dmEmbed).catch(() => null);");

const welcomeEmbedOld = `const welcomeEmbed = {
      content: \`\${targetMember}\`,
      components: [{
        type: 17,
        components: [{
          type: 9,
          components: [{
            type: 10,
            content: \`-# **You Have Been Quarantined |** <:ticks:1533860039213842565>\\n> -# Reason: . \${targetMember} , **Security Isolation Active**\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Please wait patiently for an Administrator or Moderator to review your case. Any further spamming or rule violations will result in a permanent ban.\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Reason:** \${reason}\`
          }],
          accessory: { type: 11, media: { url: targetMember.user.displayAvatarURL({ dynamic: true }) } }
        }]
      }],
      flags: MessageFlags.IsComponentsV2
    };`;

const welcomeEmbedNew = `const welcomeEmbed = {
      components: [{
        type: 9,
        components: [{
          type: 10,
          content: \`-# **You Have Been Quarantined |** <:ticks:1533860039213842565>\\n> -# Reason: . \${targetMember} , **Security Isolation Active**\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Please wait patiently for an Administrator or Moderator to review your case. Any further spamming or rule violations will result in a permanent ban.\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Reason:** \${reason}\`
        }],
        accessory: { type: 11, media: { url: targetMember.user.displayAvatarURL({ dynamic: true }) } }
      }],
      flags: MessageFlags.IsComponentsV2
    };`;

textSec = textSec.replace(welcomeEmbedOld, welcomeEmbedNew);

fs.writeFileSync("src/commands/security.js", textSec);
