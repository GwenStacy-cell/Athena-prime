import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldHook = `      // --- AUTO-REACT ---
      if (message.guild && !message.author.bot) {
        const cfg = db.getGuildConfig(message.guild.id);
        if (cfg && cfg.autoReacts && cfg.autoReacts[message.channel.id]) {
          const emojis = cfg.autoReacts[message.channel.id];
          for (const emoji of emojis) {
            message.react(emoji).catch(() => null);
          }
        }
      }`;

const newHook = `      // --- AUTO-REACT ---
      if (message.guild && !message.author.bot) {
        const cfg = db.getGuildConfig(message.guild.id);
        if (cfg && cfg.autoReacts && cfg.autoReacts[message.channel.id]) {
          const emojis = cfg.autoReacts[message.channel.id];
          for (const emoji of emojis) {
            const match = emoji.match(/<a?:.+?:(\\d+)>/);
            const reactId = match ? match[1] : emoji;
            message.react(reactId).catch(() => null);
          }
        }
      }`;

js = js.replace(oldHook, newHook);
fs.writeFileSync("src/events/messageCreate.js", js);
