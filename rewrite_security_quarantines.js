import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

const dmEmbedReplacement = `const dmEmbed = {
      components: [{
        type: 9,
        components: [{
          type: 10,
          content: \`-### **Server Isolation Notice |** <:ticks:1533860039213842565>\\n> -# Hello \${targetMember.user.username} , **You have been Quarantined in \${guild.name}**\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Your access has been restricted. Please navigate to <#\${quarantineChannel.id}> to resolve this matter.\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Reason:** \${reason}\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Duration:** \${durationLabel}\`
        }],
        accessory: { type: 11, media: { url: guild.iconURL({ dynamic: true }) || undefined } }
      }],
      flags: MessageFlags.IsComponentsV2
    };`;

const welcomeEmbedReplacement = `const welcomeEmbed = {
      content: \`\${targetMember}\`,
      components: [{
        type: 9,
        components: [{
          type: 10,
          content: \`-### **You Have Been Quarantined |** <:ticks:1533860039213842565>\\n> -# Reason: . \${targetMember} , **Security Isolation Active**\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A Please wait patiently for an Administrator or Moderator to review your case. Any further spamming or rule violations will result in a permanent ban.\\n> -# \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A **Reason:** \${reason}\`
        }],
        accessory: { type: 11, media: { url: targetMember.user.displayAvatarURL({ dynamic: true }) } }
      }],
      flags: MessageFlags.IsComponentsV2
    };`;

text = text.replace(/const dmEmbed = cv2\.danger\([\s\S]*?await targetMember\.send\(dmEmbed\)\.catch\(\(\) => null\);/g, `${dmEmbedReplacement}\n    await targetMember.send(dmEmbed).catch(() => null);`);
text = text.replace(/const welcomeEmbed = cv2\.danger\([\s\S]*?await quarantineChannel\.send.*?console\.error.*?\);/g, `${welcomeEmbedReplacement}\n    await quarantineChannel.send(welcomeEmbed).catch(() => null);`);

fs.writeFileSync("src/commands/security.js", text);
