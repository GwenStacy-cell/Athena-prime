import fs from "fs";

let text = fs.readFileSync("src/commands/security.js", "utf8");

const oldResponseStr = `      const responseEmbed = cv2.success(
        'Quarantine Lifted',
        \`Successfully restored **\${targetMember.user.tag}** and recovered their original role structure.\`,
        [
          { name: 'User', value: \`\${targetMember}\`, inline: true },
          { name: 'Moderator', value: \`\${moderator}\`, inline: true }
        ]
      );
  
      return { success: true, embed: responseEmbed };`;

const newResponseStr = `      const { ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
      const c = new ContainerBuilder();
      const section = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(\`**Quarantine Lifted | <:ticks:1533860039213842565>**\`));
      c.addSectionComponents(section);
      const textContent = \`Successfully restored **\${targetMember.user.tag}** and recovered their original role structure.\\n        ╰› User: \${targetMember} • Moderator: \${moderator}\`;
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent));
      
      const responseEmbed = { components: [c], flags: MessageFlags.IsComponentsV2 };
      return { success: true, embed: responseEmbed };`;

text = text.replace(oldResponseStr, newResponseStr);

fs.writeFileSync("src/commands/security.js", text);
