import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldCode = `    // --- AUTO TTS SYSTEM ---
    if (!usedPrefix && !message.author.bot) {
      const autoTtsUsers = db.getAutoTtsUsers(message.guild.id);
      if (autoTtsUsers.includes(message.author.id)) {
        import('../commands/tts.js').then(module => {
          module.queueTtsMessage(message.member, message.content).catch(() => null);
        });
      }
    }`;

const newCode = `    // --- AUTO TTS SYSTEM ---
    if (!usedPrefix && !message.author.bot) {
      const autoTtsUsers = db.getAutoTtsUsers(message.guild.id);
      const autoTtsVc = db.getAutoTtsVc(message.guild.id);
      
      const isAutoUser = autoTtsUsers.includes(message.author.id);
      const isAutoVc = autoTtsVc && message.member?.voice?.channelId === autoTtsVc;

      if (isAutoUser || isAutoVc) {
        import('../commands/tts.js').then(module => {
          module.queueTtsMessage(message.member, message.content).catch(() => null);
        });
      }
    }`;

js = js.replace(oldCode, newCode);
fs.writeFileSync("src/events/messageCreate.js", js);
