import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const t = `      // ==========================================
      // 4.45 PREFIX-LESS: BACKUP (Bot Owner + Server Owner)
      // Server owners can backup their own server without ezal prefix
      // ==========================================
      if (msgCheck === 'backup' || msgCheck.startsWith('backup ')) {
        const isOwner = isBotOwnerSync(message.author.id);
        const isServerOwner = message.guild && message.author.id === message.guild.ownerId;
        if (isOwner || isServerOwner) {
          const backupArgs = message.content.trim().split(/ +/).slice(1);
          await handleBackup(message, backupArgs).catch(console.error);
        }
        return;
      }`;

js = js.replace(t, "");
fs.writeFileSync("src/events/messageCreate.js", js);
