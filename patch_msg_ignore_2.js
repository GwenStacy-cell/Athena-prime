import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const oldCode = /const cmd = commandMap\.get\(commandName\);\s*\/\/ Intelligent command error correction with fuzzy matching/;
const newCode = `const cmd = commandMap.get(commandName);

    // --- COMMAND & CHANNEL IGNORE SYSTEM ---
    if (cmd && !isNpBypass) {
      const ignoredChannels = db.getIgnoredChannels(message.guild.id);
      const ignoredCategories = db.getIgnoredCategories(message.guild.id);
      
      const isIgnored = ignoredChannels.includes('ALL') || 
                        ignoredChannels.includes(message.channel.id) || 
                        (message.channel.parentId && ignoredCategories.includes(message.channel.parentId));

      if (isIgnored) {
        const { isServerAdmin } = await import('../utils/helpers.js');
        if (!isServerAdmin(message.member, message.guild)) {
           // Channel is ignored and user is not an admin, silently drop the command
           return;
        }
      }
    }

    // Intelligent command error correction with fuzzy matching`;

js = js.replace(oldCode, newCode);
fs.writeFileSync("src/events/messageCreate.js", js);
