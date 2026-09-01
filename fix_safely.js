import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

const dmEmbedOld = `const dmEmbed = cv2.danger(
      'Server Isolation Notice',
      \` You have been placed under **Quarantine** in **\${guild.name}**.\`,
      [
        { name: 'Reason', value: reason },
        { name: 'Duration', value: durationLabel, inline: true },
        { name: 'Assigned By', value: \`\${moderator.user?.tag || 'Automated System'}\`, inline: true },
        { name: 'Instructions', value: \`Your access to the rest of the server has been restricted. Please navigate to <#\${quarantineChannel.id}> to resolve this matter.\` }
      ]
    );`;

const dmEmbedNew = `const dmEmbed = new EmbedBuilder()
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

text = text.replace(/const dmEmbed = \{\s*components: \[\{\s*type: 9,[\s\S]*?flags: MessageFlags\.IsComponentsV2\s*\};/g, dmEmbedNew);

const welcomeEmbedOld = `const welcomeEmbed = {
      content: \`\${targetMember}\`,
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

const welcomeEmbedNew = `const welcomeEmbed = {
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

text = text.replace(/const welcomeEmbed = \{\s*content: `\$\{targetMember\}`,\s*components: \[\{\s*type: 9,[\s\S]*?flags: MessageFlags\.IsComponentsV2\s*\};/g, welcomeEmbedNew);

fs.writeFileSync("src/commands/security.js", text);
