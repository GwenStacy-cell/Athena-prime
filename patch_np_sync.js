import fs from "fs";
let js = fs.readFileSync("src/events/messageCreate.js", "utf8");

const target = `    // --- GLOBAL NO-PREFIX (NP) BYPASS ---
    if (!usedPrefix && !db.isNpPaused()) {
      const npUser = db.getNpUser(message.author.id);
      const npServer = db.getNpServer(message.guild.id);
      if (npUser || npServer) {
        // Attempt to match the first word as a command
        const firstWord = message.content.trim().split(/ +/)[0].toLowerCase();
        if (commandMap.has(firstWord)) {
          const bannedCmds = db.getNpBannedCommands();
          if (!bannedCmds.includes(firstWord)) {
            usedPrefix = ''; // No prefix used, bypass successful
            isNpBypass = true;
          }
        }
      }
    }`;

const replace = `    // --- GLOBAL NO-PREFIX (NP) BYPASS ---
    if (!usedPrefix && !db.isNpPaused()) {
      const npUser = db.getNpUser(message.author.id);
      const npServer = db.getNpServer(message.guild.id);
      if (npUser || npServer) {
        // Attempt to match the first word as a command
        const firstWord = message.content.trim().split(/ +/)[0].toLowerCase();
        
        const gConfig = db.getGuildConfig(message.guild.id);
        const cAliases = gConfig?.customCommands || {};
        
        if (commandMap.has(firstWord) || cAliases[firstWord]) {
          const actualCmd = cAliases[firstWord] || firstWord;
          const bannedCmds = db.getNpBannedCommands();
          if (!bannedCmds.includes(actualCmd)) {
            usedPrefix = ''; // No prefix used, bypass successful
            isNpBypass = true;
          }
        }
      }
    }`;

js = js.replace(target, replace);
fs.writeFileSync("src/events/messageCreate.js", js);
