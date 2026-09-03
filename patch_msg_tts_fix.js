import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

// Remove the old block
const oldBlock = `    // --- AUTO TTS SYSTEM ---
    if (usedPrefix === null && !message.author.bot) {
      const autoTtsUsers = db.getAutoTtsUsers(message.guild.id);
      if (autoTtsUsers.includes(message.author.id)) {
        import('../commands/tts.js').then(module => {
          module.queueTtsMessage(message.member, message.content).catch(() => null);
        });
      }
    }

`;
js = js.replace(oldBlock, "");

// Insert the block before `if (usedPrefix === null) return;`
const newBlock = `    // --- AUTO TTS SYSTEM ---
    if (!usedPrefix && !message.author.bot) {
      const autoTtsUsers = db.getAutoTtsUsers(message.guild.id);
      if (autoTtsUsers.includes(message.author.id)) {
        import('../commands/tts.js').then(module => {
          module.queueTtsMessage(message.member, message.content).catch(() => null);
        });
      }
    }

    if (usedPrefix === null) return;`;

js = js.replace("    if (usedPrefix === null) return;", newBlock);

fs.writeFileSync("src/events/messageCreate.js", js);
