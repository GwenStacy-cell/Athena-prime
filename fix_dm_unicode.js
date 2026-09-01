import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(/const dmEmbed = new EmbedBuilder\(\)[\s\S]*?\.setFooter.*?;/g, `const dmEmbed = new EmbedBuilder()
      .setColor('#2b2d31')
      .setTitle('Server Isolation Notice | <:ticks:1533860039213842565>')
      .setDescription(\`You have been placed under Quarantine in **\${guild.name}**.\`)
      .addFields(
        { name: 'Reason', value: \`\\u2570\\u203A \${reason}\` },
        { name: 'Duration', value: \`\\u2570\\u203A \${durationLabel}\`, inline: true },
        { name: 'Assigned By', value: \`\\u2570\\u203A \${moderator.user?.tag || 'Automated System'}\`, inline: true },
        { name: 'Instructions', value: \`\\u2570\\u203A Your access to the rest of the server has been restricted. Please navigate to <#\${quarantineChannel.id}> to resolve this matter.\` }
      )
      .setFooter({ text: 'Athena Bulletproof Security !!!' });`);

fs.writeFileSync("src/commands/security.js", text);
