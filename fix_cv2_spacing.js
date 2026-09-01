import fs from "fs";
let text = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Fix standard applyWarning
const oldStr1 = `            const section = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(\`**\${headingStr} | <:ticks:1533860039213842565>**\`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ extension: 'png', size: 128 })));
            c.addSectionComponents(section);
            const textContent = \`Reason: . \${message.author} , \${actionStr}\\n        ╰› has been warned " Your Limit is \${warns.length}/\${maxWarnings} " Exceeding the limits will leads to punishments ,\`;
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent));`;

const newStr1 = `            const textContent = \`> Reason: . \${message.author} , **\${actionStr}**\\n> ╰› has been warned " Your Limit is \${warns.length}/\${maxWarnings} " Exceeding the limits will leads to punishments ,\`;
            const section = new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(\`**\${headingStr} | <:ticks:1533860039213842565>**\`),
                    new TextDisplayBuilder().setContent(textContent)
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ extension: 'png', size: 128 })));
            c.addSectionComponents(section);`;

text = text.replace(oldStr1, newStr1);

// Fix Security Lock Triggered warning
const oldStr2 = `            const section = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(\`**Security Quarantine | <:ticks:1533860039213842565>**\`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ extension: 'png', size: 128 })));
            c.addSectionComponents(section);
            const textContent = \`Reason: . \${message.author} , **Maximum Warnings Exceeded**\\n        ╰› has been automatically quarantined. \${qRes.message || ''}\`;
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent));`;

const newStr2 = `            const textContent = \`> Reason: . \${message.author} , **Maximum Warnings Exceeded**\\n> ╰› has been automatically quarantined. \${qRes.message || ''}\`;
            const section = new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(\`**Security Quarantine | <:ticks:1533860039213842565>**\`),
                    new TextDisplayBuilder().setContent(textContent)
                )
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(message.author.displayAvatarURL({ extension: 'png', size: 128 })));
            c.addSectionComponents(section);`;

text = text.replace(oldStr2, newStr2);

fs.writeFileSync("src/events/messageCreate.js", text);
