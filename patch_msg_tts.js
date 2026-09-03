import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldCode = `    // Find command by name (loader.js populates aliases directly in commandMap)`;

const newCode = `    // --- AUTO TTS SYSTEM ---
    if (usedPrefix === null && !message.author.bot) {
      const autoTtsUsers = db.getAutoTtsUsers(message.guild.id);
      if (autoTtsUsers.includes(message.author.id)) {
        import('../commands/tts.js').then(module => {
          module.queueTtsMessage(message.member, message.content).catch(() => null);
        });
      }
    }

    // Find command by name (loader.js populates aliases directly in commandMap)`;

js = js.replace(oldCode, newCode);
fs.writeFileSync("src/events/messageCreate.js", js);
