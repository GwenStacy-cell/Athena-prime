import fs from "fs";
let code = fs.readFileSync("src/commands/serveroverview.js", "utf8");

const oldCode1 = `        const c = cv2.buildContainer(null, null, []);
        await message.channel.send({ components: [c], files: [attachment], flags: 32768 });`;

const newCode1 = `        const container = {
          type: 17,
          components: [
            { type: 10, content: '## **Server Statistics Overview**' },
            { type: 12, items: [{ media: { url: 'attachment://server-overview.png' } }] },
            { type: 14, divider: true },
            { type: 10, content: '-# **Athena Bulletproof Security !!!**' }
          ]
        };
        await message.channel.send({ components: [container], files: [attachment], flags: 32768 });`;

code = code.replace(oldCode1, newCode1);

const oldCode2 = `        const c = cv2.buildContainer(null, null, []);
        await interaction.editReply({ components: [c], files: [attachment], flags: 32768 });`;

const newCode2 = `        const container = {
          type: 17,
          components: [
            { type: 10, content: '## **Server Statistics Overview**' },
            { type: 12, items: [{ media: { url: 'attachment://server-overview.png' } }] },
            { type: 14, divider: true },
            { type: 10, content: '-# **Athena Bulletproof Security !!!**' }
          ]
        };
        await interaction.editReply({ components: [container], files: [attachment], flags: 32768 });`;

code = code.replace(oldCode2, newCode2);

fs.writeFileSync("src/commands/serveroverview.js", code);
console.log("Fixed serveroverview.js empty CV2 container!");
