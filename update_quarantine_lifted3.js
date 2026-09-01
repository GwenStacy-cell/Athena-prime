import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

const oldStr = `    const responseEmbed = cv2.success(
      'Quarantine Lifted',
      \`Successfully restored **\${targetMember.user.tag}** and recovered their original role structure.\`,
      [
        { name: 'User', value: \`\${targetMember}\`, inline: true },
        { name: 'Moderator', value: \`\${moderator}\`, inline: true }
      ]
    );`;

const newStr = `    const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = await import('discord.js');
    const c = new ContainerBuilder();
    const textContent = \`> Successfully restored **\${targetMember.user.username}** and recovered their original role structure.\\n>        ╰› User: \${targetMember} • Moderator: \${moderator}\`;
    const section = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(\`**Quarantine Lifted | <:ticks:1533860039213842565>**\`),
            new TextDisplayBuilder().setContent(textContent)
        );
    c.addSectionComponents(section);
    
    const responseEmbed = { components: [c], flags: MessageFlags.IsComponentsV2 };`;

text = text.replace(oldStr, newStr);
fs.writeFileSync("src/commands/security.js", text);
