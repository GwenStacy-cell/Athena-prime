import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

const oldStr = `        const c = new ContainerBuilder();
    const textContent = \`> Successfully restored **\${targetMember.user.username}** and recovered their original role structure.\\n> \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A User: \${targetMember} • Moderator: \${moderator}\`;
    const section = new SectionBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(\`**Quarantine Lifted | <:ticks:1533860039213842565>**\`),
            new TextDisplayBuilder().setContent(textContent)
        );
    c.addSectionComponents(section);`;

const newStr = `        const c = new ContainerBuilder();
    const textContent = \`**Quarantine Lifted | <:ticks:1533860039213842565>**\\n> Successfully restored **\${targetMember.user.username}** and recovered their original role structure.\\n> \\u2800\\u2800\\u2800\\u2800\\u2570\\u203A User: \${targetMember} • Moderator: \${moderator}\`;
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent));`;

text = text.replace(oldStr, newStr);
fs.writeFileSync("src/commands/security.js", text);
