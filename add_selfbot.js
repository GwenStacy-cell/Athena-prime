import fs from "fs";
let mc = fs.readFileSync("src/events/messageCreate.js", "utf8");

const selfbotBlock = `
      // 2.7 SELFBOT DETECTION
      if (dbConfig.selfbotDetectionEnabled !== false && !checkBypass('Selfbot Detection')) {
         if (!message.author.bot && message.embeds.length > 0) {
            // Check if any embed is a "rich" embed (which standard users cannot send natively)
            if (message.embeds.some(e => e.type === 'rich')) {
               message.delete().catch(() => null);
               return applyWarning(message, "Selfbot Detection", "Illegal Automated Rich Embed Generation");
            }
         }
      }
`;

mc = mc.replace(
    /\/\/ 3\. ANTI-SPAM & ANTI FLOOD/,
    selfbotBlock.trim() + "\n\n      // 3. ANTI-SPAM & ANTI FLOOD"
);

fs.writeFileSync("src/events/messageCreate.js", mc);
