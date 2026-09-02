import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const hookCode = `
      // --- AUTO-REACT ---
      if (message.guild && !message.author.bot) {
        const cfg = db.getGuildConfig(message.guild.id);
        if (cfg && cfg.autoReacts && cfg.autoReacts[message.channel.id]) {
          const emojis = cfg.autoReacts[message.channel.id];
          for (const emoji of emojis) {
            message.react(emoji).catch(() => null);
          }
        }
      }

      // --- ADEL: Auto-delete messages from tracked users ---
`;

js = js.replace(/\/\/ --- ADEL: Auto-delete messages from tracked users ---/, hookCode);

fs.writeFileSync("src/events/messageCreate.js", js);
